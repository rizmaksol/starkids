// ============================================================
// js/finance.js — StarKids V10 Sprint 6
// Star-to-Money conversion · Entrepreneur Jobs · Wallet detail
// ============================================================

import { db } from "./firebase.js";
import {
  doc, getDoc, setDoc, updateDoc, collection,
  addDoc, getDocs, query, where, serverTimestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Default conversion rate: 1 star = 0.10 SAR ───────────────
export const DEFAULT_RATE = 0.10;
export const DEFAULT_CURRENCY = "SAR";

// ── Get parent's financial settings ──────────────────────────
export async function getFinanceSettings(parentId) {
  const snap = await getDoc(doc(db, "parents", parentId));
  if (!snap.exists()) return { rate: DEFAULT_RATE, currency: DEFAULT_CURRENCY };
  const d = snap.data();
  return {
    rate:     d.starRate     || DEFAULT_RATE,
    currency: d.currency     || DEFAULT_CURRENCY,
    symbol:   d.currencySymbol || "﷼"
  };
}

// ── Save parent's financial settings ─────────────────────────
export async function saveFinanceSettings(parentId, rate, currency, symbol) {
  await updateDoc(doc(db, "parents", parentId), {
    starRate:       parseFloat(rate),
    currency,
    currencySymbol: symbol
  });
}

// ── Convert stars to money string ─────────────────────────────
export function starsToMoney(stars, settings) {
  const amount = (stars * (settings.rate || DEFAULT_RATE)).toFixed(2);
  return `${settings.symbol || "﷼"} ${amount}`;
}

// ── Default entrepreneur jobs ────────────────────────────────
export const DEFAULT_JOBS = [
  { title: "Wash the car 🚗",         desc: "Full wash inside and out",             stars: 20, emoji: "🚗" },
  { title: "Mow the lawn 🌿",         desc: "Cut and tidy the whole garden",         stars: 25, emoji: "🌿" },
  { title: "Cook a meal 👨‍🍳",          desc: "Prepare lunch or dinner for the family", stars: 30, emoji: "👨‍🍳" },
  { title: "Organise the pantry 🥫",  desc: "Sort and tidy all the kitchen shelves",  stars: 20, emoji: "🥫" },
  { title: "Clean all windows 🪟",    desc: "Wipe every window inside the house",     stars: 25, emoji: "🪟" },
  { title: "Help with a work task 💼",desc: "Ask a parent what you can help with",    stars: 35, emoji: "💼" },
  { title: "Teach a sibling 📖",      desc: "Help a brother or sister with homework", stars: 20, emoji: "📖" },
  { title: "Start a mini business 💡",desc: "Sell something or offer a service",      stars: 50, emoji: "💡" },
];

// ── Get entrepreneur jobs for a parent ───────────────────────
export async function getEntrepreneurJobs(parentId) {
  const q    = query(collection(db, "jobs"), where("parentId", "==", parentId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Seed default jobs (once per parent) ──────────────────────
export async function seedDefaultJobs(parentId) {
  const existing = await getEntrepreneurJobs(parentId);
  if (existing.length > 0) return;
  for (const j of DEFAULT_JOBS) {
    await addDoc(collection(db, "jobs"), {
      parentId, title: j.title, description: j.desc,
      stars: j.stars, emoji: j.emoji,
      available: true, createdAt: serverTimestamp()
    });
  }
}

// ── Create a custom job ───────────────────────────────────────
export async function createJob(parentId, title, description, stars, emoji = "💼") {
  const ref = await addDoc(collection(db, "jobs"), {
    parentId, title, description, stars, emoji,
    available: true, createdAt: serverTimestamp()
  });
  return { id: ref.id, parentId, title, description, stars, emoji, available: true };
}

// ── Delete a job ──────────────────────────────────────────────
export async function deleteJob(jobId) {
  await deleteDoc(doc(db, "jobs", jobId));
}

// ── Update a job ──────────────────────────────────────────────
export async function updateJob(jobId, fields) {
  await updateDoc(doc(db, "jobs", jobId), fields);
}

// ── Kid claims a job → creates a task ────────────────────────
// Returns the created task id
export async function claimJob(parentId, kidId, job) {
  const { addDoc: add, collection: col, serverTimestamp: sts } = await import(
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"
  );
  const ref = await addDoc(collection(db, "tasks"), {
    parentId, kidId,
    title:         `💼 ${job.title}`,
    description:   job.description,
    stars:         job.stars,
    taskType:      "onetime",
    status:        "pending",
    isEntrepreneur: true,
    jobId:         job.id,
    streak:        0,
    lastResetDate: null,
    createdAt:     serverTimestamp(),
    submittedAt:   null,
    approvedAt:    null
  });
  return ref.id;
}
