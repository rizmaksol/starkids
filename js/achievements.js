// ============================================================
// js/achievements.js — StarKids V10 Sprint 8
// Achievement milestones, badges, weekly report
// ============================================================

import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, doc, setDoc, getDoc,
  query, where, serverTimestamp, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Achievement definitions ───────────────────────────────────
export const ACHIEVEMENTS = [
  // Tasks
  { id: "first_task",      title: "First Step!",       desc: "Completed your very first task",      emoji: "👟", color: "#4D96FF" },
  { id: "task_5",          title: "Getting Started",   desc: "Completed 5 tasks",                   emoji: "🌱", color: "#6BCB77" },
  { id: "task_25",         title: "On a Roll!",        desc: "Completed 25 tasks",                  emoji: "🔥", color: "#FF9F43" },
  { id: "task_50",         title: "Hard Worker",       desc: "Completed 50 tasks",                  emoji: "💪", color: "#FF6B6B" },
  { id: "task_100",        title: "Champion!",         desc: "Completed 100 tasks",                 emoji: "🏆", color: "#FFD93D" },
  // Streaks
  { id: "streak_3",        title: "3-Day Streak",      desc: "Completed a task 3 days in a row",    emoji: "⚡", color: "#C77DFF" },
  { id: "streak_7",        title: "Week Warrior!",     desc: "Completed a task 7 days in a row",    emoji: "🌟", color: "#FFD93D" },
  { id: "streak_30",       title: "Habit Master!",     desc: "Completed a task 30 days in a row",   emoji: "👑", color: "#FF9F43" },
  // Goals & rewards
  { id: "first_goal",      title: "Dream Big!",        desc: "Set your first savings goal",         emoji: "🎯", color: "#4D96FF" },
  { id: "first_reward",    title: "Goal Getter!",      desc: "Redeemed your first reward",          emoji: "🎁", color: "#FF6B6B" },
  { id: "goal_3",          title: "Saver!",            desc: "Completed 3 savings goals",           emoji: "💰", color: "#6BCB77" },
  // Stars
  { id: "stars_10",        title: "First Earnings",    desc: "Earned 10 stars",                     emoji: "⭐", color: "#FFD93D" },
  { id: "stars_50",        title: "Star Collector",    desc: "Earned 50 stars total",               emoji: "🌠", color: "#C77DFF" },
  { id: "stars_100",       title: "Star Legend!",      desc: "Earned 100 stars total",              emoji: "💫", color: "#FF9F43" },
  // Faith
  { id: "first_prayer",    title: "First Prayer ✅",   desc: "Completed your first prayer task",    emoji: "🕌", color: "#1a936f" },
  { id: "prayers_7",       title: "Devoted",           desc: "Completed 7 prayer tasks",            emoji: "🤲", color: "#1a936f" },
  // Values
  { id: "first_value",     title: "Value Builder",     desc: "Completed a task tagged to a value",  emoji: "❤️", color: "#FF6B6B" },
  { id: "all_values",      title: "Full Character",    desc: "Completed tasks for every family value", emoji: "🌈", color: "#4D96FF" },
  // Jobs
  { id: "first_job",       title: "Entrepreneur!",     desc: "Completed your first entrepreneur job", emoji: "💼", color: "#FF9F43" },
  { id: "jobs_5",          title: "Go-Getter",         desc: "Completed 5 entrepreneur jobs",       emoji: "🚀", color: "#C77DFF" },
];

// ── Get earned achievements for a kid ─────────────────────────
export async function getAchievements(kidId) {
  const q    = query(collection(db, "achievements"), where("kidId", "==", kidId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Award an achievement ──────────────────────────────────────
export async function awardAchievement(kidId, achievementId) {
  // Check if already awarded
  const existing = await getAchievements(kidId);
  if (existing.find(a => a.achievementId === achievementId)) return null;

  const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
  if (!achievement) return null;

  await addDoc(collection(db, "achievements"), {
    kidId,
    achievementId,
    title:     achievement.title,
    desc:      achievement.desc,
    emoji:     achievement.emoji,
    color:     achievement.color,
    earnedAt:  serverTimestamp()
  });

  return achievement;
}

// ── Check and award achievements based on kid stats ──────────
export async function checkAchievements(kidId, stats) {
  const newlyEarned = [];

  const checks = [
    { id: "first_task",   condition: stats.totalTasks >= 1   },
    { id: "task_5",       condition: stats.totalTasks >= 5   },
    { id: "task_25",      condition: stats.totalTasks >= 25  },
    { id: "task_50",      condition: stats.totalTasks >= 50  },
    { id: "task_100",     condition: stats.totalTasks >= 100 },
    { id: "streak_3",     condition: stats.maxStreak >= 3    },
    { id: "streak_7",     condition: stats.maxStreak >= 7    },
    { id: "streak_30",    condition: stats.maxStreak >= 30   },
    { id: "first_goal",   condition: stats.totalGoals >= 1   },
    { id: "first_reward", condition: stats.totalRedeemed >= 1},
    { id: "goal_3",       condition: stats.totalRedeemed >= 3},
    { id: "stars_10",     condition: stats.totalStars >= 10  },
    { id: "stars_50",     condition: stats.totalStars >= 50  },
    { id: "stars_100",    condition: stats.totalStars >= 100 },
    { id: "first_prayer", condition: stats.faithTasks >= 1   },
    { id: "prayers_7",    condition: stats.faithTasks >= 7   },
    { id: "first_value",  condition: stats.valueTasks >= 1   },
    { id: "all_values",   condition: stats.allValuesLived    },
    { id: "first_job",    condition: stats.jobsDone >= 1     },
    { id: "jobs_5",       condition: stats.jobsDone >= 5     },
  ];

  for (const check of checks) {
    if (check.condition) {
      const awarded = await awardAchievement(kidId, check.id);
      if (awarded) newlyEarned.push(awarded);
    }
  }

  return newlyEarned;
}

// ── Get kid stats for achievement checking ────────────────────
export async function getKidStats(kidId, familyValues) {
  const tasksSnap = await getDocs(query(
    collection(db, "tasks"),
    where("kidId", "==", kidId),
    where("status", "==", "approved")
  ));
  const tasks = tasksSnap.docs.map(d => d.data());

  const goalsSnap = await getDocs(query(
    collection(db, "goals"), where("kidId", "==", kidId)
  ));
  const goals = goalsSnap.docs.map(d => d.data());

  const walletSnap = await getDoc(doc(db, "wallets", kidId));
  const totalStars = walletSnap.exists() ? (walletSnap.data().stars || 0) : 0;

  const maxStreak    = tasks.length ? Math.max(...tasks.map(t => t.streak || 0), 0) : 0;
  const faithTasks   = tasks.filter(t => t.isFaith).length;
  const jobsDone     = tasks.filter(t => t.isEntrepreneur).length;
  const valueTasks   = tasks.filter(t => t.valueId).length;
  const totalRedeemed= goals.filter(g => g.status === "redeemed").length;
  const totalGoals   = goals.length;

  // Check if all values have at least one task
  let allValuesLived = false;
  if (familyValues && familyValues.length > 0) {
    const valuedTaskIds = new Set(tasks.filter(t => t.valueId).map(t => t.valueId));
    allValuesLived = familyValues.every(v => valuedTaskIds.has(v.id));
  }

  return {
    totalTasks: tasks.length,
    maxStreak,
    totalStars,
    faithTasks,
    jobsDone,
    valueTasks,
    totalGoals,
    totalRedeemed,
    allValuesLived
  };
}

// ── Weekly report for parent ──────────────────────────────────
export async function getWeeklyReport(kidId) {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const tasksSnap = await getDocs(query(
    collection(db, "tasks"), where("kidId", "==", kidId)
  ));
  const allTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const weekTasks = allTasks.filter(t => {
    if (!t.approvedAt) return false;
    const d = t.approvedAt.toDate ? t.approvedAt.toDate() : new Date(t.approvedAt);
    return d >= oneWeekAgo;
  });

  const walletSnap = await getDoc(doc(db, "wallets", kidId));
  const totalStars = walletSnap.exists() ? (walletSnap.data().stars || 0) : 0;

  // ── Include Rush stars earned this week ───────────────────
  let rushStarsWeek = 0;
  let rushTasksWeek = 0;
  try {
    const rushSnap = await getDocs(query(
      collection(db, "activeRush"),
      where("kidIds", "array-contains", kidId)
    ));
    rushSnap.docs.forEach(d => {
      const rush = d.data();
      const prog = rush.progress?.[kidId] || {};
      Object.values(prog).forEach(p => {
        if (!p.done || !p.doneAtMs) return;
        if (p.doneAtMs >= oneWeekAgo.getTime()) {
          rushStarsWeek += (p.stars || 0);
          rushTasksWeek++;
        }
      });
    });
  } catch(e) {}

  const starsThisWeek  = weekTasks.reduce((sum,t)=>sum+(t.stars||0),0) + rushStarsWeek;
  const tasksCompleted = weekTasks.length + rushTasksWeek;
  const pendingTasks   = allTasks.filter(t => t.status === "submitted").length;
  const faithThisWeek  = weekTasks.filter(t => t.isFaith).length;
  const jobsThisWeek   = weekTasks.filter(t => t.isEntrepreneur).length;

  return {
    tasksCompleted,
    starsEarned:  starsThisWeek,
    totalStars,
    pendingTasks,
    faithTasks:   faithThisWeek,
    jobsDone:     jobsThisWeek,
    topTask:      weekTasks.sort((a,b)=>(b.stars||0)-(a.stars||0))[0]?.title || null
  };
}
