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
  getDocs,
  updateDoc,
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
const entryDate = document.getElementById("entryDate");
const entryStart = document.getElementById("entryStart");
const entryEnd = document.getElementById("entryEnd");
const entryBreaks = document.getElementById("entryBreaks");
const entryActivity = document.getElementById("entryActivity");

const myEntriesBody = document.getElementById("myEntriesBody");
const myTotal = document.getElementById("myTotal");
const myEntriesError = document.getElementById("myEntriesError");

const downloadMonth = document.getElementById("downloadMonth");
const downloadUserLabel = document.getElementById("downloadUserLabel");
const downloadUser = document.getElementById("downloadUser");
const downloadBtn = document.getElementById("downloadBtn");

const adminSection = document.getElementById("adminSection");
const adminByUser = document.getElementById("adminByUser");
const orgTotal = document.getElementById("orgTotal");

let isSignUpMode = false;
let unsubMyEntries = null;
let unsubAllEntries = null;

// cache of my own entries (kept client-side so we can re-render
// instantly on edit/cancel without waiting for a new snapshot)
let myEntriesCache = [];
let editingEntryId = null;
let allUsers = [];

// default the date field to today
entryDate.valueAsDate = new Date();

// default the download month picker to the current month (YYYY-MM)
try {
  const now = new Date();
  if (downloadMonth) {
    downloadMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
} catch (err) {
  console.warn("Could not set default download month:", err);
}

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
  myEntriesCache = [];
  editingEntryId = null;

  if (user) {
    authScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    userBox.classList.remove("hidden");
    userEmailLabel.textContent = user.email;

    watchMyEntries(user);
    setupDownloadControls(user);

    const profileSnap = await getDoc(doc(db, "users", user.uid));
    const role = profileSnap.exists() ? profileSnap.data().role : "user";
    if (role === "admin") {
      adminSection.classList.remove("hidden");
      watchAllEntries();
      populateAdminUsers();
      downloadUserLabel.classList.remove("hidden");
    } else {
      adminSection.classList.add("hidden");
      downloadUserLabel.classList.add("hidden");
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

  const date = entryDate.value;
  const start = entryStart.value.trim();
  const end = entryEnd.value.trim();
  const breaks = parseInt(entryBreaks.value, 10) || 0;
  const activity = entryActivity.value.trim();

  if (!date) {
    alert("Please choose a date for your entry.");
    return;
  }

  if (!start || !end) {
    alert("Please enter both start and end time.");
    return;
  }

  if (!activity) {
    alert("Please describe the activity.");
    return;
  }

  const parsedStart = parseFlexibleTime(start);
  const parsedEnd = parseFlexibleTime(end);
  if (parsedStart == null || parsedEnd == null) {
    alert("Please enter valid start and end times. Use 14, 14:00, or 14.5.");
    return;
  }

  const hours = computeWorkedHours(parsedStart, parsedEnd, breaks);

  await addDoc(collection(db, "entries"), {
    uid: user.uid,
    userEmail: user.email,
    date,
    start,
    end,
    breaks,
    activity,
    hours,
    createdAt: serverTimestamp(),
  });

  entryForm.reset();
  entryDate.valueAsDate = new Date();
  entryBreaks.value = 0;
});

// ─────────────────────────────────────────────────────────────
// 7. Live view: my own entries
//
// NOTE: this query only uses `where`, with NO `orderBy`. Combining
// where + orderBy on different fields requires a Firestore composite
// index to be created manually in the console — if that index isn't
// there, the query fails silently and the table just looks empty
// forever. Sorting on the client instead sidesteps that entirely.
// ─────────────────────────────────────────────────────────────
function watchMyEntries(user) {
  const q = query(collection(db, "entries"), where("uid", "==", user.uid));

  unsubMyEntries = onSnapshot(
    q,
    (snap) => {
      myEntriesError.classList.add("hidden");
      myEntriesCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      myEntriesCache.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      renderMyEntries();
    },
    (err) => {
      console.error("my entries listener error:", err);
      myEntriesError.textContent = "Couldn't load your entries (" + err.code + "). Try refreshing.";
      myEntriesError.classList.remove("hidden");
    }
  );
}

function renderMyEntries() {
  if (myEntriesCache.length === 0) {
    myEntriesBody.innerHTML = `<tr><td colspan="8" class="empty-row">No entries yet.</td></tr>`;
    myTotal.textContent = "0 h total";
    return;
  }

  let total = 0;
  myEntriesBody.innerHTML = "";

  myEntriesCache.forEach((e) => {
    total += e.hours || 0;
    const tr = document.createElement("tr");
    const activity = e.activity || "";
    const breaks = Number(e.breaks) || 0;

    if (e.id === editingEntryId) {
      tr.innerHTML = `
            <td><input type="date" class="inline-input" data-field="date" value="${e.date}" /></td>
        <td><input type="text" class="inline-input" data-field="start" placeholder="14 or 14:00" value="${e.start || ""}" /></td>
        <td><input type="text" class="inline-input" data-field="end" placeholder="18 or 18:30" value="${e.end || ""}" /></td>
        <td><input type="number" class="inline-input inline-input-hours" data-field="breaks" value="${breaks}" /></td>
        <td>${formatHours(e.hours || 0)}</td>
        <td><input type="text" class="inline-input" data-field="activity" value="${escapeAttr(activity)}" /></td>
        <td class="row-actions">
          <button class="save-btn" data-id="${e.id}">Save</button>
          <button class="cancel-btn" data-id="${e.id}">Cancel</button>
        </td>
      `;
    } else {
      tr.innerHTML = `
        <td>${e.date}</td>
        <td>${e.start || "-"}</td>
        <td>${e.end || "-"}</td>
        <td>${breaks} min</td>
        <td>${formatHours(e.hours || 0)}</td>
        <td>${escapeHtml(activity)}</td>
        <td class="row-actions">
          <button class="edit-btn" data-id="${e.id}">Edit</button>
          <button class="delete-btn" data-id="${e.id}">Delete</button>
        </td>
      `;
    }

    myEntriesBody.appendChild(tr);
  });

  myTotal.textContent = `${formatHours(total)} h total`;

  myEntriesBody.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      editingEntryId = btn.dataset.id;
      renderMyEntries();
    });
  });

  myEntriesBody.querySelectorAll(".cancel-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      editingEntryId = null;
      renderMyEntries();
    });
  });

  myEntriesBody.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (confirm("Delete this entry?")) {
        deleteDoc(doc(db, "entries", btn.dataset.id));
      }
    });
  });

  myEntriesBody.querySelectorAll(".save-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest("tr");
      const date = row.querySelector('[data-field="date"]').value;
      const start = row.querySelector('[data-field="start"]').value.trim();
      const end = row.querySelector('[data-field="end"]').value.trim();
      const breaks = parseInt(row.querySelector('[data-field="breaks"]').value, 10) || 0;
      const activity = row.querySelector('[data-field="activity"]').value.trim();
      const parsedStart = parseFlexibleTime(start);
      const parsedEnd = parseFlexibleTime(end);

      if (!date) {
        alert("Please choose a date for your entry.");
        return;
      }

      if (!start || !end) {
        alert("Please enter both start and end time.");
        return;
      }

      if (!activity) {
        alert("Please describe the activity.");
        return;
      }

      if (parsedStart == null || parsedEnd == null) {
        alert("Please enter valid start and end times. Use 14, 14:00, or 14.5.");
        return;
      }

      const hours = computeWorkedHours(parsedStart, parsedEnd, breaks);

      await updateDoc(doc(db, "entries", btn.dataset.id), {
        date,
        start: parsedStart,
        end: parsedEnd,
        breaks,
        activity,
        hours,
      });
      editingEntryId = null;
      renderMyEntries();
    });
  });
}

function setupDownloadControls(user) {
  downloadBtn.onclick = async () => {
    const month = downloadMonth.value;
    if (!month) {
      alert("Please choose a month to download.");
      return;
    }

    const selectedUid = downloadUser.value || user.uid;
    const selectedEmail = (downloadUser.value && allUsers.find((u) => u.uid === selectedUid)?.email) || user.email;

    try {
      let entries;
      if (selectedUid === user.uid) {
        entries = myEntriesCache.filter((entry) => entry.date.startsWith(month));
      } else {
        entries = await fetchEntriesForMonth(month, selectedUid);
      }

      if (entries.length === 0) {
        alert("No entries found for the selected month.");
        return;
      }

      const csv = buildCsv(entries);
      const fileName = `entries-${selectedEmail.replace(/[^a-zA-Z0-9_-]/g, "_")}-${month}.csv`;
      downloadTextFile(csv, fileName);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Could not load entries for download. If you are downloading another user, make sure your admin role is set correctly.");
    }
  };
}

async function populateAdminUsers() {
  const usersSnap = await getDocs(collection(db, "users"));
  allUsers = usersSnap.docs
    .map((doc) => ({ uid: doc.id, email: doc.data().email }))
    .filter((user) => user.email)
    .sort((a, b) => a.email.localeCompare(b.email));
  downloadUser.innerHTML = `<option value="">Current user</option>` + allUsers.map((user) => `<option value="${escapeAttr(user.uid)}">${escapeHtml(user.email)}</option>`).join("");
}

async function fetchEntriesForMonth(month, uid) {
  const [year, mon] = month.split("-").map(Number);
  const monthStart = `${year}-${String(mon).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(mon).padStart(2, "0")}-31`;

  const q = query(
    collection(db, "entries"),
    where("uid", "==", uid)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((entry) => entry.date >= monthStart && entry.date <= monthEnd)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function buildCsv(entries) {
  const header = ["Date", "Start", "End", "Breaks (min)", "Hours", "Activity"];
  const rows = entries.map((e) => [
    e.date,
    e.start || "",
    e.end || "",
    e.breaks || 0,
    formatHours(e.hours || 0),
    e.activity || "",
  ]);

  const activityTotals = entries.reduce((totals, entry) => {
    const name = (entry.activity || "").trim();
    if (!name) return totals;
    totals[name] = (totals[name] || 0) + Number(entry.hours || 0);
    return totals;
  }, {});

  const totalsRows = Object.keys(activityTotals)
    .sort()
    .map((activity) => [activity, formatHours(activityTotals[activity])]);

  const escapeRow = (row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",");
  const csvLines = [escapeRow(header), ...rows.map(escapeRow)];

  if (totalsRows.length > 0) {
    csvLines.push("", escapeRow(["Activity", "Total Hours"]), ...totalsRows.map(escapeRow));
  }

  return csvLines.join("\n");
}

function downloadTextFile(text, fileName) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────
// 8. Live view: everyone's entries (admin only — enforced by
//    Firestore security rules, not just by hiding this section)
// ─────────────────────────────────────────────────────────────
function watchAllEntries() {
  const q = query(collection(db, "entries"), orderBy("date", "desc"));

  unsubAllEntries = onSnapshot(
    q,
    (snap) => {
      const byUser = {};
      let grandTotal = 0;

      snap.forEach((docSnap) => {
        const e = docSnap.data();
        grandTotal += Number(e.hours) || 0;
        if (!byUser[e.userEmail]) byUser[e.userEmail] = { total: 0, entries: [] };
        byUser[e.userEmail].total += Number(e.hours) || 0;
        byUser[e.userEmail].entries.push(e);
      });

      orgTotal.textContent = `${formatHours(grandTotal)} h total`;

      adminByUser.innerHTML = "";
      Object.keys(byUser).sort().forEach((email) => {
        const block = document.createElement("div");
        block.className = "admin-user-block";
        const rows = byUser[email].entries
          .map((e) => {
            const breaks = Number(e.breaks) || 0;
            return `<tr><td>${e.date}</td><td>${e.start || "-"}</td><td>${e.end || "-"}</td><td>${breaks} min</td><td>${formatHours(e.hours || 0)}</td><td>${escapeHtml(e.activity || "")}</td></tr>`;
          })
          .join("");
        block.innerHTML = `
          <h3>${email} <span class="sub-total">${formatHours(byUser[email].total)} h</span></h3>
          <table class="entries-table">
            <thead><tr><th>Date</th><th>Start</th><th>End</th><th>Breaks</th><th>Hours</th><th>Activity</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        `;
        adminByUser.appendChild(block);
      });
    },
    (err) => {
      console.error("admin entries listener error:", err);
    }
  );
}

// ─────────────────────────────────────────────────────────────
// 9. Small helpers
// ─────────────────────────────────────────────────────────────
function computeWorkedHours(start, end, breaks) {
  if (!start || !end) return 0;

  const [startHours, startMinutes] = start.split(":").map(Number);
  const [endHours, endMinutes] = end.split(":").map(Number);
  const startDate = new Date(0, 0, 0, startHours, startMinutes);
  let endDate = new Date(0, 0, 0, endHours, endMinutes);

  if (endDate <= startDate) {
    endDate = new Date(0, 0, 1, endHours, endMinutes);
  }

  const diffMinutes = (endDate - startDate) / 60000 - (breaks || 0);
  return Math.max(0, Math.round((diffMinutes / 60) * 100) / 100);
}

function formatHours(hours) {
  return Number(hours).toFixed(2).replace(/\.00$/, "");
}

function parseFlexibleTime(value) {
  if (!value) return null;
  const normalized = value.trim().replace(",", ".");
  const integerOnly = /^\d{1,2}$/;
  const colonTime = /^(\d{1,2}):(\d{1,2})$/;
  const decimalTime = /^(\d{1,2})\.(\d+)$/;

  if (integerOnly.test(normalized)) {
    return `${normalized.padStart(2, "0")}:00`;
  }

  const colonMatch = normalized.match(colonTime);
  if (colonMatch) {
    const hours = Number(colonMatch[1]);
    const minutes = Number(colonMatch[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const decimalMatch = normalized.match(decimalTime);
  if (decimalMatch) {
    const hours = Number(decimalMatch[1]);
    const fraction = Number(`0.${decimalMatch[2]}`);
    if (hours < 0 || hours > 23 || fraction < 0 || fraction >= 1) return null;
    const minutes = Math.round(fraction * 60);
    if (minutes >= 60) return null;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  return null;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
