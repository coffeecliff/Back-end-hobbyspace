const { verifyJWT } = require('../lib');
const db = require('../config/db');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token não fornecido.', code: 'NO_TOKEN' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyJWT(token);
    const user = db.users.find(u => u.id === payload.id);
    if (!user) {
      // Token é válido mas usuário não existe (ex: db foi resetado)
      // Remove o refreshToken stale se existir
      const rtIdx = db.refreshTokens.findIndex(rt => rt.userId === payload.id);
      if (rtIdx >= 0) { db.refreshTokens.splice(rtIdx, 1); db.save(); }
      return res.status(401).json({ message: 'Sessão expirada. Faça login novamente.', code: 'USER_NOT_FOUND' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido ou expirado.', code: 'INVALID_TOKEN' });
  }
}

module.exports = authMiddleware;
