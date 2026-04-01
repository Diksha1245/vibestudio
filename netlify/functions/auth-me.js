// netlify/functions/auth-me.js
// GET /api/auth/me

const { query, initDb, json } = require('./_db');
const { getUser } = require('./_auth');

exports.handler = async (event) => {
  const origin = event.headers?.origin;
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': origin || '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };

  const userPayload = getUser(event);
  if (!userPayload) return json(401, { error: 'Unauthorized' }, origin);

  try {
    await initDb();
    const result = await query('SELECT id, name, email, created_at FROM users WHERE id = $1', [userPayload.userId]);
    if (!result.rows[0]) return json(404, { error: 'User not found' }, origin);
    return json(200, { user: result.rows[0] }, origin);
  } catch (err) {
    return json(500, { error: 'Internal server error' }, origin);
  }
};
