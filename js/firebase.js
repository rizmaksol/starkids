// ============================================================
// js/firebase.js — StarKids V10
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyA96lppklJfdd330342BE4xgOnkYGsvpJE",
  authDomain:        "starkids-v10.firebaseapp.com",
  projectId:         "starkids-v10",
  storageBucket:     "starkids-v10.firebasestorage.app",
  messagingSenderId: "777689704046",
  appId:             "1:777689704046:web:10982cc01de959168a287f",
  measurementId:     "G-GE241VSVPT"
};

const app = initializeApp(firebaseConfig);

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = null; // Storage not enabled on Spark plan
