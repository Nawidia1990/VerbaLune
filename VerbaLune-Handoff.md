# VerbaLune — Prototype Handoff

A single-file React prototype (`VerbaLune.jsx`) of the language-learning app described in the
original spec. This document explains what's real, what's simulated, and what a development
team would need to build to turn this into a production app.

## What this is

A **front-end-only interactive prototype**. It runs entirely in the browser with no backend,
no database, and no persistence between sessions — refreshing the page resets everything to
its default state. Its purpose is to demonstrate the intended user experience, information
architecture, and interaction design across the full breadth of the spec, not to be shipped
as-is.

## Tech stack

- **React** (functional components, hooks only — `useState`, `useEffect`, `useRef`)
- **lucide-react** for icons
- Inline styles + CSS custom properties (no CSS framework, no build step assumptions)
- **Anthropic API** (`claude-sonnet-4-6`) called directly from the browser for two features —
  see "What's genuinely functional" below
- Browser-native **Web Speech API** (`SpeechSynthesisUtterance` for text-to-speech,
  `SpeechRecognition` / `webkitSpeechRecognition` for speech-to-text) — no third-party voice
  vendor is integrated

## What's genuinely functional (not mocked)

- **AI Tutor conversations** — real calls to Claude for both the in-character role-play
  dialogue and the post-conversation feedback report (grammar/vocab/fluency feedback is
  generated live from the actual transcript, not scripted).
- **Text-to-speech** — vocabulary words, the daily phrase, and lesson vocab are spoken aloud
  using the browser's built-in TTS. Quality and available voices depend entirely on the
  user's OS/browser; there's no control over voice quality, accent authenticity, or the
  specific Canadian/French accent options described in the spec.
- **Speech-to-text** — the tutor's mic button uses `webkitSpeechRecognition`, which only
  works in Chromium-based browsers. There's no fallback voice engine.
- **All quizzes, exercises, and interactive checks** — reading comprehension exercises,
  lesson quizzes, the placement test, the daily community quiz, and the mistake notebook are
  all real client-side logic with real scoring, not decorative UI.

## What's simulated / hardcoded

- **User identity** — "Maya Chen" is hardcoded everywhere. There's no real account system;
  the login/signup screen validates input shape but doesn't create or check accounts.
- **Progress, streaks, XP, skill scores** — all fixed sample data (`SKILLS`, `UNITS`,
  `LEADERBOARD`, etc. near the top of the file). Nothing is computed from actual usage.
- **Assessment results** — the end-of-level assessment always returns one of two fixed
  outcomes via the "Preview: Needs review / Pass" toggle on its intro screen. It doesn't
  grade the sample tasks the user clicks through.
- **Certificate download / share / subscription checkout** — these trigger the browser's
  print dialog or native share sheet as a stand-in; there's no PDF generation service or
  payment processor behind them.
- **Only one lesson is authored per unit.** The `UNITS` array reports realistic lesson
  counts (5–8 per unit) to make the Learning Path look complete, but `LESSON_LIBRARY` only
  has one real lesson per unit. Units without an entry in `LESSON_LIBRARY` show a "coming
  soon" message instead of a lesson.
- **Community leaderboard** is static sample data, not live rankings.

## Component map (top to bottom in the file)

| Section | Components | Notes |
|---|---|---|
| Shared UI | `Logo`, `SkillWheel`, `ProgressRing`, `Toggle` | Reused across screens |
| Auth flow | `Landing`, `AuthScreen`, `PlacementTest` | `AuthScreen` branches signup→onboarding, login→app |
| Onboarding | `Onboarding` | 5-question flow, answers aren't currently used downstream |
| App shell | `Shell` | Sidebar nav + content area |
| Home | `Dashboard` | |
| Learning | `LearningPath`, `LessonPlayer`, lesson data constants (`DEFAULT_LESSON`, `FOOD_LESSON`, etc.) | 16 units, 12 authored lessons |
| Practice | `Practice`, `MatchingExercise`, `OrderExercise` | Reading comprehension, 6 exercise types |
| Vocabulary | `Vocabulary` | Flashcard-style review |
| AI Tutor | `Tutor`, `ScenarioReport`, scenario data (`SCENARIOS`) | Real API calls |
| Community | `Community`, `DailyQuizCard` | |
| Progress | `Progress`, `MistakeNotebook`, `LevelAssessment` | Assessment includes certificate + review-plan sub-flows |
| Profile | `Profile` | Includes subscription comparison and Help/FAQ sub-views |
| Root | `VerbaLune` (default export) | Owns top-level phase/screen state |

## What a production build would need

1. **Backend & auth** — real user accounts, session management, and the actual OAuth flows
   for Google/Apple sign-in (currently just advance the UI without checking anything).
2. **Database** — persisted progress, streaks, vocabulary mastery, mistake history, and
   assessment attempts per user.
3. **Content authoring at scale** — every unit needs its full complement of lessons (the
   spec implies 80+ lessons total across 16 units); this prototype has 12.
4. **Real speech infrastructure** — a neural TTS vendor with the specific accent/voice
   options in the spec (Canadian/France/neutral French; Canadian/American/British/neutral
   English), and a speech-to-text + pronunciation-assessment pipeline that works cross-browser
   (the current Web Speech API approach is Chrome-only and offers no pronunciation scoring).
5. **Payments** — Stripe or similar for the subscription flow.
6. **PDF generation** — a real certificate-rendering service instead of the browser print
   dialog.
7. **Moderation & data policy work** — especially around storing minors' or newcomers'
   personal data, voice recordings, and conversation history, given the target audience
   includes immigrants and students.

## Known limitations to flag to stakeholders

- No offline support (the spec's Premium tier promises offline lessons).
- No real accessibility audit has been done, though the design uses semantic color contrast
  and avoids relying on color alone in most places — a proper WCAG pass is still needed.
- The Anthropic API key handling shown in this prototype is specific to the artifact
  environment it was built in and is **not** a pattern to carry into a real app; production
  API calls must go through a backend, never directly from the client.
