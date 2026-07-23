// Firebase configuration for the bloodstain-c5531 site.
// Web API keys are safe to ship in client code — access is controlled by
// Firebase Security Rules and authorized-domain settings, not by hiding this.
//
// Loaded as ES modules (no build step). Import { app, auth, db, analytics }.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC_pZ6O0E9N50Ig4BAHJt4kZXAerxws5tY",
  authDomain: "bloodstain-c5531.firebaseapp.com",
  projectId: "bloodstain-c5531",
  storageBucket: "bloodstain-c5531.firebasestorage.app",
  messagingSenderId: "471616242809",
  appId: "1:471616242809:web:a709b3ce46943c00cb00a8",
  measurementId: "G-MT58ETQCJE"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// getAnalytics only works over http(s) with a measurementId; guard it so the
// page still loads when opened from the file system or in unsupported browsers.
export let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (err) {
  console.warn("Analytics not initialized:", err?.message || err);
}
