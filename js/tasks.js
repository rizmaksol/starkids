// ============================================================
// js/tasks.js — StarKids V10 Sprint 2
// Handles: Create Task · Get Tasks · Submit · Approve · Reject
// ============================================================

import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, doc, updateDoc,
  query, where, orderBy, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Task status constants ─────────────────────────────────────
export const STATUS = {
  PENDING:   "pending",    // assigned, kid hasn't done it yet
  SUBMITTED: "submitted",  // kid marked done, waiting parent approval
  APPROVED:  "approved",   // parent approved → stars awarded
  REJECTED:  "rejected"    // parent rejected → kid tries again
};

// ── Create a task (parent) ────────────────────────────────────
export async function createTask(parentId, kidId, title, description = "", stars = 1) {
  const ref = await addDoc(collection(db, "tasks"), {
    parentId,
    kidId,
    title,
    description,
    stars,            // how many stars this task is worth
    status: STATUS.PENDING,
    createdAt: serverTimestamp(),
    submittedAt: null,
    approvedAt: null
  });
  return { id: ref.id, parentId, kidId, title, description, stars, status: STATUS.PENDING };
}

// ── Get all tasks for a kid ───────────────────────────────────
export async function getTasksForKid(kidId) {
  const q    = query(
    collection(db, "tasks"),
    where("kidId", "==", kidId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Get all tasks for a parent (all kids) ────────────────────
export async function getTasksForParent(parentId) {
  const q    = query(
    collection(db, "tasks"),
    where("parentId", "==", parentId),
    orderBy("createdAt", "desc")
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
    status: STATUS.SUBMITTED,
    submittedAt: serverTimestamp()
  });
}

// ── Parent approves task → add stars to wallet ────────────────
export async function approveTask(taskId, kidId, stars) {
  await updateDoc(doc(db, "tasks", taskId), {
    status: STATUS.APPROVED,
    approvedAt: serverTimestamp()
  });
  await addStarsToWallet(kidId, stars, taskId);
}

// ── Parent rejects task ───────────────────────────────────────
export async function rejectTask(taskId) {
  await updateDoc(doc(db, "tasks", taskId), {
    status: STATUS.PENDING,   // back to pending so kid can try again
    submittedAt: null
  });
}

// ── Wallet: add stars ─────────────────────────────────────────
async function addStarsToWallet(kidId, stars, taskId) {
  const walletRef = doc(db, "wallets", kidId);
  const snap      = await getDoc(walletRef);

  if (snap.exists()) {
    const current = snap.data().stars || 0;
    await updateDoc(walletRef, {
      stars: current + stars,
      lastUpdated: serverTimestamp()
    });
  } else {
    const { setDoc } = await import(
      "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"
    );
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
