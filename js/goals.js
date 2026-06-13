// ============================================================
// js/goals.js — StarKids V10 Sprint 4 (redesigned flow)
// ============================================================

import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  query, where, serverTimestamp, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const GOAL_STATUS = {
  ACTIVE:    "active",
  COMPLETED: "completed",
  REQUESTED: "redemption_requested",
  REDEEMED:  "redeemed"
};

// ── Create a direct redemption request (cart style) ───────────
// Creates a goal already in "redemption_requested" status — does NOT
// touch the kid's single active savings goal
export async function createRedemptionRequest(kidId, reward) {
  const ref = await addDoc(collection(db, "goals"), {
    kidId,
    rewardId:    reward.id,
    title:       reward.title,
    targetStars: reward.stars,
    emoji:       reward.emoji,
    status:      GOAL_STATUS.REQUESTED,
    createdAt:   serverTimestamp(),
    redemptionRequestedAt: serverTimestamp(),
    completedAt: null, redeemedAt: null
  });
  return { id: ref.id, kidId, title: reward.title, targetStars: reward.stars, emoji: reward.emoji, status: GOAL_STATUS.REQUESTED };
}

// ── Create goal from a reward (replaces any existing active goal) ─
export async function createGoalFromReward(kidId, reward) {
  // Cancel any existing active goal first
  const existing = await getGoalsForKid(kidId);
  for (const g of existing.filter(g => g.status === GOAL_STATUS.ACTIVE)) {
    await updateDoc(doc(db, "goals", g.id), { status: "cancelled" });
  }
  const ref = await addDoc(collection(db, "goals"), {
    kidId,
    rewardId:    reward.id,
    title:       reward.title,
    targetStars: reward.stars,
    emoji:       reward.emoji,
    status:      GOAL_STATUS.ACTIVE,
    createdAt:   serverTimestamp(),
    completedAt: null, redeemedAt: null
  });
  return { id: ref.id, kidId, title: reward.title, targetStars: reward.stars, emoji: reward.emoji, status: GOAL_STATUS.ACTIVE };
}

export async function getGoalsForKid(kidId) {
  const q    = query(collection(db, "goals"), where("kidId", "==", kidId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteGoal(goalId) {
  await deleteDoc(doc(db, "goals", goalId));
}

export async function checkGoalCompletion(kidId, currentStars) {
  const goals     = await getGoalsForKid(kidId);
  const completed = [];
  for (const g of goals.filter(g => g.status === GOAL_STATUS.ACTIVE)) {
    if (currentStars >= g.targetStars) {
      await updateDoc(doc(db, "goals", g.id), { status: GOAL_STATUS.COMPLETED, completedAt: serverTimestamp() });
      completed.push(g);
    }
  }
  return completed;
}

export async function addBonusStars(kidId, stars) {
  const ref     = doc(db, "wallets", kidId);
  const snap    = await getDoc(ref);
  const current = snap.exists() ? (snap.data().stars || 0) : 0;
  const currentTotal = snap.exists() ? (snap.data().totalEarned || current) : 0;
  const total   = current + stars;
  if (snap.exists()) await updateDoc(ref, { stars: total, totalEarned: currentTotal + stars, lastUpdated: serverTimestamp() });
  else               await setDoc(ref,    { kidId, stars: total, totalEarned: total, lastUpdated: serverTimestamp() });
  return total;
}
