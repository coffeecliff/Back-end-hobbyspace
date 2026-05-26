const { uuidv4 } = require('../lib');
const db  = require('../config/db');
const ml  = require('../ml/recommender');
const xpc = require('./xpController');

// Mapeamento nome → romano (compatibilidade com level antigo)
const LEVEL_TO_ROMAN = {
  'Novato': 'I', 'Aprendiz': 'II', 'Entusiasta': 'III', 'Especialista': 'IV', 'Mestre': 'V',
  'Iniciante': 'I', 'Intermediário': 'III', 'Avançado': 'IV', 'Expert': 'V',
};

function enrichHobby(hobby, userId) {
  // Busca progresso real do sistema de XP
  const prog = db.userCommunityProgress.find(
    p => p.userId === userId && p.communitySlug === hobby.communitySlug
  );
  // Busca entrada legada em userHobbies
  const uh = db.userHobbies.find(u => u.userId === userId && u.hobbyId === hobby.id);

  const levelName   = prog?.levelName    || uh?.level     || 'Novato';
  const levelRoman  = prog?.levelRoman   || LEVEL_TO_ROMAN[levelName] || 'I';
  const levelNumber = prog?.levelNumber  || 1;
  const progressPercent = prog?.progressPercent ?? uh?.progressPercent ?? 0;
  const totalXp     = prog?.totalXp ?? 0;
  const streak      = prog?.streak ?? 0;
  const badge       = prog?.badge ?? 'novato';

  return {
    ...hobby,
    level: levelName,
    levelRoman,
    levelNumber,
    progressPercent,
    totalXp,
    streak,
    badge,
  };
}

// GET /hobbies/me — hobbies em que o usuário está (via userHobbies + communityMembers)
function getMyHobbies(req, res) {
  const userId = req.user.id;

  // Coleta IDs de hobbies via userHobbies
  const hobbyIdsFromUH = db.userHobbies
    .filter(uh => uh.userId === userId)
    .map(uh => uh.hobbyId);

  // Coleta hobbies via communityMembers (usuários que entraram pela nova API)
  const slugsFromCM = db.communityMembers
    .filter(m => m.userId === userId)
    .map(m => m.communitySlug);

  // Hobbies via communityMembers
  const hobbyIdsFromCM = db.hobbies
    .filter(h => slugsFromCM.includes(h.communitySlug))
    .map(h => h.id);

  // União de IDs sem duplicatas
  const allIds = [...new Set([...hobbyIdsFromUH, ...hobbyIdsFromCM])];

  const mine = allIds
    .map(id => db.hobbies.find(h => h.id === id))
    .filter(Boolean)
    .map(h => enrichHobby(h, userId));

  return res.json(mine);
}

// GET /hobbies/discover
function discover(req, res) {
  const page   = Math.max(1, parseInt(req.query.page) || 1);
  const search = (req.query.search || '').toLowerCase().trim();
  const limit  = 20;
  const userId = req.user.id;

  const filtered = search
    ? db.hobbies.filter(h => h.name.toLowerCase().includes(search))
    : db.hobbies;

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const data = filtered
    .slice((page - 1) * limit, page * limit)
    .map(h => enrichHobby(h, userId));

  return res.json({ data, page, totalPages, totalItems });
}

// GET /hobbies/recommended
function getRecommended(req, res) {
  try { return res.json(ml.collaborativeRecommend(req.user.id, 4)); }
  catch (err) { return res.json([]); }
}

// GET /hobbies/trending
function getTrending(req, res) {
  try { return res.json(ml.getTrendingHobbies(5)); }
  catch (err) { return res.json([]); }
}

// GET /hobbies/:id
function getById(req, res) {
  const h = db.hobbies.find(h => h.id === req.params.id);
  if (!h) return res.status(404).json({ message: 'Hobby não encontrado.' });
  return res.json(enrichHobby(h, req.user.id));
}

// POST /hobbies/:id/join
function join(req, res) {
  const { id: hobbyId } = req.params;
  const { id: userId }  = req.user;
  const h = db.hobbies.find(h => h.id === hobbyId);
  if (!h) return res.status(404).json({ message: 'Hobby não encontrado.' });

  // Verifica se já está em userHobbies
  if (db.userHobbies.find(uh => uh.userId === userId && uh.hobbyId === hobbyId))
    return res.status(409).json({ message: 'Você já participa deste hobby.' });

  db.userHobbies.push({
    id: uuidv4(), userId, hobbyId, level: 'Novato', progressPercent: 0,
    joinedAt: new Date().toISOString(),
  });

  // Sincroniza com communityMembers
  if (!db.communityMembers.find(m => m.userId === userId && m.communitySlug === h.communitySlug)) {
    db.communityMembers.push({ id: uuidv4(), userId, communitySlug: h.communitySlug, joinedAt: new Date().toISOString() });
  }

  h.membersCount = Math.max(h.membersCount, 0) + 1;
  db.save();
  try { ml.updateUserVector(userId); } catch (_) {}
  xpc.awardXP(userId, h.communitySlug, 'JOIN_COMMUNITY');
  return res.status(201).json({ message: 'Entrou no hobby com sucesso.' });
}

// DELETE /hobbies/:id/leave
function leave(req, res) {
  const idx = db.userHobbies.findIndex(
    uh => uh.userId === req.user.id && uh.hobbyId === req.params.id
  );
  if (idx < 0) return res.status(404).json({ message: 'Você não participa deste hobby.' });
  const [removed] = db.userHobbies.splice(idx, 1);
  const h = db.hobbies.find(h => h.id === req.params.id);
  if (h) {
    if (h.membersCount > 0) h.membersCount -= 1;
    // Remove communityMember também
    const cmIdx = db.communityMembers.findIndex(m => m.userId === req.user.id && m.communitySlug === h.communitySlug);
    if (cmIdx >= 0) db.communityMembers.splice(cmIdx, 1);
  }
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
  uh.progressPercent = progressPercent;
  db.save();
  try { ml.updateUserVector(userId); } catch (_) {}
  return res.json(enrichHobby(db.hobbies.find(h => h.id === hobbyId), userId));
}

module.exports = { getMyHobbies, discover, getRecommended, getTrending, getById, join, leave, updateProgress };
