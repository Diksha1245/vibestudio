// netlify/functions/_auth.js
// JWT helpers for auth

const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

// Extract token from Authorization header or cookie
function extractToken(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  const cookie = event.headers?.cookie || '';
  const match = cookie.match(/vk_token=([^;]+)/);
  if (match) return match[1];
  return null;
}

// Middleware: returns user payload or null
function getUser(event) {
  const token = extractToken(event);
  if (!token) return null;
  return verifyToken(token);
}

module.exports = { signToken, verifyToken, extractToken, getUser };
