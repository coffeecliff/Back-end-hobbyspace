// ============================================================
// COMMUNITY CONTROLLER — HobbySpace
// ============================================================
const { uuidv4 } = require('../lib');
const db  = require('../config/db');
const xpc = require('./xpController');

// GET /api/communities — lista todas
function listCommunities(req, res) {
  const userId = req.user.id;
  const list = db.communities.map(c => {
    const isMember = db.communityMembers.some(m => m.userId === userId && m.communitySlug === c.slug);
    const postsCount = db.posts.filter(p => p.communitySlug === c.slug).length;
    return { ...c, postsCount, isMember };
  });
  return res.json(list);
}

// GET /api/communities/:slug — detalhes de uma comunidade
function getCommunityBySlug(req, res) {
  const { slug } = req.params;
  const userId   = req.user.id;
  const c = db.communities.find(c => c.slug === slug);
  if (!c) return res.status(404).json({ message: 'Comunidade não encontrada.' });

  const isMember   = db.communityMembers.some(m => m.userId === userId && m.communitySlug === slug);
  const postsCount = db.posts.filter(p => p.communitySlug === slug).length;
  const membersCount = db.communityMembers.filter(m => m.communitySlug === slug).length || c.membersCount;

  // Progresso do usuário nessa comunidade
  let userProgress = null;
  const prog = db.userCommunityProgress.find(p => p.userId === userId && p.communitySlug === slug);
  if (prog) userProgress = prog;

  return res.json({ ...c, postsCount, membersCount, isMember, userProgress });
}

// POST /api/communities/:slug/join — entrar
function joinCommunity(req, res) {
  const { slug }   = req.params;
  const { id: userId } = req.user;

  if (!db.communities.find(c => c.slug === slug))
    return res.status(404).json({ message: 'Comunidade não encontrada.' });

  if (db.communityMembers.find(m => m.userId === userId && m.communitySlug === slug))
    return res.status(409).json({ message: 'Você já é membro desta comunidade.' });

  db.communityMembers.push({ id: uuidv4(), userId, communitySlug: slug, joinedAt: new Date().toISOString() });

  // Sincroniza com userHobbies (para compatibilidade)
  const hobby = db.hobbies.find(h => h.communitySlug === slug);
  if (hobby && !db.userHobbies.find(uh => uh.userId === userId && uh.hobbyId === hobby.id)) {
    db.userHobbies.push({
      id: uuidv4(), userId, hobbyId: hobby.id,
      level: 'Novato', progressPercent: 0, joinedAt: new Date().toISOString(),
    });
    hobby.membersCount = Math.max(hobby.membersCount, 0) + 1;
  }

  const comm = db.communities.find(c => c.slug === slug);
  if (comm) comm.membersCount = db.communityMembers.filter(m => m.communitySlug === slug).length;

  db.save();
  xpc.awardXP(userId, slug, 'JOIN_COMMUNITY');

  return res.status(201).json({ message: 'Entrou na comunidade com sucesso.' });
}

// DELETE /api/communities/:slug/leave — sair
function leaveCommunity(req, res) {
  const { slug }   = req.params;
  const { id: userId } = req.user;

  const idx = db.communityMembers.findIndex(m => m.userId === userId && m.communitySlug === slug);
  if (idx < 0) return res.status(404).json({ message: 'Você não é membro desta comunidade.' });

  db.communityMembers.splice(idx, 1);

  // Sincroniza com userHobbies
  const hobby = db.hobbies.find(h => h.communitySlug === slug);
  if (hobby) {
    const uhIdx = db.userHobbies.findIndex(uh => uh.userId === userId && uh.hobbyId === hobby.id);
    if (uhIdx >= 0) db.userHobbies.splice(uhIdx, 1);
    if (hobby.membersCount > 0) hobby.membersCount -= 1;
  }

  const comm = db.communities.find(c => c.slug === slug);
  if (comm) comm.membersCount = Math.max(0, db.communityMembers.filter(m => m.communitySlug === slug).length);

  db.save();
  return res.status(204).send();
}

// GET /api/communities/:slug/members — membros
function getCommunityMembers(req, res) {
  const { slug } = req.params;
  const members = db.communityMembers
    .filter(m => m.communitySlug === slug)
    .map(m => {
      const user = db.users.find(u => u.id === m.userId);
      const prog = db.userCommunityProgress.find(p => p.userId === m.userId && p.communitySlug === slug);
      return {
        userId: m.userId,
        joinedAt: m.joinedAt,
        user: user ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl || null } : null,
        progress: prog || null,
      };
    })
    .filter(m => m.user !== null);
  return res.json(members);
}

module.exports = { listCommunities, getCommunityBySlug, joinCommunity, leaveCommunity, getCommunityMembers };
