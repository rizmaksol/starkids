// ============================================================
// js/prayer.js — StarKids V10
// Prayer times via Aladhan.com API · Alerts · Sound
// ============================================================

const ALADHAN_API = "https://api.aladhan.com/v1/timingsByCity";
const PRAYER_NAMES = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
const PRAYER_EMOJIS = { Fajr: "🌅", Dhuhr: "☀️", Asr: "🌤", Maghrib: "🌇", Isha: "🌙" };

let prayerAlertInterval = null;

// ── Fetch prayer times for a city ────────────────────────────
export async function fetchPrayerTimes(city, country = "SA", method = 4) {
  // Method 4 = Umm Al-Qura (Saudi Arabia) — good default for Muslim families
  // Method 2 = ISNA (North America)
  // Method 3 = MWL (Muslim World League)
  const url = `${ALADHAN_API}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${method}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error("Could not fetch prayer times");
  const data = await res.json();
  if (data.code !== 200) throw new Error(data.status || "API error");
  return data.data.timings;
}

// ── Get next prayer ───────────────────────────────────────────
export function getNextPrayer(timings) {
  const now    = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  for (const name of PRAYER_NAMES) {
    const [h, m] = timings[name].split(":").map(Number);
    const pMin   = h * 60 + m;
    if (pMin > nowMin) {
      const diff = pMin - nowMin;
      return { name, time: timings[name], minutesLeft: diff, emoji: PRAYER_EMOJIS[name] };
    }
  }
  // All prayers passed — next is Fajr tomorrow
  const [h, m] = timings["Fajr"].split(":").map(Number);
  const pMin   = h * 60 + m + 1440; // + 24 hours
  return { name: "Fajr", time: timings["Fajr"], minutesLeft: pMin - nowMin, emoji: "🌅", tomorrow: true };
}

// ── Format time to 12hr ───────────────────────────────────────
export function formatPrayerTime(time24) {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12    = h % 12 || 12;
  return `${h12}:${String(m).padStart(2,"0")} ${period}`;
}

// ── Start prayer time alerts ──────────────────────────────────
export function startPrayerAlerts(timings, kidName) {
  if (prayerAlertInterval) clearInterval(prayerAlertInterval);

  function checkPrayer() {
    const now    = new Date();
    const nowStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

    PRAYER_NAMES.forEach(name => {
      const pTime = timings[name]?.slice(0,5); // HH:MM
      if (pTime === nowStr) {
        showPrayerAlert(name, kidName);
      }
    });
  }

  // Check every minute
  prayerAlertInterval = setInterval(checkPrayer, 60000);
  checkPrayer(); // Check immediately
}

export function stopPrayerAlerts() {
  if (prayerAlertInterval) clearInterval(prayerAlertInterval);
}

// ── Show prayer alert overlay ─────────────────────────────────
function showPrayerAlert(prayerName, kidName) {
  // Play sound
  playAdhanSound();

  // Show overlay
  const existing = document.getElementById("prayer-alert");
  if (existing) existing.remove();

  const el = document.createElement("div");
  el.id = "prayer-alert";
  el.innerHTML = `
    <div class="prayer-alert-box">
      <div class="prayer-alert-emoji">${PRAYER_EMOJIS[prayerName] || "🕌"}</div>
      <div class="prayer-alert-title">Time for ${prayerName}!</div>
      <div class="prayer-alert-name">Hey ${kidName||""}! 🌟</div>
      <div class="prayer-alert-msg">It's ${prayerName} time. Complete your prayer to earn stars!</div>
      <button onclick="document.getElementById('prayer-alert').remove()" class="prayer-alert-btn">✅ Got it!</button>
    </div>`;
  el.className = "prayer-alert-overlay";
  document.body.appendChild(el);

  // Auto-dismiss after 30 seconds
  setTimeout(() => el.remove(), 30000);
}

// ── Simple beep sound (no external file needed) ───────────────
function playAdhanSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523, 659, 784, 659, 784, 880, 784]; // Simple melodic alert
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.3 + 0.25);
      osc.start(ctx.currentTime + i * 0.3);
      osc.stop(ctx.currentTime + i * 0.3 + 0.3);
    });
  } catch(e) { console.log("Audio not available"); }
}

// ── Save/get prayer city setting ─────────────────────────────
export function savePrayerCity(city, country) {
  localStorage.setItem("sk_prayer_city", city);
  localStorage.setItem("sk_prayer_country", country);
}

export function getPrayerCity() {
  return {
    city:    localStorage.getItem("sk_prayer_city") || "",
    country: localStorage.getItem("sk_prayer_country") || "SA"
  };
}
