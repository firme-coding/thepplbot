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
- **Learning modalities** — reading · visual · audio · images · hands-on. Picking one tailors how the tutor explains. Audio is spoken via the browser; for real photos in *images* mode, see the [Unsplash recipe](./CUSTOMIZATION.md#real-images-unsplash).
- **Gamification** — earn XP from questions and typing, level up, master modules, unlock badges. Progress persists in `localStorage`.
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
