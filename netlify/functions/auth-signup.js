// netlify/functions/auth-signup.js
// POST /api/auth/signup

const bcrypt = require('bcryptjs');
const { query, initDb, json } = require('./_db');
const { signToken } = require('./_auth');

exports.handler = async (event) => {
  console.log("[auth-signup] FUNCTION INVOKED");
  console.log("[auth-signup] METHOD:", event.httpMethod);
  console.log("[auth-signup] PATH:", event.path);

  const origin = event.headers?.origin;

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin':  origin || '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' }, origin);

  try {
    await initDb();

    const body = JSON.parse(event.body || '{}');
    const { name, email, password } = body;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!email || !password)
      return json(400, { error: 'Email and password are required' }, origin);
    if (password.length < 8)
      return json(400, { error: 'Password must be at least 8 characters' }, origin);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return json(400, { error: 'Invalid email address' }, origin);

    // ── Duplicate check ─────────────────────────────────────────────────────
    const existing = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (existing.rows.length > 0)
      return json(409, { error: 'An account with this email already exists' }, origin);

    // ── Create user ─────────────────────────────────────────────────────────
    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name?.trim() || null, email.toLowerCase(), hash]
    );

    const user  = result.rows[0];
    const token = signToken({ userId: user.id, email: user.email });

    return json(201, {
      token,
      user: { id: user.id, name: user.name, email: user.email },
    }, origin);

  } catch (err) {
    // Log the FULL error so it shows in Netlify function logs
    console.error('[auth-signup] ERROR:', err.message);
    console.error('[auth-signup] STACK:', err.stack);

    // Surface DB connection errors clearly
    if (err.message?.includes('DATABASE_URL')) {
      return json(500, { error: 'Database not configured. Check DATABASE_URL env var.' }, origin);
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      return json(500, { error: 'Cannot connect to database. Check DATABASE_URL.' }, origin);
    }

    return json(500, { error: 'Internal server error' }, origin);
  }
};