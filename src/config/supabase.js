// ============================================================
// SUPABASE STORAGE — HobbySpace
// Apenas para armazenamento de imagens (avatars, posts, communities)
// Execute: node setup_storage.js  para criar os buckets
// ============================================================
const { uuidv4 } = require('../lib');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const isEnabled    = !!(SUPABASE_URL && SUPABASE_KEY);

if (isEnabled) {
  console.log('[Supabase] Storage habilitado →', SUPABASE_URL.slice(0, 40));
} else {
  console.log('[Supabase] Storage desabilitado — imagens salvas localmente');
}

// ── Parse base64 ───────────────────────────────────────────────────────────
function parseBase64(base64Data) {
  const match = base64Data.match(/^data:([a-z]+\/[a-z+\-]+);base64,(.+)$/i);
  if (match) {
    const contentType = match[1].toLowerCase();
    if (!contentType.startsWith('image/')) throw new Error('Precisa ser uma imagem.');
    const ext    = contentType.split('/')[1].replace('jpeg','jpg').split('+')[0];
    const buffer = Buffer.from(match[2], 'base64');
    return { buffer, contentType, ext };
  }
  // Sem prefixo — assume JPEG
  return { buffer: Buffer.from(base64Data, 'base64'), contentType: 'image/jpeg', ext: 'jpg' };
}

// ── Upload ─────────────────────────────────────────────────────────────────
async function uploadBuffer(buffer, bucket, fileName, contentType) {
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${bucket}/${fileName}`;

  const res = await fetch(uploadUrl, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${SUPABASE_KEY}`,
      apikey:         SUPABASE_KEY,
      'Content-Type': contentType,
      'x-upsert':     'true',
    },
    body: buffer,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // Bucket não existe → instrução clara
    if (res.status === 400 && body.includes('Bucket not found')) {
      throw new Error(
        `Bucket "${bucket}" não encontrado no Supabase. Execute: node setup_storage.js`
      );
    }
    throw new Error(`Supabase upload (${res.status}): ${body.slice(0, 200)}`);
  }

  // URL pública
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${fileName}`;
}

// ── API pública ─────────────────────────────────────────────────────────────
async function saveImage(base64Data, bucket = 'posts') {
  if (!isEnabled) throw new Error('Supabase não configurado');
  const { buffer, contentType, ext } = parseBase64(base64Data);
  const fileName = `${Date.now()}_${uuidv4().slice(0, 8)}.${ext}`;
  const url = await uploadBuffer(buffer, bucket, fileName, contentType);
  console.log(`[Supabase] Upload OK → ${bucket}/${fileName}`);
  return url;
}

async function deleteFile(publicUrl, bucket) {
  if (!isEnabled || !publicUrl) return;
  try {
    const marker = `/object/public/${bucket}/`;
    const idx    = publicUrl.indexOf(marker);
    if (idx < 0) return;
    const filePath = publicUrl.slice(idx + marker.length);
    await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${filePath}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${SUPABASE_KEY}`, apikey: SUPABASE_KEY },
    }).catch(() => {});
  } catch (_) {}
}

module.exports = { isEnabled, saveImage, deleteFile, uploadBuffer };
