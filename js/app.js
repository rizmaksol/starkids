// ============================================================
// js/app.js — StarKids V10  Sprint 1+2+3+4 (all fixes)
// ============================================================

import { signUpParent, loginParent, logoutParent, getParentProfile, onAuthChange } from "./auth.js";
import { addKid, getKidsByParent, deleteKid, regenerateKidCode, loginKidByCode, uploadKidPhoto, updateKidPhoto } from "./kid.js";
import { createTask, createDefaultTasks, getTasksForKid, getPendingApprovals, submitTask, approveTask, rejectTask, getStarBalance, STATUS } from "./tasks.js";
import { createGoalFromReward, getGoalsForKid, deleteGoal, checkGoalCompletion, addBonusStars, GOAL_STATUS } from "./goals.js";
import { getRewardsForParent, createReward, updateReward, deleteReward, seedDefaultRewards, requestRedemption, approveRedemption, rejectRedemption } from "./rewards.js";

// ── State ─────────────────────────────────────────────────────
let currentParent  = null;
let currentKid     = null;
let kidsList       = [];
let rewardsCatalog = [];
let selectedPhoto  = null;

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
function celebrate(title) {
  const el = document.getElementById("celebration");
  if (!el) return;
  document.getElementById("celebration-text").textContent = `🎉 Goal Reached!\n"${title}"`;
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

// ── Remember Me ───────────────────────────────────────────────
const LS_EMAIL = "sk_remembered_email";
const saveEmail = e => localStorage.setItem(LS_EMAIL, e);
const clearEmail = () => localStorage.removeItem(LS_EMAIL);
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
// APPROVALS (tasks + redemption requests)
// ═══════════════════════════════════════════════════════════════
async function loadPendingApprovals() {
  const pending = await getPendingApprovals(currentParent.uid);

  // Also get redemption requests across all kids
  const allGoals = [];
  for (const kid of kidsList) {
    const goals = await getGoalsForKid(kid.id);
    goals.filter(g => g.status === GOAL_STATUS.REQUESTED).forEach(g => allGoals.push({ ...g, kidName: kid.name, kidEmoji: kid.avatarEmoji, kidPhoto: kid.photoURL }));
  }

  const el    = document.getElementById("approvals-list");
  const badge = document.getElementById("approvals-badge");
  const total = pending.length + allGoals.length;
  if (badge) { badge.textContent = total || ""; badge.style.display = total ? "inline-flex" : "none"; }
  if (!el) return;

  let html = "";

  // Task approvals
  if (pending.length) {
    html += `<div class="task-section-title">📋 Task Approvals</div>`;
    html += pending.map(task => {
      const kid = kidsList.find(k => k.id === task.kidId);
      const av  = kid?.photoURL ? `<img src="${kid.photoURL}" class="approval-avatar-img" />` : `<span>${kid?.avatarEmoji||"🌟"}</span>`;
      return `<div class="approval-card">
        <div class="approval-avatar">${av}</div>
        <div class="approval-info">
          <div class="approval-kid">${kid?.name||"?"}</div>
          <div class="approval-task">${task.title}</div>
          <div class="approval-stars">⭐ ${task.stars} star${task.stars>1?"s":""}</div>
        </div>
        <div class="approval-actions">
          <button class="btn btn--sm btn--success" onclick="handleApprove('${task.id}','${task.kidId}',${task.stars},'${task.title}')">✅ Approve</button>
          <button class="btn btn--sm btn--danger"  onclick="handleReject('${task.id}','${task.title}')">❌ Reject</button>
        </div></div>`;
    }).join("");
  }

  // Redemption approvals
  if (allGoals.length) {
    html += `<div class="task-section-title">🎁 Reward Redemptions</div>`;
    html += allGoals.map(g => {
      const av = g.kidPhoto ? `<img src="${g.kidPhoto}" class="approval-avatar-img" />` : `<span>${g.kidEmoji||"🌟"}</span>`;
      return `<div class="approval-card approval-card--redeem">
        <div class="approval-avatar">${av}</div>
        <div class="approval-info">
          <div class="approval-kid">${g.kidName}</div>
          <div class="approval-task">${g.emoji} ${g.title}</div>
          <div class="approval-stars">⭐ ${g.targetStars} stars to deduct</div>
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
// WALLETS OVERVIEW
// ═══════════════════════════════════════════════════════════════
async function loadWalletsOverview() {
  const el = document.getElementById("wallets-list");
  if (!el) return;
  if (!kidsList.length) { el.innerHTML = `<p class="empty-state">Add kids first. 👶</p>`; return; }
  const rows = await Promise.all(kidsList.map(async kid => {
    const stars  = await getStarBalance(kid.id);
    const goals  = await getGoalsForKid(kid.id);
    const active = goals.find(g => g.status === GOAL_STATUS.ACTIVE);
    const pct    = active ? Math.min(100, Math.round((stars/active.targetStars)*100)) : null;
    const av     = kid.photoURL ? `<img src="${kid.photoURL}" class="wallet-avatar-img" />` : `<span class="wallet-avatar-emoji">${kid.avatarEmoji||"🌟"}</span>`;
    return `<div class="wallet-card"><div class="wallet-avatar">${av}</div>
      <div class="wallet-info">
        <div class="wallet-name">${kid.name}</div>
        <div class="wallet-stars">⭐ ${stars} stars</div>
        ${active ? `<div class="wallet-goal">
          <div class="wallet-goal-label">${active.emoji} Saving for: ${active.title} (${active.targetStars}⭐)</div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="progress-label">${stars} / ${active.targetStars} — ${pct}%</div>
        </div>` : `<div class="wallet-no-goal">No active goal</div>`}
      </div></div>`;
  }));
  el.innerHTML = rows.join("");
}

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
      <div class="reward-info"><div class="reward-title">${r.title}</div><div class="reward-stars">⭐ ${r.stars} stars</div></div>
      <div class="reward-actions">
        <button class="btn btn--sm btn--secondary" onclick="openEditReward('${r.id}','${r.title}',${r.stars},'${r.emoji}')">✏️</button>
        <button class="btn btn--sm btn--danger"    onclick="handleDeleteReward('${r.id}')">🗑</button>
      </div></div>`).join("");
  });
  el.innerHTML = html;
}

// ── Edit / Delete reward ──────────────────────────────────────
let editRewardId = null;
window.openEditReward = (id, title, stars, emoji) => {
  editRewardId = id;
  document.getElementById("edit-reward-title").value = title;
  document.getElementById("edit-reward-stars").value = stars;
  document.getElementById("edit-reward-emoji").value = emoji;
  document.getElementById("edit-reward-emoji-preview").textContent = emoji;
  document.getElementById("modal-edit-reward").classList.add("open");
};
window.closeEditReward = () => document.getElementById("modal-edit-reward").classList.remove("open");
document.getElementById("btn-save-edit-reward")?.addEventListener("click", async () => {
  const btn = document.getElementById("btn-save-edit-reward");
  const title = document.getElementById("edit-reward-title").value.trim();
  const stars = parseInt(document.getElementById("edit-reward-stars").value) || 1;
  const emoji = document.getElementById("edit-reward-emoji").value || "🎁";
  if (!title) { toast("Please enter a name.", "error"); return; }
  setLoading(btn, true);
  try { await updateReward(editRewardId, { title, stars, emoji }); closeEditReward(); await loadRewardsCatalog(); toast("Reward updated! ✅", "success"); }
  catch(err) { toast("Failed.", "error"); } finally { setLoading(btn, false); }
});
window.handleDeleteReward = async (id) => {
  if (!confirm("Delete this reward?")) return;
  try { await deleteReward(id); await loadRewardsCatalog(); toast("Removed.", "info"); }
  catch(err) { toast("Failed.", "error"); }
};

// ── Add custom reward ─────────────────────────────────────────
window.openAddReward  = () => { document.getElementById("new-reward-title").value=""; document.getElementById("new-reward-stars").value="20"; document.getElementById("new-reward-emoji").value="🎁"; document.getElementById("new-reward-emoji-preview").textContent="🎁"; document.getElementById("modal-add-reward").classList.add("open"); };
window.closeAddReward = () => document.getElementById("modal-add-reward").classList.remove("open");
document.getElementById("btn-save-new-reward")?.addEventListener("click", async () => {
  const btn = document.getElementById("btn-save-new-reward");
  const title = document.getElementById("new-reward-title").value.trim();
  const stars = parseInt(document.getElementById("new-reward-stars").value) || 20;
  const emoji = document.getElementById("new-reward-emoji").value || "🎁";
  if (!title) { toast("Please enter a name.", "error"); return; }
  setLoading(btn, true);
  try { await createReward(currentParent.uid, title, stars, emoji, "custom"); closeAddReward(); await loadRewardsCatalog(); toast(`"${title}" added! 🎁`, "success"); }
  catch(err) { toast("Failed.", "error"); console.error(err); } finally { setLoading(btn, false); }
});

// ── Approve / Reject redemption (parent) ─────────────────────
window.handleApproveRedemption = async (goalId, kidId, stars, title, kidName) => {
  if (!confirm(`Give "${title}" to ${kidName}? This will deduct ⭐${stars} from their wallet.`)) return;
  try {
    await approveRedemption(goalId, kidId, stars);
    toast(`🎁 "${title}" redeemed for ${kidName}! ⭐-${stars}`, "success");
    loadPendingApprovals();
    loadWalletsOverview();
  } catch(err) { toast("Failed.", "error"); console.error(err); }
};
window.handleRejectRedemption = async (goalId, title) => {
  try { await rejectRedemption(goalId); toast(`"${title}" sent back — not yet!`, "info"); loadPendingApprovals(); }
  catch(err) { toast("Failed.", "error"); }
};

// ═══════════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════════
window.showTab = (tab) => {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.getElementById(`tab-btn-${tab}`)?.classList.add("active");
  document.getElementById(`tab-${tab}`)?.classList.add("active");
  if (tab === "approvals") loadPendingApprovals();
  if (tab === "wallets")   loadWalletsOverview();
  if (tab === "rewards")   loadRewardsCatalog();
};

// ═══════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════
onAuthChange(async user => {
  if (user) {
    const profile = await getParentProfile(user.uid);
    currentParent = { uid: user.uid, name: profile?.name || "Parent", email: profile?.email || user.email, ...profile };
    await seedDefaultRewards(currentParent.uid);
    goToParentDashboard();
  } else { currentParent = null; showScreen("screen-home"); }
});

function goToParentDashboard() {
  document.getElementById("parent-name-display").textContent = `Welcome, ${currentParent.name}! 👋`;
  showScreen("screen-parent-dashboard"); showTab("kids"); loadKids();
}

// ── Sign Up ────────────────────────────────────────────────────
document.getElementById("btn-signup")?.addEventListener("click", async () => {
  const btn = document.getElementById("btn-signup");
  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  if (!name||!email||!password) { toast("Please fill in all fields.", "error"); return; }
  setLoading(btn, true);
  try {
    const user = await signUpParent(name, email, password);
    const profile = await getParentProfile(user.uid);
    currentParent = { uid: user.uid, name: profile?.name||name, email, ...profile };
    await seedDefaultRewards(currentParent.uid);
    toast("Account created! Welcome! 🌟", "success"); goToParentDashboard();
  } catch(err) { toast(friendlyError(err), "error"); } finally { setLoading(btn, false); }
});

// ── Login ──────────────────────────────────────────────────────
document.getElementById("btn-login")?.addEventListener("click", async () => {
  const btn = document.getElementById("btn-login");
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const remember = document.getElementById("remember-me")?.checked;
  if (!email||!password) { toast("Please enter email and password.", "error"); return; }
  setLoading(btn, true);
  try {
    const user = await loginParent(email, password);
    remember ? saveEmail(email) : clearEmail();
    const profile = await getParentProfile(user.uid);
    currentParent = { uid: user.uid, name: profile?.name||"Parent", email, ...profile };
    await seedDefaultRewards(currentParent.uid);
    toast("Welcome back! 🌟", "success"); goToParentDashboard();
  } catch(err) { toast(friendlyError(err), "error"); } finally { setLoading(btn, false); }
});

document.getElementById("btn-logout")?.addEventListener("click", async () => { await logoutParent(); toast("Logged out!", "info"); });

// ═══════════════════════════════════════════════════════════════
// ADD KID
// ═══════════════════════════════════════════════════════════════
document.getElementById("btn-add-kid")?.addEventListener("click", async () => {
  const btn = document.getElementById("btn-add-kid");
  const name = document.getElementById("kid-name").value.trim();
  const age  = parseInt(document.getElementById("kid-age").value, 10);
  const emoji = document.getElementById("kid-avatar").value || "🌟";
  if (!name||!age||age<1||age>18) { toast("Please enter a valid name and age.", "error"); return; }
  setLoading(btn, true);
  try {
    const kid = await addKid(currentParent.uid, name, age, emoji, null);
    if (selectedPhoto) {
      toast("Uploading photo… 📸", "info");
      const url = await uploadKidPhoto(currentParent.uid, kid.id, selectedPhoto);
      await updateKidPhoto(kid.id, url); kid.photoURL = url;
    }
    await createDefaultTasks(currentParent.uid, kid.id, age);
    kidsList.push(kid); renderKids();
    document.getElementById("kid-name").value=""; document.getElementById("kid-age").value=""; document.getElementById("kid-avatar").value="🌟";
    document.getElementById("kid-photo-input").value=""; document.getElementById("kid-photo-preview").style.display="none"; document.getElementById("kid-photo-placeholder").style.display="flex";
    selectedPhoto = null;
    toast(`${kid.name} added! Code: ${kid.code} 🎉`, "success");
  } catch(err) { toast("Failed to add kid.", "error"); console.error(err); } finally { setLoading(btn, false); }
});

window.handleDeleteKid = async (kidId, kidName) => {
  if (!confirm(`Delete ${kidName}?`)) return;
  try { await deleteKid(kidId); kidsList = kidsList.filter(k=>k.id!==kidId); renderKids(); toast(`${kidName} removed.`, "info"); }
  catch(err) { toast("Failed.", "error"); }
};
window.handleRegenCode = async (kidId) => {
  try {
    const code = await regenerateKidCode(kidId);
    const idx  = kidsList.findIndex(k=>k.id===kidId); if(idx!==-1) kidsList[idx].code=code;
    const el   = document.getElementById(`code-${kidId}`);
    if(el) { el.textContent=code; el.classList.add("code-flash"); setTimeout(()=>el.classList.remove("code-flash"),800); }
    toast(`New code: ${code}`, "success");
  } catch(err) { toast("Failed.", "error"); }
};

// ── Bonus Stars ───────────────────────────────────────────────
let bonusKidId=null, bonusKidName=null;
window.openBonusStars  = (id,name) => { bonusKidId=id; bonusKidName=name; document.getElementById("modal-bonus-kid-name").textContent=`Bonus Stars for ${name}`; document.getElementById("bonus-stars-input").value="1"; document.getElementById("bonus-reason-input").value=""; document.getElementById("modal-bonus").classList.add("open"); };
window.closeBonusStars = () => document.getElementById("modal-bonus").classList.remove("open");
document.getElementById("btn-save-bonus")?.addEventListener("click", async () => {
  const btn = document.getElementById("btn-save-bonus");
  const stars = parseInt(document.getElementById("bonus-stars-input").value)||1;
  setLoading(btn,true);
  try {
    const newTotal = await addBonusStars(bonusKidId, stars);
    // Check goals
    const completed = await checkGoalCompletion(bonusKidId, newTotal);
    completed.forEach(g => celebrate(g.title));
    closeBonusStars(); toast(`⭐ ${stars} bonus star${stars>1?"s":""} given to ${bonusKidName}!`, "success");
  } catch(err) { toast("Failed.", "error"); } finally { setLoading(btn,false); }
});

// ── Add Task ──────────────────────────────────────────────────
let taskKidId=null, taskKidName=null;
window.openAddTask  = (id,name) => { taskKidId=id; taskKidName=name; document.getElementById("modal-task-kid-name").textContent=`Task for ${name}`; document.getElementById("task-title-input").value=""; document.getElementById("task-desc-input").value=""; document.getElementById("task-stars-input").value="1"; document.getElementById("modal-add-task").classList.add("open"); };
window.closeAddTask = () => document.getElementById("modal-add-task").classList.remove("open");
document.getElementById("btn-save-task")?.addEventListener("click", async () => {
  const btn = document.getElementById("btn-save-task");
  const title = document.getElementById("task-title-input").value.trim();
  const desc  = document.getElementById("task-desc-input").value.trim();
  const stars = parseInt(document.getElementById("task-stars-input").value)||1;
  if (!title) { toast("Please enter a task title.", "error"); return; }
  setLoading(btn,true);
  try { await createTask(currentParent.uid, taskKidId, title, desc, stars); closeAddTask(); toast(`Task added for ${taskKidName}! ⭐`, "success"); }
  catch(err) { toast("Failed.", "error"); } finally { setLoading(btn,false); }
});

// ── Approve / Reject task ─────────────────────────────────────
window.handleApprove = async (taskId, kidId, stars, title) => {
  try {
    await approveTask(taskId, kidId, stars);
    toast(`✅ Approved! ${stars}⭐ for "${title}"`, "success");
    const newStars  = await getStarBalance(kidId);
    const completed = await checkGoalCompletion(kidId, newStars);
    completed.forEach(g => celebrate(g.title));
    loadPendingApprovals();
  } catch(err) { toast("Failed.", "error"); console.error(err); }
};
window.handleReject = async (taskId, title) => {
  try { await rejectTask(taskId); toast(`❌ "${title}" sent back.`, "info"); loadPendingApprovals(); }
  catch(err) { toast("Failed.", "error"); }
};

// ═══════════════════════════════════════════════════════════════
// KID LOGIN
// ═══════════════════════════════════════════════════════════════
document.getElementById("btn-kid-login")?.addEventListener("click", async () => {
  const btn  = document.getElementById("btn-kid-login");
  const code = document.getElementById("kid-code-input").value.trim();
  if (code.length!==6||!/^\d+$/.test(code)) { toast("Please enter a valid 6-digit code.", "error"); return; }
  setLoading(btn,true);
  try {
    const kid = await loginKidByCode(code);
    if (!kid) { toast("Code not found. Ask your parent!", "error"); return; }
    currentKid = kid; saveKidSession(kid);
    await showKidDashboard(kid);
    toast(`Hi ${kid.name}! Let's have a great day! 🌟`, "success");
  } catch(err) { toast("Error: "+(err?.message||"Unknown").slice(0,60), "error"); console.error(err); }
  finally { setLoading(btn,false); }
});

// ═══════════════════════════════════════════════════════════════
// KID DASHBOARD
// ═══════════════════════════════════════════════════════════════
async function showKidDashboard(kid) {
  const av = document.getElementById("kid-dashboard-avatar");
  av.innerHTML = kid.photoURL ? `<img src="${kid.photoURL}" class="kid-dash-photo" />` : kid.avatarEmoji||"🌟";
  document.getElementById("kid-dashboard-name").textContent = `Hi, ${kid.name}!`;
  const stars = await getStarBalance(kid.id);
  document.getElementById("kid-dashboard-stars").textContent = `⭐ ${stars} Stars`;
  await loadKidTasks(kid);
  await loadKidGoalsView(kid.id, stars);
  showKidTab("tasks");
  showScreen("screen-kid-dashboard");
}

// ── Kid tasks ──────────────────────────────────────────────────
async function loadKidTasks(kid) {
  const tasks = await getTasksForKid(kid.id);
  const el    = document.getElementById("kid-tasks-list");
  if (!el) return;
  const active   = tasks.filter(t => t.status===STATUS.PENDING||t.status===STATUS.REJECTED);
  const waiting  = tasks.filter(t => t.status===STATUS.SUBMITTED);
  const approved = tasks.filter(t => t.status===STATUS.APPROVED);
  let html = "";
  if (!tasks.length) html = `<p class="empty-state">No tasks yet! Ask your parent. 🌟</p>`;
  if (active.length) {
    html += `<div class="task-section-title">📋 My Tasks</div>`;
    html += active.map(t => `<div class="task-card task-card--pending">
      <div class="task-card__info">
        <div class="task-card__title">${t.title}</div>
        ${t.description?`<div class="task-card__desc">${t.description}</div>`:""}
        <div class="task-card__stars">⭐ ${t.stars} star${t.stars>1?"s":""}</div>
        ${t.status===STATUS.REJECTED?`<div class="task-card__rejected">❌ Try again!</div>`:""}
      </div>
      <button class="btn btn--sm btn--success" onclick="handleTaskDone('${t.id}')">✅ Done!</button>
    </div>`).join("");
  }
  if (waiting.length) {
    html += `<div class="task-section-title">⏳ Waiting Approval</div>`;
    html += waiting.map(t => `<div class="task-card task-card--submitted">
      <div class="task-card__info"><div class="task-card__title">${t.title}</div><div class="task-card__stars">⭐ ${t.stars}</div></div>
      <span class="task-badge task-badge--waiting">Waiting…</span>
    </div>`).join("");
  }
  if (approved.length) {
    html += `<div class="task-section-title">✅ Completed</div>`;
    html += approved.map(t => `<div class="task-card task-card--approved">
      <div class="task-card__info"><div class="task-card__title">${t.title}</div><div class="task-card__stars">⭐ +${t.stars}</div></div>
      <span class="task-badge task-badge--approved">Done! ⭐</span>
    </div>`).join("");
  }
  el.innerHTML = html;
}

window.handleTaskDone = async (taskId) => {
  const btn = document.querySelector(`[onclick="handleTaskDone('${taskId}')"]`);
  if (btn) { btn.disabled=true; btn.textContent="Sending…"; }
  try {
    await submitTask(taskId);
    toast("Sent to parent for approval! 🚀", "success");
    await loadKidTasks(currentKid);
  } catch(err) { toast("Something went wrong.", "error"); console.error(err); }
};

// ═══════════════════════════════════════════════════════════════
// KID GOALS — browse catalog, pick/change goal, request redeem
// ═══════════════════════════════════════════════════════════════
let parentRewardsForKid = [];

async function loadKidGoalsView(kidId, currentStars) {
  const el = document.getElementById("kid-goals-list");
  if (!el) return;

  const goals    = await getGoalsForKid(kidId);
  const active   = goals.find(g => g.status === GOAL_STATUS.ACTIVE);
  const completed = goals.filter(g => g.status === GOAL_STATUS.COMPLETED);
  const requested = goals.filter(g => g.status === GOAL_STATUS.REQUESTED);
  const redeemed  = goals.filter(g => g.status === "redeemed");

  let html = "";

  // Active goal with progress
  if (active) {
    const pct = Math.min(100, Math.round((currentStars/active.targetStars)*100));
    const reached = currentStars >= active.targetStars;
    html += `<div class="task-section-title">🎯 My Current Goal</div>
    <div class="goal-card ${reached?"goal-card--reached":""}">
      <div class="goal-emoji">${active.emoji}</div>
      <div class="goal-info">
        <div class="goal-title">${active.title}</div>
        <div class="goal-target">Need ⭐ ${active.targetStars} stars</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="progress-label">⭐ ${currentStars} / ${active.targetStars} — ${pct}% there!</div>
        ${reached ? `<button class="btn btn--success mt-8" onclick="handleRequestRedeem('${active.id}','${active.title}')">🎁 I'm Ready! Ask Parent to Redeem</button>` : ""}
      </div>
      <button class="goal-delete-btn" title="Change goal" onclick="openPickGoal()">✏️</button>
    </div>`;
  }

  // Redemption requested
  if (requested.length) {
    html += `<div class="task-section-title">⏳ Waiting for Parent</div>`;
    html += requested.map(g => `<div class="goal-card goal-card--waiting">
      <div class="goal-emoji">${g.emoji}</div>
      <div class="goal-info">
        <div class="goal-title">${g.title}</div>
        <div class="goal-target">🎁 Redemption requested! Ask your parent.</div>
      </div></div>`).join("");
  }

  // Completed (not yet requested)
  if (completed.length) {
    html += `<div class="task-section-title">🏆 Goal Reached!</div>`;
    html += completed.map(g => `<div class="goal-card goal-card--done">
      <div class="goal-emoji">${g.emoji}</div>
      <div class="goal-info">
        <div class="goal-title">${g.title}</div>
        <div class="goal-target">You did it! ⭐${g.targetStars} stars earned.</div>
        <button class="btn btn--success mt-8" onclick="handleRequestRedeem('${g.id}','${g.title}')">🎁 Request Reward from Parent</button>
      </div></div>`).join("");
  }

  // Redeemed history
  if (redeemed.length) {
    html += `<div class="task-section-title">🎁 Past Rewards</div>`;
    html += redeemed.map(g => `<div class="goal-card goal-card--redeemed">
      <div class="goal-emoji">${g.emoji}</div>
      <div class="goal-info"><div class="goal-title">${g.title}</div><div class="goal-target">🎉 Enjoyed!</div></div>
    </div>`).join("");
  }

  // Always show browse/pick button
  html += `<div style="margin-top:16px;">
    <button class="btn btn--${active?"secondary":"kid"}" onclick="openPickGoal()">
      ${active ? "🔄 Browse & Change Goal" : "🎯 Pick a Goal"}
    </button>
  </div>`;

  el.innerHTML = html;
}

// ── Kid requests redemption ───────────────────────────────────
window.handleRequestRedeem = async (goalId, title) => {
  try {
    await requestRedemption(goalId, currentKid.id, title, 0);
    toast("🎁 Redemption requested! Ask your parent to approve.", "success");
    const stars = await getStarBalance(currentKid.id);
    await loadKidGoalsView(currentKid.id, stars);
  } catch(err) { toast("Something went wrong.", "error"); console.error(err); }
};

// ── Browse reward catalog ─────────────────────────────────────
window.openPickGoal = async () => {
  const el = document.getElementById("reward-picker-list");
  el.innerHTML = `<p class="empty-state">Loading rewards…</p>`;
  document.getElementById("modal-pick-goal").classList.add("open");
  parentRewardsForKid = await getRewardsForParent(currentKid.parentId);
  if (!parentRewardsForKid.length) { el.innerHTML = `<p class="empty-state">Your parent hasn't added rewards yet!</p>`; return; }
  const stars  = await getStarBalance(currentKid.id);
  const sorted = [...parentRewardsForKid].sort((a,b) => a.stars-b.stars);
  el.innerHTML = sorted.map(r => {
    const can = stars >= r.stars;
    const pct = Math.min(100, Math.round((stars/r.stars)*100));
    return `<div class="reward-picker-item ${can?"reward-picker-item--ready":""}" onclick="handlePickGoal('${r.id}')">
      <span class="reward-emoji">${r.emoji}</span>
      <div class="reward-info">
        <div class="reward-title">${r.title}</div>
        <div class="reward-stars">⭐ ${r.stars} stars ${can?"— You can get this! 🎉":`— ${pct}% saved`}</div>
        ${!can?`<div class="mini-progress"><div class="mini-progress-fill" style="width:${pct}%"></div></div>`:""}
      </div>
      ${can?`<span class="ready-badge">Ready! 🎉</span>`:""}
    </div>`;
  }).join("");
};
window.closePickGoal = () => document.getElementById("modal-pick-goal").classList.remove("open");

window.handlePickGoal = async (rewardId) => {
  const reward = parentRewardsForKid.find(r=>r.id===rewardId);
  if (!reward) return;
  try {
    await createGoalFromReward(currentKid.id, reward);
    closePickGoal();
    toast(`Goal set: "${reward.title}" 🎯`, "success");
    const stars = await getStarBalance(currentKid.id);
    await loadKidGoalsView(currentKid.id, stars);
  } catch(err) { toast("Failed to set goal.", "error"); console.error(err); }
};

// ── Kid tabs ──────────────────────────────────────────────────
window.showKidTab = (tab) => {
  document.querySelectorAll(".kid-tab-btn").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll(".kid-tab-panel").forEach(p=>p.classList.remove("active"));
  document.getElementById(`kid-tab-btn-${tab}`)?.classList.add("active");
  document.getElementById(`kid-tab-${tab}`)?.classList.add("active");
};

// ═══════════════════════════════════════════════════════════════
// SESSION / NAVIGATION / BOOT
// ═══════════════════════════════════════════════════════════════
function saveKidSession(kid)  { sessionStorage.setItem("sk_kid", JSON.stringify(kid)); }
function loadKidSession()     { const d=sessionStorage.getItem("sk_kid"); return d?JSON.parse(d):null; }
function clearKidSession()    { sessionStorage.removeItem("sk_kid"); }

document.getElementById("btn-kid-logout")?.addEventListener("click", () => {
  clearKidSession(); currentKid=null; document.getElementById("kid-code-input").value="";
  showScreen("screen-home"); toast("See you soon! 👋", "info");
});

window.goToScreen     = id   => showScreen(id);
window.goToKidLogin   = ()   => showScreen("screen-kid-login");
window.goToParentAuth = mode => showScreen(mode==="signup"?"screen-signup":"screen-login");

(async function boot() {
  const saved = loadKidSession();
  if (saved) { currentKid=saved; await showKidDashboard(saved); }
  else showScreen("screen-home");
})();
