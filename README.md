# thepplbot

[![CI](https://github.com/firme-coding/thepplbot/actions/workflows/ci.yml/badge.svg)](https://github.com/firme-coding/thepplbot/actions/workflows/ci.yml)

An embeddable, iOS-style AI tutor widget for any React site. Swap in your colors, logo, and content, drop it into a page, and you get a grounded Socratic tutor with typing practice and built-in gamification.

The bundled demo content is a live tour of [Firme Coding](https://firmecoding.org) — a team of developers, including formerly incarcerated engineers, building production software for businesses and nonprofits.

> **New here?** Start with the step-by-step **[Getting Started guide](./GETTING_STARTED.md)**. This README is the full reference.

---

## Features

- **Native iOS feel** — frosted nav/input bars, segmented controls, system blue, rounded cards, spring motion.
- **Three views** in one segmented control:
  - **Chat** — Socratic tutor grounded in your curriculum.
  - **Typing** — a typing drill built from the module's own key terms, scored on WPM + accuracy.
  - **Progress** — level ring, XP, module mastery, and badges.
- **Learning modalities** — reading · visual · audio · images · hands-on. Picking one tailors how the tutor explains. The **Listen** button reads answers aloud; install the optional neural voice for a natural read on every OS (see [Audio voice](#audio-voice)). For real photos in *images* mode, see the [Unsplash recipe](./CUSTOMIZATION.md#real-images-unsplash).
- **Gamification** — earn XP from questions and typing, level up, master modules, unlock badges. Progress persists in `localStorage`.
- **Light / dark / auto theme** — `theme` recolors the chrome to match your app; `auto` follows the visitor's OS setting. Your brand accents stay put. See [Dark mode](#dark-mode).
- **Custom launcher icon** — swap the floating bubble's glyph for your own image, emoji, or React node via `launcherIcon`. See [Custom launcher icon](#custom-launcher-icon).
- **Expand & close** — resize the widget or dismiss it via the `onClose` prop.
- **Bring your own model & curriculum** — any Claude model, any content.

---

## Install

```bash
npm install thepplbot
# or
yarn add thepplbot
```

React 18+ is required as a peer dependency.

---

## Audio voice

The **Listen** button (and the *audio* modality) reads tutor answers aloud. Two engines, picked automatically:

- **Neural voice (recommended)** — [Kokoro-82M](https://github.com/hexgrad/kokoro), an open (Apache-2.0) text-to-speech model that runs entirely in the browser via WebGPU (falling back to WASM). No API key, no server, and the same natural voice for every visitor regardless of OS. It's an **optional dependency**, so install it to enable it:

  ```bash
  npm install kokoro-js
  ```

  The ~80 MB model downloads on the first click and is cached afterward; the button shows **Loading…** while it downloads.

- **Browser fallback** — if `kokoro-js` isn't installed (or can't run), the widget uses the browser's built-in Web Speech voices. Zero download, but quality depends on the visitor's OS.

Nothing to configure — the widget uses the neural voice when it's available and falls back otherwise. To change which neural voice is used, set `KOKORO_VOICE` in `src/lib/speech.ts` to any name from Kokoro's voice list (e.g. `af_heart`, `am_michael`, `bf_emma`, `bm_george`).

---

## Get an Anthropic API key

The widget talks to Claude, so you need a key from [console.anthropic.com](https://console.anthropic.com): sign up, add billing credits, then **Settings → API Keys → Create Key** and copy it (shown once, looks like `sk-ant-api03-…`).

Store it in `.env.local` for dev (and gitignore it). **Never** ship a key to the browser on a public site — use the [proxy setup](#api-config) instead.

Full walkthrough with screenshots-level detail: **[GETTING_STARTED.md](./GETTING_STARTED.md)**.

---

## Quick start

```tsx
import { AITutor } from "thepplbot";

export default function MyPage() {
  return (
    <div style={{ height: "640px" }}>
      <AITutor
        api={{ apiKey: import.meta.env.VITE_ANTHROPIC_KEY }}
        orgName="My Org"
        primaryColor="#007AFF"
        secondaryColor="#5856D6"
      />
    </div>
  );
}
```

The widget ships with a demo curriculum loaded by default. Swap in your own — see [CUSTOMIZATION.md](./CUSTOMIZATION.md).

> **CDN / no install?** It's an ES module on unpkg: `import { AITutor } from "https://unpkg.com/thepplbot"` inside a `<script type="module">`.

---

## Floating launcher

Pass `position` to dock it as a chat bubble in a viewport corner. It opens on tap and collapses on ✕ — no layout wrapper needed.

```tsx
<AITutor
  api={{ apiEndpoint: "/api/tutor" }}
  orgName="My Org"
  position="bottom-right"   // or bottom-left | top-right | top-left
/>
```

Without `position`, the widget renders inline and fills its parent container (give the parent a height).

### Custom launcher icon

By default the bubble shows a built-in chat glyph. Pass `launcherIcon` to make it match your app — an image URL, an emoji, or any React node:

```tsx
<AITutor api={{ apiEndpoint: "/api/tutor" }} position="bottom-right" launcherIcon="/bot.png" />
<AITutor api={{ apiEndpoint: "/api/tutor" }} position="bottom-right" launcherIcon="🤖" />
<AITutor api={{ apiEndpoint: "/api/tutor" }} position="bottom-right" launcherIcon={<MyIcon />} />
```

The open-state button always shows the ✕ so learners can close it.

---

## Dark mode

`theme` recolors the chrome (panel background, text, cards, bubbles) so the widget matches your app. Your `primaryColor` / `secondaryColor` accents stay the same in both themes.

```tsx
<AITutor api={{ apiEndpoint: "/api/tutor" }} theme="dark" />   // or "light" (default)
<AITutor api={{ apiEndpoint: "/api/tutor" }} theme="auto" />   // follow the OS, live
```

`auto` reads `prefers-color-scheme` and switches when the visitor toggles their OS appearance. If your app has its own theme toggle, drive `theme` from your state instead:

```tsx
<AITutor api={{ apiEndpoint: "/api/tutor" }} theme={appIsDark ? "dark" : "light"} />
```

---

## Props

Only `api` is required. Everything else is optional.

| Prop | Required | Type | Default | Description |
|------|----------|------|---------|-------------|
| `api` | **Yes** | `ApiConfig` | — | API key or proxy endpoint. Exactly one of `apiKey` / `apiEndpoint` (see below) |
| `orgName` | no | `string` | `"AI Tutor"` | Organization name in the header |
| `logoUrl` | no | `string` | — | Logo shown in the header instead of the letter avatar |
| `primaryColor` | no | `string` | `"#007AFF"` | Accent color — user bubbles, send button, active states |
| `secondaryColor` | no | `string` | `"#5856D6"` | Gradient partner — level ring, avatar, badges |
| `theme` | no | `"light" \| "dark" \| "auto"` | `"light"` | Chrome theme (backgrounds, text, surfaces). `auto` follows the visitor's OS setting |
| `launcherIcon` | no | `ReactNode` | — | Custom icon for the floating bubble: image URL, emoji, or any React node. See below |
| `curriculum` | no | `Curriculum` | demo curriculum | Your custom curriculum — see CUSTOMIZATION.md |
| `model` | no | `string` | `"claude-haiku-4-5-20251001"` | Claude model to use |
| `systemPrompt` | no | `string` | Built-in Socratic prompt | Override the AI's behavior entirely |
| `placeholder` | no | `string` | `"Ask a question…"` | Chat input placeholder |
| `defaultModality` | no | `Modality` | `"reading"` | Starting example style: `reading \| visual \| audio \| images \| hands-on` |
| `position` | no | `ChatPosition` | — | Dock as a floating launcher: `bottom-right \| bottom-left \| top-right \| top-left`. Omit for inline |
| `onClose` | no | `() => void` | — | Called on the close (✕) button. If omitted (and not floating), the button is hidden |
| `user` | no | `TutorUser` | — | Signed-in learner: `{ id, name, gameName }` — see below |
| `initialProgress` | no | `TutorProgress` | — | Progress to restore on mount (from your backend) |
| `onProgressChange` | no | `(p: TutorProgress) => void` | — | Fires when progress changes so you can persist it |
| `loadCurriculum` | no | `() => Promise<Curriculum>` | — | Async-load modules from your DB — see CUSTOMIZATION.md → Connecting your database |
| `loadProgress` | no | `(userId?) => Promise<TutorProgress \| null>` | — | Async-load saved progress from your DB, keyed by `user.id` |
| `onTranscript` | no | `(t: TranscriptTurn) => void` | — | Fires after each Q&A turn so you can persist the transcript |
| `className` | no | `string` | — | Optional CSS class on the root element |

---

## API config

**Option 1 — API key (development / private apps only)**

```tsx
api={{ apiKey: "sk-ant-..." }}
```

⚠️ Never expose your API key on a public site. Use the proxy option in production.

**Option 2 — Proxy endpoint (production)**

```tsx
api={{ apiEndpoint: "/api/tutor" }}
```

Your endpoint receives:
```json
{
  "module": "websites",
  "systemPrompt": "...",
  "messages": [{ "role": "user", "content": "..." }]
}
```

And must return:
```json
{ "reply": "..." }
```

Example Next.js API route:

```ts
// app/api/tutor/route.ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  const { systemPrompt, messages } = await req.json();

  const res = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const reply = res.content.find((b) => b.type === "text")?.text ?? "";
  return Response.json({ reply });
}
```

---

## Use your own curriculum

Each module's content grounds the tutor **and** seeds the typing drill (it pulls key terms and overview sentences straight from the text).

```tsx
import { AITutor } from "thepplbot";
import type { Curriculum } from "thepplbot";

const MY_CURRICULUM: Curriculum = {
  intro: {
    label: "Introduction",
    content: `
      Overview: what this module covers.
      Key points:
      - the things the AI should stay grounded in
      - vocabulary worth drilling
      Common questions: what people usually ask, and how to answer.
    `,
  },
  // ... add more modules
};

<AITutor api={{ apiEndpoint: "/api/tutor" }} curriculum={MY_CURRICULUM} />
```

A ready-made 7-module example ships with the package — import it to try a full curriculum or use as a template:

```tsx
import { FRENCH_QUARTER_CURRICULUM } from "thepplbot/curriculum-french-quarter";

<AITutor api={{ apiEndpoint: "/api/tutor" }} curriculum={FRENCH_QUARTER_CURRICULUM} />
```

See [CUSTOMIZATION.md](./CUSTOMIZATION.md) for the full guide, including prompting Claude for different use cases.

---

## Users & saved progress

Pass the signed-in learner and persist their progress in your own backend so it follows them across devices.

```tsx
import { AITutor } from "thepplbot";
import type { TutorProgress } from "thepplbot";

<AITutor
  api={{ apiEndpoint: "/api/tutor" }}
  user={{ id: user.id, name: user.fullName, gameName: user.handle }}
  initialProgress={savedProgress}            // loaded from your DB
  onProgressChange={(p) => saveProgress(user.id, p)}  // write it back
/>
```

- **`user.id`** keys the learner's progress.
- **`user.name`** is passed to the tutor so it addresses them by name. Users edit their name in *your* platform's settings; pass the new value in and the widget updates. The widget itself never edits it.
- **`user.gameName`** is the public display handle shown in the header and Progress view.
- **`onProgressChange`** makes your backend the source of truth — when provided, the widget stops using `localStorage`. Without it, progress is cached in `localStorage` keyed by `user.id` (or `orgName` if no user), which stays on one device.

> Loading progress asynchronously? Mount the widget after it resolves, or pass `key={user.id}` so it re-seeds when the user (or their data) changes.

`TutorProgress` is `{ counts: Record<string, number>; typingXp: number }` — treat it as an opaque blob you store and hand back.

---

## Releasing

A GitHub Action (`.github/workflows/publish.yml`) publishes to npm automatically whenever you push a version tag — no OTP prompt.

One-time setup: add an npm token as a repo secret named `NPM_TOKEN` (see below).

Then every release is:

```bash
npm version patch     # or minor / major — bumps package.json, commits, tags
git push --follow-tags
```

The Action checks out the tag, runs `npm test`, verifies the tag matches `package.json`, and publishes with provenance.

---

## Development

```bash
npm run dev        # live preview at localhost:5173 (mock replies, no key needed)
npm run build      # produce dist/ (ESM + UMD + type declarations)
npm run typecheck  # tsc --noEmit
npm test           # build, then a headless smoke test driven by mock data
```

`npm test` renders the compiled package in jsdom, stubs `fetch` with mock replies, and checks the chat, XP/gamification, and typing views all work — no API key required.

---

## Donate

This project is maintained by [Firme Coding](https://firmecoding.org). Client work and donations fund a free training program that brings new developers — many of them formerly incarcerated — into tech careers.

If the widget is useful to you, consider giving back:

**→ [Donate to Firme Coding](https://firmecoding.org/donate)**

Every dollar goes toward laptops, instruction, and mentorship for the next cohort. Need a website, ongoing maintenance, or a custom platform built? [Get in touch](https://firmecoding.org) — hiring the team supports the mission too.

---

## License

MIT — use it, fork it, build on it. If it helps your community, we'd love to hear about it.

Built with ♥ by [Firme Coding](https://firmecoding.org).
