// ============================================================
// js/rush.js — StarKids V10
// Family Rush Mode: Morning Rush + After School Rush
// ============================================================

import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  query, where, serverTimestamp, getDoc, setDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Default Rush Sessions ─────────────────────────────────────
export const DEFAULT_RUSH_SESSIONS = {
  morning: {
    id: "morning",
    label: "🌅 Morning Rush",
    emoji: "🌅",
    color: "#FF9F43",
    gradient: "linear-gradient(135deg, #FF9F43, #FFD93D)",
    tasks: [
      { id: "m1", title: "Make Bed 🛏",       emoji: "🛏",  minutes: 5,  stars: 3 },
      { id: "m2", title: "Brush Teeth 🦷",    emoji: "🦷",  minutes: 3,  stars: 2 },
      { id: "m3", title: "Face Wash 💧",      emoji: "💧",  minutes: 3,  stars: 2 },
      { id: "m4", title: "Get Dressed 👕",    emoji: "👕",  minutes: 5,  stars: 3 },
      { id: "m5", title: "Have Breakfast 🍳", emoji: "🍳",  minutes: 15, stars: 3 },
    ]
  },
  afterschool: {
    id: "afterschool",
    label: "🏠 After School",
    emoji: "🏠",
    color: "#6C63FF",
    gradient: "linear-gradient(135deg, #6C63FF, #9c8fff)",
    tasks: [
      { id: "a1", title: "Change Clothes 👔",  emoji: "👔", minutes: 5,  stars: 2 },
      { id: "a2", title: "Have Lunch 🍽",      emoji: "🍽", minutes: 20, stars: 2 },
      { id: "a3", title: "Wash Hands 🧼",      emoji: "🧼", minutes: 2,  stars: 1 },
      { id: "a4", title: "Pack School Bag 🎒", emoji: "🎒", minutes: 10, stars: 3 },
      { id: "a5", title: "Rest Time 😴",       emoji: "😴", minutes: 30, stars: 2 },
    ]
  }
};

// ── Calculate stars based on speed ───────────────────────────
// Tiered: finish in top 25% → 3x stars, top 50% → 2x, rest → 1x
export function calculateRushStars(baseStars, elapsedSeconds, totalSeconds) {
  const ratio = elapsedSeconds / totalSeconds;
  if (ratio <= 0.33)      return baseStars * 3; // Super fast — 3x stars!
  else if (ratio <= 0.66) return baseStars * 2; // Good pace — 2x stars
  else                    return baseStars;      // Just made it — base stars
}

// ── Save rush session config ──────────────────────────────────
export async function saveRushSession(parentId, sessionId, tasks) {
  await setDoc(doc(db, "rushSessions", `${parentId}_${sessionId}`), {
    parentId, sessionId, tasks, updatedAt: serverTimestamp()
  });
}

// ── Get rush session config ───────────────────────────────────
export async function getRushSession(parentId, sessionId) {
  const snap = await getDoc(doc(db, "rushSessions", `${parentId}_${sessionId}`));
  if (snap.exists()) return snap.data();
  return DEFAULT_RUSH_SESSIONS[sessionId] || null;
}

// ── Start a rush for all kids ─────────────────────────────────
export async function startRush(parentId, sessionId, kidIds, tasks) {
  const rushId  = `${parentId}_${sessionId}_${Date.now()}`;
  const startAt = new Date();

  await setDoc(doc(db, "activeRush", rushId), {
    rushId, parentId, sessionId,
    kidIds, tasks,
    startAt:   serverTimestamp(),
    startAtMs: startAt.getTime(),
    status:    "active",
    progress:  {}  // kidId → { taskId → { done, doneAt, stars } }
  });

  return rushId;
}

// ── Get active rush for a kid ─────────────────────────────────
export async function getActiveRushForKid(parentId) {
  const q    = query(collection(db, "activeRush"),
    where("parentId", "==", parentId),
    where("status", "==", "active"));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// ── Mark a task done in rush ──────────────────────────────────
export async function completeRushTask(rushId, kidId, taskId, baseStars, startAtMs) {
  const now     = Date.now();
  const elapsed = Math.floor((now - startAtMs) / 1000);

  // Get task to calculate total time
  const rushSnap = await getDoc(doc(db, "activeRush", rushId));
  if (!rushSnap.exists()) return 0;
  const rush = rushSnap.data();
  const task = rush.tasks.find(t => t.id === taskId);
  const totalSecs = (task?.minutes || 5) * 60;

  const earned = calculateRushStars(baseStars, elapsed, totalSecs);

  // Update progress
  const progressKey = `progress.${kidId}.${taskId}`;
  await updateDoc(doc(db, "activeRush", rushId), {
    [`progress.${kidId}.${taskId}`]: {
      done: true, doneAtMs: now,
      elapsedSecs: elapsed, stars: earned
    }
  });

  return earned;
}

// ── End rush (parent or auto) ─────────────────────────────────
export async function endRush(rushId) {
  await updateDoc(doc(db, "activeRush", rushId), {
    status: "completed", endedAt: serverTimestamp()
  });
}
