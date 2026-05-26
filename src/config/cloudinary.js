// ============================================================
// CLOUDINARY — HobbySpace
// Upload de imagens via REST API (sem npm, Node.js puro)
//
// Configure no .env:
//   CLOUDINARY_CLOUD_NAME=seu_cloud_name
//   CLOUDINARY_API_KEY=sua_api_key
//   CLOUDINARY_API_SECRET=seu_api_secret
//
// Credenciais em: cloudinary.com → Settings → API Keys
// ============================================================
const crypto = require('crypto');

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
const API_KEY    = process.env.CLOUDINARY_API_KEY    || '';
const API_SECRET = process.env.CLOUDINARY_API_SECRET || '';

const isEnabled = !!(CLOUD_NAME && API_KEY && API_SECRET);

if (isEnabled) {
  console.log(`[Cloudinary] ✅ Habilitado — cloud: ${CLOUD_NAME}`);
} else {
  console.log('[Cloudinary] ⚠️  Não configurado. Adicione no .env:');
  console.log('             CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
}

// Assinatura HMAC-SHA1 exigida pela API do Cloudinary
function sign(params) {
  const str = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  return crypto.createHash('sha1').update(str + API_SECRET).digest('hex');
}

// Parse do base64 recebido do frontend
function parseBase64(base64Data) {
  if (/^data:image\//i.test(base64Data)) return base64Data; // já tem prefixo
  return `data:image/jpeg;base64,${base64Data}`;             // adiciona prefixo JPEG
}

// ── Upload ───────────────────────────────────────────────────────────────────
async function uploadImage(base64Data, folder = 'posts') {
  if (!isEnabled) throw new Error('Cloudinary não configurado. Preencha o .env.');

  const timestamp = Math.floor(Date.now() / 1000);
  const sigParams = { folder, timestamp };
  const signature = sign(sigParams);
  const dataUri   = parseBase64(base64Data);

  // Cloudinary exige application/x-www-form-urlencoded (NÃO aceita JSON)
  const body = new URLSearchParams();
  body.append('file',      dataUri);
  body.append('api_key',   API_KEY);
  body.append('timestamp', String(timestamp));
  body.append('signature', signature);
  body.append('folder',    folder);

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Cloudinary upload falhou: ${msg}`);
  }

  console.log(`[Cloudinary] ✅ Upload → ${data.secure_url}`);
  return data.secure_url; // URL permanente HTTPS
}

// ── Delete ───────────────────────────────────────────────────────────────────
async function deleteImage(secureUrl) {
  if (!isEnabled || !secureUrl) return;
  try {
    // Extrai public_id da URL: .../upload/v123/folder/name.jpg → folder/name
    const match = secureUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]{2,4}$/i);
    if (!match) return;

    const publicId  = match[1];
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = sign({ public_id: publicId, timestamp });

    const body = new URLSearchParams();
    body.append('public_id', publicId);
    body.append('api_key',   API_KEY);
    body.append('timestamp', String(timestamp));
    body.append('signature', signature);

    await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    }).catch(() => {});
  } catch (_) {}
}

module.exports = { isEnabled, uploadImage, deleteImage };