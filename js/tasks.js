// ============================================================
// js/tasks.js — StarKids V10 Sprint 5
// New: taskType (daily/weekly/onetime) · streak tracking · reset
// ============================================================

import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, doc, updateDoc, setDoc,
  query, where, serverTimestamp, getDoc, writeBatch, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Constants ─────────────────────────────────────────────────
export const STATUS = {
  PENDING:   "pending",
  SUBMITTED: "submitted",
  APPROVED:  "approved",
  REJECTED:  "rejected"
};

export const TASK_TYPE = {
  DAILY:   "daily",    // resets every day
  WEEKLY:  "weekly",   // resets every Monday
  ONETIME: "onetime"   // never resets
};

// ── Today's date string YYYY-MM-DD ────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ── Start of current week (Monday) ───────────────────────────
function weekStartStr() {
  const d   = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// ── Should this task be reset? ────────────────────────────────
function needsReset(task) {
  if (task.status === STATUS.PENDING || task.status === STATUS.SUBMITTED) return false;
  if (task.taskType === TASK_TYPE.DAILY) {
    return (task.lastResetDate || "") < todayStr();
  }
  if (task.taskType === TASK_TYPE.WEEKLY) {
    return (task.lastResetDate || "") < weekStartStr();
  }
  return false; // onetime never resets
}

// ── Reset overdue recurring tasks ────────────────────────────
export async function resetRecurringTasks(kidId) {
  const tasks = await getTasksForKid(kidId);
  const batch = writeBatch(db);
  let   count = 0;

  tasks.forEach(t => {
    if (needsReset(t)) {
      batch.update(doc(db, "tasks", t.id), {
        status:        STATUS.PENDING,
        submittedAt:   null,
        approvedAt:    null,
        lastResetDate: t.taskType === TASK_TYPE.DAILY ? todayStr() : weekStartStr()
      });
      count++;
    }
  });

  if (count > 0) await batch.commit();
  return count;
}

// ── Default tasks ─────────────────────────────────────────────
function getDefaultTasks(age) {
  const all = [
    // Daily
    { title: "Brush teeth 🦷",            desc: "Morning and night — 2 minutes each!", stars: 1, minAge: 3, type: TASK_TYPE.DAILY   },
    { title: "Make your bed 🛏",           desc: "Straighten the blanket and pillow",   stars: 1, minAge: 4, type: TASK_TYPE.DAILY   },
    { title: "Tidy your room 🧹",          desc: "Put toys and clothes in their place",  stars: 2, minAge: 4, type: TASK_TYPE.DAILY   },
    { title: "Wash your hands 🤲",         desc: "Before meals and after bathroom",      stars: 1, minAge: 3, type: TASK_TYPE.DAILY   },
    { title: "Drink 6 glasses of water 💧",desc: "Stay hydrated all day!",              stars: 1, minAge: 4, type: TASK_TYPE.DAILY   },
    { title: "Say something kind 💛",      desc: "Give someone a genuine compliment",    stars: 1, minAge: 3, type: TASK_TYPE.DAILY   },
    // Daily (older)
    { title: "Do homework ✏️",             desc: "Finish all school assignments",        stars: 3, minAge: 6, type: TASK_TYPE.DAILY   },
    { title: "Read a book 📚",             desc: "Read for at least 15 minutes",         stars: 2, minAge: 5, type: TASK_TYPE.DAILY   },
    { title: "Exercise 🏃",               desc: "30 minutes of physical activity",      stars: 2, minAge: 6, type: TASK_TYPE.DAILY   },
    // Weekly
    { title: "Help with groceries 🛒",    desc: "Help carry or put away groceries",     stars: 3, minAge: 6, type: TASK_TYPE.WEEKLY  },
    { title: "Clean the bathroom 🚿",     desc: "Wipe the sink, mirror, and floor",     stars: 3, minAge: 8, type: TASK_TYPE.WEEKLY  },
    { title: "Help with laundry 👕",      desc: "Sort, fold, or put away clothes",      stars: 3, minAge: 7, type: TASK_TYPE.WEEKLY  },
    { title: "Help a family member ❤️",   desc: "Do something helpful without being asked", stars: 2, minAge: 5, type: TASK_TYPE.WEEKLY },
    // One-time
    { title: "Set up my study space 📖",  desc: "Organise your desk for the week",      stars: 5, minAge: 6, type: TASK_TYPE.ONETIME },
  ];
  return all.filter(t => age >= t.minAge).slice(0, 10);
}

export async function createDefaultTasks(parentId, kidId, age) {
  const defaults = getDefaultTasks(age);
  const batch    = writeBatch(db);
  defaults.forEach(t => {
    batch.set(doc(collection(db, "tasks")), {
      parentId, kidId,
      title:         t.title,
      description:   t.desc,
      stars:         t.stars,
      taskType:      t.type,
      status:        STATUS.PENDING,
      isDefault:     true,
      streak:        0,
      lastResetDate: t.type === TASK_TYPE.DAILY ? todayStr() : (t.type === TASK_TYPE.WEEKLY ? weekStartStr() : null),
      createdAt:     serverTimestamp(),
      submittedAt:   null,
      approvedAt:    null
    });
  });
  await batch.commit();
}

// ── Create a task ─────────────────────────────────────────────
export async function createTask(parentId, kidId, title, description = "", stars = 1, taskType = TASK_TYPE.DAILY, valueId = null) {
  const ref = await addDoc(collection(db, "tasks"), {
    parentId, kidId, title, description, stars,
    taskType,
    valueId:       valueId || null,
    status:        STATUS.PENDING,
    isDefault:     false,
    isFaith:       false,
    streak:        0,
    lastResetDate: taskType === TASK_TYPE.DAILY ? todayStr() : (taskType === TASK_TYPE.WEEKLY ? weekStartStr() : null),
    createdAt:     serverTimestamp(),
    submittedAt:   null,
    approvedAt:    null
  });
  return { id: ref.id, parentId, kidId, title, description, stars, taskType, status: STATUS.PENDING };
}

// ── Get tasks for kid ─────────────────────────────────────────
export async function getTasksForKid(kidId) {
  const q    = query(collection(db, "tasks"), where("kidId", "==", kidId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Get pending approvals ─────────────────────────────────────
export async function getPendingApprovals(parentId) {
  const q    = query(collection(db, "tasks"), where("parentId", "==", parentId), where("status", "==", STATUS.SUBMITTED));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Submit task ───────────────────────────────────────────────
export async function submitTask(taskId) {
  await updateDoc(doc(db, "tasks", taskId), {
    status: STATUS.SUBMITTED, submittedAt: serverTimestamp()
  });
}

// ── Approve task → stars + streak ────────────────────────────
export async function approveTask(taskId, kidId, stars, currentStreak = 0) {
  const newStreak = (currentStreak || 0) + 1;
  await updateDoc(doc(db, "tasks", taskId), {
    status:     STATUS.APPROVED,
    approvedAt: serverTimestamp(),
    streak:     newStreak
  });
  await addStarsToWallet(kidId, stars);

  // Streak bonus: every 7 completions → +2 bonus stars
  if (newStreak % 7 === 0) {
    await addStarsToWallet(kidId, 2);
    return { streakBonus: true, streak: newStreak };
  }
  return { streakBonus: false, streak: newStreak };
}

// ── Reject task ───────────────────────────────────────────────
export async function rejectTask(taskId) {
  await updateDoc(doc(db, "tasks", taskId), {
    status: STATUS.REJECTED, submittedAt: null
  });
}

// ── Delete task ───────────────────────────────────────────────
export async function deleteTask(taskId) {
  await deleteDoc(doc(db, "tasks", taskId));
}

// ── Wallet ────────────────────────────────────────────────────
async function addStarsToWallet(kidId, stars) {
  const ref  = doc(db, "wallets", kidId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { stars: (snap.data().stars||0) + stars, lastUpdated: serverTimestamp() });
  } else {
    await setDoc(ref, { kidId, stars, lastUpdated: serverTimestamp() });
  }
}

export async function getStarBalance(kidId) {
  const snap = await getDoc(doc(db, "wallets", kidId));
  return snap.exists() ? (snap.data().stars || 0) : 0;
}

// ── Reject task with reason ───────────────────────────────────
export async function rejectTaskWithReason(taskId, reason, photoURL = null) {
  await updateDoc(doc(db, "tasks", taskId), {
    status:         STATUS.REJECTED,
    submittedAt:    null,
    rejectionReason: reason || null,
    rejectionPhoto:  photoURL || null,
    rejectedAt:     serverTimestamp()
  });
}

// ── Upload task submission photo ──────────────────────────────
// uploadTaskPhoto kept for API compat — base64 now handled in app.js
// This function is no longer called directly
export async function uploadTaskPhoto(kidId, taskId, file) {
  return null; // base64 handled before calling submitTaskWithPhoto
}

// ── Submit task with optional photo ──────────────────────────
export async function submitTaskWithPhoto(taskId, photoURL = null) {
  await updateDoc(doc(db, "tasks", taskId), {
    status:           STATUS.SUBMITTED,
    submittedAt:      serverTimestamp(),
    submissionPhoto:  photoURL || null
  });
}
