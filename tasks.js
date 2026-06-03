// ============================================================
// js/auth.js
// Parent Authentication — StarKids V10
// ============================================================

import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Force local persistence so auth survives page reloads on GitHub Pages
await setPersistence(auth, browserLocalPersistence);

// ── Sign Up ───────────────────────────────────────────────────
export async function signUpParent(name, email, password) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;

  await setDoc(doc(db, "parents", uid), {
    name,
    email,
    createdAt: serverTimestamp()
  });

  return credential.user;
}

// ── Login ─────────────────────────────────────────────────────
export async function loginParent(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

// ── Logout ────────────────────────────────────────────────────
export async function logoutParent() {
  await signOut(auth);
}

// ── Fetch parent profile ──────────────────────────────────────
export async function getParentProfile(uid) {
  const snap = await getDoc(doc(db, "parents", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ── Auth State Observer ───────────────────────────────────────
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
