// netlify/functions/pages.js
// GET /api/pages — list user's pages
// POST /api/pages — create page

const { query, initDb, json } = require('./_db');
const { getUser } = require('./_auth');

exports.handler = async (event) => {
  const origin = event.headers?.origin;
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': origin || '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }, body: '' };

  const userPayload = getUser(event);
  if (!userPayload) return json(401, { error: 'Unauthorized' }, origin);

  await initDb();

  // GET — list pages
  if (event.httpMethod === 'GET') {
    try {
      const result = await query(
        'SELECT id, title, slug, theme, status, view_count, created_at, updated_at FROM pages WHERE user_id = $1 ORDER BY updated_at DESC',
        [userPayload.userId]
      );
      return json(200, { pages: result.rows.map(formatPage) }, origin);
    } catch (err) {
      console.error('List pages error:', err);
      return json(500, { error: 'Failed to list pages' }, origin);
    }
  }

  // POST — create page
  if (event.httpMethod === 'POST') {
    try {
      const { title, slug, theme, status, content } = JSON.parse(event.body || '{}');
      if (!title?.trim()) return json(400, { error: 'Title is required' }, origin);
      if (!slug?.trim()) return json(400, { error: 'Slug is required' }, origin);

      const cleanSlug = toSlug(slug);

      // Check slug collision — auto-suffix if taken
      const finalSlug = await uniqueSlug(cleanSlug);

      const result = await query(
        `INSERT INTO pages (user_id, title, slug, theme, status, content)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, title, slug, theme, status, view_count, created_at, updated_at`,
        [userPayload.userId, title.trim(), finalSlug, theme || 'minimal', status || 'draft', JSON.stringify(content || {})]
      );

      return json(201, { page: formatPage(result.rows[0]) }, origin);
    } catch (err) {
      if (err.code === '23505') return json(409, { error: 'A page with this slug already exists' }, origin);
      console.error('Create page error:', err);
      return json(500, { error: 'Failed to create page' }, origin);
    }
  }

  return json(405, { error: 'Method not allowed' }, origin);
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
