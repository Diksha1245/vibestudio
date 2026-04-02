// netlify/functions/public-view.js
// GET  /api/public/pages/:slug          — fetch published page
// POST /api/public/pages/:slug/view     — increment view count
// POST /api/public/pages/:slug/contact  — submit contact form

const { query, initDb, json } = require('./_db');

exports.handler = async (event) => {
  const origin = event.headers?.origin;

  // ── CORS preflight ──
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      body: '',
    };
  }

  await initDb();

  // ── Parse path: /api/public/pages/:slug  or  /api/public/pages/:slug/:action ──
  const pathParts = (event.path || '').split('/').filter(Boolean);
  // e.g. ['api','public','pages','my-slug'] or ['api','public','pages','my-slug','view']
  const pagesIdx = pathParts.findIndex(p => p === 'pages');
  const slug     = pathParts[pagesIdx + 1];
  const action   = pathParts[pagesIdx + 2]; // 'view' | 'contact' | undefined

  if (!slug) return json(400, { error: 'Slug is required' }, origin);

  try {
    // ── GET /api/public/pages/:slug ──
    if (event.httpMethod === 'GET' && !action) {
      const result = await query(
        `SELECT id, title, slug, theme, content, view_count, updated_at
         FROM pages
         WHERE slug = $1 AND status = 'published'`,
        [slug]
      );
      if (!result.rows[0]) return json(404, { error: 'Page not found' }, origin);

      const row = result.rows[0];
      return json(200, {
        page: {
          id:        row.id,
          title:     row.title,
          slug:      row.slug,
          theme:     row.theme,
          content:   typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
          viewCount: row.view_count,
          updatedAt: row.updated_at,
        },
      }, origin);
    }

    // ── POST /api/public/pages/:slug/view ──
    if (event.httpMethod === 'POST' && action === 'view') {
      const result = await query(
        `UPDATE pages
         SET view_count = view_count + 1
         WHERE slug = $1 AND status = 'published'
         RETURNING view_count`,
        [slug]
      );
      if (!result.rows[0]) return json(404, { error: 'Page not found' }, origin);
      return json(200, { viewCount: result.rows[0].view_count }, origin);
    }

    // ── POST /api/public/pages/:slug/contact ──
    if (event.httpMethod === 'POST' && action === 'contact') {
      const body = JSON.parse(event.body || '{}');
      const { name, email, message } = body;

      // Validate
      if (!name?.trim())    return json(400, { error: 'Name is required' }, origin);
      if (!email?.trim())   return json(400, { error: 'Email is required' }, origin);
      if (!message?.trim()) return json(400, { error: 'Message is required' }, origin);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return json(400, { error: 'Invalid email address' }, origin);
      if (message.trim().length > 2000)
        return json(400, { error: 'Message is too long (max 2000 characters)' }, origin);

      // Verify page exists and is published
      const pageResult = await query(
        `SELECT id FROM pages WHERE slug = $1 AND status = 'published'`,
        [slug]
      );
      if (!pageResult.rows[0]) return json(404, { error: 'Page not found' }, origin);

      const pageId = pageResult.rows[0].id;

      // Store submission
      await query(
        `INSERT INTO contact_submissions (page_id, name, email, message)
         VALUES ($1, $2, $3, $4)`,
        [pageId, name.trim(), email.toLowerCase().trim(), message.trim()]
      );

      // ── Email notification via Resend (optional — gracefully skipped if key missing) ──
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        try {
          // Fetch page owner's email so we can notify them
          const ownerResult = await query(
            `SELECT u.email AS owner_email, p.title AS page_title
             FROM pages p JOIN users u ON p.user_id = u.id
             WHERE p.id = $1`,
            [pageId]
          );
          const owner = ownerResult.rows[0];
          if (owner) {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resendKey}`,
              },
              body: JSON.stringify({
                from: 'VibeKit Studio <notifications@vibekit-studio.netlify.app>',
                to: [owner.owner_email],
                subject: `New contact message on "${owner.page_title}"`,
                html: `
                  <p>You received a new contact form submission on your VibeKit page <strong>${owner.page_title}</strong>.</p>
                  <table style="border-collapse:collapse;width:100%;max-width:520px;">
                    <tr><td style="padding:8px 0;font-weight:600;color:#555;">Name</td><td style="padding:8px 0;">${name.trim()}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:600;color:#555;">Email</td><td style="padding:8px 0;">${email.toLowerCase().trim()}</td></tr>
                    <tr><td style="padding:8px 0;font-weight:600;color:#555;vertical-align:top;">Message</td><td style="padding:8px 0;white-space:pre-wrap;">${message.trim()}</td></tr>
                  </table>
                  <p style="margin-top:16px;color:#888;font-size:13px;">Sent via VibeKit Studio · <a href="https://vibekit-studio.netlify.app">vibekit-studio.netlify.app</a></p>
                `,
              }),
            });
          }
        } catch (emailErr) {
          // Email failure must never break the contact form — log and continue
          console.error('Resend email error (non-fatal):', emailErr.message);
        }
      }

      return json(201, { success: true, message: 'Message received!' }, origin);
    }

    return json(404, { error: 'Not found' }, origin);

  } catch (err) {
    console.error('public-view error:', err);
    return json(500, { error: 'Internal server error' }, origin);
  }
};