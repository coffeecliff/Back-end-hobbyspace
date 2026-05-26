// ============================================================
// HobbySpace Backend — Node.js built-ins only (Node 18+)
// ============================================================
const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

// .env manual loader
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return;
      const eq = t.indexOf('=');
      if (eq < 0) return;
      const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    });
  }
} catch (_) {}

const authC   = require('./controllers/authController');
const commC   = require('./controllers/communityController');
const postC   = require('./controllers/postController');
const hobbyC  = require('./controllers/hobbyController');
const notifC  = require('./controllers/notificationController');
const chatC   = require('./controllers/chatController');
const xpC     = require('./controllers/xpController');
const auth    = require('./middlewares/auth');
const db      = require('./config/db');

// ============================================================
// MINI FRAMEWORK HTTP
// ============================================================
const ROUTES = [];
function route(method, p, ...handlers) { ROUTES.push({ method: method.toUpperCase(), path: p, handlers }); }

function matchPath(pattern, reqPath) {
  if (pattern === '*') return {};
  const pp = pattern.split('/'), rp = reqPath.split('/');
  if (pp.length !== rp.length) return null;
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(rp[i]);
    else if (pp[i] !== rp[i]) return null;
  }
  return params;
}

async function readBody(req) {
  return new Promise(resolve => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch (_) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png',  '.gif': 'image/gif', '.webp': 'image/webp',
};

// ============================================================
// ROTAS — AUTH
// ============================================================
route('POST',  '/api/auth/register', authC.register);
route('POST',  '/api/auth/login',    authC.login);
route('POST',  '/api/auth/logout',   auth, authC.logout);
route('GET',   '/api/auth/me',       auth, authC.me);
route('PATCH', '/api/auth/me',       auth, authC.updateMe);

// HOBBIES
route('GET',    '/api/hobbies/me',          auth, hobbyC.getMyHobbies);
route('GET',    '/api/hobbies/discover',    auth, hobbyC.discover);
route('GET',    '/api/hobbies/recommended', auth, hobbyC.getRecommended);
route('GET',    '/api/hobbies/trending',    auth, hobbyC.getTrending);
route('GET',    '/api/hobbies/:id',         auth, hobbyC.getById);
route('POST',   '/api/hobbies/:id/join',    auth, hobbyC.join);
route('DELETE', '/api/hobbies/:id/leave',   auth, hobbyC.leave);
route('PATCH',  '/api/hobbies/:id/progress',auth, hobbyC.updateProgress);

// COMMUNITIES
route('GET',    '/api/communities',              auth, commC.listCommunities);
route('GET',    '/api/communities/:slug',        auth, commC.getCommunityBySlug);
route('POST',   '/api/communities/:slug/join',   auth, commC.joinCommunity);
route('DELETE', '/api/communities/:slug/leave',  auth, commC.leaveCommunity);
route('GET',    '/api/communities/:slug/members',auth, commC.getCommunityMembers);
route('GET',    '/api/communities/:slug/posts',  auth, postC.getPostsByCommunity);

// POSTS
route('GET',    '/api/posts/:id',          auth, postC.getPost);
route('POST',   '/api/posts',              auth, postC.createPost);
route('DELETE', '/api/posts/:id',          auth, postC.deletePost);
route('POST',   '/api/posts/:id/like',     auth, postC.likePost);
route('DELETE', '/api/posts/:id/like',     auth, postC.unlikePost);
route('POST',   '/api/posts/:id/save',     auth, postC.savePost);
route('DELETE', '/api/posts/:id/save',     auth, postC.unsavePost);
route('POST',   '/api/posts/:id/share',    auth, postC.sharePost);
route('GET',    '/api/posts/:id/comments', auth, postC.getComments);
route('POST',   '/api/posts/:id/comments', auth, postC.addComment);

// XP / PROGRESS
route('GET', '/api/progress/me',     auth, xpC.getMyProgress);
route('GET', '/api/progress/:slug',  auth, xpC.getProgressByCommunity);
route('GET', '/api/xp/events',       auth, xpC.getXpEvents);

// NOTIFICATIONS
route('GET',   '/api/notifications',              auth, notifC.getNotifications);
route('GET',   '/api/notifications/unread-count', auth, notifC.getUnreadCount);
route('PATCH', '/api/notifications/read-all',     auth, notifC.markAllAsRead);
route('PATCH', '/api/notifications/:id/read',     auth, notifC.markAsRead);

// ML / AI
route('GET',  '/api/ml/stats', auth, postC.getMlStats);
route('POST', '/api/chat',     auth, chatC.chat);

// HEALTH
route('GET', '/api/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ============================================================
// HTTP SERVER
// ============================================================
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const parsed = url.parse(req.url, true);
  req.path  = parsed.pathname.replace(/\/$/, '') || '/';
  req.query = parsed.query;

  // Servir imagens locais
  if (req.method === 'GET' && req.path.startsWith('/images/')) {
    const fileName = path.basename(req.path);
    const filePath = path.join(db.IMAGES_DIR, fileName);
    if (!fs.existsSync(filePath)) { res.writeHead(404); return res.end('Not found'); }
    const ext  = path.extname(fileName).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public,max-age=86400' });
    return fs.createReadStream(filePath).pipe(res);
  }

  req.body = await readBody(req);

  res.status = code => { res._code = code; return res; };
  res.json   = data => { res.writeHead(res._code || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  res.send   = data => { res.writeHead(res._code || 200); res.end(data ?? ''); };

  for (const r of ROUTES) {
    if (r.method !== req.method) continue;
    const params = matchPath(r.path, req.path);
    if (params === null) continue;
    req.params = params;
    let idx = 0;
    const next = async err => {
      if (err) {
        console.error('[middleware]', err);
        if (!res.headersSent) res.status(500).json({ message: 'Erro interno.' });
        return;
      }
      if (idx >= r.handlers.length) return;
      const fn = r.handlers[idx++];
      try { await fn(req, res, next); } catch (e) { next(e); }
    };
    await next();
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: `${req.method} ${req.path} não encontrado.` }));
});

const PORT = process.env.PORT || 3000;
db.init().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🚀 HobbySpace Backend → http://localhost:${PORT}`);
    console.log('   GET  /api/health');
    console.log('   GET  /api/communities          ← listar comunidades');
    console.log('   POST /api/communities/:slug/join  ← entrar');
    console.log('   GET  /api/progress/me          ← XP + badges');
    console.log('   POST /api/posts/:id/share      ← compartilhar + XP');
    console.log('   GET  /api/xp/events            ← histórico XP\n');
  });
}).catch(err => { console.error('[startup]', err); process.exit(1); });
