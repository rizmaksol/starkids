// ============================================================
// js/kid.js
// Kids Management — StarKids V10
// Handles: Add Kid · Delete Kid · Generate Code · Kid Login
//          Real photo upload to Firebase Storage
// ============================================================

import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, getDoc, doc,
  deleteDoc, query, where, serverTimestamp, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Generate a random 6-digit code ───────────────────────────
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── uploadKidPhoto — base64 now handled in app.js via fileToBase64
// Kept for API compatibility
export async function uploadKidPhoto(parentId, kidId, file) {
  return null; // base64 handled in app.js before calling updateKidPhoto
}

// ── Add a new kid ─────────────────────────────────────────────
export async function addKid(parentId, name, age, avatarEmoji = "🌟", photoURL = null) {
  const code = generateCode();

  const kidRef = await addDoc(collection(db, "kids"), {
    parentId,
    name,
    age,
    avatarEmoji,
    photoURL,        // null until a real photo is uploaded
    code,
    createdAt: serverTimestamp()
  });

  // If a photo file was passed, upload it now and update the doc
  return { id: kidRef.id, name, age, avatarEmoji, photoURL, code };
}

// ── Update kid photo URL in Firestore ────────────────────────
export async function updateKidPhoto(kidId, photoURL) {
  await updateDoc(doc(db, "kids", kidId), { photoURL });
}

// ── Get all kids for a parent ─────────────────────────────────
export async function getKidsByParent(parentId) {
  const q    = query(collection(db, "kids"), where("parentId", "==", parentId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Delete a kid ──────────────────────────────────────────────
export async function deleteKid(kidId) {
  await deleteDoc(doc(db, "kids", kidId));
}

// ── Regenerate a kid's code ───────────────────────────────────
export async function regenerateKidCode(kidId) {
  const newCode = generateCode();
  await updateDoc(doc(db, "kids", kidId), { code: newCode });
  return newCode;
}

// ── Kid login by 6-digit code ─────────────────────────────────
export async function loginKidByCode(code) {
  const q    = query(collection(db, "kids"), where("code", "==", code));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

// ── Get a single kid by ID ────────────────────────────────────
export async function getKidById(kidId) {
  const snap = await getDoc(doc(db, "kids", kidId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
