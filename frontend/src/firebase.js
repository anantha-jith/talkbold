/**
 * firebase.js — Firebase SDK initialization
 *
 * SETUP REQUIRED:
 * 1. Go to https://console.firebase.google.com
 * 2. Create a project (or use existing)
 * 3. Project Settings → General → Your apps → Add app (Web)
 * 4. Copy the firebaseConfig object below and replace the placeholders
 * 5. Authentication → Sign-in method → Enable "Google"
 * 6. Authentication → Settings → Authorized domains → add your local IP
 *    (e.g. 172.29.19.130)
 */

import { initializeApp } from "firebase/app"
import { getAuth, GoogleAuthProvider } from "firebase/auth"

// ── Replace these with your actual Firebase project config ────────────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)

export const googleProvider = new GoogleAuthProvider()
// Always show account picker so users can switch accounts
googleProvider.setCustomParameters({ prompt: "select_account" })
