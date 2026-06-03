// ============================================================
// js/values.js — StarKids V10 Sprint 7
// Family Values · Faith Tasks · Values Progress · Praise
// ============================================================

import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  query, where, serverTimestamp, getDoc, setDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Default family values ─────────────────────────────────────
export const DEFAULT_VALUES = [
  { name: "Kindness",      emoji: "💛", color: "#FFD93D", description: "Being warm and caring to others" },
  { name: "Honesty",       emoji: "🤝", color: "#6BCB77", description: "Always telling the truth" },
  { name: "Hard Work",     emoji: "💪", color: "#4D96FF", description: "Giving your best effort" },
  { name: "Respect",       emoji: "🌟", color: "#FF6B6B", description: "Treating everyone with dignity" },
  { name: "Gratitude",     emoji: "🙏", color: "#C77DFF", description: "Being thankful for what you have" },
  { name: "Responsibility",emoji: "🎯", color: "#FF9F43", description: "Taking ownership of your actions" },
];

// ── Default faith tasks ───────────────────────────────────────
export const DEFAULT_FAITH_TASKS = [
  { title: "Fajr Prayer 🕌",     description: "Pray Fajr on time",                    stars: 3, emoji: "🕌" },
  { title: "Dhuhr Prayer 🕌",    description: "Pray Dhuhr on time",                   stars: 2, emoji: "🕌" },
  { title: "Asr Prayer 🕌",      description: "Pray Asr on time",                     stars: 2, emoji: "🕌" },
  { title: "Maghrib Prayer 🕌",  description: "Pray Maghrib on time",                 stars: 2, emoji: "🕌" },
  { title: "Isha Prayer 🕌",     description: "Pray Isha on time",                    stars: 2, emoji: "🕌" },
  { title: "Read Quran 📖",      description: "Read at least one page of Quran",      stars: 3, emoji: "📖" },
  { title: "Morning Dhikr ☀️",   description: "Say morning adhkar after Fajr",        stars: 2, emoji: "☀️" },
  { title: "Evening Dhikr 🌙",   description: "Say evening adhkar after Asr",         stars: 2, emoji: "🌙" },
  { title: "Learn a Dua 🤲",     description: "Memorise a new dua or its meaning",    stars: 3, emoji: "🤲" },
  { title: "Help at the Mosque 🕌", description: "Attend and help at the mosque",     stars: 5, emoji: "🕌" },
];

// ── Get family values for a parent ───────────────────────────
export async function getFamilyValues(parentId) {
  const q    = query(collection(db, "values"), where("parentId", "==", parentId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Seed default values (once per parent) ────────────────────
export async function seedDefaultValues(parentId) {
  const existing = await getFamilyValues(parentId);
  if (existing.length > 0) return existing;
  const batch = writeBatch(db);
  DEFAULT_VALUES.forEach(v => {
    batch.set(doc(collection(db, "values")), {
      parentId, name: v.name, emoji: v.emoji,
      color: v.color, description: v.description,
      active: true, createdAt: serverTimestamp()
    });
  });
  await batch.commit();
  return await getFamilyValues(parentId);
}

// ── Add a custom value ────────────────────────────────────────
export async function addFamilyValue(parentId, name, emoji, color, description) {
  const ref = await addDoc(collection(db, "values"), {
    parentId, name, emoji, color, description,
    active: true, createdAt: serverTimestamp()
  });
  return { id: ref.id, parentId, name, emoji, color, description, active: true };
}

// ── Delete a value ────────────────────────────────────────────
export async function deleteFamilyValue(valueId) {
  await deleteDoc(doc(db, "values", valueId));
}

// ── Update a value ────────────────────────────────────────────
export async function updateFamilyValue(valueId, fields) {
  await updateDoc(doc(db, "values", valueId), fields);
}

// ── Get values progress for a kid ────────────────────────────
// Returns how many approved tasks are tagged to each value
export async function getValuesProgress(kidId, familyValues) {
  const q    = query(
    collection(db, "tasks"),
    where("kidId", "==", kidId),
    where("status", "==", "approved")
  );
  const snap = await getDocs(q);
  const tasks = snap.docs.map(d => d.data());

  const progress = {};
  familyValues.forEach(v => { progress[v.id] = 0; });
  tasks.forEach(t => {
    if (t.valueId && progress[t.valueId] !== undefined) {
      progress[t.valueId]++;
    }
  });
  return progress;
}

// ── Praise system ─────────────────────────────────────────────
export async function sendPraise(parentId, kidId, message, valueId = null, emoji = "💛") {
  const ref = await addDoc(collection(db, "praise"), {
    parentId, kidId, message, valueId, emoji,
    read: false, createdAt: serverTimestamp()
  });
  return { id: ref.id, parentId, kidId, message, valueId, emoji, read: false };
}

export async function getPraiseForKid(kidId) {
  const q    = query(collection(db, "praise"), where("kidId", "==", kidId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function markPraiseRead(praiseId) {
  await updateDoc(doc(db, "praise", praiseId), { read: true });
}

// ── Get faith tasks for a parent ──────────────────────────────
export async function getFaithTasks(parentId) {
  const q    = query(
    collection(db, "tasks"),
    where("parentId", "==", parentId),
    where("isFaith", "==", true)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Add faith tasks for a kid ─────────────────────────────────
export async function addFaithTasksForKid(parentId, kidId, selectedTasks) {
  const batch = writeBatch(db);
  selectedTasks.forEach(t => {
    batch.set(doc(collection(db, "tasks")), {
      parentId, kidId,
      title:       t.title,
      description: t.description,
      stars:       t.stars,
      taskType:    "daily",
      status:      "pending",
      isFaith:     true,
      isDefault:   false,
      streak:      0,
      lastResetDate: new Date().toISOString().slice(0, 10),
      createdAt:   serverTimestamp(),
      submittedAt: null,
      approvedAt:  null
    });
  });
  await batch.commit();
}
