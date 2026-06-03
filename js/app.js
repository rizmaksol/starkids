// ============================================================
// js/app.js — StarKids V10  Sprint 1 + 2 + 3
// ============================================================

import { signUpParent, loginParent, logoutParent, getParentProfile, onAuthChange } from "./auth.js";
import {
  addKid, getKidsByParent, deleteKid, regenerateKidCode,
  loginKidByCode, uploadKidPhoto, updateKidPhoto
} from "./kid.js";
import {
  createTask, createDefaultTasks, getTasksForKid,
  getPendingApprovals, submitTask, approveTask, rejectTask,
  getStarBalance, STATUS
} from "./tasks.js";
import {
  createGoal, getGoalsForKid, deleteGoal,
  checkGoalCompletion, addBonusStars, GOAL_STATUS
} from "./goals.js";

// ── State ─────────────────────────────────────────────────────
let currentParent = null;
let currentKid    = null;
let kidsList      = [];
let selectedPhoto = null;

// ── Screen Router ─────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

// ── Toast ──────────────────────────────────────────────────────
function toast(msg, type = "info") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className   = `toast toast--${type} toast--show`;
  setTimeout(() => t.classList.remove("toast--show"), 3500);
}

// ── Celebrate (goal completed) ────────────────────────────────
function celebrate(goalTitle) {
  const el = document.getElementById("celebration");
  if (!el) return;
  document.getElementById("celebration-text").textContent = `🎉 Goal Reached!\n"${goalTitle}"`;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 4000);
}

// ── Friendly errors ────────────────────────────────────────────
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
const saveRememberedEmail  = e  => localStorage.setItem(LS_EMAIL, e);
const clearRememberedEmail = () => localStorage.removeItem(LS_EMAIL);
const getRememberedEmail   = () => localStorage.getItem(LS_EMAIL) || "";

(function prefillLogin() {
  const saved = getRememberedEmail();
  if (!saved) return;
  const el = document.getElementById("login-email");
  const cb = document.getElementById("remember-me");
  if (el) el.value   = saved;
  if (cb) cb.checked = true;
})();

// ═══════════════════════════════════════════════════════════════
// KID PHOTO PREVIEW
// ═══════════════════════════════════════════════════════════════
document.getElementById("kid-photo-input")?.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  selectedPhoto = file;
  const prev = document.getElementById("kid-photo-preview");
  prev.src   = URL.createObjectURL(file);
  prev.style.display = "block";
  document.getElementById("kid-photo-placeholder").style.display = "none";
});

// ═══════════════════════════════════════════════════════════════
// RENDER KIDS LIST
// ═══════════════════════════════════════════════════════════════
function renderKids() {
  const list = document.getElementById("kids-list");
  if (!list) return;
  if (kidsList.length === 0) {
    list.innerHTML = `<p class="empty-state">No kids yet. Add your first kid below! 👶</p>`;
    return;
  }
  list.innerHTML = kidsList.map(kid => {
    const avatarHTML = kid.photoURL
      ? `<img src="${kid.photoURL}" class="kid-card__photo" alt="${kid.name}" />`
      : `<div class="kid-card__avatar">${kid.avatarEmoji || "🌟"}</div>`;
    return `
      <div class="kid-card" data-id="${kid.id}">
        ${avatarHTML}
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
// RENDER APPROVALS
// ═══════════════════════════════════════════════════════════════
async function loadPendingApprovals() {
  const pending = await getPendingApprovals(currentParent.uid);
  const el      = document.getElementById("approvals-list");
  if (!el) return;

  const badge = document.getElementById("approvals-badge");
  if (badge) {
    badge.textContent   = pending.length > 0 ? pending.length : "";
    badge.style.display = pending.length > 0 ? "inline-flex" : "none";
  }

  if (pending.length === 0) {
    el.innerHTML = `<p class="empty-state">No pending approvals 🎉</p>`;
    return;
  }

  el.innerHTML = pending.map(task => {
    const kid = kidsList.find(k => k.id === task.kidId);
    const kidName    = kid ? kid.name : "Unknown";
    const avatarHTML = kid?.photoURL
      ? `<img src="${kid.photoURL}" class="approval-avatar-img" />`
      : `<span>${kid?.avatarEmoji || "🌟"}</span>`;
    return `
      <div class="approval-card">
        <div class="approval-avatar">${avatarHTML}</div>
        <div class="approval-info">
          <div class="approval-kid">${kidName}</div>
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
// RENDER KIDS WALLETS (parent overview tab)
// ═══════════════════════════════════════════════════════════════
async function loadWalletsOverview() {
  const el = document.getElementById("wallets-list");
  if (!el || kidsList.length === 0) {
    if (el) el.innerHTML = `<p class="empty-state">Add kids first to see their wallets. 👶</p>`;
    return;
  }

  const rows = await Promise.all(kidsList.map(async kid => {
    const stars = await getStarBalance(kid.id);
    const goals = await getGoalsForKid(kid.id);
    const activeGoal = goals.find(g => g.status === GOAL_STATUS.ACTIVE);
    const progressPct = activeGoal
      ? Math.min(100, Math.round((stars / activeGoal.targetStars) * 100))
      : null;

    const avatarHTML = kid.photoURL
      ? `<img src="${kid.photoURL}" class="wallet-avatar-img" />`
      : `<span class="wallet-avatar-emoji">${kid.avatarEmoji || "🌟"}</span>`;

    return `
      <div class="wallet-card">
        <div class="wallet-avatar">${avatarHTML}</div>
        <div class="wallet-info">
          <div class="wallet-name">${kid.name}</div>
          <div class="wallet-stars">⭐ ${stars} stars</div>
          ${activeGoal ? `
            <div class="wallet-goal">
              <div class="wallet-goal-label">${activeGoal.emoji} ${activeGoal.title} — ${activeGoal.targetStars}⭐</div>
              <div class="progress-bar">
                <div class="progress-fill" style="width:${progressPct}%"></div>
              </div>
              <div class="progress-label">${progressPct}% there!</div>
            </div>` : `<div class="wallet-no-goal">No active goal</div>`}
        </div>
      </div>`;
  }));

  el.innerHTML = rows.join("");
}

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
};

// ═══════════════════════════════════════════════════════════════
// AUTH STATE
// ═══════════════════════════════════════════════════════════════
onAuthChange(async user => {
  if (user) {
    currentParent = { uid: user.uid, ...(await getParentProfile(user.uid)) };
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
// PARENT: SIGN UP / LOGIN / LOGOUT
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
    toast("Account created! Welcome! 🌟", "success");
    currentParent = { uid: user.uid, ...(await getParentProfile(user.uid)) };
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
    remember ? saveRememberedEmail(email) : clearRememberedEmail();
    toast("Welcome back! 🌟", "success");
    currentParent = { uid: user.uid, ...(await getParentProfile(user.uid)) };
    goToParentDashboard();
  } catch (err) { toast(friendlyError(err), "error"); }
  finally { setLoading(btn, false); }
});

document.getElementById("btn-logout")?.addEventListener("click", async () => {
  await logoutParent();
  toast("Logged out. See you soon!", "info");
});

// ═══════════════════════════════════════════════════════════════
// PARENT: ADD KID
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
// PARENT: DELETE / REGEN CODE
// ═══════════════════════════════════════════════════════════════
window.handleDeleteKid = async (kidId, kidName) => {
  if (!confirm(`Delete ${kidName}? This cannot be undone.`)) return;
  try {
    await deleteKid(kidId);
    kidsList = kidsList.filter(k => k.id !== kidId);
    renderKids();
    toast(`${kidName} removed.`, "info");
  } catch (err) { toast("Failed to delete.", "error"); }
};

window.handleRegenCode = async (kidId) => {
  try {
    const newCode = await regenerateKidCode(kidId);
    const idx = kidsList.findIndex(k => k.id === kidId);
    if (idx !== -1) kidsList[idx].code = newCode;
    const el = document.getElementById(`code-${kidId}`);
    if (el) { el.textContent = newCode; el.classList.add("code-flash"); setTimeout(() => el.classList.remove("code-flash"), 800); }
    toast(`New code: ${newCode}`, "success");
  } catch (err) { toast("Failed to regenerate code.", "error"); }
};

// ═══════════════════════════════════════════════════════════════
// PARENT: BONUS STARS MODAL
// ═══════════════════════════════════════════════════════════════
let bonusKidId   = null;
let bonusKidName = null;

window.openBonusStars = (kidId, kidName) => {
  bonusKidId   = kidId;
  bonusKidName = kidName;
  document.getElementById("modal-bonus-kid-name").textContent = `Bonus Stars for ${kidName}`;
  document.getElementById("bonus-stars-input").value  = "1";
  document.getElementById("bonus-reason-input").value = "";
  document.getElementById("modal-bonus").classList.add("open");
};
window.closeBonusStars = () => document.getElementById("modal-bonus").classList.remove("open");

document.getElementById("btn-save-bonus")?.addEventListener("click", async () => {
  const btn    = document.getElementById("btn-save-bonus");
  const stars  = parseInt(document.getElementById("bonus-stars-input").value, 10) || 1;
  const reason = document.getElementById("bonus-reason-input").value.trim() || "Bonus";
  setLoading(btn, true);
  try {
    const newTotal = await addBonusStars(bonusKidId, stars, reason);
    closeBonusStars();
    toast(`⭐ ${stars} bonus star${stars > 1 ? "s" : ""} given to ${bonusKidName}!`, "success");
  } catch (err) { toast("Failed to give bonus.", "error"); console.error(err); }
  finally { setLoading(btn, false); }
});

// ═══════════════════════════════════════════════════════════════
// PARENT: ADD TASK MODAL
// ═══════════════════════════════════════════════════════════════
let taskTargetKidId   = null;
let taskTargetKidName = null;

window.openAddTask = (kidId, kidName) => {
  taskTargetKidId   = kidId;
  taskTargetKidName = kidName;
  document.getElementById("modal-task-kid-name").textContent = `Task for ${kidName}`;
  document.getElementById("task-title-input").value  = "";
  document.getElementById("task-desc-input").value   = "";
  document.getElementById("task-stars-input").value  = "1";
  document.getElementById("modal-add-task").classList.add("open");
};
window.closeAddTask = () => document.getElementById("modal-add-task").classList.remove("open");

document.getElementById("btn-save-task")?.addEventListener("click", async () => {
  const btn   = document.getElementById("btn-save-task");
  const title = document.getElementById("task-title-input").value.trim();
  const desc  = document.getElementById("task-desc-input").value.trim();
  const stars = parseInt(document.getElementById("task-stars-input").value, 10) || 1;
  if (!title) { toast("Please enter a task title.", "error"); return; }
  setLoading(btn, true);
  try {
    await createTask(currentParent.uid, taskTargetKidId, title, desc, stars);
    closeAddTask();
    toast(`Task added for ${taskTargetKidName}! ⭐`, "success");
  } catch (err) { toast("Failed to save task.", "error"); console.error(err); }
  finally { setLoading(btn, false); }
});

// ═══════════════════════════════════════════════════════════════
// PARENT: APPROVE / REJECT
// ═══════════════════════════════════════════════════════════════
window.handleApprove = async (taskId, kidId, stars, taskTitle) => {
  try {
    await approveTask(taskId, kidId, stars);
    toast(`✅ Approved! ${stars}⭐ awarded for "${taskTitle}"`, "success");
    loadPendingApprovals();
  } catch (err) { toast("Failed to approve.", "error"); console.error(err); }
};

window.handleReject = async (taskId, taskTitle) => {
  try {
    await rejectTask(taskId);
    toast(`❌ "${taskTitle}" sent back to kid.`, "info");
    loadPendingApprovals();
  } catch (err) { toast("Failed to reject.", "error"); }
};

// ═══════════════════════════════════════════════════════════════
// KID: LOGIN
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
  } catch (err) {
    const msg = err?.message || err?.code || "Unknown error";
    toast("Error: " + msg.slice(0, 60), "error");
    console.error("KID LOGIN ERROR:", err);
  }
  finally { setLoading(btn, false); }
});

// ═══════════════════════════════════════════════════════════════
// KID: DASHBOARD
// ═══════════════════════════════════════════════════════════════
async function showKidDashboard(kid) {
  const avatarEl = document.getElementById("kid-dashboard-avatar");
  avatarEl.innerHTML = kid.photoURL
    ? `<img src="${kid.photoURL}" class="kid-dash-photo" alt="${kid.name}" />`
    : kid.avatarEmoji || "🌟";

  document.getElementById("kid-dashboard-name").textContent = `Hi, ${kid.name}!`;

  await refreshKidStars(kid.id);
  await loadKidTasks(kid);
  await loadKidGoals(kid.id);

  showScreen("screen-kid-dashboard");
}

async function refreshKidStars(kidId) {
  const stars = await getStarBalance(kidId);
  document.getElementById("kid-dashboard-stars").textContent = `⭐ ${stars} Stars`;
  return stars;
}

// ═══════════════════════════════════════════════════════════════
// KID: TASKS
// ═══════════════════════════════════════════════════════════════
async function loadKidTasks(kid) {
  const tasks  = await getTasksForKid(kid.id);
  const el     = document.getElementById("kid-tasks-list");
  if (!el) return;

  const active   = tasks.filter(t => t.status === STATUS.PENDING || t.status === STATUS.REJECTED);
  const waiting  = tasks.filter(t => t.status === STATUS.SUBMITTED);
  const approved = tasks.filter(t => t.status === STATUS.APPROVED);

  let html = "";

  if (!tasks.length) {
    html = `<p class="empty-state">No tasks yet! Ask your parent. 🌟</p>`;
  }

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
        <button class="btn btn--sm btn--success task-done-btn" onclick="handleTaskDone('${t.id}')">✅ Done!</button>
      </div>`).join("");
  }

  if (waiting.length) {
    html += `<div class="task-section-title">⏳ Waiting for Approval</div>`;
    html += waiting.map(t => `
      <div class="task-card task-card--submitted">
        <div class="task-card__info">
          <div class="task-card__title">${t.title}</div>
          <div class="task-card__stars">⭐ ${t.stars} star${t.stars > 1 ? "s" : ""}</div>
        </div>
        <span class="task-badge task-badge--waiting">Waiting…</span>
      </div>`).join("");
  }

  if (approved.length) {
    html += `<div class="task-section-title">✅ Completed Today</div>`;
    html += approved.map(t => `
      <div class="task-card task-card--approved">
        <div class="task-card__info">
          <div class="task-card__title">${t.title}</div>
          <div class="task-card__stars">⭐ +${t.stars} earned</div>
        </div>
        <span class="task-badge task-badge--approved">⭐ Done!</span>
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
// KID: GOALS
// ═══════════════════════════════════════════════════════════════
async function loadKidGoals(kidId) {
  const el    = document.getElementById("kid-goals-list");
  if (!el) return;

  const stars = await getStarBalance(kidId);
  const goals = await getGoalsForKid(kidId);
  const active    = goals.filter(g => g.status === GOAL_STATUS.ACTIVE);
  const completed = goals.filter(g => g.status === GOAL_STATUS.COMPLETED);

  let html = "";

  if (!active.length && !completed.length) {
    html = `
      <p class="empty-state">No goals yet!</p>
      <button class="btn btn--accent mt-8" onclick="openAddGoal()">🎯 Set a Goal</button>`;
  } else {
    html += `<button class="btn btn--sm btn--accent" style="margin-bottom:12px;" onclick="openAddGoal()">➕ New Goal</button>`;
  }

  if (active.length) {
    html += `<div class="task-section-title">🎯 My Goals</div>`;
    html += active.map(g => {
      const pct = Math.min(100, Math.round((stars / g.targetStars) * 100));
      return `
        <div class="goal-card">
          <div class="goal-emoji">${g.emoji}</div>
          <div class="goal-info">
            <div class="goal-title">${g.title}</div>
            <div class="goal-target">Target: ⭐ ${g.targetStars} stars</div>
            <div class="progress-bar">
              <div class="progress-fill" style="width:${pct}%"></div>
            </div>
            <div class="progress-label">⭐ ${stars} / ${g.targetStars} — ${pct}%</div>
          </div>
          <button class="goal-delete-btn" onclick="handleDeleteGoal('${g.id}')">×</button>
        </div>`;
    }).join("");
  }

  if (completed.length) {
    html += `<div class="task-section-title">🏆 Achieved!</div>`;
    html += completed.map(g => `
      <div class="goal-card goal-card--done">
        <div class="goal-emoji">${g.emoji}</div>
        <div class="goal-info">
          <div class="goal-title">${g.title}</div>
          <div class="goal-target">⭐ ${g.targetStars} stars — Achieved! 🎉</div>
        </div>
        <button class="goal-delete-btn" onclick="handleDeleteGoal('${g.id}')">×</button>
      </div>`).join("");
  }

  el.innerHTML = html;
}

// ── Add Goal Modal ────────────────────────────────────────────
window.openAddGoal = () => {
  document.getElementById("goal-title-input").value  = "";
  document.getElementById("goal-stars-input").value  = "10";
  document.getElementById("goal-emoji-input").value  = "🎯";
  document.getElementById("goal-emoji-preview").textContent = "🎯";
  document.getElementById("modal-add-goal").classList.add("open");
};
window.closeAddGoal = () => document.getElementById("modal-add-goal").classList.remove("open");

document.getElementById("btn-save-goal")?.addEventListener("click", async () => {
  const btn   = document.getElementById("btn-save-goal");
  const title = document.getElementById("goal-title-input").value.trim();
  const stars = parseInt(document.getElementById("goal-stars-input").value, 10) || 10;
  const emoji = document.getElementById("goal-emoji-input").value || "🎯";
  if (!title) { toast("Please enter a goal name.", "error"); return; }
  setLoading(btn, true);
  try {
    await createGoal(currentKid.id, title, stars, emoji);
    closeAddGoal();
    toast(`Goal set: "${title}" 🎯`, "success");
    await loadKidGoals(currentKid.id);
  } catch (err) { toast("Failed to save goal.", "error"); console.error(err); }
  finally { setLoading(btn, false); }
});

window.handleDeleteGoal = async (goalId) => {
  if (!confirm("Remove this goal?")) return;
  try {
    await deleteGoal(goalId);
    await loadKidGoals(currentKid.id);
    toast("Goal removed.", "info");
  } catch (err) { toast("Failed to remove goal.", "error"); }
};

// ── Kid tabs ──────────────────────────────────────────────────
window.showKidTab = (tab) => {
  document.querySelectorAll(".kid-tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".kid-tab-panel").forEach(p => p.classList.remove("active"));
  document.getElementById(`kid-tab-btn-${tab}`)?.classList.add("active");
  document.getElementById(`kid-tab-${tab}`)?.classList.add("active");
};

// ═══════════════════════════════════════════════════════════════
// KID: SESSION
// ═══════════════════════════════════════════════════════════════
function saveKidSession(kid)  { sessionStorage.setItem("sk_kid", JSON.stringify(kid)); }
function loadKidSession()     { const d = sessionStorage.getItem("sk_kid"); return d ? JSON.parse(d) : null; }
function clearKidSession()    { sessionStorage.removeItem("sk_kid"); }

document.getElementById("btn-kid-logout")?.addEventListener("click", () => {
  clearKidSession();
  currentKid = null;
  document.getElementById("kid-code-input").value = "";
  showScreen("screen-home");
  toast("See you soon! 👋", "info");
});

// ═══════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════
window.goToScreen     = (id)   => showScreen(id);
window.goToKidLogin   = ()     => showScreen("screen-kid-login");
window.goToParentAuth = (mode) => showScreen(mode === "signup" ? "screen-signup" : "screen-login");

// ═══════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════
(async function boot() {
  const savedKid = loadKidSession();
  if (savedKid) {
    currentKid = savedKid;
    await showKidDashboard(savedKid);
  } else {
    showScreen("screen-home");
  }
})();
