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

const MOOD_COLORS = {
  Happy:   "#6BCB8B",
  Sad:     "#7B9FD4",
  Angry:   "#D4836B",
  Calm:    "#7BA7D4",
  Excited: "#D4C46B",
  Anxious: "#B47BD4",
};

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);

  // Release ritual
  const [releaseActive, setReleaseActive] = useState(false);
  const [releasedText, setReleasedText] = useState("");
  const [releaseParticles, setReleaseParticles] = useState([]);

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

    if (hiddenNow && pinEnabled && lockOnHidden) {
      setLocked(true);
      setPinInput("");
    }
  };

  document.addEventListener("visibilitychange", onVis);
  onVis();

  return () => document.removeEventListener("visibilitychange", onVis);
}, [pinEnabled, lockOnHidden]);

  // Close settings on outside click
  useEffect(() => {
    const fn = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // ---------------- AUTH LISTENER ----------------
  // Close settings dropdown on outside click
  useEffect(() => {
    const fn = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

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

  // Release ritual — permanently deletes (not trash). Released = truly let go.
  const releaseThought = async (t) => {
    const particles = Array.from({ length: 26 }, (_, i) => ({
      id: i,
      x: 15 + Math.random() * 70,
      delay: Math.random() * 1.4,
      duration: 2.4 + Math.random() * 2.0,
      size: 3 + Math.random() * 9,
      opacity: 0.25 + Math.random() * 0.6,
      drift: (Math.random() - 0.5) * 160,
    }));

    setReleasedText(t.text || "");
    setReleaseParticles(particles);
    setReleaseActive(true);

    // Card blurs and floats away
    setTimeout(() => setReleasingId(t.id), 250);

    // Permanently delete — it's gone, truly released
    setTimeout(async () => {
      try {
        await deleteDoc(doc(db, "thoughts", t.id));
      } catch (e) {
        console.error(e);
      }
      setReleasingId(null);
    }, 550);

    // Overlay fades out
    setTimeout(() => {
      setReleaseActive(false);
      setReleasedText("");
    }, 3400);
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

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 5)  return { word: "Still awake?",     sub: "The quiet hours hold the deepest truths." };
    if (h < 12) return { word: "Good morning",      sub: "A new page. What do you want it to hold?" };
    if (h < 17) return { word: "Good afternoon",    sub: "Pause. Breathe. What's on your mind?" };
    if (h < 21) return { word: "Good evening",      sub: "The day is settling. What did it stir in you?" };
    return              { word: "Good night",        sub: "Let the day go. Write it down first." };
  };
  const greeting = getGreeting();

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
        <div className="ut-bg-orbs" aria-hidden="true">
          <div className="ut-orb ut-orb-1" /><div className="ut-orb ut-orb-2" />
          <div className="ut-orb ut-orb-3" /><div className="ut-orb ut-orb-4" />
          <div className="ut-orb ut-orb-5" />
        </div>

        <div className="ut-auth-page">
          {/* Left — brand poem */}
          <div className="ut-auth-left">
            <div className="ut-auth-mark">✦</div>
            <h1 className="ut-auth-headline">
              A place for<br />
              <em>everything you<br />can't say aloud.</em>
            </h1>
            <p className="ut-auth-tagline">
              Write it. Save it. Release it.<br />
              No judgement. No audience. Just you.
            </p>
            <div className="ut-auth-features">
              <div className="ut-auth-feature"><span>✦</span> Private thoughts, yours alone</div>
              <div className="ut-auth-feature"><span>🌬️</span> Release what you no longer need</div>
              <div className="ut-auth-feature"><span>🔥</span> Build a daily writing streak</div>
              <div className="ut-auth-feature"><span>🌙</span> Track your mood across 14 days</div>
            </div>
            <blockquote className="ut-auth-quote">"{reminder}"</blockquote>
          </div>

          {/* Right — form */}
          <div className="ut-auth-right">
            <div className="ut-auth-form-wrap">
              <div className="ut-auth-form-title">
                {mode === "login" ? "Welcome back." : "Start your journey."}
              </div>
              <div className="ut-auth-form-sub">
                {mode === "login"
                  ? "Your thoughts have been waiting."
                  : "Everything you write stays private, always."}
              </div>

              <div className="ut-tabs" style={{ marginTop: 22 }}>
                <button className={`ut-tab ${mode === "login" ? "is-active" : ""}`} onClick={() => setMode("login")}>Sign in</button>
                <button className={`ut-tab ${mode === "signup" ? "is-active" : ""}`} onClick={() => setMode("signup")}>Create account</button>
              </div>

              <label className="ut-label" style={{ marginTop: 18 }}>Email</label>
              <input className="ut-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />

              <label className="ut-label">Password</label>
              <input className="ut-input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && doEmail()} />

              {authErr ? <div className="ut-error">{authErr}</div> : null}

              <button className="ut-btn ut-btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={doEmail}>
                {mode === "signup" ? "Begin writing →" : "Open my journal →"}
              </button>

              <div className="ut-dividerText" style={{ margin: "16px 0" }}><span>or</span></div>

              <button className="ut-btn ut-btn-ghost" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }} onClick={doGoogle}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <p className="ut-auth-privacy">Private by design. We never read or sell your thoughts.</p>
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
      {/* ── AMBIENT BACKGROUND ORBS ── */}
      <div className="ut-bg-orbs" aria-hidden="true">
        <div className="ut-orb ut-orb-1" />
        <div className="ut-orb ut-orb-2" />
        <div className="ut-orb ut-orb-3" />
        <div className="ut-orb ut-orb-4" />
        <div className="ut-orb ut-orb-5" />
      </div>

      {/* ── RELEASE RITUAL OVERLAY ── */}
      {releaseActive && (
        <div className="ut-release-overlay" aria-live="polite">
          {/* Particles floating up */}
          {releaseParticles.map((p) => (
            <div
              key={p.id}
              className="ut-release-particle"
              style={{
                left: `${p.x}%`,
                width: p.size,
                height: p.size,
                opacity: p.opacity,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
                "--drift": `${p.drift}px`,
              }}
            />
          ))}

          {/* Central moment */}
          <div className="ut-release-center">
            <div className="ut-release-breath" />
            <div className="ut-release-icon">🌬️</div>
            {releasedText && (
              <div className="ut-release-thought">
                "{releasedText.length > 80 ? releasedText.slice(0, 80) + "…" : releasedText}"
              </div>
            )}
            <div className="ut-release-msg">Let it go.</div>
            <div className="ut-release-sub">You don't have to carry this anymore.</div>
          </div>
        </div>
      )}

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
          {/* Logo */}
          <div className="ut-brandRow">
            <div className="ut-logo">✦</div>
            <div>
              <div className="ut-title">Unspoken Thoughts</div>
              <div className="ut-sub">Write. Breathe. Save what matters.</div>
            </div>
          </div>

          {/* Status pills */}
          <div className="ut-row" style={{ gap: 8 }}>
            <div className={`ut-pill ${isOnline ? "ut-pill-online" : ""}`}>
              {isOnline ? " Online" : "○ Offline"}
            </div>
            <div className="ut-pill ut-pill-streak">🔥 {streak} day{streak !== 1 ? "s" : ""}</div>
            <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "monospace" }}>
              {user.email || "User"}
            </span>
          </div>

          {/* Controls */}
          <div className="ut-actions">
            <button className="ut-btn ut-btn-ghost" onClick={toggleTheme} style={{ padding: "7px 12px" }}>
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <button className="ut-btn ut-btn-ghost" onClick={() => setShowTrash((v) => !v)}>
              {showTrash ? "← Back" : "🗑️ Trash"}
            </button>

            {/* Settings dropdown */}
            <div style={{ position: "relative" }} ref={settingsRef}>
              <button
                className="ut-btn ut-btn-ghost"
                onClick={() => setSettingsOpen((v) => !v)}
              >
                ⚙️ Settings
              </button>
              {settingsOpen && (
                <div className="ut-settings-dropdown">
                  {!pinEnabled ? (
                    <button className="ut-settings-item" onClick={() => { enablePin(); setSettingsOpen(false); }}>🔐 Enable PIN</button>
                  ) : (
                    <>
                      <button className="ut-settings-item" onClick={() => { lockNow(); setSettingsOpen(false); }}>🔒 Lock now</button>
                      <button className="ut-settings-item" onClick={() => { setAutoLock(); }}>⏱️ Auto-lock ({autoLockMin || "off"})</button>
                      <button className="ut-settings-item" onClick={() => { toggleLockHidden(); }}>{lockOnHidden ? "🔐 Lock on tab: ON" : "🔐 Lock on tab: OFF"}</button>
                      <button className="ut-settings-item" onClick={() => { toggleBlurHidden(); }}>{blurOnHidden ? "🙈 Blur on tab: ON" : "🙈 Blur on tab: OFF"}</button>
                      <button className="ut-settings-item" onClick={() => { disablePin(); setSettingsOpen(false); }}>🔓 Disable PIN</button>
                      <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />
                    </>
                  )}
                  <button className="ut-settings-item" onClick={() => { exportJSON(); setSettingsOpen(false); }}>📥 Export JSON</button>
                  <button className="ut-settings-item" onClick={() => { exportTXT(); setSettingsOpen(false); }}>📄 Export TXT</button>
                  <button className="ut-settings-item" onClick={() => { openImport(); setSettingsOpen(false); }}>📤 Import JSON</button>
                  <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />
                  <button className="ut-settings-item danger" onClick={() => { doLogout(); setSettingsOpen(false); }}>🚪 Logout</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* HERO — daily ritual section */}
        {!showTrash && (
          <div className="ut-hero">
            <div className="ut-hero-eyebrow">
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </div>
            <h1 className="ut-hero-title">
              {greeting.word},<br />
              <em>how are you feeling?</em>
            </h1>
            <p className="ut-hero-sub">{greeting.sub}</p>

            <div className="ut-hero-stats">
              {streak > 0 && (
                <div className="ut-hero-stat ut-hero-stat-streak">
                  <span className="ut-hero-stat-num">{streak}</span>
                  <span className="ut-hero-stat-label">day streak 🔥</span>
                </div>
              )}
              <div className="ut-hero-stat">
                <span className="ut-hero-stat-num">{thoughts.filter(t => !t.trashed).length}</span>
                <span className="ut-hero-stat-label">thoughts saved</span>
              </div>
              <div className="ut-hero-stat">
                <span className="ut-hero-stat-num">{moodTracker.filter(d => d.mood).length}</span>
                <span className="ut-hero-stat-label">days tracked</span>
              </div>
            </div>

            <button
              className="ut-hero-cta"
              onClick={() => document.querySelector(".ut-textarea")?.focus()}
            >
              Write today's thought →
            </button>
          </div>
        )}

        <div className="ut-grid">
          {/* LEFT: Composer */}
          <div className="ut-card ut-card-pad ut-card-big">
            <div className="ut-composer-header">
              <div className="ut-composer-date">
                {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
              </div>
              <div className="ut-composer-prompt">✦ {dailyPrompt}</div>
            </div>

            <div className="ut-templates" style={{ marginTop: 12 }}>
              {QUICK_TEMPLATES.map((tpl) => (
                <button
                  key={tpl}
                  className="ut-template"
                  onClick={() => setText((prev) => (prev ? prev + "\n" : "") + tpl + " ")}
                >
                  {tpl}
                </button>
              ))}
            </div>

            {/* Mood pills */}
            <div className="ut-mood-pills">
              {MOODS.map((m) => (
                <button
                  key={m.key}
                  data-mood={m.key}
                  className={`ut-mood-pill${mood === m.key ? " is-active" : ""}`}
                  onClick={() => setMood(m.key)}
                  style={{ opacity: mood !== m.key ? 0.4 : 1 }}
                >
                  <span>{m.emoji}</span> {m.key}
                </button>
              ))}
            </div>

            <input
              className="ut-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍  Search your thoughts..."
              style={{ marginTop: 10 }}
            />

            <textarea
              className={`ut-textarea ut-textarea-mood-${mood}`}
              rows={6}
              maxLength={500}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write what you're feeling..."
              style={{ marginTop: 12 }}
            />
            <div className={`ut-char-count${text.length > 450 ? text.length >= 500 ? " at-limit" : " near-limit" : ""}`}>
              {text.length}/500
            </div>

            {reflection ? <div className="ut-reflection">{reflection}</div> : null}

            <div className="ut-row ut-row-wrap" style={{ marginTop: 10 }}>
              <button
                className="ut-btn ut-btn-primary"
                onClick={saveThought}
                disabled={saving}
                style={saving ? { opacity: 0.75, transform: "scale(0.97)" } : {}}
              >
                {saving ? "✦ Saving…" : "Save thought"}
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
                  <div key={m.key} className="ut-chart-row" data-mood={m.key}>
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
                    data-mood={t.mood}
                    className={`ut-item ${releasingId === t.id ? "is-releasing" : ""}`}
                    style={{
                      opacity: releasingId === t.id ? 0 : 1,
                      transform: releasingId === t.id ? "translateY(-30px) scale(0.94)" : "none",
                      filter: releasingId === t.id ? "blur(4px)" : "none",
                      transition: releasingId === t.id ? "all 0.55s cubic-bezier(0.4,0,0.2,1)" : "0.35s",
                      borderLeftColor: MOOD_COLORS[t.mood] || "var(--border)",
                      pointerEvents: releasingId === t.id ? "none" : "auto",
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

                          <button className="ut-btn ut-btn-release" onClick={() => releaseThought(t)} title="Release — permanently let go">
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