// ============================================================
// SUPABASE STORAGE — HobbySpace
// Integração opcional via variáveis de ambiente:
//   SUPABASE_URL=https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY=service_role_key
// Buckets esperados: avatars | posts | communities
// ============================================================
const { uuidv4 } = require('../lib');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const isEnabled    = !!(SUPABASE_URL && SUPABASE_KEY);

function parseBase64(base64Data) {
  const match = base64Data.match(/^data:([a-z]+\/[a-z+]+);base64,(.+)$/i);
  if (match) {
    const contentType = match[1].toLowerCase();
    if (!contentType.startsWith('image/')) throw new Error('Arquivo precisa ser uma imagem.');
    const ext    = contentType.split('/')[1].replace('jpeg', 'jpg').split('+')[0];
    const buffer = Buffer.from(match[2], 'base64');
    return { buffer, contentType, ext };
  }
  return { buffer: Buffer.from(base64Data, 'base64'), contentType: 'image/jpeg', ext: 'jpg' };
}

async function uploadBuffer(buffer, bucket, fileName, contentType) {
  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${fileName}`;
  const res  = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Supabase upload failed (${res.status}): ${err}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${fileName}`;
}

async function saveImage(base64Data, bucket = 'posts') {
  if (!isEnabled) throw new Error('Supabase not configured');
  const { buffer, contentType, ext } = parseBase64(base64Data);
  const fileName = `${uuidv4()}.${ext}`;
  return uploadBuffer(buffer, bucket, fileName, contentType);
}

async function deleteFile(publicUrl, bucket) {
  if (!isEnabled || !publicUrl) return;
  try {
    const marker = `/object/public/${bucket}/`;
    const idx    = publicUrl.indexOf(marker);
    if (idx < 0) return;
    const filePath  = publicUrl.slice(idx + marker.length);
    const deleteUrl = `${SUPABASE_URL}/storage/v1/object/${bucket}/${filePath}`;
    await fetch(deleteUrl, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${SUPABASE_KEY}` },
    }).catch(() => {});
  } catch (_) {}
}

module.exports = { isEnabled, saveImage, deleteFile, uploadBuffer };
