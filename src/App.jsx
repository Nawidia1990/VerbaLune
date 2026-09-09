import React, { useState, useRef, useEffect } from "react";
import {
  Home, Map, BookOpen, MessageCircle, Dumbbell, Layers, TrendingUp,
  Users, Settings, Mic, Volume2, VolumeX, Play, Pause, RotateCcw, Check, X,
  ChevronRight, ChevronLeft, Flame, Star, Award, Clock, Send,
  Globe, ArrowRight, Bookmark, RefreshCw, Loader2, LogOut, Download,
  KeyRound, Pencil, BookMarked
} from "lucide-react";
import { auth, db, googleProvider } from "./firebase.js";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProvider,
  deleteUser,
  getAdditionalUserInfo,
  signOut,
} from "firebase/auth";
import { doc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";

/* ────────────────────────────────────────────────────────────
   DESIGN TOKENS — v2, brighter & more energetic
   Indigo ink   #241943  – depth, structure, nav
   Coral        #FF5D5D  – motivation, primary action
   Violet       #8B5CF6  – creativity, tutor accents
   Teal         #00CEC0  – progress, growth
   Gold         #FFB627  – delight, streaks, rewards
   Cream        #FFF9F2  – warm background
   ──────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────
   TEXT-TO-SPEECH — respects the user's Voice & Accent preference
   from Profile & Settings (persisted to Firestore, applied here
   via a lightweight module-level setting rather than prop-drilling
   it through every component that speaks a word aloud).
   ──────────────────────────────────────────────────────────── */

const ACCENT_LANG_MAP = {
  "Canadian / Québécois French": "fr-CA",
  "France French": "fr-FR",
  "Neutral international French": "fr-FR",
};

let currentSpeechLang = "fr-CA";
let currentVoiceGenderHint = "Female";

// Chrome/Edge load available voices asynchronously — this warms the list up
// early so the very first speak() call has a chance of finding a real match.
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

function setSpeechPrefs(accentLabel, voiceLabel) {
  if (accentLabel) currentSpeechLang = ACCENT_LANG_MAP[accentLabel] || "fr-FR";
  if (voiceLabel) currentVoiceGenderHint = voiceLabel;
}

function pickVoice(lang, genderHint) {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const matching = voices.filter((v) => v.lang?.toLowerCase().startsWith(lang.split("-")[0].toLowerCase()));
  if (matching.length === 0) return null;
  // Exact lang match (e.g. fr-CA) preferred over a same-language-different-region fallback.
  const exact = matching.find((v) => v.lang?.toLowerCase() === lang.toLowerCase());
  const pool = exact ? [exact, ...matching.filter((v) => v !== exact)] : matching;
  if (genderHint && genderHint !== "Mixed") {
    // Best-effort only — the Web Speech API doesn't expose real gender metadata,
    // so this just checks common naming conventions and falls back gracefully.
    const hint = genderHint.toLowerCase();
    const byName = pool.find((v) => v.name.toLowerCase().includes(hint));
    if (byName) return byName;
  }
  return pool[0];
}

function speak(text, lang) {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const targetLang = lang || currentSpeechLang;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = targetLang;
    utter.rate = 0.95;
    const voice = pickVoice(targetLang, lang ? null : currentVoiceGenderHint);
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
  } catch (e) { /* speech synthesis unavailable */ }
}

/* ────────────────────────────────────────────────────────────
   CERTIFICATE — a real, downloadable PNG generated on-device
   with Canvas. No server, no PDF library — just an image file
   that actually lands on the user's computer.
   ──────────────────────────────────────────────────────────── */

function generateCertificatePNG({ name, level, levelName, score, date, certId }) {
  const canvas = document.createElement("canvas");
  const W = 1400, H = 990;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#FFF9F2";
  ctx.fillRect(0, 0, W, H);

  // Soft corner washes
  const grad1 = ctx.createRadialGradient(W * 0.9, H * 0.05, 0, W * 0.9, H * 0.05, 500);
  grad1.addColorStop(0, "rgba(139,92,246,0.10)");
  grad1.addColorStop(1, "rgba(139,92,246,0)");
  ctx.fillStyle = grad1;
  ctx.fillRect(0, 0, W, H);
  const grad2 = ctx.createRadialGradient(W * 0.08, H * 0.95, 0, W * 0.08, H * 0.95, 500);
  grad2.addColorStop(0, "rgba(255,93,93,0.09)");
  grad2.addColorStop(1, "rgba(255,93,93,0)");
  ctx.fillStyle = grad2;
  ctx.fillRect(0, 0, W, H);

  // Outer border
  ctx.strokeStyle = "#EEE1D4";
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, W - 48, H - 48);
  // Gold inner border
  ctx.strokeStyle = "rgba(255,182,39,0.55)";
  ctx.lineWidth = 2;
  ctx.strokeRect(46, 46, W - 92, H - 92);

  // Logo mark — crescent, matching the app's mark
  const cx = W / 2, cy = 150, r = 46;
  const logoGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  logoGrad.addColorStop(0, "#FF4E50");
  logoGrad.addColorStop(0.52, "#FF3DAE");
  logoGrad.addColorStop(1, "#7C3AED");
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0.35 * Math.PI, 1.85 * Math.PI, false);
  ctx.arc(cx + r * 0.32, cy, r * 0.78, 1.7 * Math.PI, 0.55 * Math.PI, true);
  ctx.closePath();
  ctx.fillStyle = logoGrad;
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx + r * 0.62, cy - r * 0.55, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#FFC93C";
  ctx.fill();

  ctx.textAlign = "center";

  // Eyebrow
  ctx.fillStyle = "#665F7A";
  ctx.font = "600 20px Arial, sans-serif";
  ctx.fillText("V E R B A L U N E   ·   C E R T I F I C A T E   O F   C O M P L E T I O N", cx, 250);

  // "This certifies that"
  ctx.fillStyle = "#665F7A";
  ctx.font = "22px Georgia, serif";
  ctx.fillText("This certifies that", cx, 320);

  // Name
  ctx.fillStyle = "#241943";
  ctx.font = "700 64px Georgia, serif";
  ctx.fillText(name, cx, 410);

  // Description line
  ctx.fillStyle = "#665F7A";
  ctx.font = "24px Georgia, serif";
  ctx.fillText(`has successfully completed Level ${level} — ${levelName}`, cx, 470);
  ctx.fillText(`of the VerbaLune French course, achieving an overall score of ${score}%.`, cx, 505);

  // Date / Cert ID row
  ctx.font = "600 18px Arial, sans-serif";
  ctx.fillStyle = "#241943";
  ctx.textAlign = "left";
  ctx.fillText(date, cx - 260, 620);
  ctx.fillText(certId, cx + 60, 620);
  ctx.font = "14px Arial, sans-serif";
  ctx.fillStyle = "#665F7A";
  ctx.fillText("DATE", cx - 260, 590);
  ctx.fillText("CERTIFICATE ID", cx + 60, 590);

  // Disclaimer
  ctx.textAlign = "center";
  ctx.font = "16px Arial, sans-serif";
  ctx.fillStyle = "#665F7A";
  wrapCanvasText(
    ctx,
    "This is a VerbaLune course-completion certificate, not an official government or accredited CEFR qualification.",
    cx, 900, 760, 22
  );

  return canvas.toDataURL("image/png");
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "", lines = [];
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word + " ";
    } else {
      line = test;
    }
  }
  lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l.trim(), x, y + i * lineHeight));
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* ────────────────────────────────────────────────────────────
   FIRESTORE PERSISTENCE — real, per-account, cross-device.
   Replaces the earlier localStorage version. Each signed-in user
   gets one document at users/{uid} holding their app data.
   ──────────────────────────────────────────────────────────── */

const DEFAULT_USER_DATA = {
  isPremium: false,
  reviewedMistakes: [3],
  completedLessons: [],
  learningLanguage: "French",
  currentLevel: "A1",
  learningGoal: "",
  dailyGoalMinutes: "10 minutes",
  focusSkill: "",
  voicePref: "Female",
  accentPref: "Canadian / Québécois French",
};

function useUserData(uid) {
  const [data, setData] = useState(DEFAULT_USER_DATA);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setData(DEFAULT_USER_DATA);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setData({ ...DEFAULT_USER_DATA, ...snap.data() });
        } else {
          // First time this user has ever logged in — create their document.
          setDoc(ref, DEFAULT_USER_DATA).catch((e) => console.error("Firestore init failed:", e));
          setData(DEFAULT_USER_DATA);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Firestore read failed:", err);
        setLoading(false);
      }
    );
    return unsub;
  }, [uid]);

  const updateData = (partial) => {
    setData((cur) => ({ ...cur, ...partial })); // optimistic local update — feels instant
    if (uid) {
      setDoc(doc(db, "users", uid), partial, { merge: true }).catch((e) =>
        console.error("Firestore write failed:", e)
      );
    }
  };

  return [data, updateData, loading];
}

function Logo({ size = 28, ring = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ flexShrink: 0, filter: "drop-shadow(0 3px 8px rgba(255,61,158,0.35))" }}>
      <defs>
        <linearGradient id="vlLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF4E50" />
          <stop offset="52%" stopColor="#FF3DAE" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      {ring && <circle cx="50" cy="50" r="47" fill="none" stroke="url(#vlLogoGrad)" strokeOpacity="0.25" strokeWidth="4" />}
      <path d="M60 6 A44 44 0 1 0 60 94 A34 34 0 1 1 60 6 Z" fill="url(#vlLogoGrad)" />
      <circle cx="76" cy="26" r="7" fill="#FFC93C" />
    </svg>
  );
}

const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,440;9..144,560;9..144,650&family=Sora:wght@400;500;600;700&display=swap');

    .vl-root { 
      --navy:#241943; --navy-light:#3D2B6B;
      --coral:#FF5D5D; --coral-dark:#F03D3D;
      --lavender:#8B5CF6; --lavender-dark:#6D3FE0;
      --turq:#00CEC0; --turq-dark:#00A99C;
      --gold:#FFB627; --gold-dark:#F2A00E;
      --cream:#FFF9F2; --cream-dim:#FDEEDD;
      --ink:#241933; --ink-soft:#665F7A;
      --line:#EEE1D4;
      font-family:'Sora',sans-serif;
      background:var(--cream);
      color:var(--ink);
      min-height:100vh;
      width:100%;
    }
    .vl-serif { font-family:'Fraunces',serif; }
    .vl-root *{ box-sizing:border-box; }
    .vl-root button{ font-family:inherit; cursor:pointer; }
    .vl-scroll::-webkit-scrollbar{ width:6px; }
    .vl-scroll::-webkit-scrollbar-thumb{ background:var(--line); border-radius:4px; }
    .vl-btn-primary{
      background:linear-gradient(120deg, var(--coral), var(--gold));
      color:#fff; border:none; border-radius:12px;
      padding:13px 26px; font-weight:600; font-size:15px;
      box-shadow:0 6px 16px -6px rgba(255,93,93,0.55);
      transition:transform .15s ease, box-shadow .15s ease, filter .15s ease;
      display:inline-flex; align-items:center; gap:8px;
    }
    .vl-btn-primary:hover{ filter:brightness(1.06); transform:translateY(-1px); box-shadow:0 9px 20px -6px rgba(255,93,93,0.6); }
    .vl-btn-ghost{
      background:transparent; color:var(--navy); border:1.5px solid var(--navy);
      border-radius:12px; padding:11px 24px; font-weight:600; font-size:15px;
      display:inline-flex; align-items:center; gap:8px;
      transition:background .15s ease, color .15s ease;
    }
    .vl-btn-ghost:hover{ background:var(--navy); color:#fff; }
    .vl-btn-login{
      background:transparent; color:var(--navy); border:1.5px solid var(--navy);
      border-radius:12px; padding:11px 24px; font-weight:600; font-size:15px;
      transition:background .15s ease, color .15s ease, border-color .15s ease;
    }
    .vl-btn-login:hover{ background:var(--coral); border-color:var(--coral); color:#fff; }
    .vl-headline-grad{
      background:linear-gradient(100deg, #FF4E50 0%, #FF3DAE 45%, #7C3AED 90%);
      -webkit-background-clip:text; background-clip:text; color:transparent;
    }
    .vl-card{
      background:#fff; border:1px solid var(--line); border-radius:18px;
    }
    .vl-fade-in{ animation: vlFade .4s ease both; }
    @keyframes vlFade{ from{opacity:0; transform:translateY(6px);} to{opacity:1; transform:translateY(0);} }
    @media (prefers-reduced-motion: reduce){ .vl-fade-in{ animation:none; } }
  `}</style>
);

/* ────────────────────────────────────────────────────────────
   SAMPLE DATA
   ──────────────────────────────────────────────────────────── */

const UNITS = [
  { id: 1, title: "Introducing Yourself", level: "A1", lessons: 6, done: 6 },
  { id: 2, title: "Family & Relationships", level: "A1", lessons: 5, done: 5 },
  { id: 3, title: "Home & Daily Routines", level: "A1", lessons: 7, done: 4 },
  { id: 4, title: "Food & Restaurants", level: "A1", lessons: 6, done: 0 },
  { id: 5, title: "Shopping", level: "A2", lessons: 5, done: 0 },
  { id: 6, title: "Immigration & Settling In", level: "A2", lessons: 8, done: 0 },
  { id: 7, title: "Transportation", level: "A2", lessons: 5, done: 0 },
  { id: 8, title: "Travel & Hotels", level: "A2", lessons: 6, done: 0 },
  { id: 9, title: "Health & Medical Appointments", level: "B1", lessons: 6, done: 0 },
  { id: 10, title: "Work & Job Interviews", level: "B1", lessons: 7, done: 0 },
  { id: 11, title: "School & Education", level: "B1", lessons: 5, done: 0 },
  { id: 12, title: "Banking & Administration", level: "B1", lessons: 6, done: 0 },
  { id: 13, title: "Emotions & Opinions", level: "B2", lessons: 5, done: 0 },
  { id: 14, title: "News & Culture", level: "B2", lessons: 6, done: 0 },
  { id: 15, title: "Professional Communication", level: "B2", lessons: 7, done: 0 },
  { id: 16, title: "Debates & Advanced Discussions", level: "C1", lessons: 6, done: 0 },
];

const VOCAB = [
  { word: "le rendez-vous", pos: "n.m.", ipa: "/ʁɑ̃.de.vu/", en: "appointment", ex: "J'ai un rendez-vous chez le médecin." },
  { word: "accueillant", pos: "adj.", ipa: "/a.kœ.jɑ̃/", en: "welcoming", ex: "Cette ville est très accueillante." },
  { word: "se débrouiller", pos: "v.", ipa: "/sə de.bʁu.je/", en: "to manage / get by", ex: "Elle se débrouille bien en anglais." },
  { word: "quotidien", pos: "adj./n.m.", ipa: "/ko.ti.djɛ̃/", en: "daily / everyday life", ex: "Le café fait partie de mon quotidien." },
];

// English course, for French-speaking learners — mirrors VOCAB's shape,
// but "en" here holds the French translation rather than English.
const ENGLISH_VOCAB = [
  { word: "appointment", pos: "n.", ipa: "/əˈpɔɪntmənt/", en: "rendez-vous", ex: "I have an appointment with the doctor." },
  { word: "welcoming", pos: "adj.", ipa: "/ˈwɛlkəmɪŋ/", en: "accueillant", ex: "This city is very welcoming." },
  { word: "to manage / get by", pos: "v.", ipa: "/tə ˈmænɪdʒ/", en: "se débrouiller", ex: "She manages well in French." },
  { word: "daily life", pos: "n.", ipa: "/ˈdeɪli laɪf/", en: "la vie quotidienne", ex: "Coffee is part of my daily life." },
];

const SKILLS = [
  { name: "Reading", value: 78 }, { name: "Listening", value: 62 },
  { name: "Speaking", value: 55 }, { name: "Pronunciation", value: 60 },
  { name: "Writing", value: 70 }, { name: "Grammar", value: 74 },
  { name: "Conjugation", value: 58 }, { name: "Vocabulary", value: 81 },
];

/* ────────────────────────────────────────────────────────────
   SHARED BITS
   ──────────────────────────────────────────────────────────── */

const NAV_ITEMS = [
  { id: "dashboard", label: "Home", icon: Home },
  { id: "path", label: "Learning Path", icon: Map },
  { id: "practice", label: "Practice", icon: Dumbbell },
  { id: "vocabulary", label: "Vocabulary", icon: Layers },
  { id: "tutor", label: "AI Tutor", icon: MessageCircle },
  { id: "community", label: "Community Challenges", icon: Users },
  { id: "progress", label: "Progress", icon: TrendingUp },
  { id: "profile", label: "Profile & Settings", icon: Settings },
];

function SkillWheel({ skills, size = 220 }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 34;
  const pts = skills.map((s, i) => {
    const angle = (Math.PI * 2 * i) / skills.length - Math.PI / 2;
    const rad = (s.value / 100) * r;
    return [cx + rad * Math.cos(angle), cy + rad * Math.sin(angle)];
  });
  const outer = skills.map((_, i) => {
    const angle = (Math.PI * 2 * i) / skills.length - Math.PI / 2;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  });
  const poly = pts.map((p) => p.join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {[0.33, 0.66, 1].map((f) => (
        <polygon key={f}
          points={outer.map(([x, y]) => [cx + (x - cx) * f, cy + (y - cy) * f].join(",")).join(" ")}
          fill="none" stroke="var(--line)" strokeWidth="1" />
      ))}
      {outer.map(([x, y], i) => (
        <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)" strokeWidth="1" />
      ))}
      <polygon points={poly} fill="var(--turq)" fillOpacity="0.28" stroke="var(--turq-dark)" strokeWidth="2" />
      {outer.map(([x, y], i) => {
        const lx = cx + (x - cx) * 1.28, ly = cy + (y - cy) * 1.28;
        return (
          <text key={i} x={lx} y={ly} fontSize="10.5" fill="var(--ink-soft)"
            textAnchor="middle" dominantBaseline="middle" fontFamily="Sora">
            {skills[i].name}
          </text>
        );
      })}
    </svg>
  );
}

function ProgressRing({ value, size = 74, stroke = 8, color = "var(--coral)" }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--cream-dim)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={c - (value/100)*c} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: "stroke-dashoffset .6s ease" }} />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fontSize="16" fontWeight="700" fill="var(--navy)">
        {value}%
      </text>
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────
   LANDING
   ──────────────────────────────────────────────────────────── */

function Landing({ onSignup, onLogin, onPlacement }) {
  return (
    <div className="vl-fade-in" style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      backgroundImage: "radial-gradient(760px 420px at 88% -8%, rgba(139,92,246,0.16), transparent 60%), radial-gradient(620px 380px at 6% 8%, rgba(255,93,93,0.14), transparent 60%)"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 48px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Logo size={32} />
          <span className="vl-serif" style={{ fontSize: 21, fontWeight: 650, color: "var(--navy)" }}>VerbaLune</span>
        </div>
        <button className="vl-btn-login" onClick={onLogin}>Log in</button>
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 40, alignItems: "center", padding: "20px 48px 60px", maxWidth: 1180, margin: "0 auto" }}>
        <div>
          <div style={{ display: "inline-flex", gap: 8, alignItems: "center", background: "#fff", border: "1px solid var(--line)", borderRadius: 999, padding: "6px 14px", fontSize: 13, color: "var(--ink-soft)", marginBottom: 22 }}>
            <Globe size={14} color="var(--turq-dark)" /> English ⇄ Français, one guided path
          </div>
          <h1 className="vl-serif vl-headline-grad" style={{ fontSize: 52, lineHeight: 1.08, margin: "0 0 20px" }}>
            Your voice, your pace,<br />your journey.
          </h1>
          <p style={{ fontSize: 17, color: "var(--ink-soft)", lineHeight: 1.6, maxWidth: 460, margin: "0 0 32px" }}>
            Structured lessons, real conversations, and an AI tutor that remembers what trips you up — built for
            newcomers, students, and professionals learning English or French for daily life.
          </p>
          <div style={{ display: "flex", gap: 14 }}>
            <button className="vl-btn-primary" onClick={onSignup}>Start learning <ArrowRight size={17} /></button>
            <button className="vl-btn-ghost" onClick={onPlacement}>Take the placement test</button>
          </div>
          <p style={{ marginTop: 34, fontSize: 13, color: "var(--ink-soft)" }}>
            Votre voix, votre rythme, votre parcours — apprenez le français avec confiance.
          </p>
        </div>

        <div className="vl-card" style={{ padding: 26, position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)" }}>AI Tutor · Camille</span>
            <span style={{ fontSize: 11, background: "var(--turq)", color: "#fff", padding: "3px 9px", borderRadius: 999 }}>B1 · Live</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ alignSelf: "flex-start", background: "var(--cream-dim)", borderRadius: "4px 16px 16px 16px", padding: "10px 14px", maxWidth: "80%", fontSize: 14 }}>
              Comment se passe ton installation à Montréal ?
            </div>
            <div style={{ alignSelf: "flex-end", background: "var(--navy)", color: "#fff", borderRadius: "16px 4px 16px 16px", padding: "10px 14px", maxWidth: "80%", fontSize: 14 }}>
              Ça se passe bien, mais je cherche encore un appartement.
            </div>
            <div style={{ alignSelf: "flex-start", background: "var(--cream-dim)", borderRadius: "4px 16px 16px 16px", padding: "10px 14px", maxWidth: "85%", fontSize: 14 }}>
              Bonne phrase ! Petite nuance : on dit plutôt <em>« je suis encore à la recherche d'un appartement »</em> — plus naturel à l'oral.
            </div>
          </div>
          <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
            <div style={{ flex: 1, background: "var(--cream)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--ink-soft)" }}>Type or speak your reply…</div>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--coral)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Mic size={17} color="#fff" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   PLACEMENT TEST
   ──────────────────────────────────────────────────────────── */

const PLACEMENT_QUESTIONS = [
  {
    skill: "Vocabulary", type: "multiple choice",
    prompt: "Choose the word that means \"to help\".",
    opts: ["aider", "acheter", "arriver", "attendre"], correct: "aider",
  },
  {
    skill: "Grammar", type: "fill in the blank",
    prompt: "Complete: « Nous ___ au cinéma ce soir. »",
    opts: ["allons", "allez", "vont", "va"], correct: "allons",
  },
  {
    skill: "Reading", type: "short passage",
    passage: "« Bonjour, je m'appelle Awa. J'habite à Montréal depuis six mois et je travaille dans un hôpital. »",
    prompt: "What does Awa do?",
    opts: ["She works in a hospital", "She studies medicine", "She is on vacation", "She owns a hospital"],
    correct: "She works in a hospital",
  },
  {
    skill: "Listening", type: "audio",
    prompt: "🔊 « Est-ce que vous pouvez répéter, s'il vous plaît ? » — What is being asked?",
    opts: ["To repeat something", "To speak more quietly", "To slow down", "To spell a word"],
    correct: "To repeat something",
  },
];

function levelFromScore(score) {
  if (score <= 1) return { code: "A1", name: "Beginner", blurb: "You're just starting out — we'll build your foundation from everyday words and simple sentences." };
  if (score === 2) return { code: "A2", name: "Elementary", blurb: "You know the basics — we'll grow that into full conversations about daily life." };
  if (score === 3) return { code: "B1", name: "Intermediate", blurb: "You can already get by in French — we'll sharpen fluency for work, travel, and settling in." };
  return { code: "B2", name: "Upper Intermediate", blurb: "You're comfortable with the language — we'll refine nuance, tone, and advanced topics." };
}

function PlacementTest({ onDone, onSkip }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const q = PLACEMENT_QUESTIONS[i];

  const choose = (opt) => {
    setPicked(opt);
    const isRight = opt === q.correct;
    setTimeout(() => {
      const newScore = score + (isRight ? 1 : 0);
      setScore(newScore);
      setPicked(null);
      if (i < PLACEMENT_QUESTIONS.length - 1) setI(i + 1);
      else setFinished(true);
    }, 500);
  };

  if (finished) {
    const level = levelFromScore(score);
    return (
      <div className="vl-fade-in" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="vl-card" style={{ width: 480, padding: 34, textAlign: "center" }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--turq-dark)", letterSpacing: 0.3 }}>PLACEMENT COMPLETE</span>
          <div style={{ margin: "18px auto", display: "flex", justifyContent: "center" }}>
            <Logo size={44} />
          </div>
          <h2 className="vl-serif" style={{ fontSize: 28, color: "var(--navy)", margin: "0 0 6px" }}>
            You're ready for {level.code} — {level.name}
          </h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 14.5, lineHeight: 1.6, margin: "0 0 26px" }}>{level.blurb}</p>
          <button className="vl-btn-primary" style={{ width: "100%", justifyContent: "center", marginBottom: 10 }} onClick={() => onDone(level.code)}>
            Start at {level.code} <ArrowRight size={16} />
          </button>
          <button className="vl-btn-ghost" style={{ width: "100%", justifyContent: "center" }} onClick={() => onDone(null)}>
            Choose a different level
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="vl-fade-in" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: 520 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--lavender-dark)" }}>{q.skill} · {q.type}</span>
          <button onClick={onSkip} style={{ background: "none", border: "none", color: "var(--ink-soft)", fontSize: 12.5 }}>Skip test</button>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 26 }}>
          {PLACEMENT_QUESTIONS.map((_, idx) => (
            <div key={idx} style={{ height: 4, flex: 1, borderRadius: 2, background: idx <= i ? "var(--coral)" : "var(--line)" }} />
          ))}
        </div>
        {q.passage && (
          <div className="vl-card" style={{ padding: 16, marginBottom: 16, background: "var(--cream)", border: "none", fontStyle: "italic", fontSize: 14.5, color: "var(--ink-soft)" }}>
            {q.passage}
          </div>
        )}
        <h2 className="vl-serif" style={{ fontSize: 23, color: "var(--navy)", margin: "0 0 22px", lineHeight: 1.35 }}>{q.prompt}</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {q.opts.map((opt) => {
            const isChosen = picked === opt;
            const isRight = opt === q.correct;
            let border = "var(--line)", bg = "#fff";
            if (picked) {
              if (isChosen) { border = isRight ? "var(--turq)" : "var(--coral)"; bg = isRight ? "#E7F9F6" : "#FFEDEA"; }
              else if (isRight) { border = "var(--turq)"; }
            }
            return (
              <button key={opt} disabled={!!picked} onClick={() => choose(opt)} className="vl-card"
                style={{ padding: "13px 18px", textAlign: "left", fontSize: 15, fontWeight: 500, border: `1.5px solid ${border}`, background: bg }}>
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   REGISTRATION / LOGIN
   ──────────────────────────────────────────────────────────── */

function friendlyAuthError(err) {
  const code = err?.code || "";
  if (code.includes("email-already-in-use")) return "That email is already registered — try logging in instead.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "That email or password doesn't match an account.";
  if (code.includes("weak-password")) return "Password must be at least 6 characters.";
  if (code.includes("invalid-email")) return "Enter a valid email address.";
  if (code.includes("requires-recent-login")) return "For security, please log out and log back in, then try this again.";
  if (code.includes("too-many-requests")) return "Too many attempts — please wait a moment and try again.";
  if (code.includes("popup-closed-by-user")) return "";
  return "Something went wrong — please try again.";
}

function AuthScreen({ mode: initialMode, onAuthed, onBack }) {
  const [mode, setMode] = useState(initialMode || "signup"); // signup | login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.includes("@")) { setError("Enter a valid email address."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (mode === "signup" && !name.trim()) { setError("Tell us your name."); return; }

    setSubmitting(true);
    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name.trim() });
        onAuthed("signup"); // → onboarding
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        onAuthed("login"); // → straight to app
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const withGoogle = async () => {
    setError("");
    setSubmitting(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const isNewUser = getAdditionalUserInfo(cred)?.isNewUser;
      onAuthed(isNewUser ? "signup" : "login");
    } catch (err) {
      const msg = friendlyAuthError(err);
      if (msg) setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const forgotPassword = async () => {
    if (!email.includes("@")) { setError("Enter your email above first, then try again."); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err) {
      setError(friendlyAuthError(err));
    }
  };

  return (
    <div className="vl-fade-in" style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      backgroundImage: "radial-gradient(760px 420px at 88% -8%, rgba(139,92,246,0.14), transparent 60%), radial-gradient(620px 380px at 6% 8%, rgba(255,93,93,0.12), transparent 60%)"
    }}>
      <div style={{ width: 400 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--ink-soft)", fontSize: 13, display: "flex", alignItems: "center", gap: 5, marginBottom: 22 }}>
          <ChevronLeft size={15} /> Back
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <Logo size={30} />
          <span className="vl-serif" style={{ fontSize: 19, fontWeight: 650, color: "var(--navy)" }}>VerbaLune</span>
        </div>

        <div style={{ display: "flex", background: "var(--cream-dim)", borderRadius: 12, padding: 4, marginBottom: 24 }}>
          {["signup", "login"].map((m) => (
            <button key={m} onClick={() => { setMode(m); setError(""); }}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 9, border: "none", fontSize: 13.5, fontWeight: 600,
                background: mode === m ? "#fff" : "transparent", color: mode === m ? "var(--navy)" : "var(--ink-soft)",
                boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.08)" : "none"
              }}>
              {m === "signup" ? "Sign up" : "Log in"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          <button className="vl-btn-ghost" style={{ justifyContent: "center", width: "100%", opacity: submitting ? 0.6 : 1 }} disabled={submitting} onClick={withGoogle}>
            Continue with Google
          </button>
          <button className="vl-btn-ghost" style={{ justifyContent: "center", width: "100%", opacity: 0.5 }} disabled title="Apple sign-in needs additional Apple Developer setup — not wired up yet">
            Continue with Apple
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0" }}>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>or with email</span>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "signup" && (
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name"
              style={{ padding: "12px 14px", borderRadius: 11, border: "1.5px solid var(--line)", fontSize: 14, fontFamily: "inherit" }} />
          )}
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email address"
            style={{ padding: "12px 14px", borderRadius: 11, border: "1.5px solid var(--line)", fontSize: 14, fontFamily: "inherit" }} />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password"
            style={{ padding: "12px 14px", borderRadius: 11, border: "1.5px solid var(--line)", fontSize: 14, fontFamily: "inherit" }} />

          {error && <p style={{ color: "var(--coral-dark)", fontSize: 12.5, margin: 0 }}>{error}</p>}

          {mode === "login" && (
            <button type="button" onClick={forgotPassword}
              style={{ background: "none", border: "none", color: "var(--lavender-dark)", fontSize: 12.5, textAlign: "left", padding: 0 }}>
              {resetSent ? "Password reset email sent — check your inbox." : "Forgot your password?"}
            </button>
          )}

          <button type="submit" className="vl-btn-primary" style={{ justifyContent: "center", marginTop: 6, opacity: submitting ? 0.6 : 1 }} disabled={submitting}>
            {submitting ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}
          </button>
        </form>

        <p style={{ fontSize: 11.5, color: "var(--ink-soft)", textAlign: "center", marginTop: 20, lineHeight: 1.5 }}>
          By continuing, you agree to VerbaLune's Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   ONBOARDING
   ──────────────────────────────────────────────────────────── */

function Onboarding({ onFinish, presetLevel }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(presetLevel ? { level: presetLevel } : {});
  const allSteps = [
    { key: "language", q: "Which language do you want to learn?", opts: ["French", "English"] },
    { key: "level", q: "What is your current level?", opts: ["Complete beginner", "A2 – Elementary", "B1 – Intermediate", "B2 or above"] },
    { key: "goal", q: "Why are you learning it?", opts: ["Immigration & daily life", "Work", "Travel", "Exam preparation"] },
    { key: "time", q: "How many minutes can you study each day?", opts: ["5 minutes", "10 minutes", "20 minutes", "30+ minutes"] },
    { key: "focus", q: "Which skill do you want to improve most?", opts: ["Speaking", "Listening", "Writing", "Grammar"] },
  ];
  // Skip the level question if the placement test already answered it.
  const steps = presetLevel ? allSteps.filter((step) => step.key !== "level") : allSteps;
  const s = steps[step];
  const pick = (opt) => {
    setAnswers({ ...answers, [s.key]: opt });
    if (step < steps.length - 1) setStep(step + 1);
    else onFinish({ ...answers, [s.key]: opt });
  };

  return (
    <div className="vl-fade-in" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: 480 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 30 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ height: 4, flex: 1, borderRadius: 2, background: i <= step ? "var(--coral)" : "var(--line)" }} />
          ))}
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 8 }}>Question {step + 1} of {steps.length}</p>
        <h2 className="vl-serif" style={{ fontSize: 28, color: "var(--navy)", margin: "0 0 26px" }}>{s.q}</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {s.opts.map((opt) => (
            <button key={opt} onClick={() => pick(opt)}
              className="vl-card"
              style={{ padding: "15px 18px", textAlign: "left", fontSize: 15, fontWeight: 500, border: "1.5px solid var(--line)", transition: "border-color .15s, background .15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--coral)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}>
              {opt}
            </button>
          ))}
        </div>
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} style={{ marginTop: 22, background: "none", border: "none", color: "var(--ink-soft)", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
            <ChevronLeft size={15} /> Back
          </button>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   APP SHELL (post-onboarding)
   ──────────────────────────────────────────────────────────── */

function Shell({ screen, setScreen, user, learningLanguage, currentLevel, children }) {
  const label = user?.displayName || user?.email || "You";
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <div style={{ width: 220, background: "var(--navy)", padding: "26px 16px", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px", marginBottom: 34 }}>
          <Logo size={26} />
          <span className="vl-serif" style={{ fontSize: 18, color: "#fff", fontWeight: 600 }}>VerbaLune</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon, active = screen === item.id;
            return (
              <button key={item.id} onClick={() => setScreen(item.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 10,
                  border: "none",
                  background: active ? "linear-gradient(120deg, rgba(255,93,93,0.28), rgba(139,92,246,0.28))" : "transparent",
                  color: active ? "#fff" : "rgba(255,255,255,0.62)", fontSize: 14, fontWeight: active ? 600 : 500, textAlign: "left"
                }}>
                <Icon size={17} color={active ? "#FFB627" : "currentColor"} /> {item.label}
              </button>
            );
          })}
        </div>
        <button onClick={() => setScreen("profile")} style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "none", textAlign: "left" }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg, var(--coral), var(--lavender))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 700, flexShrink: 0 }}>
            {label[0].toUpperCase()}
          </div>
          <div style={{ overflow: "hidden" }}>
            <p style={{ margin: 0, fontSize: 12.5, color: "#fff", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</p>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{learningLanguage || "French"} · {currentLevel || "A1"}</p>
          </div>
        </button>
      </div>
      <div className="vl-scroll" style={{ flex: 1, overflowY: "auto", background: "var(--cream)" }}>
        {children}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   DASHBOARD
   ──────────────────────────────────────────────────────────── */

function Dashboard({ setScreen, openLesson, userName, language }) {
  const library = getLessonLibrary(language);
  const recommended = (library[3] && library[3][0]) || Object.values(library)[0]?.[0];
  const dailyPhrase = language === "English"
    ? { text: "I'm managing well, thanks.", translation: "« Je me débrouille bien, merci. »", speakLang: "en-US" }
    : { text: "« Je me débrouille bien, merci. »", translation: "\"I'm managing well, thanks.\"", speakLang: undefined };

  return (
    <div className="vl-fade-in" style={{ padding: "36px 44px", maxWidth: 1080 }}>
      <p style={{ color: "var(--ink-soft)", fontSize: 14, margin: "0 0 2px" }}>Hi {userName || "there"} 👋</p>
      <h1 className="vl-serif" style={{ fontSize: 30, color: "var(--navy)", margin: "0 0 28px" }}>Ready for today's session?</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 26 }}>
        {[
          { icon: Flame, label: "Day streak", value: "12", color: "var(--coral)" },
          { icon: Clock, label: "Speaking time", value: "3h 40m", color: "var(--turq-dark)" },
          { icon: Star, label: "Words learned", value: "486", color: "var(--gold-dark)" },
          { icon: Award, label: "Lessons done", value: "42", color: "var(--navy)" },
        ].map((s, i) => (
          <div key={i} className="vl-card" style={{ padding: 18 }}>
            <s.icon size={18} color={s.color} />
            <p className="vl-serif" style={{ fontSize: 24, margin: "10px 0 2px", color: "var(--navy)" }}>{s.value}</p>
            <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: 0 }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18 }}>
        <div className="vl-card" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--turq-dark)", letterSpacing: 0.3 }}>RECOMMENDED LESSON</span>
              {recommended ? (
                <>
                  <h3 className="vl-serif" style={{ fontSize: 22, margin: "6px 0 8px", color: "var(--navy)" }}>{recommended.title}</h3>
                  <p style={{ fontSize: 14, color: "var(--ink-soft)", maxWidth: 380, lineHeight: 1.5 }}>{recommended.introText}</p>
                </>
              ) : (
                <p style={{ fontSize: 14, color: "var(--ink-soft)", marginTop: 8 }}>No lessons authored yet for this language.</p>
              )}
            </div>
            <ProgressRing value={57} />
          </div>
          <button className="vl-btn-primary" onClick={() => openLesson(recommended)} disabled={!recommended} style={{ marginTop: 18, opacity: recommended ? 1 : 0.5 }}>
            <Play size={16} /> Continue lesson
          </button>
        </div>

        <div className="vl-card" style={{ padding: 22, background: "linear-gradient(135deg, var(--navy), var(--navy-light))", color: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between", border: "none" }}>
          <div>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--lavender)", letterSpacing: 0.3 }}>DAILY PHRASE</span>
            <p className="vl-serif" style={{ fontSize: 19, margin: "8px 0 6px" }}>{dailyPhrase.text}</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{dailyPhrase.translation}</p>
          </div>
          <button style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 10, padding: "9px 14px", color: "#fff", fontSize: 13, display: "flex", alignItems: "center", gap: 7, alignSelf: "flex-start" }}
            onClick={() => speak(dailyPhrase.text, dailyPhrase.speakLang)}>
            <Volume2 size={14} /> Listen
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }}>
        <div className="vl-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--navy)", margin: "0 0 14px" }}>Skill wheel</h3>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <SkillWheel skills={SKILLS} />
          </div>
        </div>
        <div className="vl-card" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--navy)", margin: 0 }}>Daily challenge</h3>
            <span style={{ fontSize: 11, background: "var(--cream-dim)", padding: "3px 10px", borderRadius: 999, color: "var(--ink-soft)" }}>+15 XP</span>
          </div>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.55, marginBottom: 16 }}>
            Record a 30-second answer: <em>« Décris ta routine du matin. »</em>
          </p>
          <button className="vl-btn-ghost" onClick={() => setScreen("tutor")}>
            <Mic size={15} /> Start challenge
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   LESSON CONTENT LIBRARY
   ──────────────────────────────────────────────────────────── */

const DEFAULT_LESSON = {
  unitId: 3, unitLabel: "UNIT 3 · LESSON 5", title: "Home & Daily Routines",
  introText: "In this lesson you'll describe your morning routine using reflexive verbs, and practice listening to a short dialogue between two roommates getting ready for work.",
  objectives: [
    "Conjugate reflexive verbs in the present tense",
    "Describe your daily routine, step by step",
    "Understand a natural-speed conversation about mornings",
  ],
  vocab: [["se réveiller", "to wake up"], ["se lever", "to get up"], ["se laver", "to wash oneself"], ["s'habiller", "to get dressed"]],
  grammarTitle: "Grammar · Reflexive verbs",
  grammarIntro: "Reflexive verbs use a pronoun that matches the subject — the action reflects back onto the person doing it.",
  conjugationRows: [["je", "me lève"], ["tu", "te lèves"], ["il / elle / on", "se lève"], ["nous", "nous levons"], ["vous", "vous levez"], ["ils / elles", "se lèvent"]],
  quizPrompt: "Complete: « Le matin, je ___ à sept heures. »",
  quizOptions: ["me lève", "se lève", "lève", "me levez"],
  quizCorrect: "me lève",
  quizFeedbackCorrect: "Excellent — that sounds much more natural now.",
  quizFeedbackWrong: "Good attempt! The subject « je » pairs with « me ».",
  summaryLine: "4 new words learned · 1 grammar point · 87% quiz accuracy",
};

const INTRO_LESSON = {
  unitId: 1, unitLabel: "UNIT 1 · LESSON 1", title: "Introducing Yourself",
  introText: "In this lesson you'll introduce yourself with your name, where you're from, and what you do — the essentials for any first conversation.",
  objectives: [
    "Conjugate « être » with subject pronouns",
    "Say your name and where you're from",
    "Ask someone else the same questions",
  ],
  vocab: [["je m'appelle", "my name is"], ["je viens de", "I come from"], ["enchanté(e)", "nice to meet you"], ["et toi ?", "and you?"]],
  grammarTitle: "Grammar · The verb « être » (to be)",
  grammarIntro: "« Être » is one of the most irregular — and most useful — verbs in French. You'll use it constantly to talk about who you are and where you're from.",
  conjugationRows: [["je", "suis"], ["tu", "es"], ["il / elle / on", "est"], ["nous", "sommes"], ["vous", "êtes"], ["ils / elles", "sont"]],
  quizPrompt: "Complete: « Nous ___ étudiants à Montréal. »",
  quizOptions: ["sommes", "êtes", "sont", "est"],
  quizCorrect: "sommes",
  quizFeedbackCorrect: "Exactement — « nous » always pairs with « sommes ».",
  quizFeedbackWrong: "Close — « nous » takes « sommes », not that form.",
  summaryLine: "4 new words learned · 1 grammar point · 89% quiz accuracy",
};

const SHOPPING_LESSON = {
  unitId: 5, unitLabel: "UNIT 5 · LESSON 1", title: "Shopping",
  introText: "In this lesson you'll ask about prices and sizes while shopping, and use demonstrative adjectives to point things out — « ce », « cette », « ces ».",
  objectives: [
    "Use demonstrative adjectives (ce, cette, ces)",
    "Ask how much something costs",
    "Talk about sizes and colors while shopping",
  ],
  vocab: [["combien coûte…", "how much does… cost"], ["c'est trop cher", "it's too expensive"], ["une taille", "a size"], ["un rabais / une solde", "a discount / a sale"]],
  grammarTitle: "Grammar · Demonstrative adjectives (this / these)",
  grammarIntro: "« Ce », « cette », and « ces » all mean \"this/that\" or \"these/those\" — the form you use depends on the gender and number of the noun that follows.",
  conjugationRows: [["masculine singular", "ce manteau"], ["feminine singular", "cette veste"], ["before a vowel sound", "cet imperméable"], ["plural (any gender)", "ces chaussures"]],
  quizPrompt: "Complete: « Combien coûte ___ robe ? »",
  quizOptions: ["cette", "ce", "cet", "ces"],
  quizCorrect: "cette",
  quizFeedbackCorrect: "Exactement — « robe » is feminine singular, so « cette » is right.",
  quizFeedbackWrong: "Almost — « robe » is feminine singular, which takes « cette ».",
  summaryLine: "4 new words learned · 1 grammar point · 83% quiz accuracy",
};

const FAMILY_LESSON = {
  unitId: 2, unitLabel: "UNIT 2 · LESSON 1", title: "Family & Relationships",
  introText: "In this lesson you'll introduce your family using possessive adjectives, and practice describing relationships in a short conversation.",
  objectives: [
    "Use possessive adjectives (mon, ma, mes…) correctly",
    "Name close family members",
    "Describe a family relationship in a full sentence",
  ],
  vocab: [["mon frère", "my brother"], ["ma sœur", "my sister"], ["mes parents", "my parents"], ["mon époux / mon épouse", "my spouse"]],
  grammarTitle: "Grammar · Possessive adjectives",
  grammarIntro: "French possessive adjectives agree with the gender of the noun they describe, not the owner — so « my » changes depending on what follows it.",
  conjugationRows: [["masculine", "mon frère"], ["feminine", "ma sœur"], ["before a vowel sound", "mon amie"], ["plural (any gender)", "mes parents"]],
  quizPrompt: "Complete: « Voici ___ sœur, elle s'appelle Awa. »",
  quizOptions: ["ma", "mon", "mes", "le"],
  quizCorrect: "ma",
  quizFeedbackCorrect: "Exactement — « sœur » is feminine, so it takes « ma ».",
  quizFeedbackWrong: "Almost — « sœur » is feminine, so it needs « ma », not that option.",
  summaryLine: "4 new words learned · 1 grammar point · 85% quiz accuracy",
};

const FOOD_LESSON = {
  unitId: 4, unitLabel: "UNIT 4 · LESSON 1", title: "Food & Restaurants",
  introText: "In this lesson you'll learn to order food politely using « je voudrais », talk about what you like to eat, and follow a short dialogue at a café.",
  objectives: [
    "Use « je voudrais » to order politely",
    "Name common foods and drinks",
    "Understand a simple café dialogue",
  ],
  vocab: [["je voudrais", "I would like"], ["l'addition", "the bill"], ["une entrée", "a starter"], ["un plat principal", "a main course"]],
  grammarTitle: "Grammar · Polite requests with « je voudrais »",
  grammarIntro: "« Je voudrais » (I would like) is the conditional of vouloir, and it's the standard polite way to order or ask for something in French — much softer than « je veux » (I want).",
  conjugationRows: [["je voudrais", "un café, s'il vous plaît"], ["je voudrais", "l'addition, s'il vous plaît"], ["nous voudrions", "une table pour deux"], ["vous voudriez", "autre chose ?"]],
  quizPrompt: "Complete politely: « ___ un verre d'eau, s'il vous plaît. »",
  quizOptions: ["Je voudrais", "Je veux", "J'ai", "Je vais"],
  quizCorrect: "Je voudrais",
  quizFeedbackCorrect: "Parfait — that's the natural, polite way to ask.",
  quizFeedbackWrong: "Close! « Je veux » works but sounds a bit blunt — « je voudrais » is more polite.",
  summaryLine: "4 new words learned · 1 grammar point · 92% quiz accuracy",
};

const IMMIGRATION_LESSON = {
  unitId: 6, unitLabel: "UNIT 6 · LESSON 1", title: "Immigration & Settling In",
  introText: "In this lesson you'll learn key vocabulary for settling into life in Canada — paperwork, banking, and housing — and practice talking about what still needs to be done using « il faut ».",
  objectives: [
    "Use « il faut + infinitive » to talk about what's required",
    "Recognize key settlement vocabulary",
    "Describe next steps in your settlement process",
  ],
  vocab: [["le numéro d'assurance sociale", "social insurance number"], ["le permis de travail", "work permit"], ["ouvrir un compte bancaire", "to open a bank account"], ["le bail", "the lease"]],
  grammarTitle: "Grammar · Necessity with « il faut »",
  grammarIntro: "« Il faut » + infinitive is an impersonal, very common way to say something is necessary — it doesn't change for who's doing it, which makes it simple to use in almost any sentence.",
  conjugationRows: [["il faut", "ouvrir un compte bancaire"], ["il faut", "trouver un logement"], ["il ne faut pas", "oublier vos documents"], ["il faudra", "renouveler le permis (future)"]],
  quizPrompt: "Complete: « ___ obtenir un numéro d'assurance sociale avant de travailler. »",
  quizOptions: ["Il faut", "Il fait", "Il fallait", "Il a fallu"],
  quizCorrect: "Il faut",
  quizFeedbackCorrect: "Exactement — that's the present-tense form you'll use most often.",
  quizFeedbackWrong: "Close — for a current requirement, present-tense « il faut » is the natural choice.",
  summaryLine: "4 new words learned · 1 grammar point · 90% quiz accuracy",
};

const TRANSPORT_LESSON = {
  unitId: 7, unitLabel: "UNIT 7 · LESSON 1", title: "Transportation",
  introText: "In this lesson you'll talk about getting around town using public transit, and use « aller + infinitif » to describe near-future plans.",
  objectives: [
    "Use « aller + infinitif » for the near future",
    "Name common ways to get around",
    "Ask which bus or métro line to take",
  ],
  vocab: [["prendre le bus", "to take the bus"], ["une station de métro", "a métro station"], ["un billet", "a ticket"], ["descendre à…", "to get off at…"]],
  grammarTitle: "Grammar · Near future with « aller + infinitif »",
  grammarIntro: "To talk about what you're about to do, conjugate « aller » and add the infinitive — much simpler than the full future tense, and very common in everyday speech.",
  conjugationRows: [["je vais", "prendre le bus"], ["tu vas", "descendre ici"], ["elle va", "prendre le métro"], ["nous allons", "changer de ligne"]],
  quizPrompt: "Complete: « Je ___ prendre le métro à la prochaine station. »",
  quizOptions: ["vais", "va", "vas", "allons"],
  quizCorrect: "vais",
  quizFeedbackCorrect: "Exactement — « je » always pairs with « vais ».",
  quizFeedbackWrong: "Close — « je » takes « vais », not that form.",
  summaryLine: "4 new words learned · 1 grammar point · 86% quiz accuracy",
};

const TRAVEL_LESSON = {
  unitId: 8, unitLabel: "UNIT 8 · LESSON 1", title: "Travel & Hotels",
  introText: "In this lesson you'll check into a hotel, ask about amenities, and use « avoir besoin de » to say what you need.",
  objectives: [
    "Use « avoir besoin de » to express needs",
    "Check into a hotel and ask about your room",
    "Understand common hotel vocabulary",
  ],
  vocab: [["une réservation", "a booking"], ["la réception", "the front desk"], ["j'ai besoin de…", "I need…"], ["le petit-déjeuner est inclus", "breakfast is included"]],
  grammarTitle: "Grammar · Expressing need with « avoir besoin de »",
  grammarIntro: "« Avoir besoin de » literally means \"to have need of\" — conjugate « avoir » and follow with « de » plus a noun or infinitive verb.",
  conjugationRows: [["j'ai besoin de", "la clé de la chambre"], ["nous avons besoin de", "changer de chambre"], ["elle a besoin d'", "une serviette de plus"], ["vous avez besoin de", "quelque chose ?"]],
  quizPrompt: "Complete: « J'___ besoin d'une chambre pour deux nuits. »",
  quizOptions: ["ai", "a", "as", "avons"],
  quizCorrect: "ai",
  quizFeedbackCorrect: "Exactement — « j' » pairs with « ai ».",
  quizFeedbackWrong: "Close — with « j' » you need « ai », not that form.",
  summaryLine: "4 new words learned · 1 grammar point · 88% quiz accuracy",
};

const EMOTIONS_LESSON = {
  unitId: 13, unitLabel: "UNIT 13 · LESSON 1", title: "Emotions & Opinions",
  introText: "In this lesson you'll express opinions and reactions, and learn when an opinion expression triggers the subjunctive mood.",
  objectives: [
    "Use « il est important que + subjonctif »",
    "Express opinions and emotional reactions",
    "Distinguish indicative vs. subjunctive after opinion verbs",
  ],
  vocab: [["à mon avis", "in my opinion"], ["je trouve que", "I find that"], ["il est essentiel que", "it's essential that"], ["ça me rend content(e)", "that makes me happy"]],
  grammarTitle: "Grammar · The subjunctive after opinion & emotion",
  grammarIntro: "Expressions of necessity, doubt, or emotion (« il faut que », « il est important que », « je suis content(e) que ») are usually followed by the subjunctive mood, not the indicative — a key B2 milestone.",
  conjugationRows: [["il est important que je", "sois à l'heure"], ["il est essentiel que tu", "fasses attention"], ["je suis content(e) qu'elle", "vienne"], ["il faut que nous", "parlions calmement"]],
  quizPrompt: "Complete: « Il est important que tu ___ à l'heure. »",
  quizOptions: ["sois", "es", "être", "seras"],
  quizCorrect: "sois",
  quizFeedbackCorrect: "Exactement — « il est important que » triggers the subjunctive « sois ».",
  quizFeedbackWrong: "Close — after « il est important que », French needs the subjunctive « sois », not that form.",
  summaryLine: "4 new words learned · 1 grammar point · 76% quiz accuracy",
};

const NEWS_LESSON = {
  unitId: 14, unitLabel: "UNIT 14 · LESSON 1", title: "News & Culture",
  introText: "In this lesson you'll read and discuss news-style sentences, learning the passive voice that's common in journalism and formal writing.",
  objectives: [
    "Form the passive voice with « être + participe passé »",
    "Discuss current events and culture",
    "Recognize passive constructions while reading",
  ],
  vocab: [["annoncer", "to announce"], ["un reportage", "a news report"], ["selon…", "according to…"], ["l'opinion publique", "public opinion"]],
  grammarTitle: "Grammar · The passive voice",
  grammarIntro: "The passive voice shifts focus from who did something to what happened — very common in news writing. Form it with « être » (in any tense) + a past participle that agrees with the subject.",
  conjugationRows: [["le projet est annoncé", "the project is announced"], ["la loi a été votée", "the law was voted on"], ["les résultats seront publiés", "the results will be published"], ["l'artiste est connu de tous", "the artist is known by everyone"]],
  quizPrompt: "Complete (passive): « La nouvelle loi ___ votée hier. »",
  quizOptions: ["a été", "a", "est", "était"],
  quizCorrect: "a été",
  quizFeedbackCorrect: "Exactement — a completed passive action in the past uses « a été + participe ».",
  quizFeedbackWrong: "Close — for a completed past action, French uses « a été » here, not that form.",
  summaryLine: "4 new words learned · 1 grammar point · 78% quiz accuracy",
};

const PROFESSIONAL_LESSON = {
  unitId: 15, unitLabel: "UNIT 15 · LESSON 1", title: "Professional Communication",
  introText: "In this lesson you'll write and speak more diplomatically at work, using the conditional to soften requests and suggestions.",
  objectives: [
    "Use the conditional to make polite suggestions",
    "Write a professional email opening and closing",
    "Report what a colleague said",
  ],
  vocab: [["je voudrais suggérer que", "I would like to suggest that"], ["pourriez-vous…?", "could you…?"], ["dans les plus brefs délais", "as soon as possible"], ["veuillez trouver ci-joint", "please find attached"]],
  grammarTitle: "Grammar · The conditional for polite requests",
  grammarIntro: "The conditional mood — formed from the future stem plus imperfect endings — softens requests and suggestions, which is essential for professional French.",
  conjugationRows: [["je voudrais", "proposer une réunion"], ["pourriez-vous", "envoyer le rapport ?"], ["il faudrait", "revoir le calendrier"], ["nous aimerions", "avoir votre avis"]],
  quizPrompt: "Complete (polite): « ___-vous m'envoyer le document avant vendredi ? »",
  quizOptions: ["Pourriez", "Pouvez", "Pouviez", "Peuvent"],
  quizCorrect: "Pourriez",
  quizFeedbackCorrect: "Exactement — the conditional « pourriez » is the polished, professional choice.",
  quizFeedbackWrong: "Close — for a diplomatic request, the conditional « pourriez » is more appropriate here.",
  summaryLine: "4 new words learned · 1 grammar point · 81% quiz accuracy",
};

const DEBATE_LESSON = {
  unitId: 16, unitLabel: "UNIT 16 · LESSON 1", title: "Debates & Advanced Discussions",
  introText: "In this lesson you'll argue a point and concede another, using « bien que + subjonctif » to introduce a contrast within a single sentence.",
  objectives: [
    "Use « bien que + subjonctif » to concede a point",
    "Structure an argument with contrast",
    "Follow a fast-paced debate-style exchange",
  ],
  vocab: [["bien que", "although"], ["je suis convaincu(e) que", "I'm convinced that"], ["d'un autre côté", "on the other hand"], ["il n'en demeure pas moins que", "the fact remains that"]],
  grammarTitle: "Grammar · Concession with « bien que + subjonctif »",
  grammarIntro: "« Bien que » (although) always takes the subjunctive, even though the idea it introduces is factual — one of the trickier subjunctive triggers for advanced learners.",
  conjugationRows: [["bien qu'il", "soit tard, on continue"], ["bien que nous", "soyons fatigués"], ["bien qu'elle", "ait raison, il insiste"], ["bien que ce", "puisse sembler difficile"]],
  quizPrompt: "Complete: « Bien qu'il ___ raison, je ne suis pas d'accord. »",
  quizOptions: ["ait", "a", "avait", "aura"],
  quizCorrect: "ait",
  quizFeedbackCorrect: "Exactement — « bien que » always triggers the subjunctive « ait ».",
  quizFeedbackWrong: "Close — « bien que » requires the subjunctive « ait », not that form.",
  summaryLine: "4 new words learned · 1 grammar point · 74% quiz accuracy",
};

const HEALTH_LESSON = {
  unitId: 9, unitLabel: "UNIT 9 · LESSON 1", title: "Health & Medical Appointments",
  introText: "In this lesson you'll describe symptoms to a doctor and book an appointment, using « avoir mal à » to say where it hurts.",
  objectives: [
    "Use « avoir mal à » to describe pain",
    "Book and describe a medical appointment",
    "Understand basic medical advice",
  ],
  vocab: [["j'ai mal à…", "my … hurts"], ["une ordonnance", "a prescription"], ["prendre rendez-vous", "to make an appointment"], ["la salle d'attente", "the waiting room"]],
  grammarTitle: "Grammar · Describing pain with « avoir mal à »",
  grammarIntro: "« Avoir mal à » + a body part is the standard way to say something hurts — « à » contracts with « le » and « les » just like elsewhere in French (au, aux).",
  conjugationRows: [["j'ai mal à la tête", "my head hurts"], ["j'ai mal au ventre", "my stomach hurts (à + le → au)"], ["j'ai mal aux dents", "my teeth hurt (à + les → aux)"], ["elle a mal à la gorge", "her throat hurts"]],
  quizPrompt: "Complete: « J'ai mal ___ dents, je dois voir un dentiste. »",
  quizOptions: ["aux", "au", "à la", "à"],
  quizCorrect: "aux",
  quizFeedbackCorrect: "Exactement — « dents » is plural, so « à + les » becomes « aux ».",
  quizFeedbackWrong: "Close — « dents » is plural, so it needs « aux », not that form.",
  summaryLine: "4 new words learned · 1 grammar point · 82% quiz accuracy",
};

const SCHOOL_LESSON = {
  unitId: 11, unitLabel: "UNIT 11 · LESSON 1", title: "School & Education",
  introText: "In this lesson you'll talk about your studies and how long you've been doing something, using « depuis » with a duration.",
  objectives: [
    "Use « depuis » to talk about duration",
    "Name school subjects and programs",
    "Describe your current studies",
  ],
  vocab: [["s'inscrire à un cours", "to enroll in a course"], ["une bourse d'études", "a scholarship"], ["le diplôme", "the diploma / degree"], ["depuis", "since / for (a duration)"]],
  grammarTitle: "Grammar · « Depuis » for ongoing duration",
  grammarIntro: "Unlike English, French uses the present tense with « depuis » for something that started in the past and is still true now — « j'étudie depuis deux ans » means \"I've been studying for two years.\"",
  conjugationRows: [["j'étudie depuis", "deux ans"], ["elle habite ici depuis", "six mois"], ["nous apprenons le français depuis", "septembre"], ["il travaille depuis", "2019"]],
  quizPrompt: "Complete: « J'apprends le français ___ six mois. »",
  quizOptions: ["depuis", "pendant", "pour", "il y a"],
  quizCorrect: "depuis",
  quizFeedbackCorrect: "Exactement — an ongoing action needs « depuis ».",
  quizFeedbackWrong: "Close — for something still ongoing, « depuis » is the right choice.",
  summaryLine: "4 new words learned · 1 grammar point · 80% quiz accuracy",
};

const BANKING_LESSON = {
  unitId: 12, unitLabel: "UNIT 12 · LESSON 1", title: "Banking & Administration",
  introText: "In this lesson you'll handle basic banking and paperwork tasks, using « pouvoir + infinitif » to ask what you're able to do.",
  objectives: [
    "Use « pouvoir + infinitif » to ask about possibility",
    "Name common banking and admin terms",
    "Ask a clerk for help with a form",
  ],
  vocab: [["un compte courant", "a checking account"], ["remplir un formulaire", "to fill out a form"], ["une pièce d'identité", "an ID document"], ["un relevé bancaire", "a bank statement"]],
  grammarTitle: "Grammar · « Pouvoir + infinitif » (can / to be able to)",
  grammarIntro: "« Pouvoir » is irregular but essential — conjugate it and follow with an infinitive to ask what's possible or request help politely.",
  conjugationRows: [["je peux", "ouvrir un compte ?"], ["vous pouvez", "remplir ce formulaire"], ["est-ce que je peux", "voir un conseiller ?"], ["nous pouvons", "revenir demain"]],
  quizPrompt: "Complete (polite question): « Est-ce que je ___ parler à un conseiller ? »",
  quizOptions: ["peux", "peut", "peuvent", "pouvez"],
  quizCorrect: "peux",
  quizFeedbackCorrect: "Exactement — « je » pairs with « peux ».",
  quizFeedbackWrong: "Close — with « je » you need « peux », not that form.",
  summaryLine: "4 new words learned · 1 grammar point · 87% quiz accuracy",
};

const WORK_LESSON = {
  unitId: 10, unitLabel: "UNIT 10 · LESSON 1", title: "Work & Job Interviews",
  introText: "In this lesson you'll talk about past work experience using the passé composé, and practice common job interview questions.",
  objectives: [
    "Form the passé composé with « avoir »",
    "Talk about past jobs and experience",
    "Answer a basic interview question",
  ],
  vocab: [["j'ai travaillé", "I worked"], ["mes compétences", "my skills"], ["un entretien", "an interview"], ["disponible", "available"]],
  grammarTitle: "Grammar · Passé composé with « avoir »",
  grammarIntro: "Most French verbs form their past tense with a conjugated « avoir » plus a past participle — this is the passé composé, the tense you'll use most for talking about experience.",
  conjugationRows: [["j'ai", "travaillé dans un hôpital"], ["tu as", "étudié le commerce"], ["elle a", "géré une équipe"], ["nous avons", "terminé le projet"]],
  quizPrompt: "Complete: « J'___ travaillé comme infirmière pendant trois ans. »",
  quizOptions: ["ai", "a", "as", "avez"],
  quizCorrect: "ai",
  quizFeedbackCorrect: "Exactement — « j' » pairs with « ai » in the passé composé.",
  quizFeedbackWrong: "Close — with « j' » you need « ai », not that form.",
  summaryLine: "4 new words learned · 1 grammar point · 84% quiz accuracy",
};

const CHORES_LESSON = {
  unitId: 3, unitLabel: "UNIT 3 · LESSON 6", title: "Household Chores",
  introText: "In this lesson you'll talk about sharing chores at home using « devoir » (must/have to), and name common household tasks.",
  objectives: [
    "Use « devoir + infinitif » to say what must be done",
    "Name common household chores",
    "Negotiate who does which task",
  ],
  vocab: [["faire la vaisselle", "to do the dishes"], ["passer l'aspirateur", "to vacuum"], ["sortir les poubelles", "to take out the trash"], ["faire la lessive", "to do laundry"]],
  grammarTitle: "Grammar · Obligation with « devoir »",
  grammarIntro: "« Devoir » (must / to have to) is irregular but essential — conjugate it and follow with an infinitive to talk about responsibilities.",
  conjugationRows: [["je dois", "faire la vaisselle"], ["tu dois", "sortir les poubelles"], ["nous devons", "partager les tâches"], ["ils doivent", "passer l'aspirateur"]],
  quizPrompt: "Complete: « Ce soir, je ___ faire la vaisselle. »",
  quizOptions: ["dois", "doit", "devons", "doivent"],
  quizCorrect: "dois",
  quizFeedbackCorrect: "Exactement — « je » pairs with « dois ».",
  quizFeedbackWrong: "Close — with « je » you need « dois », not that form.",
  summaryLine: "4 new words learned · 1 grammar point · 85% quiz accuracy",
};

const LESSON_LIBRARY = {
  1: [INTRO_LESSON],
  2: [FAMILY_LESSON],
  3: [DEFAULT_LESSON, CHORES_LESSON],
  4: [FOOD_LESSON],
  5: [SHOPPING_LESSON],
  6: [IMMIGRATION_LESSON],
  7: [TRANSPORT_LESSON],
  8: [TRAVEL_LESSON],
  9: [HEALTH_LESSON],
  10: [WORK_LESSON],
  11: [SCHOOL_LESSON],
  12: [BANKING_LESSON],
  13: [EMOTIONS_LESSON],
  14: [NEWS_LESSON],
  15: [PROFESSIONAL_LESSON],
  16: [DEBATE_LESSON],
};

/* ────────────────────────────────────────────────────────────
   ENGLISH COURSE — for French-speaking learners. Same unit
   themes and lesson schema as the French course above, but only
   3 of 16 units are authored so far (Introducing Yourself, Home
   Routines, Food & Restaurants) — the rest fall back to "coming
   soon" until more rounds fill them in, same as the French side
   did originally.
   ──────────────────────────────────────────────────────────── */

const EN_INTRO_LESSON = {
  unitId: 1, unitLabel: "UNIT 1 · LESSON 1", title: "Introducing Yourself",
  introText: "In this lesson you'll introduce yourself in English using the verb « to be », and learn the essential first-meeting phrases.",
  objectives: [
    "Conjugate « to be » with subject pronouns",
    "Say your name and where you're from",
    "Ask someone else the same questions",
  ],
  vocab: [["my name is", "je m'appelle"], ["I come from", "je viens de"], ["nice to meet you", "enchanté(e)"], ["and you?", "et toi ?"]],
  grammarTitle: "Grammar · The verb « to be »",
  grammarIntro: "« To be » is irregular in English too, but its forms are simpler than the French « être ». You'll use it constantly for identity, origin, and description.",
  conjugationRows: [["I", "am"], ["you", "are"], ["he / she / it", "is"], ["we", "are"], ["you (plural)", "are"], ["they", "are"]],
  quizPrompt: "Complete: « We ___ students in Montreal. »",
  quizOptions: ["are", "is", "am", "be"],
  quizCorrect: "are",
  quizFeedbackCorrect: "Exactly — « we » always pairs with « are ».",
  quizFeedbackWrong: "Close — « we » takes « are », not that form.",
  summaryLine: "4 new words learned · 1 grammar point · 88% quiz accuracy",
};

const EN_HOME_LESSON = {
  unitId: 3, unitLabel: "UNIT 3 · LESSON 1", title: "Home & Daily Routines",
  introText: "In this lesson you'll describe your morning routine using the present simple tense, one of the most useful tenses for everyday English.",
  objectives: [
    "Conjugate regular verbs in the present simple",
    "Describe a daily routine step by step",
    "Add the « -s » ending correctly for he/she/it",
  ],
  vocab: [["to wake up", "se réveiller"], ["to get up", "se lever"], ["to get dressed", "s'habiller"], ["to have breakfast", "prendre le petit-déjeuner"]],
  grammarTitle: "Grammar · Present simple for routines",
  grammarIntro: "English adds « -s » to the verb for he/she/it in the present simple — a small ending that's easy to forget but changes whether a sentence sounds correct.",
  conjugationRows: [["I wake up", "at 7am"], ["she wakes up", "at 7am (note the -s)"], ["we get dressed", "quickly"], ["they have breakfast", "together"]],
  quizPrompt: "Complete: « Every morning, he ___ at seven. »",
  quizOptions: ["wakes up", "wake up", "waking up", "woke up"],
  quizCorrect: "wakes up",
  quizFeedbackCorrect: "Exactly — « he » needs the « -s » ending.",
  quizFeedbackWrong: "Close — with « he », the verb needs an « -s »: wakes up.",
  summaryLine: "4 new words learned · 1 grammar point · 84% quiz accuracy",
};

const EN_FOOD_LESSON = {
  unitId: 4, unitLabel: "UNIT 4 · LESSON 1", title: "Food & Restaurants",
  introText: "In this lesson you'll order food politely using « I would like », and learn key restaurant vocabulary.",
  objectives: [
    "Use « I would like » to order politely",
    "Name common foods and drinks",
    "Ask for the bill",
  ],
  vocab: [["I would like", "je voudrais"], ["the bill, please", "l'addition, s'il vous plaît"], ["a starter", "une entrée"], ["a main course", "un plat principal"]],
  grammarTitle: "Grammar · Polite requests with « would like »",
  grammarIntro: "« I would like » is the standard polite way to order or request something in English — softer and more natural than « I want » in a restaurant or shop.",
  conjugationRows: [["I would like", "a coffee, please"], ["we would like", "a table for two"], ["would you like", "anything else?"], ["she would like", "the check"]],
  quizPrompt: "Complete politely: « ___ a glass of water, please. »",
  quizOptions: ["I would like", "I want", "I have", "I go"],
  quizCorrect: "I would like",
  quizFeedbackCorrect: "Perfect — that's the natural, polite way to ask.",
  quizFeedbackWrong: "Close! « I want » works but sounds blunt — « I would like » is more polite.",
  summaryLine: "4 new words learned · 1 grammar point · 90% quiz accuracy",
};

const ENGLISH_LESSON_LIBRARY = {
  1: [EN_INTRO_LESSON],
  3: [EN_HOME_LESSON],
  4: [EN_FOOD_LESSON],
};

function getLessonLibrary(learningLanguage) {
  return learningLanguage === "English" ? ENGLISH_LESSON_LIBRARY : LESSON_LIBRARY;
}

/* ────────────────────────────────────────────────────────────
   LEARNING PATH
   ──────────────────────────────────────────────────────────── */

function LevelSummary({ level, onBack, language }) {
  const unitsInLevel = UNITS.filter((u) => u.level === level);
  const library = getLessonLibrary(language);
  const lessons = unitsInLevel.flatMap((u) => library[u.id] || []);

  const grammarPoints = lessons.map((l) => ({
    title: l.grammarTitle, intro: l.grammarIntro, rows: l.conjugationRows, source: l.title,
  }));
  const allVocab = lessons.flatMap((l) => l.vocab.map(([fr, en]) => ({ fr, en, source: l.title })));

  return (
    <div className="vl-fade-in" style={{ padding: "36px 44px", maxWidth: 800 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--ink-soft)", fontSize: 13, display: "flex", alignItems: "center", gap: 5, marginBottom: 18 }}>
        <ChevronLeft size={15} /> Back to learning path
      </button>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--lavender-dark)", letterSpacing: 0.3 }}>LEVEL {level} · REFERENCE SUMMARY</span>
      <h1 className="vl-serif" style={{ fontSize: 28, color: "var(--navy)", margin: "8px 0 6px" }}>Everything covered so far in {level}</h1>
      <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 26 }}>
        Compiled from {lessons.length} authored {lessons.length === 1 ? "lesson" : "lessons"} at this level — grammar rules, vocabulary, and verb forms in one place.
      </p>

      {lessons.length === 0 ? (
        <div className="vl-card" style={{ padding: 30, textAlign: "center", color: "var(--ink-soft)", fontSize: 14 }}>
          No lessons are authored at this level yet, so there's nothing to summarize.
        </div>
      ) : (
        <>
          <div className="vl-card" style={{ padding: 24, marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)", margin: "0 0 16px" }}>Grammar & verb forms</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {grammarPoints.map((g, i) => (
                <div key={i} style={{ paddingBottom: i < grammarPoints.length - 1 ? 18 : 0, borderBottom: i < grammarPoints.length - 1 ? "1px solid var(--line)" : "none" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "var(--turq-dark)" }}>{g.title}</p>
                  <p style={{ margin: "0 0 10px", fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.55 }}>{g.intro}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, background: "var(--cream)", borderRadius: 10, padding: 12 }}>
                    {g.rows.map(([p, v]) => (
                      <React.Fragment key={p + v}>
                        <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{p}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>{v}</span>
                      </React.Fragment>
                    ))}
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--ink-soft)", fontStyle: "italic" }}>From: {g.source}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="vl-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)", margin: "0 0 16px" }}>Vocabulary ({allVocab.length} words)</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {allVocab.map((v, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: "var(--cream)", borderRadius: 9 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>{v.fr}</p>
                    <p style={{ margin: 0, fontSize: 11.5, color: "var(--ink-soft)" }}>{v.en}</p>
                  </div>
                  <button onClick={() => speak(v.fr, language === "English" ? "en-US" : undefined)} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Volume2 size={13} color="var(--navy)" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LearningPath({ openLesson, completedLessons, language }) {
  const [expanded, setExpanded] = useState(null);
  const [viewLevel, setViewLevel] = useState(null);
  const levels = Array.from(new Set(UNITS.map((u) => u.level)));
  const library = getLessonLibrary(language);

  if (viewLevel) {
    return <LevelSummary level={viewLevel} onBack={() => setViewLevel(null)} language={language} />;
  }

  return (
    <div className="vl-fade-in" style={{ padding: "36px 44px", maxWidth: 900 }}>
      <h1 className="vl-serif" style={{ fontSize: 28, color: "var(--navy)", margin: "0 0 6px" }}>Learning Path</h1>
      <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 16 }}>Level A1 → A2 · {language || "French"}</p>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 30 }}>
        <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Grammar reference:</span>
        {levels.map((l) => (
          <button key={l} onClick={() => setViewLevel(l)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 13px", borderRadius: 999, border: "1.5px solid var(--line)", background: "#fff", fontSize: 12.5, fontWeight: 600, color: "var(--navy)" }}>
            <BookMarked size={12} /> {l}
          </button>
        ))}
      </div>

      <div style={{ position: "relative", paddingLeft: 28 }}>
        <div style={{ position: "absolute", left: 9, top: 8, bottom: 8, width: 2, background: "var(--line)" }} />
        {UNITS.map((u) => {
          const lessons = library[u.id] || [];
          const doneCount = lessons.filter((l) => completedLessons.includes(l.title)).length;
          const pct = lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0;
          const complete = lessons.length > 0 && doneCount === lessons.length;
          const started = doneCount > 0 && !complete;
          const isOpen = expanded === u.id;
          return (
            <div key={u.id} style={{ position: "relative", marginBottom: 18 }}>
              <div style={{
                position: "absolute", left: -28, top: 18, width: 20, height: 20, borderRadius: "50%",
                background: complete ? "var(--turq)" : started ? "var(--coral)" : "#fff",
                border: `2px solid ${complete ? "var(--turq)" : started ? "var(--coral)" : "var(--line)"}`,
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {complete && <Check size={12} color="#fff" />}
              </div>
              <div className="vl-card" onClick={() => setExpanded(isOpen ? null : u.id)}
                style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)" }}>{u.level}</span>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--navy)", margin: "4px 0" }}>{u.title}</h3>
                  <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: 0 }}>
                    {lessons.length ? `${doneCount}/${lessons.length} available lessons complete` : "No lessons authored yet"}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 90, height: 6, background: "var(--cream-dim)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: complete ? "var(--turq)" : "var(--coral)" }} />
                  </div>
                  {isOpen ? <ChevronLeft size={17} color="var(--ink-soft)" style={{ transform: "rotate(-90deg)" }} /> : <ChevronRight size={17} color="var(--ink-soft)" />}
                </div>
              </div>

              {isOpen && (
                <div className="vl-fade-in" style={{ marginTop: 8, marginLeft: 4, padding: "6px 4px 4px" }}>
                  {lessons.length ? lessons.map((lesson, i) => {
                    const isDone = completedLessons.includes(lesson.title);
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", background: "var(--cream)", borderRadius: 11, marginBottom: 8 }}>
                        <div>
                          <p style={{ margin: "0 0 2px", fontSize: 13.5, fontWeight: 600, color: "var(--navy)" }}>{lesson.title}</p>
                          <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>{lesson.unitLabel}</p>
                        </div>
                        <button className="vl-btn-ghost" style={{ padding: "7px 14px", fontSize: 12.5 }} onClick={() => openLesson(lesson)}>
                          {isDone ? <><Check size={13} /> Review</> : <><Play size={13} /> Start</>}
                        </button>
                      </div>
                    );
                  }) : (
                    <p style={{ fontSize: 12.5, color: "var(--ink-soft)", padding: "0 16px" }}>More lessons for this unit are coming soon.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   LESSON PLAYER
   ──────────────────────────────────────────────────────────── */

const LESSON_STAGES = ["intro", "vocab", "grammar", "quiz", "summary"];

function LessonPlayer({ lesson, onExit, onComplete, language }) {
  const data = lesson || DEFAULT_LESSON;
  const [stage, setStage] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [checked, setChecked] = useState(false);
  const correct = data.quizCorrect;

  const next = () => setStage((s) => Math.min(s + 1, LESSON_STAGES.length - 1));

  useEffect(() => {
    if (stage === LESSON_STAGES.length - 1) onComplete?.(data.title);
  }, [stage]);

  return (
    <div className="vl-fade-in" style={{ padding: "30px 44px", maxWidth: 760 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button onClick={onExit} style={{ background: "none", border: "none", color: "var(--ink-soft)", fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
          <X size={15} /> Exit lesson
        </button>
        <div style={{ display: "flex", gap: 5 }}>
          {LESSON_STAGES.map((_, i) => (
            <div key={i} style={{ width: 34, height: 4, borderRadius: 2, background: i <= stage ? "var(--coral)" : "var(--line)" }} />
          ))}
        </div>
      </div>

      {stage === 0 && (
        <div className="vl-card" style={{ padding: 28 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--turq-dark)" }}>{data.unitLabel}</span>
          <h2 className="vl-serif" style={{ fontSize: 26, color: "var(--navy)", margin: "8px 0 14px" }}>{data.title}</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>{data.introText}</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", marginBottom: 8 }}>By the end, you'll be able to:</p>
          <ul style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.8, paddingLeft: 20 }}>
            {data.objectives.map((o) => <li key={o}>{o}</li>)}
          </ul>
          <button className="vl-btn-primary" onClick={next}>Begin lesson <ArrowRight size={16} /></button>
        </div>
      )}

      {stage === 1 && (
        <div className="vl-card" style={{ padding: 28 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", marginBottom: 18 }}>New vocabulary</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {data.vocab.map(([fr, en]) => (
              <div key={fr} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "var(--cream)", borderRadius: 12 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, color: "var(--navy)" }}>{fr}</p>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)" }}>{en}</p>
                </div>
                <button style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 9, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center" }}
                  onClick={() => speak(fr, language === "English" ? "en-US" : undefined)}>
                  <Volume2 size={15} color="var(--navy)" />
                </button>
              </div>
            ))}
          </div>
          <button className="vl-btn-primary" style={{ marginTop: 22 }} onClick={next}>Continue <ArrowRight size={16} /></button>
        </div>
      )}

      {stage === 2 && (
        <div className="vl-card" style={{ padding: 28 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", marginBottom: 10 }}>{data.grammarTitle}</h3>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.6, marginBottom: 16 }}>{data.grammarIntro}</p>
          <div className="vl-card" style={{ background: "var(--cream)", border: "none", padding: 16, marginBottom: 18 }}>
            {data.conjugationRows.map(([p, v]) => (
              <div key={p + v} style={{ display: "flex", justifyContent: "space-between", padding: "6px 4px", fontSize: 14 }}>
                <span style={{ color: "var(--ink-soft)" }}>{p}</span>
                <span style={{ fontWeight: 600, color: "var(--navy)" }}>{v}</span>
              </div>
            ))}
          </div>
          <button className="vl-btn-primary" onClick={next}>Continue <ArrowRight size={16} /></button>
        </div>
      )}

      {stage === 3 && (
        <div className="vl-card" style={{ padding: 28 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", marginBottom: 16 }}>Quick check</h3>
          <p style={{ fontSize: 15, marginBottom: 18 }}>{data.quizPrompt}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
            {data.quizOptions.map((opt) => {
              const isCorrect = opt === correct;
              const chosen = answer === opt;
              let bg = "#fff", border = "var(--line)";
              if (checked && chosen) { bg = isCorrect ? "#E7F6F1" : "#FDEAE6"; border = isCorrect ? "var(--turq)" : "var(--coral)"; }
              if (checked && isCorrect && !chosen) { border = "var(--turq)"; }
              return (
                <button key={opt} disabled={checked}
                  onClick={() => setAnswer(opt)}
                  style={{ textAlign: "left", padding: "12px 16px", borderRadius: 11, border: `1.5px solid ${border}`, background: bg, fontSize: 14.5 }}>
                  {opt}
                </button>
              );
            })}
          </div>
          {!checked ? (
            <button className="vl-btn-primary" disabled={!answer} style={{ opacity: answer ? 1 : 0.5 }} onClick={() => setChecked(true)}>Check answer</button>
          ) : (
            <div>
              <p style={{ fontSize: 14, color: answer === correct ? "var(--turq-dark)" : "var(--coral-dark)", fontWeight: 600, marginBottom: 14 }}>
                {answer === correct ? data.quizFeedbackCorrect : data.quizFeedbackWrong}
              </p>
              <button className="vl-btn-primary" onClick={next}>Continue <ArrowRight size={16} /></button>
            </div>
          )}
        </div>
      )}

      {stage === 4 && (
        <div className="vl-card" style={{ padding: 32, textAlign: "center" }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--turq)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
            <Check size={28} color="#fff" />
          </div>
          <h2 className="vl-serif" style={{ fontSize: 24, color: "var(--navy)", margin: "0 0 8px" }}>Lesson complete</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 22 }}>{data.summaryLine}</p>
          <button className="vl-btn-primary" onClick={onExit}>Back to learning path</button>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   PRACTICE — reading comprehension exercise set
   ──────────────────────────────────────────────────────────── */

const READING_PASSAGE = {
  title: "Un message de ta collègue",
  meta: "Email · B1",
  text: `Bonjour Maya,

J'espère que tu vas bien ! Je t'écris parce que la réunion d'équipe de jeudi a été déplacée à vendredi matin, à 9h30, dans la salle de conférence B. Avant la réunion, peux-tu préparer un court résumé du projet que tu as terminé la semaine dernière ? Le directeur aimerait aussi que tu présentes tes résultats en cinq minutes.

Si tu as des questions, n'hésite pas à m'appeler avant vendredi. Sinon, on se voit à la réunion !

Cordialement,
Sophie`,
};

const READING_EXERCISES = [
  {
    type: "multiple_choice",
    prompt: "Why is Sophie writing to Maya?",
    options: ["To reschedule a meeting", "To ask for vacation days", "To cancel a project", "To introduce a new colleague"],
    correct: "To reschedule a meeting",
  },
  {
    type: "true_false",
    prompt: "The meeting was moved to Friday morning.",
    correct: "True",
  },
  {
    type: "fill_blank",
    prompt: "Complete from the email: « Peux-tu préparer un court ___ du projet ? »",
    options: ["résumé", "rendez-vous", "formulaire", "rapport"],
    correct: "résumé",
  },
  {
    type: "matching",
    prompt: "Match each French word from the email to its English meaning.",
    pairs: [
      { fr: "déplacée", en: "moved / rescheduled" },
      { fr: "résumé", en: "summary" },
      { fr: "n'hésite pas", en: "don't hesitate" },
    ],
  },
  {
    type: "order_events",
    prompt: "Put these steps in the order Sophie describes them.",
    items: [
      "Maya presents her results",
      "Maya prepares a summary",
      "The meeting takes place on Friday",
    ],
    correctOrder: [1, 0, 2], // indices into items in correct order
  },
  {
    type: "short_answer",
    prompt: "In your own words: what does Maya need to do before Friday's meeting?",
    modelAnswer: "She needs to prepare a short summary of the project she finished last week, and be ready to present the results in five minutes.",
  },
];

function MatchingExercise({ pairs, onDone }) {
  const [selectedFr, setSelectedFr] = useState(null);
  const [matched, setMatched] = useState({});
  const [wrong, setWrong] = useState(null);
  const shuffledEn = useRef([...pairs].sort(() => Math.random() - 0.5)).current;

  const pickFr = (fr) => { setSelectedFr(fr); setWrong(null); };
  const pickEn = (en) => {
    if (!selectedFr) return;
    const correctPair = pairs.find((p) => p.fr === selectedFr);
    if (correctPair.en === en) {
      const next = { ...matched, [selectedFr]: en };
      setMatched(next);
      setSelectedFr(null);
      if (Object.keys(next).length === pairs.length) setTimeout(onDone, 500);
    } else {
      setWrong(en);
      setTimeout(() => setWrong(null), 500);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {pairs.map((p) => (
          <button key={p.fr} disabled={!!matched[p.fr]} onClick={() => pickFr(p.fr)}
            style={{
              padding: "12px 14px", borderRadius: 10, textAlign: "left", fontSize: 14,
              border: `1.5px solid ${matched[p.fr] ? "var(--turq)" : selectedFr === p.fr ? "var(--coral)" : "var(--line)"}`,
              background: matched[p.fr] ? "#E7F6F1" : "#fff", opacity: matched[p.fr] ? 0.7 : 1,
            }}>
            {p.fr}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shuffledEn.map((p) => {
          const isMatched = Object.values(matched).includes(p.en);
          return (
            <button key={p.en} disabled={isMatched} onClick={() => pickEn(p.en)}
              style={{
                padding: "12px 14px", borderRadius: 10, textAlign: "left", fontSize: 14,
                border: `1.5px solid ${isMatched ? "var(--turq)" : wrong === p.en ? "var(--coral)" : "var(--line)"}`,
                background: isMatched ? "#E7F6F1" : wrong === p.en ? "#FDEAE6" : "#fff", opacity: isMatched ? 0.7 : 1,
              }}>
              {p.en}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OrderExercise({ items, correctOrder, onDone }) {
  const [order, setOrder] = useState(items.map((_, i) => i));
  const [checked, setChecked] = useState(false);
  const isCorrect = checked && JSON.stringify(order) === JSON.stringify(correctOrder);

  const move = (i, dir) => {
    const next = [...order];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
        {order.map((itemIdx, pos) => (
          <div key={itemIdx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${checked ? (isCorrect ? "var(--turq)" : "var(--coral)") : "var(--line)"}`, background: "#fff" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", width: 18 }}>{pos + 1}</span>
            <span style={{ flex: 1, fontSize: 14 }}>{items[itemIdx]}</span>
            <div style={{ display: "flex", gap: 4 }}>
              <button disabled={checked} onClick={() => move(pos, -1)} style={{ background: "var(--cream)", border: "none", borderRadius: 7, width: 26, height: 26 }}>↑</button>
              <button disabled={checked} onClick={() => move(pos, 1)} style={{ background: "var(--cream)", border: "none", borderRadius: 7, width: 26, height: 26 }}>↓</button>
            </div>
          </div>
        ))}
      </div>
      {!checked ? (
        <button className="vl-btn-primary" onClick={() => setChecked(true)}>Check order</button>
      ) : (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: isCorrect ? "var(--turq-dark)" : "var(--coral-dark)", marginBottom: 14 }}>
            {isCorrect ? "Exactly right!" : "Not quite the right order — take a look at the passage again."}
          </p>
          <button className="vl-btn-primary" onClick={onDone}>Continue <ArrowRight size={16} /></button>
        </div>
      )}
    </div>
  );
}

function Practice() {
  const [stage, setStage] = useState("passage"); // passage | exercise-N | done
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [checked, setChecked] = useState(false);
  const [shortAnswer, setShortAnswer] = useState("");
  const [revealModel, setRevealModel] = useState(false);
  const [score, setScore] = useState(0);

  const ex = READING_EXERCISES[step];
  const next = () => {
    setAnswer(null); setChecked(false); setShortAnswer(""); setRevealModel(false);
    if (step < READING_EXERCISES.length - 1) setStep(step + 1);
    else setStage("done");
  };

  if (stage === "passage") {
    return (
      <div className="vl-fade-in" style={{ padding: "36px 44px", maxWidth: 680 }}>
        <h1 className="vl-serif" style={{ fontSize: 28, color: "var(--navy)", margin: "0 0 6px" }}>Practice · Reading</h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 22 }}>Read the passage, then answer questions about it.</p>
        <div className="vl-card" style={{ padding: 26, marginBottom: 22 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--turq-dark)" }}>{READING_PASSAGE.meta}</span>
          <h2 className="vl-serif" style={{ fontSize: 21, color: "var(--navy)", margin: "6px 0 14px" }}>{READING_PASSAGE.title}</h2>
          <p style={{ fontSize: 14.5, color: "var(--ink)", lineHeight: 1.75, whiteSpace: "pre-line" }}>{READING_PASSAGE.text}</p>
        </div>
        <button className="vl-btn-primary" onClick={() => setStage("exercise")}>Answer questions <ArrowRight size={16} /></button>
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div className="vl-fade-in" style={{ padding: "36px 44px", maxWidth: 640, textAlign: "center" }}>
        <div className="vl-card" style={{ padding: 36 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, var(--coral), var(--gold))", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Check size={26} color="#fff" />
          </div>
          <h2 className="vl-serif" style={{ fontSize: 24, color: "var(--navy)", margin: "0 0 8px" }}>Reading practice complete</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 22 }}>{score} of {READING_EXERCISES.filter((e) => e.correct).length} auto-graded questions correct</p>
          <button className="vl-btn-primary" onClick={() => { setStage("passage"); setStep(0); setScore(0); }}>Practice again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="vl-fade-in" style={{ padding: "36px 44px", maxWidth: 680 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Question {step + 1} of {READING_EXERCISES.length}</span>
        <div style={{ display: "flex", gap: 5 }}>
          {READING_EXERCISES.map((_, i) => (
            <div key={i} style={{ width: 28, height: 4, borderRadius: 2, background: i <= step ? "var(--coral)" : "var(--line)" }} />
          ))}
        </div>
      </div>

      <div className="vl-card" style={{ padding: 28 }}>
        <p style={{ fontSize: 16, color: "var(--navy)", marginBottom: 20, fontWeight: 600 }}>{ex.prompt}</p>

        {ex.type === "multiple_choice" && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
              {ex.options.map((opt) => {
                const isCorrect = opt === ex.correct, chosen = answer === opt;
                let border = "var(--line)", bg = "#fff";
                if (checked && chosen) { border = isCorrect ? "var(--turq)" : "var(--coral)"; bg = isCorrect ? "#E7F6F1" : "#FDEAE6"; }
                if (checked && isCorrect && !chosen) border = "var(--turq)";
                return (
                  <button key={opt} disabled={checked} onClick={() => setAnswer(opt)}
                    style={{ textAlign: "left", padding: "12px 16px", borderRadius: 11, border: `1.5px solid ${border}`, background: bg, fontSize: 14.5 }}>
                    {opt}
                  </button>
                );
              })}
            </div>
            {!checked ? (
              <button className="vl-btn-primary" disabled={!answer} style={{ opacity: answer ? 1 : 0.5 }}
                onClick={() => { setChecked(true); if (answer === ex.correct) setScore((s) => s + 1); }}>Check answer</button>
            ) : (
              <button className="vl-btn-primary" onClick={next}>Continue <ArrowRight size={16} /></button>
            )}
          </>
        )}

        {ex.type === "true_false" && (
          <>
            <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
              {["True", "False"].map((opt) => {
                const isCorrect = opt === ex.correct, chosen = answer === opt;
                let border = "var(--line)", bg = "#fff";
                if (checked && chosen) { border = isCorrect ? "var(--turq)" : "var(--coral)"; bg = isCorrect ? "#E7F6F1" : "#FDEAE6"; }
                return (
                  <button key={opt} disabled={checked} onClick={() => setAnswer(opt)}
                    style={{ flex: 1, padding: "14px", borderRadius: 11, border: `1.5px solid ${border}`, background: bg, fontSize: 14.5, fontWeight: 600 }}>
                    {opt}
                  </button>
                );
              })}
            </div>
            {!checked ? (
              <button className="vl-btn-primary" disabled={!answer} style={{ opacity: answer ? 1 : 0.5 }}
                onClick={() => { setChecked(true); if (answer === ex.correct) setScore((s) => s + 1); }}>Check answer</button>
            ) : (
              <button className="vl-btn-primary" onClick={next}>Continue <ArrowRight size={16} /></button>
            )}
          </>
        )}

        {ex.type === "fill_blank" && (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
              {ex.options.map((opt) => {
                const isCorrect = opt === ex.correct, chosen = answer === opt;
                let border = "var(--line)", bg = "#fff";
                if (checked && chosen) { border = isCorrect ? "var(--turq)" : "var(--coral)"; bg = isCorrect ? "#E7F6F1" : "#FDEAE6"; }
                return (
                  <button key={opt} disabled={checked} onClick={() => setAnswer(opt)}
                    style={{ padding: "10px 16px", borderRadius: 999, border: `1.5px solid ${border}`, background: bg, fontSize: 14 }}>
                    {opt}
                  </button>
                );
              })}
            </div>
            {!checked ? (
              <button className="vl-btn-primary" disabled={!answer} style={{ opacity: answer ? 1 : 0.5 }}
                onClick={() => { setChecked(true); if (answer === ex.correct) setScore((s) => s + 1); }}>Check answer</button>
            ) : (
              <button className="vl-btn-primary" onClick={next}>Continue <ArrowRight size={16} /></button>
            )}
          </>
        )}

        {ex.type === "matching" && <MatchingExercise pairs={ex.pairs} onDone={next} />}
        {ex.type === "order_events" && <OrderExercise items={ex.items} correctOrder={ex.correctOrder} onDone={next} />}

        {ex.type === "short_answer" && (
          <>
            <textarea value={shortAnswer} onChange={(e) => setShortAnswer(e.target.value)} rows={4}
              placeholder="Write your answer in English or French…"
              style={{ width: "100%", padding: 14, borderRadius: 11, border: "1.5px solid var(--line)", fontSize: 14, fontFamily: "inherit", marginBottom: 14, resize: "vertical" }} />
            {!revealModel ? (
              <button className="vl-btn-primary" disabled={!shortAnswer.trim()} style={{ opacity: shortAnswer.trim() ? 1 : 0.5 }} onClick={() => setRevealModel(true)}>Compare with model answer</button>
            ) : (
              <div>
                <div style={{ background: "var(--cream)", borderRadius: 10, padding: 14, marginBottom: 14 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--navy)" }}>MODEL ANSWER</p>
                  <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.55 }}>{ex.modelAnswer}</p>
                </div>
                <button className="vl-btn-primary" onClick={next}>Finish practice <ArrowRight size={16} /></button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   VOCABULARY
   ──────────────────────────────────────────────────────────── */

function Vocabulary({ language }) {
  const list = language === "English" ? ENGLISH_VOCAB : VOCAB;
  const speakLang = language === "English" ? "en-US" : undefined;
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = list[i];
  const go = (dir) => { setFlipped(false); setI((prev) => (prev + dir + list.length) % list.length); };

  return (
    <div className="vl-fade-in" style={{ padding: "36px 44px", maxWidth: 720 }}>
      <h1 className="vl-serif" style={{ fontSize: 28, color: "var(--navy)", margin: "0 0 6px" }}>Vocabulary</h1>
      <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 28 }}>Spaced-repetition review · {i + 1} of {list.length}</p>

      <div onClick={() => setFlipped(!flipped)} className="vl-card"
        style={{ padding: 40, minHeight: 240, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", cursor: "pointer" }}>
        {!flipped ? (
          <>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 10 }}>{card.pos}</span>
            <h2 className="vl-serif" style={{ fontSize: 32, color: "var(--navy)", margin: "0 0 10px" }}>{card.word}</h2>
            <p style={{ color: "var(--ink-soft)", fontSize: 15 }}>{card.ipa}</p>
            <button style={{ marginTop: 16, background: "var(--cream)", border: "none", borderRadius: 10, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={(e) => { e.stopPropagation(); speak(card.word, speakLang); }}>
              <Volume2 size={17} color="var(--navy)" />
            </button>
            <p style={{ marginTop: 20, fontSize: 12.5, color: "var(--ink-soft)" }}>Tap to reveal meaning</p>
          </>
        ) : (
          <>
            <h3 style={{ fontSize: 22, color: "var(--turq-dark)", fontWeight: 700, margin: "0 0 12px" }}>{card.en}</h3>
            <p style={{ fontSize: 15, color: "var(--ink-soft)", fontStyle: "italic" }}>« {card.ex} »</p>
          </>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
        <button className="vl-btn-ghost" onClick={() => go(-1)}><ChevronLeft size={16} /> Previous</button>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ background: "#FDEAE6", border: "none", borderRadius: 10, padding: "10px 18px", color: "var(--coral-dark)", fontWeight: 600, fontSize: 13 }}
            onClick={() => go(1)}>Still learning</button>
          <button style={{ background: "#E7F6F1", border: "none", borderRadius: 10, padding: "10px 18px", color: "var(--turq-dark)", fontWeight: 600, fontSize: 13 }}
            onClick={() => go(1)}>Got it</button>
        </div>
        <button className="vl-btn-ghost" onClick={() => go(1)}>Next <ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   AI TUTOR — scenario picker, live chat, and post-chat report
   ──────────────────────────────────────────────────────────── */

const SCENARIOS = [
  { id: "free", title: "Free conversation", objective: "Chat about anything — your day, your goals, or whatever's on your mind.", vocab: [], difficulty: "Adaptive", duration: "Open-ended", icon: MessageCircle },
  { id: "restaurant", title: "Ordering at a restaurant", objective: "Order a meal, ask about ingredients, and request the bill.", vocab: ["l'addition", "une réservation", "à point", "l'entrée"], difficulty: "A2–B1", duration: "5–8 min", icon: Bookmark },
  { id: "doctor", title: "Visiting a doctor", objective: "Describe symptoms and understand basic medical advice.", vocab: ["j'ai mal à…", "une ordonnance", "les symptômes", "un rendez-vous"], difficulty: "B1", duration: "6–10 min", icon: RefreshCw },
  { id: "interview", title: "Job interview", objective: "Talk about your experience and answer common interview questions.", vocab: ["mes compétences", "l'expérience", "disponible", "un entretien"], difficulty: "B1–B2", duration: "8–10 min", icon: Award },
  { id: "landlord", title: "Speaking with a landlord", objective: "Discuss an apartment viewing, rent, and lease terms.", vocab: ["le loyer", "le bail", "les charges", "disponible à partir de"], difficulty: "B1", duration: "6–8 min", icon: Home },
  { id: "directions", title: "Asking for directions", objective: "Ask how to get somewhere and understand spoken directions.", vocab: ["tout droit", "à gauche/à droite", "au coin de", "c'est loin ?"], difficulty: "A1–A2", duration: "4–6 min", icon: Map },
  { id: "hotel", title: "Checking into a hotel", objective: "Check in, ask about amenities, and handle a booking issue.", vocab: ["une réservation", "la clé", "le petit-déjeuner", "la chambre"], difficulty: "A2", duration: "5–7 min", icon: Bookmark },
  { id: "immigration", title: "Airport immigration", objective: "Answer common questions when entering the country.", vocab: ["le motif du voyage", "la durée du séjour", "un passeport", "je réside à…"], difficulty: "A2–B1", duration: "3–5 min", icon: Globe },
];

const SCENARIO_OPENERS = {
  free: "Salut Maya ! Prête à pratiquer un peu de français aujourd'hui ? On peut parler de ta routine, ou d'autre chose si tu préfères. 😊",
  restaurant: "Bonsoir ! Bienvenue au restaurant. Vous avez une réservation, ou une table pour une personne ?",
  doctor: "Bonjour, entrez, asseyez-vous. Alors, qu'est-ce qui vous amène aujourd'hui ?",
  interview: "Bonjour Maya, merci d'être venue. Pour commencer, est-ce que vous pouvez me parler un peu de votre parcours ?",
  landlord: "Bonjour ! Vous êtes ici pour visiter l'appartement du 3ème étage, c'est ça ?",
  directions: "Bonjour, je peux vous aider ? Vous cherchez quelque chose ?",
  hotel: "Bonsoir, bienvenue à l'hôtel. Vous avez une réservation à quel nom ?",
  immigration: "Bonjour. Passeport, s'il vous plaît. Quel est le motif de votre voyage ?",
};

const SCENARIO_OPENERS_EN = {
  free: "Hi! Ready to practice some English today? We can talk about your routine, or anything else you'd like. 😊",
  restaurant: "Good evening! Welcome in. Do you have a reservation, or a table for one?",
  doctor: "Hello, come in, have a seat. So, what brings you in today?",
  interview: "Hi, thanks for coming in. To start, could you tell me a bit about your background?",
  landlord: "Hi there! You're here to see the apartment on the 3rd floor, right?",
  directions: "Hi, can I help you? Are you looking for something?",
  hotel: "Good evening, welcome to the hotel. Do you have a reservation under what name?",
  immigration: "Hello. Passport, please. What's the purpose of your trip?",
};

function ScenarioReport({ scenario, messages, onRepeat, onExit }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const transcript = messages.map((m) => `${m.role === "user" ? "Maya" : "Tutor"}: ${m.text}`).join("\n");
        const prompt = `You are reviewing a French practice conversation for the scenario "${scenario.title}". Here is the transcript:\n\n${transcript}\n\nRespond with ONLY valid JSON, no preamble, no markdown fences, matching exactly this shape:\n{"wentWell": "1-2 sentences", "corrections": "1-2 sentences on the most important mistakes, or 'None — great accuracy!' if none", "newVocab": ["word1","word2","word3"], "fluencyFeedback": "1 sentence", "suggestedPractice": "1 sentence"}`;
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 500, messages: [{ role: "user", content: prompt }] }),
        });
        const data = await response.json();
        const textBlock = (data.content || []).find((b) => b.type === "text");
        const clean = (textBlock?.text || "{}").replace(/```json|```/g, "").trim();
        if (!cancelled) setReport(JSON.parse(clean));
      } catch (e) {
        if (!cancelled) setReport({ wentWell: "You stayed in the conversation and kept responding — that's real progress.", corrections: "Couldn't generate detailed feedback this time.", newVocab: [], fluencyFeedback: "", suggestedPractice: "Try this scenario again for more practice." });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="vl-fade-in" style={{ padding: "36px 44px", maxWidth: 640 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--lavender-dark)", letterSpacing: 0.3 }}>CONVERSATION REPORT</span>
      <h1 className="vl-serif" style={{ fontSize: 26, color: "var(--navy)", margin: "8px 0 20px" }}>{scenario.title}</h1>

      {loading ? (
        <div className="vl-card" style={{ padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} color="var(--lavender-dark)" />
          <p style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>Reviewing your conversation…</p>
          <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="vl-card" style={{ padding: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--turq-dark)", margin: "0 0 6px" }}>WHAT YOU DID WELL</p>
            <p style={{ fontSize: 14, color: "var(--ink)", margin: 0, lineHeight: 1.55 }}>{report.wentWell}</p>
          </div>
          <div className="vl-card" style={{ padding: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--coral-dark)", margin: "0 0 6px" }}>CORRECTIONS TO REMEMBER</p>
            <p style={{ fontSize: 14, color: "var(--ink)", margin: 0, lineHeight: 1.55 }}>{report.corrections}</p>
          </div>
          {report.newVocab?.length > 0 && (
            <div className="vl-card" style={{ padding: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)", margin: "0 0 10px" }}>NEW VOCABULARY</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {report.newVocab.map((w) => (
                  <span key={w} style={{ background: "var(--cream)", padding: "6px 12px", borderRadius: 999, fontSize: 13, color: "var(--navy)" }}>{w}</span>
                ))}
              </div>
            </div>
          )}
          <div className="vl-card" style={{ padding: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--lavender-dark)", margin: "0 0 6px" }}>FLUENCY & NEXT STEPS</p>
            <p style={{ fontSize: 14, color: "var(--ink)", margin: "0 0 6px", lineHeight: 1.55 }}>{report.fluencyFeedback}</p>
            <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: 0, lineHeight: 1.55, fontStyle: "italic" }}>{report.suggestedPractice}</p>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button className="vl-btn-primary" onClick={onRepeat}>Repeat this conversation</button>
            <button className="vl-btn-ghost" onClick={onExit}>Choose another scenario</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Tutor({ language }) {
  const isEnglish = language === "English";
  const tutorName = isEnglish ? "Alex" : "Camille";
  const recognitionLang = isEnglish ? "en-US" : "fr-FR";
  const speakLang = isEnglish ? "en-US" : undefined;
  const openers = isEnglish ? SCENARIO_OPENERS_EN : SCENARIO_OPENERS;
  const [stage, setStage] = useState("picker"); // picker | brief | chat | report
  const [scenario, setScenario] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(true);
  const [voiceOn, setVoiceOn] = useState(true);
  const endRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []); // stop talking if the user navigates away

  const chooseScenario = (s) => { setScenario(s); setStage("brief"); };
  const startConversation = () => {
    const opener = openers[scenario.id] || openers.free;
    setMessages([{ role: "assistant", text: opener }]);
    setStage("chat");
    if (voiceOn) speak(opener, speakLang);
  };
  const backToPicker = () => { window.speechSynthesis?.cancel(); setStage("picker"); setScenario(null); setMessages([]); };

  const toggleMic = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setMicSupported(false); return; }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = recognitionLang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput((prev) => (prev ? prev + " " + transcript : transcript));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    const newMessages = [...messages, { role: "user", text: userMsg }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const history = newMessages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.text,
      }));
      const scenarioLine = scenario.id === "free"
        ? "This is an open free-conversation practice session."
        : `This is a role-play scenario: "${scenario.title}". Objective: ${scenario.objective} Stay in character for this situation and keep the scene realistic.`;
      const systemPrimer = isEnglish ? {
        role: "user",
        content: `SYSTEM CONTEXT (do not repeat this back): You are Alex, a warm, patient AI English tutor inside the VerbaLune app, talking with a French-speaking A1-level learner. ${scenarioLine} Reply in English matched to an A1 level (simple, everyday vocabulary, short sentences), keep responses short (2-4 sentences), gently correct any significant mistakes in their last message by rephrasing naturally within your reply, and keep the conversation moving with a follow-up question or the next beat of the scene. Never break character or mention being an AI model.`
      } : {
        role: "user",
        content: `SYSTEM CONTEXT (do not repeat this back): You are Camille, a warm, patient AI French tutor inside the VerbaLune app, talking with Maya, a B1-level learner preparing for life in Montréal. ${scenarioLine} Reply in French matched to a B1 level (simple but natural), keep responses short (2-4 sentences), gently correct any significant mistakes in her last message by rephrasing naturally within your reply, and keep the conversation moving with a follow-up question or the next beat of the scene. Never break character or mention being an AI model.`
      };
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [systemPrimer, ...history],
        }),
      });
      const data = await response.json();
      const textBlock = (data.content || []).find((b) => b.type === "text");
      const reply = textBlock ? textBlock.text : (isEnglish ? "Sorry, I didn't quite catch that — can you say it again?" : "Désolée, je n'ai pas bien compris — tu peux répéter ?");
      setMessages((cur) => [...cur, { role: "assistant", text: reply }]);
      if (voiceOn) speak(reply, speakLang);
    } catch (e) {
      setMessages((cur) => [...cur, { role: "assistant", text: isEnglish ? "Small connection hiccup — try again in a moment." : "Petit souci de connexion — réessaie dans un instant." }]);
    } finally {
      setLoading(false);
    }
  };

  if (stage === "picker") {
    return (
      <div className="vl-fade-in" style={{ padding: "36px 44px", maxWidth: 860 }}>
        <h1 className="vl-serif" style={{ fontSize: 28, color: "var(--navy)", margin: "0 0 6px" }}>AI Tutor · {tutorName}</h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 26 }}>Choose a scenario, or start a free conversation.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {SCENARIOS.map((s) => (
            <button key={s.id} onClick={() => chooseScenario(s)} className="vl-card"
              style={{ padding: 18, textAlign: "left", border: "1.5px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: s.id === "free" ? "linear-gradient(135deg, var(--coral), var(--gold))" : "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <s.icon size={16} color={s.id === "free" ? "#fff" : "var(--navy)"} />
              </div>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "var(--navy)" }}>{s.title}</p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>{s.difficulty} · {s.duration}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (stage === "brief") {
    return (
      <div className="vl-fade-in" style={{ padding: "36px 44px", maxWidth: 560 }}>
        <button onClick={backToPicker} style={{ background: "none", border: "none", color: "var(--ink-soft)", fontSize: 13, display: "flex", alignItems: "center", gap: 5, marginBottom: 18 }}>
          <ChevronLeft size={15} /> All scenarios
        </button>
        <div className="vl-card" style={{ padding: 28 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, var(--coral), var(--lavender))", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <scenario.icon size={20} color="#fff" />
          </div>
          <h2 className="vl-serif" style={{ fontSize: 24, color: "var(--navy)", margin: "0 0 10px" }}>{scenario.title}</h2>
          <p style={{ fontSize: 14.5, color: "var(--ink-soft)", lineHeight: 1.6, marginBottom: 20 }}>{scenario.objective}</p>
          <div style={{ display: "flex", gap: 24, marginBottom: scenario.vocab.length ? 18 : 24 }}>
            <div>
              <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "0 0 3px" }}>Difficulty</p>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--navy)", margin: 0 }}>{scenario.difficulty}</p>
            </div>
            <div>
              <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "0 0 3px" }}>Est. duration</p>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--navy)", margin: 0 }}>{scenario.duration}</p>
            </div>
            <div>
              <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "0 0 3px" }}>Voice</p>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--navy)", margin: 0 }}>{isEnglish ? "Female · American" : "Female · Québécois"}</p>
            </div>
          </div>
          {scenario.vocab.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "0 0 8px" }}>Recommended vocabulary</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {scenario.vocab.map((w) => (
                  <span key={w} style={{ background: "var(--cream)", padding: "6px 12px", borderRadius: 999, fontSize: 13, color: "var(--navy)" }}>{w}</span>
                ))}
              </div>
            </div>
          )}
          <button className="vl-btn-primary" onClick={startConversation}>Start conversation <ArrowRight size={16} /></button>
        </div>
      </div>
    );
  }

  if (stage === "report") {
    return <ScenarioReport scenario={scenario} messages={messages} onRepeat={startConversation} onExit={backToPicker} />;
  }

  return (
    <div className="vl-fade-in" style={{ padding: "36px 44px", maxWidth: 720, display: "flex", flexDirection: "column", height: "calc(100vh - 72px)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--lavender)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MessageCircle size={19} color="var(--navy)" />
          </div>
          <div>
            <h2 className="vl-serif" style={{ fontSize: 20, color: "var(--navy)", margin: 0 }}>{scenario.title}</h2>
            <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: 0 }}>Adapting to your level · {isEnglish ? "English" : "French"} · with {tutorName}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setVoiceOn(!voiceOn); if (voiceOn) window.speechSynthesis?.cancel(); }}
            title={voiceOn ? "Turn off spoken replies" : "Turn on spoken replies"}
            style={{ background: voiceOn ? "var(--cream)" : "none", border: "1px solid var(--line)", borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {voiceOn ? <Volume2 size={15} color="var(--navy)" /> : <VolumeX size={15} color="var(--ink-soft)" />}
          </button>
          <button onClick={backToPicker} style={{ background: "none", border: "1px solid var(--line)", borderRadius: 10, padding: "7px 12px", fontSize: 12.5, color: "var(--ink-soft)" }}>
            Change scenario
          </button>
        </div>
      </div>

      <div className="vl-scroll vl-card" style={{ flex: 1, padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            background: m.role === "user" ? "var(--navy)" : "var(--cream-dim)",
            color: m.role === "user" ? "#fff" : "var(--ink)",
            borderRadius: m.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
            padding: "10px 15px", maxWidth: "78%", fontSize: 14.5, lineHeight: 1.5,
          }}>
            {m.text}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 8, color: "var(--ink-soft)", fontSize: 13 }}>
            <Loader2 size={14} className="vl-spin" style={{ animation: "spin 1s linear infinite" }} /> {tutorName} is typing…
          </div>
        )}
        <div ref={endRef} />
      </div>


      <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
        <button style={{
            background: listening ? "var(--coral)" : "#fff", border: `1px solid ${listening ? "var(--coral)" : "var(--line)"}`,
            borderRadius: 12, width: 46, height: 46, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
          }}
          onClick={toggleMic} title={micSupported ? "Speak your reply" : "Voice input isn't supported in this browser"}>
          <Mic size={18} color={listening ? "#fff" : "var(--navy)"} />
        </button>
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={listening ? "Listening…" : isEnglish ? "Type your reply in English…" : "Écris ta réponse en français…"}
          style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 12, padding: "0 16px", fontSize: 14.5, fontFamily: "inherit" }} />
        <button className="vl-btn-primary" onClick={send} disabled={loading} style={{ opacity: loading ? 0.6 : 1 }}>
          <Send size={16} />
        </button>
      </div>
      {!micSupported && (
        <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 8 }}>
          Voice input isn't supported in this browser — try typing instead, or use Chrome for microphone dictation.
        </p>
      )}
      {messages.length >= 3 && (
        <button onClick={() => setStage("report")} style={{ background: "none", border: "none", color: "var(--lavender-dark)", fontSize: 12.5, fontWeight: 600, marginTop: 10, alignSelf: "center", display: "flex", alignItems: "center", gap: 5 }}>
          End conversation & get feedback <ChevronRight size={13} />
        </button>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   PROGRESS
   ──────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────
   END-OF-LEVEL ASSESSMENT
   ──────────────────────────────────────────────────────────── */

const ASSESSMENT_TASKS = [
  {
    skill: "Reading", type: "reading",
    passage: "Bonjour,\n\nMerci de confirmer votre visite de l'appartement demain à 14h. C'est au 3ème étage, et il y a un ascenseur. Le loyer est de 950$ par mois, charges comprises. Merci d'apporter une pièce d'identité et vos trois derniers relevés bancaires.\n\nÀ demain,\nMarc",
    questions: [
      { prompt: "What time is the apartment visit?", options: ["10h", "14h", "16h", "18h"], correct: "14h" },
      { prompt: "True or false: the rent does NOT include utility charges.", options: ["True", "False"], correct: "False" },
    ],
  },
  {
    skill: "Listening", type: "listening",
    audioText: "Le rendez-vous chez le médecin est déplacé à jeudi matin, à neuf heures et demie.",
    question: {
      prompt: "When is the new appointment?",
      options: ["Thursday morning at 9:30", "Thursday afternoon at 9:30", "Tuesday morning at 9:30", "Thursday morning at 9:00"],
      correct: "Thursday morning at 9:30",
    },
  },
  {
    skill: "Grammar", type: "grammar",
    prompt: "Complete: « Le matin, elle ___ à sept heures. »",
    options: ["se lève", "se lever", "lève", "se levez"],
    correct: "se lève",
  },
  {
    skill: "Conjugation", type: "conjugation",
    prompt: "Complete: « Nous ___ le français depuis six mois. »",
    options: ["étudions", "étudie", "étudiez", "étudient"],
    correct: "étudions",
  },
  {
    skill: "Speaking", type: "speaking",
    prompt: "Décris ta routine du matin en 3 ou 4 phrases.",
  },
  {
    skill: "Writing", type: "writing",
    prompt: "Écris un court message à un(e) collègue pour annoncer un changement d'horaire de réunion (3 à 4 phrases).",
  },
];

async function gradeOpenResponse(skill, prompt, responseText) {
  const rubric = skill === "Writing"
    ? "grammar, vocabulary, organization, clarity, and whether the task was actually completed"
    : "grammar, vocabulary, and how relevant and complete the answer is to the prompt (note: this is graded from a text transcript, so pronunciation cannot be assessed)";
  const gradingPrompt = `You are grading a French-language learner's ${skill.toLowerCase()} task for an A1-level (beginner) end-of-course assessment.

Task prompt: "${prompt}"
Learner's response: "${responseText}"

Grade it out of 100 based on ${rubric}, calibrated for an A1 beginner — do not expect native fluency. Respond with ONLY valid JSON, no markdown fences, no preamble, matching exactly: {"score": <integer 0-100>, "feedback": "<one short encouraging sentence in English explaining the score>"}`;
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 300, messages: [{ role: "user", content: gradingPrompt }] }),
  });
  const data = await response.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  const clean = (textBlock?.text || "{}").replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(clean);
    return { score: Math.max(0, Math.min(100, Math.round(parsed.score))), feedback: parsed.feedback || "" };
  } catch (e) {
    return { score: 65, feedback: "Couldn't generate detailed feedback this time, but your response was recorded." };
  }
}

const REVIEW_ACTIVITIES = {
  Listening: "Slowed-down audio, then natural-speed replays of the same dialogues",
  Speaking: "Guided pronunciation drills and short role-play practice",
  Conjugation: "Personalized verb drills targeting your missed tenses",
  Grammar: "Targeted explanations with sentence-building exercises",
  Reading: "Short passages with comprehension checks",
  Writing: "Guided writing tasks with AI corrections",
};

function LevelAssessment({ onExit, user }) {
  const [stage, setStage] = useState("intro"); // intro | testing | grading | result | certificate | review
  const [taskIndex, setTaskIndex] = useState(0);
  const [scores, setScores] = useState({});
  const [feedbackBySkill, setFeedbackBySkill] = useState({});
  const [shareMsg, setShareMsg] = useState("");
  const [reviewStarted, setReviewStarted] = useState({});

  // Per-task working state, reset between tasks.
  const [readingAnswers, setReadingAnswers] = useState([null, null]);
  const [readingChecked, setReadingChecked] = useState(false);
  const [listenAnswer, setListenAnswer] = useState(null);
  const [listenChecked, setListenChecked] = useState(false);
  const [hasPlayedAudio, setHasPlayedAudio] = useState(false);
  const [mcAnswer, setMcAnswer] = useState(null);
  const [mcChecked, setMcChecked] = useState(false);
  const [openText, setOpenText] = useState("");
  const [recording, setRecording] = useState(false);
  const [gradingTask, setGradingTask] = useState(false);
  const recognitionRef = useRef(null);

  const results = Object.entries(scores).map(([name, value]) => ({ name, value }));
  const overall = results.length ? Math.round(results.reduce((s, r) => s + r.value, 0) / results.length) : 0;
  const weakSkills = results.filter((r) => r.value < 60);
  const passed = results.length === ASSESSMENT_TASKS.length && overall >= 75 && weakSkills.length === 0;
  const certId = "VL-A1-" + (user?.uid || "GUEST").slice(0, 4).toUpperCase() + "-" + Date.now().toString(36).toUpperCase().slice(-4);
  const learnerName = user?.displayName || user?.email || "VerbaLune Learner";

  const downloadCertificate = () => {
    const dataUrl = generateCertificatePNG({
      name: learnerName,
      level: "A1",
      levelName: "Beginner",
      score: overall,
      date: new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }),
      certId,
    });
    downloadDataUrl(dataUrl, `VerbaLune-Certificate-A1-${learnerName.replace(/\s+/g, "-")}.png`);
  };

  const shareCertificate = async () => {
    const text = `I just completed Level A1 French on VerbaLune with ${overall}%! Certificate ${certId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "VerbaLune Certificate", text });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setShareMsg("Copied to clipboard");
        setTimeout(() => setShareMsg(""), 2500);
      }
    } catch (e) { /* user cancelled share */ }
  };

  const recordScore = (skill, value, feedback) => {
    setScores((cur) => ({ ...cur, [skill]: value }));
    if (feedback) setFeedbackBySkill((cur) => ({ ...cur, [skill]: feedback }));
  };

  const resetTaskState = () => {
    setReadingAnswers([null, null]); setReadingChecked(false);
    setListenAnswer(null); setListenChecked(false); setHasPlayedAudio(false);
    setMcAnswer(null); setMcChecked(false);
    setOpenText(""); setRecording(false);
  };

  const goNextTask = () => {
    resetTaskState();
    if (taskIndex < ASSESSMENT_TASKS.length - 1) setTaskIndex(taskIndex + 1);
    else setStage("result");
  };

  const submitOpenTask = async (task) => {
    if (!openText.trim()) return;
    setGradingTask(true);
    try {
      const { score, feedback } = await gradeOpenResponse(task.skill, task.prompt, openText.trim());
      recordScore(task.skill, score, feedback);
    } catch (e) {
      recordScore(task.skill, 65, "Couldn't reach the grader this time, but your response was recorded.");
    } finally {
      setGradingTask(false);
      goNextTask();
    }
  };

  const toggleRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return; // falls back to the text box already shown
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setOpenText((prev) => (prev ? prev + " " + transcript : transcript));
    };
    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  };

  if (stage === "intro") {
    return (
      <div className="vl-fade-in" style={{ padding: "36px 44px", maxWidth: 640 }}>
        <button onClick={onExit} style={{ background: "none", border: "none", color: "var(--ink-soft)", fontSize: 13, display: "flex", alignItems: "center", gap: 5, marginBottom: 18 }}>
          <ChevronLeft size={15} /> Back to progress
        </button>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--lavender-dark)", letterSpacing: 0.3 }}>LEVEL A1 · END-OF-LEVEL ASSESSMENT</span>
        <h1 className="vl-serif" style={{ fontSize: 28, color: "var(--navy)", margin: "8px 0 14px" }}>Let's see what you've learned</h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 14.5, lineHeight: 1.6, marginBottom: 24 }}>
          This assessment covers reading, listening, speaking, writing, grammar and conjugation with content you
          haven't seen before. You'll need 75% overall and at least 60% in every skill to unlock A2 — and if a
          couple of skills fall short, you'll only need to review those, not the whole level. Speaking and writing
          are graded by AI; everything else is graded instantly.
        </p>
        <div className="vl-card" style={{ padding: 20, marginBottom: 24 }}>
          {ASSESSMENT_TASKS.map((t, i) => (
            <div key={t.skill} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < ASSESSMENT_TASKS.length - 1 ? "1px solid var(--line)" : "none" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--cream-dim)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--navy)" }}>{i + 1}</div>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--navy)" }}>{t.skill}</p>
            </div>
          ))}
        </div>
        <button className="vl-btn-primary" onClick={() => setStage("testing")}>Begin — Exam Mode <ArrowRight size={16} /></button>
      </div>
    );
  }

  if (stage === "testing") {
    const task = ASSESSMENT_TASKS[taskIndex];

    return (
      <div className="vl-fade-in" style={{ padding: "36px 44px", maxWidth: 640 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--coral-dark)" }}>EXAM MODE</span>
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Task {taskIndex + 1} of {ASSESSMENT_TASKS.length}</span>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 26 }}>
          {ASSESSMENT_TASKS.map((_, i) => (
            <div key={i} style={{ height: 4, flex: 1, borderRadius: 2, background: i <= taskIndex ? "var(--coral)" : "var(--line)" }} />
          ))}
        </div>

        <div className="vl-card" style={{ padding: 28 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--turq-dark)", marginBottom: 14, display: "block" }}>{task.skill}</span>

          {task.type === "reading" && (
            <>
              <div style={{ background: "var(--cream)", borderRadius: 10, padding: 16, marginBottom: 18, fontSize: 13.5, color: "var(--ink)", whiteSpace: "pre-line", lineHeight: 1.6 }}>
                {task.passage}
              </div>
              {task.questions.map((q, qi) => (
                <div key={qi} style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--navy)", marginBottom: 10 }}>{q.prompt}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {q.options.map((opt) => {
                      const chosen = readingAnswers[qi] === opt, isCorrect = opt === q.correct;
                      let border = "var(--line)", bg = "#fff";
                      if (readingChecked && chosen) { border = isCorrect ? "var(--turq)" : "var(--coral)"; bg = isCorrect ? "#E7F6F1" : "#FDEAE6"; }
                      if (readingChecked && isCorrect && !chosen) border = "var(--turq)";
                      return (
                        <button key={opt} disabled={readingChecked}
                          onClick={() => setReadingAnswers((cur) => cur.map((a, i) => (i === qi ? opt : a)))}
                          style={{ textAlign: "left", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${border}`, background: bg, fontSize: 13.5 }}>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {!readingChecked ? (
                <button className="vl-btn-primary" disabled={readingAnswers.some((a) => !a)} style={{ opacity: readingAnswers.some((a) => !a) ? 0.5 : 1 }}
                  onClick={() => {
                    setReadingChecked(true);
                    const correct = task.questions.filter((q, i) => readingAnswers[i] === q.correct).length;
                    recordScore(task.skill, Math.round((correct / task.questions.length) * 100));
                  }}>Check answers</button>
              ) : (
                <button className="vl-btn-primary" onClick={goNextTask}>Continue <ArrowRight size={16} /></button>
              )}
            </>
          )}

          {task.type === "listening" && (
            <>
              <div style={{ textAlign: "center", padding: "20px 0 24px" }}>
                <button onClick={() => { speak(task.audioText); setHasPlayedAudio(true); }}
                  style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, var(--coral), var(--gold))", border: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <Volume2 size={26} color="#fff" />
                </button>
                <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 10 }}>{hasPlayedAudio ? "Tap to replay" : "Tap to play the audio"}</p>
              </div>
              {hasPlayedAudio && (
                <>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--navy)", marginBottom: 10 }}>{task.question.prompt}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                    {task.question.options.map((opt) => {
                      const chosen = listenAnswer === opt, isCorrect = opt === task.question.correct;
                      let border = "var(--line)", bg = "#fff";
                      if (listenChecked && chosen) { border = isCorrect ? "var(--turq)" : "var(--coral)"; bg = isCorrect ? "#E7F6F1" : "#FDEAE6"; }
                      if (listenChecked && isCorrect && !chosen) border = "var(--turq)";
                      return (
                        <button key={opt} disabled={listenChecked} onClick={() => setListenAnswer(opt)}
                          style={{ textAlign: "left", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${border}`, background: bg, fontSize: 13.5 }}>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {!listenChecked ? (
                    <button className="vl-btn-primary" disabled={!listenAnswer} style={{ opacity: listenAnswer ? 1 : 0.5 }}
                      onClick={() => { setListenChecked(true); recordScore(task.skill, listenAnswer === task.question.correct ? 100 : 0); }}>
                      Check answer
                    </button>
                  ) : (
                    <button className="vl-btn-primary" onClick={goNextTask}>Continue <ArrowRight size={16} /></button>
                  )}
                </>
              )}
            </>
          )}

          {(task.type === "grammar" || task.type === "conjugation") && (
            <>
              <p style={{ fontSize: 15, marginBottom: 18 }}>{task.prompt}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                {task.options.map((opt) => {
                  const chosen = mcAnswer === opt, isCorrect = opt === task.correct;
                  let border = "var(--line)", bg = "#fff";
                  if (mcChecked && chosen) { border = isCorrect ? "var(--turq)" : "var(--coral)"; bg = isCorrect ? "#E7F6F1" : "#FDEAE6"; }
                  if (mcChecked && isCorrect && !chosen) border = "var(--turq)";
                  return (
                    <button key={opt} disabled={mcChecked} onClick={() => setMcAnswer(opt)}
                      style={{ textAlign: "left", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${border}`, background: bg, fontSize: 14 }}>
                      {opt}
                    </button>
                  );
                })}
              </div>
              {!mcChecked ? (
                <button className="vl-btn-primary" disabled={!mcAnswer} style={{ opacity: mcAnswer ? 1 : 0.5 }}
                  onClick={() => { setMcChecked(true); recordScore(task.skill, mcAnswer === task.correct ? 100 : 0); }}>
                  Check answer
                </button>
              ) : (
                <button className="vl-btn-primary" onClick={goNextTask}>Continue <ArrowRight size={16} /></button>
              )}
            </>
          )}

          {(task.type === "speaking" || task.type === "writing") && (
            <>
              <p style={{ fontSize: 15, marginBottom: 16 }}>{task.prompt}</p>
              {task.type === "speaking" && (
                <button onClick={toggleRecording}
                  style={{ display: "flex", alignItems: "center", gap: 8, background: recording ? "var(--coral)" : "var(--cream)", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 13, color: recording ? "#fff" : "var(--navy)", marginBottom: 12 }}>
                  <Mic size={15} /> {recording ? "Recording… tap to stop" : "Tap to record your answer"}
                </button>
              )}
              <textarea value={openText} onChange={(e) => setOpenText(e.target.value)} rows={4}
                placeholder={task.type === "speaking" ? "Your recorded answer will appear here — you can also just type it" : "Écris ta réponse ici…"}
                style={{ width: "100%", padding: 14, borderRadius: 11, border: "1.5px solid var(--line)", fontSize: 14, fontFamily: "inherit", marginBottom: 14, resize: "vertical" }} />
              <button className="vl-btn-primary" disabled={!openText.trim() || gradingTask} style={{ opacity: !openText.trim() || gradingTask ? 0.6 : 1 }}
                onClick={() => submitOpenTask(task)}>
                {gradingTask ? "Grading…" : "Submit"} {!gradingTask && <ArrowRight size={16} />}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (stage === "result") {
    return (
      <div className="vl-fade-in" style={{ padding: "36px 44px", maxWidth: 680 }}>
        <div className="vl-card" style={{ padding: 30, textAlign: "center", marginBottom: 22 }}>
          {passed ? (
            <>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "linear-gradient(135deg, var(--coral), var(--gold))", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Award size={28} color="#fff" />
              </div>
              <h2 className="vl-serif" style={{ fontSize: 26, color: "var(--navy)", margin: "0 0 8px" }}>Congratulations — you completed A1 with {overall}%</h2>
              <p style={{ color: "var(--ink-soft)", fontSize: 14.5, maxWidth: 440, margin: "0 auto" }}>
                Level A2 is now unlocked. You're ready to handle longer conversations and describe your daily life in more detail.
              </p>
            </>
          ) : (
            <>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--lavender)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <TrendingUp size={26} color="#fff" />
              </div>
              <h2 className="vl-serif" style={{ fontSize: 26, color: "var(--navy)", margin: "0 0 8px" }}>You're making good progress — {overall}%</h2>
              <p style={{ color: "var(--ink-soft)", fontSize: 14.5, maxWidth: 460, margin: "0 auto" }}>
                Your {weakSkills.map((s) => s.name.toLowerCase()).join(" and ")} need a little more practice before A2.
                Complete your personalized review, then retake this assessment whenever you're ready.
              </p>
            </>
          )}
        </div>

        <div className="vl-card" style={{ padding: 24, marginBottom: 22 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", margin: "0 0 16px" }}>Skill breakdown</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {results.map((r) => (
              <div key={r.name}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                  <span style={{ color: "var(--ink-soft)" }}>{r.name}</span>
                  <span style={{ fontWeight: 600, color: r.value < 60 ? "var(--coral-dark)" : "var(--navy)" }}>{r.value}%</span>
                </div>
                <div style={{ height: 7, background: "var(--cream-dim)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${r.value}%`, height: "100%", background: r.value < 60 ? "var(--coral)" : "var(--turq)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {passed ? (
          <div style={{ display: "flex", gap: 12 }}>
            <button className="vl-btn-primary" onClick={() => setStage("certificate")}>View certificate</button>
            <button className="vl-btn-ghost" onClick={onExit}>Continue to A2</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 12 }}>
            <button className="vl-btn-primary" onClick={() => setStage("review")}>Start personalized review</button>
            <button className="vl-btn-ghost" onClick={onExit}>Back to progress</button>
          </div>
        )}
      </div>
    );
  }

  if (stage === "certificate") {
    return (
      <div className="vl-fade-in" style={{ padding: "36px 44px", maxWidth: 680 }}>
        <button onClick={() => setStage("result")} style={{ background: "none", border: "none", color: "var(--ink-soft)", fontSize: 13, display: "flex", alignItems: "center", gap: 5, marginBottom: 18 }}>
          <ChevronLeft size={15} /> Back to results
        </button>

        <div className="vl-card" style={{
          padding: "44px 40px", textAlign: "center", position: "relative", overflow: "hidden",
          border: "1px solid var(--line)",
          backgroundImage: "radial-gradient(420px 220px at 10% 0%, rgba(255,93,93,0.08), transparent 60%), radial-gradient(420px 240px at 100% 100%, rgba(139,92,246,0.08), transparent 60%)"
        }}>
          <div style={{ position: "absolute", inset: 10, border: "1.5px solid var(--gold)", borderRadius: 12, opacity: 0.5, pointerEvents: "none" }} />
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <Logo size={40} />
          </div>
          <p style={{ fontSize: 12, letterSpacing: 1, color: "var(--ink-soft)", margin: "0 0 26px", fontWeight: 600 }}>VERBALUNE · CERTIFICATE OF COMPLETION</p>

          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 6px" }}>This certifies that</p>
          <h2 className="vl-serif" style={{ fontSize: 32, color: "var(--navy)", margin: "0 0 14px" }}>{learnerName}</h2>
          <p style={{ fontSize: 14.5, color: "var(--ink-soft)", lineHeight: 1.7, maxWidth: 420, margin: "0 auto 22px" }}>
            has successfully completed <strong style={{ color: "var(--navy)" }}>Level A1</strong> of the VerbaLune
            French course, achieving an overall score of <strong style={{ color: "var(--navy)" }}>{overall}%</strong>.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 36, margin: "0 0 26px" }}>
            <div>
              <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "0 0 3px" }}>Date</p>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--navy)", margin: 0 }}>
                {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            <div>
              <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "0 0 3px" }}>Certificate ID</p>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--navy)", margin: 0 }}>{certId}</p>
            </div>
          </div>

          <p style={{ fontSize: 11.5, color: "var(--ink-soft)", maxWidth: 380, margin: "0 auto" }}>
            This is a VerbaLune course-completion certificate, not an official government or accredited CEFR qualification.
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 22, justifyContent: "center", alignItems: "center" }}>
          <button className="vl-btn-primary" onClick={downloadCertificate}><Download size={15} /> Download PNG</button>
          <button className="vl-btn-ghost" onClick={shareCertificate}>Share</button>
          <button className="vl-btn-ghost" onClick={onExit}>Continue to A2</button>
          {shareMsg && <span style={{ fontSize: 12.5, color: "var(--turq-dark)", fontWeight: 600 }}>{shareMsg}</span>}
        </div>
      </div>
    );
  }

  // stage === "review"
  return (
    <div className="vl-fade-in" style={{ padding: "36px 44px", maxWidth: 640 }}>
      <button onClick={() => setStage("result")} style={{ background: "none", border: "none", color: "var(--ink-soft)", fontSize: 13, display: "flex", alignItems: "center", gap: 5, marginBottom: 18 }}>
        <ChevronLeft size={15} /> Back to results
      </button>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--lavender-dark)", letterSpacing: 0.3 }}>PERSONALIZED REVIEW PLAN</span>
      <h1 className="vl-serif" style={{ fontSize: 26, color: "var(--navy)", margin: "8px 0 12px" }}>
        Just {weakSkills.length} {weakSkills.length === 1 ? "skill needs" : "skills need"} a little more practice
      </h1>
      <p style={{ color: "var(--ink-soft)", fontSize: 14.5, lineHeight: 1.6, marginBottom: 24 }}>
        Everything else you completed for A1 stays saved — no need to repeat the whole level. Work through the
        review below, then retake the assessment whenever you're ready.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 26 }}>
        {weakSkills.map((s) => (
          <div key={s.name} className="vl-card" style={{ padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ margin: "0 0 3px", fontWeight: 600, color: "var(--navy)", fontSize: 14.5 }}>{s.name} <span style={{ fontWeight: 400, color: "var(--coral-dark)", fontSize: 12.5 }}>· {s.value}%</span></p>
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)" }}>{REVIEW_ACTIVITIES[s.name] || "Targeted practice based on your errors"}</p>
            </div>
            <button className="vl-btn-ghost" style={{ padding: "8px 16px", fontSize: 13, opacity: reviewStarted[s.name] ? 0.6 : 1 }}
              disabled={!!reviewStarted[s.name]}
              onClick={() => setReviewStarted((prev) => ({ ...prev, [s.name]: true }))}>
              {reviewStarted[s.name] ? <><Check size={14} /> Started</> : "Start"}
            </button>
          </div>
        ))}
      </div>

      <div className="vl-card" style={{ padding: 18, background: "var(--cream)", border: "none", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ margin: "0 0 3px", fontWeight: 600, color: "var(--navy)", fontSize: 14 }}>Optional practice test</p>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>A low-stakes trial run before the official retake — doesn't affect your score</p>
        </div>
        <button className="vl-btn-ghost" style={{ padding: "8px 16px", fontSize: 13, opacity: reviewStarted.practice ? 0.6 : 1 }}
          disabled={!!reviewStarted.practice}
          onClick={() => setReviewStarted((prev) => ({ ...prev, practice: true }))}>
          {reviewStarted.practice ? <><Check size={14} /> Started</> : "Try it"}
        </button>
      </div>

      <button className="vl-btn-primary" onClick={onExit}>Done for now</button>
    </div>
  );
}

const MISTAKES = [
  { id: 1, category: "Grammar", item: "se lever vs se laver", wrong: "Je me lave à 7h pour aller travailler.", correct: "Je me lève à 7h pour aller travailler.", note: "« Se lever » means to get up; « se laver » means to wash oneself — easy to mix up since both are reflexive and start similarly." },
  { id: 2, category: "Pronunciation", item: "accueillant", wrong: "Pronounced with a hard, English-style \"cc\" sound", correct: "/a.kœ.jɑ̃/ — soft \"y\" sound, nasal ending", note: "The \"-illant\" ending has a soft glide, not a hard consonant, and the final syllable is nasal — try humming through your nose on \"-ant.\"" },
  { id: 3, category: "Conjugation", item: "passé composé with être", wrong: "Il a allé au marché.", correct: "Il est allé au marché.", note: "Verbs of movement (aller, venir, partir…) take « être », not « avoir », in the passé composé." },
  { id: 4, category: "Vocabulary", item: "depuis vs pendant", wrong: "J'étudie le français pendant six mois. (for an ongoing duration)", correct: "J'étudie le français depuis six mois.", note: "« Depuis » = since/for an action that's still ongoing; « pendant » = during/for a completed duration." },
  { id: 5, category: "Writing", item: "formal email closing", wrong: "Bye, Maya", correct: "Cordialement, Maya", note: "Professional French emails need a formal closing — « Cordialement » is the safe, standard choice for work correspondence." },
];

const MISTAKE_CATEGORY_COLORS = {
  Grammar: "var(--coral-dark)", Pronunciation: "var(--lavender-dark)", Conjugation: "var(--turq-dark)",
  Vocabulary: "var(--navy)", Writing: "var(--gold-dark)",
};

function MistakeNotebook({ onBack, reviewedIds, setReviewedIds }) {
  const items = MISTAKES.map((m) => ({ ...m, reviewed: reviewedIds.includes(m.id) }));
  const [openId, setOpenId] = useState(null);
  const [filter, setFilter] = useState("All");

  const categories = ["All", ...Array.from(new Set(MISTAKES.map((m) => m.category)))];
  const visible = filter === "All" ? items : items.filter((m) => m.category === filter);

  const toggleReviewed = (id) => setReviewedIds(reviewedIds.includes(id) ? reviewedIds.filter((x) => x !== id) : [...reviewedIds, id]);

  return (
    <div className="vl-fade-in" style={{ padding: "36px 44px", maxWidth: 780 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--ink-soft)", fontSize: 13, display: "flex", alignItems: "center", gap: 5, marginBottom: 18 }}>
        <ChevronLeft size={15} /> Back to progress
      </button>
      <h1 className="vl-serif" style={{ fontSize: 28, color: "var(--navy)", margin: "0 0 6px" }}>Mistake Notebook</h1>
      <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 22 }}>
        Automatically saved from your lessons, quizzes, and conversations — reviewed with spaced repetition.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {categories.map((c) => (
          <button key={c} onClick={() => setFilter(c)}
            style={{ padding: "7px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, border: `1.5px solid ${filter === c ? "var(--coral)" : "var(--line)"}`, background: filter === c ? "#FFF1EE" : "#fff", color: filter === c ? "var(--coral-dark)" : "var(--ink-soft)" }}>
            {c}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {visible.map((m) => {
          const isOpen = openId === m.id;
          return (
            <div key={m.id} className="vl-card" style={{ padding: 0, overflow: "hidden" }}>
              <button onClick={() => setOpenId(isOpen ? null : m.id)}
                style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: MISTAKE_CATEGORY_COLORS[m.category] }}>{m.category.toUpperCase()}</span>
                  <p style={{ margin: "3px 0 0", fontSize: 14.5, fontWeight: 600, color: "var(--navy)" }}>{m.item}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {m.reviewed && <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--turq-dark)" }}>Reviewed ✓</span>}
                  <ChevronRight size={16} color="var(--ink-soft)" style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
                </div>
              </button>
              {isOpen && (
                <div style={{ padding: "0 18px 18px" }}>
                  <div style={{ background: "#FDEAE6", borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--coral-dark)" }}>YOU WROTE</p>
                    <p style={{ margin: "3px 0 0", fontSize: 13.5, color: "var(--ink)" }}>{m.wrong}</p>
                  </div>
                  <div style={{ background: "#E7F6F1", borderRadius: 10, padding: "10px 14px", marginBottom: 10 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--turq-dark)" }}>CORRECTED</p>
                    <p style={{ margin: "3px 0 0", fontSize: 13.5, color: "var(--ink)" }}>{m.correct}</p>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.55, marginBottom: 14 }}>{m.note}</p>
                  <button className="vl-btn-ghost" style={{ padding: "7px 14px", fontSize: 12.5 }} onClick={() => toggleReviewed(m.id)}>
                    {m.reviewed ? "Mark as still learning" : "Mark as reviewed"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Progress({ openAssessment, reviewedIds, setReviewedIds }) {
  const [view, setView] = useState("main"); // main | notebook
  const weeks = [40, 55, 35, 70, 60, 80, 65];
  const max = Math.max(...weeks);

  if (view === "notebook") {
    return <MistakeNotebook onBack={() => setView("main")} reviewedIds={reviewedIds} setReviewedIds={setReviewedIds} />;
  }

  return (
    <div className="vl-fade-in" style={{ padding: "36px 44px", maxWidth: 900 }}>
      <h1 className="vl-serif" style={{ fontSize: 28, color: "var(--navy)", margin: "0 0 20px" }}>Progress</h1>

      <div className="vl-card" style={{ padding: 22, marginBottom: 20, background: "linear-gradient(120deg, var(--navy), var(--navy-light))", border: "none", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--gold)", letterSpacing: 0.3 }}>LEVEL A1 · 88% COMPLETE</span>
          <h3 className="vl-serif" style={{ fontSize: 20, margin: "6px 0 4px" }}>Ready to test into A2?</h3>
          <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.7)", margin: 0 }}>Reading, listening, speaking and writing — about 20 minutes.</p>
        </div>
        <button className="vl-btn-primary" onClick={openAssessment}>Start assessment <ArrowRight size={16} /></button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 20 }}>
        <div className="vl-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--navy)", margin: "0 0 18px" }}>Weekly study minutes</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 130 }}>
            {weeks.map((w, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ width: "100%", height: `${(w / max) * 100}px`, background: i === weeks.length - 2 ? "var(--coral)" : "var(--turq)", borderRadius: 6 }} />
                <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>{["M","T","W","T","F","S","S"][i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="vl-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--navy)", margin: "0 0 14px" }}>Skill breakdown</h3>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <SkillWheel skills={SKILLS} size={190} />
          </div>
        </div>
      </div>

      <div className="vl-card" style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--navy)", margin: 0 }}>Mistake notebook</h3>
          <button onClick={() => setView("notebook")} style={{ background: "none", border: "none", color: "var(--lavender-dark)", fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            View all <ChevronRight size={13} />
          </button>
        </div>
        {MISTAKES.slice(0, 3).map((m, i) => {
          const isReviewed = reviewedIds.includes(m.id);
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: i < 2 ? "1px solid var(--line)" : "none" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "var(--navy)" }}>{m.item}</p>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>{m.category}</p>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: isReviewed ? "var(--turq-dark)" : "var(--coral-dark)" }}>{isReviewed ? "Reviewed ✓" : "Review"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   COMMUNITY CHALLENGES
   ──────────────────────────────────────────────────────────── */

const WEEKLY_MISSIONS = [
  { title: "Complete 5 lessons", progress: 3, total: 5, xp: 50 },
  { title: "Practice speaking 30 minutes", progress: 18, total: 30, xp: 40, unit: "min" },
  { title: "Review 40 vocabulary words", progress: 40, total: 40, xp: 30 },
];

const LEADERBOARD = [
  { name: "Awa D.", xp: 1240, you: false },
  { name: "Liang C.", xp: 1180, you: false },
  { name: "Maya Chen", xp: 1050, you: true },
  { name: "Priya S.", xp: 980, you: false },
  { name: "Tomás R.", xp: 860, you: false },
];

const DAILY_QUIZ = [
  { prompt: "« Je ___ étudiant. »", options: ["suis", "es", "est"], correct: "suis" },
  { prompt: "What does « le loyer » mean?", options: ["The rent", "The lease", "The landlord"], correct: "The rent" },
  { prompt: "« Il ___ mal à la tête. »", options: ["a", "as", "ai"], correct: "a" },
];

function DailyQuizCard() {
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const q = DAILY_QUIZ[i];
  const choose = (opt) => {
    setAnswer(opt);
    setTimeout(() => {
      const newScore = score + (opt === q.correct ? 1 : 0);
      setScore(newScore);
      setAnswer(null);
      if (i < DAILY_QUIZ.length - 1) setI(i + 1);
      else setDone(true);
    }, 450);
  };

  if (!started) {
    return (
      <div className="vl-card" style={{ padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--turq-dark)", letterSpacing: 0.3 }}>DAILY QUIZ</span>
            <h3 className="vl-serif" style={{ fontSize: 19, margin: "6px 0 4px", color: "var(--navy)" }}>3 quick questions</h3>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>Mixed review from this week's lessons · +15 XP</p>
          </div>
        </div>
        <button className="vl-btn-primary" style={{ marginTop: 16 }} onClick={() => setStarted(true)}>Start <ArrowRight size={16} /></button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="vl-card" style={{ padding: 22, textAlign: "center" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--turq-dark)", margin: "0 0 6px" }}>QUIZ COMPLETE</p>
        <p className="vl-serif" style={{ fontSize: 22, color: "var(--navy)", margin: "0 0 14px" }}>{score} / {DAILY_QUIZ.length} correct</p>
        <button className="vl-btn-ghost" onClick={() => { setStarted(false); setI(0); setScore(0); setDone(false); }}>Done</button>
      </div>
    );
  }

  return (
    <div className="vl-card" style={{ padding: 22 }}>
      <p style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 10 }}>Question {i + 1} of {DAILY_QUIZ.length}</p>
      <p style={{ fontSize: 15, fontWeight: 600, color: "var(--navy)", marginBottom: 16 }}>{q.prompt}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {q.options.map((opt) => {
          const chosen = answer === opt, isCorrect = opt === q.correct;
          let border = "var(--line)", bg = "#fff";
          if (answer && chosen) { border = isCorrect ? "var(--turq)" : "var(--coral)"; bg = isCorrect ? "#E7F6F1" : "#FDEAE6"; }
          return (
            <button key={opt} disabled={!!answer} onClick={() => choose(opt)}
              style={{ textAlign: "left", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${border}`, background: bg, fontSize: 14 }}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Community() {
  return (
    <div className="vl-fade-in" style={{ padding: "36px 44px", maxWidth: 900 }}>
      <h1 className="vl-serif" style={{ fontSize: 28, color: "var(--navy)", margin: "0 0 20px" }}>Community Challenges</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18 }}>
        <div className="vl-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--navy)", margin: "0 0 16px" }}>This week's missions</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {WEEKLY_MISSIONS.map((m) => {
              const pct = Math.round((m.progress / m.total) * 100);
              const complete = pct >= 100;
              return (
                <div key={m.title}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--navy)" }}>{m.title}</span>
                    <span style={{ fontSize: 12, color: complete ? "var(--turq-dark)" : "var(--ink-soft)", fontWeight: 600 }}>
                      {complete ? `Done · +${m.xp} XP` : `${m.progress}/${m.total}${m.unit ? " " + m.unit : ""}`}
                    </span>
                  </div>
                  <div style={{ height: 7, background: "var(--cream-dim)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: complete ? "var(--turq)" : "var(--coral)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DailyQuizCard />
      </div>

      <div className="vl-card" style={{ padding: 24, marginTop: 18 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--navy)", margin: "0 0 16px" }}>Weekly leaderboard</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {LEADERBOARD.map((p, i) => (
            <div key={p.name} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10,
              background: p.you ? "var(--cream)" : "transparent"
            }}>
              <span style={{ width: 20, fontSize: 13, fontWeight: 700, color: i < 3 ? "var(--gold-dark)" : "var(--ink-soft)" }}>{i + 1}</span>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: p.you ? "linear-gradient(135deg, var(--coral), var(--lavender))" : "var(--cream-dim)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: p.you ? "#fff" : "var(--navy)" }}>
                {p.name[0]}
              </div>
              <span style={{ flex: 1, fontSize: 14, fontWeight: p.you ? 700 : 500, color: "var(--navy)" }}>{p.name}{p.you && " (you)"}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)" }}>{p.xp} XP</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   PROFILE & SETTINGS
   ──────────────────────────────────────────────────────────── */

const BADGES = [
  { label: "First lesson", icon: Star, earned: true },
  { label: "7-day streak", icon: Flame, earned: true },
  { label: "50 words learned", icon: Layers, earned: true },
  { label: "A1 completed", icon: Award, earned: true },
  { label: "30-day streak", icon: Flame, earned: false },
  { label: "First conversation", icon: MessageCircle, earned: true },
  { label: "A2 completed", icon: Award, earned: false },
  { label: "100 words learned", icon: Layers, earned: false },
];

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)}
      style={{ width: 42, height: 24, borderRadius: 999, border: "none", background: on ? "var(--turq)" : "var(--line)", position: "relative", flexShrink: 0, transition: "background .15s" }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: on ? 21 : 3, transition: "left .15s" }} />
    </button>
  );
}

function Profile({ user, userData, updateUserData, isPremium, setIsPremium, onLogout }) {
  const [view, setView] = useState("main"); // main | subscription | help
  const [voice, setVoiceLocal] = useState(userData.voicePref || "Female");
  const [accent, setAccentLocal] = useState(userData.accentPref || "Canadian / Québécois French");
  const setVoice = (val) => { setVoiceLocal(val); updateUserData({ voicePref: val }); };
  const setAccent = (val) => { setAccentLocal(val); updateUserData({ accentPref: val }); };
  const [notifDaily, setNotifDaily] = useState(true);
  const [notifStreak, setNotifStreak] = useState(true);
  const [saveHistory, setSaveHistory] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exported, setExported] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.displayName || "");
  const [nameSaved, setNameSaved] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState({ type: "", text: "" });
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const hasPasswordProvider = user?.providerData?.some((p) => p.providerId === "password");

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const exportData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      account: {
        name: user?.displayName || null,
        email: user?.email || null,
        memberSince: user?.metadata?.creationTime || null,
        uid: user?.uid || null,
      },
      progress: userData,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, `verbalune-data-${(user?.email || "export").split("@")[0]}.json`);
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 2500);
  };

  const deleteAccount = async () => {
    setDeleteError("");
    setDeleting(true);
    try {
      if (hasPasswordProvider) {
        if (!deletePassword) { setDeleteError("Enter your password to confirm."); setDeleting(false); return; }
        const credential = EmailAuthProvider.credential(user.email, deletePassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
      } else {
        await reauthenticateWithPopup(auth.currentUser, googleProvider);
      }
      await deleteDoc(doc(db, "users", user.uid));
      await deleteUser(auth.currentUser);
      onLogout();
    } catch (err) {
      setDeleteError(friendlyAuthError(err) || "Couldn't verify your identity — please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const saveName = async () => {
    if (!nameDraft.trim()) return;
    try {
      await updateProfile(auth.currentUser, { displayName: nameDraft.trim() });
      setEditingName(false);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch (e) {
      console.error("Failed to update name:", e);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg({ type: "", text: "" });
    if (newPassword.length < 6) {
      setPasswordMsg({ type: "error", text: "New password must be at least 6 characters." });
      return;
    }
    setPasswordSubmitting(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      setPasswordMsg({ type: "success", text: "Password updated." });
      setCurrentPassword("");
      setNewPassword("");
      setTimeout(() => { setShowPasswordForm(false); setPasswordMsg({ type: "", text: "" }); }, 2000);
    } catch (err) {
      setPasswordMsg({ type: "error", text: friendlyAuthError(err) || "Current password is incorrect." });
    } finally {
      setPasswordSubmitting(false);
    }
  };

  if (view === "subscription") {
    return (
      <div className="vl-fade-in" style={{ padding: "36px 44px", maxWidth: 820 }}>
        <button onClick={() => setView("main")} style={{ background: "none", border: "none", color: "var(--ink-soft)", fontSize: 13, display: "flex", alignItems: "center", gap: 5, marginBottom: 18 }}>
          <ChevronLeft size={15} /> Back to profile
        </button>
        <h1 className="vl-serif" style={{ fontSize: 28, color: "var(--navy)", margin: "0 0 6px" }}>Choose your plan</h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 26 }}>Upgrade anytime — cancel whenever you like.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div className="vl-card" style={{ padding: 26, opacity: isPremium ? 0.6 : 1 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", letterSpacing: 0.3, margin: "0 0 6px" }}>FREE</p>
            <p className="vl-serif" style={{ fontSize: 26, color: "var(--navy)", margin: "0 0 20px" }}>$0</p>
            <ul style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 2.1, paddingLeft: 18, margin: "0 0 22px" }}>
              <li>Placement test</li>
              <li>Limited daily lessons</li>
              <li>Basic vocabulary reviews</li>
              <li>Limited AI conversation time</li>
              <li>Basic progress tracking</li>
            </ul>
            {isPremium ? (
              <button className="vl-btn-ghost" style={{ width: "100%", justifyContent: "center" }} onClick={() => setIsPremium(false)}>Downgrade to Free</button>
            ) : (
              <button className="vl-btn-ghost" style={{ width: "100%", justifyContent: "center" }} disabled>Your current plan</button>
            )}
          </div>

          <div className="vl-card" style={{ padding: 26, border: "2px solid var(--coral)", position: "relative" }}>
            <span style={{ position: "absolute", top: -12, right: 20, background: "linear-gradient(120deg, var(--coral), var(--gold))", color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 999 }}>Most popular</span>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--coral-dark)", letterSpacing: 0.3, margin: "0 0 6px" }}>PREMIUM</p>
            <p className="vl-serif" style={{ fontSize: 26, color: "var(--navy)", margin: "0 0 20px" }}>$14.99<span style={{ fontSize: 14, color: "var(--ink-soft)", fontWeight: 400 }}>/month</span></p>
            <ul style={{ fontSize: 13.5, color: "var(--navy)", lineHeight: 2.1, paddingLeft: 18, margin: "0 0 22px" }}>
              <li>Unlimited lessons</li>
              <li>Unlimited personalized reviews</li>
              <li>Advanced AI tutor</li>
              <li>Extended voice conversations</li>
              <li>All accents & voice options</li>
              <li>Writing correction</li>
              <li>Offline lessons</li>
              <li>Detailed progress reports</li>
              <li>Certificates</li>
              <li>Exam-preparation modules</li>
            </ul>
            {isPremium ? (
              <button className="vl-btn-ghost" style={{ width: "100%", justifyContent: "center" }} disabled>Your current plan</button>
            ) : (
              <button className="vl-btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setIsPremium(true)}>
                Upgrade to Premium
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === "help") {
    const faqs = [
      { q: "How does the AI tutor decide my level?", a: "It starts from your placement test and onboarding answers, then adjusts based on your quiz accuracy, assessment results, and the mistakes it sees in lessons and conversations." },
      { q: "Can I switch between learning English and French?", a: "Yes — go to Profile & Settings and change your learning language and interface language at any time. Your progress in each language is tracked separately." },
      { q: "What happens if I miss a day?", a: "Your streak gets a gentle grace period rather than resetting immediately — we'd rather help you get back into a rhythm than punish a missed day." },
      { q: "Is my voice data stored?", a: "Only if you allow it in Privacy & Data settings. You can disable saved conversation history, and delete past recordings, at any time." },
      { q: "Is the certificate an official qualification?", a: "No — it's a VerbaLune course-completion certificate, not an accredited government or CEFR qualification, unless the program later obtains formal accreditation." },
    ];
    return (
      <div className="vl-fade-in" style={{ padding: "36px 44px", maxWidth: 680 }}>
        <button onClick={() => setView("main")} style={{ background: "none", border: "none", color: "var(--ink-soft)", fontSize: 13, display: "flex", alignItems: "center", gap: 5, marginBottom: 18 }}>
          <ChevronLeft size={15} /> Back to profile
        </button>
        <h1 className="vl-serif" style={{ fontSize: 28, color: "var(--navy)", margin: "0 0 24px" }}>Help & Privacy</h1>

        <div className="vl-card" style={{ padding: 6, marginBottom: 24 }}>
          {faqs.map((f, i) => (
            <div key={f.q} style={{ borderBottom: i < faqs.length - 1 ? "1px solid var(--line)" : "none" }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--navy)" }}>{f.q}</span>
                <ChevronRight size={15} color="var(--ink-soft)" style={{ transform: openFaq === i ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
              </button>
              {openFaq === i && (
                <p style={{ margin: "0 18px 16px", fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.6 }}>{f.a}</p>
              )}
            </div>
          ))}
        </div>

        <div className="vl-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ margin: "0 0 2px", fontSize: 13.5, fontWeight: 600, color: "var(--navy)" }}>Privacy Policy & Terms</p>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>How VerbaLune handles your data, voice recordings, and account</p>
            </div>
            <button className="vl-btn-ghost" style={{ padding: "8px 16px", fontSize: 13 }} onClick={() => setOpenFaq(openFaq === "policy" ? null : "policy")}>
              {openFaq === "policy" ? "Hide" : "View"}
            </button>
          </div>
          {openFaq === "policy" && (
            <p style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
              VerbaLune stores your lessons, progress, and — only if you allow it in Privacy & Data settings — your
              conversation history and voice recordings, solely to personalize your learning plan. You can export or
              delete your data at any time from Profile & Settings. This is placeholder summary text; the full legal
              Privacy Policy and Terms of Service would be linked here in a production app.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="vl-fade-in" style={{ padding: "36px 44px", maxWidth: 780 }}>
      <h1 className="vl-serif" style={{ fontSize: 28, color: "var(--navy)", margin: "0 0 24px" }}>Profile & Settings</h1>

      <div className="vl-card" style={{ padding: 24, marginBottom: 20, display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: "linear-gradient(135deg, var(--coral), var(--lavender))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#fff", fontWeight: 700 }}>
          {(user?.displayName || user?.email || "?")[0].toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          {editingName ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 3 }}>
              <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} autoFocus
                style={{ fontSize: 16, padding: "5px 8px", borderRadius: 8, border: "1.5px solid var(--line)", fontFamily: "inherit" }} />
              <button onClick={saveName} style={{ background: "var(--turq)", border: "none", borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Check size={14} color="#fff" />
              </button>
              <button onClick={() => { setEditingName(false); setNameDraft(user?.displayName || ""); }} style={{ background: "var(--cream)", border: "none", borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={14} color="var(--ink-soft)" />
              </button>
            </div>
          ) : (
            <h2 style={{ margin: "0 0 3px", fontSize: 18, color: "var(--navy)", display: "flex", alignItems: "center", gap: 8 }}>
              {user?.displayName || "Your account"}
              <button onClick={() => setEditingName(true)} style={{ background: "none", border: "none", padding: 0, display: "flex", opacity: 0.5 }} title="Edit name">
                <Pencil size={13} color="var(--ink-soft)" />
              </button>
              {nameSaved && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--turq-dark)" }}>Saved ✓</span>}
            </h2>
          )}
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)" }}>{user?.email || "Learning French"}</p>
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 700, background: isPremium ? "linear-gradient(120deg, var(--coral), var(--gold))" : "var(--cream-dim)", color: isPremium ? "#fff" : "var(--navy)", padding: "5px 12px", borderRadius: 999 }}>{isPremium ? "Premium" : "Free plan"}</span>
        <button onClick={onLogout} title="Log out" style={{ background: "var(--cream)", border: "none", borderRadius: 10, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <LogOut size={16} color="var(--ink-soft)" />
        </button>
      </div>

      <div className="vl-card" style={{ padding: 24, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", margin: "0 0 4px" }}>Account information</h3>
        <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 18px" }}>
          Member since {user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—"}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 6px" }}>Learning language</p>
            <select value={userData.learningLanguage} onChange={(e) => updateUserData({ learningLanguage: e.target.value })}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid var(--line)", fontSize: 13, fontFamily: "inherit", color: "var(--navy)" }}>
              <option>French</option>
              <option>English</option>
            </select>
          </div>
          <div>
            <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 6px" }}>Current level</p>
            <select value={userData.currentLevel} onChange={(e) => updateUserData({ currentLevel: e.target.value })}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid var(--line)", fontSize: 13, fontFamily: "inherit", color: "var(--navy)" }}>
              {["A1", "A2", "B1", "B2", "C1", "C2"].map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 6px" }}>Daily study goal</p>
            <select value={userData.dailyGoalMinutes} onChange={(e) => updateUserData({ dailyGoalMinutes: e.target.value })}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid var(--line)", fontSize: 13, fontFamily: "inherit", color: "var(--navy)" }}>
              <option>5 minutes</option>
              <option>10 minutes</option>
              <option>20 minutes</option>
              <option>30+ minutes</option>
            </select>
          </div>
          <div>
            <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 6px" }}>Main focus</p>
            <select value={userData.focusSkill} onChange={(e) => updateUserData({ focusSkill: e.target.value })}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid var(--line)", fontSize: 13, fontFamily: "inherit", color: "var(--navy)" }}>
              <option value="">Not set</option>
              <option>Speaking</option>
              <option>Listening</option>
              <option>Writing</option>
              <option>Grammar</option>
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 6px" }}>Learning goal</p>
            <select value={userData.learningGoal} onChange={(e) => updateUserData({ learningGoal: e.target.value })}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid var(--line)", fontSize: 13, fontFamily: "inherit", color: "var(--navy)" }}>
              <option value="">Not set</option>
              <option>Immigration & daily life</option>
              <option>Work</option>
              <option>Travel</option>
              <option>Exam preparation</option>
            </select>
          </div>
        </div>
      </div>

      <div className="vl-card" style={{ padding: 24, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", margin: "0 0 4px" }}>Password & security</h3>
        {!hasPasswordProvider ? (
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "10px 0 0" }}>
            You signed in with Google, so your password is managed by your Google account — there's nothing to change here.
          </p>
        ) : !showPasswordForm ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>Change the password you use to log in.</p>
            <button className="vl-btn-ghost" style={{ padding: "8px 16px", fontSize: 13 }} onClick={() => setShowPasswordForm(true)}>
              <KeyRound size={14} /> Change password
            </button>
          </div>
        ) : (
          <form onSubmit={changePassword} style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10, maxWidth: 340 }}>
            <input type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
              style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid var(--line)", fontSize: 13.5, fontFamily: "inherit" }} />
            <input type="password" placeholder="New password (6+ characters)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid var(--line)", fontSize: 13.5, fontFamily: "inherit" }} />
            {passwordMsg.text && (
              <p style={{ fontSize: 12.5, margin: 0, color: passwordMsg.type === "error" ? "var(--coral-dark)" : "var(--turq-dark)" }}>{passwordMsg.text}</p>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" className="vl-btn-primary" style={{ padding: "9px 18px", fontSize: 13, opacity: passwordSubmitting ? 0.6 : 1 }} disabled={passwordSubmitting}>
                {passwordSubmitting ? "Updating…" : "Update password"}
              </button>
              <button type="button" className="vl-btn-ghost" style={{ padding: "9px 16px", fontSize: 13 }}
                onClick={() => { setShowPasswordForm(false); setCurrentPassword(""); setNewPassword(""); setPasswordMsg({ type: "", text: "" }); }}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="vl-card" style={{ padding: 24, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", margin: "0 0 16px" }}>Achievements</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {BADGES.map((b) => (
            <div key={b.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "14px 8px", borderRadius: 12, background: b.earned ? "var(--cream)" : "transparent", opacity: b.earned ? 1 : 0.4 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: b.earned ? "linear-gradient(135deg, var(--coral), var(--gold))" : "var(--line)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                <b.icon size={18} color="#fff" />
              </div>
              <span style={{ fontSize: 11.5, color: "var(--ink-soft)", lineHeight: 1.3 }}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="vl-card" style={{ padding: 24, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", margin: "0 0 16px" }}>Voice & accent</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 8px" }}>Tutor voice</p>
            <div style={{ display: "flex", gap: 8 }}>
              {["Female", "Male", "Mixed"].map((v) => (
                <button key={v} onClick={() => setVoice(v)}
                  style={{ padding: "8px 14px", borderRadius: 9, fontSize: 13, border: `1.5px solid ${voice === v ? "var(--coral)" : "var(--line)"}`, background: voice === v ? "#FFF1EE" : "#fff", color: voice === v ? "var(--coral-dark)" : "var(--ink-soft)", fontWeight: 600 }}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 8px" }}>Accent</p>
            <select value={accent} onChange={(e) => setAccent(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid var(--line)", fontSize: 13, fontFamily: "inherit", color: "var(--navy)" }}>
              <option>Canadian / Québécois French</option>
              <option>France French</option>
              <option>Neutral international French</option>
            </select>
          </div>
        </div>
      </div>

      <div className="vl-card" style={{ padding: 24, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", margin: "0 0 16px" }}>Notifications</h3>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 13.5, fontWeight: 600, color: "var(--navy)" }}>Daily reminder</p>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>A nudge at your usual study time</p>
          </div>
          <Toggle on={notifDaily} onChange={setNotifDaily} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 13.5, fontWeight: 600, color: "var(--navy)" }}>Streak protection alerts</p>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>Warn me before I lose my streak</p>
          </div>
          <Toggle on={notifStreak} onChange={setNotifStreak} />
        </div>
      </div>

      <div className="vl-card" style={{ padding: 24, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", margin: "0 0 16px" }}>Privacy & data</h3>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 13.5, fontWeight: 600, color: "var(--navy)" }}>Save conversation history</p>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>Lets your tutor remember past mistakes and topics</p>
          </div>
          <Toggle on={saveHistory} onChange={setSaveHistory} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", gap: 12 }}>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 13.5, fontWeight: 600, color: "var(--navy)" }}>Export my data</p>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>Download your lessons, progress and recordings</p>
          </div>
          <button className="vl-btn-ghost" style={{ padding: "8px 16px", fontSize: 13, flexShrink: 0 }} onClick={exportData}>
            {exported ? <><Check size={14} /> Downloaded</> : <><Download size={14} /> Export</>}
          </button>
        </div>
        <div style={{ padding: "14px 0 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <p style={{ margin: "0 0 2px", fontSize: 13.5, fontWeight: 600, color: "var(--coral-dark)" }}>Delete account</p>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>Permanently removes your profile and progress — this can't be undone</p>
            </div>
            {!confirmDelete && (
              <button style={{ padding: "8px 16px", fontSize: 13, borderRadius: 10, border: "1.5px solid var(--coral)", color: "var(--coral-dark)", background: "#fff", flexShrink: 0 }}
                onClick={() => setConfirmDelete(true)}>Delete</button>
            )}
          </div>
          {confirmDelete && (
            <div style={{ marginTop: 14, padding: 16, background: "#FFF5F3", borderRadius: 12 }}>
              <p style={{ fontSize: 12.5, color: "var(--coral-dark)", margin: "0 0 10px", fontWeight: 600 }}>
                This permanently deletes your account and all saved progress. This cannot be undone.
              </p>
              {hasPasswordProvider ? (
                <input type="password" placeholder="Enter your password to confirm" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)}
                  style={{ width: "100%", maxWidth: 320, padding: "9px 12px", borderRadius: 9, border: "1.5px solid var(--line)", fontSize: 13, fontFamily: "inherit", marginBottom: 10 }} />
              ) : (
                <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 10px" }}>
                  Since you signed in with Google, you'll be asked to confirm via a Google sign-in popup.
                </p>
              )}
              {deleteError && <p style={{ fontSize: 12, color: "var(--coral-dark)", margin: "0 0 10px" }}>{deleteError}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ padding: "8px 14px", fontSize: 12.5, borderRadius: 10, border: "1.5px solid var(--coral)", color: "#fff", background: "var(--coral)", opacity: deleting ? 0.6 : 1 }}
                  disabled={deleting} onClick={deleteAccount}>
                  {deleting ? "Deleting…" : "Permanently delete"}
                </button>
                <button style={{ padding: "8px 14px", fontSize: 12.5, borderRadius: 10, border: "1.5px solid var(--line)", color: "var(--ink-soft)", background: "#fff" }}
                  onClick={() => { setConfirmDelete(false); setDeletePassword(""); setDeleteError(""); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="vl-card" style={{ padding: 24, background: "linear-gradient(135deg, var(--navy), var(--navy-light))", border: "none", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--gold)", letterSpacing: 0.3 }}>SUBSCRIPTION</span>
          <h3 className="vl-serif" style={{ fontSize: 19, margin: "6px 0 4px" }}>{isPremium ? "You're on Premium" : "You're on the Free plan"}</h3>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", margin: 0 }}>
            {isPremium ? "Unlimited lessons, all accents, offline lessons, and more are unlocked." : "Upgrade for unlimited AI conversations, all accents, and offline lessons"}
          </p>
        </div>
        <button className="vl-btn-primary" onClick={() => setView("subscription")}>{isPremium ? "Manage plan" : "See plans"}</button>
      </div>

      <button onClick={() => setView("help")} style={{ background: "none", border: "none", color: "var(--ink-soft)", fontSize: 13, marginTop: 20, display: "flex", alignItems: "center", gap: 5 }}>
        Help & Privacy <ChevronRight size={14} />
      </button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   ROOT
   ──────────────────────────────────────────────────────────── */

export default function VerbaLune() {
  const [phase, setPhase] = useState("landing"); // landing | auth | placement | onboarding | app
  const [authMode, setAuthMode] = useState("signup");
  const [placementLevel, setPlacementLevel] = useState(null);
  const [screen, setScreen] = useState("dashboard");
  const [inLesson, setInLesson] = useState(false);
  const [activeLesson, setActiveLesson] = useState(null);
  const [inAssessment, setInAssessment] = useState(false);

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const initialCheckRef = useRef(true);
  const [userData, updateUserData] = useUserData(user?.uid);

  useEffect(() => {
    setSpeechPrefs(userData.accentPref, userData.voicePref);
  }, [userData.accentPref, userData.voicePref]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (initialCheckRef.current) {
        initialCheckRef.current = false;
        setAuthLoading(false);
        if (u) setPhase("app"); // resume an existing session on page load
      }
    });
    return unsub;
  }, []);

  const logout = async () => {
    await signOut(auth);
    setPhase("landing");
  };

  const markLessonComplete = (lessonTitle) => {
    if (!userData.completedLessons.includes(lessonTitle)) {
      updateUserData({ completedLessons: [...userData.completedLessons, lessonTitle] });
    }
  };

  if (authLoading) {
    return (
      <div className="vl-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <GlobalStyle />
        <Logo size={44} />
      </div>
    );
  }

  return (
    <div className="vl-root">
      <GlobalStyle />
      {phase === "landing" && (
        <Landing
          onSignup={() => { setAuthMode("signup"); setPhase("auth"); }}
          onLogin={() => { setAuthMode("login"); setPhase("auth"); }}
          onPlacement={() => setPhase("placement")}
        />
      )}
      {phase === "auth" && (
        <AuthScreen
          mode={authMode}
          onBack={() => setPhase("landing")}
          onAuthed={(mode) => setPhase(mode === "signup" ? "onboarding" : "app")}
        />
      )}
      {phase === "placement" && (
        <PlacementTest
          onDone={(level) => { setPlacementLevel(level); setAuthMode("signup"); setPhase("auth"); }}
          onSkip={() => { setPlacementLevel(null); setAuthMode("signup"); setPhase("auth"); }}
        />
      )}
      {phase === "onboarding" && (
        <Onboarding
          presetLevel={placementLevel}
          onFinish={(answers) => {
            const LEVEL_LABEL_TO_CODE = {
              "Complete beginner": "A1",
              "A2 – Elementary": "A2",
              "B1 – Intermediate": "B1",
              "B2 or above": "B2",
            };
            updateUserData({
              learningLanguage: answers.language || DEFAULT_USER_DATA.learningLanguage,
              currentLevel: LEVEL_LABEL_TO_CODE[answers.level] || answers.level || DEFAULT_USER_DATA.currentLevel,
              learningGoal: answers.goal || "",
              dailyGoalMinutes: answers.time || DEFAULT_USER_DATA.dailyGoalMinutes,
              focusSkill: answers.focus || "",
            });
            setPhase("app");
          }}
        />
      )}
      {phase === "app" && user && (
        <Shell screen={screen} setScreen={(s) => { setScreen(s); setInLesson(false); setInAssessment(false); }} user={user} learningLanguage={userData.learningLanguage} currentLevel={userData.currentLevel}>
          {screen === "dashboard" && !inLesson && (
            <Dashboard
              setScreen={setScreen}
              userName={user?.displayName}
              language={userData.learningLanguage}
              openLesson={(lesson) => { setActiveLesson(lesson); setInLesson(true); }}
            />
          )}
          {screen === "path" && !inLesson && (
            <LearningPath
              openLesson={(lesson) => { setActiveLesson(lesson); setInLesson(true); }}
              completedLessons={userData.completedLessons}
              language={userData.learningLanguage}
            />
          )}
          {inLesson && <LessonPlayer lesson={activeLesson} onExit={() => setInLesson(false)} onComplete={markLessonComplete} language={userData.learningLanguage} />}
          {screen === "vocabulary" && !inLesson && <Vocabulary language={userData.learningLanguage} />}
          {screen === "practice" && !inLesson && <Practice />}
          {screen === "community" && <Community />}
          {screen === "tutor" && !inLesson && <Tutor language={userData.learningLanguage} />}
          {screen === "progress" && !inAssessment && (
            <Progress
              openAssessment={() => setInAssessment(true)}
              reviewedIds={userData.reviewedMistakes}
              setReviewedIds={(next) => updateUserData({ reviewedMistakes: next })}
            />
          )}
          {screen === "progress" && inAssessment && <LevelAssessment onExit={() => setInAssessment(false)} user={user} />}
          {screen === "profile" && (
            <Profile
              user={user}
              userData={userData}
              updateUserData={updateUserData}
              isPremium={userData.isPremium}
              setIsPremium={(val) => updateUserData({ isPremium: val })}
              onLogout={logout}
            />
          )}
        </Shell>
      )}
      {phase === "app" && !user && (
        // Safety net: something reached "app" without a signed-in user — send them to sign up
        // rather than showing a broken screen.
        <Landing
          onSignup={() => { setAuthMode("signup"); setPhase("auth"); }}
          onLogin={() => { setAuthMode("login"); setPhase("auth"); }}
          onPlacement={() => setPhase("placement")}
        />
      )}
    </div>
  );
}
