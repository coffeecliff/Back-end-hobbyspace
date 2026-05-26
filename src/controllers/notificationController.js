const db = require('../config/db');

const CATEGORY_MAP = {
  Comunidade: ['like', 'comment', 'follow'],
  Progresso:  ['level_up'],
};

function getNotifications(req, res) {
  const page     = Math.max(1, parseInt(req.query.page) || 1);
  const category = req.query.category;
  const limit    = 20;

  let filtered = db.notifications
    .filter(n => n.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (category && category !== 'Todas' && CATEGORY_MAP[category]) {
    filtered = filtered.filter(n => CATEGORY_MAP[category].includes(n.type));
  }

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const data = filtered.slice((page - 1) * limit, page * limit);
  return res.json({ data, page, totalPages, totalItems });
}

function markAsRead(req, res) {
  const n = db.notifications.find(n => n.id === req.params.id && n.userId === req.user.id);
  if (!n) return res.status(404).json({ message: 'Notificação não encontrada.' });
  n.isRead = true;
  db.save();
  return res.status(204).send();
}

function markAllAsRead(req, res) {
  db.notifications.filter(n => n.userId === req.user.id).forEach(n => { n.isRead = true; });
  db.save();
  return res.status(204).send();
}

function getUnreadCount(req, res) {
  const count = db.notifications.filter(n => n.userId === req.user.id && !n.isRead).length;
  return res.json({ count });
}

module.exports = { getNotifications, markAsRead, markAllAsRead, getUnreadCount };
