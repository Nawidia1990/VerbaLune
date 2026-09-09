# VerbaLune

A real, runnable React app (Vite) built from the VerbaLune prototype. This is a proper
project you can run locally, push to GitHub, and deploy to a live URL — not an artifact
preview.

## What changed from the artifact version

The artifact's AI Tutor called `https://api.anthropic.com/v1/messages` directly from the
browser. That only works inside Claude's artifact sandbox, where the API key is injected
for you — it will **not** work once deployed on the open internet, and putting a real API
key in browser-side code would expose it to anyone who opens dev tools.

So this version routes those calls through a small serverless function instead:

```
Browser  →  POST /api/chat  →  api/chat.js (server, has the real key)  →  Anthropic API
```

Everything else — all the screens, lessons, exercises, quizzes, text-to-speech, and
speech-to-text — is unchanged and needs no key or backend at all.

## Run it locally

You'll need [Node.js](https://nodejs.org) 18+ installed.

```bash
npm install
```

**Frontend only** (fastest, but the AI Tutor chat and its post-conversation report won't
work — everything else will):

```bash
npm run dev
```

Then open the URL it prints (usually `http://localhost:5173`).

**Full app including AI Tutor**, using the Vercel CLI to run the serverless function
alongside the frontend:

```bash
npm install -g vercel
cp .env.example .env.local   # then edit .env.local and paste in your real key
vercel dev
```

## Get an Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com) and sign up or log in.
2. Go to **Settings → API Keys** and create a new key.
3. Anthropic API usage is billed separately from any Claude.ai subscription — check
   [current pricing](https://www.anthropic.com/pricing) before generating heavy traffic.

## Real data storage — now using Firebase

The app now uses **Firebase Authentication** (real accounts) and **Firestore** (a real,
cross-device database) instead of `localStorage`. Each signed-in user gets one document at
`users/{their uid}` holding their Premium status, reviewed mistakes, and completed lessons —
synced in real time and available from any device they log into.

### Set up your Firebase project (one-time)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a
   new project (the free "Spark" plan is enough for this).
2. In the project, go to **Build → Authentication → Get started**, then enable the
   **Email/Password** and **Google** sign-in providers (under Sign-in method).
3. Go to **Build → Firestore Database → Create database**. Start in production mode
   (the security rules below handle access control).
4. Once created, go to **Rules** in the Firestore section and paste in the contents of
   `firestore.rules` from this project, then click **Publish**. This restricts each user to
   only ever read or write their own document — nobody can see or edit anyone else's data.
5. Go to **Project settings** (gear icon) → scroll to **Your apps** → click the **</>** (web)
   icon to register a new web app. Firebase will show you a config object with values like
   `apiKey`, `authDomain`, etc.

### Add the config to your project

Copy those six values into `.env.local` (for local dev) using the `VITE_FIREBASE_*` names
in `.env.example`, and **also** add them as environment variables in Vercel (Project →
Settings → Environment Variables) — same process as `ANTHROPIC_API_KEY` earlier, just six
more entries. Redeploy after adding them.

**Important distinction from the Anthropic key:** these Firebase values are not secret —
Firebase's own docs confirm the web SDK config is meant to be visible in browser code.
Real protection comes entirely from the Firestore Security Rules you published in step 4,
not from hiding these values. It's still fine (and normal) to keep them out of git via
`.env.local`, just know that's a tidiness convention here, not a security requirement the
way it is for the Anthropic key.

### What this gets you vs. what it doesn't

- ✅ Real accounts (email/password and Google sign-in both work for real now)
- ✅ Data follows a user across devices and browsers
- ✅ Firestore's free tier comfortably covers a small-to-medium hobby project
- ⚠️ Apple sign-in is still a disabled placeholder — it needs an Apple Developer Program
  account and additional OAuth configuration beyond what's set up here
- ⚠️ Firestore security rules here are intentionally simple (one document per user, fully
  private). If you add features where users share or see each other's data (e.g. a real
  leaderboard), the rules will need to expand accordingly — the current Community Challenges
  leaderboard is still sample data, not read from Firestore

## Deploy it live (Vercel — recommended, free tier available)

Vercel is the easiest option here because it runs the `/api` folder as serverless
functions automatically, with zero extra config.

1. **Push this folder to a GitHub repository.**
   ```bash
   git init
   git add .
   git commit -m "VerbaLune"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com), sign in (GitHub login is easiest), and click
   **Add New → Project**.
3. Select your repository. Vercel will auto-detect it as a Vite app — you shouldn't need to
   change any build settings.
4. Before deploying, open **Environment Variables** and add:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your real key from the Anthropic console
5. Click **Deploy**. In about a minute you'll get a live URL like
   `https://verbalune-yourname.vercel.app`.
6. Every future `git push` to `main` automatically redeploys.

## Alternative: Netlify

Netlify works too, but its serverless functions live in a `netlify/functions` folder with
a slightly different handler signature than Vercel's `/api` convention. If you'd rather use
Netlify, tell me and I'll adjust `api/chat.js` into that format — as written, this project
is set up for Vercel.

## Alternative: static hosting only (GitHub Pages, S3, etc.)

If you don't need the AI Tutor's live chat, you can deploy the frontend as a static site
with no backend at all:

```bash
npm run build
```

This produces a `dist/` folder you can upload anywhere that serves static files. The AI
Tutor screen will still render, but sending a message will fail since there's no `/api/chat`
to answer it.

## Known limitations (carried over from the prototype)

See `VerbaLune-Handoff.md` for the full list — in short: there's no real user database, so
progress, streaks, XP, and accounts don't persist between visits or across devices yet, and
only 12 of the 16 curriculum units have a fully authored lesson. This project makes the app
*live and shareable*; it doesn't add a backend for persistence, payments, or content beyond
what the prototype already had.
