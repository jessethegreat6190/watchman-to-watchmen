import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBgMcsNGiOWzJHCehxYbzcgf04w3WIpxKc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "watchman-to-watchmen.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "watchman-to-watchmen",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "watchman-to-watchmen.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "267490259843",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:267490259843:web:eef160c9ede7f5b570fcb6"
}

let app, auth, db, storage

try {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)
  storage = getStorage(app)
  console.log('Firebase initialized successfully')
} catch (error) {
  console.error('Firebase initialization error:', error)
}

export { app, auth, db, storage }
export const ADMIN_UID = import.meta.env.VITE_ADMIN_UID || ''
