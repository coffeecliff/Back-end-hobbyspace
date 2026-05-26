// ============================================================
// XP & GAMIFICAÇÃO — HobbySpace
// ============================================================
const { uuidv4 } = require('../lib');
const db = require('../config/db');

// XP por ação
const XP_VALUES = {
  POST_CREATE:    50,
  COMMENT_ADD:    20,
  LIKE_GIVEN:      5,
  LIKE_RECEIVED:  10,
  SHARE:          15,
  STREAK_BONUS:   25,
  JOIN_COMMUNITY: 10,
};

// Níveis de progressão
const LEVELS = [
  { number: 1, name: 'Novato',       badge: 'novato',      minXp: 0    },
  { number: 2, name: 'Aprendiz',     badge: 'aprendiz',    minXp: 200  },
  { number: 3, name: 'Entusiasta',   badge: 'entusiasta',  minXp: 600  },
  { number: 4, name: 'Especialista', badge: 'especialista',minXp: 1500 },
  { number: 5, name: 'Mestre',       badge: 'mestre',      minXp: 3000 },
];

function getLevelForXp(xp) {
  let level = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.minXp) level = l;
  }
  return level;
}

function getProgressPercent(xp) {
  const current = getLevelForXp(xp);
  const nextIdx = LEVELS.indexOf(current) + 1;
  if (nextIdx >= LEVELS.length) return 100;
  const range = LEVELS[nextIdx].minXp - current.minXp;
  return Math.min(99, Math.floor(((xp - current.minXp) / range) * 100));
}

function getRomanNumeral(n) {
  const map = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
  return map[n] || 'I';
}

function isSameDay(dateA, dateB) {
  const a = new Date(dateA), b = new Date(dateB);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isConsecutiveDay(prev, current) {
  const a = new Date(prev), b = new Date(current);
  const diff = (b.setHours(0,0,0,0) - a.setHours(0,0,0,0)) / 86400000;
  return diff === 1;
}

// ============================================================
// OBTER OU CRIAR PROGRESSO
// ============================================================
function ensureProgress(userId, communitySlug) {
  let prog = db.userCommunityProgress.find(
    p => p.userId === userId && p.communitySlug === communitySlug
  );
  if (!prog) {
    const level = LEVELS[0];
    prog = {
      id: uuidv4(),
      userId,
      communitySlug,
      totalXp: 0,
      levelNumber: level.number,
      levelName: level.name,
      levelRoman: getRomanNumeral(level.number),
      badge: level.badge,
      streak: 0,
      lastActivityDate: null,
      progressPercent: 0,
    };
    db.userCommunityProgress.push(prog);
  }
  return prog;
}

// ============================================================
// CONCEDER XP
// ============================================================
function awardXP(userId, communitySlug, action) {
  const xp = XP_VALUES[action];
  if (!xp || !communitySlug) return null;

  const now  = new Date().toISOString();
  const prog = ensureProgress(userId, communitySlug);

  // Registra evento
  db.xpEvents.push({ id: uuidv4(), userId, communitySlug, action, xp, createdAt: now });

  // Atualiza XP total
  prog.totalXp += xp;

  // Atualiza nível
  const prevLevel   = prog.levelNumber;
  const newLevel    = getLevelForXp(prog.totalXp);
  prog.levelNumber  = newLevel.number;
  prog.levelName    = newLevel.name;
  prog.levelRoman   = getRomanNumeral(newLevel.number);
  prog.badge        = newLevel.badge;
  prog.progressPercent = getProgressPercent(prog.totalXp);

  // Atualiza streak
  const today = now.split('T')[0];
  if (!prog.lastActivityDate) {
    prog.streak = 1;
  } else if (isSameDay(prog.lastActivityDate, now)) {
    // mesmo dia — não incrementa streak
  } else if (isConsecutiveDay(prog.lastActivityDate, now)) {
    prog.streak += 1;
    // Bônus streak
    db.xpEvents.push({ id: uuidv4(), userId, communitySlug, action: 'STREAK_BONUS', xp: XP_VALUES.STREAK_BONUS, createdAt: now });
    prog.totalXp += XP_VALUES.STREAK_BONUS;
  } else {
    prog.streak = 1; // reset
  }
  prog.lastActivityDate = now;

  // Notificação de level up
  if (newLevel.number > prevLevel) {
    const comm = db.communities.find(c => c.slug === communitySlug);
    db.notifications.push({
      id: uuidv4(), userId, type: 'level_up', isRead: false,
      message: `🏆 Você subiu para ${newLevel.name} em ${comm?.title || communitySlug}! (Nível ${getRomanNumeral(newLevel.number)})`,
      createdAt: now,
      extra: { level: newLevel.name, levelRoman: getRomanNumeral(newLevel.number), badge: newLevel.badge, communitySlug },
    });
  }

  db.save();
  return prog;
}

// ============================================================
// ROTAS
// ============================================================

// GET /api/progress/me — progresso em todas as comunidades
function getMyProgress(req, res) {
  const userId = req.user.id;
  const progresses = db.userCommunityProgress
    .filter(p => p.userId === userId)
    .map(p => {
      const comm = db.communities.find(c => c.slug === p.communitySlug);
      return {
        ...p,
        communityName: comm?.title || p.communitySlug,
        communityIcon: comm?.icon || 'star',
        communityBanner: comm?.coverImageUrl || null,
      };
    });
  return res.json(progresses);
}

// GET /api/progress/:slug — progresso em comunidade específica
function getProgressByCommunity(req, res) {
  const { slug } = req.params;
  const userId   = req.user.id;
  let prog = db.userCommunityProgress.find(p => p.userId === userId && p.communitySlug === slug);
  if (!prog) {
    const level = LEVELS[0];
    prog = {
      userId, communitySlug: slug,
      totalXp: 0, levelNumber: 1, levelName: level.name,
      levelRoman: 'I', badge: level.badge, streak: 0,
      lastActivityDate: null, progressPercent: 0,
    };
  }
  const comm = db.communities.find(c => c.slug === slug);
  return res.json({
    ...prog,
    communityName: comm?.title || slug,
    communityIcon: comm?.icon || 'star',
  });
}

// GET /api/xp/events?communitySlug=xxx — histórico de XP
function getXpEvents(req, res) {
  const userId = req.user.id;
  const { communitySlug } = req.query;
  let events = db.xpEvents.filter(e => e.userId === userId);
  if (communitySlug) events = events.filter(e => e.communitySlug === communitySlug);
  events.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json(events.slice(0, 50));
}

module.exports = { awardXP, ensureProgress, getMyProgress, getProgressByCommunity, getXpEvents, XP_VALUES, LEVELS };
