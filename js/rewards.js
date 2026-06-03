// ============================================================
// js/rewards.js — StarKids V10 Sprint 4
// Handles: Reward Catalog · Kid picks reward as goal · Redeem
// ============================================================

import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  query, where, serverTimestamp, getDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Default reward catalog (created for every new parent) ────
export const DEFAULT_REWARDS = [
  // Small treats
  { title: "Ice Cream 🍦",           stars: 10,  emoji: "🍦", category: "treat"    },
  { title: "Extra Screen Time ⏱",    stars: 15,  emoji: "📱", category: "treat"    },
  { title: "Stay Up 30 Min Late 🌙",  stars: 20,  emoji: "🌙", category: "treat"    },
  { title: "Pizza Night 🍕",          stars: 30,  emoji: "🍕", category: "outing"   },
  { title: "Choose Dinner 🍽",        stars: 25,  emoji: "🍽", category: "treat"    },
  { title: "Movie Night 🎬",          stars: 35,  emoji: "🎬", category: "outing"   },

  // Outings
  { title: "Trip to the Park 🌳",     stars: 20,  emoji: "🌳", category: "outing"   },
  { title: "Swimming Trip 🏊",        stars: 40,  emoji: "🏊", category: "outing"   },
  { title: "Bowling Night 🎳",        stars: 50,  emoji: "🎳", category: "outing"   },

  // Toys & things
  { title: "Small Toy 🧸",            stars: 50,  emoji: "🧸", category: "toy"      },
  { title: "LEGO Set 🧱",             stars: 100, emoji: "🧱", category: "toy"      },
  { title: "New Book 📚",             stars: 30,  emoji: "📚", category: "toy"      },
  { title: "Art Supplies 🎨",         stars: 40,  emoji: "🎨", category: "toy"      },
  { title: "Video Game 🎮",           stars: 150, emoji: "🎮", category: "toy"      },

  // Big rewards
  { title: "Bicycle 🚲",              stars: 300, emoji: "🚲", category: "big"      },
  { title: "Day Trip 🚗",             stars: 200, emoji: "🚗", category: "big"      },
  { title: "Sleepover with Friend 🏠", stars: 60, emoji: "🏠", category: "outing"   },
];

// ── Seed default rewards for a new parent ────────────────────
export async function seedDefaultRewards(parentId) {
  const existing = await getRewardsForParent(parentId);
  if (existing.length > 0) return; // already seeded

  const batch = writeBatch(db);
  DEFAULT_REWARDS.forEach(r => {
    const ref = doc(collection(db, "rewards"));
    batch.set(ref, {
      parentId,
      title:     r.title,
      stars:     r.stars,
      emoji:     r.emoji,
      category:  r.category,
      active:    true,
      createdAt: serverTimestamp()
    });
  });
  await batch.commit();
}

// ── Get all rewards for a parent ─────────────────────────────
export async function getRewardsForParent(parentId) {
  const q    = query(collection(db, "rewards"), where("parentId", "==", parentId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Create a custom reward ────────────────────────────────────
export async function createReward(parentId, title, stars, emoji = "🎁", category = "custom") {
  const ref = await addDoc(collection(db, "rewards"), {
    parentId, title, stars, emoji, category,
    active: true,
    createdAt: serverTimestamp()
  });
  return { id: ref.id, parentId, title, stars, emoji, category, active: true };
}

// ── Update reward ─────────────────────────────────────────────
export async function updateReward(rewardId, fields) {
  await updateDoc(doc(db, "rewards", rewardId), fields);
}

// ── Delete reward ─────────────────────────────────────────────
export async function deleteReward(rewardId) {
  await deleteDoc(doc(db, "rewards", rewardId));
}

// ── Get a single reward ───────────────────────────────────────
export async function getRewardById(rewardId) {
  const snap = await getDoc(doc(db, "rewards", rewardId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ── Redemption: kid reached goal, parent redeems ─────────────
export async function redeemReward(goalId, kidId, rewardTitle, starsCost) {
  // Deduct stars from wallet
  const walletRef = doc(db, "wallets", kidId);
  const snap      = await getDoc(walletRef);
  const current   = snap.exists() ? (snap.data().stars || 0) : 0;
  const newBal    = Math.max(0, current - starsCost);

  await updateDoc(walletRef, { stars: newBal, lastUpdated: serverTimestamp() });

  // Mark goal as redeemed
  await updateDoc(doc(db, "goals", goalId), {
    status:     "redeemed",
    redeemedAt: serverTimestamp()
  });

  return newBal;
}
