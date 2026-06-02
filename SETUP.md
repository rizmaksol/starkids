# StarKids V10 — Setup Guide

## Step 1: Create Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**
3. Name: `StarKids-V10`
4. Enable Google Analytics (optional)
5. Click **Create project**

---

## Step 2: Enable Services

Inside your new project:

### Authentication
- Go to **Build → Authentication**
- Click **Get started**
- Enable **Email/Password**
- Save

### Firestore Database
- Go to **Build → Firestore Database**
- Click **Create database**
- Choose **Start in production mode** (we have rules)
- Pick your region (e.g. `us-central`)

### Storage
- Go to **Build → Storage**
- Click **Get started**
- Choose **Start in production mode**

### Hosting
- Go to **Build → Hosting**
- Click **Get started** (follow the CLI steps below)

---

## Step 3: Get Your Firebase Config

1. Go to **Project Settings** (gear icon)
2. Scroll to **Your apps**
3. Click **Add app → Web**
4. Register app name: `StarKids-V10`
5. Copy the `firebaseConfig` object

Paste the values into `js/firebase.js`:

```js
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
```

---

## Step 4: Create Firestore Collections

In Firestore → **Start collection** for each:

```
parents
kids
tasks
submissions
wallets
goals
rewards
praise
values
```

No fields needed now — they'll be created automatically during use.

---

## Step 5: Deploy

```bash
# Install Firebase CLI (once)
npm install -g firebase-tools

# Login
firebase login

# Link to your project
firebase use --add
# Select: StarKids-V10

# Deploy everything
firebase deploy
```

---

## Step 6: Verify

1. Open the Hosting URL from Firebase Console
2. Test: Parent sign up → login → add kid → generate code
3. Test: Open a new tab → Kid login → enter code → see dashboard

---

## Sprint 1 Checklist

- [ ] Firebase project created
- [ ] Auth Email/Password enabled
- [ ] Firestore created
- [ ] `js/firebase.js` filled with real config
- [ ] `firebase deploy` succeeded
- [ ] Parent: Sign Up ✓
- [ ] Parent: Login ✓
- [ ] Parent: Logout ✓
- [ ] Parent: Add Kid ✓
- [ ] Parent: Delete Kid ✓
- [ ] Parent: Generate Code ✓
- [ ] Kid: Enter Code ✓
- [ ] Kid: Start My Day ✓
- [ ] Kid: Reach Dashboard ✓

**Sprint 1 is DONE when all boxes are checked. Only then begin Sprint 2.**
