// ============================================================
// Substitutos para dependências externas usando apenas Node built-ins
// ============================================================
const crypto = require('crypto');

// --- UUID ---
function uuidv4() {
  return crypto.randomUUID();
}

// --- Hash de senha (PBKDF2) ---
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const incoming = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(incoming, 'hex'));
}

// --- JWT minimal (HS256) ---
function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

const JWT_SECRET = () => process.env.JWT_SECRET || 'hobbyspace_secret';

function signJWT(payload, expiresInSeconds = 7 * 86400) {
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body   = base64url(Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSeconds, iat: Math.floor(Date.now() / 1000) })));
  const sig    = base64url(crypto.createHmac('sha256', JWT_SECRET()).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

function verifyJWT(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Token inválido');
  const [header, body, sig] = parts;
  const expected = base64url(crypto.createHmac('sha256', JWT_SECRET()).update(`${header}.${body}`).digest());
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new Error('Assinatura inválida');
  const payload = JSON.parse(Buffer.from(body, 'base64').toString());
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expirado');
  return payload;
}

module.exports = { uuidv4, hashPassword, verifyPassword, signJWT, verifyJWT };
