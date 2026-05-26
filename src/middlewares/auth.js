const { verifyJWT } = require('../lib');
const db = require('../config/db');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token não fornecido.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyJWT(token);
    const user = db.users.find(u => u.id === payload.id);
    if (!user) return res.status(401).json({ message: 'Usuário não encontrado.' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido ou expirado.' });
  }
}

module.exports = authMiddleware;
