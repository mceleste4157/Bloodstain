/**
 * Firebase initialization.
 *
 * A single place that boots the Firebase app and exports the typed service
 * handles (auth, Firestore, Storage) the rest of the app imports. Web API keys
 * are safe to ship in client code — access is governed by Firebase Security
 * Rules and authorized domains, not by hiding the key — but each value can
 * still be overridden per-environment via Vite `VITE_FIREBASE_*` variables.
 */

import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const env = import.meta.env;

const firebaseConfig: FirebaseOptions = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? 'AIzaSyC_pZ6O0E9N50Ig4BAHJt4kZXAerxws5tY',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? 'bloodstain-c5531.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? 'bloodstain-c5531',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? 'bloodstain-c5531.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '471616242809',
  appId: env.VITE_FIREBASE_APP_ID ?? '1:471616242809:web:a709b3ce46943c00cb00a8',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
