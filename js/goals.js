// ============================================================
// js/goals.js — StarKids V10 Sprint 3
// Handles: Create Goal · Get Goals · Update Progress · Complete
// ============================================================

import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  query, where, serverTimestamp, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Goal status ───────────────────────────────────────────────
export const GOAL_STATUS = {
  ACTIVE:    "active",
  COMPLETED: "completed"
};

// ── Create a goal ─────────────────────────────────────────────
export async function createGoal(kidId, title, targetStars, emoji = "🎯") {
  const ref = await addDoc(collection(db, "goals"), {
    kidId,
    title,
    targetStars,
    emoji,
    status:    GOAL_STATUS.ACTIVE,
    createdAt: serverTimestamp(),
    completedAt: null
  });
  return { id: ref.id, kidId, title, targetStars, emoji, status: GOAL_STATUS.ACTIVE };
}

// ── Get all goals for a kid ───────────────────────────────────
export async function getGoalsForKid(kidId) {
  const q    = query(collection(db, "goals"), where("kidId", "==", kidId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Delete a goal ─────────────────────────────────────────────
export async function deleteGoal(goalId) {
  await deleteDoc(doc(db, "goals", goalId));
}

// ── Check and complete goals when stars change ────────────────
export async function checkGoalCompletion(kidId, currentStars) {
  const goals   = await getGoalsForKid(kidId);
  const active  = goals.filter(g => g.status === GOAL_STATUS.ACTIVE);
  const completed = [];

  for (const goal of active) {
    if (currentStars >= goal.targetStars) {
      await updateDoc(doc(db, "goals", goal.id), {
        status:      GOAL_STATUS.COMPLETED,
        completedAt: serverTimestamp()
      });
      completed.push(goal);
    }
  }
  return completed; // returns newly completed goals so UI can celebrate
}

// ── Get wallet (star balance + history) ──────────────────────
export async function getWallet(kidId) {
  const snap = await getDoc(doc(db, "wallets", kidId));
  return snap.exists() ? snap.data() : { kidId, stars: 0 };
}

// ── Parent: bonus stars ───────────────────────────────────────
export async function addBonusStars(kidId, stars, reason) {
  const walletRef = doc(db, "wallets", kidId);
  const snap      = await getDoc(walletRef);
  const current   = snap.exists() ? (snap.data().stars || 0) : 0;

  if (snap.exists()) {
    await updateDoc(walletRef, {
      stars:       current + stars,
      lastUpdated: serverTimestamp()
    });
  } else {
    await setDoc(walletRef, {
      kidId,
      stars:       current + stars,
      lastUpdated: serverTimestamp()
    });
  }
  return current + stars;
}
