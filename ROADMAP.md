# StarKids V10 — ROADMAP

## Core Rule

> **No feature may be added unless it improves one of the four pillars:**
> 1. Habits
> 2. Values
> 3. Financial Literacy
> 4. Family Engagement

---

## Sprint Status

### ✅ Sprint 1 — Authentication + Kids Management
**Goal:** Working end-to-end auth flow for parents and children.

Parent:
- [x] Sign Up
- [x] Login
- [x] Logout
- [x] Add Kid
- [x] Delete Kid
- [x] Generate 6-digit Code

Child:
- [x] Enter Code
- [x] Login
- [x] Open Kid Dashboard

---

### 🔒 Sprint 2 — Tasks (LOCKED until Sprint 1 is stable)
- Task creation by parent
- Task completion by child
- Task approval by parent

### 🔒 Sprint 3 — Wallet (LOCKED until Sprint 2 is stable)
- Star balance per kid
- Earning stars from tasks
- Saving goals

### 🔒 Sprint 4 — Rewards (LOCKED until Sprint 3 is stable)
- Goal creation
- Goal progress tracking
- Reward redemption

---

## What NOT to Build Yet
- ❌ Wallet transfers
- ❌ Real banking integration
- ❌ Shopping partners
- ❌ Premium billing
- ❌ AI features
- ❌ School integration

---

## Definition of Success (30 Days)
- Parents are approving tasks daily
- Kids are checking their stars daily
- Kids are saving toward goals
- Families are discussing progress

---

## Tech Stack
- **Frontend:** Vanilla HTML + CSS + JS (no framework overhead)
- **Auth:** Firebase Authentication (Email/Password only)
- **Database:** Cloud Firestore
- **Storage:** Firebase Storage
- **Hosting:** Firebase Hosting

## Collections
- `parents` — parent profile data
- `kids` — kid profiles linked to parent
- `tasks` — task definitions
- `submissions` — kid task completions
- `wallets` — star balances
- `goals` — saving goals
- `rewards` — reward catalog
- `praise` — praise messages
- `values` — family values
