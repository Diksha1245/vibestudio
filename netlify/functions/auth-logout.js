// netlify/functions/auth-logout.js
// POST /api/auth/logout

const { json, corsHeaders } = require('./_db');

exports.handler = async (event) => {
  const origin = event.headers?.origin;
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': origin || '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  // JWT is stateless; client clears the token. We clear the cookie if set.
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'vk_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
      ...corsHeaders(origin)
    },
    body: JSON.stringify({ success: true })
  };
};
