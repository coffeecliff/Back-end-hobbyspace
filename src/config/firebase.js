const admin = require('firebase-admin');

function cleanPrivateKey(value) {
  if (!value) return value;
  return value.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
}

function hasServiceAccountEnv() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
}

function initFirebase() {
  if (admin.apps.length) return admin.app();

  if (hasServiceAccountEnv()) {
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: cleanPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }

  return null;
}

const app = initFirebase();
const isFirebaseEnabled = Boolean(app);

const firestore = isFirebaseEnabled ? admin.firestore() : null;
const bucket = isFirebaseEnabled && process.env.FIREBASE_STORAGE_BUCKET
  ? admin.storage().bucket()
  : null;

module.exports = {
  admin,
  app,
  firestore,
  bucket,
  isFirebaseEnabled,
  isStorageEnabled: Boolean(bucket),
};
