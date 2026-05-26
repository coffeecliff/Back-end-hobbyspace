// ============================================================
// MACHINE LEARNING — HobbySpace Recommender
// Algoritmo: Collaborative Filtering + Content-Based via
//            Cosine Similarity em vetores de perfil
//
// Sem dependências externas — implementação pura em JS/Node
// ============================================================

const db = require('../config/db');

// ============================================================
// UTILITÁRIOS MATEMÁTICOS
// ============================================================

/** Produto interno entre dois vetores */
function dot(a, b) {
  return a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);
}

/** Norma (magnitude) de um vetor */
function norm(a) {
  return Math.sqrt(a.reduce((s, v) => s + v * v, 0));
}

/** Similaridade de cosseno entre dois vetores */
function cosine(a, b) {
  const n = norm(a) * norm(b);
  return n === 0 ? 0 : dot(a, b) / n;
}

/** Normaliza vetor para norma 1 */
function normalize(a) {
  const n = norm(a);
  return n === 0 ? a : a.map(v => v / n);
}

// ============================================================
// FEATURE ENGINEERING
// ============================================================
// Cada hobby é representado por um vetor de features binárias/numéricas:
// [ indoor, outdoor, creative, physical, social, cognitive, relaxing, competitive ]
const HOBBY_FEATURES = {
  musica:     [1, 0, 1, 0, 1, 0, 1, 0],
  fotografia: [0, 1, 1, 0, 0, 1, 0, 0],
  culinaria:  [1, 0, 1, 0, 1, 0, 1, 0],
  leitura:    [1, 0, 0, 0, 0, 1, 1, 0],
  desenho:    [1, 0, 1, 0, 0, 1, 1, 0],
  jardinagem: [0, 1, 0, 1, 0, 0, 1, 0],
  yoga:       [0, 1, 0, 1, 0, 1, 1, 0],
  xadrez:     [1, 0, 0, 0, 1, 1, 0, 1],
};

/**
 * Constrói vetor de perfil de um usuário baseado nos hobbies que ele já tem
 * e na quantidade de interações (posts curtidos, comentados, etc.)
 */
function buildUserVector(userId) {
  const userHobbies = db.userHobbies.filter(uh => uh.userId === userId);
  const postLikes   = db.postLikes.filter(l => l.userId === userId);
  const comments    = db.comments.filter(c => c.userId === userId);

  const FEAT_SIZE = 8;
  const vector = new Array(FEAT_SIZE).fill(0);

  // Peso por hobby inscrito (peso = progresso / 100 + 0.3)
  for (const uh of userHobbies) {
    const hobby = db.hobbies.find(h => h.id === uh.hobbyId);
    if (!hobby) continue;
    const feats = HOBBY_FEATURES[hobby.communitySlug];
    if (!feats) continue;
    const weight = (uh.progressPercent / 100) + 0.3;
    feats.forEach((f, i) => { vector[i] += f * weight; });
  }

  // Peso por posts curtidos (analisa a qual comunidade pertencem)
  for (const like of postLikes) {
    const post = db.posts.find(p => p.id === like.postId);
    if (!post) continue;
    const feats = HOBBY_FEATURES[post.communitySlug];
    if (!feats) continue;
    feats.forEach((f, i) => { vector[i] += f * 0.1; });
  }

  // Peso por comentários
  for (const comment of comments) {
    const post = db.posts.find(p => p.id === comment.postId);
    if (!post) continue;
    const feats = HOBBY_FEATURES[post.communitySlug];
    if (!feats) continue;
    feats.forEach((f, i) => { vector[i] += f * 0.05; });
  }

  return normalize(vector);
}

/**
 * Retorna até N hobbies recomendados para um usuário,
 * excluindo os que ele já tem.
 */
function recommendHobbies(userId, topN = 4) {
  const userVec    = buildUserVector(userId);
  const myHobbyIds = new Set(
    db.userHobbies.filter(uh => uh.userId === userId).map(uh => uh.hobbyId)
  );

  const scored = db.hobbies
    .filter(h => !myHobbyIds.has(h.id))
    .map(h => {
      const feats = HOBBY_FEATURES[h.communitySlug] ?? new Array(8).fill(0);
      const hobbyVec = normalize(feats);
      const score = cosine(userVec, hobbyVec);
      return { hobby: h, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  return scored.map(s => ({
    ...s.hobby,
    level: 'Iniciante',
    progressPercent: 0,
    mlScore: Math.round(s.score * 100),
  }));
}

// ============================================================
// COLLABORATIVE FILTERING — "usuários similares gostaram de..."
// ============================================================

function getUserSimilarity(userId1, userId2) {
  const v1 = buildUserVector(userId1);
  const v2 = buildUserVector(userId2);
  return cosine(v1, v2);
}

function collaborativeRecommend(userId, topN = 4) {
  const allUsers = db.users.filter(u => u.id !== userId && u.id !== db.SYSTEM_USER_ID);
  if (allUsers.length === 0) return recommendHobbies(userId, topN);

  // Encontra usuários mais similares
  const similar = allUsers
    .map(u => ({ userId: u.id, sim: getUserSimilarity(userId, u.id) }))
    .filter(x => x.sim > 0.1)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 5);

  if (similar.length === 0) return recommendHobbies(userId, topN);

  const myHobbyIds = new Set(
    db.userHobbies.filter(uh => uh.userId === userId).map(uh => uh.hobbyId)
  );

  // Hobbies dos usuários similares que o usuário atual ainda não tem
  const hobbyScores = {};
  for (const { userId: simId, sim } of similar) {
    const theirHobbies = db.userHobbies.filter(uh => uh.userId === simId);
    for (const uh of theirHobbies) {
      if (myHobbyIds.has(uh.hobbyId)) continue;
      hobbyScores[uh.hobbyId] = (hobbyScores[uh.hobbyId] || 0) + sim;
    }
  }

  const ranked = Object.entries(hobbyScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([hobbyId, score]) => {
      const h = db.hobbies.find(h => h.id === hobbyId);
      return h ? { ...h, level: 'Iniciante', progressPercent: 0, mlScore: Math.round(score * 100) } : null;
    })
    .filter(Boolean);

  // Completa com content-based se não tiver recomendações suficientes
  if (ranked.length < topN) {
    const cbRecs = recommendHobbies(userId, topN - ranked.length);
    const existingIds = new Set(ranked.map(h => h.id));
    for (const r of cbRecs) {
      if (!existingIds.has(r.id)) ranked.push(r);
    }
  }

  return ranked.slice(0, topN);
}

// ============================================================
// ATUALIZAÇÃO INCREMENTAL DE VETORES
// (chamada após join de hobby, like, comentário)
// ============================================================
function updateUserVector(userId) {
  const vec = buildUserVector(userId);
  const existing = db.mlUserVectors.findIndex(v => v.userId === userId);
  if (existing >= 0) {
    db.mlUserVectors[existing] = { userId, vector: vec, updatedAt: new Date().toISOString() };
  } else {
    db.mlUserVectors.push({ userId, vector: vec, updatedAt: new Date().toISOString() });
  }
  db.save();
}

// ============================================================
// ANÁLISE DE TENDÊNCIAS
// ============================================================
function getTrendingHobbies(limit = 5) {
  // Conta novos membros nas últimas 24h
  const since = Date.now() - 86400000;
  const recentJoins = db.userHobbies.filter(uh => new Date(uh.joinedAt).getTime() > since);

  const counts = {};
  for (const uh of recentJoins) {
    counts[uh.hobbyId] = (counts[uh.hobbyId] || 0) + 1;
  }

  return db.hobbies
    .map(h => ({ ...h, recentJoins: counts[h.id] || 0 }))
    .sort((a, b) => (b.recentJoins - a.recentJoins) || (b.membersCount - a.membersCount))
    .slice(0, limit);
}

// ============================================================
// RELATÓRIO DE ENGAJAMENTO POR COMUNIDADE
// ============================================================
function getCommunityStats() {
  return db.communities.map(c => {
    const communityPosts = db.posts.filter(p => p.communitySlug === c.slug);
    const totalLikes    = communityPosts.reduce((s, p) => s + p.likesCount, 0);
    const totalComments = communityPosts.reduce((s, p) => s + p.commentsCount, 0);
    const totalPosts    = communityPosts.length;
    const engagementScore = totalPosts > 0
      ? Math.round((totalLikes + totalComments * 2) / totalPosts)
      : 0;
    return {
      slug: c.slug, title: c.title, membersCount: c.membersCount,
      totalPosts, totalLikes, totalComments, engagementScore,
    };
  }).sort((a, b) => b.engagementScore - a.engagementScore);
}

module.exports = {
  recommendHobbies,
  collaborativeRecommend,
  updateUserVector,
  getTrendingHobbies,
  getCommunityStats,
  buildUserVector,
  cosine,
};
