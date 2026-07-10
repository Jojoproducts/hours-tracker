// ─────────────────────────────────────────────────────────────
// 1. PASTE YOUR FIREBASE CONFIG HERE (from Firebase Console →
//    Project settings → General → Your apps → Web app)
// ─────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBdtzjwaeHqbxMm1iHkPK9JRw2jDzvbHcM",
  authDomain: "hours-tracker-2911e.firebaseapp.com",
  projectId: "hours-tracker-2911e",
  storageBucket: "hours-tracker-2911e.firebasestorage.app",
  messagingSenderId: "675864401521",
  appId: "1:675864401521:web:11af85e921c245fde42dd0"
};

// ─────────────────────────────────────────────────────────────
// 2. Firebase setup (no build step — loaded straight from CDN)
// ─────────────────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ─────────────────────────────────────────────────────────────
// 3. DOM references
// ─────────────────────────────────────────────────────────────
const authScreen = document.getElementById("authScreen");
const appScreen = document.getElementById("appScreen");
const userBox = document.getElementById("userBox");
const userEmailLabel = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");

const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authSubmit = document.getElementById("authSubmit");
const authError = document.getElementById("authError");
const switchModeBtn = document.getElementById("switchModeBtn");
const switchText = document.getElementById("switchText");

const entryForm = document.getElementById("entryForm");
const entryActivity = document.getElementById("entryActivity");
const entryHours = document.getElementById("entryHours");
const entryDate = document.getElementById("entryDate");

const myEntriesBody = document.getElementById("myEntriesBody");
const myTotal = document.getElementById("myTotal");

const adminSection = document.getElementById("adminSection");
const adminByUser = document.getElementById("adminByUser");
const orgTotal = document.getElementById("orgTotal");

let isSignUpMode = false;
let unsubMyEntries = null;
let unsubAllEntries = null;

// default the date field to today
entryDate.valueAsDate = new Date();

// ─────────────────────────────────────────────────────────────
// 4. Auth: sign up / log in toggle + submit
// ─────────────────────────────────────────────────────────────
switchModeBtn.addEventListener("click", () => {
  isSignUpMode = !isSignUpMode;
  authTitle.textContent = isSignUpMode ? "Sign up" : "Log in";
  authSubmit.textContent = isSignUpMode ? "Sign up" : "Log in";
  switchText.textContent = isSignUpMode ? "Already have an account?" : "Don't have an account?";
  switchModeBtn.textContent = isSignUpMode ? "Log in" : "Sign up";
  authError.classList.add("hidden");
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.classList.add("hidden");
  const email = authEmail.value.trim();
  const password = authPassword.value;

  try {
    if (isSignUpMode) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // create the matching user profile doc — everyone starts as "user"
      await setDoc(doc(db, "users", cred.user.uid), {
        email: cred.user.email,
        role: "user",
        createdAt: serverTimestamp(),
      });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (err) {
    authError.textContent = friendlyAuthError(err.code);
    authError.classList.remove("hidden");
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

function friendlyAuthError(code) {
  const map = {
    "auth/email-already-in-use": "That email is already registered — try logging in instead.",
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/invalid-credential": "Wrong email or password.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/user-not-found": "No account found with that email.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

// ─────────────────────────────────────────────────────────────
// 5. React to login state
// ─────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  // clear any previous listeners when auth state changes
  if (unsubMyEntries) { unsubMyEntries(); unsubMyEntries = null; }
  if (unsubAllEntries) { unsubAllEntries(); unsubAllEntries = null; }

  if (user) {
    authScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    userBox.classList.remove("hidden");
    userEmailLabel.textContent = user.email;

    watchMyEntries(user);

    const profileSnap = await getDoc(doc(db, "users", user.uid));
    const role = profileSnap.exists() ? profileSnap.data().role : "user";
    if (role === "admin") {
      adminSection.classList.remove("hidden");
      watchAllEntries();
    } else {
      adminSection.classList.add("hidden");
    }
  } else {
    authScreen.classList.remove("hidden");
    appScreen.classList.add("hidden");
    userBox.classList.add("hidden");
    authForm.reset();
  }
});

// ─────────────────────────────────────────────────────────────
// 6. Add a new entry
// ─────────────────────────────────────────────────────────────
entryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  await addDoc(collection(db, "entries"), {
    uid: user.uid,
    userEmail: user.email,
    activity: entryActivity.value.trim(),
    hours: parseFloat(entryHours.value),
    date: entryDate.value, // stored as "YYYY-MM-DD" string, sorts fine lexicographically
    createdAt: serverTimestamp(),
  });

  entryForm.reset();
  entryDate.valueAsDate = new Date();
});

// ─────────────────────────────────────────────────────────────
// 7. Live view: my own entries
// ─────────────────────────────────────────────────────────────
function watchMyEntries(user) {
  const q = query(
    collection(db, "entries"),
    where("uid", "==", user.uid),
    orderBy("date", "desc")
  );

  unsubMyEntries = onSnapshot(q, (snap) => {
    if (snap.empty) {
      myEntriesBody.innerHTML = `<tr><td colspan="4" class="empty-row">No entries yet.</td></tr>`;
      myTotal.textContent = "0 h total";
      return;
    }

    let total = 0;
    myEntriesBody.innerHTML = "";
    snap.forEach((docSnap) => {
      const e = docSnap.data();
      total += e.hours;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${e.date}</td>
        <td>${escapeHtml(e.activity)}</td>
        <td>${e.hours}</td>
        <td><button class="delete-btn" data-id="${docSnap.id}">Delete</button></td>
      `;
      myEntriesBody.appendChild(tr);
    });
    myTotal.textContent = `${total} h total`;

    myEntriesBody.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => deleteDoc(doc(db, "entries", btn.dataset.id)));
    });
  });
}

// ─────────────────────────────────────────────────────────────
// 8. Live view: everyone's entries (admin only — enforced by
//    Firestore security rules, not just by hiding this section)
// ─────────────────────────────────────────────────────────────
function watchAllEntries() {
  const q = query(collection(db, "entries"), orderBy("date", "desc"));

  unsubAllEntries = onSnapshot(q, (snap) => {
    const byUser = {};
    let grandTotal = 0;

    snap.forEach((docSnap) => {
      const e = docSnap.data();
      grandTotal += e.hours;
      if (!byUser[e.userEmail]) byUser[e.userEmail] = { total: 0, entries: [] };
      byUser[e.userEmail].total += e.hours;
      byUser[e.userEmail].entries.push(e);
    });

    orgTotal.textContent = `${grandTotal} h total`;

    adminByUser.innerHTML = "";
    Object.keys(byUser).sort().forEach((email) => {
      const block = document.createElement("div");
      block.className = "admin-user-block";
      const rows = byUser[email].entries
        .map((e) => `<tr><td>${e.date}</td><td>${escapeHtml(e.activity)}</td><td>${e.hours}</td></tr>`)
        .join("");
      block.innerHTML = `
        <h3>${email} <span class="sub-total">${byUser[email].total} h</span></h3>
        <table class="entries-table">
          <thead><tr><th>Date</th><th>Activity</th><th>Hours</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
      adminByUser.appendChild(block);
    });
  });
}

// ─────────────────────────────────────────────────────────────
// 9. Small helper
// ─────────────────────────────────────────────────────────────
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
