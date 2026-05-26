// ============================================================
// BANCO DE DADOS — HobbySpace
// Primário: Supabase REST API (sem npm, usando fetch nativo)
// Fallback: JSON local em /data/db.json
// ============================================================
const fs      = require('fs');
const path    = require('path');
const { uuidv4 } = require('../lib');
const cloudinary  = require('./cloudinary');

const DATA_DIR   = path.join(__dirname, '..', '..', 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const DB_FILE    = path.join(DATA_DIR, 'db.json');

fs.mkdirSync(DATA_DIR,   { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });

const SYSTEM_USER_ID = 'system-seed-user';

// ── SUPABASE REST API ──────────────────────────────────────────────────────
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const USE_SUPABASE_DB = !!(SB_URL && SB_KEY);

// Tabela de mapeamento: chave do db → nome da tabela no Supabase
// IMPORTANTE: essas tabelas precisam existir no Supabase (ver SQL abaixo)
const TABLE_MAP = {
  users:                'hs_users',
  communities:          'hs_communities',
  hobbies:              'hs_hobbies',
  posts:                'hs_posts',
  comments:             'hs_comments',
  userHobbies:          'hs_user_hobbies',
  communityMembers:     'hs_community_members',
  postLikes:            'hs_post_likes',
  postSaves:            'hs_post_saves',
  notifications:        'hs_notifications',
  refreshTokens:        'hs_refresh_tokens',
  xpEvents:             'hs_xp_events',
  userCommunityProgress:'hs_user_community_progress',
  mlUserVectors:        'hs_ml_user_vectors',
  mlHobbyVectors:       'hs_ml_hobby_vectors',
};

async function sbFetch(table, options = {}) {
  const { method = 'GET', body, select = '*', filters = [] } = options;
  let url = `${SB_URL}/rest/v1/${table}`;
  if (select !== '*') url += `?select=${select}`;
  else url += '?select=*';
  filters.forEach(f => { url += `&${f}`; });

  const res = await fetch(url, {
    method,
    headers: {
      apikey:          SB_KEY,
      Authorization:   `Bearer ${SB_KEY}`,
      'Content-Type':  'application/json',
      Prefer:          method === 'POST' ? 'return=representation' : 'return=minimal',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Supabase REST ${method} ${table}: ${res.status} ${err}`);
  }
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

async function sbUpsert(table, record) {
  const url = `${SB_URL}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey:         SB_KEY,
      Authorization:  `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer:         'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Supabase upsert ${table}: ${res.status} ${err}`);
  }
  return res.json().catch(() => null);
}

async function sbDelete(table, filter) {
  const url = `${SB_URL}/rest/v1/${table}?${filter}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      apikey:         SB_KEY,
      Authorization:  `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok && res.status !== 404) {
    const err = await res.text().catch(() => '');
    console.error(`Supabase delete ${table}: ${res.status} ${err}`);
  }
}

// ── SEED DATA ─────────────────────────────────────────────────────────────
function buildSeed() {
  const hobbies = [
    { id: uuidv4(), name: 'Fotografia',  communitySlug: 'fotografia',  membersCount: 3100, icon: 'camera',          description: 'Capture momentos únicos e compartilhe seu olhar sobre o mundo.',          banner: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1200&auto=format&fit=crop', coverImageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&auto=format&fit=crop', postsCount: 0 },
    { id: uuidv4(), name: 'Música',       communitySlug: 'musica',      membersCount: 4200, icon: 'musical-notes',   description: 'Para quem vive de notas, acordes e batidas do coração.',                   banner: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&auto=format&fit=crop', coverImageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&auto=format&fit=crop', postsCount: 0 },
    { id: uuidv4(), name: 'Culinária',    communitySlug: 'culinaria',   membersCount: 5800, icon: 'restaurant',      description: 'Receitas, técnicas e paixão pela gastronomia do dia a dia.',               banner: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&auto=format&fit=crop', coverImageUrl: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&auto=format&fit=crop', postsCount: 0 },
    { id: uuidv4(), name: 'Leitura',      communitySlug: 'leitura',     membersCount: 6200, icon: 'book',            description: 'Um livro aberto é um mundo a ser explorado.',                             banner: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=1200&auto=format&fit=crop', coverImageUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&auto=format&fit=crop', postsCount: 0 },
    { id: uuidv4(), name: 'Desenho',      communitySlug: 'desenho',     membersCount: 2900, icon: 'brush',           description: 'Lápis, carvão, digital — a arte de expressar o que as palavras não alcançam.', banner: 'https://images.unsplash.com/photo-1561154464-82e9adf32764?w=1200&auto=format&fit=crop', coverImageUrl: 'https://images.unsplash.com/photo-1561154464-82e9adf32764?w=800&auto=format&fit=crop', postsCount: 0 },
    { id: uuidv4(), name: 'Jardinagem',   communitySlug: 'jardinagem',  membersCount: 1800, icon: 'leaf',            description: 'Plante, cuide e colha os frutos da natureza ao seu redor.',                banner: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=1200&auto=format&fit=crop', coverImageUrl: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800&auto=format&fit=crop', postsCount: 0 },
    { id: uuidv4(), name: 'Yoga',         communitySlug: 'yoga',        membersCount: 3400, icon: 'body',            description: 'Equilíbrio entre mente, corpo e espírito para uma vida plena.',              banner: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&auto=format&fit=crop', coverImageUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&auto=format&fit=crop', postsCount: 0 },
    { id: uuidv4(), name: 'Xadrez',       communitySlug: 'xadrez',      membersCount: 1500, icon: 'grid',            description: 'Estratégia, paciência e inteligência no tabuleiro de 64 casas.',           banner: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=1200&auto=format&fit=crop', coverImageUrl: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=800&auto=format&fit=crop', postsCount: 0 },
    { id: uuidv4(), name: 'Crochê',       communitySlug: 'croche',      membersCount: 3200, icon: 'color-wand',      description: 'Linhas que viram arte nas mãos de quem tem paciência e criatividade.',    banner: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=1200&auto=format&fit=crop', coverImageUrl: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=800&auto=format&fit=crop', postsCount: 0 },
    { id: uuidv4(), name: 'Caligrafia',   communitySlug: 'caligrafia',  membersCount:  980, icon: 'pencil',          description: 'A beleza da escrita à mão elevada à forma de arte.',                      banner: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1200&auto=format&fit=crop', coverImageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&auto=format&fit=crop', postsCount: 0 },
    { id: uuidv4(), name: 'Pintura',      communitySlug: 'pintura',     membersCount: 2100, icon: 'color-palette',   description: 'Telas, aquarelas e acrílicos — seu ateliê virtual.',                      banner: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1200&auto=format&fit=crop', coverImageUrl: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&auto=format&fit=crop', postsCount: 0 },
    { id: uuidv4(), name: 'Corrida',      communitySlug: 'corrida',     membersCount: 4700, icon: 'fitness',         description: 'Da caminhada à maratona — cada passo conta.',                             banner: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1200&auto=format&fit=crop', coverImageUrl: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&auto=format&fit=crop', postsCount: 0 },
  ];

  const communities = hobbies.map(h => ({
    slug: h.communitySlug, title: h.name, membersCount: h.membersCount,
    coverImageUrl: h.coverImageUrl, banner: h.banner, icon: h.icon,
    description: h.description, postsCount: 0,
  }));

  const systemUser = {
    id: SYSTEM_USER_ID, name: 'HobbySpace', email: 'system@hobbyspace.app',
    passwordHash: '', avatarUrl: null, bio: 'Conta oficial.', createdAt: new Date(0).toISOString(),
  };

  const p = Array.from({ length: 7 }, () => uuidv4());
  const sl = name => hobbies.find(h => h.name === name)?.communitySlug || name;

  const posts = [
    { id: p[0], userId: SYSTEM_USER_ID, communitySlug: sl('Música'),     imageUrl: null, likesCount: 12, commentsCount: 2, savesCount: 2,  sharesCount: 1, createdAt: new Date(Date.now()-3600000).toISOString(),  text: 'Acabei de aprender a tocar minha primeira música no violão! 🎸 Qual foi a primeira de vocês?' },
    { id: p[1], userId: SYSTEM_USER_ID, communitySlug: sl('Fotografia'), imageUrl: null, likesCount: 28, commentsCount: 1, savesCount: 5,  sharesCount: 3, createdAt: new Date(Date.now()-7200000).toISOString(),  text: 'Ensaio fotográfico no parque 📸 — luz natural é tudo!' },
    { id: p[2], userId: SYSTEM_USER_ID, communitySlug: sl('Culinária'),  imageUrl: null, likesCount: 45, commentsCount: 2, savesCount: 9,  sharesCount: 6, createdAt: new Date(Date.now()-10800000).toISOString(), text: 'Fiz um bolo de chocolate do zero! 🍫' },
    { id: p[3], userId: SYSTEM_USER_ID, communitySlug: sl('Leitura'),    imageUrl: null, likesCount: 33, commentsCount: 2, savesCount: 14, sharesCount: 4, createdAt: new Date(Date.now()-14400000).toISOString(), text: '"O Senhor dos Anéis" — uma aventura incrível! 📚 Qual livro marcou você?' },
    { id: p[4], userId: SYSTEM_USER_ID, communitySlug: sl('Yoga'),       imageUrl: null, likesCount: 61, commentsCount: 2, savesCount: 18, sharesCount: 8, createdAt: new Date(Date.now()-21600000).toISOString(), text: 'Completei 30 dias seguidos de yoga! 🧘' },
    { id: p[5], userId: SYSTEM_USER_ID, communitySlug: sl('Jardinagem'), imageUrl: null, likesCount: 19, commentsCount: 1, savesCount: 3,  sharesCount: 2, createdAt: new Date(Date.now()-28800000).toISOString(), text: 'Plantei meu primeiro tomateiro! 🌱' },
    { id: p[6], userId: SYSTEM_USER_ID, communitySlug: sl('Crochê'),     imageUrl: null, likesCount: 37, commentsCount: 3, savesCount: 11, sharesCount: 5, createdAt: new Date(Date.now()-36000000).toISOString(), text: 'Terminei minha primeira manta de crochê! 🧶' },
  ];

  const comments = [
    { id: uuidv4(), postId: p[0], userId: SYSTEM_USER_ID, text: 'Parabéns! Qual música foi? 😊', likesCount: 3, createdAt: new Date(Date.now()-1800000).toISOString() },
    { id: uuidv4(), postId: p[1], userId: SYSTEM_USER_ID, text: 'Que ângulo lindo! Qual câmera?', likesCount: 5, createdAt: new Date(Date.now()-5000000).toISOString() },
    { id: uuidv4(), postId: p[2], userId: SYSTEM_USER_ID, text: 'Manda a receita! 😍', likesCount: 7, createdAt: new Date(Date.now()-9000000).toISOString() },
    { id: uuidv4(), postId: p[4], userId: SYSTEM_USER_ID, text: 'Inspirador! Vou começar! 🙏', likesCount: 8, createdAt: new Date(Date.now()-20000000).toISOString() },
    { id: uuidv4(), postId: p[6], userId: SYSTEM_USER_ID, text: 'Que lindo! Compartilha o padrão?', likesCount: 6, createdAt: new Date(Date.now()-34000000).toISOString() },
  ];

  posts.forEach(post => {
    const comm = communities.find(c => c.slug === post.communitySlug);
    if (comm) comm.postsCount = (comm.postsCount || 0) + 1;
    const hob = hobbies.find(h => h.communitySlug === post.communitySlug);
    if (hob) hob.postsCount = (hob.postsCount || 0) + 1;
  });

  return {
    hobbies, communities, users: [systemUser], posts, comments,
    userHobbies: [], communityMembers: [], postLikes: [], postSaves: [],
    notifications: [], refreshTokens: [], xpEvents: [],
    userCommunityProgress: [], mlUserVectors: [], mlHobbyVectors: [],
  };
}

// ── LOCAL JSON FALLBACK ────────────────────────────────────────────────────
let _db = null;

function normalizeDbShape(data) {
  const defaults = {
    userHobbies: [], communityMembers: [], postLikes: [], postSaves: [],
    notifications: [], refreshTokens: [], xpEvents: [],
    userCommunityProgress: [], mlUserVectors: [], mlHobbyVectors: [],
    comments: [], posts: [], users: [], hobbies: [], communities: [],
  };
  Object.keys(defaults).forEach(k => { if (!data[k]) data[k] = defaults[k]; });

  // Migração de imagens
  const IMGS = { fotografia:'1516035069371-29a1b244cc32', musica:'1493225457124-a3eb161ffa5f', culinaria:'1556909114-f6e7ad7d3136', leitura:'1512820790803-83ca734da794', desenho:'1561154464-82e9adf32764', jardinagem:'1466692476868-aef1dfb1e735', yoga:'1506126613408-eca07ce68773', xadrez:'1529699211952-734e80c4d42b', croche:'1584992236310-6edddc08acff', caligrafia:'1455390582262-044cdead277a', pintura:'1513364776144-60967b0f800f', corrida:'1530549387789-4c1017266635' };
  data.communities = data.communities.map(c => ({
    banner: null, icon: 'star', description: '', postsCount: 0, ...c,
    coverImageUrl: `https://images.unsplash.com/photo-${IMGS[c.slug] || '1516035069371-29a1b244cc32'}?w=800&auto=format&fit=crop`,
    banner: `https://images.unsplash.com/photo-${IMGS[c.slug] || '1516035069371-29a1b244cc32'}?w=1200&auto=format&fit=crop`,
  }));
  data.hobbies = data.hobbies.map(h => ({
    banner: null, icon: 'star', description: '', postsCount: 0, ...h,
    coverImageUrl: `https://images.unsplash.com/photo-${IMGS[h.communitySlug] || '1516035069371-29a1b244cc32'}?w=800&auto=format&fit=crop`,
  }));
  data.posts = data.posts.map(p => ({ sharesCount: 0, ...p }));
  return data;
}

function persistLocalSync() {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(_db, null, 2), 'utf8'); } catch (_) {}
}

function loadLocal() {
  if (_db) return _db;
  try {
    if (fs.existsSync(DB_FILE)) {
      _db = normalizeDbShape(JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
      console.log(`[DB] Local carregado: ${_db.users.length} usuários`);
    } else {
      _db = buildSeed();
      persistLocalSync();
      console.log('[DB] Seed local criado');
    }
  } catch (err) {
    console.error('[DB] Erro, recriando:', err.message);
    _db = buildSeed();
    persistLocalSync();
  }
  return _db;
}

let _saveTimer = null;
function save() {
  if (_saveTimer) return;
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    persistLocalSync();
  }, 500);
}

async function init() {
  loadLocal();
  console.log(`[DB] Storage: ${USE_SUPABASE_DB ? 'Supabase REST' : 'JSON local'}`);
  console.log(`[DB] Storage imagens: ${cloudinary.isEnabled ? 'Cloudinary' : 'local'}`);
}

// ── IMAGE STORAGE ──────────────────────────────────────────────────────────
function parseImageBase64(base64Data) {
  const match = base64Data.match(/^data:([a-z]+\/[a-z+]+);base64,(.+)$/i);
  if (match) {
    const contentType = match[1].toLowerCase();
    if (!contentType.startsWith('image/')) throw new Error('Precisa ser uma imagem.');
    const ext = contentType.split('/')[1].replace('jpeg','jpg').split('+')[0];
    return { buffer: Buffer.from(match[2], 'base64'), contentType, ext };
  }
  return { buffer: Buffer.from(base64Data, 'base64'), contentType: 'image/jpeg', ext: 'jpg' };
}

async function saveImage(base64Data, folder = 'posts') {
  // 1. Cloudinary
  if (cloudinary.isEnabled) {
    return await cloudinary.uploadImage(base64Data, folder);
  }
  // 2. Local (fallback — configure Cloudinary no .env para evitar)
  const { buffer, ext } = parseImageBase64(base64Data);
  const fileName = `${uuidv4()}.${ext}`;
  fs.writeFileSync(path.join(IMAGES_DIR, fileName), buffer);
  // Retorna URL absoluta com a porta do backend para funcionar em web/mobile
  const backendPort = process.env.PORT || 3000;
  const backendHost = process.env.BACKEND_PUBLIC_URL || `http://localhost:${backendPort}`;
  return `${backendHost}/images/${fileName}`;
}

async function deleteImage(urlPath) {
  if (!urlPath) return;
  try {
    if (urlPath.includes('cloudinary.com')) {
      await cloudinary.deleteImage(urlPath);
    } else {
      const filePath = path.join(IMAGES_DIR, path.basename(urlPath));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  } catch (_) {}
}

// ── PROXY ──────────────────────────────────────────────────────────────────
const db = new Proxy({}, {
  get(_, key) {
    if (key === 'init')              return init;
    if (key === 'save')              return save;
    if (key === 'saveImage')         return saveImage;
    if (key === 'deleteImage')       return deleteImage;
    if (key === 'SYSTEM_USER_ID')    return SYSTEM_USER_ID;
    if (key === 'IMAGES_DIR')        return IMAGES_DIR;
    if (key === 'isStorageEnabled')  return cloudinary.isEnabled;
    return loadLocal()[key];
  },
  set(_, key, value) { loadLocal()[key] = value; save(); return true; },
});

module.exports = db;

function flushSync() {
  if (_db) try { fs.writeFileSync(DB_FILE, JSON.stringify(_db, null, 2), 'utf8'); } catch(_) {}
}
process.on('SIGINT',  () => { flushSync(); process.exit(0); });
process.on('SIGTERM', () => { flushSync(); process.exit(0); });
process.on('exit',    () => { flushSync(); });