const { uuidv4 } = require('../lib');
const db = require('../config/db');
const ml = require('../ml/recommender');

function safeUser(u) {
  if (!u) return { id: 'unknown', name: 'HobbySpace', avatarUrl: null };
  return { id: u.id, name: u.name, avatarUrl: u.avatarUrl || null };
}

function buildPost(post, userId) {
  return {
    ...post,
    user: safeUser(db.users.find(u => u.id === post.userId)),
    isLiked: db.postLikes.some(l => l.userId === userId && l.postId === post.id),
    isSaved: db.postSaves.some(s => s.userId === userId && s.postId === post.id),
  };
}

function listCommunities(req, res) { return res.json(db.communities); }

function getCommunity(req, res) {
  const c = db.communities.find(c => c.slug === req.params.slug);
  return c ? res.json(c) : res.status(404).json({ message: 'Comunidade não encontrada.' });
}

function getPostsByCommunity(req, res) {
  const { slug } = req.params;
  if (!db.communities.find(c => c.slug === slug))
    return res.status(404).json({ message: 'Comunidade não encontrada.' });
  const page  = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 10;
  const filtered = db.posts
    .filter(p => p.communitySlug === slug)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const data = filtered.slice((page - 1) * limit, page * limit).map(p => buildPost(p, req.user.id));
  return res.json({ data, page, totalPages, totalItems });
}

function getPost(req, res) {
  const p = db.posts.find(p => p.id === req.params.id);
  return p ? res.json(buildPost(p, req.user.id)) : res.status(404).json({ message: 'Post não encontrado.' });
}

async function createPost(req, res) {
  const { communitySlug, text, imageBase64 } = req.body || {};
  if (!communitySlug || !text?.trim())
    return res.status(400).json({ message: 'communitySlug e text são obrigatórios.' });
  if (!db.communities.find(c => c.slug === communitySlug))
    return res.status(404).json({ message: 'Comunidade não encontrada.' });

  let imageUrl = null;
  if (imageBase64) {
    try {
      imageUrl = await db.saveImage(imageBase64);
    } catch (err) {
      console.error('[createPost] Erro ao salvar imagem:', err.message);
      return res.status(400).json({ message: 'Imagem inválida.' });
    }
  }

  const newPost = {
    id: uuidv4(), userId: req.user.id, communitySlug,
    text: text.trim(), imageUrl,
    likesCount: 0, commentsCount: 0, savesCount: 0,
    createdAt: new Date().toISOString(),
  };
  db.posts.push(newPost);
  db.save();
  try { ml.updateUserVector(req.user.id); } catch (_) {}
  return res.status(201).json(buildPost(newPost, req.user.id));
}

async function deletePost(req, res) {
  const idx = db.posts.findIndex(p => p.id === req.params.id && p.userId === req.user.id);
  if (idx < 0) return res.status(404).json({ message: 'Post não encontrado ou sem permissão.' });
  const [removed] = db.posts.splice(idx, 1);
  if (removed.imageUrl) await db.deleteImage(removed.imageUrl);
  db.save();
  return res.status(204).send();
}

function likePost(req, res) {
  const { id: postId } = req.params;
  const { id: userId } = req.user;
  const post = db.posts.find(p => p.id === postId);
  if (!post) return res.status(404).json({ message: 'Post não encontrado.' });
  if (db.postLikes.find(l => l.userId === userId && l.postId === postId))
    return res.status(409).json({ message: 'Post já curtido.' });
  db.postLikes.push({ userId, postId });
  post.likesCount += 1;
  if (post.userId && post.userId !== userId) {
    db.notifications.push({
      id: uuidv4(), userId: post.userId, type: 'like', isRead: false,
      message: `${req.user.name} curtiu seu post.`,
      actor: safeUser(req.user), createdAt: new Date().toISOString(),
    });
  }
  db.save();
  try { ml.updateUserVector(userId); } catch (_) {}
  return res.status(204).send();
}

function unlikePost(req, res) {
  const idx = db.postLikes.findIndex(l => l.userId === req.user.id && l.postId === req.params.id);
  if (idx < 0) return res.status(404).json({ message: 'Like não encontrado.' });
  db.postLikes.splice(idx, 1);
  const post = db.posts.find(p => p.id === req.params.id);
  if (post && post.likesCount > 0) post.likesCount -= 1;
  db.save();
  return res.status(204).send();
}

function savePost(req, res) {
  const { id: postId } = req.params;
  const { id: userId } = req.user;
  if (!db.posts.find(p => p.id === postId)) return res.status(404).json({ message: 'Post não encontrado.' });
  if (db.postSaves.find(s => s.userId === userId && s.postId === postId))
    return res.status(409).json({ message: 'Post já salvo.' });
  db.postSaves.push({ userId, postId });
  const p = db.posts.find(p => p.id === postId);
  if (p) p.savesCount += 1;
  db.save();
  return res.status(204).send();
}

function unsavePost(req, res) {
  const idx = db.postSaves.findIndex(s => s.userId === req.user.id && s.postId === req.params.id);
  if (idx < 0) return res.status(404).json({ message: 'Post salvo não encontrado.' });
  db.postSaves.splice(idx, 1);
  const post = db.posts.find(p => p.id === req.params.id);
  if (post && post.savesCount > 0) post.savesCount -= 1;
  db.save();
  return res.status(204).send();
}

function getComments(req, res) {
  const result = db.comments
    .filter(c => c.postId === req.params.id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map(c => ({ ...c, user: safeUser(db.users.find(u => u.id === c.userId)) }));
  return res.json(result);
}

function addComment(req, res) {
  const { id: postId } = req.params;
  const { text } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ message: 'Comentário não pode ser vazio.' });
  const post = db.posts.find(p => p.id === postId);
  if (!post) return res.status(404).json({ message: 'Post não encontrado.' });
  const newComment = {
    id: uuidv4(), postId, userId: req.user.id,
    text: text.trim(), likesCount: 0, createdAt: new Date().toISOString(),
  };
  db.comments.push(newComment);
  post.commentsCount += 1;
  if (post.userId && post.userId !== req.user.id) {
    db.notifications.push({
      id: uuidv4(), userId: post.userId, type: 'comment', isRead: false,
      message: `${req.user.name} comentou: "${text.slice(0, 60)}"`,
      actor: safeUser(req.user), createdAt: new Date().toISOString(),
    });
  }
  db.save();
  try { ml.updateUserVector(req.user.id); } catch (_) {}
  return res.status(201).json({ ...newComment, user: safeUser(req.user) });
}

// GET /ml/stats — endpoint de estatísticas ML
function getMlStats(req, res) {
  try {
    return res.json(ml.getCommunityStats());
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao gerar estatísticas.' });
  }
}

module.exports = {
  listCommunities, getCommunity, getPostsByCommunity,
  getPost, createPost, deletePost,
  likePost, unlikePost, savePost, unsavePost,
  getComments, addComment, getMlStats,
};
