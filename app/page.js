"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { auth, db, googleProvider } from "@/lib/firebase";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

const MOODS = [
  { key: "Happy", emoji: "😄" },
  { key: "Sad", emoji: "😢" },
  { key: "Angry", emoji: "😠" },
  { key: "Calm", emoji: "😌" },
  { key: "Excited", emoji: "🥳" },
  { key: "Anxious", emoji: "😰" },
];

const moodEmoji = Object.fromEntries(MOODS.map((m) => [m.key, m.emoji]));

const reminders = [
  "You don’t have to explain everything. Just write it out.",
  "Small steps count. Even writing one line is progress.",
  "Your feelings are valid. Let them breathe here.",
  "Write it as it is. No judgement.",
];

function formatTime(ts) {
  if (!ts) return "";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  } catch {
    return "";
  }
}

export default function Home() {
  // ---------------- AUTH ----------------
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Login form
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [authErr, setAuthErr] = useState("");

  // ---------------- APP STATE ----------------
  const [thoughts, setThoughts] = useState([]);
  const [thoughtsLoading, setThoughtsLoading] = useState(false);

  const [text, setText] = useState("");
  const [mood, setMood] = useState("Calm");
  const [filterMood, setFilterMood] = useState("All");
  const [search, setSearch] = useState("");

  // Archive toggle (Level 13)
  const [showArchived, setShowArchived] = useState(false);

  // UI
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const [theme, setTheme] = useState("dark"); // dark | light
  const [releasingId, setReleasingId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Optional device PIN lock (extra layer on top of login)
  const [pinEnabled, setPinEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinInput, setPinInput] = useState("");

  // ---------------- TOAST ----------------
  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  // ---------------- LOAD THEME + PIN SETTINGS ----------------
  useEffect(() => {
    const savedTheme = localStorage.getItem("ut_theme");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);

    const pe = localStorage.getItem("ut_pin_enabled") === "true";
    setPinEnabled(pe);

    const savedPin = localStorage.getItem("ut_pin") || "";
    setPin(savedPin);

    if (pe && savedPin) setLocked(true);
  }, []);

  // ---------------- AUTH LISTENER ----------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // ---------------- FIRESTORE LIVE LISTENER (PER USER) ----------------
  useEffect(() => {
    if (!user) {
      setThoughts([]);
      return;
    }

    setThoughtsLoading(true);

    // IMPORTANT: We DO NOT filter archived in query → avoids new composite index
    const q = query(
      collection(db, "thoughts"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setThoughts(data);
        setThoughtsLoading(false);
      },
      (err) => {
        console.error(err);
        setThoughtsLoading(false);
        showToast("Firestore error. Check index / rules.");
      }
    );

    return () => unsub();
  }, [user]);

  // ---------------- AUTH ACTIONS ----------------
  const doGoogle = async () => {
    setAuthErr("");
    try {
      await signInWithPopup(auth, googleProvider);
      showToast("Signed in");
    } catch (e) {
      console.error(e);
      setAuthErr(e?.message || "Google sign-in failed");
    }
  };

  const doEmail = async () => {
    setAuthErr("");
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, pass);
        showToast("Account created");
      } else {
        await signInWithEmailAndPassword(auth, email, pass);
        showToast("Welcome back");
      }
    } catch (e) {
      console.error(e);
      setAuthErr(e?.message || "Auth failed");
    }
  };

  const doLogout = async () => {
    await signOut(auth);
    showToast("Logged out");
  };

  // ---------------- THOUGHT ACTIONS ----------------
  const saveThought = async () => {
    if (!user) return;
    if (!text.trim()) return showToast("Write something first 🙂");
    if (saving) return;

    setSaving(true);

    const payload = {
      uid: user.uid,
      text: text.trim(),
      mood,
      createdAt: serverTimestamp(),
      archived: false, // Level 13
    };

    try {
      await addDoc(collection(db, "thoughts"), payload);
      setText("");
      showToast("Saved ✅");
    } catch (e) {
      console.error(e);
      showToast("Could not save. Check Firestore rules.");
    } finally {
      setSaving(false);
    }
  };

  const deleteThought = async (id) => {
    try {
      await deleteDoc(doc(db, "thoughts", id));
      showToast("Deleted");
    } catch (e) {
      console.error(e);
      showToast("Delete failed");
    }
  };

  const releaseThought = async (id) => {
    setReleasingId(id);
    setTimeout(async () => {
      await deleteThought(id);
      setReleasingId(null);
    }, 450);
  };

  // Archive / Unarchive (Level 13)
  const toggleArchive = async (t) => {
    try {
      await updateDoc(doc(db, "thoughts", t.id), {
        archived: !t.archived,
      });
      showToast(!t.archived ? "Archived" : "Unarchived");
    } catch (e) {
      console.error(e);
      showToast("Archive failed");
    }
  };

  // Copy (Level 13)
  const copyThought = async (t) => {
    const content = `${t.text}\n\nMood: ${t.mood || ""}\nTime: ${
      formatTime(t.createdAt) || t.time || ""
    }`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        // fallback
        const ta = document.createElement("textarea");
        ta.value = content;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      showToast("Copied ✅");
    } catch (e) {
      console.error(e);
      showToast("Copy failed");
    }
  };

  // Export JSON (Level 13)
  const exportJSON = () => {
    const clean = thoughts.map((t) => ({
      id: t.id,
      text: t.text || "",
      mood: t.mood || "",
      archived: !!t.archived,
      createdAt: formatTime(t.createdAt) || t.time || "",
      uid: t.uid || "",
    }));

    const blob = new Blob([JSON.stringify(clean, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "unspoken_thoughts_backup.json";
    a.click();
    URL.revokeObjectURL(url);

    showToast("Backup downloaded 📥");
  };

  const clearFilters = () => {
    setSearch("");
    setFilterMood("All");
    showToast("Cleared");
  };

  // ---------------- FILTERED THOUGHTS ----------------
  const filteredThoughts = useMemo(() => {
    const s = search.trim().toLowerCase();
    return thoughts.filter((t) => {
      const isArchived = !!t.archived;
      const archiveOk = showArchived ? true : !isArchived;

      const moodOk = filterMood === "All" || t.mood === filterMood;
      const textOk = !s || (t.text || "").toLowerCase().includes(s);

      return archiveOk && moodOk && textOk;
    });
  }, [thoughts, filterMood, search, showArchived]);

  // ---------------- MOOD INSIGHTS (bars) ----------------
  const moodCounts = useMemo(() => {
    const counts = Object.fromEntries(MOODS.map((m) => [m.key, 0]));
    for (const t of filteredThoughts) {
      if (counts[t.mood] !== undefined) counts[t.mood] += 1;
    }
    return counts;
  }, [filteredThoughts]);

  const maxCount = useMemo(() => {
    const vals = Object.values(moodCounts);
    const m = Math.max(0, ...vals);
    return m || 1;
  }, [moodCounts]);

  const reminder = useMemo(() => {
    const i = Math.floor(Date.now() / 60000) % reminders.length;
    return reminders[i];
  }, []);

  // ---------------- PIN LOCK (device-level) ----------------
  const enablePin = () => {
    const newPin = prompt("Set a 4+ digit PIN (device only):");
    if (!newPin || newPin.length < 4) return showToast("PIN not set");
    localStorage.setItem("ut_pin", newPin);
    localStorage.setItem("ut_pin_enabled", "true");
    setPin(newPin);
    setPinEnabled(true);
    setLocked(true);
    setPinInput("");
    showToast("PIN enabled");
  };

  const disablePin = () => {
    localStorage.setItem("ut_pin_enabled", "false");
    setPinEnabled(false);
    setLocked(false);
    showToast("PIN disabled");
  };

  const unlockPin = () => {
    if (pinInput === pin) {
      setLocked(false);
      setPinInput("");
      showToast("Unlocked");
    } else {
      showToast("Wrong PIN");
    }
  };

  const lockNow = () => {
    if (!pinEnabled || !pin) return showToast("Enable PIN first");
    setLocked(true);
    setPinInput("");
    showToast("Locked");
  };

  // ---------------- THEME ----------------
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("ut_theme", next);
  };

  // ---------------- UI: AUTH LOADING ----------------
  if (authLoading) {
    return (
      <main className="ut-page">
        <div className="ut-shell">
          <div className="ut-card ut-center">
            <div className="ut-title">Unspoken Thoughts</div>
            <div className="ut-sub">Loading…</div>
          </div>
        </div>
      </main>
    );
  }

  // ---------------- UI: NOT LOGGED IN ----------------
  if (!user) {
    return (
      <main className={`ut-page ${theme === "light" ? "ut-light" : ""}`}>
        <div className="ut-shell">
          <div className="ut-auth">
            <div className="ut-brand">
              <div className="ut-logo">✨</div>
              <div>
                <div className="ut-title">Unspoken Thoughts</div>
                <div className="ut-sub">
                  Write. Breathe. Save what matters. Release what doesn’t.
                </div>
              </div>
            </div>

            <div className="ut-card">
              <div className="ut-tabs">
                <button
                  className={`ut-tab ${mode === "login" ? "is-active" : ""}`}
                  onClick={() => setMode("login")}
                >
                  Login
                </button>
                <button
                  className={`ut-tab ${mode === "signup" ? "is-active" : ""}`}
                  onClick={() => setMode("signup")}
                >
                  Sign up
                </button>
              </div>

              <label className="ut-label">Email</label>
              <input
                className="ut-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />

              <label className="ut-label">Password</label>
              <input
                className="ut-input"
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
              />

              {authErr ? <div className="ut-error">{authErr}</div> : null}

              <button className="ut-btn ut-btn-primary" onClick={doEmail}>
                {mode === "signup" ? "Create account" : "Login"}
              </button>

              <div className="ut-divider">
                <span>or</span>
              </div>

              <button className="ut-btn ut-btn-ghost" onClick={doGoogle}>
                Continue with Google
              </button>

              <div className="ut-mini">
                Tip: You enabled both Email/Password + Google in Firebase — good.
              </div>
            </div>

            <div className="ut-card ut-reminder">
              <div className="ut-reminder-title">Tiny reminder</div>
              <div className="ut-reminder-quote">“{reminder}”</div>
            </div>
          </div>
        </div>

        {toast ? <div className="ut-toast">{toast}</div> : null}
      </main>
    );
  }

  // ---------------- UI: PIN LOCK SCREEN (optional) ----------------
  if (pinEnabled && locked) {
    return (
      <main className={`ut-page ${theme === "light" ? "ut-light" : ""}`}>
        <div className="ut-shell">
          <div className="ut-card ut-center" style={{ maxWidth: 520 }}>
            <div className="ut-title">🔐 Private Space</div>
            <div className="ut-sub">
              Enter your device PIN to open Unspoken Thoughts.
            </div>

            <input
              className="ut-input"
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter PIN"
            />

            <div className="ut-row">
              <button className="ut-btn ut-btn-primary" onClick={unlockPin}>
                Unlock
              </button>
              <button className="ut-btn ut-btn-ghost" onClick={doLogout}>
                Logout
              </button>
            </div>

            <div className="ut-mini">(PIN is stored only in this browser.)</div>
          </div>
        </div>
        {toast ? <div className="ut-toast">{toast}</div> : null}
      </main>
    );
  }

  // ---------------- UI: MAIN APP ----------------
  return (
    <main className={`ut-page ${theme === "light" ? "ut-light" : ""}`}>
      <div className="ut-shell">
        {/* HEADER */}
        <div className="ut-header">
          <div className="ut-brand">
            <div className="ut-logo">✨</div>
            <div>
              <div className="ut-title">Unspoken Thoughts</div>
              <div className="ut-sub">
                Write. Breathe. Save what matters. Release what doesn’t.
              </div>
            </div>
          </div>

          <div className="ut-actions">
            <div className="ut-pill">
              Signed in as <b>{user.email || "User"}</b>
            </div>

            <button className="ut-btn ut-btn-ghost" onClick={toggleTheme}>
              {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
            </button>

            {!pinEnabled ? (
              <button className="ut-btn ut-btn-ghost" onClick={enablePin}>
                🔐 Enable PIN
              </button>
            ) : (
              <>
                <button className="ut-btn ut-btn-ghost" onClick={lockNow}>
                  🔒 Lock now
                </button>
                <button className="ut-btn ut-btn-ghost" onClick={disablePin}>
                  🔓 Disable PIN
                </button>
              </>
            )}

            <button className="ut-btn ut-btn-ghost" onClick={exportJSON}>
              📥 Export
            </button>

            <button className="ut-btn ut-btn-primary" onClick={doLogout}>
              Logout
            </button>
          </div>
        </div>

        {/* GRID */}
        <div className="ut-grid">
          {/* LEFT: Composer */}
          <div className="ut-card ut-card-big">
            <div className="ut-row ut-row-gap">
              <select
                className="ut-input"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
              >
                {MOODS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.key} {m.emoji}
                  </option>
                ))}
              </select>

              <input
                className="ut-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your thoughts..."
              />
            </div>

            <textarea
              className="ut-textarea"
              rows={6}
              maxLength={500}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write what you’re feeling..."
            />
            <div className="ut-right ut-mini">{text.length}/500</div>

            <div className="ut-row">
              <button
                className="ut-btn ut-btn-primary"
                onClick={saveThought}
                disabled={saving}
                title={saving ? "Saving..." : "Save thought"}
              >
                {saving ? "Saving..." : "Save thought"}
              </button>

              <button className="ut-btn ut-btn-ghost" onClick={() => setText("")}>
                Clear
              </button>

              <button className="ut-btn ut-btn-ghost" onClick={clearFilters}>
                Clear filters
              </button>

              <div className="ut-spacer" />

              <select
                className="ut-input"
                value={filterMood}
                onChange={(e) => setFilterMood(e.target.value)}
                style={{ maxWidth: 180 }}
              >
                <option value="All">All</option>
                {MOODS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.key} {m.emoji}
                  </option>
                ))}
              </select>
            </div>

            {/* Archive toggle */}
            <div className="ut-row ut-row-tight" style={{ marginTop: 10 }}>
              <label className="ut-mini" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                />
                Show archived
              </label>
            </div>
          </div>

          {/* RIGHT: Mood insights (BARS) */}
          <div className="ut-card">
            <div className="ut-card-title">Mood insights</div>
            <div className="ut-mini">Uses your current search/filter too.</div>

            <div className="ut-chart">
              {MOODS.map((m) => {
                const count = moodCounts[m.key] || 0;
                const width = Math.round((count / maxCount) * 100);
                return (
                  <div key={m.key} className="ut-chart-row">
                    <div className="ut-chart-label">
                      <span>{m.emoji}</span> <b>{m.key}</b>
                    </div>
                    <div className="ut-chart-bar">
                      <div className="ut-chart-fill" style={{ width: `${width}%` }} />
                    </div>
                    <div className="ut-chart-num">{count}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* LEFT: List */}
          <div className="ut-card ut-card-big">
            <div className="ut-card-title">Your thoughts</div>

            {thoughtsLoading ? (
              <div className="ut-empty">Loading your thoughts…</div>
            ) : filteredThoughts.length === 0 ? (
              <div className="ut-empty">
                No thoughts yet. Write one above — it’ll appear here instantly.
              </div>
            ) : (
              <div className="ut-list">
                {filteredThoughts.map((t) => (
                  <div
                    key={t.id}
                    className={`ut-item ${releasingId === t.id ? "is-releasing" : ""}`}
                  >
                    <div className="ut-item-head">
                      <div className="ut-item-mood">
                        {moodEmoji[t.mood] || "🫧"} {t.mood || "—"}
                        {t.archived ? <span style={{ marginLeft: 10, opacity: 0.7 }}>📦 Archived</span> : null}
                      </div>
                      <div className="ut-item-time">
                        {formatTime(t.createdAt) || t.time || ""}
                      </div>
                    </div>

                    <div className="ut-item-text">{t.text}</div>

                    <div className="ut-row ut-row-tight">
                      <button
                        className="ut-btn ut-btn-danger"
                        onClick={() => deleteThought(t.id)}
                        title="Permanent delete"
                      >
                        Delete
                      </button>

                      <button
                        className="ut-btn ut-btn-ghost"
                        onClick={() => releaseThought(t.id)}
                        title="A gentle delete with animation"
                      >
                        🌬️ Release
                      </button>

                      <button
                        className="ut-btn ut-btn-ghost"
                        onClick={() => copyThought(t)}
                        title="Copy to clipboard"
                      >
                        📋 Copy
                      </button>

                      <button
                        className="ut-btn ut-btn-ghost"
                        onClick={() => toggleArchive(t)}
                        title={t.archived ? "Move back to active list" : "Hide without deleting"}
                      >
                        {t.archived ? "↩️ Unarchive" : "📦 Archive"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Reminder */}
          <div className="ut-card ut-reminder">
            <div className="ut-reminder-title">Tiny reminder</div>
            <div className="ut-reminder-quote">“{reminder}”</div>
          </div>
        </div>
      </div>

      {toast ? <div className="ut-toast">{toast}</div> : null}
    </main>
  );
}
