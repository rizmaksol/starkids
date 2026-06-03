// ============================================================
// js/app.js — StarKids V10  Sprint 1 + 2 + 3 + 4
// ============================================================

import { signUpParent, loginParent, logoutParent, getParentProfile, onAuthChange } from "./auth.js";
import { addKid, getKidsByParent, deleteKid, regenerateKidCode, loginKidByCode, uploadKidPhoto, updateKidPhoto } from "./kid.js";
import { createTask, createDefaultTasks, getTasksForKid, getPendingApprovals, submitTask, approveTask, rejectTask, getStarBalance, STATUS } from "./tasks.js";
import { createGoalFromReward, getGoalsForKid, deleteGoal, checkGoalCompletion, addBonusStars, GOAL_STATUS } from "./goals.js";
import { getRewardsForParent, createReward, updateReward, deleteReward, seedDefaultRewards, redeemReward } from "./rewards.js";

// ── State ─────────────────────────────────────────────────────
let currentParent  = null;
let currentKid     = null;
let kidsList       = [];
let rewardsCatalog = [];   // parent's reward list
let selectedPhoto  = null;

// ── Screen Router ─────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");
}

// ── Toast ──────────────────────────────────────────────────────
function toast(msg, type = "info") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className   = `toast toast--${type} toast--show`;
  setTimeout(() => t.classList.remove("toast--show"), 3500);
}

// ── Celebration overlay ────────────────────────────────────────
function celebrate(title) {
  const el = document.getElementById("celebration");
  if (!el) return;
  document.getElementById("celebration-text").textContent = `🎉 Goal Reached!\n"${title}"`;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 4500);
}

// ── Error map ──────────────────────────────────────────────────
function friendlyError(err) {
  const map = {
    "auth/email-already-in-use": "This email is already registered.",
    "auth/invalid-email":        "Please enter a valid email address.",
    "auth/weak-password":        "Password must be at least 6 characters.",
    "auth/user-not-found":       "No account found with this email.",
    "auth/wrong-password":       "Incorrect password. Please try again.",
    "auth/invalid-credential":   "Email or password is incorrect."
  };
  return map[err.code] || err.message;
}

// ── Loading button ─────────────────────────────────────────────
function setLoading(btn, loading) {
  btn.disabled     = loading;
  btn.dataset.orig = btn.dataset.orig || btn.textContent;
  btn.textContent  = loading ? "Please wait…" : btn.dataset.orig;
}

// ═══════════════════════════════════════════════════════════════
// REMEMBER ME
// ═══════════════════════════════════════════════════════════════
const LS_EMAIL = "sk_remembered_email";
const saveEmail  = e  => localStorage.setItem(LS_EMAIL, e);
const clearEmail = () => localStorage.removeItem(LS_EMAIL);
const getSavedEmail = () => localStorage.getItem(LS_EMAIL) || "";

(function prefill() {
  const saved = getSavedEmail();
  if (!saved) return;
  const el = document.getElementById("login-email");
  const cb = document.getElementById("remember-me");
  if (el) el.value   = saved;
  if (cb) cb.checked = true;
})();

// ═══════════════════════════════════════════════════════════════
// PHOTO PREVIEW
// ═══════════════════════════════════════════════════════════════
document.getElementById("kid-photo-input")?.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  selectedPhoto = file;
  const prev = document.getElementById("kid-photo-preview");
  prev.src = URL.createObjectURL(file);
  prev.style.display = "block";
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
      ? `<img src="${kid.photoURL}" class="kid-card__photo" alt="${kid.name}" />`
      : `<div class="kid-card__avatar">${kid.avatarEmoji || "🌟"}</div>`;
    return `
      <div class="kid-card" data-id="${kid.id}">
        ${av}
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
        </div>
      </div>`;
  }).join("");
}

async function loadKids() {
  if (!currentParent) return;
  kidsList = await getKidsByParent(currentParent.uid);
  renderKids();
}

// ═══════════════════════════════════════════════════════════════
// APPROVALS
// ═══════════════════════════════════════════════════════════════
async function loadPendingApprovals() {
  const pending = await getPendingApprovals(currentParent.uid);
  const el      = document.getElementById("approvals-list");
  if (!el) return;
  const badge = document.getElementById("approvals-badge");
  if (badge) { badge.textContent = pending.length || ""; badge.style.display = pending.length ? "inline-flex" : "none"; }
  if (!pending.length) { el.innerHTML = `<p class="empty-state">No pending approvals 🎉</p>`; return; }
  el.innerHTML = pending.map(task => {
    const kid = kidsList.find(k => k.id === task.kidId);
    const av  = kid?.photoURL ? `<img src="${kid.photoURL}" class="approval-avatar-img" />` : `<span>${kid?.avatarEmoji || "🌟"}</span>`;
    return `
      <div class="approval-card">
        <div class="approval-avatar">${av}</div>
        <div class="approval-info">
          <div class="approval-kid">${kid?.name || "?"}</div>
          <div class="approval-task">${task.title}</div>
          <div class="approval-stars">⭐ ${task.stars} star${task.stars > 1 ? "s" : ""}</div>
        </div>
        <div class="approval-actions">
          <button class="btn btn--sm btn--success" onclick="handleApprove('${task.id}','${task.kidId}',${task.stars},'${task.title}')">✅ Approve</button>
          <button class="btn btn--sm btn--danger"  onclick="handleReject('${task.id}','${task.title}')">❌ Reject</button>
        </div>
      </div>`;
  }).join("");
}

// ═══════════════════════════════════════════════════════════════
// WALLETS OVERVIEW (parent)
// ═══════════════════════════════════════════════════════════════
async function loadWalletsOverview() {
  const el = document.getElementById("wallets-list");
  if (!el) return;
  if (!kidsList.length) { el.innerHTML = `<p class="empty-state">Add kids first. 👶</p>`; return; }

  const rows = await Promise.all(kidsList.map(async kid => {
    const stars     = await getStarBalance(kid.id);
    const goals     = await getGoalsForKid(kid.id);
    const active    = goals.find(g => g.status === GOAL_STATUS.ACTIVE);
    const completed = goals.filter(g => g.status === GOAL_STATUS.COMPLETED);
    const pct       = active ? Math.min(100, Math.round((stars / active.targetStars) * 100)) : null;
    const av        = kid.photoURL ? `<img src="${kid.photoURL}" class="wallet-avatar-img" />` : `<span class="wallet-avatar-emoji">${kid.avatarEmoji || "🌟"}</span>`;

    const completedHTML = completed.length ? `
      <div class="wallet-completed-goals">
        ${completed.map(g => `
          <div class="wallet-completed-item">
            <span>${g.emoji} ${g.title}</span>
            <button class="btn btn--sm btn--success" onclick="handleRedeemGoal('${g.id}','${kid.id}',${g.targetStars},'${g.title}','${kid.name}')">🎁 Redeem</button>
          </div>`).join("")}
      </div>` : "";

    return `
      <div class="wallet-card">
        <div class="wallet-avatar">${av}</div>
        <div class="wallet-info">
          <div class="wallet-name">${kid.name}</div>
          <div class="wallet-stars">⭐ ${stars} stars</div>
          ${active ? `
            <div class="wallet-goal">
              <div class="wallet-goal-label">${active.emoji} Saving for: ${active.title} (${active.targetStars}⭐)</div>
              <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
              <div class="progress-label">${stars} / ${active.targetStars} stars — ${pct}%</div>
            </div>` : `<div class="wallet-no-goal">No active goal</div>`}
          ${completedHTML}
        </div>
      </div>`;
  }));
  el.innerHTML = rows.join("");
}

// ═══════════════════════════════════════════════════════════════
// REWARDS CATALOG (parent manages)
// ═══════════════════════════════════════════════════════════════
async function loadRewardsCatalog() {
  rewardsCatalog = await getRewardsForParent(currentParent.uid);
  renderRewardsCatalog();
}

function renderRewardsCatalog() {
  const el = document.getElementById("rewards-catalog-list");
  if (!el) return;

  // Group by category
  const cats = {};
  rewardsCatalog.forEach(r => {
    const c = r.category || "custom";
    if (!cats[c]) cats[c] = [];
    cats[c].push(r);
  });

  const catLabels = { treat: "🍬 Treats", outing: "🎡 Outings", toy: "🧸 Toys & Things", big: "🏆 Big Rewards", custom: "✨ Custom" };

  let html = "";
  Object.entries(cats).forEach(([cat, rewards]) => {
    html += `<div class="reward-cat-title">${catLabels[cat] || cat}</div>`;
    html += rewards.map(r => `
      <div class="reward-catalog-item">
        <span class="reward-emoji">${r.emoji}</span>
        <div class="reward-info">
          <div class="reward-title">${r.title}</div>
          <div class="reward-stars">⭐ ${r.stars} stars</div>
        </div>
        <div class="reward-actions">
          <button class="btn btn--sm btn--secondary" onclick="openEditReward('${r.id}','${r.title}',${r.stars},'${r.emoji}')">✏️</button>
          <button class="btn btn--sm btn--danger"    onclick="handleDeleteReward('${r.id}')">🗑</button>
        </div>
      </div>`).join("");
  });

  if (!rewardsCatalog.length) html = `<p class="empty-state">No rewards yet. Add some below!</p>`;
  el.innerHTML = html;
}

// ── Redeem a completed goal ───────────────────────────────────
window.handleRedeemGoal = async (goalId, kidId, stars, title, kidName) => {
  if (!confirm(`Redeem "${title}" for ${kidName}? This will deduct ${stars}⭐ from their wallet.`)) return;
  try {
    await redeemReward(goalId, kidId, title, stars);
    toast(`🎁 "${title}" redeemed for ${kidName}!`, "success");
    loadWalletsOverview();
  } catch (err) { toast("Failed to redeem.", "error"); console.error(err); }
};

// ── Edit reward modal ─────────────────────────────────────────
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
  const btn   = document.getElementById("btn-save-edit-reward");
  const title = document.getElementById("edit-reward-title").value.trim();
  const stars = parseInt(document.getElementById("edit-reward-stars").value, 10) || 1;
  const emoji = document.getElementById("edit-reward-emoji").value || "🎁";
  if (!title) { toast("Please enter a reward name.", "error"); return; }
  setLoading(btn, true);
  try {
    await updateReward(editRewardId, { title, stars, emoji });
    closeEditReward();
    await loadRewardsCatalog();
    toast("Reward updated! ✅", "success");
  } catch (err) { toast("Failed to update.", "error"); }
  finally { setLoading(btn, false); }
});

// ── Delete reward ─────────────────────────────────────────────
window.handleDeleteReward = async (rewardId) => {
  if (!confirm("Delete this reward from the catalog?")) return;
  try {
    await deleteReward(rewardId);
    await loadRewardsCatalog();
    toast("Reward removed.", "info");
  } catch (err) { toast("Failed to delete.", "error"); }
};

// ── Add custom reward ─────────────────────────────────────────
window.openAddReward = () => {
  document.getElementById("new-reward-title").value = "";
  document.getElementById("new-reward-stars").value = "20";
  document.getElementById("new-reward-emoji").value = "🎁";
  document.getElementById("new-reward-emoji-preview").textContent = "🎁";
  document.getElementById("modal-add-reward").classList.add("open");
};
window.closeAddReward = () => document.getElementById("modal-add-reward").classList.remove("open");

document.getElementById("btn-save-new-reward")?.addEventListener("click", async () => {
  const btn   = document.getElementById("btn-save-new-reward");
  const title = document.getElementById("new-reward-title").value.trim();
  const stars = parseInt(document.getElementById("new-reward-stars").value, 10) || 20;
  const emoji = document.getElementById("new-reward-emoji").value || "🎁";
  if (!title) { toast("Please enter a reward name.", "error"); return; }
  setLoading(btn, true);
  try {
    await createReward(currentParent.uid, title, stars, emoji, "custom");
    closeAddReward();
    await loadRewardsCatalog();
    toast(`"${title}" added to catalog! 🎁`, "success");
  } catch (err) { toast("Failed to add reward.", "error"); console.error(err); }
  finally { setLoading(btn, false); }
});

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
    currentParent = { uid: user.uid, ...(await getParentProfile(user.uid)) };
    await seedDefaultRewards(currentParent.uid);
    goToParentDashboard();
  } else {
    currentParent = null;
    showScreen("screen-home");
  }
});

function goToParentDashboard() {
  document.getElementById("parent-name-display").textContent = `Welcome, ${currentParent.name}! 👋`;
  showScreen("screen-parent-dashboard");
  showTab("kids");
  loadKids();
}

// ═══════════════════════════════════════════════════════════════
// PARENT AUTH
// ═══════════════════════════════════════════════════════════════
document.getElementById("btn-signup")?.addEventListener("click", async () => {
  const btn = document.getElementById("btn-signup");
  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  if (!name || !email || !password) { toast("Please fill in all fields.", "error"); return; }
  setLoading(btn, true);
  try {
    const user = await signUpParent(name, email, password);
    currentParent = { uid: user.uid, ...(await getParentProfile(user.uid)) };
    await seedDefaultRewards(currentParent.uid);
    toast("Account created! Welcome! 🌟", "success");
    goToParentDashboard();
  } catch (err) { toast(friendlyError(err), "error"); }
  finally { setLoading(btn, false); }
});

document.getElementById("btn-login")?.addEventListener("click", async () => {
  const btn = document.getElementById("btn-login");
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const remember = document.getElementById("remember-me")?.checked;
  if (!email || !password) { toast("Please enter email and password.", "error"); return; }
  setLoading(btn, true);
  try {
    const user = await loginParent(email, password);
    remember ? saveEmail(email) : clearEmail();
    currentParent = { uid: user.uid, ...(await getParentProfile(user.uid)) };
    await seedDefaultRewards(currentParent.uid);
    toast("Welcome back! 🌟", "success");
    goToParentDashboard();
  } catch (err) { toast(friendlyError(err), "error"); }
  finally { setLoading(btn, false); }
});

document.getElementById("btn-logout")?.addEventListener("click", async () => {
  await logoutParent();
  toast("Logged out. See you soon!", "info");
});

// ═══════════════════════════════════════════════════════════════
// ADD KID
// ═══════════════════════════════════════════════════════════════
document.getElementById("btn-add-kid")?.addEventListener("click", async () => {
  const btn   = document.getElementById("btn-add-kid");
  const name  = document.getElementById("kid-name").value.trim();
  const age   = parseInt(document.getElementById("kid-age").value, 10);
  const emoji = document.getElementById("kid-avatar").value || "🌟";
  if (!name || !age || age < 1 || age > 18) { toast("Please enter a valid name and age.", "error"); return; }
  setLoading(btn, true);
  try {
    const kid = await addKid(currentParent.uid, name, age, emoji, null);
    if (selectedPhoto) {
      toast("Uploading photo… 📸", "info");
      const url = await uploadKidPhoto(currentParent.uid, kid.id, selectedPhoto);
      await updateKidPhoto(kid.id, url);
      kid.photoURL = url;
    }
    await createDefaultTasks(currentParent.uid, kid.id, age);
    kidsList.push(kid);
    renderKids();
    document.getElementById("kid-name").value    = "";
    document.getElementById("kid-age").value     = "";
    document.getElementById("kid-avatar").value  = "🌟";
    document.getElementById("kid-photo-input").value = "";
    document.getElementById("kid-photo-preview").style.display    = "none";
    document.getElementById("kid-photo-placeholder").style.display = "flex";
    selectedPhoto = null;
    toast(`${kid.name} added! Code: ${kid.code} 🎉`, "success");
  } catch (err) { toast("Failed to add kid.", "error"); console.error(err); }
  finally { setLoading(btn, false); }
});

// ═══════════════════════════════════════════════════════════════
// DELETE KID / REGEN CODE
// ═══════════════════════════════════════════════════════════════
window.handleDeleteKid = async (kidId, kidName) => {
  if (!confirm(`Delete ${kidName}? This cannot be undone.`)) return;
  try { await deleteKid(kidId); kidsList = kidsList.filter(k => k.id !== kidId); renderKids(); toast(`${kidName} removed.`, "info"); }
  catch (err) { toast("Failed to delete.", "error"); }
};

window.handleRegenCode = async (kidId) => {
  try {
    const newCode = await regenerateKidCode(kidId);
    const idx = kidsList.findIndex(k => k.id === kidId);
    if (idx !== -1) kidsList[idx].code = newCode;
    const el = document.getElementById(`code-${kidId}`);
    if (el) { el.textContent = newCode; el.classList.add("code-flash"); setTimeout(() => el.classList.remove("code-flash"), 800); }
    toast(`New code: ${newCode}`, "success");
  } catch (err) { toast("Failed to regenerate.", "error"); }
};

// ═══════════════════════════════════════════════════════════════
// BONUS STARS
// ═══════════════════════════════════════════════════════════════
let bonusKidId = null, bonusKidName = null;
window.openBonusStars  = (id, name) => { bonusKidId = id; bonusKidName = name; document.getElementById("modal-bonus-kid-name").textContent = `Bonus Stars for ${name}`; document.getElementById("bonus-stars-input").value = "1"; document.getElementById("bonus-reason-input").value = ""; document.getElementById("modal-bonus").classList.add("open"); };
window.closeBonusStars = () => document.getElementById("modal-bonus").classList.remove("open");

document.getElementById("btn-save-bonus")?.addEventListener("click", async () => {
  const btn   = document.getElementById("btn-save-bonus");
  const stars = parseInt(document.getElementById("bonus-stars-input").value, 10) || 1;
  setLoading(btn, true);
  try {
    await addBonusStars(bonusKidId, stars);
    closeBonusStars();
    toast(`⭐ ${stars} bonus star${stars > 1 ? "s" : ""} given to ${bonusKidName}!`, "success");
  } catch (err) { toast("Failed.", "error"); }
  finally { setLoading(btn, false); }
});

// ═══════════════════════════════════════════════════════════════
// ADD TASK
// ═══════════════════════════════════════════════════════════════
let taskKidId = null, taskKidName = null;
window.openAddTask  = (id, name) => { taskKidId = id; taskKidName = name; document.getElementById("modal-task-kid-name").textContent = `Task for ${name}`; document.getElementById("task-title-input").value = ""; document.getElementById("task-desc-input").value = ""; document.getElementById("task-stars-input").value = "1"; document.getElementById("modal-add-task").classList.add("open"); };
window.closeAddTask = () => document.getElementById("modal-add-task").classList.remove("open");

document.getElementById("btn-save-task")?.addEventListener("click", async () => {
  const btn   = document.getElementById("btn-save-task");
  const title = document.getElementById("task-title-input").value.trim();
  const desc  = document.getElementById("task-desc-input").value.trim();
  const stars = parseInt(document.getElementById("task-stars-input").value, 10) || 1;
  if (!title) { toast("Please enter a task title.", "error"); return; }
  setLoading(btn, true);
  try { await createTask(currentParent.uid, taskKidId, title, desc, stars); closeAddTask(); toast(`Task added for ${taskKidName}! ⭐`, "success"); }
  catch (err) { toast("Failed to save task.", "error"); }
  finally { setLoading(btn, false); }
});

// ═══════════════════════════════════════════════════════════════
// APPROVE / REJECT
// ═══════════════════════════════════════════════════════════════
window.handleApprove = async (taskId, kidId, stars, title) => {
  try {
    await approveTask(taskId, kidId, stars);
    toast(`✅ Approved! ${stars}⭐ for "${title}"`, "success");
    // Check if any goals completed
    const newStars   = await getStarBalance(kidId);
    const completed  = await checkGoalCompletion(kidId, newStars);
    completed.forEach(g => celebrate(g.title));
    loadPendingApprovals();
  } catch (err) { toast("Failed to approve.", "error"); console.error(err); }
};

window.handleReject = async (taskId, title) => {
  try { await rejectTask(taskId); toast(`❌ "${title}" sent back to kid.`, "info"); loadPendingApprovals(); }
  catch (err) { toast("Failed to reject.", "error"); }
};

// ═══════════════════════════════════════════════════════════════
// KID LOGIN
// ═══════════════════════════════════════════════════════════════
document.getElementById("btn-kid-login")?.addEventListener("click", async () => {
  const btn  = document.getElementById("btn-kid-login");
  const code = document.getElementById("kid-code-input").value.trim();
  if (code.length !== 6 || !/^\d+$/.test(code)) { toast("Please enter a valid 6-digit code.", "error"); return; }
  setLoading(btn, true);
  try {
    const kid = await loginKidByCode(code);
    if (!kid) { toast("Code not found. Ask your parent!", "error"); return; }
    currentKid = kid;
    saveKidSession(kid);
    await showKidDashboard(kid);
    toast(`Hi ${kid.name}! Let's have a great day! 🌟`, "success");
  } catch (err) { toast("Error: " + (err?.message || "Unknown").slice(0, 60), "error"); console.error(err); }
  finally { setLoading(btn, false); }
});

// ═══════════════════════════════════════════════════════════════
// KID DASHBOARD
// ═══════════════════════════════════════════════════════════════
async function showKidDashboard(kid) {
  const av = document.getElementById("kid-dashboard-avatar");
  av.innerHTML = kid.photoURL ? `<img src="${kid.photoURL}" class="kid-dash-photo" />` : kid.avatarEmoji || "🌟";
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
  const active   = tasks.filter(t => t.status === STATUS.PENDING || t.status === STATUS.REJECTED);
  const waiting  = tasks.filter(t => t.status === STATUS.SUBMITTED);
  const approved = tasks.filter(t => t.status === STATUS.APPROVED);
  let html = "";
  if (!tasks.length) html = `<p class="empty-state">No tasks yet! Ask your parent. 🌟</p>`;
  if (active.length) {
    html += `<div class="task-section-title">📋 My Tasks</div>`;
    html += active.map(t => `
      <div class="task-card task-card--pending">
        <div class="task-card__info">
          <div class="task-card__title">${t.title}</div>
          ${t.description ? `<div class="task-card__desc">${t.description}</div>` : ""}
          <div class="task-card__stars">⭐ ${t.stars} star${t.stars > 1 ? "s" : ""}</div>
          ${t.status === STATUS.REJECTED ? `<div class="task-card__rejected">❌ Try again!</div>` : ""}
        </div>
        <button class="btn btn--sm btn--success" onclick="handleTaskDone('${t.id}')">✅ Done!</button>
      </div>`).join("");
  }
  if (waiting.length) {
    html += `<div class="task-section-title">⏳ Waiting Approval</div>`;
    html += waiting.map(t => `
      <div class="task-card task-card--submitted">
        <div class="task-card__info"><div class="task-card__title">${t.title}</div><div class="task-card__stars">⭐ ${t.stars}</div></div>
        <span class="task-badge task-badge--waiting">Waiting…</span>
      </div>`).join("");
  }
  if (approved.length) {
    html += `<div class="task-section-title">✅ Completed</div>`;
    html += approved.map(t => `
      <div class="task-card task-card--approved">
        <div class="task-card__info"><div class="task-card__title">${t.title}</div><div class="task-card__stars">⭐ +${t.stars}</div></div>
        <span class="task-badge task-badge--approved">Done! ⭐</span>
      </div>`).join("");
  }
  el.innerHTML = html;
}

window.handleTaskDone = async (taskId) => {
  const btn = document.querySelector(`[onclick="handleTaskDone('${taskId}')"]`);
  if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
  try {
    await submitTask(taskId);
    toast("Sent to parent for approval! 🚀", "success");
    await loadKidTasks(currentKid);
  } catch (err) { toast("Something went wrong.", "error"); console.error(err); }
};

// ═══════════════════════════════════════════════════════════════
// KID GOALS — picks from parent reward catalog
// ═══════════════════════════════════════════════════════════════
async function loadKidGoalsView(kidId, currentStars) {
  const el = document.getElementById("kid-goals-list");
  if (!el) return;

  const goals = await getGoalsForKid(kidId);
  const active    = goals.filter(g => g.status === GOAL_STATUS.ACTIVE);
  const completed = goals.filter(g => g.status === GOAL_STATUS.COMPLETED);
  const redeemed  = goals.filter(g => g.status === "redeemed");

  let html = "";

  // Active goal
  if (active.length) {
    html += `<div class="task-section-title">🎯 My Goal</div>`;
    html += active.map(g => {
      const pct = Math.min(100, Math.round((currentStars / g.targetStars) * 100));
      return `
        <div class="goal-card">
          <div class="goal-emoji">${g.emoji}</div>
          <div class="goal-info">
            <div class="goal-title">${g.title}</div>
            <div class="goal-target">Need ⭐ ${g.targetStars} stars</div>
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
            <div class="progress-label">⭐ ${currentStars} / ${g.targetStars} — ${pct}% there!</div>
          </div>
          <button class="goal-delete-btn" onclick="handleDeleteGoal('${g.id}')">×</button>
        </div>`;
    }).join("");
  }

  // Completed (awaiting redemption by parent)
  if (completed.length) {
    html += `<div class="task-section-title">🏆 Goal Reached! Tell your parent!</div>`;
    html += completed.map(g => `
      <div class="goal-card goal-card--done">
        <div class="goal-emoji">${g.emoji}</div>
        <div class="goal-info">
          <div class="goal-title">${g.title}</div>
          <div class="goal-target">🎉 You did it! Ask parent to redeem.</div>
        </div>
      </div>`).join("");
  }

  // Redeemed history
  if (redeemed.length) {
    html += `<div class="task-section-title">🎁 Redeemed</div>`;
    html += redeemed.map(g => `
      <div class="goal-card goal-card--redeemed">
        <div class="goal-emoji">${g.emoji}</div>
        <div class="goal-info"><div class="goal-title">${g.title}</div><div class="goal-target">🎁 Enjoyed!</div></div>
      </div>`).join("");
  }

  // Pick a new goal button
  if (!active.length) {
    html += `
      <div class="pick-goal-prompt">
        <p>Pick something to save for! 🌟</p>
        <button class="btn btn--kid" onclick="openPickGoal()">🎯 Pick a Goal</button>
      </div>`;
  }

  el.innerHTML = html;
}

// ── Pick goal from reward catalog ─────────────────────────────
let parentRewardsForKid = [];

window.openPickGoal = async () => {
  const el = document.getElementById("reward-picker-list");
  el.innerHTML = `<p class="empty-state">Loading rewards…</p>`;
  document.getElementById("modal-pick-goal").classList.add("open");

  // Get parent's rewards — find parentId from kid data
  const parentId = currentKid.parentId;
  parentRewardsForKid = await getRewardsForParent(parentId);

  if (!parentRewardsForKid.length) {
    el.innerHTML = `<p class="empty-state">No rewards set by parent yet. Ask them to add some!</p>`;
    return;
  }

  // Sort by stars ascending
  const sorted = [...parentRewardsForKid].sort((a, b) => a.stars - b.stars);
  const stars  = await getStarBalance(currentKid.id);

  el.innerHTML = sorted.map(r => {
    const canAfford = stars >= r.stars;
    const pct       = Math.min(100, Math.round((stars / r.stars) * 100));
    return `
      <div class="reward-picker-item ${canAfford ? "reward-picker-item--ready" : ""}" onclick="handlePickGoal('${r.id}')">
        <span class="reward-emoji">${r.emoji}</span>
        <div class="reward-info">
          <div class="reward-title">${r.title}</div>
          <div class="reward-stars">⭐ ${r.stars} stars ${canAfford ? "— You can get this! 🎉" : `— ${pct}% saved`}</div>
          ${!canAfford ? `<div class="mini-progress"><div class="mini-progress-fill" style="width:${pct}%"></div></div>` : ""}
        </div>
        ${canAfford ? `<span class="ready-badge">Ready! 🎉</span>` : ""}
      </div>`;
  }).join("");
};

window.closePickGoal = () => document.getElementById("modal-pick-goal").classList.remove("open");

window.handlePickGoal = async (rewardId) => {
  const reward = parentRewardsForKid.find(r => r.id === rewardId);
  if (!reward) return;
  try {
    await createGoalFromReward(currentKid.id, reward);
    closePickGoal();
    toast(`Goal set: "${reward.title}" 🎯`, "success");
    const stars = await getStarBalance(currentKid.id);
    await loadKidGoalsView(currentKid.id, stars);
  } catch (err) { toast("Failed to set goal.", "error"); console.error(err); }
};

window.handleDeleteGoal = async (goalId) => {
  if (!confirm("Remove this goal?")) return;
  try {
    await deleteGoal(goalId);
    const stars = await getStarBalance(currentKid.id);
    await loadKidGoalsView(currentKid.id, stars);
    toast("Goal removed.", "info");
  } catch (err) { toast("Failed.", "error"); }
};

// ═══════════════════════════════════════════════════════════════
// KID TABS
// ═══════════════════════════════════════════════════════════════
window.showKidTab = (tab) => {
  document.querySelectorAll(".kid-tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".kid-tab-panel").forEach(p => p.classList.remove("active"));
  document.getElementById(`kid-tab-btn-${tab}`)?.classList.add("active");
  document.getElementById(`kid-tab-${tab}`)?.classList.add("active");
};

// ═══════════════════════════════════════════════════════════════
// KID SESSION
// ═══════════════════════════════════════════════════════════════
function saveKidSession(kid)  { sessionStorage.setItem("sk_kid", JSON.stringify(kid)); }
function loadKidSession()     { const d = sessionStorage.getItem("sk_kid"); return d ? JSON.parse(d) : null; }
function clearKidSession()    { sessionStorage.removeItem("sk_kid"); }

document.getElementById("btn-kid-logout")?.addEventListener("click", () => {
  clearKidSession(); currentKid = null;
  document.getElementById("kid-code-input").value = "";
  showScreen("screen-home");
  toast("See you soon! 👋", "info");
});

// ═══════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════
window.goToScreen     = id   => showScreen(id);
window.goToKidLogin   = ()   => showScreen("screen-kid-login");
window.goToParentAuth = mode => showScreen(mode === "signup" ? "screen-signup" : "screen-login");

// ═══════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════
(async function boot() {
  const savedKid = loadKidSession();
  if (savedKid) { currentKid = savedKid; await showKidDashboard(savedKid); }
  else showScreen("screen-home");
})();
