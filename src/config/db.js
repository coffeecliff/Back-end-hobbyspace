// ============================================================
// BANCO DE DADOS JSON PERSISTENTE — HobbySpace
// Usa arquivos .json em /data/ como storage simples e robusto
// Imagens salvas como arquivos binários em /data/images/
// ============================================================
const fs   = require('fs');
const path = require('path');
const { uuidv4 } = require('../lib');
const firebase = require('./firebase');

const DATA_DIR   = path.join(__dirname, '..', '..', 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const DB_FILE    = path.join(DATA_DIR, 'db.json');
const FIRESTORE_COLLECTION = process.env.FIRESTORE_COLLECTION || 'hobbyspace';
const FIRESTORE_DOC_ID     = process.env.FIRESTORE_DOC_ID || 'app-data';

// Garante diretórios
fs.mkdirSync(DATA_DIR,   { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });

// ============================================================
// SEED DATA
// ============================================================
const SYSTEM_USER_ID = 'system-seed-user';

function buildSeed() {
  const hobbies = [
    { id: uuidv4(), name: 'Música',     communitySlug: 'musica',     membersCount: 4200, coverImageUrl: null },
    { id: uuidv4(), name: 'Fotografia', communitySlug: 'fotografia', membersCount: 3100, coverImageUrl: null },
    { id: uuidv4(), name: 'Culinária',  communitySlug: 'culinaria',  membersCount: 5800, coverImageUrl: null },
    { id: uuidv4(), name: 'Leitura',    communitySlug: 'leitura',    membersCount: 6200, coverImageUrl: null },
    { id: uuidv4(), name: 'Desenho',    communitySlug: 'desenho',    membersCount: 2900, coverImageUrl: null },
    { id: uuidv4(), name: 'Jardinagem', communitySlug: 'jardinagem', membersCount: 1800, coverImageUrl: null },
    { id: uuidv4(), name: 'Yoga',       communitySlug: 'yoga',       membersCount: 3400, coverImageUrl: null },
    { id: uuidv4(), name: 'Xadrez',     communitySlug: 'xadrez',     membersCount: 1500, coverImageUrl: null },
  ];

  const communities = hobbies.map(h => ({
    slug: h.communitySlug, title: h.name,
    membersCount: h.membersCount, coverImageUrl: null,
  }));

  const users = [{
    id: SYSTEM_USER_ID, name: 'HobbySpace',
    email: 'system@hobbyspace.app', passwordHash: '',
    avatarUrl: null, bio: 'Conta oficial da plataforma.',
    createdAt: new Date(0).toISOString(),
  }];

  const p = [uuidv4(), uuidv4(), uuidv4(), uuidv4(), uuidv4()];
  const posts = [
    { id: p[0], userId: SYSTEM_USER_ID, communitySlug: 'musica',     imageUrl: null, likesCount: 12, commentsCount: 2, savesCount: 2,  createdAt: new Date(Date.now()-3600000).toISOString(),  text: 'Acabei de aprender a tocar minha primeira música no violão! 🎸 Qual foi a primeira de vocês?' },
    { id: p[1], userId: SYSTEM_USER_ID, communitySlug: 'fotografia',  imageUrl: null, likesCount: 28, commentsCount: 1, savesCount: 5,  createdAt: new Date(Date.now()-7200000).toISOString(),  text: 'Ensaio fotográfico no parque 📸 — luz natural é tudo!' },
    { id: p[2], userId: SYSTEM_USER_ID, communitySlug: 'culinaria',   imageUrl: null, likesCount: 45, commentsCount: 2, savesCount: 9,  createdAt: new Date(Date.now()-10800000).toISOString(), text: 'Fiz um bolo de chocolate do zero. Ficou incrível! 🍫 Posso compartilhar a receita.' },
    { id: p[3], userId: SYSTEM_USER_ID, communitySlug: 'leitura',     imageUrl: null, likesCount: 33, commentsCount: 2, savesCount: 14, createdAt: new Date(Date.now()-14400000).toISOString(), text: '"O Senhor dos Anéis" — uma aventura incrível! 📚 Qual livro marcou você?' },
    { id: p[4], userId: SYSTEM_USER_ID, communitySlug: 'yoga',        imageUrl: null, likesCount: 61, commentsCount: 2, savesCount: 18, createdAt: new Date(Date.now()-21600000).toISOString(), text: 'Completei 30 dias seguidos de yoga! 🧘 Minha flexibilidade melhorou muito.' },
  ];

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
  ];

  return {
    hobbies, communities, users, posts, comments,
    userHobbies: [], notifications: [],
    postLikes: [], postSaves: [], refreshTokens: [],
    mlUserVectors: [],   // vetores de perfil para o modelo ML
    mlHobbyVectors: [],  // vetores de hobby para recomendação
  };
}

// ============================================================
// CARREGAR / SALVAR
// ============================================================
let _db = null;
let _ready = false;

function normalizeDbShape(data) {
  data.mlUserVectors  = data.mlUserVectors  || [];
  data.mlHobbyVectors = data.mlHobbyVectors || [];
  data.userHobbies    = data.userHobbies    || [];
  data.notifications  = data.notifications  || [];
  data.postLikes      = data.postLikes      || [];
  data.postSaves      = data.postSaves      || [];
  data.refreshTokens  = data.refreshTokens  || [];
  data.comments       = data.comments       || [];
  data.posts          = data.posts          || [];
  data.users          = data.users          || [];
  data.hobbies        = data.hobbies        || [];
  data.communities    = data.communities    || [];
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
      console.log(`[DB] Local carregado: ${_db.users.length} usuarios, ${_db.posts.length} posts`);
    } else {
      _db = buildSeed();
      persistLocalSync();
      console.log('[DB] Banco local inicializado com dados de seed');
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

  if (!firebase.firestore) {
    _ready = true;
    return load();
  }

  try {
    const ref = firebase.firestore.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC_ID);
    const snap = await ref.get();

    if (snap.exists) {
      _db = normalizeDbShape(snap.data());
      console.log(`[DB] Firestore carregado: ${_db.users.length} usuarios, ${_db.posts.length} posts`);
    } else {
      _db = buildSeed();
      await ref.set(_db);
      console.log('[DB] Firestore inicializado com dados de seed');
    }

    persistLocalSync();
  } catch (err) {
    console.error('[DB] Firestore indisponivel, usando JSON local:', err.message);
    load();
  }

  _ready = true;
  return _db;
}

let _saveTimer = null;
function save() {
  if (_saveTimer) return; // debounce: escreve no máximo 1x/segundo
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    try {
      persistLocalSync();
      if (firebase.firestore) {
        firebase.firestore
          .collection(FIRESTORE_COLLECTION)
          .doc(FIRESTORE_DOC_ID)
          .set(_db)
          .catch(err => console.error('[DB] Erro ao salvar no Firestore:', err.message));
      }
    } catch (err) {
      console.error('[DB] Erro ao salvar:', err.message);
    }
  }, 1000);
}

// ============================================================
// IMAGE STORAGE
// ============================================================
function parseImageBase64(base64Data) {
  const match = base64Data.match(/^data:([a-z]+\/[a-z+]+);base64,(.+)$/i);
  let contentType = 'image/jpeg';
  let ext = 'jpg';
  let raw = base64Data;

  if (match) {
    contentType = match[1].toLowerCase();
    if (!contentType.startsWith('image/')) throw new Error('Arquivo precisa ser uma imagem.');
    ext = contentType.split('/')[1].replace('jpeg', 'jpg').split('+')[0];
    raw = match[2];
  }

  return { buffer: Buffer.from(raw, 'base64'), contentType, ext };
}

/**
 * Salva base64 no Firebase Storage quando configurado.
 * Sem Firebase, salva como arquivo local em /data/images/.
 */
async function saveImage(base64Data) {
  const { buffer, contentType, ext } = parseImageBase64(base64Data);
  const fileName = `${uuidv4()}.${ext}`;

  if (firebase.bucket) {
    const objectPath = `images/${fileName}`;
    const file = firebase.bucket.file(objectPath);
    await file.save(buffer, {
      metadata: {
        contentType,
        cacheControl: 'public,max-age=31536000',
      },
      resumable: false,
    });

    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: '2491-03-09',
    });
    return signedUrl;
  }

  const filePath = path.join(IMAGES_DIR, fileName);
  fs.writeFileSync(filePath, buffer);
  return `/images/${fileName}`;
}

function getFirebaseObjectPath(imageUrl) {
  try {
    const parsed = new URL(imageUrl);
    const bucketName = firebase.bucket?.name;
    const pathParts = parsed.pathname.split('/').filter(Boolean);

    if (bucketName && pathParts[0] === bucketName) {
      return decodeURIComponent(pathParts.slice(1).join('/'));
    }

    const markerIndex = pathParts.indexOf('o');
    if (markerIndex >= 0 && pathParts[markerIndex + 1]) {
      return decodeURIComponent(pathParts[markerIndex + 1]);
    }
  } catch (_) {}
  return null;
}

async function deleteImage(urlPath) {
  try {
    if (!urlPath) return;
    if (firebase.bucket && /^https?:\/\//i.test(urlPath)) {
      const objectPath = getFirebaseObjectPath(urlPath);
      if (objectPath) await firebase.bucket.file(objectPath).delete({ ignoreNotFound: true });
      return;
    }

    const fileName = path.basename(urlPath);
    const filePath = path.join(IMAGES_DIR, fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}

// ============================================================
// PROXY PARA AS COLEÇÕES (mantém a API igual ao db anterior)
// ============================================================
const db = new Proxy({}, {
  get(_, key) {
    if (key === 'init')        return init;
    if (key === 'save')        return save;
    if (key === 'saveImage')   return saveImage;
    if (key === 'deleteImage') return deleteImage;
    if (key === 'SYSTEM_USER_ID') return SYSTEM_USER_ID;
    if (key === 'IMAGES_DIR')  return IMAGES_DIR;
    if (key === 'isFirebaseEnabled') return firebase.isFirebaseEnabled;
    if (key === 'isStorageEnabled')  return firebase.isStorageEnabled;
    const d = load();
    return d[key];
  },
  set(_, key, value) {
    load()[key] = value;
    save();
    return true;
  },
});

module.exports = db;

// Flush síncrono no shutdown
function flushSync() {
  if (_db) {
    try { fs.writeFileSync(DB_FILE, JSON.stringify(_db, null, 2), 'utf8'); }
    catch (_) {}
  }
}
process.on('SIGINT',  () => { flushSync(); process.exit(0); });
process.on('SIGTERM', () => { flushSync(); process.exit(0); });
process.on('exit',    () => { flushSync(); });
