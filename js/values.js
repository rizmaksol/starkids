// ============================================================
// js/values.js — StarKids V10
// Family Values · Multi-Faith Journey · Praise
// ============================================================

import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  query, where, serverTimestamp, getDoc, setDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Default family values (universal) ────────────────────────
export const DEFAULT_VALUES = [
  { name: "Kindness",       emoji: "💛", color: "#FFD93D", description: "Being warm and caring to others" },
  { name: "Honesty",        emoji: "🤝", color: "#6BCB77", description: "Always telling the truth" },
  { name: "Hard Work",      emoji: "💪", color: "#4D96FF", description: "Giving your best effort" },
  { name: "Respect",        emoji: "🌟", color: "#FF6B6B", description: "Treating everyone with dignity" },
  { name: "Gratitude",      emoji: "🙏", color: "#C77DFF", description: "Being thankful for what you have" },
  { name: "Responsibility", emoji: "🎯", color: "#FF9F43", description: "Taking ownership of your actions" },
];

// ── Faith Journey tasks by religion ──────────────────────────
export const FAITH_TASKS_BY_FAITH = {

  muslim: {
    label: "Muslim",
    emoji: "🕌",
    tasks: [
      { title: "Fajr Prayer",         description: "Pray Fajr on time",                   stars: 3, emoji: "🕌" },
      { title: "Dhuhr Prayer",        description: "Pray Dhuhr on time",                  stars: 2, emoji: "🕌" },
      { title: "Asr Prayer",          description: "Pray Asr on time",                    stars: 2, emoji: "🕌" },
      { title: "Maghrib Prayer",      description: "Pray Maghrib on time",                stars: 2, emoji: "🕌" },
      { title: "Isha Prayer",         description: "Pray Isha on time",                   stars: 2, emoji: "🕌" },
      { title: "Read Quran 📖",       description: "Read at least one page of Quran",     stars: 3, emoji: "📖" },
      { title: "Morning Dhikr ☀️",    description: "Say morning adhkar after Fajr",       stars: 2, emoji: "☀️" },
      { title: "Evening Dhikr 🌙",    description: "Say evening adhkar after Asr",        stars: 2, emoji: "🌙" },
      { title: "Learn a Dua 🤲",      description: "Memorise a new dua or meaning",       stars: 3, emoji: "🤲" },
      { title: "Help at the Mosque",  description: "Attend and help at the mosque",       stars: 5, emoji: "🕌" },
    ]
  },

  christian: {
    label: "Christian",
    emoji: "✝️",
    tasks: [
      { title: "Morning Prayer",      description: "Pray in the morning",                 stars: 2, emoji: "🙏" },
      { title: "Evening Prayer",      description: "Pray before bed",                     stars: 2, emoji: "🌙" },
      { title: "Bible Reading 📖",    description: "Read a passage from the Bible",       stars: 3, emoji: "📖" },
      { title: "Church Attendance",   description: "Attend church service",               stars: 5, emoji: "✝️" },
      { title: "Memory Verse",        description: "Memorise a Bible verse",              stars: 3, emoji: "📝" },
      { title: "Gratitude Prayer",    description: "Thank God for 3 things today",        stars: 2, emoji: "💛" },
      { title: "Act of Service",      description: "Do something kind for someone",       stars: 3, emoji: "❤️" },
      { title: "Sunday School",       description: "Attend Sunday school or youth group", stars: 4, emoji: "🏫" },
    ]
  },

  hindu: {
    label: "Hindu",
    emoji: "🪔",
    tasks: [
      { title: "Morning Puja 🪔",     description: "Perform morning puja/prayer",         stars: 3, emoji: "🪔" },
      { title: "Evening Aarti",       description: "Attend or perform evening aarti",     stars: 2, emoji: "🪔" },
      { title: "Meditation 🧘",       description: "Meditate for 10 minutes",             stars: 2, emoji: "🧘" },
      { title: "Scripture Reading",   description: "Read from Bhagavad Gita or Upanishads",stars: 3, emoji: "📖" },
      { title: "Temple Visit",        description: "Visit the temple",                    stars: 5, emoji: "🛕" },
      { title: "Shloka Learning",     description: "Learn or recite a shloka",            stars: 3, emoji: "🎵" },
      { title: "Gratitude Practice",  description: "Count and express 3 blessings",       stars: 2, emoji: "🙏" },
      { title: "Act of Seva",         description: "Do selfless service for others",      stars: 4, emoji: "💛" },
    ]
  },

  jewish: {
    label: "Jewish",
    emoji: "✡️",
    tasks: [
      { title: "Morning Prayers",     description: "Recite Shacharit (morning prayers)",  stars: 3, emoji: "🙏" },
      { title: "Torah Study 📖",      description: "Study a portion of Torah",            stars: 3, emoji: "📖" },
      { title: "Shabbat Observance",  description: "Observe Shabbat with family",         stars: 5, emoji: "✡️" },
      { title: "Synagogue Attendance",description: "Attend synagogue service",            stars: 5, emoji: "🕍" },
      { title: "Tzedakah",            description: "Give to charity or help someone",     stars: 3, emoji: "💛" },
      { title: "Hebrew Study",        description: "Practise reading Hebrew",             stars: 3, emoji: "🔤" },
      { title: "Mitzvah of the Day",  description: "Perform a good deed (mitzvah)",      stars: 2, emoji: "⭐" },
      { title: "Evening Prayers",     description: "Recite Maariv (evening prayers)",    stars: 2, emoji: "🌙" },
    ]
  },

  christian_orthodox: {
    label: "Orthodox Christian",
    emoji: "☦️",
    tasks: [
      { title: "Morning Prayers",     description: "Read morning prayers from prayer book", stars: 3, emoji: "🙏" },
      { title: "Evening Prayers",     description: "Read evening prayers before bed",     stars: 2, emoji: "🌙" },
      { title: "Bible Reading 📖",    description: "Read a chapter of the Bible",         stars: 3, emoji: "📖" },
      { title: "Divine Liturgy",      description: "Attend the Divine Liturgy",           stars: 5, emoji: "☦️" },
      { title: "Fasting Day",         description: "Observe the fasting tradition",       stars: 4, emoji: "🌿" },
      { title: "Act of Mercy",        description: "Help someone in need",                stars: 3, emoji: "❤️" },
    ]
  },

  buddhist: {
    label: "Buddhist",
    emoji: "☸️",
    tasks: [
      { title: "Morning Meditation 🧘",description: "Meditate for 10-15 minutes",         stars: 3, emoji: "🧘" },
      { title: "Evening Meditation",  description: "Quiet reflection before bed",         stars: 2, emoji: "🌙" },
      { title: "Dharma Study 📖",     description: "Read Buddhist teachings or sutras",   stars: 3, emoji: "📖" },
      { title: "Act of Kindness",     description: "Do something kind without expecting anything", stars: 2, emoji: "💛" },
      { title: "Mindful Breathing",   description: "Practice mindful breathing for 5 mins", stars: 2, emoji: "🌬️" },
      { title: "Temple Visit",        description: "Visit a temple or meditation center", stars: 5, emoji: "☸️" },
      { title: "Gratitude Reflection",description: "Write or say 3 things you are grateful for", stars: 2, emoji: "🙏" },
      { title: "No Harm Day",         description: "Go through the day without harming any creature", stars: 3, emoji: "🕊️" },
    ]
  },

  sikh: {
    label: "Sikh",
    emoji: "🪯",
    tasks: [
      { title: "Nitnem - Amrit Vela", description: "Recite morning prayers at Amrit Vela", stars: 4, emoji: "🌅" },
      { title: "Japji Sahib",         description: "Recite Japji Sahib",                  stars: 3, emoji: "📖" },
      { title: "Rehras Sahib",        description: "Recite evening prayers",              stars: 2, emoji: "🌙" },
      { title: "Kirtan Sohila",       description: "Recite bedtime prayers",              stars: 2, emoji: "🎵" },
      { title: "Gurdwara Seva",       description: "Serve at the Gurdwara",              stars: 5, emoji: "🪯" },
      { title: "Sewa (Selfless Service)", description: "Do something helpful for others", stars: 3, emoji: "💛" },
      { title: "Gurbani Reading 📖",  description: "Read from Sri Guru Granth Sahib",    stars: 3, emoji: "📖" },
      { title: "Simran",              description: "Meditate on Waheguru's name",         stars: 3, emoji: "🧘" },
    ]
  },

  nonreligious: {
    label: "Non-Religious / Mindfulness",
    emoji: "🌿",
    tasks: [
      { title: "Morning Reflection",  description: "5 minutes of quiet thinking to start the day", stars: 2, emoji: "☀️" },
      { title: "Gratitude Journal",   description: "Write 3 things you're grateful for", stars: 2, emoji: "📓" },
      { title: "Mindfulness Moment",  description: "5 minutes of mindful breathing",     stars: 2, emoji: "🌬️" },
      { title: "Act of Kindness",     description: "Do something kind for someone today", stars: 3, emoji: "💛" },
      { title: "Evening Reflection",  description: "Think about what went well today",   stars: 2, emoji: "🌙" },
      { title: "Nature Time 🌿",      description: "Spend 15 minutes in nature",         stars: 2, emoji: "🌿" },
      { title: "Read Something Good", description: "Read something inspiring or educational", stars: 2, emoji: "📖" },
      { title: "Digital Detox Hour",  description: "One hour without screens",           stars: 3, emoji: "📵" },
    ]
  },

  custom: {
    label: "Custom",
    emoji: "✨",
    tasks: []  // Parent adds their own
  }
};

// ── Get faith display label ───────────────────────────────────
export function getFaithLabel(faithKey) {
  return FAITH_TASKS_BY_FAITH[faithKey]?.label || "Faith Journey";
}

export function getFaithEmoji(faithKey) {
  return FAITH_TASKS_BY_FAITH[faithKey]?.emoji || "🙏";
}

export function getFaithTasks(faithKey) {
  return FAITH_TASKS_BY_FAITH[faithKey]?.tasks || [];
}

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

export async function deleteFamilyValue(valueId) {
  await deleteDoc(doc(db, "values", valueId));
}

export async function updateFamilyValue(valueId, fields) {
  await updateDoc(doc(db, "values", valueId), fields);
}

// ── Get values progress for a kid ────────────────────────────
export async function getValuesProgress(kidId, familyValues) {
  const q    = query(collection(db, "tasks"), where("kidId", "==", kidId), where("status", "==", "approved"));
  const snap = await getDocs(q);
  const tasks = snap.docs.map(d => d.data());
  const progress = {};
  familyValues.forEach(v => { progress[v.id] = 0; });
  tasks.forEach(t => { if (t.valueId && progress[t.valueId] !== undefined) progress[t.valueId]++; });
  return progress;
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

// ── Praise ────────────────────────────────────────────────────
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

// ── DEFAULT_FAITH_TASKS kept for backward compat ─────────────
export const DEFAULT_FAITH_TASKS = FAITH_TASKS_BY_FAITH.muslim.tasks;
