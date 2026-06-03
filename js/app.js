// ============================================================
// js/app.js — StarKids V10
// UI Controller: screen routing, events, Remember Me, kid photos
// ============================================================

import { signUpParent, loginParent, logoutParent, getParentProfile, onAuthChange } from "./auth.js";
import {
  addKid, getKidsByParent, deleteKid, regenerateKidCode,
  loginKidByCode, uploadKidPhoto, updateKidPhoto
} from "./kid.js";

// ── State ─────────────────────────────────────────────────────
let currentParent  = null;
let currentKid     = null;
let kidsList       = [];
let selectedPhoto  = null;   // File object for the new kid photo

// ── Screen Router ─────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const screen = document.getElementById(id);
  if (screen) screen.classList.add("active");
}

// ── Toast ──────────────────────────────────────────────────────
function toast(msg, type = "info") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className   = `toast toast--${type} toast--show`;
  setTimeout(() => t.classList.remove("toast--show"), 3500);
}

// ── Friendly Firebase errors ───────────────────────────────────
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

// ── Loading button ────────────────────────────────────────────
function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.dataset.orig = btn.dataset.orig || btn.textContent;
  btn.textContent  = loading ? "Please wait…" : btn.dataset.orig;
}

// ═══════════════════════════════════════════════════════════════
// REMEMBER ME — saves email to localStorage
// ═══════════════════════════════════════════════════════════════
const LS_EMAIL = "sk_remembered_email";

function saveRememberedEmail(email) {
  localStorage.setItem(LS_EMAIL, email);
}
function clearRememberedEmail() {
  localStorage.removeItem(LS_EMAIL);
}
function getRememberedEmail() {
  return localStorage.getItem(LS_EMAIL) || "";
}

// Pre-fill login email + check "Remember me" box on load
(function prefillLogin() {
  const saved = getRememberedEmail();
  if (saved) {
    const emailEl = document.getElementById("login-email");
    const remEl   = document.getElementById("remember-me");
    if (emailEl) emailEl.value = saved;
    if (remEl)   remEl.checked = true;
  }
})();

// ═══════════════════════════════════════════════════════════════
// KID PHOTO — preview selected file
// ═══════════════════════════════════════════════════════════════
document.getElementById("kid-photo-input")?.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  selectedPhoto = file;
  const preview = document.getElementById("kid-photo-preview");
  preview.src   = URL.createObjectURL(file);
  preview.style.display = "block";
  document.getElementById("kid-photo-placeholder").style.display = "none";
});

// ═══════════════════════════════════════════════════════════════
// RENDER KIDS LIST
// ═══════════════════════════════════════════════════════════════
function renderKids() {
  const list = document.getElementById("kids-list");
  if (!list) return;

  if (kidsList.length === 0) {
    list.innerHTML = `<p class="empty-state">No kids added yet. Add your first kid below! 👶</p>`;
    return;
  }

  list.innerHTML = kidsList.map(kid => {
    // Avatar: real photo takes priority, then emoji, then default
    const avatarHTML = kid.photoURL
      ? `<img src="${kid.photoURL}" class="kid-card__photo" alt="${kid.name}" />`
      : `<div class="kid-card__avatar">${kid.avatarEmoji || "🌟"}</div>`;

    return `
      <div class="kid-card" data-id="${kid.id}">
        ${avatarHTML}
        <div class="kid-card__info">
          <div class="kid-card__name">${kid.name}</div>
          <div class="kid-card__age">Age ${kid.age}</div>
          <div class="kid-card__code">
            Code: <strong class="code-display" id="code-${kid.id}">${kid.code}</strong>
          </div>
        </div>
        <div class="kid-card__actions">
          <button class="btn btn--sm btn--secondary" onclick="handleRegenCode('${kid.id}')">🔄 Code</button>
          <button class="btn btn--sm btn--danger"    onclick="handleDeleteKid('${kid.id}', '${kid.name}')">🗑</button>
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
// AUTH STATE
// ═══════════════════════════════════════════════════════════════
onAuthChange(async user => {
  if (user) {
    currentParent = { uid: user.uid, ...(await getParentProfile(user.uid)) };
    document.getElementById("parent-name-display").textContent =
      `Welcome, ${currentParent.name}! 👋`;
    showScreen("screen-parent-dashboard");
    loadKids();
  } else {
    currentParent = null;
    showScreen("screen-home");
  }
});

// ═══════════════════════════════════════════════════════════════
// PARENT: SIGN UP
// ═══════════════════════════════════════════════════════════════
document.getElementById("btn-signup")?.addEventListener("click", async () => {
  const btn      = document.getElementById("btn-signup");
  const name     = document.getElementById("signup-name").value.trim();
  const email    = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;

  if (!name || !email || !password) {
    toast("Please fill in all fields.", "error"); return;
  }

  setLoading(btn, true);
  try {
    const user = await signUpParent(name, email, password);
    toast("Account created! Welcome to StarKids! 🌟", "success");

    // Force navigation immediately
    currentParent = { uid: user.uid, ...(await getParentProfile(user.uid)) };
    document.getElementById("parent-name-display").textContent =
      `Welcome, ${currentParent.name}! 👋`;
    showScreen("screen-parent-dashboard");
    loadKids();

  } catch (err) {
    toast(friendlyError(err), "error");
  } finally {
    setLoading(btn, false);
  }
});

// ═══════════════════════════════════════════════════════════════
// PARENT: LOGIN  (with Remember Me)
// ═══════════════════════════════════════════════════════════════
document.getElementById("btn-login")?.addEventListener("click", async () => {
  const btn       = document.getElementById("btn-login");
  const email     = document.getElementById("login-email").value.trim();
  const password  = document.getElementById("login-password").value;
  const remember  = document.getElementById("remember-me")?.checked;

  if (!email || !password) {
    toast("Please enter email and password.", "error"); return;
  }

  setLoading(btn, true);
  try {
    const user = await loginParent(email, password);

    // Save or clear remembered email
    if (remember) {
      saveRememberedEmail(email);
    } else {
      clearRememberedEmail();
    }

    toast("Welcome back! 🌟", "success");

    // Force navigation immediately — do not wait for onAuthChange
    currentParent = { uid: user.uid, ...(await getParentProfile(user.uid)) };
    document.getElementById("parent-name-display").textContent =
      `Welcome, ${currentParent.name}! 👋`;
    showScreen("screen-parent-dashboard");
    loadKids();

  } catch (err) {
    toast(friendlyError(err), "error");
  } finally {
    setLoading(btn, false);
  }
});

// ═══════════════════════════════════════════════════════════════
// PARENT: LOGOUT
// ═══════════════════════════════════════════════════════════════
document.getElementById("btn-logout")?.addEventListener("click", async () => {
  await logoutParent();
  toast("Logged out. See you soon!", "info");
});

// ═══════════════════════════════════════════════════════════════
// PARENT: ADD KID (with real photo upload)
// ═══════════════════════════════════════════════════════════════
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
    // 1. Create kid document (no photo yet)
    const kid = await addKid(currentParent.uid, name, age, emoji, null);

    // 2. If a photo was selected, upload it and update the kid doc
    if (selectedPhoto) {
      toast("Uploading photo… 📸", "info");
      const photoURL = await uploadKidPhoto(currentParent.uid, kid.id, selectedPhoto);
      await updateKidPhoto(kid.id, photoURL);
      kid.photoURL = photoURL;
    }

    kidsList.push(kid);
    renderKids();

    // Reset form
    document.getElementById("kid-name").value   = "";
    document.getElementById("kid-age").value    = "";
    document.getElementById("kid-avatar").value = "🌟";
    document.getElementById("kid-photo-input").value = "";
    document.getElementById("kid-photo-preview").style.display = "none";
    document.getElementById("kid-photo-placeholder").style.display = "flex";
    selectedPhoto = null;

    toast(`${kid.name} added! Code: ${kid.code} 🎉`, "success");
  } catch (err) {
    toast("Failed to add kid. Try again.", "error");
    console.error(err);
  } finally {
    setLoading(btn, false);
  }
});

// ═══════════════════════════════════════════════════════════════
// PARENT: DELETE KID
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// PARENT: REGENERATE CODE
// ═══════════════════════════════════════════════════════════════
window.handleRegenCode = async (kidId) => {
  try {
    const newCode  = await regenerateKidCode(kidId);
    const kidIndex = kidsList.findIndex(k => k.id === kidId);
    if (kidIndex !== -1) kidsList[kidIndex].code = newCode;
    const codeEl = document.getElementById(`code-${kidId}`);
    if (codeEl) {
      codeEl.textContent = newCode;
      codeEl.classList.add("code-flash");
      setTimeout(() => codeEl.classList.remove("code-flash"), 800);
    }
    toast(`New code: ${newCode}`, "success");
  } catch (err) {
    toast("Failed to regenerate code.", "error");
  }
};

// ═══════════════════════════════════════════════════════════════
// KID: LOGIN WITH CODE
// ═══════════════════════════════════════════════════════════════
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
      toast("Code not found. Ask your parent!", "error"); return;
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

// ═══════════════════════════════════════════════════════════════
// KID: DASHBOARD
// ═══════════════════════════════════════════════════════════════
function showKidDashboard(kid) {
  document.getElementById("kid-dashboard-name").textContent =
    `Hi, ${kid.name}!`;

  // Show real photo or emoji in kid dashboard
  const avatarEl = document.getElementById("kid-dashboard-avatar");
  if (kid.photoURL) {
    avatarEl.innerHTML = `<img src="${kid.photoURL}" class="kid-dash-photo" alt="${kid.name}" />`;
  } else {
    avatarEl.innerHTML = kid.avatarEmoji || "🌟";
  }

  document.getElementById("kid-dashboard-stars").textContent = "⭐ Stars: 0";
  showScreen("screen-kid-dashboard");
}

// ═══════════════════════════════════════════════════════════════
// KID: SESSION (sessionStorage)
// ═══════════════════════════════════════════════════════════════
function saveKidSession(kid) { sessionStorage.setItem("sk_kid", JSON.stringify(kid)); }
function loadKidSession()    { const d = sessionStorage.getItem("sk_kid"); return d ? JSON.parse(d) : null; }
function clearKidSession()   { sessionStorage.removeItem("sk_kid"); }

document.getElementById("btn-kid-logout")?.addEventListener("click", () => {
  clearKidSession();
  currentKid = null;
  showScreen("screen-home");
  toast("See you soon! 👋", "info");
});

// ═══════════════════════════════════════════════════════════════
// NAVIGATION HELPERS
// ═══════════════════════════════════════════════════════════════
window.goToScreen     = (id)   => showScreen(id);
window.goToKidLogin   = ()     => showScreen("screen-kid-login");
window.goToParentAuth = (mode) => showScreen(mode === "signup" ? "screen-signup" : "screen-login");

// ═══════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════
(function boot() {
  const savedKid = loadKidSession();
  if (savedKid) {
    currentKid = savedKid;
    showKidDashboard(savedKid);
  } else {
    showScreen("screen-home");
  }
})();
