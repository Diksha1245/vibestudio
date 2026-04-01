// netlify/functions/_db.js
// Shared PostgreSQL pool + schema init for VibeKit Studio (Supabase)

const { Pool } = require('pg');

let pool;
let dbInitialized = false;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Supabase requires SSL in all environments — rejectUnauthorized:false
      // because Supabase uses a self-signed cert on the pooler
      ssl: { rejectUnauthorized: false },
      max: 3,                      // Netlify Functions are short-lived; keep pool small
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 10000,
    });
    pool.on('error', (err) => {
      console.error('[DB] Unexpected pool error:', err.message);
      pool = null;          // force re-init on next call
      dbInitialized = false;
    });
  }
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

// Run each CREATE TABLE separately — pg driver does NOT support
// multiple statements in a single query() call.
async function initDb() {
  if (dbInitialized) return;   // skip after first successful init in this lambda instance

  // ── users ──────────────────────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      name          TEXT,
      email         TEXT        UNIQUE NOT NULL,
      password_hash TEXT        NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // ── pages ──────────────────────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS pages (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title       TEXT        NOT NULL DEFAULT 'Untitled',
      slug        TEXT        NOT NULL UNIQUE,
      theme       TEXT        NOT NULL DEFAULT 'minimal',
      status      TEXT        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','published')),
      content     JSONB       NOT NULL DEFAULT '{}',
      view_count  INTEGER     NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // ── indexes (IF NOT EXISTS means safe to re-run) ───────────────────────────
  await query(`CREATE INDEX IF NOT EXISTS pages_user_id_idx ON pages(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS pages_slug_idx    ON pages(slug)`);
  await query(`CREATE INDEX IF NOT EXISTS pages_status_idx  ON pages(status)`);

  // ── contact_submissions ────────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS contact_submissions (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      page_id    UUID        NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      name       TEXT        NOT NULL,
      email      TEXT        NOT NULL,
      message    TEXT        NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  dbInitialized = true;
  console.log('[DB] Schema ready');
}

// ── CORS helpers ──────────────────────────────────────────────────────────────
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin':      origin || '*',
    'Access-Control-Allow-Headers':     'Content-Type, Authorization',
    'Access-Control-Allow-Methods':     'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };
}

function json(statusCode, body, origin) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    body: JSON.stringify(body),
  };
}

module.exports = { query, initDb, corsHeaders, json };