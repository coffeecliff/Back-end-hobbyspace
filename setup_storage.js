// ============================================================
// Run once: node setup_storage.js
// Creates the required Supabase Storage buckets
// ============================================================
const fs   = require('fs');
const path = require('path');

// Load .env
try {
  const envPath = path.join(__dirname, '.env');
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const eq = t.indexOf('=');
    if (eq < 0) return;
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  });
} catch (_) {}

const URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || '';

if (!URL || !KEY) {
  console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_KEY precisam estar no .env');
  process.exit(1);
}

async function createBucket(name) {
  // Try to get bucket first
  const check = await fetch(`${URL}/storage/v1/bucket/${name}`, {
    headers: { Authorization: `Bearer ${KEY}`, apikey: KEY },
  });

  if (check.ok) {
    console.log(`✅ Bucket "${name}" já existe`);
    return;
  }

  // Create it
  const res = await fetch(`${URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${KEY}`,
      apikey:         KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: name, name, public: true, file_size_limit: 5242880 }),
  });

  const data = await res.json().catch(() => ({}));
  if (res.ok || data?.name === name) {
    console.log(`✅ Bucket "${name}" criado com sucesso`);
  } else {
    console.error(`❌ Erro ao criar "${name}":`, JSON.stringify(data));
  }
}

async function testUpload() {
  // Upload a tiny test image (1x1 red pixel PNG)
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  const testUrl = `${URL}/storage/v1/object/posts/test_pixel.png`;
  const res = await fetch(testUrl, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${KEY}`,
      'Content-Type': 'image/png',
      'x-upsert':     'true',
    },
    body: pixel,
  });
  if (res.ok) {
    const publicUrl = `${URL}/storage/v1/object/public/posts/test_pixel.png`;
    console.log(`✅ Upload de teste OK → ${publicUrl}`);
  } else {
    const err = await res.text();
    console.error('❌ Upload falhou:', res.status, err);
  }
}

(async () => {
  console.log('\n📦 Criando buckets no Supabase Storage...\n');
  await createBucket('avatars');
  await createBucket('posts');
  await createBucket('communities');
  console.log('\n🧪 Testando upload...\n');
  await testUpload();
  console.log('\n✅ Setup concluído!\n');
})();
