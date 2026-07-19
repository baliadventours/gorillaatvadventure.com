import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfigManual from '../../firebase-applet-config.json';

function sanitizeStorageBucket(bucket: string | undefined): string | undefined {
  if (!bucket) return bucket;
  let clean = bucket.trim();
  if (clean.startsWith('gs://')) {
    clean = clean.substring(5);
  }
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    try {
      const url = new URL(clean);
      const pathParts = url.pathname.split('/');
      const bIndex = pathParts.indexOf('b');
      if (bIndex !== -1 && pathParts[bIndex + 1]) {
        clean = pathParts[bIndex + 1];
      } else {
        clean = url.hostname;
      }
    } catch (e) {
      const match = clean.match(/\/v0\/b\/([^/]+)/);
      if (match && match[1]) {
        clean = match[1];
      }
    }
  }
  clean = clean.split('/')[0];
  return clean;
}

// Use environment variables if available (for production deployments like Vercel)
// Fallback to the local config file for development
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigManual.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigManual.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigManual.projectId,
  storageBucket: sanitizeStorageBucket(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigManual.storageBucket),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigManual.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigManual.appId,
  // This is a custom property used in this app
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseConfigManual.firestoreDatabaseId
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
export const auth = getAuth(app);
export const storage = getStorage(app);

// Test connection
async function testConnection() {
  try {
    // Attempting to get a dummy doc to test responsiveness
    await getDocFromServer(doc(db, '_connection_test', 'test'));
  } catch (error: any) {
    if (error?.message?.includes('the client is offline')) {
      console.error("Please check your Firebase configuration or internet connection.");
    }
  }
}
testConnection();

export * from './firestore-utils';
