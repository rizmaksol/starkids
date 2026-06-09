// ============================================================
// js/app.js — StarKids V10  Sprint 1+2+3+4+5+6
// ============================================================

import { db } from "./firebase.js?v=12";
import { fetchPrayerTimes, getNextPrayer, formatPrayerTime, startPrayerAlerts, stopPrayerAlerts, savePrayerCity, getPrayerCity } from "./prayer.js?v=12";
import { signUpParent, loginParent, logoutParent, getParentProfile, updateParentProfile, onAuthChange } from "./auth.js?v=12";
import { addKid, getKidsByParent, deleteKid, regenerateKidCode, loginKidByCode, uploadKidPhoto, updateKidPhoto } from "./kid.js?v=12";
import { createTask, createDefaultTasks, getTasksForKid, getPendingApprovals, getPendingApprovalsByKids, submitTask, submitTaskWithPhoto, uploadTaskPhoto, approveTask, rejectTask, rejectTaskWithReason, getStarBalance, resetRecurringTasks, STATUS, TASK_TYPE } from "./tasks.js?v=13";
import { createGoalFromReward, getGoalsForKid, deleteGoal, checkGoalCompletion, addBonusStars, GOAL_STATUS } from "./goals.js?v=12";
import { getRewardsForParent, createReward, updateReward, deleteReward, seedDefaultRewards, requestRedemption, approveRedemption, rejectRedemption } from "./rewards.js?v=12";
import { getFinanceSettings, saveFinanceSettings, starsToMoney, getEntrepreneurJobs, seedDefaultJobs, createJob, deleteJob, claimJob } from "./finance.js?v=12";
import { getFamilyValues, seedDefaultValues, addFamilyValue, deleteFamilyValue, updateFamilyValue, getValuesProgress, sendPraise, getPraiseForKid, markPraiseRead, addFaithTasksForKid, getFaithTasks, getFaithLabel, getFaithEmoji, DEFAULT_FAITH_TASKS } from "./values.js?v=12";
import { ACHIEVEMENTS, getAchievements, checkAchievements, getKidStats, getWeeklyReport } from "./achievements.js?v=12";

// ── Rush Sessions (inline — no separate module needed) ────────
const DEFAULT_RUSH_SESSIONS = {
  morning: {
    id:"morning", label:"🌅 Morning Rush", emoji:"🌅",
    color:"#FF9F43", windowMinutes: 30,
    tasks:[
      {id:"m1",title:"Make Bed",      emoji:"🛏", stars:3},
      {id:"m2",title:"Brush Teeth",   emoji:"🦷", stars:2},
      {id:"m3",title:"Face Wash",     emoji:"💧", stars:2},
      {id:"m4",title:"Get Dressed",   emoji:"👕", stars:3},
      {id:"m5",title:"Have Breakfast",emoji:"🍳", stars:3},
    ]
  },
  afterschool: {
    id:"afterschool", label:"🏠 After School", emoji:"🏠",
    color:"#6C63FF", windowMinutes: 45,
    tasks:[
      {id:"a1",title:"Change Clothes", emoji:"👔", stars:2},
      {id:"a2",title:"Have Lunch",     emoji:"🍽", stars:2},
      {id:"a3",title:"Wash Hands",     emoji:"🧼", stars:1},
      {id:"a4",title:"Pack School Bag",emoji:"🎒", stars:3},
      {id:"a5",title:"Rest Time",      emoji:"😴", stars:2},
    ]
  },
  bedtime: {
    id:"bedtime", label:"🌙 Bed Time", emoji:"🌙",
    color:"#114b5f", windowMinutes: 30,
    tasks:[
      {id:"b1",title:"Have Dinner",    emoji:"🍽", stars:2},
      {id:"b2",title:"Brush Teeth",    emoji:"🦷", stars:2},
      {id:"b3",title:"Put on Pyjamas", emoji:"👕", stars:1},
      {id:"b4",title:"Tidy Your Room", emoji:"🧹", stars:3},
      {id:"b5",title:"Read or Quran",  emoji:"📖", stars:3},
    ]
  }
};

function calculateRushStars(baseStars, elapsed, total) {
  const r = elapsed/total;
  if (r<=0.33) return baseStars*3;
  if (r<=0.66) return baseStars*2;
  return baseStars;
}

async function startRush(parentId, sessionId, kidIds, tasks, windowMinutes) {
  const { setDoc, doc: fsDoc, serverTimestamp: fsts } = await import(
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"
  );
  const rushId    = `${parentId}_${sessionId}_${Date.now()}`;
  const startAtMs = Date.now();
  const endAtMs   = startAtMs + ((windowMinutes || 30) * 60 * 1000);
  await setDoc(fsDoc(db, "activeRush", rushId), {
    rushId, parentId, sessionId, kidIds, tasks,
    windowMinutes: windowMinutes || 30,
    startAtMs, endAtMs, status:"active", progress:{}, startAt: fsts()
  });
  return rushId;
}

async function getActiveRushForKid(parentId) {
  const firestoreModule = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const { getDocs, collection, query, where } = firestoreModule;
  const q    = query(collection(db,"activeRush"), where("parentId","==",parentId), where("status","==","active"));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const data = {id:snap.docs[0].id, ...snap.docs[0].data()};
  // Normalize timestamps — Firestore may return Timestamp objects or plain numbers
  if (data.endAtMs?.toMillis)   data.endAtMs   = data.endAtMs.toMillis();
  if (data.startAtMs?.toMillis) data.startAtMs = data.startAtMs.toMillis();
  return data;
}

async function completeRushTask(rushId, kidId, taskId, baseStars, startAtMs) {
  const { updateDoc, doc: fsDoc, getDoc } = await import(
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"
  );
  const elapsed   = Math.floor((Date.now()-startAtMs)/1000);
  const snap      = await getDoc(fsDoc(db,"activeRush",rushId));
  if (!snap.exists()) return baseStars;
  const task      = snap.data().tasks.find(t=>t.id===taskId);
  const totalSecs = (task?.minutes||5)*60;
  const earned    = calculateRushStars(baseStars, elapsed, totalSecs);
  await updateDoc(fsDoc(db,"activeRush",rushId), {
    [`progress.${kidId}.${taskId}`]: {done:true, doneAtMs:Date.now(), elapsedSecs:elapsed, stars:earned}
  });
  return earned;
}

async function endRush(rushId) {
  const { updateDoc, doc: fsDoc, serverTimestamp: fsts } = await import(
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"
  );
  await updateDoc(fsDoc(db,"activeRush",rushId), {status:"completed", endedAt:fsts()});
}

// ── Credential helpers — delegate to window.SK (defined in HTML) ─
const saveCredentials  = (e,p) => window.SK?.saveParent(e,p);
const loadCredentials  = ()    => window.SK?.loadParent() || {email:"",password:""};
const clearCredentials = ()    => window.SK?.clearParent();

// ── State ─────────────────────────────────────────────────────
let currentParent    = null;
let currentKid       = null;
let kidsList         = [];
let rewardsCatalog   = [];
let familyValues     = [];
let financeSettings  = { rate: 0.10, currency: "SAR", symbol: "﷼" };
let selectedPhoto    = null;

// ── Helpers ───────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");
  if (id !== "screen-splash") sessionStorage.setItem("sk_splash_shown","1");
}
function toast(msg, type = "info") {
  const t = document.getElementById("toast");
  t.textContent = msg; t.className = `toast toast--${type} toast--show`;
  setTimeout(() => t.classList.remove("toast--show"), 3500);
}
function celebrate(title, icon = "⭐🎉⭐") {
  const el = document.getElementById("celebration");
  if (!el) return;
  document.getElementById("celebration-icon").textContent = icon;
  document.getElementById("celebration-text").textContent = title;
  el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 4500);
}
function friendlyError(err) {
  const map = { "auth/email-already-in-use":"This email is already registered.","auth/invalid-email":"Please enter a valid email.","auth/weak-password":"Password must be at least 6 characters.","auth/user-not-found":"No account found with this email.","auth/wrong-password":"Incorrect password.","auth/invalid-credential":"Email or password is incorrect." };
  return map[err.code] || err.message;
}
function setLoading(btn, loading) {
  btn.disabled = loading; btn.dataset.orig = btn.dataset.orig || btn.textContent;
  btn.textContent = loading ? "Please wait…" : btn.dataset.orig;
}
function fmt(n) { return parseFloat(n).toFixed(2); }

// ── Convert file to compressed base64 ────────────────────────
// Single reliable function: reads file → draws on canvas → returns base64 string
function imageToBase64(file, maxWidth = 400, quality = 0.5) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image load failed"));
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          let w = img.width, h = img.height;
          if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
          if (h > maxWidth) { w = Math.round(w * maxWidth / h); h = maxWidth; }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          const b64 = canvas.toDataURL("image/jpeg", quality);
          resolve(b64);
        } catch(err) {
          reject(new Error("Canvas failed: " + err.message));
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Keep these for backward compat
function compressImage(file, maxWidth = 400, quality = 0.5) {
  return Promise.resolve(file); // no-op, imageToBase64 handles compression
}
function fileToBase64(file) {
  return imageToBase64(file, 400, 0.5);
}

// ── Remember Me ───────────────────────────────────────────────
const LS_EMAIL = "sk_remembered_email";
const saveEmail     = e  => localStorage.setItem(LS_EMAIL, e);
const clearEmail    = () => localStorage.removeItem(LS_EMAIL);
const getSavedEmail = () => localStorage.getItem(LS_EMAIL) || "";
// Prefill runs after DOM is ready
function prefillLoginForm() {
  const { email, password } = loadCredentials();
  console.log("prefillLoginForm called, email:", email, "has password:", !!password);
  if (!email) return;
  const emailEl = document.getElementById("login-email");
  const pwEl    = document.getElementById("login-password");
  const cb      = document.getElementById("remember-me");
  if (emailEl) emailEl.value = email;
  if (pwEl && password) pwEl.value = password;
  if (cb) cb.checked = true;
}
document.addEventListener("DOMContentLoaded", prefillLoginForm);

// ── Photo preview ─────────────────────────────────────────────
document.getElementById("kid-photo-input")?.addEventListener("change", e => {
  const file = e.target.files[0]; if (!file) return;
  selectedPhoto = file;
  const prev = document.getElementById("kid-photo-preview");
  prev.src = URL.createObjectURL(file); prev.style.display = "block";
  document.getElementById("kid-photo-placeholder").style.display = "none";
});

// ═══════════════════════════════════════════════════════════════
// KIDS LIST
// ═══════════════════════════════════════════════════════════════
function renderKids() {
  const list = document.getElementById("kids-list");
  if (!list) return;
  if (!kidsList.length) { list.innerHTML = `<p class="empty-state">No kids yet. Add your first kid! 👶</p>`; return; }
  list.innerHTML = kidsList.map(kid => {
    const av = kid.photoURL
      ? `<img src="${kid.photoURL}" class="kid-card__photo" onclick="changeKidPhoto('${kid.id}')" title="Tap to change photo" style="cursor:pointer;" />`
      : `<div class="kid-card__avatar" onclick="changeKidPhoto('${kid.id}')" title="Tap to add photo" style="cursor:pointer;">
           <span>${kid.avatarEmoji||"🌟"}</span>
           <span class="kid-photo-add">📷</span>
         </div>`;
    return `<div class="kid-card" data-id="${kid.id}">${av}
      <div class="kid-card__info">
        <div class="kid-card__name">${kid.name}</div>
        <div class="kid-card__age">Age ${kid.age}</div>
        <div class="kid-card__code">Code: <strong class="code-display" id="code-${kid.id}">${kid.code}</strong></div>
      </div>
      <div class="kid-card__actions">
        <button class="btn btn--sm btn--accent"    onclick="openAddTask('${kid.id}','${kid.name}')">➕ Task</button>
        <button class="btn btn--sm btn--faith"     onclick="openFaithTasks('${kid.id}','${kid.name}')">${getFaithEmoji(currentParent?.faith||"muslim")} Faith</button>
        <button class="btn btn--sm btn--praise"    onclick="openSendPraise('${kid.id}','${kid.name}')">💛 Praise</button>
        <button class="btn btn--sm btn--info"      onclick="openBonusStars('${kid.id}','${kid.name}')">⭐ Bonus</button>
        <button class="btn btn--sm btn--secondary" onclick="handleRegenCode('${kid.id}')">🔄</button>
        <button class="btn btn--sm btn--danger"    onclick="handleDeleteKid('${kid.id}','${kid.name}')">🗑</button>
      </div></div>`;
  }).join("");
}
async function loadKids() {
  if (!currentParent) return;
  kidsList = await getKidsByParent(currentParent.uid);
  renderKids();
}

// ═══════════════════════════════════════════════════════════════
// APPROVALS (tasks + redemptions)
// ═══════════════════════════════════════════════════════════════
async function loadPendingApprovals() {
  // Use kidId-based query to catch tasks that may be missing parentId
  const kidIds   = kidsList.map(k => k.id);
  const pending  = kidIds.length
    ? await getPendingApprovalsByKids(kidIds)
    : await getPendingApprovals(currentParent.uid);
  const allGoals = [];
  for (const kid of kidsList) {
    const goals = await getGoalsForKid(kid.id);
    goals.filter(g => g.status === GOAL_STATUS.REQUESTED).forEach(g =>
      allGoals.push({ ...g, kidName: kid.name, kidEmoji: kid.avatarEmoji, kidPhoto: kid.photoURL }));
  }
  const el    = document.getElementById("approvals-list");
  const badge = document.getElementById("approvals-badge");
  const total = pending.length + allGoals.length;

  // ── Notification: sound + toast when new approvals arrive ──
  const prevCount = window._lastApprovalCount ?? -1;
  if (total > 0 && total > prevCount) {
    playApprovalDing();
    if (prevCount >= 0) {
      // New submission came in while parent was on dashboard
      const newCount = total - prevCount;
      toast(`🔔 ${newCount} new task${newCount>1?"s":""} waiting for your approval!`, "info");
    } else if (prevCount === -1) {
      // First load — just show toast, don't be too noisy
      setTimeout(() => toast(`🔔 ${total} task${total>1?"s":""} waiting for approval!`, "info"), 800);
    }
  }
  window._lastApprovalCount = total;

  if (badge) {
    badge.textContent = total || "";
    badge.style.display = total ? "inline-flex" : "none";
    // Pulse animation when there are pending items
    if (total > 0) {
      badge.classList.add("badge--pulse");
    } else {
      badge.classList.remove("badge--pulse");
    }
  }
  if (!el) return;
  let html = "";
  if (pending.length) {
    html += `<div class="task-section-title">📋 Task Approvals</div>`;
    html += pending.map(task => {
      const kid = kidsList.find(k => k.id === task.kidId);
      const av  = kid?.photoURL ? `<img src="${kid.photoURL}" class="approval-avatar-img" />` : `<span>${kid?.avatarEmoji||"🌟"}</span>`;
      const typeLabel = task.taskType==="daily"?"🔄":task.taskType==="weekly"?"📅":task.isEntrepreneur?"💼":"1️⃣";
      const streakInfo = task.streak ? ` · 🔥 ${task.streak} streak` : "";
      // ── Submitted date/time label ───────────────────────────
      let submittedLabel = "";
      if (task.submittedAt) {
        const subDate = task.submittedAt.toDate ? task.submittedAt.toDate() : new Date(task.submittedAt);
        const now     = new Date();
        const diffMs  = now - subDate;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHr  = Math.floor(diffMs / 3600000);
        const diffDay = Math.floor(diffMs / 86400000);
        if (diffMin < 1)        submittedLabel = "just now";
        else if (diffMin < 60)  submittedLabel = `${diffMin}m ago`;
        else if (diffHr < 24)   submittedLabel = `${diffHr}h ago`;
        else if (diffDay === 1) submittedLabel = "yesterday";
        else                    submittedLabel = `${diffDay} days ago`;
      }
      return `<div class="approval-card">
        <div class="approval-avatar">${av}</div>
        <div class="approval-info">
          <div class="approval-kid">${kid?.name||"?"} ${submittedLabel ? `<span style="font-size:0.72rem;color:var(--color-muted);font-weight:500;">· ${submittedLabel}</span>` : ""}</div>
          <div class="approval-task">${typeLabel} ${task.title}${streakInfo}</div>
          <div class="approval-stars">⭐ ${task.stars} stars = ${starsToMoney(task.stars, financeSettings)}</div>
          <div id="photo-wrap-${task.id}" class="task-photo-wrap"></div>
        </div>
        <div class="approval-actions">
          <button class="btn btn--sm btn--success" onclick="handleApprove('${task.id}','${task.kidId}',${task.stars},'${task.title}',${task.streak||0})">✅ Approve</button>
          <button class="btn btn--sm btn--danger"  onclick="handleReject('${task.id}','${task.title}')">❌ Reject</button>
        </div></div>`;
    }).join("");
  }
  if (allGoals.length) {
    html += `<div class="task-section-title">🎁 Reward Redemptions</div>`;
    html += allGoals.map(g => {
      const av = g.kidPhoto ? `<img src="${g.kidPhoto}" class="approval-avatar-img" />` : `<span>${g.kidEmoji||"🌟"}</span>`;
      return `<div class="approval-card approval-card--redeem">
        <div class="approval-avatar">${av}</div>
        <div class="approval-info">
          <div class="approval-kid">${g.kidName}</div>
          <div class="approval-task">${g.emoji} ${g.title}</div>
          <div class="approval-stars">⭐ ${g.targetStars} stars = ${starsToMoney(g.targetStars, financeSettings)}</div>
        </div>
        <div class="approval-actions">
          <button class="btn btn--sm btn--success" onclick="handleApproveRedemption('${g.id}','${g.kidId}',${g.targetStars},'${g.title}','${g.kidName}')">🎁 Give!</button>
          <button class="btn btn--sm btn--danger"  onclick="handleRejectRedemption('${g.id}','${g.title}')">❌ Not yet</button>
        </div></div>`;
    }).join("");
  }
  if (!total) html = `<p class="empty-state">Nothing pending 🎉</p>`;
  el.innerHTML = html;

  // Load submission photos asynchronously after rendering
  for (const task of pending) {
    const wrap = document.getElementById(`photo-wrap-${task.id}`);
    if (!wrap) continue;
    const photo = await loadTaskPhoto(task.id);
    if (photo) {
      wrap.innerHTML = `<img src="${photo}" class="submission-photo" onclick="showPhotoFull(this.src)" style="width:80px;height:80px;object-fit:cover;border-radius:8px;cursor:pointer;" />`;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// WALLETS OVERVIEW — now shows money value
// ═══════════════════════════════════════════════════════════════
async function loadWalletsOverview() {
  const el = document.getElementById("wallets-list");
  if (!el) return;
  if (!kidsList.length) { el.innerHTML = `<p class="empty-state">Add kids first. 👶</p>`; return; }
  const rows = await Promise.all(kidsList.map(async kid => {
    const [stars, goals] = await Promise.all([getStarBalance(kid.id), getGoalsForKid(kid.id)]);
    const money  = starsToMoney(stars, financeSettings);
    const active = goals.find(g => g.status === GOAL_STATUS.ACTIVE);
    const pct    = active ? Math.min(100, Math.round((stars/active.targetStars)*100)) : null;
    const av     = kid.photoURL ? `<img src="${kid.photoURL}" class="wallet-avatar-img" />` : `<span class="wallet-avatar-emoji">${kid.avatarEmoji||"🌟"}</span>`;
    return `<div class="wallet-card"><div class="wallet-avatar">${av}</div>
      <div class="wallet-info">
        <div class="wallet-name">${kid.name}</div>
        <div class="wallet-stars">⭐ ${stars} stars</div>
        <div class="wallet-money">💰 ${money}</div>
        ${active ? `<div class="wallet-goal">
          <div class="wallet-goal-label">${active.emoji} Saving for: ${active.title} (${active.targetStars}⭐ / ${starsToMoney(active.targetStars, financeSettings)})</div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="progress-label">⭐ ${stars} / ${active.targetStars} — ${pct}%</div>
        </div>` : `<div class="wallet-no-goal">No active goal</div>`}
      </div></div>`;
  }));
  el.innerHTML = rows.join("");
}

// ═══════════════════════════════════════════════════════════════
// FINANCE SETTINGS TAB
// ═══════════════════════════════════════════════════════════════
async function loadFinanceSettings() {
  if (!currentParent?.uid) {
    console.warn("loadFinanceSettings: no currentParent");
    return;
  }

  // Fetch settings
  try {
    financeSettings = await getFinanceSettings(currentParent.uid);
  } catch(e) {
    console.error("getFinanceSettings failed:", e);
    financeSettings = { rate: 0.10, currency: "SAR", symbol: "﷼" };
  }

  // Populate form fields — they exist because the tab panel is now visible
  const rateEl = document.getElementById("star-rate-input");
  const currEl = document.getElementById("currency-select");
  const symEl  = document.getElementById("currency-symbol-input");

  if (rateEl) rateEl.value = financeSettings.rate    || 0.10;
  if (currEl) currEl.value = financeSettings.currency || "SAR";
  if (symEl)  symEl.value  = financeSettings.symbol   || "﷼";

  updateRatePreview();

  // Seed and load jobs
  try {
    await seedDefaultJobs(currentParent.uid);
  } catch(e) {
    console.error("seedDefaultJobs failed:", e);
  }
  await loadJobsCatalog();
}

function updateRatePreview() {
  const rateEl = document.getElementById("star-rate-input");
  const symEl  = document.getElementById("currency-symbol-input");
  const preEl  = document.getElementById("rate-preview");
  if (!rateEl || !preEl) return;
  const rate = parseFloat(rateEl.value) || 0.10;
  const sym  = symEl?.value || "﷼";
  preEl.textContent = `10 ⭐ = ${sym} ${fmt(rate * 10)}  ·  50 ⭐ = ${sym} ${fmt(rate * 50)}  ·  100 ⭐ = ${sym} ${fmt(rate * 100)}`;
}

// Attach listeners after DOM ready
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("star-rate-input")?.addEventListener("input", updateRatePreview);
  document.getElementById("currency-symbol-input")?.addEventListener("input", updateRatePreview);
});

window.saveFinanceSettingsHandler = async () => {
  const btn  = document.getElementById("btn-save-finance");
  const rate = parseFloat(document.getElementById("star-rate-input")?.value) || 0.10;
  const curr = document.getElementById("currency-select")?.value || "SAR";
  const sym  = document.getElementById("currency-symbol-input")?.value || "﷼";
  if (!btn) return;
  setLoading(btn, true);
  try {
    await saveFinanceSettings(currentParent.uid, rate, curr, sym);
    financeSettings = { rate, currency: curr, symbol: sym };
    toast("✅ Finance settings saved!", "success");
  } catch(err) { toast("Failed to save.", "error"); console.error(err); }
  finally { setLoading(btn, false); }
};

// ═══════════════════════════════════════════════════════════════
// ENTREPRENEUR JOBS CATALOG (parent)
// ═══════════════════════════════════════════════════════════════
async function loadJobsCatalog() {
  if (!currentParent?.uid) return;
  const el = document.getElementById("jobs-catalog-list");
  if (!el) return;
  let jobs = [];
  try { jobs = await getEntrepreneurJobs(currentParent.uid); } catch(e) { console.error(e); }
  if (!jobs.length) { el.innerHTML = `<p class="empty-state">No jobs yet. Add one above!</p>`; return; }
  el.innerHTML = jobs.map(j => `
    <div class="job-catalog-item">
      <span class="job-emoji">${j.emoji}</span>
      <div class="job-info">
        <div class="job-title">${j.title}</div>
        <div class="job-desc">${j.description||""}</div>
        <div class="job-stars">⭐ ${j.stars} stars = ${starsToMoney(j.stars, financeSettings)}</div>
      </div>
      <button class="btn btn--sm btn--danger" onclick="handleDeleteJob('${j.id}')">🗑</button>
    </div>`).join("");
}

window.handleDeleteJob = async (jobId) => {
  if (!confirm("Remove this job?")) return;
  try { await deleteJob(jobId); await loadJobsCatalog(); toast("Job removed.", "info"); }
  catch(err) { toast("Failed.", "error"); }
};

window.openAddJob  = () => { document.getElementById("new-job-title").value=""; document.getElementById("new-job-desc").value=""; document.getElementById("new-job-stars").value="20"; document.getElementById("new-job-emoji").value="💼"; document.getElementById("new-job-emoji-preview").textContent="💼"; document.getElementById("modal-add-job").classList.add("open"); };
window.closeAddJob = () => document.getElementById("modal-add-job").classList.remove("open");

document.getElementById("btn-save-new-job")?.addEventListener("click", async () => {
  const btn   = document.getElementById("btn-save-new-job");
  const title = document.getElementById("new-job-title").value.trim();
  const desc  = document.getElementById("new-job-desc").value.trim();
  const stars = parseInt(document.getElementById("new-job-stars").value)||20;
  const emoji = document.getElementById("new-job-emoji").value||"💼";
  if (!title) { toast("Please enter a job title.", "error"); return; }
  setLoading(btn, true);
  try {
    await createJob(currentParent.uid, title, desc, stars, emoji);
    closeAddJob(); await loadJobsCatalog();
    toast(`"${title}" added to jobs! 💼`, "success");
  } catch(err) { toast("Failed.", "error"); console.error(err); }
  finally { setLoading(btn, false); }
});

// ═══════════════════════════════════════════════════════════════
// REWARDS CATALOG
// ═══════════════════════════════════════════════════════════════
async function loadRewardsCatalog() {
  rewardsCatalog = await getRewardsForParent(currentParent.uid);
  renderRewardsCatalog();
}
function renderRewardsCatalog() {
  const el = document.getElementById("rewards-catalog-list");
  if (!el) return;
  if (!rewardsCatalog.length) { el.innerHTML = `<p class="empty-state">No rewards yet.</p>`; return; }
  const cats = {}; rewardsCatalog.forEach(r => { const c = r.category||"custom"; if(!cats[c]) cats[c]=[]; cats[c].push(r); });
  const labels = { treat:"🍬 Treats", outing:"🎡 Outings", toy:"🧸 Toys & Things", big:"🏆 Big Rewards", custom:"✨ Custom" };
  let html = "";
  Object.entries(cats).forEach(([cat, rewards]) => {
    html += `<div class="reward-cat-title">${labels[cat]||cat}</div>`;
    html += rewards.map(r => `<div class="reward-catalog-item">
      <span class="reward-emoji">${r.emoji}</span>
      <div class="reward-info">
        <div class="reward-title">${r.title}</div>
        <div class="reward-stars">⭐ ${r.stars} = ${starsToMoney(r.stars, financeSettings)}</div>
      </div>
      <div class="reward-actions">
        <button class="btn btn--sm btn--secondary" onclick="openEditReward('${r.id}','${r.title}',${r.stars},'${r.emoji}')">✏️</button>
        <button class="btn btn--sm btn--danger"    onclick="handleDeleteReward('${r.id}')">🗑</button>
      </div></div>`).join("");
  });
  el.innerHTML = html;
}
let editRewardId = null;
window.openEditReward  = (id,title,stars,emoji) => { editRewardId=id; document.getElementById("edit-reward-title").value=title; document.getElementById("edit-reward-stars").value=stars; document.getElementById("edit-reward-emoji").value=emoji; document.getElementById("edit-reward-emoji-preview").textContent=emoji; document.getElementById("modal-edit-reward").classList.add("open"); };
window.closeEditReward = () => document.getElementById("modal-edit-reward").classList.remove("open");
document.getElementById("btn-save-edit-reward")?.addEventListener("click", async () => {
  const btn=document.getElementById("btn-save-edit-reward"); const title=document.getElementById("edit-reward-title").value.trim(); const stars=parseInt(document.getElementById("edit-reward-stars").value)||1; const emoji=document.getElementById("edit-reward-emoji").value||"🎁";
  if (!title) { toast("Please enter a name.","error"); return; } setLoading(btn,true);
  try { await updateReward(editRewardId,{title,stars,emoji}); closeEditReward(); await loadRewardsCatalog(); toast("Reward updated! ✅","success"); }
  catch(err) { toast("Failed.","error"); } finally { setLoading(btn,false); }
});
window.handleDeleteReward = async (id) => { if (!confirm("Delete this reward?")) return; try { await deleteReward(id); await loadRewardsCatalog(); toast("Removed.","info"); } catch(err) { toast("Failed.","error"); } };
window.openAddReward  = () => { document.getElementById("new-reward-title").value=""; document.getElementById("new-reward-stars").value="20"; document.getElementById("new-reward-emoji").value="🎁"; document.getElementById("new-reward-emoji-preview").textContent="🎁"; document.getElementById("modal-add-reward").classList.add("open"); };
window.closeAddReward = () => document.getElementById("modal-add-reward").classList.remove("open");
document.getElementById("btn-save-new-reward")?.addEventListener("click", async () => {
  const btn=document.getElementById("btn-save-new-reward"); const title=document.getElementById("new-reward-title").value.trim(); const stars=parseInt(document.getElementById("new-reward-stars").value)||20; const emoji=document.getElementById("new-reward-emoji").value||"🎁";
  if (!title) { toast("Please enter a name.","error"); return; } setLoading(btn,true);
  try { await createReward(currentParent.uid,title,stars,emoji,"custom"); closeAddReward(); await loadRewardsCatalog(); toast(`"${title}" added! 🎁`,"success"); }
  catch(err) { toast("Failed.","error"); console.error(err); } finally { setLoading(btn,false); }
});

// ── Approve/Reject redemptions ────────────────────────────────
window.handleApproveRedemption = async (goalId,kidId,stars,title,kidName) => {
  if (!confirm(`Give "${title}" to ${kidName}? This will deduct ⭐${stars}.`)) return;
  try { await approveRedemption(goalId,kidId,stars); toast(`🎁 "${title}" redeemed for ${kidName}!`,"success"); loadPendingApprovals(); loadWalletsOverview(); }
  catch(err) { toast("Failed.","error"); console.error(err); }
};
window.handleRejectRedemption = async (goalId,title) => {
  try { await rejectRedemption(goalId); toast(`"${title}" sent back.`,"info"); loadPendingApprovals(); }
  catch(err) { toast("Failed.","error"); }
};

// ═══════════════════════════════════════════════════════════════
// VALUES & FAITH ENGINE (Sprint 7)
// ═══════════════════════════════════════════════════════════════

// ── Load values management tab ────────────────────────────────
async function loadValuesTab() {
  if (!currentParent?.uid) return;
  try {
    familyValues = await getFamilyValues(currentParent.uid);
    if (!familyValues.length) familyValues = await seedDefaultValues(currentParent.uid);
  } catch(e) { console.error("loadValuesTab:", e); return; }
  renderValuesTab();
}

function renderValuesTab() {
  const el = document.getElementById("values-list");
  if (!el) return;
  if (!familyValues.length) { el.innerHTML = `<p class="empty-state">No values yet.</p>`; return; }
  el.innerHTML = familyValues.map(v => `
    <div class="value-card" style="border-left: 4px solid ${v.color||"#6c63ff"}">
      <span class="value-emoji">${v.emoji}</span>
      <div class="value-info">
        <div class="value-name">${v.name}</div>
        <div class="value-desc">${v.description||""}</div>
      </div>
      <button class="goal-delete-btn" onclick="handleDeleteValue('${v.id}','${v.name}')">×</button>
    </div>`).join("");
}

window.handleDeleteValue = async (id, name) => {
  if (!confirm(`Remove "${name}" from family values?`)) return;
  try { await deleteFamilyValue(id); familyValues=familyValues.filter(v=>v.id!==id); renderValuesTab(); toast(`"${name}" removed.`,"info"); }
  catch(e) { toast("Failed.","error"); }
};

// ── Add custom value modal ────────────────────────────────────
window.openAddValue  = () => {
  document.getElementById("new-value-name").value="";
  document.getElementById("new-value-desc").value="";
  document.getElementById("new-value-emoji").value="💫";
  document.getElementById("new-value-emoji-preview").textContent="💫";
  document.getElementById("new-value-color").value="#6c63ff";
  document.getElementById("modal-add-value").classList.add("open");
};
window.closeAddValue = () => document.getElementById("modal-add-value").classList.remove("open");

document.getElementById("btn-save-new-value")?.addEventListener("click", async () => {
  const btn  = document.getElementById("btn-save-new-value");
  const name = document.getElementById("new-value-name").value.trim();
  const desc = document.getElementById("new-value-desc").value.trim();
  const emoji= document.getElementById("new-value-emoji").value||"💫";
  const color= document.getElementById("new-value-color").value||"#6c63ff";
  if (!name) { toast("Please enter a value name.","error"); return; }
  setLoading(btn,true);
  try {
    const v = await addFamilyValue(currentParent.uid, name, emoji, color, desc);
    familyValues.push(v); closeAddValue(); renderValuesTab();
    toast(`"${name}" added to family values! 💛`,"success");
  } catch(e) { toast("Failed.","error"); console.error(e); } finally { setLoading(btn,false); }
});

// ── Populate value selector in Add Task modal ─────────────────
function populateValueSelector() {
  const sel = document.getElementById("task-value-select");
  if (!sel) return;
  sel.innerHTML = `<option value="">— No value tag —</option>` +
    familyValues.map(v => `<option value="${v.id}">${v.emoji} ${v.name}</option>`).join("");
}

// ── Faith tasks section ───────────────────────────────────────
window.openFaithTasks = (kidId, kidName) => {
  // Get faith from parent profile
  const faith     = currentParent?.faith || "muslim";
  const faithLabel= getFaithLabel(faith);
  const faithEmoji= getFaithEmoji(faith);
  const tasks     = getFaithTasks(faith);

  document.getElementById("modal-faith-kid-name").textContent = `${faithEmoji} Faith Journey for ${kidName}`;
  document.getElementById("faith-modal-subtitle").textContent =
    `${faithLabel} tasks — added as daily habits. Select the ones you want.`;
  document.getElementById("faith-modal-kid-id").value = kidId;

  const list = document.getElementById("faith-tasks-list");
  if (!tasks.length) {
    list.innerHTML = `<p class="empty-state">No preset tasks for your faith. Add custom tasks from the Kids tab instead.</p>`;
  } else {
    list.innerHTML = tasks.map((t,i) => `
      <label class="faith-task-item">
        <input type="checkbox" value="${i}" checked />
        <span class="faith-emoji">${t.emoji}</span>
        <div class="faith-info">
          <div class="faith-title">${t.title}</div>
          <div class="faith-desc" style="font-size:0.75rem;color:var(--color-muted);">${t.description}</div>
          <div class="faith-stars">⭐ ${t.stars} stars/day · ${starsToMoney(t.stars,financeSettings)}</div>
        </div>
      </label>`).join("");
  }
  document.getElementById("modal-faith-tasks").classList.add("open");
};
window.closeFaithTasks = () => document.getElementById("modal-faith-tasks").classList.remove("open");

document.getElementById("btn-save-faith-tasks")?.addEventListener("click", async () => {
  const btn    = document.getElementById("btn-save-faith-tasks");
  const kidId  = document.getElementById("faith-modal-kid-id").value;
  const faith  = currentParent?.faith || "muslim";
  const tasks  = getFaithTasks(faith);
  const checks = document.querySelectorAll("#faith-tasks-list input[type=checkbox]:checked");
  const selected = Array.from(checks).map(c => tasks[parseInt(c.value)]).filter(Boolean);
  if (!selected.length) { toast("Please select at least one task.","error"); return; }
  setLoading(btn,true);
  try {
    await addFaithTasksForKid(currentParent.uid, kidId, selected);
    closeFaithTasks();
    toast(`${selected.length} faith task${selected.length>1?"s":""} added! 🕌`,"success");
  } catch(e) { toast("Failed.","error"); console.error(e); } finally { setLoading(btn,false); }
});

// ── Praise: parent sends praise to kid ───────────────────────
let praiseKidId=null, praiseKidName=null;
window.openSendPraise = (kidId, kidName) => {
  praiseKidId=kidId; praiseKidName=kidName;
  document.getElementById("modal-praise-kid-name").textContent=`Praise ${kidName} 💛`;
  document.getElementById("praise-message-input").value="";
  document.getElementById("praise-value-select").innerHTML=
    `<option value="">— General praise —</option>` +
    familyValues.map(v=>`<option value="${v.id}">${v.emoji} ${v.name}</option>`).join("");
  document.getElementById("praise-emoji-select").value="💛";
  document.getElementById("modal-send-praise").classList.add("open");
};
window.closeSendPraise=()=>document.getElementById("modal-send-praise").classList.remove("open");

document.getElementById("btn-send-praise")?.addEventListener("click", async () => {
  const btn     = document.getElementById("btn-send-praise");
  const message = document.getElementById("praise-message-input").value.trim();
  const valueId = document.getElementById("praise-value-select").value||null;
  const emoji   = document.getElementById("praise-emoji-select").value||"💛";
  if (!message) { toast("Please write a praise message.","error"); return; }
  setLoading(btn,true);
  try {
    await sendPraise(currentParent.uid, praiseKidId, message, valueId, emoji);
    closeSendPraise();
    toast(`💛 Praise sent to ${praiseKidName}!`,"success");
  } catch(e) { toast("Failed.","error"); console.error(e); } finally { setLoading(btn,false); }
});

// ── Kid: load values progress ─────────────────────────────────
async function loadKidValuesProgress(kidId) {
  const el    = document.getElementById("kid-values-list");
  const tabEl = document.getElementById("kid-values-tab-list");
  try {
    const values   = await getFamilyValues(currentKid.parentId);
    if (!values.length) {
      const msg = `<p class="empty-state">Your family hasn't set values yet.</p>`;
      if (el) el.innerHTML = msg; if (tabEl) tabEl.innerHTML = msg; return;
    }
    const progress = await getValuesProgress(kidId, values);
    const valHTML  = values.map(v => {
      const count = progress[v.id]||0;
      return `<div class="value-progress-card" style="border-left:4px solid ${v.color||"#6c63ff"}">
        <span class="value-emoji" style="font-size:2rem;">${v.emoji}</span>
        <div class="value-info">
          <div class="value-name">${v.name}</div>
          <div class="value-desc">${v.description||""}</div>
          <div class="value-count">${count > 0 ? `✅ ${count} task${count>1?"s":""} completed` : "No tasks yet"}</div>
        </div>
        ${count>0?`<div class="value-badge" style="background:${v.color||"#6c63ff"}">${count}</div>`:""}
      </div>`;
    }).join("");
    if (el) el.innerHTML = valHTML;
    if (tabEl) tabEl.innerHTML = valHTML;
  } catch(e) {
    const msg = `<p class="empty-state">Could not load values.</p>`;
    if (el) el.innerHTML = msg; if (tabEl) tabEl.innerHTML = msg;
    console.error(e);
  }
}

// ── Kid: load praise messages ─────────────────────────────────
async function loadKidPraise(kidId) {
  // Update both the goals-tab inline list AND the dedicated praise tab
  const el     = document.getElementById("kid-praise-list");
  const tabEl  = document.getElementById("kid-praise-tab-list");
  try {
    const praises = await getPraiseForKid(kidId);
    if (!praises.length) {
      const emptyMsg = `<p class="empty-state">No praise messages yet. Keep working hard! 💪</p>`;
      if (el) el.innerHTML = emptyMsg;
      if (tabEl) tabEl.innerHTML = emptyMsg;
      return;
    }
    const sorted = praises.sort((a,b) => (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    const praiseHTML = sorted.map(p => `
      <div class="praise-card ${p.read?"praise-card--read":"praise-card--new"}">
        <div class="praise-emoji">${p.emoji||"💛"}</div>
        <div class="praise-body">
          <div class="praise-message">${p.message}</div>
          ${p.valueId ? (() => { const v=familyValues.find(fv=>fv.id===p.valueId); return v?`<div class="praise-value">${v.emoji} ${v.name}</div>`:""; })() : ""}
        </div>
        ${!p.read?`<div class="praise-new-dot"></div>`:""}
      </div>`).join("");
    if (el) el.innerHTML = praiseHTML;
    if (tabEl) tabEl.innerHTML = praiseHTML;
    praises.filter(p=>!p.read).forEach(p=>markPraiseRead(p.id).catch(()=>{}));
  } catch(e) { el.innerHTML=`<p class="empty-state">Could not load praise.</p>`; console.error(e); }
}

// ═══════════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════════
window.showTab = (tab) => {
  document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p=>p.classList.remove("active"));
  document.getElementById(`tab-btn-${tab}`)?.classList.add("active");
  document.getElementById(`tab-${tab}`)?.classList.add("active");
  if (tab==="approvals") loadPendingApprovals();
  if (tab==="wallets")   loadWalletsOverview();
  if (tab==="rewards")   loadRewardsCatalog();
  if (tab==="finance")   loadFinanceSettings();
  if (tab==="values")    loadValuesTab();
  if (tab==="report")    loadWeeklyReports();
  if (tab==="profile")   loadProfileTab();
  if (tab==="rush")      { loadRushTab(); loadRushHistory(); }
};

// ═══════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════
onAuthChange(async user => {
  if (user) {
    try {
      const profile = await getParentProfile(user.uid);
      const name = profile?.name || user.displayName || user.email?.split("@")[0] || "Parent";
      currentParent = { uid: user.uid, name, email: user.email, ...profile };
      financeSettings = await getFinanceSettings(currentParent.uid);
      await seedDefaultRewards(currentParent.uid);
      await seedDefaultJobs(currentParent.uid);
    } catch(e) {
      currentParent = { uid: user.uid, name: "Parent", email: user.email };
      console.error("Profile load error:", e);
    }
    if (window._justLoggedIn) {
      window._justLoggedIn = false;
      if (!hasPINSet()) openPINSetup();
      else openParentPIN();
    }
    // else: stay on home screen — Firebase Auth restored silently in background
  } else { currentParent = null; showScreen("screen-home"); }
});;

function goToParentDashboard() {
  loadCustomRushSessions().then(() => {
    renderCustomRushSessions();
  }).catch(()=>{});
  document.getElementById("parent-name-display").textContent = `Welcome, ${currentParent.name}! 👋`;
  autoSyncKidsToLocalStorage();
  showScreen("screen-parent-dashboard"); showTab("kids"); loadKids();
  // ── Auto-detect running rush on any device ─────────────────
  setTimeout(async () => {
    try {
      const rush = await getActiveRushForKid(currentParent.uid);
      if (rush) {
        const session = DEFAULT_RUSH_SESSIONS[rush.sessionId] ||
          customRushSessions.find(s=>s.id===rush.sessionId) || {};
        activeRushId   = rush.id;
        currentSession = session;
        document.getElementById("rush-monitor").style.display = "block";
        document.getElementById("rush-monitor-title").textContent =
          `${session.emoji||"⚡"} ${session.label||"Rush"} — Live`;
        startRushMonitor(session, rush.id);
        toast(`${session.emoji||"⚡"} Rush already running — reconnected!`, "info");
      }
    } catch(e) {}
  }, 1500);
}

// ── Auto-sync kids from Firestore → localStorage thumbnails ───
async function autoSyncKidsToLocalStorage() {
  try {
    const kids = await getKidsByParent(currentParent.uid);
    kids.forEach(kid => {
      if (typeof window.SK_saveKidDirect === "function") {
        window.SK_saveKidDirect(kid.id, kid.name, kid.avatarEmoji||"🌟", kid.photoURL||null, kid.code, kid.parentId);
      }
    });
    if (typeof window.SK_renderKids === "function") window.SK_renderKids();
  } catch(e) {}
}

// ── Lock parent portal — go home without logging out ──────────
window.lockParentPortal = () => {
  showScreen("screen-home");
  SK_renderKids();
};

// ── Signup step navigation ───────────────────────────────────
window.goToSignupStep2 = function() {
  const name  = document.getElementById("signup-name")?.value.trim();
  const email = document.getElementById("signup-email")?.value.trim();
  const pw    = document.getElementById("signup-password")?.value;
  if (!name || !email || !pw) { toast("Please fill in all fields.", "error"); return; }
  document.getElementById("signup-step-1").style.display = "none";
  document.getElementById("signup-step-2").style.display = "block";
};

window.goToSignupStep1 = function() {
  document.getElementById("signup-step-2").style.display = "none";
  document.getElementById("signup-step-1").style.display = "block";
};

window.selectFocus = function(focus) {
  document.querySelectorAll(".focus-btn").forEach(b => b.classList.remove("active"));
  document.querySelector('[data-focus="' + focus + '"]')?.classList.add("active");
  document.getElementById("signup-focus").value = focus;
  const fs = document.getElementById("faith-selector-section");
  if (fs) fs.style.display = focus === "faith" ? "block" : "none";
};

window.selectFaith = function(faith) {
  document.querySelectorAll(".faith-grid-btn").forEach(b => b.classList.remove("active"));
  document.querySelector('[data-faith="' + faith + '"]')?.classList.add("active");
  document.getElementById("signup-faith").value = faith;
};

document.getElementById("btn-signup")?.addEventListener("click", async () => {
  const btn      = document.getElementById("btn-signup");
  const name     = document.getElementById("signup-name")?.value.trim();
  const email    = document.getElementById("signup-email")?.value.trim();
  const password = document.getElementById("signup-password")?.value;
  const focus    = document.getElementById("signup-focus")?.value || "faith";
  const faith    = document.getElementById("signup-faith")?.value || "muslim";
  if (!name||!email||!password) { toast("Please fill in all fields.","error"); return; }
  setLoading(btn, true);
  try {
    const prefs = { focus, faith: focus === "faith" ? faith : null };
    const user  = await signUpParent(name, email, password, prefs);
    const profile = await getParentProfile(user.uid);
    currentParent = { uid: user.uid, name: profile?.name||name, email, ...profile };
    financeSettings = await getFinanceSettings(currentParent.uid);
    await seedDefaultRewards(currentParent.uid);
    familyValues = await seedDefaultValues(currentParent.uid);
    toast("Account created! Welcome to StarKids! 🌟","success");
    window._justLoggedIn = true;
    if (!hasPINSet()) openPINSetup();
    else goToParentDashboard();
  } catch(err) { toast(friendlyError(err),"error"); } finally { setLoading(btn,false); }
});

document.getElementById("btn-login")?.addEventListener("click", async () => {
  const btn=document.getElementById("btn-login"); const email=document.getElementById("login-email").value.trim(); const password=document.getElementById("login-password").value; const remember=document.getElementById("remember-me")?.checked;
  if (!email||!password) { toast("Please enter email and password.","error"); return; } setLoading(btn,true);
  try {
    const user=await loginParent(email,password);
    if (remember) {
      saveCredentials(email, password);
      console.log("✅ Credentials saved:", email);
    } else {
      clearCredentials();
    }
    const profile=await getParentProfile(user.uid);
    const name = profile?.name || user.displayName || email.split("@")[0] || "Parent";
    currentParent={uid:user.uid, name, email, ...profile};
    financeSettings=await getFinanceSettings(currentParent.uid);
    await seedDefaultRewards(currentParent.uid);
    familyValues = await seedDefaultValues(currentParent.uid);
    toast("Welcome back! 🌟","success");
    window._justLoggedIn = false;
    if (!hasPINSet()) openPINSetup();
    else openParentPIN();
  } catch(err) { toast(friendlyError(err),"error"); } finally { setLoading(btn,false); }
});

document.getElementById("btn-logout")?.addEventListener("click", async () => {
  clearCredentials();
  clearKidSession();
  window._lastApprovalCount = -1;
  await logoutParent();
  toast("Logged out!", "info");
});

// ═══════════════════════════════════════════════════════════════
// ADD KID
// ═══════════════════════════════════════════════════════════════
document.getElementById("btn-add-kid")?.addEventListener("click", async () => {
  const btn=document.getElementById("btn-add-kid"); const name=document.getElementById("kid-name").value.trim(); const age=parseInt(document.getElementById("kid-age").value,10); const emoji=document.getElementById("kid-avatar").value||"🌟";
  if (!name||!age||age<1||age>18) { toast("Please enter a valid name and age.","error"); return; } setLoading(btn,true);
  try {
    const kid=await addKid(currentParent.uid,name,age,emoji,null);
    if (selectedPhoto) {
      toast("Processing photo… 📸","info");
      try {
        const b64 = await fileToBase64(selectedPhoto);
        const final = b64.length > 900000
          ? await fileToBase64(await compressImage(selectedPhoto, 300, 0.6))
          : b64;
        if (final.length <= 900000) {
          await updateKidPhoto(kid.id, final);
          kid.photoURL = final;
          toast("Photo saved! ✅","success");
        } else {
          toast("Photo too large — kid added without photo.","info");
        }
      } catch(e) { console.error("Kid photo failed:", e); toast("Photo failed.","info"); }
    }
    await createDefaultTasks(currentParent.uid,kid.id,age);
    kidsList.push(kid); renderKids();
    document.getElementById("kid-name").value=""; document.getElementById("kid-age").value=""; document.getElementById("kid-avatar").value="🌟";
    document.getElementById("kid-photo-input").value=""; document.getElementById("kid-photo-preview").style.display="none"; document.getElementById("kid-photo-placeholder").style.display="flex";
    selectedPhoto=null; toast(`${kid.name} added! Code: ${kid.code} 🎉`,"success");
  } catch(err) { toast("Failed to add kid.","error"); console.error(err); } finally { setLoading(btn,false); }
});

window.handleDeleteKid = async (kidId,kidName) => { if (!confirm(`Delete ${kidName}?`)) return; try { await deleteKid(kidId); kidsList=kidsList.filter(k=>k.id!==kidId); renderKids(); toast(`${kidName} removed.`,"info"); } catch(err) { toast("Failed.","error"); } };
window.handleRegenCode = async (kidId) => {
  try { const code=await regenerateKidCode(kidId); const idx=kidsList.findIndex(k=>k.id===kidId); if(idx!==-1) kidsList[idx].code=code; const el=document.getElementById(`code-${kidId}`); if(el){el.textContent=code;el.classList.add("code-flash");setTimeout(()=>el.classList.remove("code-flash"),800);} toast(`New code: ${code}`,"success"); }
  catch(err) { toast("Failed.","error"); }
};

// ── Bonus Stars ───────────────────────────────────────────────
let bonusKidId=null,bonusKidName=null;
window.openBonusStars  = (id,name) => { bonusKidId=id; bonusKidName=name; document.getElementById("modal-bonus-kid-name").textContent=`Bonus Stars for ${name}`; document.getElementById("bonus-stars-input").value="1"; document.getElementById("bonus-reason-input").value=""; document.getElementById("modal-bonus").classList.add("open"); };
window.closeBonusStars = () => document.getElementById("modal-bonus").classList.remove("open");
document.getElementById("btn-save-bonus")?.addEventListener("click", async () => {
  const btn=document.getElementById("btn-save-bonus"); const stars=parseInt(document.getElementById("bonus-stars-input").value)||1; setLoading(btn,true);
  try { const total=await addBonusStars(bonusKidId,stars); const completed=await checkGoalCompletion(bonusKidId,total); completed.forEach(g=>celebrate(`🎉 Goal Reached!\n"${g.title}"`)); closeBonusStars(); toast(`⭐ ${stars} bonus star${stars>1?"s":""} = ${starsToMoney(stars,financeSettings)} given to ${bonusKidName}!`,"success"); }
  catch(err) { toast("Failed.","error"); } finally { setLoading(btn,false); }
});

// ── Add Task ──────────────────────────────────────────────────
let taskKidId=null,taskKidName=null;
window.openAddTask  = (id,name) => {
  taskKidId=id; taskKidName=name;
  document.getElementById("modal-task-kid-name").textContent=`Task for ${name}`;
  document.getElementById("task-title-input").value="";
  document.getElementById("task-desc-input").value="";
  document.getElementById("task-stars-input").value="1";
  selectTaskType("daily");
  populateValueSelector();
  document.getElementById("modal-add-task").classList.add("open");
};
window.closeAddTask = () => document.getElementById("modal-add-task").classList.remove("open");
document.getElementById("btn-save-task")?.addEventListener("click", async () => {
  const btn=document.getElementById("btn-save-task"); const title=document.getElementById("task-title-input").value.trim(); const desc=document.getElementById("task-desc-input").value.trim(); const stars=parseInt(document.getElementById("task-stars-input").value)||1; const taskType=document.getElementById("task-type-input")?.value||"daily";
  if (!title) { toast("Please enter a task title.","error"); return; } setLoading(btn,true);
  try { await createTask(currentParent.uid,taskKidId,title,desc,stars,taskType); closeAddTask(); toast(`Task added for ${taskKidName}! ⭐`,"success"); }
  catch(err) { toast("Failed.","error"); } finally { setLoading(btn,false); }
});

// ── Approve / Reject ──────────────────────────────────────────
window.handleApprove = async (taskId,kidId,stars,title,currentStreak) => {
  try {
    const result=await approveTask(taskId,kidId,stars,currentStreak||0);
    toast(`✅ Approved! ${stars}⭐ = ${starsToMoney(stars,financeSettings)} for "${title}"`,"success");
    if (result.streakBonus) setTimeout(()=>toast(`🔥 ${result.streak}-task streak! Bonus +2⭐`,"success"),1500);
    const newStars=await getStarBalance(kidId);
    const completed=await checkGoalCompletion(kidId,newStars);
    completed.forEach(g=>celebrate(`🎉 Goal Reached!\n"${g.title}"`));
    if (newStars === stars && !localStorage.getItem(`sk_first_salary_${kidId}`)) {
      const savedKids = window.SK ? window.SK.getKids() : [];
      const prevKid   = currentKid;
      const matchKid  = savedKids.find(k => k.id === kidId);
      if (matchKid) currentKid = matchKid;
      showFirstSalary(title, stars);
      currentKid = prevKid;
    }
    loadPendingApprovals();
  } catch(err) { toast("Failed.","error"); console.error(err); }
};
// ── Reject with reason modal ──────────────────────────────────
let rejectTaskId = null, rejectTaskTitle = null;
window.openRejectModal = (taskId, title) => {
  rejectTaskId    = taskId;
  rejectTaskTitle = title;
  document.getElementById("reject-reason-input").value = "";
  document.getElementById("reject-modal-task-title").textContent = `Reject: "${title}"`;
  document.getElementById("modal-reject-task").classList.add("open");
};
window.closeRejectModal = () => document.getElementById("modal-reject-task").classList.remove("open");

window.confirmRejectTask = async () => {
  const btn    = document.getElementById("btn-confirm-reject");
  const reason = document.getElementById("reject-reason-input")?.value.trim();
  if (!reason) { toast("Please give a reason so the kid knows what to fix.", "error"); return; }
  if(btn) { btn.disabled=true; btn.textContent="Sending…"; }
  try {
    await rejectTaskWithReason(rejectTaskId, reason);
    closeRejectModal();
    toast("❌ Task sent back with feedback.", "info");
    loadPendingApprovals();
  } catch(err) { toast("Failed.", "error"); console.error(err); }
  finally { if(btn) { btn.disabled=false; btn.textContent="Send Feedback ❌"; } }
};

window.handleReject = (taskId, title) => openRejectModal(taskId, title);

// ═══════════════════════════════════════════════════════════════
// KID LOGIN
// ═══════════════════════════════════════════════════════════════
document.getElementById("btn-kid-login")?.addEventListener("click", async () => {
  const btn=document.getElementById("btn-kid-login"); const code=document.getElementById("kid-code-input").value.trim();
  if (code.length!==6||!/^\d+$/.test(code)) { toast("Please enter a valid 6-digit code.","error"); return; } setLoading(btn,true);
  try {
    const kid=await loginKidByCode(code); if (!kid) { toast("Code not found. Ask your parent!","error"); return; }
    currentKid=kid;
    saveKidSession(kid);
    // Save to thumbnail list immediately
    if (typeof window.SK_saveKidDirect === "function") {
      window.SK_saveKidDirect(kid.id, kid.name, kid.avatarEmoji||"🌟", kid.photoURL||null, kid.code, kid.parentId);
    }
    if (typeof window.SK_renderKids === "function") window.SK_renderKids();
    // Load parent's finance settings for money display
    financeSettings = await getFinanceSettings(kid.parentId);
    await showKidDashboard(kid);
    toast(`Hi ${kid.name}! Let's have a great day! 🌟`,"success");
  } catch(err) { toast("Error: "+(err?.message||"Unknown").slice(0,60),"error"); console.error(err); }
  finally { setLoading(btn,false); }
});

// ═══════════════════════════════════════════════════════════════
// KID DASHBOARD
// ═══════════════════════════════════════════════════════════════
async function showKidDashboard(kid) {
  const av=document.getElementById("kid-dashboard-avatar");
  av.innerHTML=kid.photoURL?`<img src="${kid.photoURL}" class="kid-dash-photo" />`:(kid.avatarEmoji||"🌟");
  document.getElementById("kid-dashboard-name").textContent=`Hi, ${kid.name}!`;

  const resetCount = await resetRecurringTasks(kid.id);

  // Load prayer times if family is faith-based
  if (kid.parentId) {
    try {
      const { city, country } = getPrayerCity();
      if (city) {
        const timings = await fetchPrayerTimes(city, country);
        const next    = getNextPrayer(timings);
        const prayerBar = document.getElementById("prayer-times-bar");
        if (prayerBar) {
          prayerBar.style.display = "block";
          prayerBar.innerHTML = `
            <div class="prayer-next">
              ${next.emoji} Next: <strong>${next.name}</strong> at ${formatPrayerTime(next.time)}
              <span class="prayer-countdown">(${next.minutesLeft < 60
                ? next.minutesLeft + " min"
                : Math.floor(next.minutesLeft/60) + "h " + (next.minutesLeft%60) + "m"} away)</span>
            </div>`;
          startPrayerAlerts(timings, kid.name);
        }
      }
    } catch(e) { console.log("Prayer times not available:", e.message); }
  }

  const stars = await getStarBalance(kid.id);
  const money = starsToMoney(stars, financeSettings);
  document.getElementById("kid-dashboard-stars").textContent = `⭐ ${stars} Stars`;
  document.getElementById("kid-dashboard-money").textContent = `💰 ${money}`;

  await loadKidTasks(kid);
  await loadKidGoalsView(kid.id, stars);
  // Load family values
  try { familyValues = await getFamilyValues(kid.parentId); } catch(e) {}
  showKidTab("tasks");
  await loadKidJobsSection(kid.id);
  // Check for unread praise → show badge on Praise tab
  try {
    const praises = await getPraiseForKid(kid.id);
    const unread  = praises.filter(p => !p.read).length;
    const badge   = document.getElementById("kid-praise-badge");
    if (badge && unread > 0) { badge.textContent = unread; badge.style.display = "inline-flex"; }
    else if (badge) badge.style.display = "none";
  } catch(e) {}
  // Check for active rush immediately and then every 30s
  checkForActiveRush(kid).catch(e => console.log('Rush check:', e.message));
  if (window._rushPollInterval) clearInterval(window._rushPollInterval);
  window._rushPollInterval = setInterval(() => {
    if (currentKid) checkForActiveRush(currentKid).catch(()=>{});
  }, 30000);

  // ── Instant rush trigger via localStorage broadcast ────────
  // Fires immediately when parent taps Start on the SAME device/browser
  if (!window._rushBroadcastListener) {
    window._rushBroadcastListener = (e) => {
      if (e.key !== "sk_rush_broadcast" || !e.newValue) return;
      try {
        const data = JSON.parse(e.newValue);
        if (!currentKid) return;
        if (!data.kidIds?.includes(currentKid.id)) return;
        if (kidRushId === data.rushId) return;
        // Fetch fresh rush data and show immediately
        getActiveRushForKid(currentKid.parentId).then(rush => {
          if (!rush) return;
          kidRushId   = rush.id;
          kidRushData = rush;
          playRushStartSound();
          showKidRushOverlay(rush);
        }).catch(()=>{});
      } catch(err) {}
    };
    window.addEventListener("storage", window._rushBroadcastListener);
  }
  // Load achievements
  await loadKidAchievements(kid.id);
  scheduleMidnightRefresh();
  showScreen("screen-kid-dashboard");
}

// ── Kid tasks ──────────────────────────────────────────────────
async function loadKidTasks(kid) {
  const tasks=await getTasksForKid(kid.id); const el=document.getElementById("kid-tasks-list"); if (!el) return;
  const active  = tasks.filter(t=>t.status===STATUS.PENDING||t.status===STATUS.REJECTED);
  const waiting = tasks.filter(t=>t.status===STATUS.SUBMITTED);
  const approved= tasks.filter(t=>t.status===STATUS.APPROVED);
  let html="";
  if (!tasks.length) html=`<p class="empty-state">No tasks yet! Ask your parent. 🌟</p>`;

  if (active.length) {
    // Split regular vs entrepreneur
    const regular = active.filter(t => !t.isEntrepreneur);
    const jobs    = active.filter(t => t.isEntrepreneur);
    if (regular.length) {
      // Separate faith tasks from regular tasks
      const faithTasks   = regular.filter(t => t.isFaith);
      const normalTasks  = regular.filter(t => !t.isFaith);

      if (faithTasks.length) {
        // Sort by Islamic daily order
        const FAITH_ORDER = [
          "fajr","morning dhikr","morning","duha","dhuhr","zuhr","zohar","zuhur",
          "asr","maghrib","evening dhikr","evening","isha","night","quran","dua","learn"
        ];
        const faithSorted = [...faithTasks].sort((a, b) => {
          const ai = FAITH_ORDER.findIndex(k => a.title.toLowerCase().includes(k));
          const bi = FAITH_ORDER.findIndex(k => b.title.toLowerCase().includes(k));
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
        const faithDone  = faithSorted.filter(t => t.status === STATUS.APPROVED || t.status === STATUS.SUBMITTED).length;
        const faithTotal = faithSorted.length;
        html += `
        <div class="faith-strip">
          <div class="faith-strip__header">
            <span class="faith-strip__title">🕌 Faith Journey</span>
            <span class="faith-strip__progress">${faithDone}/${faithTotal} done</span>
          </div>
          <div class="faith-strip__scroll">
            ${faithSorted.map(t => {
              const done = t.status === STATUS.APPROVED || t.status === STATUS.SUBMITTED;
              const emojiMatch = t.title.match(/\p{Emoji_Presentation}/u);
              const emoji = emojiMatch ? emojiMatch[0] : "🕌";
              const nameClean = t.title.replace(/\p{Emoji_Presentation}/gu,"").trim();
              return `<div class="faith-pill ${done ? "faith-pill--done" : ""}">
                <div class="faith-pill__emoji">${emoji}</div>
                <div class="faith-pill__name">${nameClean}</div>
                <div class="faith-pill__stars">⭐ ${t.stars}</div>
                ${done
                  ? `<div class="faith-pill__btn faith-pill__btn--done">✅ Done!</div>`
                  : `<button class="faith-pill__btn" onclick="handleJobDone('${t.id}')">Tap Done</button>`}
              </div>`;
            }).join("")}
          </div>
        </div>`;
      }

      if (normalTasks.length) {
        html += `<div class="task-section-title">📋 My Tasks</div>`;
        html += normalTasks.map(t => {
          const typeBadge   = t.taskType==="daily"?`<span class="type-badge type-badge--daily">🔄 Daily</span>`:t.taskType==="weekly"?`<span class="type-badge type-badge--weekly">📅 Weekly</span>`:`<span class="type-badge type-badge--onetime">1️⃣ One-time</span>`;
          const streakBadge = (t.streak&&t.streak>1)?`<span class="streak-badge">🔥 ${t.streak}</span>`:"";
          const rejReason   = t.status===STATUS.REJECTED && t.rejectionReason
            ? `<div class="rejection-reason">❌ Parent says: <em>"${t.rejectionReason}"</em></div>` : "";
          return `<div class="task-card task-card--pending ${t.status===STATUS.REJECTED?"task-card--rejected":""}">
            <div class="task-card__info">
              <div class="task-card__title-row">${typeBadge}${streakBadge}</div>
              <div class="task-card__title">${t.title}</div>
              ${t.description?`<div class="task-card__desc">${t.description}</div>`:""}
              <div class="task-card__stars">⭐ ${t.stars} = ${starsToMoney(t.stars,financeSettings)}</div>
              ${rejReason}
            </div>
            <button class="btn btn--sm btn--success" onclick="handleJobDone('${t.id}')">✅ Done!</button>
          </div>`;
        }).join("");
      }
    }
    if (jobs.length) {
      html += `<div class="task-section-title">💼 Entrepreneur Jobs</div>`;
      html += jobs.map(t => {
        const rejReason = t.status===STATUS.REJECTED && t.rejectionReason
          ? `<div class="rejection-reason">❌ Parent says: <em>"${t.rejectionReason}"</em></div>` : "";
        return `<div class="task-card task-card--job ${t.status===STATUS.REJECTED?"task-card--rejected":""}">
          <div class="task-card__info">
            <div class="task-card__title">${t.title}</div>
            ${t.description?`<div class="task-card__desc">${t.description}</div>`:""}
            <div class="task-card__stars">⭐ ${t.stars} = ${starsToMoney(t.stars,financeSettings)}</div>
            ${rejReason}
          </div>
          <button class="btn btn--sm btn--success" onclick="handleJobDone('${t.id}')">✅ Done!</button>
        </div>`;
      }).join("");
    }
  }
  if (waiting.length) {
    html+=`<div class="task-section-title">⏳ Waiting Approval</div>`;
    html+=waiting.map(t=>`<div class="task-card task-card--submitted">
      <div class="task-card__info">
        <div class="task-card__title">${t.title}</div>
        <div class="task-card__stars">⭐ ${t.stars} = ${starsToMoney(t.stars,financeSettings)}</div>
        <div id="kid-photo-wrap-${t.id}"></div>
      </div>
      <span class="task-badge task-badge--waiting">Waiting…</span>
    </div>`).join("");
    // Load photos for waiting tasks
    for (const t of waiting) {
      const wrap = document.getElementById(`kid-photo-wrap-${t.id}`);
      if (!wrap) continue;
      const photo = await loadTaskPhoto(t.id);
      if (photo) wrap.innerHTML = `<img src="${photo}" class="submission-photo-thumb" onclick="showPhotoFull(this.src)" />`;
    }
  }
  if (approved.length) {
    html+=`<div class="task-section-title">✅ Completed</div>`;
    html+=approved.map(t=>`<div class="task-card task-card--approved"><div class="task-card__info"><div class="task-card__title">${t.title}</div><div class="task-card__stars">⭐ +${t.stars} = +${starsToMoney(t.stars,financeSettings)}</div></div><span class="task-badge task-badge--approved">Done! ⭐</span></div>`).join("");
  }
  el.innerHTML=html;
}

// ── Submit task modal (with optional photo) ──────────────────
let submitTaskId = null;
window.openSubmitTaskModal = (taskId, title) => {
  submitTaskId = taskId;
  const displayTitle = (!title || title === "Task") ? "" : `"${title}"`;
  document.getElementById("submit-task-title").textContent = displayTitle ? `✅ ${displayTitle}` : "✅ Mark as done!";
  document.getElementById("submit-task-photo-preview").style.display = "none";
  document.getElementById("submit-task-photo-placeholder").style.display = "flex";
  document.getElementById("submit-task-photo-input").value = "";
  document.getElementById("modal-submit-task").classList.add("open");
};
window.closeSubmitTaskModal = () => document.getElementById("modal-submit-task").classList.remove("open");

// photo preview for submission
document.getElementById("submit-task-photo-input")?.addEventListener("change", e => {
  const file = e.target.files[0]; if (!file) return;
  const prev = document.getElementById("submit-task-photo-preview");
  prev.src = URL.createObjectURL(file);
  prev.style.display = "block";
  document.getElementById("submit-task-photo-placeholder").style.display = "none";
});

// ── Photo stored in /taskPhotos/{taskId} ─────────────────────
async function saveTaskPhoto(taskId, base64) {
  const { setDoc, doc, serverTimestamp } = await import(
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"
  );
  await setDoc(doc(db, "taskPhotos", taskId), {
    taskId, photo: base64, savedAt: serverTimestamp()
  });
  console.log("✅ Photo saved to taskPhotos/", taskId);
}

async function loadTaskPhoto(taskId) {
  try {
    const { getDoc, doc } = await import(
      "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"
    );
    const snap = await getDoc(doc(db, "taskPhotos", taskId));
    return snap.exists() ? snap.data().photo : null;
  } catch(e) { console.error("loadTaskPhoto:", e); return null; }
}

// ── Offline queue ─────────────────────────────────────────────
window._offlineQueue = JSON.parse(localStorage.getItem("sk_offline_queue")||"[]");

function saveOfflineQueue() {
  localStorage.setItem("sk_offline_queue", JSON.stringify(window._offlineQueue));
}

async function flushOfflineQueue() {
  if (!navigator.onLine || !window._offlineQueue.length) return;
  const queue = [...window._offlineQueue];
  window._offlineQueue = [];
  saveOfflineQueue();
  for (const item of queue) {
    try {
      if (item.type === "submitTask") {
        await submitTaskWithPhoto(item.taskId, item.photo || null);
      } else if (item.type === "rushTask") {
        const { updateDoc, doc: fsDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        await updateDoc(fsDoc(db, "activeRush", item.rushId), {
          [`progress.${item.kidId}.${item.taskId}`]: {
            done:true, doneAtMs:Date.now(),
            elapsedSecs:item.elapsed, stars:item.earned
          }
        });
        await addBonusStars(item.kidId, item.earned);
      }
    } catch(e) {
      window._offlineQueue.push(item);
      saveOfflineQueue();
    }
  }
  if (queue.length) toast("✅ Synced offline tasks!", "success");
}

// Flush when connection returns
window.addEventListener("online", () => {
  toast("Back online — syncing... 🔄", "info");
  setTimeout(flushOfflineQueue, 1000);
});

window.confirmSubmitTask = async () => {
  const btn  = document.getElementById("btn-confirm-submit-task");
  const file = document.getElementById("submit-task-photo-input")?.files[0];
  if(btn) { btn.disabled=true; btn.textContent="Sending…"; }

  // ── Offline: queue and show optimistic UI ─────────────────
  if (!navigator.onLine) {
    window._offlineQueue.push({ type: "submitTask", taskId: submitTaskId, photo: null });
    saveOfflineQueue();
    closeSubmitTaskModal();
    toast("📶 Offline — task queued and will sync when online!", "info");
    // Optimistically update the UI
    await loadKidTasks(currentKid);
    if(btn) { btn.disabled=false; btn.textContent="Send for Approval"; }
    return;
  }

  try {
    // Step 1: Submit task first (no photo) — always succeeds
    await submitTaskWithPhoto(submitTaskId, null);

    // Step 2: If photo selected, save it to separate Firestore doc
    // /taskPhotos/{taskId} — avoids 1MB task document limit
    if (file) {
      try {
        toast("Processing photo… 📸", "info");
        // Aggressive compression: 300px, 40% quality → ~30-50KB
        const b64 = await imageToBase64(file, 300, 0.4);
        const kb  = Math.round(b64.length / 1024);

        if (b64.length <= 800000) {
          // Save to separate collection to avoid task doc size limit
          await saveTaskPhoto(submitTaskId, b64);
          toast(`🚀 Sent with photo (${kb}KB)! Tap 🔄 Refresh`, "success");
        } else {
          toast(`🚀 Sent! Photo too large (${kb}KB) — try a smaller image.`, "info");
        }
      } catch(photoErr) {
        console.error("Photo save failed:", photoErr);
        toast("🚀 Sent! Photo failed — " + (photoErr.message||"error"), "info");
      }
    } else {
      toast("🚀 Sent! Tap 🔄 Refresh after parent approves", "success");
    }

    closeSubmitTaskModal();
    await loadKidTasks(currentKid);
  } catch(err) {
    toast("Failed: " + (err.message||err.code||"error"), "error");
    console.error("Submit failed:", err);
  } finally {
    if(btn) { btn.disabled=false; btn.textContent="🚀 Send to Parent!"; }
  }
};

// Clean handler for Done buttons — avoids quote issues in onclick
window.handleJobDone = (taskId) => openSubmitTaskModal(taskId, "");
window.handleTaskDone = (taskId) => openSubmitTaskModal(taskId, "");

// ─ Refresh kid dashboard ────────────────────────────────────────────────────────────
window.refreshKidDashboard = async () => {
  if (!currentKid) return;
  const kid = currentKid; // capture to prevent null mid-async
  const btn = document.getElementById("btn-kid-refresh");
  if (btn) { btn.textContent = "⏳ Checking…"; btn.disabled = true; }
  try {
    await resetRecurringTasks(kid.id);
    const stars = await getStarBalance(kid.id);
    const money = starsToMoney(stars, financeSettings);
    document.getElementById("kid-dashboard-stars").textContent = `⭐ ${stars} Stars`;
    document.getElementById("kid-dashboard-money").textContent = `💰 ${money}`;
    await loadKidTasks(currentKid);
    await loadKidGoalsView(kid.id, stars);
    // Check achievements
    try {
      const kidVals = familyValues.length ? familyValues : await getFamilyValues(kid.parentId).catch(()=>[]);
      const stats   = await getKidStats(kid.id, kidVals);
      const earned  = await checkAchievements(kid.id, stats);
      if (earned.length > 0) {
        await loadKidAchievements(kid.id);
        // Award bonus stars for each achievement
        let bonusTotal = 0;
        for (const a of earned) {
          const bonus = 5; // 5 bonus stars per achievement
          await addBonusStars(kid.id, bonus);
          bonusTotal += bonus;
        }
        // Refresh star display
        const newStars = await getStarBalance(kid.id);
        document.getElementById("kid-dashboard-stars").textContent = `⭐ ${newStars} Stars`;
        document.getElementById("kid-dashboard-money").textContent = `💰 ${starsToMoney(newStars, financeSettings)}`;
        earned.forEach((a, i) => setTimeout(() =>
          celebrate(`🏆 Achievement Unlocked!
${a.emoji} ${a.title}
+5⭐ Bonus Stars!`, a.emoji+"🏆"+a.emoji)
        , 900*(i+1)));
        toast(`🏆 ${earned.length} achievement${earned.length>1?"s":""} unlocked! +${bonusTotal}⭐ bonus!`, "success");
      } else {
        toast("✅ All updated!", "success");
      }
    } catch(e) { console.error("achievement check:", e); toast("✅ Stars updated!", "success"); }
    // Refresh praise badge
    try {
      const praises = await getPraiseForKid(currentKid.id);
      const unread  = praises.filter(p=>!p.read).length;
      const badge   = document.getElementById("kid-praise-badge");
      if (badge && unread>0) { badge.textContent=unread; badge.style.display="inline-flex"; }
      else if (badge) badge.style.display="none";
    } catch(e) {}
  } catch(e) {
    toast("Refresh failed. Try again.","error"); console.error(e);
  } finally {
    if (btn) { btn.textContent = "🔄 Refresh"; btn.disabled = false; }
  }
};

// ═══════════════════════════════════════════════════════════════
// KID GOALS
// ═══════════════════════════════════════════════════════════════
let parentRewardsForKid = [];

async function loadKidGoalsView(kidId, currentStars) {
  const el=document.getElementById("kid-goals-list"); if (!el) return;
  const goals=await getGoalsForKid(kidId);
  const active   =goals.find(g=>g.status===GOAL_STATUS.ACTIVE);
  const completed=goals.filter(g=>g.status===GOAL_STATUS.COMPLETED);
  const requested=goals.filter(g=>g.status===GOAL_STATUS.REQUESTED);
  const redeemed =goals.filter(g=>g.status==="redeemed");
  let html="";
  if (active) {
    const pct=Math.min(100,Math.round((currentStars/active.targetStars)*100));
    const reached=currentStars>=active.targetStars;
    html+=`<div class="task-section-title">🎯 My Goal</div>
    <div class="goal-card ${reached?"goal-card--reached":""}">
      <div class="goal-emoji">${active.emoji}</div>
      <div class="goal-info">
        <div class="goal-title">${active.title}</div>
        <div class="goal-target">⭐ ${active.targetStars} stars = ${starsToMoney(active.targetStars,financeSettings)}</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="progress-label">⭐ ${currentStars} / ${active.targetStars} — ${pct}% there!</div>
        ${reached?`<button class="btn btn--success mt-8" onclick="handleRequestRedeem('${active.id}','${active.title}')">🎁 I'm Ready! Ask Parent to Redeem</button>`:""}
      </div>
      <button class="goal-delete-btn" title="Change goal" onclick="openPickGoal()">✏️</button>
    </div>`;
  }
  if (requested.length) {
    html+=`<div class="task-section-title">⏳ Waiting for Parent</div>`;
    html+=requested.map(g=>`<div class="goal-card goal-card--waiting"><div class="goal-emoji">${g.emoji}</div><div class="goal-info"><div class="goal-title">${g.title}</div><div class="goal-target">🎁 Ask your parent to approve!</div></div></div>`).join("");
  }
  if (completed.length) {
    html+=`<div class="task-section-title">🏆 Goal Reached!</div>`;
    html+=completed.map(g=>`<div class="goal-card goal-card--done"><div class="goal-emoji">${g.emoji}</div><div class="goal-info"><div class="goal-title">${g.title}</div><div class="goal-target">You did it! ⭐${g.targetStars} stars</div><button class="btn btn--success mt-8" onclick="handleRequestRedeem('${g.id}','${g.title}')">🎁 Request Reward</button></div></div>`).join("");
  }
  if (redeemed.length) {
    html+=`<div class="task-section-title">🎁 Past Rewards</div>`;
    html+=redeemed.map(g=>`<div class="goal-card goal-card--redeemed"><div class="goal-emoji">${g.emoji}</div><div class="goal-info"><div class="goal-title">${g.title}</div><div class="goal-target">🎉 Enjoyed!</div></div></div>`).join("");
  }
  html+=`<div style="margin-top:16px;"><button class="btn btn--${active?"secondary":"kid"}" onclick="openPickGoal()">${active?"🔄 Browse & Change Goal":"🎯 Pick a Goal"}</button></div>`;
  el.innerHTML=html;
}

// ── Kid entrepreneur jobs ─────────────────────────────────────
async function loadKidJobsSection(kidId) {
  const el = document.getElementById("kid-jobs-list"); if (!el) return;
  const jobs    = await getEntrepreneurJobs(currentKid.parentId);
  const myTasks = await getTasksForKid(kidId);
  const claimed = myTasks.filter(t => t.isEntrepreneur && (t.status==="pending"||t.status==="submitted")).map(t => t.jobId);
  // Show badge on Jobs tab with available job count
  const available = jobs.filter(j => !claimed.includes(j.id)).length;
  const badge = document.getElementById("kid-jobs-badge");
  if (badge) { badge.textContent = available; badge.style.display = available > 0 ? "inline-flex" : "none"; }
  if (!jobs.length) { el.innerHTML=`<p class="empty-state">No jobs available yet.</p>`; return; }
  el.innerHTML = jobs.map(j => {
    const isClaimed = claimed.includes(j.id);
    return `<div class="job-kid-item ${isClaimed?"job-kid-item--claimed":""}">
      <span class="job-emoji">${j.emoji}</span>
      <div class="job-info">
        <div class="job-title">${j.title}</div>
        ${j.description?`<div class="job-desc">${j.description}</div>`:""}
        <div class="job-stars">⭐ ${j.stars} = ${starsToMoney(j.stars,financeSettings)}</div>
      </div>
      ${isClaimed
        ? `<span class="task-badge task-badge--waiting">Claimed</span>`
        : `<button class="btn btn--sm btn--accent" onclick="handleClaimJob('${j.id}')">Take Job</button>`}
    </div>`;
  }).join("");
}

// ── Earnings Screen ───────────────────────────────────────────
async function loadKidEarnings(kid) {
  const el = document.getElementById("kid-earnings-view"); if (!el) return;
  el.innerHTML = `<p class="empty-state">Loading earnings…</p>`;
  try {
    const allTasks   = await getTasksForKid(kid.id);
    const approved   = allTasks.filter(t => t.status === "approved");
    const totalStars = approved.reduce((s,t) => s+(t.stars||0), 0);
    const totalMoney = starsToMoney(totalStars, financeSettings);
    // This month
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth  = approved.filter(t => {
      if (!t.approvedAt) return false;
      const d = t.approvedAt.toDate ? t.approvedAt.toDate() : new Date(t.approvedAt);
      return d >= monthStart;
    });
    const monthStars = thisMonth.reduce((s,t) => s+(t.stars||0), 0);
    const monthMoney = starsToMoney(monthStars, financeSettings);
    // Entrepreneur earnings
    const entrStars  = approved.filter(t => t.isEntrepreneur).reduce((s,t) => s+(t.stars||0), 0);
    const entrMoney  = starsToMoney(entrStars, financeSettings);
    // Faith earnings
    const faithStars = approved.filter(t => t.isFaith).reduce((s,t) => s+(t.stars||0), 0);
    const faithMoney = starsToMoney(faithStars, financeSettings);
    // Regular task earnings
    const regStars   = totalStars - entrStars - faithStars;
    const regMoney   = starsToMoney(regStars, financeSettings);
    // Current balance
    const balance    = await getStarBalance(kid.id);
    const balMoney   = starsToMoney(balance, financeSettings);

    el.innerHTML = `
    <div class="card" style="background:linear-gradient(135deg,#1a1040,#302b63);border:none;color:#fff;margin-bottom:12px;">
      <div style="font-size:0.75rem;opacity:0.7;font-weight:700;letter-spacing:1px;margin-bottom:4px;">💰 TOTAL EARNED ALL TIME</div>
      <div style="font-size:2.4rem;font-weight:900;color:#FFD93D;line-height:1;">${totalMoney}</div>
      <div style="font-size:0.9rem;opacity:0.8;margin-top:4px;">= ${totalStars} ⭐ stars earned</div>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.15);display:flex;justify-content:space-between;">
        <div>
          <div style="font-size:0.7rem;opacity:0.6;">Current Balance</div>
          <div style="font-size:1rem;font-weight:800;color:#6bcb77;">${balMoney}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.7rem;opacity:0.6;">This Month</div>
          <div style="font-size:1rem;font-weight:800;color:#ff9f43;">${monthMoney}</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:12px;">
      <div style="font-size:0.85rem;font-weight:800;color:var(--color-text);margin-bottom:12px;">📊 Earnings Breakdown</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.2rem;">📋</span>
            <div>
              <div style="font-size:0.82rem;font-weight:700;color:var(--color-text);">Daily Tasks</div>
              <div style="font-size:0.72rem;color:var(--color-muted);">${regStars} stars</div>
            </div>
          </div>
          <div style="font-size:0.9rem;font-weight:800;color:var(--color-primary);">${regMoney}</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.2rem;">💼</span>
            <div>
              <div style="font-size:0.82rem;font-weight:700;color:var(--color-text);">Entrepreneur Jobs</div>
              <div style="font-size:0.72rem;color:var(--color-muted);">${entrStars} stars</div>
            </div>
          </div>
          <div style="font-size:0.9rem;font-weight:800;color:#ff9f43;">${entrMoney}</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.2rem;">🕌</span>
            <div>
              <div style="font-size:0.82rem;font-weight:700;color:var(--color-text);">Faith Journey</div>
              <div style="font-size:0.72rem;color:var(--color-muted);">${faithStars} stars</div>
            </div>
          </div>
          <div style="font-size:0.9rem;font-weight:800;color:#1a936f;">${faithMoney}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div style="font-size:0.85rem;font-weight:800;color:var(--color-text);margin-bottom:4px;">🚀 Entrepreneur Level</div>
      <div style="font-size:0.75rem;color:var(--color-muted);margin-bottom:12px;">Keep completing jobs to level up!</div>
      <div style="background:var(--color-bg-2);border-radius:12px;padding:12px;text-align:center;">
        ${entrStars === 0
          ? `<div style="font-size:1.8rem;">🌱</div><div style="font-size:0.85rem;font-weight:700;color:var(--color-text);">Beginner</div><div style="font-size:0.72rem;color:var(--color-muted);">Complete your first job to start!</div>`
          : entrStars < 50
          ? `<div style="font-size:1.8rem;">⚡</div><div style="font-size:0.85rem;font-weight:700;color:var(--color-text);">Rising Star</div><div style="font-size:0.72rem;color:var(--color-muted);">Earned ${entrMoney} from jobs so far!</div>`
          : entrStars < 150
          ? `<div style="font-size:1.8rem;">💼</div><div style="font-size:0.85rem;font-weight:700;color:var(--color-text);">Junior Entrepreneur</div><div style="font-size:0.72rem;color:var(--color-muted);">Earned ${entrMoney} from jobs!</div>`
          : `<div style="font-size:1.8rem;">🚀</div><div style="font-size:0.85rem;font-weight:700;color:var(--color-text);">Future CEO!</div><div style="font-size:0.72rem;color:var(--color-muted);">Earned ${entrMoney} from jobs — incredible!</div>`}
      </div>
    </div>`;
  } catch(e) { el.innerHTML=`<p class="empty-state">Could not load earnings.</p>`; console.error(e); }
}

// ── First Salary Celebration ──────────────────────────────────
function showFirstSalary(taskTitle, stars) {
  const key = `sk_first_salary_${currentKid?.id}`;
  if (localStorage.getItem(key)) return; // already shown
  localStorage.setItem(key, "1");
  const modal = document.getElementById("modal-first-salary");
  if (!modal) return;
  document.getElementById("first-salary-name").textContent = `Congratulations, ${currentKid?.name}! 🌟`;
  document.getElementById("first-salary-amount").textContent = starsToMoney(stars, financeSettings);
  document.getElementById("first-salary-task").textContent = `"${taskTitle}"`;
  document.getElementById("first-salary-stars").textContent = `⭐ ${stars} stars earned`;
  modal.style.display = "flex";
}

window.closeFirstSalary = () => {
  const modal = document.getElementById("modal-first-salary");
  if (modal) modal.style.display = "none";
};

window.handleClaimJob = async (jobId) => {
  const jobs = await getEntrepreneurJobs(currentKid.parentId);
  const job  = jobs.find(j => j.id === jobId);
  if (!job) return;
  try {
    await claimJob(currentKid.parentId, currentKid.id, job);
    toast(`💼 Job claimed: "${job.title}"! Complete it to earn ⭐${job.stars}`, "success");
    const stars = await getStarBalance(currentKid.id);
    await loadKidGoalsView(currentKid.id, stars);
    await loadKidTasks(currentKid);
  } catch(err) { toast("Failed to claim job.", "error"); console.error(err); }
};

window.handleRequestRedeem = async (goalId,title) => {
  try { await requestRedemption(goalId,currentKid.id,title,0); toast("🎁 Redemption requested! Ask your parent.","success"); const stars=await getStarBalance(currentKid.id); await loadKidGoalsView(currentKid.id,stars); }
  catch(err) { toast("Something went wrong.","error"); console.error(err); }
};

window.openPickGoal = async () => {
  const el=document.getElementById("reward-picker-list"); el.innerHTML=`<p class="empty-state">Loading rewards…</p>`; document.getElementById("modal-pick-goal").classList.add("open");
  parentRewardsForKid=await getRewardsForParent(currentKid.parentId);
  if (!parentRewardsForKid.length) { el.innerHTML=`<p class="empty-state">Your parent hasn't added rewards yet!</p>`; return; }
  const stars=await getStarBalance(currentKid.id); const sorted=[...parentRewardsForKid].sort((a,b)=>a.stars-b.stars);
  el.innerHTML=sorted.map(r => {
    const can=stars>=r.stars; const pct=Math.min(100,Math.round((stars/r.stars)*100));
    return `<div class="reward-picker-item ${can?"reward-picker-item--ready":""}" onclick="handlePickGoal('${r.id}')">
      <span class="reward-emoji">${r.emoji}</span>
      <div class="reward-info">
        <div class="reward-title">${r.title}</div>
        <div class="reward-stars">⭐ ${r.stars} = ${starsToMoney(r.stars,financeSettings)} ${can?"— Ready! 🎉":`— ${pct}% saved`}</div>
        ${!can?`<div class="mini-progress"><div class="mini-progress-fill" style="width:${pct}%"></div></div>`:""}
      </div>
      ${can?`<span class="ready-badge">Ready!</span>`:""}
    </div>`;
  }).join("");
};
window.closePickGoal=()=>document.getElementById("modal-pick-goal").classList.remove("open");
window.handlePickGoal=async(rewardId)=>{
  const reward=parentRewardsForKid.find(r=>r.id===rewardId); if (!reward) return;
  try { await createGoalFromReward(currentKid.id,reward); closePickGoal(); toast(`Goal set: "${reward.title}" 🎯`,"success"); const stars=await getStarBalance(currentKid.id); await loadKidGoalsView(currentKid.id,stars); }
  catch(err) { toast("Failed.","error"); console.error(err); }
};

// ── Kid tabs ──────────────────────────────────────────────────
window.showKidTab=(tab)=>{
  document.querySelectorAll(".kid-tab-btn").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll(".kid-tab-panel").forEach(p=>p.classList.remove("active"));
  document.getElementById(`kid-tab-btn-${tab}`)?.classList.add("active");
  document.getElementById(`kid-tab-${tab}`)?.classList.add("active");
  // Load achievements tab
  if (tab==="achievements" && currentKid) {
    loadKidAchievements(currentKid.id);
  }
  // Load praise & values when praise tab is opened
  if (tab==="praise" && currentKid) {
    loadKidPraise(currentKid.id);
    loadKidValuesProgress(currentKid.id);
    // Clear praise badge
    const badge = document.getElementById("kid-praise-badge");
    if (badge) badge.style.display = "none";
  }
  // Load jobs tab
  if (tab==="jobs" && currentKid) {
    loadKidJobsSection(currentKid.id);
  }
  // Load earnings tab
  if (tab==="earnings" && currentKid) {
    loadKidEarnings(currentKid);
  }
};

// ═══════════════════════════════════════════════════════════════
// ACHIEVEMENTS (Sprint 8)
// ═══════════════════════════════════════════════════════════════

async function loadKidAchievements(kidId) {
  const el = document.getElementById("kid-achievements-list");
  if (!el) return;

  try {
    const earned = await getAchievements(kidId);
    const earnedIds = new Set(earned.map(a => a.achievementId));

    let html = `<div class="achievements-grid">`;
    ACHIEVEMENTS.forEach(a => {
      const isEarned = earnedIds.has(a.id);
      html += `
        <div class="achievement-badge ${isEarned ? "achievement-badge--earned" : "achievement-badge--locked"}"
             style="${isEarned ? `border-color:${a.color};background:${a.color}18` : ""}"
             title="${a.title}: ${a.desc}">
          <div class="achievement-emoji">${isEarned ? a.emoji : "🔒"}</div>
          <div class="achievement-title">${a.title}</div>
          ${isEarned ? "" : `<div class="achievement-locked-desc">${a.desc}</div>`}
        </div>`;
    });
    html += `</div>`;

    if (earned.length > 0) {
      html = `<div class="achievement-summary">🏆 ${earned.length} / ${ACHIEVEMENTS.length} Achievements Earned!</div>` + html;
    }
    el.innerHTML = html;
  } catch(e) { el.innerHTML = `<p class="empty-state">Could not load achievements.</p>`; console.error(e); }
}

// ═══════════════════════════════════════════════════════════════
// WEEKLY REPORT (Sprint 8) — Parent view
// ═══════════════════════════════════════════════════════════════

async function getMonthlyStats(kidId) {
  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
  const { getDocs, collection, query, where } = await import(
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"
  );
  const snap = await getDocs(query(collection(db, "tasks"), where("kidId","==",kidId)));
  const tasks = snap.docs.map(d=>d.data());
  const monthTasks = tasks.filter(t => {
    if (!t.approvedAt) return false;
    const d = t.approvedAt.toDate ? t.approvedAt.toDate() : new Date(t.approvedAt);
    return d >= oneMonthAgo;
  });
  // Daily completion rate (tasks done per day this month)
  const dailyMap = {};
  monthTasks.forEach(t => {
    const d = t.approvedAt.toDate ? t.approvedAt.toDate() : new Date(t.approvedAt);
    const key = d.toISOString().slice(0,10);
    dailyMap[key] = (dailyMap[key]||0) + 1;
  });
  const activeDays   = Object.keys(dailyMap).length;
  const avgPerDay    = activeDays ? (monthTasks.length/activeDays).toFixed(1) : 0;
  const starsMonth   = monthTasks.reduce((s,t)=>s+(t.stars||0),0);
  const faithMonth   = monthTasks.filter(t=>t.isFaith).length;
  return { total: monthTasks.length, activeDays, avgPerDay, starsMonth, faithMonth };
}

async function loadWeeklyReports() {
  const el = document.getElementById("weekly-reports-list");
  if (!el || !kidsList.length) {
    if (el) el.innerHTML = `<p class="empty-state">Add kids to see their reports.</p>`;
    return;
  }

  const period = document.getElementById("report-period-select")?.value || "week";
  el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--color-muted);">Loading reports...</div>`;

  const data = await Promise.all(kidsList.map(async kid => {
    const report  = await getWeeklyReport(kid.id);
    const monthly = await getMonthlyStats(kid.id);
    return { kid, report, monthly };
  }));

  // ── Find top performer ──────────────────────────────────────
  const ranked = [...data].sort((a,b) => {
    const sa = period==="week" ? a.report.starsEarned : a.monthly.starsMonth;
    const sb = period==="week" ? b.report.starsEarned : b.monthly.starsMonth;
    return sb - sa;
  });
  const topKid    = ranked[0];
  const topStars  = period==="week" ? topKid.report.starsEarned : topKid.monthly.starsMonth;
  // Weekly key — Monday resets each week
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1);
  const weekKey = weekStart.toDateString();
  const alreadyAwarded = localStorage.getItem(`sk_top_award_${period}_${weekKey}_${topKid.kid.id}`);

  // Build HTML
  let html = "";

  // ── Family Summary Card ──
  const totalStarsWeek  = data.reduce((s,d) => s + (d.report.starsEarned||0), 0);
  const totalTasksWeek  = data.reduce((s,d) => s + (d.report.tasksCompleted||0), 0);
  const totalStarsMonth = data.reduce((s,d) => s + (d.monthly.starsMonth||0), 0);
  const totalTasksMonth = data.reduce((s,d) => s + (d.monthly.total||0), 0);

  html += `
  <div class="rpt-family-summary">
    <div class="rpt-summary-title">📊 Family Overview — ${period==="week"?"This Week":"This Month"}</div>
    <div class="rpt-summary-grid">
      <div class="rpt-summary-stat">
        <div class="rpt-summary-val">${period==="week"?totalTasksWeek:totalTasksMonth}</div>
        <div class="rpt-summary-lbl">Tasks Done</div>
      </div>
      <div class="rpt-summary-stat">
        <div class="rpt-summary-val">⭐ ${period==="week"?totalStarsWeek:totalStarsMonth}</div>
        <div class="rpt-summary-lbl">Stars Earned</div>
      </div>
      <div class="rpt-summary-stat">
        <div class="rpt-summary-val">💰 ${starsToMoney(period==="week"?totalStarsWeek:totalStarsMonth, financeSettings)}</div>
        <div class="rpt-summary-lbl">Family Value</div>
      </div>
      <div class="rpt-summary-stat">
        <div class="rpt-summary-val">${data.length}</div>
        <div class="rpt-summary-lbl">Active Kids</div>
      </div>
    </div>
  </div>`;

  // ── Top Performer Banner ──
  if (topStars > 0) {
    const topAv = topKid.kid.photoURL
      ? `<img src="${topKid.kid.photoURL}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:3px solid #FFD93D;" />`
      : `<div style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:1.8rem;">${topKid.kid.avatarEmoji||"🌟"}</div>`;
    html += `
    <div class="rpt-top-performer">
      <div class="rpt-top-badge">🏆 Top Performer</div>
      <div class="rpt-top-body">
        ${topAv}
        <div style="flex:1;">
          <div class="rpt-top-name">${topKid.kid.name}</div>
          <div class="rpt-top-stars">⭐ ${topStars} stars this ${period==="week"?"week":"month"}</div>
        </div>
        ${!alreadyAwarded ? `
        <button class="rpt-award-btn" onclick="awardTopPerformer('${topKid.kid.id}','${topKid.kid.name}','${period}')">
          🎁 Award +50⭐
        </button>` : `
        <div class="rpt-awarded-badge">✅ Awarded!</div>`}
      </div>
    </div>`;
  }

  // ── Period Tabs ──
  html += `
  <div class="report-period-tabs" style="margin-bottom:16px;">
    <button class="report-tab ${period==="week"?"active":""}" onclick="switchReportPeriod('week')">📅 This Week</button>
    <button class="report-tab ${period==="month"?"active":""}" onclick="switchReportPeriod('month')">🗓 This Month</button>
  </div>`;

  // ── Per Kid Cards ──
  data.forEach(({kid, report, monthly}, kidIndex) => {
    const r     = period === "week" ? report : monthly;
    const tasks = period === "week" ? r.tasksCompleted : r.total;
    const stars = period === "week" ? r.starsEarned    : r.starsMonth;
    const money = starsToMoney(stars, financeSettings);
    const faith = period === "week" ? r.faithTasks     : r.faithMonth;
    const jobs  = period === "week" ? (r.jobsDone||0)  : 0;
    const days  = period === "week" ? (r.activeDays||0): r.activeDays;
    const maxDays = period === "week" ? 7 : 30;

    // Progress percentages
    const taskGoal   = 20; // reasonable weekly goal
    const taskPct    = Math.min(100, Math.round((tasks / taskGoal) * 100));
    const starGoal   = 50;
    const starPct    = Math.min(100, Math.round((stars / starGoal) * 100));
    const activePct  = Math.round((days / maxDays) * 100);
    const faithGoal  = period==="week" ? 35 : 150;
    const faithPct   = Math.min(100, Math.round((faith / faithGoal) * 100));

    // Bar colors
    const getColor = (pct) => pct >= 80 ? "#1a936f" : pct >= 50 ? "#FF9F43" : "#FF6B6B";

    const av = kid.photoURL
      ? `<img src="${kid.photoURL}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:3px solid var(--color-primary);" />`
      : `<div style="width:48px;height:48px;border-radius:50%;background:var(--color-bg);border:3px solid var(--color-primary);display:flex;align-items:center;justify-content:center;font-size:1.6rem;">${kid.avatarEmoji||"🌟"}</div>`;

    const chartId = `chart_${kidIndex}_${Date.now()}`;

    html += `
    <div class="rpt-kid-card">
      <div class="rpt-kid-header">
        ${av}
        <div style="flex:1;">
          <div class="rpt-kid-name">${kid.name}</div>
          <div class="rpt-kid-age">Age ${kid.age||"–"} · ${period==="week"?"Weekly":"Monthly"} Report</div>
        </div>
        <div class="rpt-kid-score">
          <div class="rpt-score-val">⭐ ${stars}</div>
          <div class="rpt-score-lbl">stars</div>
        </div>
      </div>

      <!-- Metric cards row -->
      <div class="rpt-metrics">
        <div class="rpt-metric">
          <div class="rpt-metric-val">${tasks}</div>
          <div class="rpt-metric-lbl">Tasks</div>
        </div>
        <div class="rpt-metric">
          <div class="rpt-metric-val">${money}</div>
          <div class="rpt-metric-lbl">Earned</div>
        </div>
        <div class="rpt-metric">
          <div class="rpt-metric-val">${faith}</div>
          <div class="rpt-metric-lbl">Prayers</div>
        </div>
        <div class="rpt-metric">
          <div class="rpt-metric-val">${days}/${maxDays}</div>
          <div class="rpt-metric-lbl">Active Days</div>
        </div>
      </div>

      <!-- Progress bars -->
      <div class="rpt-bars">
        <div class="rpt-bar-row">
          <div class="rpt-bar-label">📋 Tasks <span class="rpt-bar-pct">${taskPct}%</span></div>
          <div class="rpt-bar-track"><div class="rpt-bar-fill" style="width:${taskPct}%;background:${getColor(taskPct)};"></div></div>
        </div>
        <div class="rpt-bar-row">
          <div class="rpt-bar-label">⭐ Stars <span class="rpt-bar-pct">${starPct}%</span></div>
          <div class="rpt-bar-track"><div class="rpt-bar-fill" style="width:${starPct}%;background:${getColor(starPct)};"></div></div>
        </div>
        <div class="rpt-bar-row">
          <div class="rpt-bar-label">📅 Active Days <span class="rpt-bar-pct">${activePct}%</span></div>
          <div class="rpt-bar-track"><div class="rpt-bar-fill" style="width:${activePct}%;background:${getColor(activePct)};"></div></div>
        </div>
        ${faith > 0 ? `
        <div class="rpt-bar-row">
          <div class="rpt-bar-label">🕌 Prayers <span class="rpt-bar-pct">${faithPct}%</span></div>
          <div class="rpt-bar-track"><div class="rpt-bar-fill" style="width:${faithPct}%;background:${getColor(faithPct)};"></div></div>
        </div>` : ""}
      </div>

      <!-- Donut chart -->
      <div style="display:flex;align-items:center;gap:16px;padding:12px 0 4px;">
        <canvas id="${chartId}" width="90" height="90" style="flex-shrink:0;"></canvas>
        <div style="flex:1;">
          <div style="font-size:0.75rem;font-weight:700;color:var(--color-text);margin-bottom:6px;">Breakdown</div>
          <div class="rpt-legend-item"><span style="background:#6C63FF;"></span>Tasks — ${tasks}</div>
          <div class="rpt-legend-item"><span style="background:#FF9F43;"></span>Prayers — ${faith}</div>
          <div class="rpt-legend-item"><span style="background:#1a936f;"></span>Jobs — ${jobs}</div>
        </div>
      </div>

      ${report.topTask ? `<div class="rpt-top-task">🏆 Best this ${period==="week"?"week":"month"}: <strong>${report.topTask}</strong></div>` : ""}
      ${report.pendingTasks > 0 ? `<div class="rpt-pending">⏳ ${report.pendingTasks} task${report.pendingTasks>1?"s":""} waiting approval</div>` : ""}
    </div>`;

    // Draw donut after render
    setTimeout(() => {
      const canvas = document.getElementById(chartId);
      if (!canvas) return;
      const ctx    = canvas.getContext("2d");
      const vals   = [Math.max(tasks,1), Math.max(faith,0), Math.max(jobs,0)];
      const colors = ["#6C63FF","#FF9F43","#1a936f"];
      const total  = vals.reduce((s,v)=>s+v,0);
      let start    = -Math.PI/2;
      const cx = 45, cy = 45, r = 38, inner = 22;
      ctx.clearRect(0,0,90,90);
      vals.forEach((v,i) => {
        const angle = (v/total)*Math.PI*2;
        ctx.beginPath();
        ctx.moveTo(cx,cy);
        ctx.arc(cx,cy,r,start,start+angle);
        ctx.closePath();
        ctx.fillStyle = colors[i];
        ctx.fill();
        start += angle;
      });
      // Inner circle (donut hole)
      ctx.beginPath();
      ctx.arc(cx,cy,inner,0,Math.PI*2);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-surface")||"#fff";
      ctx.fill();
      // Center text
      ctx.fillStyle = "#333";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(stars+"⭐", cx, cy);
    }, 100);
  });

  el.innerHTML = html;
}

// ── Award top performer ──────────────────────────────────────
window.awardTopPerformer = async (kidId, kidName, period) => {
  const btn = document.querySelector(".rpt-award-btn");
  if (btn) { btn.disabled = true; btn.textContent = "Awarding…"; }
  try {
    await addBonusStars(kidId, 50);
    const now2 = new Date();
    const ws = new Date(now2); ws.setDate(now2.getDate() - now2.getDay() + 1);
    const key = `sk_top_award_${period}_${ws.toDateString()}_${kidId}`;
    localStorage.setItem(key, "1");
    toast(`🏆 +50 bonus stars awarded to ${kidName}!`, "success");
    celebrate(`🏆 ${kidName} is the Top Performer!
+50 Bonus Stars Awarded!`, "🏆⭐🌟");
    setTimeout(() => loadWeeklyReports(), 1000);
  } catch(e) { toast("Failed to award stars.", "error"); console.error(e); }
};

window.switchReportPeriod = (period) => {
  const sel = document.getElementById("report-period-select");
  if (sel) sel.value = period;
  loadWeeklyReports();
};

// ═══════════════════════════════════════════════════════════════
// PROFILE SETTINGS (parent)
// ═══════════════════════════════════════════════════════════════


window.savePrayerCitySettings = () => {
  const city    = document.getElementById("prayer-city-input")?.value.trim();
  const country = document.getElementById("prayer-country-input")?.value.trim() || "SA";
  if (!city) { toast("Please enter a city name.", "error"); return; }
  savePrayerCity(city, country);
  toast(`✅ Prayer city set to ${city}! Kids will see prayer times on their dashboard.`, "success");
};

// Pre-fill prayer city on profile load
async function loadProfileTab() {
  if (!currentParent?.uid) return;
  try { familyValues = await getFamilyValues(currentParent.uid); if (!familyValues.length) familyValues = await seedDefaultValues(currentParent.uid); } catch(e) {}

  const nameEl = document.getElementById("profile-name-input");
  if (nameEl) nameEl.value = currentParent.name || "";

  const focus = currentParent.familyFocus || "faith";
  document.querySelectorAll(".profile-focus-btn").forEach(b => b.classList.remove("active"));
  document.querySelector(`[data-pfocus="${focus}"]`)?.classList.add("active");
  document.getElementById("profile-focus-hidden").value = focus;

  const faith = currentParent.faith || "muslim";
  document.querySelectorAll(".profile-faith-btn").forEach(b => b.classList.remove("active"));
  document.querySelector(`[data-pfaith="${faith}"]`)?.classList.add("active");
  document.getElementById("profile-faith-hidden").value = faith;

  const faithSec = document.getElementById("profile-faith-section");
  if (faithSec) faithSec.style.display = focus === "faith" ? "block" : "none";

  // Pre-fill prayer city
  const { city, country } = getPrayerCity();
  const cityEl    = document.getElementById("prayer-city-input");
  const countryEl = document.getElementById("prayer-country-input");
  if (cityEl)    cityEl.value    = city;
  if (countryEl) countryEl.value = country;
}

window.saveProfileSettings = async () => {
  const btn   = document.getElementById("btn-save-profile");
  const name  = document.getElementById("profile-name-input")?.value.trim();
  const focus = document.getElementById("profile-focus-hidden")?.value || "faith";
  const faith = document.getElementById("profile-faith-hidden")?.value || "muslim";
  if (!name) { toast("Please enter your name.", "error"); return; }
  setLoading(btn, true);
  try {
    await updateParentProfile(currentParent.uid, {
      name,
      familyFocus: focus,
      faith: focus === "faith" ? faith : null
    });
    currentParent.name        = name;
    currentParent.familyFocus = focus;
    currentParent.faith       = focus === "faith" ? faith : null;
    document.getElementById("parent-name-display").textContent = `Welcome, ${name}! 👋`;
    toast("✅ Profile saved!", "success");
  } catch(err) { toast("Failed to save.", "error"); console.error(err); }
  finally { setLoading(btn, false); }
};

// ═══════════════════════════════════════════════════════════════
// RUSH MODE — Phase 1
// One shared timer · Tasks in any order · Faster = more stars
// ═══════════════════════════════════════════════════════════════

let activeRushId    = null;
let currentSession  = null;
let rushIntervalId  = null;
let kidRushId       = null;
let kidRushData     = null;
let kidRushInterval = null;

// ── Load rush tab ─────────────────────────────────────────────
async function loadRushTab() {
  ["morning","afterschool","bedtime"].forEach(sid => {
    const s  = DEFAULT_RUSH_SESSIONS[sid];
    const el = document.getElementById(`rush-${sid}-tasks`);
    if (!el) return;
    el.innerHTML = s.tasks.map(t => `
      <div class="rush-task-row">
        <span class="rush-task-emoji">${t.emoji}</span>
        <span class="rush-task-name">${t.title}</span>
        <span class="rush-task-stars">up to ${t.stars * 3}⭐</span>
      </div>`).join("");
    // Set time window label
    const totalMins = s.windowMinutes;
    const wl = document.getElementById(`rush-${sid}-window`);
    if (wl) wl.textContent = `⏱ ${totalMins} min total window`;
  });
}

// ── Start rush ────────────────────────────────────────────────
window.startRushSession = async (sessionId) => {
  if (!kidsList.length) { toast("Add kids first!", "error"); return; }
  if (getRushDoneToday(sessionId)) {
    toast("This rush was already done today! ✅ Resets at midnight.", "info");
    return;
  }

  // ── Single Rush rule — check if one already running ────────
  const existingRush = await getActiveRushForKid(currentParent.uid).catch(()=>null);
  if (existingRush) {
    toast("A Rush is already running! End it first before starting a new one.", "info");
    // Show the existing rush monitor
    const existingSession = DEFAULT_RUSH_SESSIONS[existingRush.sessionId] ||
      customRushSessions.find(s=>s.id===existingRush.sessionId) || {};
    document.getElementById("rush-monitor").style.display = "block";
    document.getElementById("rush-monitor-title").textContent =
      `${existingSession.emoji||"⚡"} ${existingSession.label||"Rush"} — Live`;
    activeRushId   = existingRush.id;
    currentSession = existingSession;
    startRushMonitor(existingSession, existingRush.id);
    return;
  }

  const session = DEFAULT_RUSH_SESSIONS[sessionId] || customRushSessions.find(s=>s.id===sessionId);
  if (!session) return;
  currentSession  = session;
  const kidIds    = kidsList.map(k => k.id);
  activeRushId    = await startRush(currentParent.uid, sessionId, kidIds, session.tasks, session.windowMinutes);

  // ── Broadcast to kid screens immediately via localStorage ──
  const broadcastData = {
    rushId:    activeRushId,
    sessionId: sessionId,
    parentId:  currentParent.uid,
    kidIds:    kidIds,
    startedAt: Date.now()
  };
  localStorage.setItem("sk_rush_broadcast", JSON.stringify(broadcastData));

  // ── Same-tab direct trigger ────────────────────────────────
  if (currentKid && kidIds.includes(currentKid.id) && kidRushId !== activeRushId) {
    setTimeout(async () => {
      try {
        const rush = await getActiveRushForKid(currentParent.uid);
        if (rush && kidRushId !== rush.id) {
          kidRushId   = rush.id;
          kidRushData = rush;
          playRushStartSound();
          showKidRushOverlay(rush);
        }
      } catch(e) {}
    }, 500);
  }

  document.getElementById("rush-monitor").style.display = "block";
  document.getElementById("rush-monitor-title").textContent = `${session.emoji} ${session.label} — Live`;
  startRushMonitor(session, activeRushId);
  toast(`${session.emoji} ${session.label} started! Kids see it now 🚀`, "success");
  playRushStartSound();
};

function startRushMonitor(session, rushId) {
  if (rushIntervalId) clearInterval(rushIntervalId);
  rushIntervalId = setInterval(async () => {
    try {
      const { getDoc, doc: fsDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      const snap = await getDoc(fsDoc(db, "activeRush", rushId));
      if (!snap.exists()) { clearInterval(rushIntervalId); return; }
      const rush     = snap.data();
      const progress = rush.progress || {};
      const elapsed  = Math.floor((Date.now() - rush.startAtMs) / 1000);
      const totalSec = session.windowMinutes * 60;
      const remaining = Math.max(0, totalSec - elapsed);
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;

      // Update timer
      const timerEl = document.getElementById("rush-monitor-timer");
      if (timerEl) {
        timerEl.textContent = `${mins}:${String(secs).padStart(2,"0")}`;
        timerEl.style.color = remaining < 60 ? "#FF6B6B" : remaining < 180 ? "#FF9F43" : "#FFD93D";
      }
      // Progress bar
      const barEl = document.getElementById("rush-monitor-bar");
      if (barEl) barEl.style.width = `${Math.max(0,(remaining/totalSec)*100)}%`;

      // Kids progress
      const el = document.getElementById("rush-monitor-content");
      if (el) {
        el.innerHTML = kidsList.map(kid => {
          const kp    = progress[kid.id] || {};
          const done  = Object.values(kp).filter(p => p.done).length;
          const total = session.tasks.length;
          const pct   = Math.round((done / total) * 100);
          const stars = Object.values(kp).reduce((s,p) => s+(p.stars||0), 0);
          const av    = kid.photoURL
            ? `<img src="${kid.photoURL}" class="saved-kid-photo" style="width:36px;height:36px;border-radius:50%;object-fit:cover;" />`
            : `<span style="font-size:1.4rem">${kid.avatarEmoji||"🌟"}</span>`;
          return `<div class="rush-kid-row">
            <div class="rush-kid-avatar">${av}</div>
            <div class="rush-kid-info">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <span class="rush-kid-name">${kid.name}</span>
                <span style="font-size:0.75rem;color:var(--color-secondary);font-weight:700">⭐ ${stars}</span>
              </div>
              <div class="rush-progress-bar">
                <div class="rush-progress-fill" style="width:${pct}%;background:${pct===100?"#1a936f":"#6C63FF"}"></div>
              </div>
              <div class="rush-kid-stats">${done}/${total} tasks done${pct===100?" 🏆":""}</div>
            </div>
          </div>`;
        }).join("");
      }

      // Check if all kids done
      const rushTasks = rush.tasks || [];
      const allKidsDone = rushTasks.length > 0 && kidsList.every(kid => {
        const kp = progress[kid.id] || {};
        return rushTasks.every(t => t?.id && kp[t.id]?.done);
      });
      if (allKidsDone && kidsList.length > 0) {
        clearInterval(rushIntervalId);
        document.getElementById("rush-monitor").style.display = "none";
        celebrate("🏆 All kids finished the rush!", "🌅🏆🌟");
        toast("🏆 All kids completed the rush!", "success");
        await endRush(rushId);
        if (currentSession) {
          markRushDoneToday(currentSession.id);
          saveRushHistory(rush, currentSession, progress);
        }
        loadRushTab();
        loadRushHistory();
      } else if (remaining === 0) {
        clearInterval(rushIntervalId);
        toast("⏰ Rush time\'s up!", "info");
      }
    } catch(e) {}
  }, 2000);
}

window.stopRushSession = async () => {
  if (activeRushId) {
    // Save history before ending
    try {
      const fm   = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      const snap = await fm.getDoc(fm.doc(db,"activeRush",activeRushId));
      if (snap.exists() && currentSession) saveRushHistory(snap.data(), currentSession, snap.data().progress||{});
    } catch(e){}
    await endRush(activeRushId);
  }
  if (currentSession) markRushDoneToday(currentSession.id);
  activeRushId = null; currentSession = null;
  if (rushIntervalId) clearInterval(rushIntervalId);
  document.getElementById("rush-monitor").style.display = "none";
  loadRushTab();
  loadRushHistory();
  toast("Rush ended.", "info");
};

// ── Edit Rush Session ────────────────────────────────────────
window.editingRushSession = null;

// ── Custom Rush Sessions (saved to Firestore) ─────────────────
let customRushSessions = [];

async function loadCustomRushSessions() {
  try {
    if (!currentParent?.uid) return;
    const fm   = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const q    = fm.query(fm.collection(db,"rushSessions"), fm.where("parentId","==",currentParent.uid));
    const snap = await fm.getDocs(q);
    customRushSessions = snap.docs.map(d => ({id:d.id,...d.data()}));
    console.log("Loaded custom rush sessions:", customRushSessions.length);
  } catch(e) { console.error("loadCustomRushSessions:", e); }
}

async function saveCustomRushSession(session) {
  const fm = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const id = session.id || ("custom_" + currentParent.uid + "_" + Date.now());
  const data = {
    id, parentId: currentParent.uid,
    label: session.label || "Custom Rush",
    emoji: session.emoji || "⚡",
    color: session.color || "#6C63FF",
    windowMinutes: session.windowMinutes || 20,
    tasks: session.tasks || [],
    updatedAt: fm.serverTimestamp()
  };
  console.log("Saving rush session:", data.label, "id:", id);
  await fm.setDoc(fm.doc(db,"rushSessions",id), data);
  console.log("Rush session saved to Firestore:", id);
  return id;
}

async function deleteCustomRushSession(sessionId) {
  const fm = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  await fm.deleteDoc(fm.doc(db,"rushSessions",sessionId));
  customRushSessions = customRushSessions.filter(s => s.id !== sessionId);
}

// Get all sessions (default + custom)
function getAllRushSessions() {
  return [
    ...Object.values(DEFAULT_RUSH_SESSIONS),
    ...customRushSessions
  ];
}

window.openEditRush = (sessionId) => {
  const defaultS = DEFAULT_RUSH_SESSIONS[sessionId];
  const customS  = customRushSessions.find(s => s.id === sessionId);
  const source   = defaultS || customS;
  if (!source) { toast("Session not found", "error"); return; }

  // Deep clone with fallback for any undefined values
  const cleaned = {
    id:            source.id    || sessionId,
    label:         source.label || "Rush",
    emoji:         source.emoji || "⚡",
    color:         source.color || "#6C63FF",
    windowMinutes: source.windowMinutes || 20,
    tasks: (source.tasks || []).map((t, i) => ({
      id:    t && t.id    ? t.id    : "t" + i,
      title: t && t.title ? t.title : "Task",
      emoji: t && t.emoji ? t.emoji : "✅",
      stars: t && t.stars ? t.stars : 2
    }))
  };
  window.editingRushSession = cleaned;

  document.getElementById("edit-rush-session-id").value = sessionId;
  document.getElementById("edit-rush-title").textContent = `✏️ Edit ${cleaned.label}`;
  document.getElementById("edit-rush-time").value = cleaned.windowMinutes;

  const customFields = document.getElementById("edit-rush-custom-fields");
  if (customFields) {
    customFields.style.display = customS ? "block" : "none";
    if (customS) {
      const nm = document.getElementById("edit-rush-name");
      const em = document.getElementById("edit-rush-emoji");
      const co = document.getElementById("edit-rush-color");
      if (nm) nm.value = cleaned.label;
      if (em) em.value = cleaned.emoji;
      if (co) co.value = cleaned.color;
    }
  }

  renderEditRushTasks();
  document.getElementById("modal-edit-rush").classList.add("open");
};

window.closeEditRush = () => document.getElementById("modal-edit-rush").classList.remove("open");
window.highlightColor = (btn) => {
  document.querySelectorAll(".rush-color-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
};

window.adjustRushTime = (delta) => {
  const el  = document.getElementById("edit-rush-time");
  const val = Math.min(120, Math.max(5, (parseInt(el.value)||30) + delta));
  el.value  = val;
};

function renderEditRushTasks() {
  const el = document.getElementById("edit-rush-tasks-list");
  if (!el || !window.editingRushSession) return;
  el.innerHTML = "";
  window.editingRushSession.tasks.forEach((t, i) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;align-items:center;background:var(--color-bg);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:8px 12px;margin-bottom:6px;";

    const emojiInput = document.createElement("input");
    emojiInput.value = t.emoji || "✅";
    emojiInput.style.cssText = "width:44px;text-align:center;font-size:1.2rem;border:1px solid var(--color-border);border-radius:8px;padding:4px;";
    emojiInput.addEventListener("input", function() { window.editingRushSession.tasks[i].emoji = this.value; });

    const titleInput = document.createElement("input");
    titleInput.value = t.title || "Task";
    titleInput.style.cssText = "flex:1;border:1px solid var(--color-border);border-radius:8px;padding:6px 10px;font-family:var(--font-body);";
    titleInput.addEventListener("input", function() { window.editingRushSession.tasks[i].title = this.value; });

    const starLabel = document.createElement("span");
    starLabel.textContent = "⭐";
    starLabel.style.cssText = "font-size:0.8rem;color:var(--color-muted);";

    const starsInput = document.createElement("input");
    starsInput.type = "number";
    starsInput.value = t.stars || 2;
    starsInput.min = 1; starsInput.max = 10;
    starsInput.style.cssText = "width:44px;text-align:center;border:1px solid var(--color-border);border-radius:8px;padding:4px;";
    starsInput.addEventListener("input", function() { window.editingRushSession.tasks[i].stars = parseInt(this.value)||1; });

    const delBtn = document.createElement("button");
    delBtn.textContent = "×";
    delBtn.style.cssText = "background:none;border:none;color:var(--color-danger);font-size:1.1rem;cursor:pointer;padding:4px;";
    delBtn.addEventListener("click", function() { window.editingRushSession.tasks.splice(i,1); renderEditRushTasks(); });

    row.appendChild(emojiInput);
    row.appendChild(titleInput);
    row.appendChild(starLabel);
    row.appendChild(starsInput);
    row.appendChild(delBtn);
    el.appendChild(row);
  });
}

window.addRushTask = () => {
  if (!window.editingRushSession) {
    window.editingRushSession = {id:null,label:"",emoji:"⚡",color:"#6C63FF",windowMinutes:20,tasks:[]};
  }
  window.editingRushSession.tasks.push({id:"t"+Date.now(),title:"New Task",emoji:"✅",stars:2});
  renderEditRushTasks();
};

window.removeRushTask = (idx) => {
  window.editingRushSession.tasks.splice(idx, 1);
  renderEditRushTasks();
};

// ── Photo Crop Tool ──────────────────────────────────────────
let _cropKidId  = null;
let _cropImg    = null;
let _cropDrag   = false;
let _cropX      = 0, _cropY = 0;
let _cropStartX = 0, _cropStartY = 0;
let _cropImgX   = 0, _cropImgY = 0;

window.changeKidPhoto = (kidId) => {
  _cropKidId = kidId;
  const input = document.createElement("input");
  input.type  = "file";
  input.accept = "image/*";
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => openCropModal(ev.target.result);
    reader.readAsDataURL(file);
  };
  input.click();
};

function openCropModal(src) {
  const modal    = document.getElementById("modal-photo-crop");
  const imgEl    = document.getElementById("crop-image");
  const zoomEl   = document.getElementById("crop-zoom");
  const container = document.getElementById("crop-container");
  if (!modal || !imgEl) return;

  _cropImg = new Image();
  _cropImg.onload = () => {
    imgEl.src = src;
    _cropX = 0; _cropY = 0;
    zoomEl.value = 130;
    applyCropTransform();
    modal.classList.add("open");
  };
  _cropImg.src = src;

  // Zoom slider
  zoomEl.oninput = applyCropTransform;

  // Pinch to zoom on mobile
  let _pinchDist = 0;
  container.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      _pinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, {passive:true});
  container.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = dist - _pinchDist;
      _pinchDist  = dist;
      const cur   = parseInt(zoomEl.value);
      zoomEl.value = Math.min(300, Math.max(100, cur + delta * 0.5));
      applyCropTransform();
    }
  }, {passive:true});

  // Mouse drag
  container.onmousedown = (e) => {
    _cropDrag = true; _cropStartX = e.clientX; _cropStartY = e.clientY;
    _cropImgX = _cropX; _cropImgY = _cropY;
    container.style.cursor = "grabbing";
    e.preventDefault();
  };
  document.onmousemove = (e) => {
    if (!_cropDrag) return;
    _cropX = _cropImgX + (e.clientX - _cropStartX);
    _cropY = _cropImgY + (e.clientY - _cropStartY);
    applyCropTransform();
  };
  document.onmouseup = () => { _cropDrag = false; container.style.cursor = "grab"; };

  // Touch drag
  container.ontouchstart = (e) => {
    const t = e.touches[0];
    _cropDrag = true; _cropStartX = t.clientX; _cropStartY = t.clientY;
    _cropImgX = _cropX; _cropImgY = _cropY;
    e.preventDefault();
  };
  container.ontouchmove = (e) => {
    if (!_cropDrag) return;
    const t = e.touches[0];
    _cropX = _cropImgX + (t.clientX - _cropStartX);
    _cropY = _cropImgY + (t.clientY - _cropStartY);
    applyCropTransform();
    e.preventDefault();
  };
  container.ontouchend = () => { _cropDrag = false; };
}

function applyCropTransform() {
  const imgEl  = document.getElementById("crop-image");
  const zoomEl = document.getElementById("crop-zoom");
  if (!imgEl || !_cropImg) return;
  const zoom   = parseInt(zoomEl.value) / 100;
  const w      = _cropImg.naturalWidth  * zoom;
  const h      = _cropImg.naturalHeight * zoom;
  // Center initially
  const cSize  = 260;
  const baseX  = (cSize - w) / 2;
  const baseY  = (cSize - h) / 2;
  imgEl.style.width  = w + "px";
  imgEl.style.height = h + "px";
  imgEl.style.left   = (baseX + _cropX) + "px";
  imgEl.style.top    = (baseY + _cropY) + "px";
}

window.closeCropModal = () => {
  document.getElementById("modal-photo-crop")?.classList.remove("open");
  _cropKidId = null; _cropImg = null; _cropDrag = false;
  _cropX = 0; _cropY = 0;
};

window.saveCroppedPhoto = async () => {
  if (!_cropKidId || !_cropImg) return;
  const btn = document.querySelector("#modal-photo-crop .btn--primary");
  if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
  try {
    const imgEl  = document.getElementById("crop-image");
    const zoomEl = document.getElementById("crop-zoom");
    const zoom   = parseInt(zoomEl.value) / 100;
    const cSize  = 260;
    const w      = _cropImg.naturalWidth  * zoom;
    const h      = _cropImg.naturalHeight * zoom;
    const baseX  = (cSize - w) / 2;
    const baseY  = (cSize - h) / 2;
    const offX   = baseX + _cropX;
    const offY   = baseY + _cropY;

    // Draw cropped circle to canvas
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 400;
    const ctx    = canvas.getContext("2d");
    ctx.beginPath();
    ctx.arc(200, 200, 200, 0, Math.PI * 2);
    ctx.clip();
    const scale  = 400 / cSize;
    ctx.drawImage(_cropImg, offX * scale, offY * scale, w * scale, h * scale);
    const compressed = canvas.toDataURL("image/jpeg", 0.72);

    // Save to Firestore
    const fm = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await fm.updateDoc(fm.doc(db,"kids",_cropKidId), { photoURL: compressed });
    toast("Photo updated! ✅", "success");
    closeCropModal();
    kidsList = await getKidsByParent(currentParent.uid);
    renderKids();
  } catch(err) {
    toast("Failed to save photo.", "error");
    console.error(err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "✅ Save Photo"; }
  }
};

window.renderCustomRushSessions = function() {
  const container = document.getElementById("custom-rush-sessions");
  if (!container) return;
  if (!customRushSessions.length) { container.innerHTML = ""; return; }
  container.innerHTML = customRushSessions.map(s => `
    <div class="rush-card rush-card--custom">
      <div class="rush-card-top" style="background:${s.color||"#1a936f"};">
        <div class="rush-card-icon">${s.emoji||"⚡"}</div>
        <div class="rush-card-info">
          <div class="rush-card-title">${s.label||"Custom Rush"}</div>
          <div class="rush-card-sub">Custom session</div>
        </div>
      </div>
      <div class="rush-card-window">⏱ ${s.windowMinutes||20} min shared window</div>
      <div class="rush-tasks-preview">
        ${(s.tasks||[]).map(t=>`
          <div class="rush-task-row">
            <span class="rush-task-emoji">${t.emoji||"✅"}</span>
            <span class="rush-task-name">${t.title}</span>
            <span class="rush-task-stars">up to ${(t.stars||1)*3}⭐</span>
          </div>`).join("")}
      </div>
      <div class="rush-card-actions">
        <button class="rush-btn-edit" onclick="openEditRush('${s.id}')">✏️ Edit</button>
        <button class="rush-btn-delete" onclick="deleteRushSession('${s.id}')">🗑</button>
        <button class="rush-btn-start" onclick="startRushSession('${s.id}')">▶ Start</button>
      </div>
    </div>`).join("");
};

window.saveRushEdits = async () => {
  if (!window.editingRushSession) return;
  const sid      = document.getElementById("edit-rush-session-id").value;
  const time     = parseInt(document.getElementById("edit-rush-time").value) || 20;
  const isCustom = !DEFAULT_RUSH_SESSIONS[sid];

  // Capture current task values from DOM inputs before saving
  const taskRows = document.querySelectorAll("#edit-rush-tasks-list > div");
  if (taskRows.length > 0) {
    taskRows.forEach((row, i) => {
      const inputs = row.querySelectorAll("input");
      if (inputs[0] && window.editingRushSession.tasks[i]) {
        window.editingRushSession.tasks[i].emoji = inputs[0].value || "✅";
        window.editingRushSession.tasks[i].title = inputs[1]?.value || "Task";
        window.editingRushSession.tasks[i].stars = parseInt(inputs[2]?.value) || 2;
      }
    });
  }
  window.editingRushSession.windowMinutes = time;

  if (isCustom) {
    // Save name/emoji/color for custom
    window.editingRushSession.label = document.getElementById("edit-rush-name")?.value || "Custom Rush";
    window.editingRushSession.emoji = document.getElementById("edit-rush-emoji")?.value || "⚡";
    window.editingRushSession.color = document.getElementById("edit-rush-color")?.value || "#6C63FF";
    const btn = document.querySelector(".modal-box .btn--primary");
    if (btn) { btn.disabled=true; btn.textContent="Saving…"; }
    try {
      const savedId = await saveCustomRushSession(window.editingRushSession);
      window.editingRushSession.id = savedId;
      // Update or add in local array
      const idx = customRushSessions.findIndex(s=>s.id===savedId);
      if (idx>=0) customRushSessions[idx] = window.editingRushSession;
      else customRushSessions.push({...window.editingRushSession, id:savedId});
      toast("✅ Rush session saved!", "success");
      console.log("customRushSessions after save:", customRushSessions.length);
    } catch(e) { toast("Failed to save: " + (e.message||e), "error"); console.error("saveRushEdits error:", e); return; }
    finally { if (btn) { btn.disabled=false; btn.textContent="Save Changes ✅"; } }
  } else {
    DEFAULT_RUSH_SESSIONS[sid].windowMinutes = time;
    DEFAULT_RUSH_SESSIONS[sid].tasks = window.editingRushSession.tasks;
    toast("✅ Rush session updated!", "success");
  }
  closeEditRush();
  await loadRushTab();
  renderCustomRushSessions();
};

window.deleteRushSession = async (sessionId) => {
  if (!confirm("Delete this rush session?")) return;
  try {
    await deleteCustomRushSession(sessionId);
    renderCustomRushSessions();
    toast("Deleted.", "info");
  } catch(e) { toast("Failed to delete.", "error"); }
};

window.editRushSession = window.openEditRush;

// ── Rush History ─────────────────────────────────────────────
function saveRushHistory(rush, session, progress) {
  try {
    const history = JSON.parse(localStorage.getItem("sk_rush_history")||"[]");
    const entry = {
      date:      new Date().toLocaleDateString(),
      time:      new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}),
      sessionId: session.id,
      label:     session.label,
      emoji:     session.emoji,
      kids: kidsList.map(kid => {
        const kp    = progress[kid.id] || {};
        const done  = Object.values(kp).filter(p=>p.done).length;
        const stars = Object.values(kp).reduce((s,p)=>s+(p.stars||0),0);
        return { name:kid.name, done, total:(rush.tasks||[]).length, stars };
      })
    };
    history.unshift(entry); // newest first
    // Keep last 30 entries
    localStorage.setItem("sk_rush_history", JSON.stringify(history.slice(0,30)));
  } catch(e) { console.error("saveRushHistory:", e); }
}

function loadRushHistory() {
  const el = document.getElementById("rush-history-list");
  if (!el) return;
  try {
    const history = JSON.parse(localStorage.getItem("sk_rush_history")||"[]");
    if (!history.length) { el.innerHTML = "<p style='color:var(--color-muted);font-size:0.82rem;text-align:center;padding:12px;'>No rush history yet. Complete your first rush!</p>"; return; }
    el.innerHTML = history.map(h => `
      <div class="rush-history-entry">
        <div class="rush-history-header">
          <span class="rush-history-emoji">${h.emoji}</span>
          <div>
            <div class="rush-history-label">${h.label}</div>
            <div class="rush-history-date">${h.date} at ${h.time}</div>
          </div>
        </div>
        <div class="rush-history-kids">
          ${h.kids.map(k => `
            <div class="rush-history-kid">
              <span>${k.name}</span>
              <span class="${k.done===k.total?"rush-kid-done":"rush-kid-partial"}">${k.done===k.total?"✅":"⚠️"} ${k.done}/${k.total} tasks</span>
              <span class="rush-kid-stars">⭐ ${k.stars}</span>
            </div>`).join("")}
        </div>
      </div>`).join("");
  } catch(e) { el.innerHTML = ""; }
}

// ── Daily Rush Tracking ──────────────────────────────────────
function getRushDoneToday(sessionId) {
  try {
    const key  = "sk_rush_done_" + sessionId;
    const data = JSON.parse(localStorage.getItem(key) || "{}");
    const today = new Date().toDateString();
    return data.date === today;
  } catch(e) { return false; }
}

function markRushDoneToday(sessionId) {
  try {
    const key  = "sk_rush_done_" + sessionId;
    localStorage.setItem(key, JSON.stringify({ date: new Date().toDateString() }));
  } catch(e) {}
}

function clearRushDoneToday(sessionId) {
  localStorage.removeItem("sk_rush_done_" + sessionId);
}

// ── Rush start sound ─────────────────────────────────────────
function playRushStartSound() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    // Fanfare — ascending notes
    const notes = [523, 659, 784, 1047, 784, 1047, 1175];
    const times = [0, 0.15, 0.30, 0.45, 0.60, 0.70, 0.80];
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "square";
      gain.gain.setValueAtTime(0.15, ctx.currentTime + times[i]);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + times[i] + 0.14);
      osc.start(ctx.currentTime + times[i]);
      osc.stop(ctx.currentTime + times[i] + 0.15);
    });
  } catch(e) {}
}

// ── Approval notification ding ────────────────────────────────
function playApprovalDing() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    // Warm two-tone ding — friendly, not alarming
    const notes = [880, 1108];
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.5);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.55);
    });
  } catch(e) {}
}

// ── Kid side ──────────────────────────────────────────────────
// ── Top Performer Award notification on kid dashboard ────────
async function checkTopPerformerAward(kid) {
  try {
    const fm = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const q  = fm.query(
      fm.collection(db,"praise"),
      fm.where("kidId","==",kid.id),
      fm.where("isTopPerformer","==",true),
      fm.where("read","==",false)
    );
    const snap = await fm.getDocs(q);
    if (snap.empty) return;
    // Show celebration on kid screen
    const doc = snap.docs[0];
    celebrate("🏆 You are this week's\nTOP PERFORMER!\n+50 Bonus Stars!", "🏆⭐🌟");
    // Mark as read
    await fm.updateDoc(fm.doc(db,"praise",doc.id), {read:true});
    // Refresh stars
    setTimeout(() => refreshKidDashboard(), 2000);
  } catch(e) {}
}

window.checkForActiveRush = async (kid) => {
  try {
    const rush = await getActiveRushForKid(kid.parentId);
    if (!rush) return;
    if (!rush.kidIds?.includes(kid.id)) return;
    if (rush.status !== "active") return;
    const rushTasks = rush.tasks || [];
    if (rushTasks.length === 0) return;
    // Check if ALL kids in rush are done — if so don't re-show
    const allKids = window.SK ? window.SK.getKids().filter(k => rush.kidIds?.includes(k.id)) : [kid];
    const totalTasks = rushTasks.length * allKids.length;
    let totalDone = 0;
    allKids.forEach(k => {
      const prog = rush.progress?.[k.id] || {};
      totalDone += rushTasks.filter(t => prog[t.id]?.done).length;
    });
    if (totalDone === totalTasks && totalTasks > 0) return;
    if (kidRushId === rush.id) return;
    console.log("✅ Showing family rush overlay");
    kidRushId   = rush.id;
    kidRushData = rush;
    playRushStartSound();
    showKidRushOverlay(rush);
  } catch(e) { console.error("Rush check error:", e); }
};

function showKidRushOverlay(rush) {
  const session   = DEFAULT_RUSH_SESSIONS[rush.sessionId] || customRushSessions.find(s=>s.id===rush.sessionId) || {};
  const overlay   = document.getElementById("kid-rush-overlay");
  const container = document.getElementById("rush-tasks-container");
  if (!overlay || !container) return;

  document.getElementById("rush-overlay-emoji").textContent = session.emoji || "⚡";
  document.getElementById("rush-overlay-title").textContent = session.label || "Family Rush!";
  overlay.style.display = "block";

  // Get all kids involved in this rush from localStorage
  const allKids = window.SK ? window.SK.getKids() : [];
  const rushKids = rush.kidIds
    ? allKids.filter(k => rush.kidIds.includes(k.id))
    : (currentKid ? [currentKid] : []);

  function render() {
    const windowMins = kidRushData.windowMinutes || session.windowMinutes || 30;
    const totalSec   = windowMins * 60;
    const now        = Date.now();
    let remaining;
    if (kidRushData.endAtMs && kidRushData.endAtMs > 1000000000000) {
      remaining = Math.max(0, Math.floor((kidRushData.endAtMs - now) / 1000));
    } else if (kidRushData.startAtMs && kidRushData.startAtMs > 1000000000000) {
      const elapsed = Math.floor((now - kidRushData.startAtMs) / 1000);
      remaining = Math.max(0, totalSec - elapsed);
    } else {
      remaining = totalSec;
    }
    const mins     = Math.floor(remaining / 60);
    const secs     = remaining % 60;
    const pctLeft  = Math.max(0, (remaining / totalSec) * 100);
    const timerCol = remaining < 60 ? "#FF6B6B" : remaining < 180 ? "#FF9F43" : "#FFD93D";
    const bonus    = pctLeft > 66 ? "🌟 3× stars if done now!" : pctLeft > 33 ? "⭐ 2× stars if done now!" : "✅ Finish before time runs out!";

    // Count total done across all kids
    const totalTasks = rush.tasks.length * rushKids.length;
    let totalDone = 0;
    rushKids.forEach(k => {
      const prog = kidRushData.progress?.[k.id] || {};
      totalDone += rush.tasks.filter(t => prog[t.id]?.done).length;
    });

    let html = `
      <div style="background:rgba(255,255,255,0.08);border-radius:16px;padding:16px;text-align:center;margin-bottom:12px;">
        <div style="font-size:2.8rem;font-weight:700;color:${timerCol};font-variant-numeric:tabular-nums;">
          ${mins}:${String(secs).padStart(2,"0")}
        </div>
        <div style="font-size:0.75rem;color:rgba(255,255,255,0.5);margin-bottom:8px;">time remaining</div>
        <div style="height:8px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;">
          <div style="width:${pctLeft}%;height:100%;background:${timerCol};border-radius:4px;transition:width 1s linear;"></div>
        </div>
        <div style="font-size:0.78rem;color:rgba(255,255,255,0.6);margin-top:8px;">${bonus}</div>
      </div>
      <div style="font-size:0.75rem;color:rgba(255,255,255,0.5);margin-bottom:12px;text-align:center;">
        ${totalDone}/${totalTasks} done across ${rushKids.length} kid${rushKids.length>1?"s":""}
      </div>`;

    // Render each kid's task list
    rushKids.forEach(kid => {
      const progress  = kidRushData.progress?.[kid.id] || {};
      const kidDone   = rush.tasks.filter(t => progress[t.id]?.done).length;
      const allKidDone = kidDone === rush.tasks.length;
      const av = kid.photo
        ? `<img src="${kid.photo}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" />`
        : `<span style="font-size:1.2rem;">${kid.emoji||"🌟"}</span>`;

      html += `
        <div style="margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px 12px;background:rgba(255,255,255,0.06);border-radius:12px;">
            ${av}
            <div style="flex:1;">
              <div style="color:#fff;font-weight:700;font-size:0.9rem;">${kid.name}</div>
              <div style="color:rgba(255,255,255,0.5);font-size:0.72rem;">${kidDone}/${rush.tasks.length} done</div>
            </div>
            ${allKidDone ? `<span style="color:#6bcb77;font-weight:700;font-size:0.8rem;">🏆 Done!</span>` : ""}
          </div>`;

      rush.tasks.forEach(t => {
        const done   = progress[t.id]?.done;
        const earned = progress[t.id]?.stars || 0;
        if (done) {
          html += `<div style="background:rgba(26,147,111,0.2);border:1px solid #1a936f;border-radius:12px;padding:10px 12px;margin-bottom:8px;display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.5rem;">${t.emoji}</span>
            <div style="flex:1;"><div style="color:#fff;font-weight:600;font-size:0.85rem;">${t.title}</div>
            <div style="color:#1a936f;font-size:0.75rem;">✅ Done! +${earned}⭐</div></div></div>`;
        } else if (remaining === 0) {
          html += `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:10px 12px;margin-bottom:8px;display:flex;align-items:center;gap:10px;opacity:0.4;">
            <span style="font-size:1.5rem;">${t.emoji}</span>
            <div style="flex:1;color:rgba(255,255,255,0.5);font-size:0.85rem;">${t.title}</div>
            <span style="font-size:0.75rem;color:#FF6B6B;">⏰</span></div>`;
        } else {
          html += `<div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:10px 12px;margin-bottom:8px;display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.5rem;">${t.emoji}</span>
            <div style="flex:1;"><div style="color:#fff;font-weight:600;font-size:0.85rem;">${t.title}</div>
            <div style="color:rgba(255,255,255,0.5);font-size:0.72rem;">up to ${t.stars*3}⭐</div></div>
            <button onclick="completeKidRushTask('${kid.id}','${t.id}',${t.stars},${kidRushData.endAtMs||0},${totalSec})"
              style="background:#FF9F43;border:none;border-radius:10px;padding:7px 12px;color:#fff;font-weight:700;font-size:0.82rem;cursor:pointer;white-space:nowrap;">
              ✅ Done!
            </button></div>`;
        }
      });
      html += `</div>`;
    });

    const allFamilyDone = totalDone === totalTasks;
    if (allFamilyDone) html += `<div style="text-align:center;padding:16px;color:#FFD93D;font-size:1rem;font-weight:700;">🏆 Everyone finished! Amazing family!</div>`;
    container.innerHTML = html;
  }

  render();
  if (kidRushInterval) clearInterval(kidRushInterval);
  kidRushInterval = setInterval(() => {
    const windowMins = (kidRushData.windowMinutes || session.windowMinutes || 30);
    const totalSec   = windowMins * 60;
    const now2       = Date.now();
    let timeUp;
    if (kidRushData.endAtMs && kidRushData.endAtMs > 1000000000000) {
      timeUp = now2 >= kidRushData.endAtMs;
    } else if (kidRushData.startAtMs && kidRushData.startAtMs > 1000000000000) {
      timeUp = Math.floor((now2 - kidRushData.startAtMs) / 1000) >= totalSec && totalSec > 0;
    } else {
      timeUp = false;
    }

    // Check if all kids done
    let totalDone = 0;
    const totalTasks = rush.tasks.length * rushKids.length;
    rushKids.forEach(k => {
      const prog = kidRushData.progress?.[k.id] || {};
      totalDone += rush.tasks.filter(t => prog[t.id]?.done).length;
    });
    const allFamilyDone = totalDone === totalTasks;

    if (allFamilyDone) {
      clearInterval(kidRushInterval); kidRushInterval = null;
      render();
      setTimeout(() => {
        overlay.style.display = "none";
        kidRushId = null; kidRushData = null;
        let totalStars = 0;
        rushKids.forEach(k => {
          totalStars += Object.values(kidRushData?.progress?.[k.id]||{}).reduce((s,p)=>s+(p.stars||0),0);
        });
        celebrate(`🏆 Rush Complete!
Family earned stars!`);
        if (currentKid) refreshKidDashboard();
      }, 2500);
    } else if (timeUp) {
      clearInterval(kidRushInterval); kidRushInterval = null;
      render();
      setTimeout(() => {
        overlay.style.display = "none";
        kidRushId = null; kidRushData = null;
        toast("⏰ Rush time ended!", "info");
        if (currentKid) refreshKidDashboard();
      }, 2000);
    } else {
      render();
    }
  }, 1000);
}

window.completeKidRushTask = async (kidId, taskId, baseStars, endAtMs, totalSecs) => {
  if (!kidRushId) return;
  try {
    const remaining = Math.max(0, Math.floor((endAtMs - Date.now()) / 1000));
    const elapsed   = Math.max(0, totalSecs - remaining);
    const earned    = calculateRushStars(baseStars, elapsed, totalSecs);

    // ── Optimistic UI update immediately ──────────────────────
    if (!kidRushData.progress)          kidRushData.progress = {};
    if (!kidRushData.progress[kidId])   kidRushData.progress[kidId] = {};
    kidRushData.progress[kidId][taskId] = {done:true, doneAtMs:Date.now(), elapsedSecs:elapsed, stars:earned};
    toast(`⭐ +${earned} stars earned!`, "success");

    if (!navigator.onLine) {
      // Queue for sync when back online
      window._offlineQueue.push({
        type: "rushTask", rushId: kidRushId,
        kidId, taskId, elapsed, earned
      });
      saveOfflineQueue();
      return;
    }

    const { updateDoc, doc: fsDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await updateDoc(fsDoc(db, "activeRush", kidRushId), {
      [`progress.${kidId}.${taskId}`]: {done:true, doneAtMs:Date.now(), elapsedSecs:elapsed, stars:earned}
    });
    // Stars credited instantly — Rush is self-reported
    await addBonusStars(kidId, earned);
  } catch(e) { toast("Error. Try again.", "error"); console.error(e); }
};

// ═══════════════════════════════════════════════════════════════
// SESSION / NAVIGATION / BOOT
// ═══════════════════════════════════════════════════════════════
function saveKidSession(kid)  { localStorage.setItem("sk_kid", JSON.stringify(kid)); }
function loadKidSession()     { try { const d=localStorage.getItem("sk_kid"); return d?JSON.parse(d):null; } catch(e){return null;} }
function clearKidSession() {
  localStorage.removeItem("sk_kid");
  localStorage.removeItem("sk_current_kid");
  if (window._midnightTimer) { clearTimeout(window._midnightTimer); window._midnightTimer = null; }
}

document.getElementById("btn-kid-logout")?.addEventListener("click",()=>{
  clearKidSession(); currentKid=null;
  if (window._rushPollInterval) clearInterval(window._rushPollInterval);
  if (kidRushInterval) clearInterval(kidRushInterval);
  kidRushId = null; kidRushData = null;
  document.getElementById("kid-rush-overlay").style.display="none";
  document.getElementById("kid-code-input").value="";
  showScreen("screen-home");
  SK_renderKids();
  toast("See you soon! 👋","info");
});

// Photo fullscreen
window.showPhotoFull = (url) => {
  const el = document.getElementById("photo-fullscreen");
  document.getElementById("photo-fullscreen-img").src = url;
  el.style.display = "flex";
};
window.closePhotoFull = () => { document.getElementById("photo-fullscreen").style.display = "none"; };

// ── Saved kids profiles ──────────────────────────────────────
function getSavedKids() {
  try { return JSON.parse(localStorage.getItem("sk_saved_kids") || "[]"); }
  catch(e) { return []; }
}
function saveKidProfile(kid) {
  const saved = getSavedKids();
  const idx   = saved.findIndex(k => k.id === kid.id);
  const profile = {
    id: kid.id, name: kid.name,
    avatarEmoji: kid.avatarEmoji || "🌟",
    photoURL: kid.photoURL || null,
    code: kid.code,
    parentId: kid.parentId
  };
  if (idx !== -1) saved[idx] = profile;
  else saved.push(profile);
  localStorage.setItem("sk_saved_kids", JSON.stringify(saved));
  console.log("Kid profile saved:", profile.name);
}
function removeSavedKid(kidId) {
  const saved = getSavedKids().filter(k => k.id !== kidId);
  localStorage.setItem("sk_saved_kids", JSON.stringify(saved));
}

// ── Render saved kids on home screen ─────────────────────────
function renderSavedKidsSelector() {
  // Use the SK_renderKids defined in HTML inline script
  if (typeof window.SK_renderKids === "function") window.SK_renderKids();
}

window.SK_loginKid = async (kidId, code) => {
  return window.loginSavedKid(kidId, code);
};
window.loginSavedKid = async (kidId, code) => {
  try {
    const kid = await loginKidByCode(code);
    if (!kid) { toast("Could not log in. Try entering code manually.", "error"); goToKidLogin(); return; }
    currentKid=kid;
    saveKidSession(kid);
    saveKidProfile(kid);
    if (window.SK) window.SK.saveKid(kid);
    financeSettings = await getFinanceSettings(kid.parentId);
    await showKidDashboard(kid);
    toast(`Hi ${kid.name}! 🌟`, "success");
  } catch(e) { toast("Error. Try entering code manually.", "error"); goToKidLogin(); }
};

window.removeSavedKidProfile = (kidId) => {
  removeSavedKid(kidId);
  if (currentKid?.id === kidId) clearKidSession();
  renderSavedKidsSelector();
};

// ── Switch Kid Panel ───────────────────────────────────────────
window.showSwitchKidPanel = () => {
  const panel = document.getElementById("switch-kid-panel");
  const list  = document.getElementById("switch-kid-list");
  if (!panel || !list) return;

  const kids = window.SK ? window.SK.getKids() : [];
  if (!kids.length) { toast("No saved kids. Use the home screen to add kids.", "info"); return; }

  list.innerHTML = kids.map(k => {
    const av = k.photo
      ? `<img src="${k.photo}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:3px solid var(--color-primary);" />`
      : `<span style="font-size:2rem;">${k.emoji || "🌟"}</span>`;
    const isCurrent = currentKid && currentKid.id === k.id;
    return `<div onclick="window.switchToKid('${k.id}','${k.code}')"
      style="display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;opacity:${isCurrent ? "0.5" : "1"};">
      <div style="width:60px;height:60px;border-radius:50%;background:var(--color-bg-2);display:flex;align-items:center;justify-content:center;overflow:hidden;">${av}</div>
      <div style="font-size:0.8rem;font-weight:700;color:var(--color-text);">${k.name}${isCurrent ? " ✓" : ""}</div>
    </div>`;
  }).join("");

  panel.style.display = "block";
};

window.hideSwitchKidPanel = () => {
  const panel = document.getElementById("switch-kid-panel");
  if (panel) panel.style.display = "none";
};

window.switchToKid = async (kidId, code) => {
  window.hideSwitchKidPanel();
  if (currentKid && currentKid.id === kidId) return;
  toast("Switching kid…", "info");
  // Reset rush state so overlay re-renders fresh for the new kid
  kidRushId   = null;
  kidRushData = null;
  document.getElementById("kid-rush-overlay").style.display = "none";
  if (kidRushInterval) { clearInterval(kidRushInterval); kidRushInterval = null; }
  await window.loginSavedKid(kidId, code);
};

// ══════════════════════════════════════════════════════════════
// PARENT PIN SYSTEM
// ══════════════════════════════════════════════════════════════

// ── PIN stored in Firestore parent profile (travels across devices) ──
function hashPIN(pin) {
  let h = 0;
  for (let i = 0; i < pin.length; i++) {
    h = ((h << 5) - h) + pin.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}

function hasPINSet() {
  // Check Firestore profile (already loaded into currentParent)
  return !!(currentParent?.pinHash);
}

function verifyPIN(pin) {
  return currentParent?.pinHash && currentParent.pinHash === hashPIN(pin);
}

async function savePIN(pin) {
  const hash = hashPIN(pin);
  // Save to Firestore so it works on all devices
  await updateParentProfile(currentParent.uid, { pinHash: hash });
  currentParent.pinHash = hash;
}

// ── PIN entry state ───────────────────────────────────────────
let _pinBuffer       = "";
let _pinAttempts     = 0;
let _pinLockoutUntil = 0;
let _pinMode         = "enter"; // "enter" | "setup-first" | "setup-confirm"
let _pinFirstEntry   = "";

window.openParentPIN = () => {
  // If not authenticated with Firebase at all, go to login first
  if (!currentParent) {
    // Check if Firebase Auth session exists
    if (typeof goToParentAuth === "function") goToParentAuth("login");
    else showScreen("screen-login");
    return;
  }
  // If no PIN set yet — go to setup
  if (!hasPINSet()) {
    openPINSetup();
    return;
  }
  // Show PIN entry
  _pinBuffer = ""; _pinAttempts = 0;
  updatePINDots("pin-dot", 0);
  document.getElementById("pin-error").textContent = "";
  document.getElementById("pin-overlay-title").textContent = "Parent Portal";
  document.getElementById("pin-overlay-sub").textContent = "Enter your 4-digit PIN";
  document.getElementById("pin-overlay").style.display = "flex";
};

window.closePINOverlay = () => {
  document.getElementById("pin-overlay").style.display = "none";
  _pinBuffer = "";
  updatePINDots("pin-dot", 0);
};

function updatePINDots(prefix, count, error = false) {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`${prefix}-${i}`);
    if (!dot) continue;
    dot.classList.remove("filled", "error");
    if (i < count) dot.classList.add(error ? "error" : "filled");
  }
}

window.pinInput = (digit) => {
  // Check lockout
  if (Date.now() < _pinLockoutUntil) {
    const secs = Math.ceil((_pinLockoutUntil - Date.now()) / 1000);
    document.getElementById("pin-lockout").textContent = `Too many attempts. Wait ${secs}s`;
    document.getElementById("pin-lockout").style.display = "block";
    return;
  }
  if (_pinBuffer.length >= 4) return;
  _pinBuffer += digit;
  updatePINDots("pin-dot", _pinBuffer.length);
  if (_pinBuffer.length === 4) {
    setTimeout(() => {
      if (verifyPIN(_pinBuffer)) {
        document.getElementById("pin-overlay").style.display = "none";
        _pinBuffer = ""; _pinAttempts = 0;
        updatePINDots("pin-dot", 0);
        // Go to parent dashboard
        goToParentDashboard();
      } else {
        _pinAttempts++;
        updatePINDots("pin-dot", 4, true);
        document.getElementById("pin-error").textContent =
          `Wrong PIN. ${3 - _pinAttempts} attempt${3 - _pinAttempts === 1 ? "" : "s"} left.`;
        if (_pinAttempts >= 3) {
          _pinLockoutUntil = Date.now() + 30000;
          document.getElementById("pin-lockout").style.display = "block";
          document.getElementById("pin-lockout").textContent = "Too many attempts. Locked for 30s.";
          // Count down
          const timer = setInterval(() => {
            const secs = Math.ceil((_pinLockoutUntil - Date.now()) / 1000);
            if (secs <= 0) {
              clearInterval(timer);
              _pinAttempts = 0;
              document.getElementById("pin-lockout").style.display = "none";
              document.getElementById("pin-error").textContent = "";
            } else {
              document.getElementById("pin-lockout").textContent = `Too many attempts. Wait ${secs}s`;
            }
          }, 1000);
        }
        setTimeout(() => { _pinBuffer = ""; updatePINDots("pin-dot", 0); }, 600);
      }
    }, 150);
  }
};

window.pinBackspace = () => {
  if (_pinBuffer.length > 0) {
    _pinBuffer = _pinBuffer.slice(0, -1);
    updatePINDots("pin-dot", _pinBuffer.length);
  }
};

window.pinForgot = () => {
  document.getElementById("pin-overlay").style.display = "none";
  _pinBuffer = "";
  // Clear PIN from Firestore — parent must reset after email login
  if (currentParent) {
    updateParentProfile(currentParent.uid, { pinHash: null }).catch(()=>{});
    currentParent.pinHash = null;
  }
  showScreen("screen-login");
  toast("Log in with email to reset your PIN", "info");
};

// ── PIN Setup ─────────────────────────────────────────────────
let _setupBuffer = "";
let _setupFirst  = "";
let _setupStep   = 1; // 1 = enter new PIN, 2 = confirm

function openPINSetup() {
  _setupBuffer = ""; _setupFirst = ""; _setupStep = 1;
  document.getElementById("pin-setup-title").textContent = "Set Your Parent PIN";
  document.getElementById("pin-setup-sub").textContent = "Choose a 4-digit PIN to protect the parent portal";
  document.getElementById("pin-setup-error").textContent = "";
  updatePINDots("pin-setup-dot", 0);
  document.getElementById("pin-setup-overlay").style.display = "flex";
}

window.pinSetupInput = async (digit) => {
  if (_setupBuffer.length >= 4) return;
  _setupBuffer += digit;
  updatePINDots("pin-setup-dot", _setupBuffer.length);
  if (_setupBuffer.length === 4) {
    setTimeout(async () => {
      if (_setupStep === 1) {
        _setupFirst = _setupBuffer;
        _setupBuffer = "";
        _setupStep = 2;
        document.getElementById("pin-setup-title").textContent = "Confirm Your PIN";
        document.getElementById("pin-setup-sub").textContent = "Enter the same PIN again";
        updatePINDots("pin-setup-dot", 0);
      } else {
        if (_setupBuffer === _setupFirst) {
          await savePIN(_setupBuffer);
          document.getElementById("pin-setup-overlay").style.display = "none";
          toast("PIN set! Parent portal is now protected 🔒", "success");
          goToParentDashboard();
        } else {
          document.getElementById("pin-setup-error").textContent = "PINs don't match. Try again.";
          updatePINDots("pin-setup-dot", 4, true);
          setTimeout(() => {
            _setupBuffer = ""; _setupStep = 1; _setupFirst = "";
            document.getElementById("pin-setup-title").textContent = "Set Your Parent PIN";
            document.getElementById("pin-setup-sub").textContent = "Choose a 4-digit PIN";
            document.getElementById("pin-setup-error").textContent = "";
            updatePINDots("pin-setup-dot", 0);
          }, 800);
        }
      }
    }, 150);
  }
};

window.pinSetupBackspace = () => {
  if (_setupBuffer.length > 0) {
    _setupBuffer = _setupBuffer.slice(0, -1);
    updatePINDots("pin-setup-dot", _setupBuffer.length);
  }
};

window.pinSetupBack = () => {
  if (_setupStep === 2) {
    _setupStep = 1; _setupFirst = ""; _setupBuffer = "";
    document.getElementById("pin-setup-title").textContent = "Set Your Parent PIN";
    document.getElementById("pin-setup-sub").textContent = "Choose a 4-digit PIN";
    updatePINDots("pin-setup-dot", 0);
  } else {
    document.getElementById("pin-setup-overlay").style.display = "none";
  }
};

// Also add PIN change option inside parent settings
window.changeParentPIN = () => {
  if (currentParent) currentParent.pinHash = null;
  openPINSetup();
};

// ── Midnight auto-refresh ─────────────────────────────────────
// Schedules a dashboard refresh at exactly 00:00 so daily tasks
// reset automatically without the kid needing to reload the page
function scheduleMidnightRefresh() {
  const now       = new Date();
  const midnight  = new Date(now);
  midnight.setHours(24, 0, 5, 0); // 00:00:05 next day (5s buffer)
  const msUntil   = midnight - now;
  if (window._midnightTimer) clearTimeout(window._midnightTimer);
  window._midnightTimer = setTimeout(async () => {
    if (currentKid) {
      toast("🌙 New day! Refreshing your tasks...", "info");
      await resetRecurringTasks(currentKid.id);
      await loadKidTasks(currentKid);
      await loadKidJobsSection(currentKid.id);
    }
    // Schedule again for the next midnight
    scheduleMidnightRefresh();
  }, msUntil);
}

// ── Logout All Kids (clears all saved profiles from this device) ──
window.logoutAllKids = () => {
  if (!confirm("Remove all kid profiles from this device?")) return;
  // Clear all kid data from localStorage
  localStorage.removeItem("sk_kids");
  localStorage.removeItem("sk_saved_kids");
  localStorage.removeItem("sk_current_kid");
  localStorage.removeItem("sk_kid");
  // Clear session state
  clearKidSession(); currentKid = null;
  if (window._rushPollInterval) clearInterval(window._rushPollInterval);
  if (kidRushInterval) { clearInterval(kidRushInterval); kidRushInterval = null; }
  kidRushId = null; kidRushData = null;
  document.getElementById("kid-rush-overlay").style.display = "none";
  document.getElementById("kid-code-input").value = "";
  showScreen("screen-home");
  SK_renderKids();
  toast("All kids removed from this device 🚪", "info");
};

// ── Exit Rush Overlay without ending the session ──────────────
window.exitRushEarly = () => {
  document.getElementById("kid-rush-overlay").style.display = "none";
  // Rush keeps running in Firestore — re-entering shows it again via checkForActiveRush
};


