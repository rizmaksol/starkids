// ============================================================
// js/app.js — StarKids V10  Sprint 1+2+3+4+5+6
// ============================================================

import { signUpParent, loginParent, logoutParent, getParentProfile, onAuthChange } from "./auth.js";
import { addKid, getKidsByParent, deleteKid, regenerateKidCode, loginKidByCode, uploadKidPhoto, updateKidPhoto } from "./kid.js";
import { createTask, createDefaultTasks, getTasksForKid, getPendingApprovals, submitTask, approveTask, rejectTask, getStarBalance, resetRecurringTasks, STATUS, TASK_TYPE } from "./tasks.js";
import { createGoalFromReward, getGoalsForKid, deleteGoal, checkGoalCompletion, addBonusStars, GOAL_STATUS } from "./goals.js";
import { getRewardsForParent, createReward, updateReward, deleteReward, seedDefaultRewards, requestRedemption, approveRedemption, rejectRedemption } from "./rewards.js";
import { getFinanceSettings, saveFinanceSettings, starsToMoney, getEntrepreneurJobs, seedDefaultJobs, createJob, deleteJob, claimJob } from "./finance.js";

// ── State ─────────────────────────────────────────────────────
let currentParent    = null;
let currentKid       = null;
let kidsList         = [];
let rewardsCatalog   = [];
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

document.getElementById("btn-signup")?.addEventListener("click", async () => {
  const btn=document.getElementById("btn-signup"); const name=document.getElementById("signup-name").value.trim(); const email=document.getElementById("signup-email").value.trim(); const password=document.getElementById("signup-password").value;
  if (!name||!email||!password) { toast("Please fill in all fields.","error"); return; } setLoading(btn,true);
  try {
    const user=await signUpParent(name,email,password); const profile=await getParentProfile(user.uid);
    currentParent={uid:user.uid,name:profile?.name||name,email,...profile};
    financeSettings=await getFinanceSettings(currentParent.uid);
    await seedDefaultRewards(currentParent.uid);
    toast("Account created! Welcome! 🌟","success"); goToParentDashboard();
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
    if (selectedPhoto) { toast("Uploading photo… 📸","info"); const url=await uploadKidPhoto(currentParent.uid,kid.id,selectedPhoto); await updateKidPhoto(kid.id,url); kid.photoURL=url; }
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
window.openAddTask  = (id,name) => { taskKidId=id; taskKidName=name; document.getElementById("modal-task-kid-name").textContent=`Task for ${name}`; document.getElementById("task-title-input").value=""; document.getElementById("task-desc-input").value=""; document.getElementById("task-stars-input").value="1"; selectTaskType("daily"); document.getElementById("modal-add-task").classList.add("open"); };
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
    const newStars=await getStarBalance(kidId); const completed=await checkGoalCompletion(kidId,newStars);
    completed.forEach(g=>celebrate(`🎉 Goal Reached!\n"${g.title}"`));
    loadPendingApprovals();
  } catch(err) { toast("Failed.","error"); console.error(err); }
};
window.handleReject = async (taskId,title) => { try { await rejectTask(taskId); toast(`❌ "${title}" sent back.`,"info"); loadPendingApprovals(); } catch(err) { toast("Failed.","error"); } };

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

  const stars = await getStarBalance(kid.id);
  const money = starsToMoney(stars, financeSettings);
  document.getElementById("kid-dashboard-stars").textContent = `⭐ ${stars} Stars`;
  document.getElementById("kid-dashboard-money").textContent = `💰 ${money}`;

  await loadKidTasks(kid);
  await loadKidGoalsView(kid.id, stars);
  showKidTab("tasks");
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
      html += regular.map(t => {
        const typeBadge = t.taskType==="daily"?`<span class="type-badge type-badge--daily">🔄 Daily</span>`:t.taskType==="weekly"?`<span class="type-badge type-badge--weekly">📅 Weekly</span>`:`<span class="type-badge type-badge--onetime">1️⃣ One-time</span>`;
        const streakBadge = (t.streak&&t.streak>1)?`<span class="streak-badge">🔥 ${t.streak}</span>`:"";
        return `<div class="task-card task-card--pending">
          <div class="task-card__info">
            <div class="task-card__title-row">${typeBadge}${streakBadge}</div>
            <div class="task-card__title">${t.title}</div>
            ${t.description?`<div class="task-card__desc">${t.description}</div>`:""}
            <div class="task-card__stars">⭐ ${t.stars} = ${starsToMoney(t.stars,financeSettings)}</div>
            ${t.status===STATUS.REJECTED?`<div class="task-card__rejected">❌ Try again!</div>`:""}
          </div>
          <button class="btn btn--sm btn--success" onclick="handleTaskDone('${t.id}')">✅ Done!</button>
        </div>`;
      }).join("");
    }
    if (jobs.length) {
      html += `<div class="task-section-title">💼 Entrepreneur Jobs</div>`;
      html += jobs.map(t => `<div class="task-card task-card--job">
        <div class="task-card__info">
          <div class="task-card__title">${t.title}</div>
          ${t.description?`<div class="task-card__desc">${t.description}</div>`:""}
          <div class="task-card__stars">⭐ ${t.stars} = ${starsToMoney(t.stars,financeSettings)}</div>
        </div>
        <button class="btn btn--sm btn--success" onclick="handleTaskDone('${t.id}')">✅ Done!</button>
      </div>`).join("");
    }
  }
  if (waiting.length) {
    html+=`<div class="task-section-title">⏳ Waiting Approval</div>`;
    html+=waiting.map(t=>`<div class="task-card task-card--submitted"><div class="task-card__info"><div class="task-card__title">${t.title}</div><div class="task-card__stars">⭐ ${t.stars} = ${starsToMoney(t.stars,financeSettings)}</div></div><span class="task-badge task-badge--waiting">Waiting…</span></div>`).join("");
  }
  if (approved.length) {
    html+=`<div class="task-section-title">✅ Completed</div>`;
    html+=approved.map(t=>`<div class="task-card task-card--approved"><div class="task-card__info"><div class="task-card__title">${t.title}</div><div class="task-card__stars">⭐ +${t.stars} = +${starsToMoney(t.stars,financeSettings)}</div></div><span class="task-badge task-badge--approved">Done! ⭐</span></div>`).join("");
  }
  el.innerHTML=html;
}

window.handleTaskDone = async (taskId) => {
  const btn=document.querySelector(`[onclick="handleTaskDone('${taskId}')"]`);
  if (btn) { btn.disabled=true; btn.textContent="Sending…"; }
  try { await submitTask(taskId); toast("Sent to parent for approval! 🚀","success"); await loadKidTasks(currentKid); }
  catch(err) { toast("Something went wrong.","error"); console.error(err); }
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
  // Jobs section
  html += `<div class="task-section-title" style="margin-top:20px;">💼 Entrepreneur Jobs</div>
  <p style="font-size:0.82rem;color:var(--color-muted);margin-bottom:10px;">Pick up extra jobs to earn more stars!</p>
  <div id="kid-jobs-list"><p class="empty-state">Loading jobs…</p></div>`;

  html+=`<div style="margin-top:16px;"><button class="btn btn--${active?"secondary":"kid"}" onclick="openPickGoal()">${active?"🔄 Browse & Change Goal":"🎯 Pick a Goal"}</button></div>`;
  el.innerHTML=html;
  loadKidJobs(kidId);
}

// ── Kid entrepreneur jobs ─────────────────────────────────────
async function loadKidJobs(kidId) {
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
};

// ═══════════════════════════════════════════════════════════════
// SESSION / NAVIGATION / BOOT
// ═══════════════════════════════════════════════════════════════
function saveKidSession(kid)  { sessionStorage.setItem("sk_kid",JSON.stringify(kid)); }
function loadKidSession()     { const d=sessionStorage.getItem("sk_kid"); return d?JSON.parse(d):null; }
function clearKidSession()    { sessionStorage.removeItem("sk_kid"); }

document.getElementById("btn-kid-logout")?.addEventListener("click",()=>{ clearKidSession(); currentKid=null; document.getElementById("kid-code-input").value=""; showScreen("screen-home"); toast("See you soon! 👋","info"); });

window.goToScreen     = id   => showScreen(id);
window.goToKidLogin   = ()   => showScreen("screen-kid-login");
window.goToParentAuth = mode => showScreen(mode==="signup"?"screen-signup":"screen-login");

(async function boot() {
  const saved=loadKidSession();
  if (saved) { currentKid=saved; financeSettings=await getFinanceSettings(saved.parentId); await showKidDashboard(saved); }
  else showScreen("screen-home");
})();
