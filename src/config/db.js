// ============================================================
// BANCO DE DADOS JSON PERSISTENTE — HobbySpace v2
// Storage: JSON local + Firebase (opcional) + Supabase (opcional)
// ============================================================
const fs      = require('fs');
const path    = require('path');
const { uuidv4 } = require('../lib');
const firebase = require('./firebase');
const supabase = require('./supabase');

const DATA_DIR   = path.join(__dirname, '..', '..', 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const DB_FILE    = path.join(DATA_DIR, 'db.json');
const FIRESTORE_COLLECTION = process.env.FIRESTORE_COLLECTION || 'hobbyspace';
const FIRESTORE_DOC_ID     = process.env.FIRESTORE_DOC_ID || 'app-data';

fs.mkdirSync(DATA_DIR,   { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });

const SYSTEM_USER_ID = 'system-seed-user';

// ============================================================
// SEED DATA
// ============================================================
function buildSeed() {
  const hobbies = [
    {
      id: uuidv4(), name: 'Fotografia', communitySlug: 'fotografia', membersCount: 3100,
      icon: 'camera', description: 'Capture momentos únicos e compartilhe seu olhar sobre o mundo.',
      banner: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1200&auto=format&fit=crop',
      coverImageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&auto=format&fit=crop',
      postsCount: 0,
    },
    {
      id: uuidv4(), name: 'Música', communitySlug: 'musica', membersCount: 4200,
      icon: 'musical-notes', description: 'Para quem vive de notas, acordes e batidas do coração.',
      banner: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&auto=format&fit=crop',
      coverImageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&auto=format&fit=crop',
      postsCount: 0,
    },
    {
      id: uuidv4(), name: 'Culinária', communitySlug: 'culinaria', membersCount: 5800,
      icon: 'restaurant', description: 'Receitas, técnicas e paixão pela gastronomia do dia a dia.',
      banner: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&auto=format&fit=crop',
      coverImageUrl: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&auto=format&fit=crop',
      postsCount: 0,
    },
    {
      id: uuidv4(), name: 'Leitura', communitySlug: 'leitura', membersCount: 6200,
      icon: 'book', description: 'Um livro aberto é um mundo a ser explorado.',
      banner: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=1200&auto=format&fit=crop',
      coverImageUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&auto=format&fit=crop',
      postsCount: 0,
    },
    {
      id: uuidv4(), name: 'Desenho', communitySlug: 'desenho', membersCount: 2900,
      icon: 'brush', description: 'Lápis, carvão, digital — a arte de expressar o que as palavras não alcançam.',
      banner: 'https://images.unsplash.com/photo-1561154464-82e9adf32764?w=1200&auto=format&fit=crop',
      coverImageUrl: 'https://images.unsplash.com/photo-1561154464-82e9adf32764?w=800&auto=format&fit=crop',
      postsCount: 0,
    },
    {
      id: uuidv4(), name: 'Jardinagem', communitySlug: 'jardinagem', membersCount: 1800,
      icon: 'leaf', description: 'Plante, cuide e colha os frutos da natureza ao seu redor.',
      banner: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=1200&auto=format&fit=crop',
      coverImageUrl: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800&auto=format&fit=crop',
      postsCount: 0,
    },
    {
      id: uuidv4(), name: 'Yoga', communitySlug: 'yoga', membersCount: 3400,
      icon: 'body', description: 'Equilíbrio entre mente, corpo e espírito para uma vida plena.',
      banner: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&auto=format&fit=crop',
      coverImageUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&auto=format&fit=crop',
      postsCount: 0,
    },
    {
      id: uuidv4(), name: 'Xadrez', communitySlug: 'xadrez', membersCount: 1500,
      icon: 'grid', description: 'Estratégia, paciência e inteligência no tabuleiro de 64 casas.',
      banner: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=1200&auto=format&fit=crop',
      coverImageUrl: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=800&auto=format&fit=crop',
      postsCount: 0,
    },
    {
      id: uuidv4(), name: 'Crochê', communitySlug: 'croche', membersCount: 3200,
      icon: 'color-wand', description: 'Linhas que viram arte nas mãos de quem tem paciência e criatividade.',
      banner: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=1200&auto=format&fit=crop',
      coverImageUrl: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=800&auto=format&fit=crop',
      postsCount: 0,
    },
    {
      id: uuidv4(), name: 'Caligrafia', communitySlug: 'caligrafia', membersCount: 980,
      icon: 'pencil', description: 'A beleza da escrita à mão elevada à forma de arte.',
      banner: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1200&auto=format&fit=crop',
      coverImageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&auto=format&fit=crop',
      postsCount: 0,
    },
    {
      id: uuidv4(), name: 'Pintura', communitySlug: 'pintura', membersCount: 2100,
      icon: 'color-palette', description: 'Telas, aquarelas e acrílicos — seu ateliê virtual.',
      banner: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1200&auto=format&fit=crop',
      coverImageUrl: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&auto=format&fit=crop',
      postsCount: 0,
    },
    {
      id: uuidv4(), name: 'Corrida', communitySlug: 'corrida', membersCount: 4700,
      icon: 'fitness', description: 'Da caminhada à maratona — cada passo conta.',
      banner: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1200&auto=format&fit=crop',
      coverImageUrl: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&auto=format&fit=crop',
      postsCount: 0,
    },
  ];

  const communities = hobbies.map(h => ({
    slug: h.communitySlug, title: h.name,
    membersCount: h.membersCount, coverImageUrl: h.coverImageUrl,
    banner: h.banner, icon: h.icon, description: h.description, postsCount: 0,
  }));

  const users = [{
    id: SYSTEM_USER_ID, name: 'HobbySpace',
    email: 'system@hobbyspace.app', passwordHash: '',
    avatarUrl: null, bio: 'Conta oficial da plataforma.',
    createdAt: new Date(0).toISOString(),
  }];

  const slugOf = name => hobbies.find(h => h.name === name)?.communitySlug || name;
  const p = Array.from({ length: 7 }, () => uuidv4());

  const posts = [
    { id: p[0], userId: SYSTEM_USER_ID, communitySlug: slugOf('Música'),     imageUrl: null, likesCount: 12, commentsCount: 2, savesCount: 2,  sharesCount: 1, createdAt: new Date(Date.now()-3600000).toISOString(),  text: 'Acabei de aprender a tocar minha primeira música no violão! 🎸 Qual foi a primeira de vocês?' },
    { id: p[1], userId: SYSTEM_USER_ID, communitySlug: slugOf('Fotografia'), imageUrl: null, likesCount: 28, commentsCount: 1, savesCount: 5,  sharesCount: 3, createdAt: new Date(Date.now()-7200000).toISOString(),  text: 'Ensaio fotográfico no parque 📸 — luz natural é tudo!' },
    { id: p[2], userId: SYSTEM_USER_ID, communitySlug: slugOf('Culinária'),  imageUrl: null, likesCount: 45, commentsCount: 2, savesCount: 9,  sharesCount: 6, createdAt: new Date(Date.now()-10800000).toISOString(), text: 'Fiz um bolo de chocolate do zero. Ficou incrível! 🍫 Posso compartilhar a receita?' },
    { id: p[3], userId: SYSTEM_USER_ID, communitySlug: slugOf('Leitura'),    imageUrl: null, likesCount: 33, commentsCount: 2, savesCount: 14, sharesCount: 4, createdAt: new Date(Date.now()-14400000).toISOString(), text: '"O Senhor dos Anéis" — uma aventura incrível! 📚 Qual livro marcou você?' },
    { id: p[4], userId: SYSTEM_USER_ID, communitySlug: slugOf('Yoga'),       imageUrl: null, likesCount: 61, commentsCount: 2, savesCount: 18, sharesCount: 8, createdAt: new Date(Date.now()-21600000).toISOString(), text: 'Completei 30 dias seguidos de yoga! 🧘 Minha flexibilidade melhorou muito.' },
    { id: p[5], userId: SYSTEM_USER_ID, communitySlug: slugOf('Jardinagem'), imageUrl: null, likesCount: 19, commentsCount: 1, savesCount: 3,  sharesCount: 2, createdAt: new Date(Date.now()-28800000).toISOString(), text: 'Plantei meu primeiro tomateiro e já está florescendo! 🌱 Gratidão pela natureza.' },
    { id: p[6], userId: SYSTEM_USER_ID, communitySlug: slugOf('Crochê'),     imageUrl: null, likesCount: 37, commentsCount: 3, savesCount: 11, sharesCount: 5, createdAt: new Date(Date.now()-36000000).toISOString(), text: 'Terminei minha primeira manta de crochê! 🧶 Levou 3 semanas mas valeu cada ponto.' },
  ];

  // Atualiza postsCount nas comunidades
  posts.forEach(post => {
    const comm = communities.find(c => c.slug === post.communitySlug);
    if (comm) comm.postsCount += 1;
    const hob = hobbies.find(h => h.communitySlug === post.communitySlug);
    if (hob) hob.postsCount = (hob.postsCount || 0) + 1;
  });

  const comments = [
    { id: uuidv4(), postId: p[0], userId: SYSTEM_USER_ID, text: 'Parabéns! Qual música foi? 😊',              likesCount: 3, createdAt: new Date(Date.now()-1800000).toISOString() },
    { id: uuidv4(), postId: p[0], userId: SYSTEM_USER_ID, text: 'Continue assim! É muito gratificante!',       likesCount: 1, createdAt: new Date(Date.now()-900000).toISOString() },
    { id: uuidv4(), postId: p[1], userId: SYSTEM_USER_ID, text: 'Que ângulo lindo! Qual câmera você usa?',     likesCount: 5, createdAt: new Date(Date.now()-5000000).toISOString() },
    { id: uuidv4(), postId: p[2], userId: SYSTEM_USER_ID, text: 'Manda a receita! 😍',                         likesCount: 7, createdAt: new Date(Date.now()-9000000).toISOString() },
    { id: uuidv4(), postId: p[2], userId: SYSTEM_USER_ID, text: 'Bolo de chocolate é sempre boa pedida!',      likesCount: 3, createdAt: new Date(Date.now()-8000000).toISOString() },
    { id: uuidv4(), postId: p[3], userId: SYSTEM_USER_ID, text: 'Clássico indispensável! 🙌',                  likesCount: 4, createdAt: new Date(Date.now()-13000000).toISOString() },
    { id: uuidv4(), postId: p[3], userId: SYSTEM_USER_ID, text: 'Prefiro começar com "O Hobbit"!',             likesCount: 2, createdAt: new Date(Date.now()-12000000).toISOString() },
    { id: uuidv4(), postId: p[4], userId: SYSTEM_USER_ID, text: 'Inspirador! Vou começar minha sequência! 🙏', likesCount: 8, createdAt: new Date(Date.now()-20000000).toISOString() },
    { id: uuidv4(), postId: p[4], userId: SYSTEM_USER_ID, text: 'Parabéns pela persistência!',                 likesCount: 5, createdAt: new Date(Date.now()-19000000).toISOString() },
    { id: uuidv4(), postId: p[6], userId: SYSTEM_USER_ID, text: 'Que lindo! Compartilha o padrão? 🙏',         likesCount: 6, createdAt: new Date(Date.now()-34000000).toISOString() },
    { id: uuidv4(), postId: p[6], userId: SYSTEM_USER_ID, text: 'Adorei as cores que você escolheu!',          likesCount: 4, createdAt: new Date(Date.now()-33000000).toISOString() },
    { id: uuidv4(), postId: p[6], userId: SYSTEM_USER_ID, text: 'Motiva muito ver isso! 😍',                   likesCount: 2, createdAt: new Date(Date.now()-32000000).toISOString() },
  ];

  return {
    hobbies, communities, users, posts, comments,
    userHobbies: [],
    communityMembers: [],      // { id, userId, communitySlug, joinedAt }
    xpEvents: [],              // { id, userId, communitySlug, action, xp, createdAt }
    userCommunityProgress: [], // { id, userId, communitySlug, totalXp, levelNumber, levelName, badge, streak, lastActivityDate, progressPercent }
    notifications: [],
    postLikes: [], postSaves: [], refreshTokens: [],
    mlUserVectors: [], mlHobbyVectors: [],
  };
}

// ============================================================
// CARREGAR / SALVAR
// ============================================================
let _db    = null;
let _ready = false;

function normalizeDbShape(data) {
  data.mlUserVectors       = data.mlUserVectors       || [];
  data.mlHobbyVectors      = data.mlHobbyVectors      || [];
  data.userHobbies         = data.userHobbies         || [];
  data.communityMembers    = data.communityMembers    || [];
  data.xpEvents            = data.xpEvents            || [];
  data.userCommunityProgress = data.userCommunityProgress || [];
  data.notifications       = data.notifications       || [];
  data.postLikes           = data.postLikes           || [];
  data.postSaves           = data.postSaves           || [];
  data.refreshTokens       = data.refreshTokens       || [];
  data.comments            = data.comments            || [];
  data.posts               = data.posts               || [];
  data.users               = data.users               || [];
  data.hobbies             = data.hobbies             || [];
  data.communities         = data.communities         || [];

  // Migração: adicionar campos novos às comunidades e hobbies existentes
  const communityDefaults = {
    banner: null, icon: 'star', description: '', postsCount: 0, coverImageUrl: null,
  };
  data.communities = data.communities.map(c => ({ ...communityDefaults, ...c }));
  data.hobbies = data.hobbies.map(h => ({
    banner: null, icon: 'star', description: '', postsCount: 0, coverImageUrl: null, ...h,
  }));
  // Migração: sharesCount nos posts
  data.posts = data.posts.map(p => ({ sharesCount: 0, ...p }));

  return data;
}

function persistLocalSync() {
  fs.writeFileSync(DB_FILE, JSON.stringify(_db, null, 2), 'utf8');
}

function load() {
  if (_db) return _db;
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      _db = normalizeDbShape(JSON.parse(raw));
      console.log(`[DB] Local carregado: ${_db.users.length} usuários, ${_db.posts.length} posts`);
    } else {
      _db = buildSeed();
      persistLocalSync();
      console.log('[DB] Banco local inicializado com seed');
    }
  } catch (err) {
    console.error('[DB] Erro ao carregar — recriando:', err.message);
    _db = buildSeed();
    persistLocalSync();
  }
  return _db;
}

async function init() {
  if (_ready) return _db || load();
  if (!firebase.firestore) { _ready = true; return load(); }
  try {
    const ref  = firebase.firestore.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC_ID);
    const snap = await ref.get();
    if (snap.exists) {
      _db = normalizeDbShape(snap.data());
      console.log(`[DB] Firestore carregado: ${_db.users.length} usuários`);
    } else {
      _db = buildSeed();
      await ref.set(_db);
      console.log('[DB] Firestore inicializado com seed');
    }
    persistLocalSync();
  } catch (err) {
    console.error('[DB] Firestore indisponível, usando JSON local:', err.message);
    load();
  }
  _ready = true;
  return _db;
}

let _saveTimer = null;
function save() {
  if (_saveTimer) return;
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    try {
      persistLocalSync();
      if (firebase.firestore) {
        firebase.firestore.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC_ID)
          .set(_db).catch(e => console.error('[DB] Firestore save error:', e.message));
      }
    } catch (err) { console.error('[DB] Erro ao salvar:', err.message); }
  }, 1000);
}

// ============================================================
// IMAGE STORAGE — prioridade: Supabase → Firebase → Local
// ============================================================
function parseImageBase64(base64Data) {
  const match = base64Data.match(/^data:([a-z]+\/[a-z+]+);base64,(.+)$/i);
  let contentType = 'image/jpeg', ext = 'jpg', raw = base64Data;
  if (match) {
    contentType = match[1].toLowerCase();
    if (!contentType.startsWith('image/')) throw new Error('Arquivo precisa ser uma imagem.');
    ext = contentType.split('/')[1].replace('jpeg', 'jpg').split('+')[0];
    raw = match[2];
  }
  return { buffer: Buffer.from(raw, 'base64'), contentType, ext };
}

async function saveImage(base64Data, bucket = 'posts') {
  // 1. Supabase Storage
  if (supabase.isEnabled) {
    try { return await supabase.saveImage(base64Data, bucket); } catch (err) {
      console.error('[DB] Supabase falhou, tentando Firebase:', err.message);
    }
  }
  // 2. Firebase Storage
  if (firebase.bucket) {
    const { buffer, contentType, ext } = parseImageBase64(base64Data);
    const fileName   = `${uuidv4()}.${ext}`;
    const objectPath = `${bucket}/${fileName}`;
    const file = firebase.bucket.file(objectPath);
    await file.save(buffer, {
      metadata: { contentType, cacheControl: 'public,max-age=31536000' },
      resumable: false,
    });
    const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: '2491-03-09' });
    return signedUrl;
  }
  // 3. Local filesystem
  const { buffer, ext } = parseImageBase64(base64Data);
  const fileName = `${uuidv4()}.${ext}`;
  fs.writeFileSync(path.join(IMAGES_DIR, fileName), buffer);
  return `/images/${fileName}`;
}

function getFirebaseObjectPath(imageUrl) {
  try {
    const parsed     = new URL(imageUrl);
    const pathParts  = parsed.pathname.split('/').filter(Boolean);
    const markerIdx  = pathParts.indexOf('o');
    if (markerIdx >= 0 && pathParts[markerIdx + 1])
      return decodeURIComponent(pathParts[markerIdx + 1]);
  } catch (_) {}
  return null;
}

async function deleteImage(urlPath) {
  try {
    if (!urlPath) return;
    // Supabase
    if (supabase.isEnabled && /^https?:\/\//i.test(urlPath) && urlPath.includes('supabase')) {
      const bucket = urlPath.includes('/avatars/') ? 'avatars' : 'posts';
      await supabase.deleteFile(urlPath, bucket);
      return;
    }
    // Firebase
    if (firebase.bucket && /^https?:\/\//i.test(urlPath)) {
      const objectPath = getFirebaseObjectPath(urlPath);
      if (objectPath) await firebase.bucket.file(objectPath).delete({ ignoreNotFound: true });
      return;
    }
    // Local
    const fileName = path.basename(urlPath);
    const filePath = path.join(IMAGES_DIR, fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}

// ============================================================
// PROXY
// ============================================================
const db = new Proxy({}, {
  get(_, key) {
    if (key === 'init')              return init;
    if (key === 'save')              return save;
    if (key === 'saveImage')         return saveImage;
    if (key === 'deleteImage')       return deleteImage;
    if (key === 'SYSTEM_USER_ID')    return SYSTEM_USER_ID;
    if (key === 'IMAGES_DIR')        return IMAGES_DIR;
    if (key === 'isFirebaseEnabled') return firebase.isFirebaseEnabled;
    if (key === 'isStorageEnabled')  return supabase.isEnabled || !!firebase.bucket;
    return load()[key];
  },
  set(_, key, value) {
    load()[key] = value;
    save();
    return true;
  },
});

module.exports = db;

function flushSync() {
  if (_db) { try { fs.writeFileSync(DB_FILE, JSON.stringify(_db, null, 2), 'utf8'); } catch (_) {} }
}
process.on('SIGINT',  () => { flushSync(); process.exit(0); });
process.on('SIGTERM', () => { flushSync(); process.exit(0); });
process.on('exit',    () => { flushSync(); });
