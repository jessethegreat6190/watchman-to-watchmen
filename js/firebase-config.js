// Firebase Configuration for Watchman to Watchmen
const firebaseConfig = {
  apiKey: "AIzaSyBgMcsNGiOWzJHCehxYbzcgf04w3WIpxKc",
  authDomain: "watchman-to-watchmen.firebaseapp.com",
  projectId: "watchman-to-watchmen",
  storageBucket: "watchman-to-watchmen.firebasestorage.app",
  messagingSenderId: "267490259843",
  appId: "1:267490259843:web:eef160c9ede7f5b570fcb6"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get references
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

console.log("Firebase initialized successfully");
