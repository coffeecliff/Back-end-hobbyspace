const { uuidv4, hashPassword, verifyPassword, signJWT } = require('../lib');
const db = require('../config/db');
const ml = require('../ml/recommender');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 6; // sincronizado com frontend (mínimo 6 chars)

function safeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

function makeTokens(userId) {
  return {
    accessToken:  signJWT({ id: userId }, 7  * 86400),
    refreshToken: signJWT({ id: userId, refresh: true }, 30 * 86400),
  };
}

function seedUserHobbies(userId) {
  const hobbies = db.hobbies;
  hobbies.slice(0, 3).forEach((h, i) => {
    // Adiciona em userHobbies (legado)
    if (!db.userHobbies.find(uh => uh.userId === userId && uh.hobbyId === h.id)) {
      db.userHobbies.push({
        id: uuidv4(), userId, hobbyId: h.id,
        level: 'Novato', progressPercent: [10, 25, 5][i] ?? 0,
        joinedAt: new Date().toISOString(),
      });
    }
    // Adiciona em communityMembers (novo sistema)
    if (!db.communityMembers.find(m => m.userId === userId && m.communitySlug === h.communitySlug)) {
      db.communityMembers.push({ id: uuidv4(), userId, communitySlug: h.communitySlug, joinedAt: new Date().toISOString() });
    }
    h.membersCount = Math.max(h.membersCount, 0) + 1;
  });
  db.save();
  // Treina vetor ML inicial
  try { ml.updateUserVector(userId); } catch (_) {}
}

// ============================================================
// POST /auth/register
// ============================================================
async function register(req, res) {
  try {
    const { name, email, password } = req.body || {};

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: 'Nome, e-mail e senha são obrigatórios.' });
    }
    if (name.trim().length < 3) {
      return res.status(400).json({ message: 'O nome deve ter pelo menos 3 caracteres.' });
    }
    if (!EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ message: 'E-mail inválido.' });
    }
    if (password.length < PASSWORD_MIN) {
      return res.status(400).json({ message: `A senha deve ter pelo menos ${PASSWORD_MIN} caracteres.` });
    }
    if (db.users.find(u => u.email === email.toLowerCase().trim())) {
      return res.status(409).json({ message: 'E-mail já cadastrado.' });
    }

    const newUser = {
      id: uuidv4(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: hashPassword(password),
      avatarUrl: null,
      bio: '',
      createdAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    seedUserHobbies(newUser.id);

    db.notifications.push({
      id: uuidv4(), userId: newUser.id, type: 'follow', isRead: false,
      message: `Bem-vindo ao HobbySpace, ${newUser.name}! 🎉 Explore hobbies e conecte-se com pessoas.`,
      createdAt: new Date().toISOString(),
    });
    db.save();

    const tokens = makeTokens(newUser.id);
    db.refreshTokens.push({ userId: newUser.id, token: tokens.refreshToken });
    db.save();

    return res.status(201).json({ user: safeUser(newUser), tokens });
  } catch (err) {
    console.error('[register]', err);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
}

// ============================================================
// POST /auth/login
// ============================================================
async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    if (!email?.trim() || !password) {
      return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
    }

    const user = db.users.find(u => u.email === email.toLowerCase().trim());
    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
    }

    let valid = false;
    try { valid = verifyPassword(password, user.passwordHash); } catch (_) {}
    if (!valid) {
      return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
    }

    const tokens = makeTokens(user.id);
    const idx = db.refreshTokens.findIndex(rt => rt.userId === user.id);
    if (idx >= 0) db.refreshTokens[idx].token = tokens.refreshToken;
    else db.refreshTokens.push({ userId: user.id, token: tokens.refreshToken });
    db.save();

    return res.status(200).json({ user: safeUser(user), tokens });
  } catch (err) {
    console.error('[login]', err);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
}

// POST /auth/logout
function logout(req, res) {
  const idx = db.refreshTokens.findIndex(rt => rt.userId === req.user.id);
  if (idx >= 0) { db.refreshTokens.splice(idx, 1); db.save(); }
  return res.status(204).send();
}

// GET /auth/me
function me(req, res) { return res.json(safeUser(req.user)); }

// PATCH /auth/me
async function updateMe(req, res) {
  try {
    const { name, bio, avatarBase64 } = req.body || {};
    const user = req.user;

    if (name !== undefined) {
      if (!name.trim() || name.trim().length < 3)
        return res.status(400).json({ message: 'Nome deve ter pelo menos 3 caracteres.' });
      user.name = name.trim();
    }
    if (bio !== undefined) user.bio = bio;
    if (avatarBase64) {
      // Apaga avatar anterior
      if (user.avatarUrl) await db.deleteImage(user.avatarUrl);
      user.avatarUrl = await db.saveImage(avatarBase64, 'avatars');
    }
    db.save();
    return res.json(safeUser(user));
  } catch (err) {
    console.error('[updateMe]', err);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
}

module.exports = { register, login, logout, me, updateMe };
