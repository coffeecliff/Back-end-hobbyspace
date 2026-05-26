const { uuidv4 } = require('../lib');
const db  = require('../config/db');
const ml  = require('../ml/recommender');

const LEVELS = ['Iniciante', 'Aprendiz', 'Intermediário', 'Avançado', 'Expert'];

function getLevel(p) {
  if (p < 20) return LEVELS[0];
  if (p < 40) return LEVELS[1];
  if (p < 60) return LEVELS[2];
  if (p < 80) return LEVELS[3];
  return LEVELS[4];
}

function buildUserHobby(uh) {
  const h = db.hobbies.find(h => h.id === uh.hobbyId);
  return h ? { ...h, level: uh.level, progressPercent: uh.progressPercent } : null;
}

// GET /hobbies/me
function getMyHobbies(req, res) {
  const mine = db.userHobbies
    .filter(uh => uh.userId === req.user.id)
    .map(buildUserHobby).filter(Boolean);
  return res.json(mine);
}

// GET /hobbies/discover?page=1&search=
function discover(req, res) {
  const page   = Math.max(1, parseInt(req.query.page) || 1);
  const search = (req.query.search || '').toLowerCase().trim();
  const limit  = 10;
  const filtered = search
    ? db.hobbies.filter(h => h.name.toLowerCase().includes(search))
    : db.hobbies;
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const data = filtered.slice((page - 1) * limit, page * limit)
    .map(h => ({ ...h, level: 'Iniciante', progressPercent: 0 }));
  return res.json({ data, page, totalPages, totalItems });
}

// GET /hobbies/recommended — ML
function getRecommended(req, res) {
  try {
    const recs = ml.collaborativeRecommend(req.user.id, 4);
    return res.json(recs);
  } catch (err) {
    console.error('[getRecommended]', err);
    return res.json([]);
  }
}

// GET /hobbies/trending — ML
function getTrending(req, res) {
  try {
    return res.json(ml.getTrendingHobbies(5));
  } catch (err) {
    return res.json([]);
  }
}

// GET /hobbies/:id
function getById(req, res) {
  const h = db.hobbies.find(h => h.id === req.params.id);
  if (!h) return res.status(404).json({ message: 'Hobby não encontrado.' });
  return res.json({ ...h, level: 'Iniciante', progressPercent: 0 });
}

// POST /hobbies/:id/join
function join(req, res) {
  const { id: hobbyId } = req.params;
  const { id: userId }  = req.user;
  const h = db.hobbies.find(h => h.id === hobbyId);
  if (!h) return res.status(404).json({ message: 'Hobby não encontrado.' });
  if (db.userHobbies.find(uh => uh.userId === userId && uh.hobbyId === hobbyId))
    return res.status(409).json({ message: 'Você já participa deste hobby.' });
  db.userHobbies.push({
    id: uuidv4(), userId, hobbyId, level: 'Iniciante', progressPercent: 0,
    joinedAt: new Date().toISOString(),
  });
  h.membersCount += 1;
  db.save();
  try { ml.updateUserVector(userId); } catch (_) {}
  return res.status(201).json({ message: 'Entrou no hobby com sucesso.' });
}

// DELETE /hobbies/:id/leave
function leave(req, res) {
  const idx = db.userHobbies.findIndex(
    uh => uh.userId === req.user.id && uh.hobbyId === req.params.id
  );
  if (idx < 0) return res.status(404).json({ message: 'Você não participa deste hobby.' });
  db.userHobbies.splice(idx, 1);
  const h = db.hobbies.find(h => h.id === req.params.id);
  if (h && h.membersCount > 0) h.membersCount -= 1;
  db.save();
  try { ml.updateUserVector(req.user.id); } catch (_) {}
  return res.status(204).send();
}

// PATCH /hobbies/:id/progress
function updateProgress(req, res) {
  const { id: hobbyId } = req.params;
  const { id: userId }  = req.user;
  const { progressPercent } = req.body || {};
  if (typeof progressPercent !== 'number' || progressPercent < 0 || progressPercent > 100)
    return res.status(400).json({ message: 'progressPercent deve ser um número entre 0 e 100.' });
  const uh = db.userHobbies.find(u => u.userId === userId && u.hobbyId === hobbyId);
  if (!uh) return res.status(404).json({ message: 'Hobby não encontrado para este usuário.' });
  const oldLevel = uh.level;
  uh.progressPercent = progressPercent;
  uh.level = getLevel(progressPercent);
  if (uh.level !== oldLevel) {
    db.notifications.push({
      id: uuidv4(), userId, type: 'level_up', isRead: false,
      message: `Você subiu de nível em ${db.hobbies.find(h => h.id === hobbyId)?.name}! Agora você é ${uh.level}. 🎉`,
      createdAt: new Date().toISOString(),
      extra: { level: uh.level, nextLevel: LEVELS[LEVELS.indexOf(uh.level) + 1] || null, progressPercent },
    });
  }
  db.save();
  try { ml.updateUserVector(userId); } catch (_) {}
  return res.json(buildUserHobby(uh));
}

module.exports = { getMyHobbies, discover, getRecommended, getTrending, getById, join, leave, updateProgress };
