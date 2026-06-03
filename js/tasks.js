// ============================================================
// js/tasks.js — StarKids V10 Sprint 2
// Handles: Create Task · Default Tasks · Submit · Approve · Reject
// ============================================================

import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, doc, updateDoc, setDoc,
  query, where, serverTimestamp, getDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Task status constants ─────────────────────────────────────
export const STATUS = {
  PENDING:   "pending",
  SUBMITTED: "submitted",
  APPROVED:  "approved",
  REJECTED:  "rejected"
};

// ── Default tasks by age group ────────────────────────────────
// These are created automatically when a new kid is added
function getDefaultTasks(age) {
  const all = [
    // Daily habits (all ages)
    { title: "Brush teeth 🦷",        description: "Morning and night — 2 minutes each!", stars: 1, minAge: 3 },
    { title: "Make your bed 🛏",       description: "Straighten the blanket and pillow",   stars: 1, minAge: 4 },
    { title: "Tidy your room 🧹",      description: "Put toys and clothes in their place",  stars: 2, minAge: 4 },
    { title: "Wash your hands 🤲",     description: "Before meals and after the bathroom",  stars: 1, minAge: 3 },
    { title: "Read a book 📚",         description: "Read for at least 15 minutes",         stars: 2, minAge: 5 },
    { title: "Drink 6 glasses of water 💧", description: "Stay hydrated all day!",         stars: 1, minAge: 4 },

    // Home & Family
    { title: "Help set the table 🍽",  description: "Place plates, cups, and utensils",     stars: 1, minAge: 5 },
    { title: "Clear your plate 🧼",    description: "Take your dishes to the kitchen",      stars: 1, minAge: 4 },
    { title: "Help with groceries 🛒", description: "Help carry or put away groceries",     stars: 2, minAge: 6 },
    { title: "Feed the pet 🐾",        description: "Give food and fresh water",            stars: 2, minAge: 5 },

    // Older kids
    { title: "Do homework ✏️",         description: "Finish all school assignments",        stars: 3, minAge: 6 },
    { title: "Practice an instrument 🎵", description: "Practice for at least 20 minutes", stars: 3, minAge: 7 },
    { title: "Exercise 🏃",            description: "30 minutes of physical activity",      stars: 2, minAge: 6 },
    { title: "No screen time before homework 📵", description: "Homework first, screens after!", stars: 2, minAge: 7 },

    // Values
    { title: "Say something kind 💛",  description: "Give someone a genuine compliment",    stars: 1, minAge: 3 },
    { title: "Help a family member ❤️", description: "Do something helpful without being asked", stars: 2, minAge: 5 },
  ];

  // Return tasks appropriate for this age (max 8 to avoid overwhelming)
  return all.filter(t => age >= t.minAge).slice(0, 8);
}

// ── Create default tasks for a new kid ───────────────────────
export async function createDefaultTasks(parentId, kidId, age) {
  const defaults = getDefaultTasks(age);
  const batch    = writeBatch(db);

  defaults.forEach(t => {
    const ref = doc(collection(db, "tasks"));
    batch.set(ref, {
      parentId,
      kidId,
      title:       t.title,
      description: t.description,
      stars:       t.stars,
      status:      STATUS.PENDING,
      isDefault:   true,
      createdAt:   serverTimestamp(),
      submittedAt: null,
      approvedAt:  null
    });
  });

  await batch.commit();
}

// ── Create a single task (parent) ────────────────────────────
export async function createTask(parentId, kidId, title, description = "", stars = 1) {
  const ref = await addDoc(collection(db, "tasks"), {
    parentId,
    kidId,
    title,
    description,
    stars,
    status:      STATUS.PENDING,
    isDefault:   false,
    createdAt:   serverTimestamp(),
    submittedAt: null,
    approvedAt:  null
  });
  return { id: ref.id, parentId, kidId, title, description, stars, status: STATUS.PENDING };
}

// ── Get all tasks for a kid ───────────────────────────────────
export async function getTasksForKid(kidId) {
  const q    = query(
    collection(db, "tasks"),
    where("kidId", "==", kidId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Get pending approvals for parent ─────────────────────────
export async function getPendingApprovals(parentId) {
  const q    = query(
    collection(db, "tasks"),
    where("parentId", "==", parentId),
    where("status", "==", STATUS.SUBMITTED)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Kid marks task as done ────────────────────────────────────
export async function submitTask(taskId) {
  await updateDoc(doc(db, "tasks", taskId), {
    status:      STATUS.SUBMITTED,
    submittedAt: serverTimestamp()
  });
}

// ── Parent approves task → add stars to wallet ────────────────
export async function approveTask(taskId, kidId, stars) {
  await updateDoc(doc(db, "tasks", taskId), {
    status:     STATUS.APPROVED,
    approvedAt: serverTimestamp()
  });
  await addStarsToWallet(kidId, stars);
}

// ── Parent rejects task ───────────────────────────────────────
export async function rejectTask(taskId) {
  await updateDoc(doc(db, "tasks", taskId), {
    status:      STATUS.REJECTED,
    submittedAt: null
  });
}

// ── Wallet: add stars ─────────────────────────────────────────
async function addStarsToWallet(kidId, stars) {
  const walletRef = doc(db, "wallets", kidId);
  const snap      = await getDoc(walletRef);

  if (snap.exists()) {
    await updateDoc(walletRef, {
      stars:       (snap.data().stars || 0) + stars,
      lastUpdated: serverTimestamp()
    });
  } else {
    await setDoc(walletRef, {
      kidId,
      stars,
      lastUpdated: serverTimestamp()
    });
  }
}

// ── Get kid star balance ──────────────────────────────────────
export async function getStarBalance(kidId) {
  const snap = await getDoc(doc(db, "wallets", kidId));
  return snap.exists() ? (snap.data().stars || 0) : 0;
}
