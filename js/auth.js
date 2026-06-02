// ============================================================
// js/auth.js
// Parent Authentication — StarKids V10
// Handles: Signup · Login · Logout · Auth state
// ============================================================

import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Sign Up ──────────────────────────────────────────────────
export async function signUpParent(name, email, password) {
  try {

    const credential =
      await createUserWithEmailAndPassword(auth, email, password);

    const uid = credential.user.uid;

    await setDoc(doc(db, "parents", uid), {
      name,
      email,
      createdAt: serverTimestamp()
    });

    return credential.user;

  } catch (error) {
    console.error("FULL FIREBASE ERROR:", error);
    alert(error.code + " | " + error.message);
    throw error;
  }
}

// ── Login ────────────────────────────────────────────────────
export async function loginParent(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

// ── Logout ───────────────────────────────────────────────────
export async function logoutParent() {
  await signOut(auth);
}

// ── Fetch parent profile ─────────────────────────────────────
export async function getParentProfile(uid) {
  const snap = await getDoc(doc(db, "parents", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ── Auth State Observer ──────────────────────────────────────
// callback(user) is called whenever auth state changes.
// user is null when logged out, Firebase User object when logged in.
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
