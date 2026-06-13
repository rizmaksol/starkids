// ============================================================
// js/auth.js — StarKids V10
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
  doc, setDoc, getDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Set persistence inside try/catch — never fail silently
try {
  await setPersistence(auth, browserLocalPersistence);
} catch(e) {
  console.warn("Could not set persistence:", e);
}

// ── Sign Up ───────────────────────────────────────────────────
export async function signUpParent(name, email, password, familyPrefs = {}) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;
  await setDoc(doc(db, "parents", uid), {
    name, email,
    familyFocus:    familyPrefs.focus  || "values",
    faith:          familyPrefs.faith  || null,
    currency:       familyPrefs.currency || "SAR",
    currencySymbol: familyPrefs.symbol || "﷼",
    starRate:       familyPrefs.rate   || 0.10,
    setupComplete:  true,
    createdAt:      serverTimestamp()
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
  // Clear saved credentials on explicit logout
  localStorage.removeItem("sk_saved_email");
  localStorage.removeItem("sk_saved_pw");
  await signOut(auth);
}

// ── Save / Load credentials ───────────────────────────────────
export function saveCredentials(email, password) {
  localStorage.setItem("sk_saved_email", email);
  // Simple obfuscation — not encryption, but better than plain text
  localStorage.setItem("sk_saved_pw", btoa(password));
}

export function loadCredentials() {
  const email = localStorage.getItem("sk_saved_email") || "";
  const pw    = localStorage.getItem("sk_saved_pw") || "";
  return { email, password: pw ? atob(pw) : "" };
}

export function clearCredentials() {
  localStorage.removeItem("sk_saved_email");
  localStorage.removeItem("sk_saved_pw");
}

// ── Get parent profile ────────────────────────────────────────
export async function getParentProfile(uid) {
  const snap = await getDoc(doc(db, "parents", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ── Update parent profile ─────────────────────────────────────
export async function updateParentProfile(uid, fields) {
  // Use setDoc with merge so it works even if the doc doesn't exist yet
  await setDoc(doc(db, "parents", uid), fields, { merge: true });
}

// ── Auth State Observer ───────────────────────────────────────
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
