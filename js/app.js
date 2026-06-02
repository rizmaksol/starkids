// ============================================================
// js/app.js
// UI Controller — StarKids V10
// Manages screen routing and wires UI events to auth/kid logic
// ============================================================

import { signUpParent, loginParent, logoutParent, getParentProfile, onAuthChange } from "./auth.js";
import { addKid, getKidsByParent, deleteKid, regenerateKidCode, loginKidByCode } from "./kid.js";

// ── State ─────────────────────────────────────────────────────
let currentParent = null;    // { uid, name, email }
let currentKid    = null;    // kid object (child session, stored in sessionStorage)
let kidsList      = [];      // kids array for current parent

// ── Screen Router ─────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const screen = document.getElementById(id);
  if (screen) screen.classList.add("active");
}

// ── Toast Notifications ───────────────────────────────────────
function toast(message, type = "info") {
  const t = document.getElementById("toast");
  t.textContent  = message;
  t.className    = `toast toast--${type} toast--show`;
  setTimeout(() => t.classList.remove("toast--show"), 3000);
}

// ── Error Helper ──────────────────────────────────────────────
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

// ── Loading Button Helper ─────────────────────────────────────
function setLoading(btn, loading) {
  btn.disabled    = loading;
  btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
  btn.textContent = loading ? "Please wait…" : btn.dataset.originalText;
}

// ── Render Kids List ──────────────────────────────────────────
function renderKids() {
  const list = document.getElementById("kids-list");
  if (!list) return;

  if (kidsList.length === 0) {
    list.innerHTML = `<p class="empty-state">No kids added yet. Add your first kid below! 👶</p>`;
    return;
  }

  list.innerHTML = kidsList.map(kid => `
    <div class="kid-card" data-id="${kid.id}">
      <div class="kid-card__avatar">${kid.avatarEmoji || "🌟"}</div>
      <div class="kid-card__info">
        <div class="kid-card__name">${kid.name}</div>
        <div class="kid-card__age">Age ${kid.age}</div>
        <div class="kid-card__code">
          Code: <strong class="code-display" id="code-${kid.id}">${kid.code}</strong>
        </div>
      </div>
      <div class="kid-card__actions">
        <button class="btn btn--sm btn--secondary" onclick="handleRegenCode('${kid.id}')">🔄 New Code</button>
        <button class="btn btn--sm btn--danger"    onclick="handleDeleteKid('${kid.id}', '${kid.name}')">🗑 Delete</button>
      </div>
    </div>
  `).join("");
}

// ── Load Kids ─────────────────────────────────────────────────
async function loadKids() {
  if (!currentParent) return;
  kidsList = await getKidsByParent(currentParent.uid);
  renderKids();
}

// ── Parent Dashboard ──────────────────────────────────────────
function goToParentDashboard() {
  document.getElementById("parent-name-display").textContent = `Welcome, ${currentParent.name}! 👋`;
  showScreen("screen-parent-dashboard");
  loadKids();
}

// ── Auth State Listener ───────────────────────────────────────
onAuthChange(async user => {
  if (user) {
    currentParent = { uid: user.uid, ...(await getParentProfile(user.uid)) };
    goToParentDashboard();
  } else {
    currentParent = null;
    showScreen("screen-home");
  }
});

// ── Kid Session (sessionStorage) ──────────────────────────────
// Kids don't use Firebase Auth — they log in with a code
// We store the kid object in sessionStorage for the browser session
function saveKidSession(kid) {
  sessionStorage.setItem("sk_kid", JSON.stringify(kid));
}
function loadKidSession() {
  const data = sessionStorage.getItem("sk_kid");
  return data ? JSON.parse(data) : null;
}
function clearKidSession() {
  sessionStorage.removeItem("sk_kid");
}

// ── PARENT: Sign Up ───────────────────────────────────────────
document.getElementById("btn-signup")?.addEventListener("click", async () => {
  const btn      = document.getElementById("btn-signup");
  const name     = document.getElementById("signup-name").value.trim();
  const email    = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;

  if (!name || !email || !password) { toast("Please fill in all fields.", "error"); return; }

  setLoading(btn, true);
  try {
    await signUpParent(name, email, password);
    toast("Account created! Welcome to StarKids! 🌟", "success");
    // onAuthChange will redirect automatically
  } catch (err) {
    toast(friendlyError(err), "error");
  } finally {
    setLoading(btn, false);
  }
});

// ── PARENT: Login ─────────────────────────────────────────────
document.getElementById("btn-login")?.addEventListener("click", async () => {
  const btn      = document.getElementById("btn-login");
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  if (!email || !password) { toast("Please enter email and password.", "error"); return; }

  setLoading(btn, true);
  try {
    await loginParent(email, password);
    toast("Welcome back! 🌟", "success");
  } catch (err) {
    toast(friendlyError(err), "error");
  } finally {
    setLoading(btn, false);
  }
});

// ── PARENT: Logout ────────────────────────────────────────────
document.getElementById("btn-logout")?.addEventListener("click", async () => {
  await logoutParent();
  toast("Logged out. See you soon!", "info");
});

// ── PARENT: Add Kid ───────────────────────────────────────────
document.getElementById("btn-add-kid")?.addEventListener("click", async () => {
  const btn   = document.getElementById("btn-add-kid");
  const name  = document.getElementById("kid-name").value.trim();
  const age   = parseInt(document.getElementById("kid-age").value, 10);
  const emoji = document.getElementById("kid-avatar").value || "🌟";

  if (!name || !age || age < 1 || age > 18) {
    toast("Please enter a valid name and age.", "error"); return;
  }

  setLoading(btn, true);
  try {
    const kid = await addKid(currentParent.uid, name, age, emoji);
    kidsList.push(kid);
    renderKids();
    document.getElementById("kid-name").value  = "";
    document.getElementById("kid-age").value   = "";
    document.getElementById("kid-avatar").value = "🌟";
    toast(`${kid.name} added! Code: ${kid.code} 🎉`, "success");
  } catch (err) {
    toast("Failed to add kid. Try again.", "error");
    console.error(err);
  } finally {
    setLoading(btn, false);
  }
});

// ── PARENT: Delete Kid ────────────────────────────────────────
window.handleDeleteKid = async (kidId, kidName) => {
  if (!confirm(`Delete ${kidName}? This cannot be undone.`)) return;
  try {
    await deleteKid(kidId);
    kidsList = kidsList.filter(k => k.id !== kidId);
    renderKids();
    toast(`${kidName} removed.`, "info");
  } catch (err) {
    toast("Failed to delete. Try again.", "error");
  }
};

// ── PARENT: Regenerate Code ───────────────────────────────────
window.handleRegenCode = async (kidId) => {
  try {
    const newCode = await regenerateKidCode(kidId);
    const kidIndex = kidsList.findIndex(k => k.id === kidId);
    if (kidIndex !== -1) kidsList[kidIndex].code = newCode;
    const codeEl = document.getElementById(`code-${kidId}`);
    if (codeEl) {
      codeEl.textContent = newCode;
      codeEl.classList.add("code-flash");
      setTimeout(() => codeEl.classList.remove("code-flash"), 800);
    }
    toast(`New code generated: ${newCode}`, "success");
  } catch (err) {
    toast("Failed to regenerate code. Try again.", "error");
  }
};

// ── KID: Login with Code ──────────────────────────────────────
document.getElementById("btn-kid-login")?.addEventListener("click", async () => {
  const btn  = document.getElementById("btn-kid-login");
  const code = document.getElementById("kid-code-input").value.trim();

  if (code.length !== 6 || !/^\d+$/.test(code)) {
    toast("Please enter a valid 6-digit code.", "error"); return;
  }

  setLoading(btn, true);
  try {
    const kid = await loginKidByCode(code);
    if (!kid) {
      toast("Code not found. Ask your parent for the code.", "error");
      return;
    }
    currentKid = kid;
    saveKidSession(kid);
    showKidDashboard(kid);
    toast(`Hi ${kid.name}! Let's have a great day! 🌟`, "success");
  } catch (err) {
    toast("Something went wrong. Try again.", "error");
    console.error(err);
  } finally {
    setLoading(btn, false);
  }
});

// ── KID: Show Dashboard ───────────────────────────────────────
function showKidDashboard(kid) {
  document.getElementById("kid-dashboard-name").textContent  = `Hi, ${kid.name}! ${kid.avatarEmoji || "🌟"}`;
  document.getElementById("kid-dashboard-stars").textContent = "⭐ Stars: 0";   // Sprint 3 will fill this
  showScreen("screen-kid-dashboard");
}

// ── KID: Logout ───────────────────────────────────────────────
document.getElementById("btn-kid-logout")?.addEventListener("click", () => {
  clearKidSession();
  currentKid = null;
  showScreen("screen-home");
  toast("See you soon! 👋", "info");
});

// ── Navigation helpers (called from HTML buttons) ─────────────
window.goToScreen    = (id) => showScreen(id);
window.goToKidLogin  = ()   => showScreen("screen-kid-login");
window.goToParentAuth = (mode) => {
  showScreen(mode === "signup" ? "screen-signup" : "screen-login");
};

// ── Boot: Check if kid session exists from a previous tab ─────
(function boot() {
  const savedKid = loadKidSession();
  if (savedKid) {
    currentKid = savedKid;
    showKidDashboard(savedKid);
  } else {
    showScreen("screen-home");
  }
})();
