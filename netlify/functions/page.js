// netlify/functions/page.js
// GET    /api/pages/:id
// PUT    /api/pages/:id
// DELETE /api/pages/:id
// POST   /api/pages/:id/publish
// POST   /api/pages/:id/unpublish
// POST   /api/pages/:id/duplicate

const { query, initDb, json } = require('./_db');
const { getUser } = require('./_auth');

exports.handler = async (event) => {
  const origin = event.headers?.origin;
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': origin || '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, PUT, DELETE, POST, OPTIONS' }, body: '' };

  const userPayload = getUser(event);
  if (!userPayload) return json(401, { error: 'Unauthorized' }, origin);

  await initDb();

  // Parse path: /api/pages/:id or /api/pages/:id/:action
  const pathParts = (event.path || '').split('/').filter(Boolean);
  // pathParts might be: ['api','pages','<id>'] or ['api','pages','<id>','publish']
  const idIndex = pathParts.findIndex(p => p === 'pages') + 1;
  const pageId = pathParts[idIndex];
  const action = pathParts[idIndex + 1]; // 'publish' | 'unpublish' | 'duplicate'

  if (!pageId) return json(400, { error: 'Page ID required' }, origin);

  try {
    // Fetch page + verify ownership (always check user_id)
    const pageResult = await query(
      'SELECT * FROM pages WHERE id = $1 AND user_id = $2',
      [pageId, userPayload.userId]
    );
    const page = pageResult.rows[0];
    if (!page) return json(404, { error: 'Page not found' }, origin);

    // ─── ACTIONS ───
    if (action === 'publish') {
      const r = await query(
        "UPDATE pages SET status = 'published', updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *",
        [pageId, userPayload.userId]
      );
      return json(200, { page: formatPage(r.rows[0]) }, origin);
    }

    if (action === 'unpublish') {
      const r = await query(
        "UPDATE pages SET status = 'draft', updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *",
        [pageId, userPayload.userId]
      );
      return json(200, { page: formatPage(r.rows[0]) }, origin);
    }

    if (action === 'duplicate') {
      const newSlug = await uniqueSlug(page.slug + '-copy');
      const r = await query(
        `INSERT INTO pages (user_id, title, slug, theme, status, content)
         VALUES ($1, $2, $3, $4, 'draft', $5) RETURNING *`,
        [userPayload.userId, page.title + ' (Copy)', newSlug, page.theme, page.content]
      );
      return json(201, { page: formatPage(r.rows[0]) }, origin);
    }

    // ─── GET ───
    if (event.httpMethod === 'GET') {
      return json(200, { page: formatPageFull(page) }, origin);
    }

    // ─── PUT (update) ───
    if (event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const { title, slug, theme, content } = body;

      // Validate / clean slug
      let finalSlug = page.slug;
      if (slug && slug !== page.slug) {
        const cleanSlug = toSlug(slug);
        // Check if taken by another page
        const conflict = await query('SELECT id FROM pages WHERE slug = $1 AND id != $2', [cleanSlug, pageId]);
        if (conflict.rows.length > 0) {
          finalSlug = await uniqueSlug(cleanSlug);
        } else {
          finalSlug = cleanSlug;
        }
      }

      const r = await query(
        `UPDATE pages SET
          title = COALESCE($1, title),
          slug = $2,
          theme = COALESCE($3, theme),
          content = COALESCE($4, content),
          updated_at = NOW()
         WHERE id = $5 AND user_id = $6 RETURNING *`,
        [title?.trim() || null, finalSlug, theme || null, content ? JSON.stringify(content) : null, pageId, userPayload.userId]
      );
      return json(200, { page: formatPageFull(r.rows[0]) }, origin);
    }

    // ─── DELETE ───
    if (event.httpMethod === 'DELETE') {
      await query('DELETE FROM pages WHERE id = $1 AND user_id = $2', [pageId, userPayload.userId]);
      return json(200, { success: true }, origin);
    }

    return json(405, { error: 'Method not allowed' }, origin);

  } catch (err) {
    console.error('Page operation error:', err);
    return json(500, { error: 'Internal server error' }, origin);
  }
};

function toSlug(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

async function uniqueSlug(base) {
  const existing = await query('SELECT slug FROM pages WHERE slug LIKE $1', [`${base}%`]);
  const slugs = new Set(existing.rows.map(r => r.slug));
  if (!slugs.has(base)) return base;
  let i = 2;
  while (slugs.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

function formatPage(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    theme: row.theme,
    status: row.status,
    viewCount: row.view_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatPageFull(row) {
  return {
    ...formatPage(row),
    content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
  };
}
