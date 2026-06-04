// ============================================================
// js/app.js — StarKids V10  Sprint 1+2+3+4+5+6
// ============================================================

import { db } from "./firebase.js?v=10";
import { fetchPrayerTimes, getNextPrayer, formatPrayerTime, startPrayerAlerts, stopPrayerAlerts, savePrayerCity, getPrayerCity } from "./prayer.js?v=10";
import { signUpParent, loginParent, logoutParent, getParentProfile, updateParentProfile, onAuthChange } from "./auth.js?v=10";
import { addKid, getKidsByParent, deleteKid, regenerateKidCode, loginKidByCode, uploadKidPhoto, updateKidPhoto } from "./kid.js?v=10";
import { createTask, createDefaultTasks, getTasksForKid, getPendingApprovals, submitTask, submitTaskWithPhoto, uploadTaskPhoto, approveTask, rejectTask, rejectTaskWithReason, getStarBalance, resetRecurringTasks, STATUS, TASK_TYPE } from "./tasks.js?v=10";
import { createGoalFromReward, getGoalsForKid, deleteGoal, checkGoalCompletion, addBonusStars, GOAL_STATUS } from "./goals.js?v=10";
import { getRewardsForParent, createReward, updateReward, deleteReward, seedDefaultRewards, requestRedemption, approveRedemption, rejectRedemption } from "./rewards.js?v=10";
import { getFinanceSettings, saveFinanceSettings, starsToMoney, getEntrepreneurJobs, seedDefaultJobs, createJob, deleteJob, claimJob } from "./finance.js?v=10";
import { getFamilyValues, seedDefaultValues, addFamilyValue, deleteFamilyValue, updateFamilyValue, getValuesProgress, sendPraise, getPraiseForKid, markPraiseRead, addFaithTasksForKid, getFaithTasks, getFaithLabel, getFaithEmoji, DEFAULT_FAITH_TASKS } from "./values.js?v=10";
import { ACHIEVEMENTS, getAchievements, checkAchievements, getKidStats, getWeeklyReport } from "./achievements.js?v=10";

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
(function prefill() {
  const s = getSavedEmail(); if (!s) return;
  const el = document.getElementById("login-email"); const cb = document.getElementById("remember-me");
  if (el) el.value = s; if (cb) cb.checked = true;
})();

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
    const av = kid.photoURL ? `<img src="${kid.photoURL}" class="kid-card__photo" />` : `<div class="kid-card__avatar">${kid.avatarEmoji||"🌟"}</div>`;
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
  const pending  = await getPendingApprovals(currentParent.uid);
  const allGoals = [];
  for (const kid of kidsList) {
    const goals = await getGoalsForKid(kid.id);
    goals.filter(g => g.status === GOAL_STATUS.REQUESTED).forEach(g =>
      allGoals.push({ ...g, kidName: kid.name, kidEmoji: kid.avatarEmoji, kidPhoto: kid.photoURL }));
  }
  const el    = document.getElementById("approvals-list");
  const badge = document.getElementById("approvals-badge");
  const total = pending.length + allGoals.length;
  if (badge) { badge.textContent = total||""; badge.style.display = total?"inline-flex":"none"; }
  if (!el) return;
  let html = "";
  if (pending.length) {
    html += `<div class="task-section-title">📋 Task Approvals</div>`;
    html += pending.map(task => {
      const kid = kidsList.find(k => k.id === task.kidId);
      const av  = kid?.photoURL ? `<img src="${kid.photoURL}" class="approval-avatar-img" />` : `<span>${kid?.avatarEmoji||"🌟"}</span>`;
      const typeLabel = task.taskType==="daily"?"🔄":task.taskType==="weekly"?"📅":task.isEntrepreneur?"💼":"1️⃣";
      const streakInfo = task.streak ? ` · 🔥 ${task.streak} streak` : "";
      return `<div class="approval-card">
        <div class="approval-avatar">${av}</div>
        <div class="approval-info">
          <div class="approval-kid">${kid?.name||"?"}</div>
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
    const stars  = await getStarBalance(kid.id);
    const money  = starsToMoney(stars, financeSettings);
    const goals  = await getGoalsForKid(kid.id);
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
    goToParentDashboard();
  } else { currentParent = null; showScreen("screen-home"); }
});

function goToParentDashboard() {
  document.getElementById("parent-name-display").textContent = `Welcome, ${currentParent.name}! 👋`;
  showScreen("screen-parent-dashboard"); showTab("kids"); loadKids();
}

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
    goToParentDashboard();
  } catch(err) { toast(friendlyError(err),"error"); } finally { setLoading(btn,false); }
});

document.getElementById("btn-login")?.addEventListener("click", async () => {
  const btn=document.getElementById("btn-login"); const email=document.getElementById("login-email").value.trim(); const password=document.getElementById("login-password").value; const remember=document.getElementById("remember-me")?.checked;
  if (!email||!password) { toast("Please enter email and password.","error"); return; } setLoading(btn,true);
  try {
    const user=await loginParent(email,password); remember?saveEmail(email):clearEmail();
    const profile=await getParentProfile(user.uid);
    const name = profile?.name || user.displayName || email.split("@")[0] || "Parent";
    currentParent={uid:user.uid, name, email, ...profile};
    financeSettings=await getFinanceSettings(currentParent.uid);
    await seedDefaultRewards(currentParent.uid);
    familyValues = await seedDefaultValues(currentParent.uid);
    toast("Welcome back! 🌟","success"); goToParentDashboard();
  } catch(err) { toast(friendlyError(err),"error"); } finally { setLoading(btn,false); }
});

document.getElementById("btn-logout")?.addEventListener("click", async () => { await logoutParent(); toast("Logged out!","info"); });

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
    currentKid=kid; saveKidSession(kid);
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
  // Load achievements
  await loadKidAchievements(kid.id);
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
      html += `<div class="task-section-title">📋 My Tasks</div>`;
      // Separate faith tasks from regular tasks
      const faithTasks   = regular.filter(t => t.isFaith);
      const normalTasks  = regular.filter(t => !t.isFaith);

      if (faithTasks.length) {
        html += `<div class="task-section-title faith-section-title">🕌 Faith Journey</div>`;
        html += faithTasks.map(t => {
          const streakBadge = (t.streak&&t.streak>1)?`<span class="streak-badge">🔥 ${t.streak}</span>`:"";
          const rejReason   = t.status===STATUS.REJECTED && t.rejectionReason
            ? `<div class="rejection-reason">❌ Parent says: <em>"${t.rejectionReason}"</em></div>` : "";
          return `<div class="task-card task-card--faith ${t.status===STATUS.REJECTED?"task-card--rejected":""}">
            <div class="task-card__info">
              <div class="task-card__title-row"><span class="type-badge type-badge--faith">🕌 Faith</span>${streakBadge}</div>
              <div class="task-card__title">${t.title}</div>
              ${t.description?`<div class="task-card__desc">${t.description}</div>`:""}
              <div class="task-card__stars">⭐ ${t.stars} = ${starsToMoney(t.stars,financeSettings)}</div>
              ${rejReason}
            </div>
            <button class="btn btn--sm btn--faith" onclick="handleJobDone('${t.id}')">✅ Done!</button>
          </div>`;
        }).join("");
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

window.confirmSubmitTask = async () => {
  const btn  = document.getElementById("btn-confirm-submit-task");
  const file = document.getElementById("submit-task-photo-input")?.files[0];
  if(btn) { btn.disabled=true; btn.textContent="Sending…"; }

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
        console.log("Photo size after compression:", kb, "KB");

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
  const btn = document.getElementById("btn-kid-refresh");
  if (btn) { btn.textContent = "⏳ Checking…"; btn.disabled = true; }
  try {
    await resetRecurringTasks(currentKid.id);
    const stars = await getStarBalance(currentKid.id);
    const money = starsToMoney(stars, financeSettings);
    document.getElementById("kid-dashboard-stars").textContent = `⭐ ${stars} Stars`;
    document.getElementById("kid-dashboard-money").textContent = `💰 ${money}`;
    await loadKidTasks(currentKid);
    await loadKidGoalsView(currentKid.id, stars);
    // Check achievements
    try {
      const kidVals = familyValues.length ? familyValues : await getFamilyValues(currentKid.parentId).catch(()=>[]);
      const stats   = await getKidStats(currentKid.id, kidVals);
      const earned  = await checkAchievements(currentKid.id, stats);
      if (earned.length > 0) {
        await loadKidAchievements(currentKid.id);
        // Award bonus stars for each achievement
        let bonusTotal = 0;
        for (const a of earned) {
          const bonus = 5; // 5 bonus stars per achievement
          await addBonusStars(currentKid.id, bonus);
          bonusTotal += bonus;
        }
        // Refresh star display
        const newStars = await getStarBalance(currentKid.id);
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
  // Load entrepreneur jobs when tasks tab is opened
  if (tab==="tasks" && currentKid) {
    loadKidJobsSection(currentKid.id);
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

  // Period selector
  const period = document.getElementById("report-period-select")?.value || "week";

  const rows = await Promise.all(kidsList.map(async kid => {
    const report  = await getWeeklyReport(kid.id);
    const monthly = await getMonthlyStats(kid.id);
    const money   = starsToMoney(report.starsEarned, financeSettings);
    const moneyM  = starsToMoney(monthly.starsMonth, financeSettings);
    const av      = kid.photoURL
      ? `<img src="${kid.photoURL}" class="wallet-avatar-img" />`
      : `<span class="wallet-avatar-emoji">${kid.avatarEmoji||"🌟"}</span>`;

    return `
      <div class="report-card">
        <div class="report-header">
          <div class="wallet-avatar">${av}</div>
          <div>
            <div class="wallet-name">${kid.name}</div>
            <div style="font-size:0.78rem;color:var(--color-muted);">Performance summary</div>
          </div>
        </div>

        <div class="report-period-tabs">
          <button class="report-tab ${period==="week"?"active":""}" onclick="switchReportPeriod('week')">📅 This Week</button>
          <button class="report-tab ${period==="month"?"active":""}" onclick="switchReportPeriod('month')">🗓 This Month</button>
        </div>

        ${period==="week" ? `
        <div class="report-stats">
          <div class="report-stat"><div class="report-stat__value">${report.tasksCompleted}</div><div class="report-stat__label">Tasks Done</div></div>
          <div class="report-stat"><div class="report-stat__value">⭐ ${report.starsEarned}</div><div class="report-stat__label">Stars Earned</div></div>
          <div class="report-stat"><div class="report-stat__value">💰 ${money}</div><div class="report-stat__label">Value</div></div>
          <div class="report-stat"><div class="report-stat__value">${report.faithTasks}</div><div class="report-stat__label">🕌 Prayers</div></div>
          <div class="report-stat"><div class="report-stat__value">${report.jobsDone}</div><div class="report-stat__label">💼 Jobs</div></div>
          <div class="report-stat"><div class="report-stat__value">⭐ ${report.totalStars}</div><div class="report-stat__label">Total Stars</div></div>
        </div>
        ${report.topTask?`<div class="report-top-task">⭐ Best: <strong>${report.topTask}</strong></div>`:""}
        ${report.pendingTasks>0?`<div class="report-pending">⏳ ${report.pendingTasks} pending approval</div>`:""}
        ` : `
        <div class="report-stats">
          <div class="report-stat"><div class="report-stat__value">${monthly.total}</div><div class="report-stat__label">Tasks Done</div></div>
          <div class="report-stat"><div class="report-stat__value">⭐ ${monthly.starsMonth}</div><div class="report-stat__label">Stars Earned</div></div>
          <div class="report-stat"><div class="report-stat__value">💰 ${moneyM}</div><div class="report-stat__label">Value</div></div>
          <div class="report-stat"><div class="report-stat__value">${monthly.activeDays}</div><div class="report-stat__label">Active Days</div></div>
          <div class="report-stat"><div class="report-stat__value">${monthly.avgPerDay}</div><div class="report-stat__label">Tasks/Day</div></div>
          <div class="report-stat"><div class="report-stat__value">${monthly.faithMonth}</div><div class="report-stat__label">🕌 Prayers</div></div>
        </div>
        <div class="report-top-task">📊 Active ${monthly.activeDays} out of 30 days this month</div>
        `}
      </div>`;
  }));

  el.innerHTML = rows.join("");
}

window.switchReportPeriod = (period) => {
  const sel = document.getElementById("report-period-select");
  if (sel) sel.value = period;
  loadWeeklyReports();
};

// ═══════════════════════════════════════════════════════════════
// PROFILE SETTINGS (parent)
// ═══════════════════════════════════════════════════════════════

async function loadProfileTab() {
  if (!currentParent?.uid) return;

  // Pre-fill name
  const nameEl = document.getElementById("profile-name-input");
  if (nameEl) nameEl.value = currentParent.name || "";

  // Pre-fill focus
  const focus = currentParent.familyFocus || "faith";
  document.querySelectorAll(".profile-focus-btn").forEach(b => b.classList.remove("active"));
  document.querySelector(`[data-pfocus="${focus}"]`)?.classList.add("active");
  document.getElementById("profile-focus-hidden").value = focus;

  // Pre-fill faith
  const faith = currentParent.faith || "muslim";
  document.querySelectorAll(".profile-faith-btn").forEach(b => b.classList.remove("active"));
  document.querySelector(`[data-pfaith="${faith}"]`)?.classList.add("active");
  document.getElementById("profile-faith-hidden").value = faith;

  // Show/hide faith selector
  const faithSec = document.getElementById("profile-faith-section");
  if (faithSec) faithSec.style.display = focus === "faith" ? "block" : "none";
}

window.selectProfileFocus = function(focus) {
  document.querySelectorAll(".profile-focus-btn").forEach(b => b.classList.remove("active"));
  document.querySelector('[data-pfocus="' + focus + '"]')?.classList.add("active");
  document.getElementById("profile-focus-hidden").value = focus;
  const fs = document.getElementById("profile-faith-section");
  if (fs) fs.style.display = focus === "faith" ? "block" : "none";
};

window.selectProfileFaith = function(faith) {
  document.querySelectorAll(".profile-faith-btn").forEach(b => b.classList.remove("active"));
  document.querySelector('[data-pfaith="' + faith + '"]')?.classList.add("active");
  document.getElementById("profile-faith-hidden").value = faith;
};

window.savePrayerCitySettings = () => {
  const city    = document.getElementById("prayer-city-input")?.value.trim();
  const country = document.getElementById("prayer-country-input")?.value.trim() || "SA";
  if (!city) { toast("Please enter a city name.", "error"); return; }
  savePrayerCity(city, country);
  toast(`✅ Prayer city set to ${city}! Kids will see prayer times on their dashboard.`, "success");
};

// Pre-fill prayer city on profile load
const origLoadProfileTab = window.loadProfileTab;
window.loadProfileTab = undefined;

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
// SESSION / NAVIGATION / BOOT
// ═══════════════════════════════════════════════════════════════
function saveKidSession(kid)  { sessionStorage.setItem("sk_kid",JSON.stringify(kid)); }
function loadKidSession()     { const d=sessionStorage.getItem("sk_kid"); return d?JSON.parse(d):null; }
function clearKidSession()    { sessionStorage.removeItem("sk_kid"); }

document.getElementById("btn-kid-logout")?.addEventListener("click",()=>{ clearKidSession(); currentKid=null; document.getElementById("kid-code-input").value=""; showScreen("screen-home"); toast("See you soon! 👋","info"); });

// Photo fullscreen
window.showPhotoFull = (url) => {
  const el = document.getElementById("photo-fullscreen");
  document.getElementById("photo-fullscreen-img").src = url;
  el.style.display = "flex";
};
window.closePhotoFull = () => { document.getElementById("photo-fullscreen").style.display = "none"; };

window.goToScreen     = id   => showScreen(id);
window.goToKidLogin   = ()   => showScreen("screen-kid-login");
window.goToParentAuth = mode => showScreen(mode==="signup"?"screen-signup":"screen-login");

(async function boot() {
  const saved=loadKidSession();
  if (saved) { currentKid=saved; financeSettings=await getFinanceSettings(saved.parentId); await showKidDashboard(saved); }
  else showScreen("screen-home");
})();
