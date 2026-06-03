// ============================================================
// js/goals.js — StarKids V10 Sprint 4
// Goals are now always linked to a reward from the catalog
// ============================================================

import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  query, where, serverTimestamp, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const GOAL_STATUS = {
  ACTIVE:    "active",
  COMPLETED: "completed",
  REDEEMED:  "redeemed"
};

// ── Create goal from a reward ─────────────────────────────────
export async function createGoalFromReward(kidId, reward) {
  const ref = await addDoc(collection(db, "goals"), {
    kidId,
    rewardId:    reward.id,
    title:       reward.title,
    targetStars: reward.stars,
    emoji:       reward.emoji,
    status:      GOAL_STATUS.ACTIVE,
    createdAt:   serverTimestamp(),
    completedAt: null,
    redeemedAt:  null
  });
  return { id: ref.id, kidId, title: reward.title, targetStars: reward.stars, emoji: reward.emoji, status: GOAL_STATUS.ACTIVE };
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

// ── Check if any active goals are now completed ───────────────
export async function checkGoalCompletion(kidId, currentStars) {
  const goals   = await getGoalsForKid(kidId);
  const completed = [];
  for (const g of goals.filter(g => g.status === GOAL_STATUS.ACTIVE)) {
    if (currentStars >= g.targetStars) {
      await updateDoc(doc(db, "goals", g.id), {
        status: GOAL_STATUS.COMPLETED, completedAt: serverTimestamp()
      });
      completed.push(g);
    }
  }
  return completed;
}

// ── Get wallet balance ────────────────────────────────────────
export async function getWallet(kidId) {
  const snap = await getDoc(doc(db, "wallets", kidId));
  return snap.exists() ? snap.data() : { kidId, stars: 0 };
}

// ── Bonus stars ───────────────────────────────────────────────
export async function addBonusStars(kidId, stars) {
  const walletRef = doc(db, "wallets", kidId);
  const snap      = await getDoc(walletRef);
  const current   = snap.exists() ? (snap.data().stars || 0) : 0;
  const newTotal  = current + stars;
  if (snap.exists()) {
    await updateDoc(walletRef, { stars: newTotal, lastUpdated: serverTimestamp() });
  } else {
    await setDoc(walletRef, { kidId, stars: newTotal, lastUpdated: serverTimestamp() });
  }
  return newTotal;
}
