// ============================================================
// js/rewards.js — StarKids V10 Sprint 4 (fixed)
// ============================================================

import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  query, where, serverTimestamp, getDoc, setDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const DEFAULT_REWARDS = [
  { title: "Ice Cream 🍦",             stars: 10,  emoji: "🍦", category: "treat"  },
  { title: "Extra Screen Time ⏱",      stars: 15,  emoji: "📱", category: "treat"  },
  { title: "Stay Up 30 Min Late 🌙",    stars: 20,  emoji: "🌙", category: "treat"  },
  { title: "Choose Dinner 🍽",          stars: 25,  emoji: "🍽", category: "treat"  },
  { title: "Pizza Night 🍕",            stars: 30,  emoji: "🍕", category: "outing" },
  { title: "Movie Night 🎬",            stars: 35,  emoji: "🎬", category: "outing" },
  { title: "Trip to the Park 🌳",       stars: 20,  emoji: "🌳", category: "outing" },
  { title: "Swimming Trip 🏊",          stars: 40,  emoji: "🏊", category: "outing" },
  { title: "Bowling Night 🎳",          stars: 50,  emoji: "🎳", category: "outing" },
  { title: "Sleepover with Friend 🏠",  stars: 60,  emoji: "🏠", category: "outing" },
  { title: "New Book 📚",               stars: 30,  emoji: "📚", category: "toy"    },
  { title: "Art Supplies 🎨",           stars: 40,  emoji: "🎨", category: "toy"    },
  { title: "Small Toy 🧸",              stars: 50,  emoji: "🧸", category: "toy"    },
  { title: "LEGO Set 🧱",               stars: 100, emoji: "🧱", category: "toy"    },
  { title: "Video Game 🎮",             stars: 150, emoji: "🎮", category: "toy"    },
  { title: "Day Trip 🚗",               stars: 200, emoji: "🚗", category: "big"    },
  { title: "Bicycle 🚲",                stars: 300, emoji: "🚲", category: "big"    },
];

// ── Seed ONCE per parent — checks first ───────────────────────
export async function seedDefaultRewards(parentId) {
  const snap = await getDocs(query(collection(db, "rewards"), where("parentId", "==", parentId)));
  if (!snap.empty) return; // already seeded — never run again

  const batch = writeBatch(db);
  DEFAULT_REWARDS.forEach(r => {
    batch.set(doc(collection(db, "rewards")), {
      parentId, title: r.title, stars: r.stars,
      emoji: r.emoji, category: r.category,
      active: true, createdAt: serverTimestamp()
    });
  });
  await batch.commit();
}

export async function getRewardsForParent(parentId) {
  const q    = query(collection(db, "rewards"), where("parentId", "==", parentId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createReward(parentId, title, stars, emoji = "🎁", category = "custom") {
  const ref = await addDoc(collection(db, "rewards"), {
    parentId, title, stars, emoji, category, active: true, createdAt: serverTimestamp()
  });
  return { id: ref.id, parentId, title, stars, emoji, category };
}

export async function updateReward(rewardId, fields) {
  await updateDoc(doc(db, "rewards", rewardId), fields);
}

export async function deleteReward(rewardId) {
  await deleteDoc(doc(db, "rewards", rewardId));
}

// ── Redemption request (kid asks, parent approves) ────────────
export async function requestRedemption(goalId, kidId, rewardTitle, starsCost) {
  await updateDoc(doc(db, "goals", goalId), {
    status:          "redemption_requested",
    redemptionRequestedAt: serverTimestamp()
  });
}

// ── Parent approves redemption → deduct stars ─────────────────
export async function approveRedemption(goalId, kidId, starsCost) {
  const walletRef = doc(db, "wallets", kidId);
  const snap      = await getDoc(walletRef);
  const current   = snap.exists() ? (snap.data().stars || 0) : 0;
  const newBal    = Math.max(0, current - starsCost);
  await updateDoc(walletRef, { stars: newBal, lastUpdated: serverTimestamp() });
  await updateDoc(doc(db, "goals", goalId), {
    status: "redeemed", redeemedAt: serverTimestamp()
  });
  return newBal;
}

// ── Parent rejects redemption → back to completed ─────────────
export async function rejectRedemption(goalId) {
  await updateDoc(doc(db, "goals", goalId), {
    status: "completed", redemptionRequestedAt: null
  });
}
