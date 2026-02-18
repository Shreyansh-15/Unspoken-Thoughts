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
  increment,
} from "firebase/firestore";

const MOODS = [
  { key: "Happy", emoji: "😄" },
  { key: "Sad", emoji: "😢" },
  { key: "Angry", emoji: "😠" },
  { key: "Calm", emoji: "😌" },
  { key: "Excited", emoji: "🥳" },
  { key: "Anxious", emoji: "😰" },
];

const reflections = {
  Happy: ["Hold this moment a little longer ✨", "Joy is worth remembering."],
  Sad: ["It’s okay to slow down today 🌙", "You don’t need to carry everything alone."],
  Angry: ["Strong feelings mean something matters.", "Breathe first. You can respond later."],
  Calm: ["Peace is progress too 😌", "This quiet moment belongs to you."],
  Excited: ["Energy like this is beautiful ⚡", "Capture this spark."],
  Anxious: ["You are safer than your thoughts suggest 🌫️", "Take one small breath at a time."],
};

const moodEmoji = Object.fromEntries(MOODS.map((m) => [m.key, m.emoji]));

const reminders = [
  "You don’t have to explain everything. Just write it out.",
  "Small steps count. Even writing one line is progress.",
  "Your feelings are valid. Let them breathe here.",
  "Write it as it is. No judgement.",
];

const DAILY_PROMPTS = [
  "What’s one thing you’re carrying today?",
  "What do you wish someone understood about you right now?",
  "Name the feeling. Don’t explain it—just name it.",
  "What are you avoiding that you actually need?",
  "If today had a title, what would it be?",
  "What would help you feel 5% lighter?",
  "Write one sentence you needed to hear.",
];

const QUICK_TEMPLATES = [
  "Right now I feel…",
  "What’s stuck in my head is…",
  "I’m tired of…",
  "I wish…",
  "One thing I’m grateful for is…",
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

function ymd(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

function getPromptForToday() {
  const dayKey = ymd();
  let hash = 0;
  for (let i = 0; i < dayKey.length; i++) hash = (hash * 31 + dayKey.charCodeAt(i)) >>> 0;
  return DAILY_PROMPTS[hash % DAILY_PROMPTS.length];
}

function dateKeyFromCreatedAt(createdAt) {
  try {
    const d = createdAt?.toDate ? createdAt.toDate() : createdAt ? new Date(createdAt) : null;
    if (!d) return null;
    return ymd(d);
  } catch {
    return null;
  }
}

export default function Home() {
  // ---------------- AUTH ----------------
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [mode, setMode] = useState("login");
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

  const [showArchived, setShowArchived] = useState(false);

  // ✅ Level 18: Trash view toggle
  const [showTrash, setShowTrash] = useState(false);

  // UI
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const [theme, setTheme] = useState("dark");
  const [releasingId, setReleasingId] = useState(null);
  const [saving, setSaving] = useState(false);

  // PIN lock
  const [pinEnabled, setPinEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinInput, setPinInput] = useState("");

  // Level 16 privacy
  const [autoLockMin, setAutoLockMin] = useState(0);
  const [blurOnHidden, setBlurOnHidden] = useState(true);
  const [lockOnHidden, setLockOnHidden] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const lockTimer = useRef(null);

  // Online badge
  const [isOnline, setIsOnline] = useState(true);

  // Reflection
  const [reflection, setReflection] = useState("");

  // Streak + prompt
  const [dailyPrompt] = useState(() => getPromptForToday());
  const [streak, setStreak] = useState(0);
  const [lastWriteDay, setLastWriteDay] = useState("");

  // ---------------- LEVEL 17: PUBLIC FEED ----------------
  const [publicPosts, setPublicPosts] = useState([]);
  const [publicLoading, setPublicLoading] = useState(false);
  const [shareAnonName, setShareAnonName] = useState("Anonymous");
  const [showPublicFeed, setShowPublicFeed] = useState(true);

  // ✅ Level 18: Import
  const fileInputRef = useRef(null);

  // ---------------- TOAST ----------------
  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  // ---------------- INIT SETTINGS ----------------
  useEffect(() => {
    const savedTheme = localStorage.getItem("ut_theme");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);

    const pe = localStorage.getItem("ut_pin_enabled") === "true";
    setPinEnabled(pe);

    const savedPin = localStorage.getItem("ut_pin") || "";
    setPin(savedPin);
    if (pe && savedPin) setLocked(true);

    const savedStreak = parseInt(localStorage.getItem("ut_streak") || "0", 10);
    const savedLast = localStorage.getItem("ut_last_write_day") || "";
    setStreak(Number.isFinite(savedStreak) ? savedStreak : 0);
    setLastWriteDay(savedLast);

    const alm = parseInt(localStorage.getItem("ut_autolock_min") || "0", 10);
    setAutoLockMin(Number.isFinite(alm) ? alm : 0);

    setBlurOnHidden(localStorage.getItem("ut_blur_hidden") !== "false");
    setLockOnHidden(localStorage.getItem("ut_lock_hidden") === "true");

    const nm = localStorage.getItem("ut_anon_name") || "Anonymous";
    setShareAnonName(nm);
  }, []);

  // ---------------- ONLINE/OFFLINE ----------------
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // ---------------- VISIBILITY (blur/lock) ----------------
  useEffect(() => {
    const onVis = () => {
      const hiddenNow = document.hidden;
      setPageHidden(hiddenNow);
      if (hiddenNow && pinEnabled && lockOnHidden && !locked) {
        setLocked(true);
        setPinInput("");
      }
    };
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => document.removeEventListener("visibilitychange", onVis);
    // ✅ removed `locked` from deps (cleaner)
  }, [pinEnabled, lockOnHidden]);

  // ---------------- AUTH LISTENER ----------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // ---------------- FIRESTORE: USER THOUGHTS ----------------
  useEffect(() => {
    if (!user) {
      setThoughts([]);
      return;
    }

    setThoughtsLoading(true);

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

  // ---------------- FIRESTORE: PUBLIC FEED (Level 17) ----------------
  useEffect(() => {
    if (!user) {
      setPublicPosts([]);
      return;
    }

    setPublicLoading(true);

    const q = query(collection(db, "publicThoughts"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPublicPosts(data.slice(0, 30));
        setPublicLoading(false);
      },
      (err) => {
        console.error(err);
        setPublicLoading(false);
        showToast("Public feed error (rules/index).");
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

  // ---------------- PIN & AUTOLOCK ----------------
  const clearAutoLockTimer = () => {
    if (lockTimer.current) clearTimeout(lockTimer.current);
    lockTimer.current = null;
  };

  const scheduleAutoLock = () => {
    clearAutoLockTimer();
    if (!pinEnabled || locked) return;
    if (!autoLockMin || autoLockMin <= 0) return;
    lockTimer.current = setTimeout(() => {
      setLocked(true);
      setPinInput("");
      showToast("Auto-locked 🔒");
    }, autoLockMin * 60 * 1000);
  };

  useEffect(() => {
    if (!pinEnabled || locked) return;

    const kick = () => scheduleAutoLock();
    const opts = { passive: true };

    scheduleAutoLock();
    window.addEventListener("mousemove", kick, opts);
    window.addEventListener("keydown", kick);
    window.addEventListener("click", kick, opts);
    window.addEventListener("touchstart", kick, opts);

    return () => {
      clearAutoLockTimer();
      window.removeEventListener("mousemove", kick, opts);
      window.removeEventListener("keydown", kick);
      window.removeEventListener("click", kick, opts);
      window.removeEventListener("touchstart", kick, opts);
    };
  }, [pinEnabled, locked, autoLockMin]);

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
      scheduleAutoLock();
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

  const setAutoLock = () => {
    const val = prompt("Auto-lock after minutes (0 = off):", String(autoLockMin));
    if (val === null) return;
    const n = Math.max(0, parseInt(val, 10) || 0);
    setAutoLockMin(n);
    localStorage.setItem("ut_autolock_min", String(n));
    showToast(n === 0 ? "Auto-lock off" : `Auto-lock: ${n} min`);
  };

  const toggleBlurHidden = () => {
    const next = !blurOnHidden;
    setBlurOnHidden(next);
    localStorage.setItem("ut_blur_hidden", String(next));
    showToast(next ? "Blur on tab switch: ON" : "Blur on tab switch: OFF");
  };

  const toggleLockHidden = () => {
    const next = !lockOnHidden;
    setLockOnHidden(next);
    localStorage.setItem("ut_lock_hidden", String(next));
    showToast(next ? "Lock on tab switch: ON" : "Lock on tab switch: OFF");
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
      archived: false,
      pinned: false,
      trashed: false, // ✅ Level 18
    };

    const lines = reflections[mood];
    if (lines) {
      const random = lines[Math.floor(Math.random() * lines.length)];
      setReflection(random);
    }

    try {
      await addDoc(collection(db, "thoughts"), payload);
      setText("");

      const today = ymd();
      const prev = lastWriteDay;

      if (prev !== today) {
        const yesterday = ymd(Date.now() - 86400000);
        const nextStreak = prev === yesterday ? streak + 1 : 1;

        setStreak(nextStreak);
        setLastWriteDay(today);

        localStorage.setItem("ut_streak", String(nextStreak));
        localStorage.setItem("ut_last_write_day", today);

        showToast(`Saved ✅  •  Streak: ${nextStreak}🔥`);
      } else {
        showToast("Saved ✅");
      }
    } catch (e) {
      console.error(e);
      showToast("Could not save. Check Firestore rules.");
    } finally {
      setSaving(false);
    }
  };

  // ✅ Level 18: Move to trash (instead of delete)
  const moveToTrash = async (t) => {
    try {
      await updateDoc(doc(db, "thoughts", t.id), {
        trashed: true,
        // optional: store when trashed
        trashedAt: serverTimestamp(),
      });
      showToast("Moved to Trash 🗑️");
    } catch (e) {
      console.error(e);
      showToast("Trash failed");
    }
  };

  // ✅ Restore from trash
  const restoreFromTrash = async (t) => {
    try {
      await updateDoc(doc(db, "thoughts", t.id), {
        trashed: false,
        trashedAt: null,
      });
      showToast("Restored ✅");
    } catch (e) {
      console.error(e);
      showToast("Restore failed");
    }
  };

  // ✅ Delete forever (only used in Trash view)
  const deleteForever = async (t) => {
    const ok = window.confirm("Delete forever? This cannot be undone.");
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "thoughts", t.id));
      showToast("Deleted forever");
    } catch (e) {
      console.error(e);
      showToast("Delete failed");
    }
  };

  // ✅ Release becomes gentle trash (animation + trash)
  const releaseThought = async (t) => {
    setReleasingId(t.id);
    setTimeout(async () => {
      await moveToTrash(t);
      setReleasingId(null);
    }, 450);
  };

  const toggleArchive = async (t) => {
    try {
      await updateDoc(doc(db, "thoughts", t.id), { archived: !t.archived });
      showToast(!t.archived ? "Archived" : "Unarchived");
    } catch (e) {
      console.error(e);
      showToast("Archive failed");
    }
  };

  const togglePinned = async (t) => {
    try {
      await updateDoc(doc(db, "thoughts", t.id), { pinned: !t.pinned });
      showToast(!t.pinned ? "Pinned ⭐" : "Unpinned");
    } catch (e) {
      console.error(e);
      showToast("Pin failed");
    }
  };

  const copyThought = async (t) => {
    const content = `${t.text}\n\nMood: ${t.mood || ""}\nTime: ${formatTime(t.createdAt) || ""}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
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

  const exportJSON = () => {
    const clean = thoughts.map((t) => ({
      id: t.id,
      text: t.text || "",
      mood: t.mood || "",
      archived: !!t.archived,
      pinned: !!t.pinned,
      trashed: !!t.trashed,
      createdAt: formatTime(t.createdAt) || "",
      uid: t.uid || "",
    }));

    const blob = new Blob([JSON.stringify(clean, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "unspoken_thoughts_backup.json";
    a.click();
    URL.revokeObjectURL(url);

    showToast("Backup downloaded 📥");
  };

  const exportTXT = () => {
    const lines = thoughts
      .slice()
      .reverse()
      .map((t) => {
        const time = formatTime(t.createdAt) || "";
        const m = t.mood ? `${moodEmoji[t.mood] || ""} ${t.mood}` : "";
        return `— ${time}\n${m}\n${t.text || ""}\n`;
      });

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "unspoken_thoughts.txt";
    a.click();
    URL.revokeObjectURL(url);
    showToast("TXT exported 📄");
  };

  // ✅ Level 18: Import JSON
  const openImport = () => fileInputRef.current?.click();

  const onImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-import same file
    if (!file) return;

    if (!user) return showToast("Please login first");

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        return showToast("Invalid file (expected an array)");
      }

      // import max 200 to keep it safe
      const items = data.slice(0, 200);

      let okCount = 0;
      for (const it of items) {
        const t = (it?.text ?? "").toString().trim();
        if (!t) continue;

        const moodKey = MOODS.some((m) => m.key === it?.mood) ? it.mood : "Calm";

        await addDoc(collection(db, "thoughts"), {
          uid: user.uid,
          text: t.slice(0, 500),
          mood: moodKey,
          archived: !!it?.archived,
          pinned: !!it?.pinned,
          trashed: !!it?.trashed,
          createdAt: serverTimestamp(), // keep simple + consistent
        });

        okCount += 1;
      }

      showToast(`Imported ${okCount} ✅`);
    } catch (err) {
      console.error(err);
      showToast("Import failed (bad JSON?)");
    }
  };

  const clearFilters = () => {
    setSearch("");
    setFilterMood("All");
    showToast("Cleared");
  };

  // ---------------- LEVEL 17: SHARE / REPORT ----------------
  const saveAnonName = (name) => {
    const n = (name || "").trim() || "Anonymous";
    setShareAnonName(n);
    localStorage.setItem("ut_anon_name", n);
    showToast("Anon name saved");
  };

  const shareToPublic = async (t) => {
    try {
      await addDoc(collection(db, "publicThoughts"), {
        text: t.text || "",
        mood: t.mood || "Calm",
        createdAt: serverTimestamp(),
        ownerUid: user.uid,
        anonName: shareAnonName || "Anonymous",
        reportCount: 0,
      });
      showToast("Shared anonymously 🌍");
    } catch (e) {
      console.error(e);
      showToast("Share failed (rules).");
    }
  };

  const reportPublic = async (p) => {
    try {
      await updateDoc(doc(db, "publicThoughts", p.id), { reportCount: increment(1) });
      showToast("Reported. Thanks.");
    } catch (e) {
      console.error(e);
      showToast("Report failed.");
    }
  };

  const deleteMyPublic = async (p) => {
    const ok = window.confirm("Delete your shared post?");
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "publicThoughts", p.id));
      showToast("Deleted from public");
    } catch (e) {
      console.error(e);
      showToast("Delete failed.");
    }
  };

  // ---------------- FILTERED & SORTED ----------------
  const filteredThoughts = useMemo(() => {
    const s = search.trim().toLowerCase();

    const list = thoughts.filter((t) => {
      const isTrashed = !!t.trashed;

      // ✅ Trash filter (Level 18)
      if (showTrash) {
        if (!isTrashed) return false;
      } else {
        if (isTrashed) return false;
      }

      const archiveOk = showArchived ? true : !t.archived;
      const moodOk = filterMood === "All" || t.mood === filterMood;
      const textOk = !s || (t.text || "").toLowerCase().includes(s);
      return archiveOk && moodOk && textOk;
    });

    // Pinned first (only for non-trash view)
    if (showTrash) return list;

    const pinned = list.filter((t) => !!t.pinned);
    const normal = list.filter((t) => !t.pinned);
    return [...pinned, ...normal];
  }, [thoughts, filterMood, search, showArchived, showTrash]);

  // ---------------- MOOD INSIGHTS (bars) ----------------
  const moodCounts = useMemo(() => {
    const counts = Object.fromEntries(MOODS.map((m) => [m.key, 0]));
    for (const t of filteredThoughts) {
      if (counts[t.mood] !== undefined) counts[t.mood] += 1;
    }
    return counts;
  }, [filteredThoughts]);

  const maxCount = useMemo(() => Math.max(1, ...Object.values(moodCounts)), [moodCounts]);

  // ---------------- MOOD TRACKER (Last 14 days) ----------------
  const moodTracker = useMemo(() => {
    const byDay = {};
    for (const t of thoughts) {
      if (t.trashed) continue; // ✅ ignore trashed thoughts for tracker
      const k = dateKeyFromCreatedAt(t.createdAt);
      if (!k) continue;
      if (!byDay[k]) byDay[k] = t.mood || "Calm";
    }

    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = ymd(d);
      const moodKey = byDay[key] || null;
      days.push({
        key,
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
        mood: moodKey,
        emoji: moodKey ? moodEmoji[moodKey] : "—",
      });
    }
    return days;
  }, [thoughts]);

  const reminder = useMemo(() => {
    const i = Math.floor(Date.now() / 60000) % reminders.length;
    return reminders[i];
  }, []);

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
          <div className="ut-card ut-card-pad ut-center">
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
                <div className="ut-sub">Write. Breathe. Save what matters. Release what doesn’t.</div>
              </div>
            </div>

            <div className="ut-card ut-card-pad">
              <div className="ut-tabs">
                <button className={`ut-tab ${mode === "login" ? "is-active" : ""}`} onClick={() => setMode("login")}>
                  Login
                </button>
                <button className={`ut-tab ${mode === "signup" ? "is-active" : ""}`} onClick={() => setMode("signup")}>
                  Sign up
                </button>
              </div>

              <label className="ut-label">Email</label>
              <input className="ut-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />

              <label className="ut-label">Password</label>
              <input className="ut-input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" />

              {authErr ? <div className="ut-error">{authErr}</div> : null}

              <button className="ut-btn ut-btn-primary" onClick={doEmail}>
                {mode === "signup" ? "Create account" : "Login"}
              </button>

              <div className="ut-divider" />

              <button className="ut-btn ut-btn-ghost" onClick={doGoogle}>
                Continue with Google
              </button>
            </div>

            <div className="ut-card ut-card-pad ut-reminder">
              <div className="ut-reminder-title">Tiny reminder</div>
              <div className="ut-reminder-quote">“{reminder}”</div>
            </div>
          </div>
        </div>

        {toast ? <div className="ut-toast">{toast}</div> : null}
      </main>
    );
  }

  // ---------------- UI: PIN LOCK SCREEN ----------------
  if (pinEnabled && locked) {
    return (
      <main className={`ut-page ${theme === "light" ? "ut-light" : ""}`}>
        <div className="ut-shell">
          <div className="ut-card ut-card-pad ut-center" style={{ maxWidth: 520 }}>
            <div className="ut-title">🔐 Private Space</div>
            <div className="ut-sub">Enter your device PIN to open Unspoken Thoughts.</div>

            <input className="ut-input" type="password" value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="Enter PIN" />

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

  const blurWrapStyle =
    blurOnHidden && pageHidden
      ? { filter: "blur(10px)", opacity: 0.65, pointerEvents: "none", userSelect: "none" }
      : {};

  return (
    <main className={`ut-page ${theme === "light" ? "ut-light" : ""}`}>
      {/* ✅ hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={onImportFile}
      />

      <div className="ut-shell" style={blurWrapStyle}>
        {/* HEADER */}
        <div className="ut-header">
          <div className="ut-brand">
            <div className="ut-logo">✨</div>
            <div>
              <div className="ut-title">Unspoken Thoughts</div>
              <div className="ut-sub">Write. Breathe. Save what matters. Release what doesn’t.</div>
            </div>
          </div>

          <div className="ut-actions">
            <div className="ut-pill">{isOnline ? "🟢 Online" : "🟠 Offline"}</div>
            <div className="ut-pill">
              🔥 Streak: <b>{streak}</b>
            </div>
            <div className="ut-pill">
              Signed in as <b>{user.email || "User"}</b>
            </div>

            <button className="ut-btn ut-btn-ghost" onClick={toggleTheme}>
              {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
            </button>

            {/* ✅ Level 18: Trash toggle */}
            <button className="ut-btn ut-btn-ghost" onClick={() => setShowTrash((v) => !v)}>
              {showTrash ? "⬅️ Back" : "🗑️ Trash"}
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
                <button className="ut-btn ut-btn-ghost" onClick={setAutoLock}>
                  ⏱️ Auto-lock
                </button>
                <button className="ut-btn ut-btn-ghost" onClick={toggleLockHidden}>
                  {lockOnHidden ? "🔐 Lock on tab: ON" : "🔐 Lock on tab: OFF"}
                </button>
                <button className="ut-btn ut-btn-ghost" onClick={toggleBlurHidden}>
                  {blurOnHidden ? "🙈 Blur on tab: ON" : "🙈 Blur on tab: OFF"}
                </button>
                <button className="ut-btn ut-btn-ghost" onClick={disablePin}>
                  🔓 Disable PIN
                </button>
              </>
            )}

            <button className="ut-btn ut-btn-ghost" onClick={exportJSON}>
              📥 Export JSON
            </button>
            <button className="ut-btn ut-btn-ghost" onClick={exportTXT}>
              📄 Export TXT
            </button>
            <button className="ut-btn ut-btn-ghost" onClick={openImport}>
              📤 Import JSON
            </button>

            <button className="ut-btn ut-btn-primary" onClick={doLogout}>
              Logout
            </button>
          </div>
        </div>

        {/* GRID */}
        <div className="ut-grid">
          {/* LEFT: Composer */}
          <div className="ut-card ut-card-pad ut-card-big">
            <div className="ut-card-title">Today</div>
            <div className="ut-prompt">“{dailyPrompt}”</div>

            <div className="ut-mini" style={{ marginTop: 10 }}>
              Quick templates
            </div>
            <div className="ut-templates">
              {QUICK_TEMPLATES.map((t) => (
                <button
                  key={t}
                  className="ut-template"
                  onClick={() => setText((prev) => (prev ? prev + "\n" : "") + t + " ")}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="ut-row ut-row-gap" style={{ marginTop: 14 }}>
              <select className="ut-input" value={mood} onChange={(e) => setMood(e.target.value)}>
                {MOODS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.key} {m.emoji}
                  </option>
                ))}
              </select>

              <input className="ut-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your thoughts..." />
            </div>

            <textarea className="ut-textarea" rows={6} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write what you’re feeling..." />
            <div className="ut-right ut-mini">{text.length}/500</div>

            {reflection ? <div className="ut-reflection">{reflection}</div> : null}

            <div className="ut-row ut-row-wrap" style={{ marginTop: 10 }}>
              <button className="ut-btn ut-btn-primary" onClick={saveThought} disabled={saving}>
                {saving ? "Saving..." : "Save thought"}
              </button>

              <button className="ut-btn ut-btn-ghost" onClick={() => setText("")}>
                Clear
              </button>
              <button className="ut-btn ut-btn-ghost" onClick={clearFilters}>
                Clear filters
              </button>

              <div className="ut-spacer" />

              <select className="ut-input" value={filterMood} onChange={(e) => setFilterMood(e.target.value)} style={{ maxWidth: 180 }}>
                <option value="All">All</option>
                {MOODS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.key} {m.emoji}
                  </option>
                ))}
              </select>
            </div>

            <div className="ut-row ut-row-tight" style={{ marginTop: 10 }}>
              <label className="ut-mini" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                Show archived
              </label>
            </div>
          </div>

          {/* RIGHT: Mood insights + Tracker */}
          <div className="ut-card ut-card-pad">
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

            <div className="ut-divider" />

            <div className="ut-card-title">Mood tracker (14 days)</div>
            <div className="ut-tracker">
              {moodTracker.map((d) => (
                <div key={d.key} className="ut-day" title={`${d.key} • ${d.mood || "No entry"}`}>
                  <div className="ut-day-emoji">{d.emoji}</div>
                  <div className="ut-day-label">{d.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* LEFT: Thoughts list */}
          <div className="ut-card ut-card-pad ut-card-big">
            <div className="ut-card-title">{showTrash ? "Trash" : "Your thoughts"}</div>

            {thoughtsLoading ? (
              <div className="ut-empty">Loading your thoughts…</div>
            ) : filteredThoughts.length === 0 ? (
              <div className="ut-empty">
                {showTrash ? "Trash is empty." : "No thoughts yet. Write one above — it’ll appear here instantly."}
              </div>
            ) : (
              <div className="ut-list">
                {filteredThoughts.map((t) => (
                  <div
                    key={t.id}
                    className={`ut-item ${releasingId === t.id ? "is-releasing" : ""}`}
                    style={{
                      opacity: releasingId === t.id ? 0 : 1,
                      transform: releasingId === t.id ? "translateY(-8px)" : "none",
                      transition: "0.35s",
                    }}
                  >
                    <div className="ut-item-head">
                      <div className="ut-item-mood">
                        {(moodEmoji[t.mood] || "🫧")} {t.mood || "—"}
                        {!showTrash && t.pinned ? <span style={{ marginLeft: 10, opacity: 0.8 }}>⭐ Pinned</span> : null}
                        {!showTrash && t.archived ? <span style={{ marginLeft: 10, opacity: 0.7 }}>📦 Archived</span> : null}
                        {showTrash ? <span style={{ marginLeft: 10, opacity: 0.7 }}>🗑️ Trashed</span> : null}
                      </div>
                      <div className="ut-item-time">{formatTime(t.createdAt) || ""}</div>
                    </div>

                    <div className="ut-item-text">{t.text}</div>

                    <div className="ut-row ut-row-tight">
                      {showTrash ? (
                        <>
                          <button className="ut-btn ut-btn-ghost" onClick={() => restoreFromTrash(t)}>
                            ✅ Restore
                          </button>
                          <button className="ut-btn ut-btn-danger" onClick={() => deleteForever(t)}>
                            ❌ Delete forever
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="ut-btn ut-btn-ghost" onClick={() => togglePinned(t)}>
                            {t.pinned ? "⭐ Unpin" : "⭐ Pin"}
                          </button>

                          <button className="ut-btn ut-btn-ghost" onClick={() => copyThought(t)}>📋 Copy</button>

                          <button className="ut-btn ut-btn-ghost" onClick={() => toggleArchive(t)}>
                            {t.archived ? "↩️ Unarchive" : "📦 Archive"}
                          </button>

                          <button className="ut-btn ut-btn-ghost" onClick={() => shareToPublic(t)} title="Share anonymously to public feed">
                            🌍 Share
                          </button>

                          <button className="ut-btn ut-btn-ghost" onClick={() => releaseThought(t)} title="Gentle delete (to Trash)">
                            🌬️ Release
                          </button>

                          <button className="ut-btn ut-btn-danger" onClick={() => moveToTrash(t)} title="Move to Trash">
                            🗑️ Trash
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Public feed */}
          <div className="ut-card ut-card-pad ut-reminder">
            <div className="ut-card-title">Public feed</div>
            <div className="ut-mini">Anonymous support space (latest posts).</div>

            <div className="ut-row ut-row-wrap" style={{ marginTop: 10 }}>
              <input
                className="ut-input"
                value={shareAnonName}
                onChange={(e) => setShareAnonName(e.target.value)}
                placeholder="Anon name (e.g., NightSky)"
                style={{ maxWidth: 240 }}
              />
              <button className="ut-btn ut-btn-ghost" onClick={() => saveAnonName(shareAnonName)}>Save name</button>

              <label className="ut-mini" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input type="checkbox" checked={showPublicFeed} onChange={(e) => setShowPublicFeed(e.target.checked)} />
                Show feed
              </label>
            </div>

            <div className="ut-divider" />

            {!showPublicFeed ? (
              <div className="ut-empty">Public feed hidden.</div>
            ) : publicLoading ? (
              <div className="ut-empty">Loading public posts…</div>
            ) : publicPosts.length === 0 ? (
              <div className="ut-empty">No shared posts yet.</div>
            ) : (
              <div className="ut-list" style={{ marginTop: 10 }}>
                {publicPosts.map((p) => (
                  <div key={p.id} className="ut-item">
                    <div className="ut-item-head">
                      <div className="ut-item-mood">
                        {moodEmoji[p.mood] || "🫧"} {p.mood || "—"} • <span style={{ opacity: 0.8 }}>{p.anonName || "Anonymous"}</span>
                      </div>
                      <div className="ut-item-time">{formatTime(p.createdAt) || ""}</div>
                    </div>

                    <div className="ut-item-text">{p.text}</div>

                    <div className="ut-row ut-row-tight">
                      <button className="ut-btn ut-btn-ghost" onClick={() => reportPublic(p)}>
                        🚩 Report ({p.reportCount || 0})
                      </button>

                      {p.ownerUid === user.uid ? (
                        <button className="ut-btn ut-btn-danger" onClick={() => deleteMyPublic(p)}>
                          Delete mine
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Reminder */}
          <div className="ut-card ut-card-pad ut-reminder">
            <div className="ut-reminder-title">Tiny reminder</div>
            <div className="ut-reminder-quote">“{reminder}”</div>
          </div>
        </div>
      </div>

      {toast ? <div className="ut-toast">{toast}</div> : null}
    </main>
  );
}
