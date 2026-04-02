// netlify/functions/auth-login.js
// POST /api/auth/login

const bcrypt = require('bcryptjs');
const { query, initDb, json, corsHeaders } = require('./_db');
const { signToken } = require('./_auth');

exports.handler = async (event) => {
  const origin = event.headers?.origin;
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': origin || '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' }, origin);

  try {
    await initDb();
    const { email, password } = JSON.parse(event.body || '{}');

    if (!email || !password) return json(400, { error: 'Email and password are required' }, origin);

    const result = await query('SELECT id, name, email, password_hash FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];

    if (!user) return json(401, { error: 'Invalid email or password' }, origin);

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return json(401, { error: 'Invalid email or password' }, origin);

    const token = signToken({ userId: user.id, email: user.email });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        // httpOnly cookie — preferred per spec; client also receives token in body for localStorage fallback
        'Set-Cookie': `vk_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`,
        ...corsHeaders(origin),
      },
      body: JSON.stringify({ token, user: { id: user.id, name: user.name, email: user.email } }),
    };
  } catch (err) {
    console.error('Login error:', err);
    return json(500, { error: 'Internal server error' }, origin);
  }
};