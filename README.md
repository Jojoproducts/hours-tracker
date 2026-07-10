# Hours Tracker — Setup Guide

A tiny internal tool: people log in, log activity + hours, see only their own
entries. Admins see everyone's. Frontend is plain HTML/CSS/JS (no build step)
hosted on GitHub Pages; the backend is Firebase (Auth + Firestore), free tier,
no inactivity pausing.

Files in this folder:
- `index.html` — the page
- `style.css` — styling
- `app.js` — all the logic (you'll paste your Firebase config into the top of this file)
- `firestore.rules` — security rules you paste into the Firebase console (not deployed via GitHub)

---

## Part 1 — Create the Firebase project (~5 min)

1. Go to https://console.firebase.google.com and click **Add project**.
2. Name it anything (e.g. `hours-tracker`). Disable Google Analytics (not needed) → **Create project**.
3. In the left sidebar: **Build → Authentication → Get started**.
   - Click the **Email/Password** provider → enable it → **Save**.
4. In the left sidebar: **Build → Firestore Database → Create database**.
   - Choose **Start in production mode**.
   - Pick a region close to you — for Berlin, `eur3 (europe-west)` is a good choice.
   - Click **Enable**.
5. Still in Firestore, go to the **Rules** tab, delete the default contents, and paste in
   everything from `firestore.rules` in this folder. Click **Publish**.
6. Go to **Project settings** (gear icon, top left) → scroll to **Your apps** →
   click the **</>** (Web) icon → give it a nickname (e.g. `web`) → **Register app**.
   You do **not** need Firebase Hosting — skip that checkbox.
7. Firebase will show you a `firebaseConfig` object like this:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "hours-tracker-xxxx.firebaseapp.com",
     projectId: "hours-tracker-xxxx",
     storageBucket: "hours-tracker-xxxx.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
   Copy it — you'll need it in Part 2.

---

## Part 2 — Wire up the code (~2 min)

1. Open `app.js` in VS Code.
2. Near the top, replace the placeholder `firebaseConfig` object with the real
   one you copied from Firebase. That's the only code change needed.

---

## Part 3 — Push to GitHub and enable Pages (~5 min)

1. In VS Code, open this folder (`hours-tracker`) and open a terminal (`` Ctrl+` ``).
2. Run:
   ```bash
   git init
   git add .
   git commit -m "Hours tracker app"
   ```
3. On GitHub, create a new **empty** repository (no README, no .gitignore) —
   e.g. `hours-tracker`.
4. Back in the terminal, connect and push (replace `YOUR-USERNAME`):
   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/hours-tracker.git
   git branch -M main
   git push -u origin main
   ```
5. On GitHub, go to the repo → **Settings → Pages**.
   - Under **Source**, choose **Deploy from a branch**.
   - Branch: `main`, folder: `/ (root)` → **Save**.
6. GitHub will give you a URL after a minute or two, something like:
   `https://YOUR-USERNAME.github.io/hours-tracker/`

---

## Part 4 — Tell Firebase to trust that URL (~1 min)

Firebase blocks login attempts from domains it doesn't recognize.

1. Back in Firebase console → **Authentication → Settings → Authorized domains**.
2. Click **Add domain** and add: `YOUR-USERNAME.github.io`
3. Save.

---

## Part 5 — Make yourself admin (~1 min)

1. Open your live GitHub Pages URL, click **Sign up**, and create your own account.
2. In Firebase console → **Firestore Database → Data**, open the `users` collection.
3. Click on the document with your user ID (you can match it by the `email`
   field). Edit the `role` field from `"user"` to `"admin"`. Save.
4. Refresh your app — you'll now see the admin section with everyone's hours.

Any *other* new sign-up automatically gets `role: "user"` and only ever sees
their own entries. To promote someone else later, repeat step 3 for their doc.

---

## That's it

Share the GitHub Pages URL with your team. Everyone signs up with their own
email + password, logs hours, and only you (as admin) see the full picture.

**Costs:** €0. Firebase's free "Spark" plan comfortably covers this (no
inactivity pausing, unlike some alternatives), and GitHub Pages is free for
public repos.

**Limitations worth knowing:**
- Anyone can sign up with any email (no invite system) — fine for a trusted
  internal team, not for a public-facing product.
- Password resets aren't wired up in this minimal version — Firebase supports
  it, just say the word if you want it added.
- If the repo is public, the Firebase config in `app.js` is visible to anyone —
  that's normal and fine, since it's not a secret (real access control happens
  in the Firestore security rules, not the config).
