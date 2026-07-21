# Customization Guide

Everything you can change, and how to change it. This guide covers colors, logos, curriculum, and how to get more from Claude by adjusting the system prompt.

---

## Colors

The component uses two colors throughout:

```tsx
<AITutor
  primaryColor="#007AFF"   // user bubbles, send button, active states
  secondaryColor="#5856D6" // gradient partner: level ring, avatar, badges
/>
```

Both accept any valid CSS hex color. Try your brand colors — they apply instantly.

**Picking good colors:**
- `primaryColor` is the main accent — it sits behind white text (chat bubbles, send button), so pick something with enough contrast against white.
- `secondaryColor` blends with `primaryColor` in gradients (the level ring, the header avatar, badges). Pick a color in the same family for a smooth blend, or a contrasting one for a bolder look.

---

## Logo and org name

```tsx
<AITutor
  orgName="Code Forward"
  logoUrl="/images/logo.png"  // or a full URL
/>
```

If `logoUrl` is provided, your image shows in the header instead of the org name text. If both are provided, the image takes over.

Logo sizing: the component renders it as a 30×30 rounded square in the header. Works best with a square logo.

---

## Curriculum

The tutor stays grounded in whatever curriculum you give it. It won't answer outside that content — which keeps it focused on what you're actually teaching.

```ts
import type { Curriculum } from "thepplbot";

export const MY_CURRICULUM: Curriculum = {
  // key → module
  intro: {
    label: "What is a Computer?",  // shows in the dropdown
    content: `
      Overview: the physical parts of a computer and what each does.

      Key vocabulary:
      - CPU (Central Processing Unit): the brain, runs instructions
      - RAM: short-term memory, lost when power off
      - Storage (hard drive / SSD): long-term memory, stays when powered off
      - Input: keyboard, mouse, microphone
      - Output: screen, speakers, printer

      Common misconceptions:
      - RAM is NOT the same as storage
      - "The internet" is not a physical object you hold

      Notes for the assistant:
      - Use analogies: CPU = chef, RAM = counter space, storage = pantry
      - Don't rush vocabulary. Give people time with new words before applying them.
    `,
  },
  files: {
    label: "Files and Folders",
    content: `...`,
  },
};
```

**Content tips:**
- More detail → better guidance. Include key vocabulary, common questions, and notes on how to answer.
- Write it like you'd write notes for someone covering for you — assume they know nothing about your topic.
- The AI reads it on every message turn. Keep each module under ~8,000 words or token limits may apply.

**Adding a module** is just adding another key to the object — no cap on how many:

```ts
const MY_CURRICULUM: Curriculum = {
  week_01: { label: "Week 1: Variables", content: `...` },
  week_02: { label: "Week 2: Loops",     content: `...` },
  week_03: { label: "Week 3: Functions", content: `...` },  // ← add as many as you want
};
```

The learner switches between them with the **Modules** button. Mastery, chat, and
the typing drill all track the *active* module.

---

## Multiple courses

One `<AITutor>` holds one curriculum (a set of modules). For separate courses,
render separate instances — or swap the `curriculum` prop and force a clean
remount with a changing `key`:

```tsx
import { useState } from "react";
import { AITutor } from "thepplbot";
import { FRENCH_QUARTER_CURRICULUM } from "./curricula/french-quarter";
import { MATH_CURRICULUM } from "./curricula/math";

const COURSES = {
  history: { label: "New Orleans History", curriculum: FRENCH_QUARTER_CURRICULUM, color: "#8B5CF6" },
  math:    { label: "Intro to Math",       curriculum: MATH_CURRICULUM,          color: "#007AFF" },
};

function Tutor() {
  const [id, setId] = useState<keyof typeof COURSES>("history");
  const course = COURSES[id];
  return (
    <>
      <select value={id} onChange={(e) => setId(e.target.value as keyof typeof COURSES)}>
        {Object.entries(COURSES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
      </select>
      <div style={{ height: 640, maxWidth: 440 }}>
        <AITutor
          key={id}                          // ← remounts fresh on course change
          api={{ apiEndpoint: "/api/tutor" }}
          orgName={course.label}
          curriculum={course.curriculum}
          primaryColor={course.color}
        />
      </div>
    </>
  );
}
```

**Why the `key`:** the widget picks its starting module from the first key on
mount. Without a changing `key`, switching courses leaves it on the old course's
module (blank until the learner reopens the Modules sheet). `key={id}` tells React
to start clean.

- **Separate pages** (`/courses/history`, `/courses/math`) each mount their own
  `<AITutor>` — no `key` needed.
- **Per-course progress:** progress keys off `user.id` (or `orgName`). To keep each
  course's XP separate, give each a distinct `orgName`, or store progress by
  `courseId + userId` on your backend and pass the right `initialProgress`.

---

## Connecting your database

The `curriculum` and `initialProgress` props are fine when your data is static or
already loaded. To drive the widget from your own database, pass async functions
instead — the widget calls them and handles loading/error states for you. It never
talks to your database directly; you bring your own client (Supabase, Prisma, a
REST call, whatever).

Three hooks, all optional and independent:

| Prop | Direction | When it runs |
| --- | --- | --- |
| `loadCurriculum` | DB → widget | On mount. Fetches the modules. |
| `loadProgress` | DB → widget | On mount, and whenever `user.id` changes. |
| `onProgressChange` / `onTranscript` | widget → DB | After each question / typing drill. |

```tsx
import { useCallback } from "react";
import { AITutor, type Curriculum, type TutorProgress, type TranscriptTurn } from "thepplbot";
import { supabase } from "./supabase";

function Tutor({ userId }: { userId: string }) {
  // Wrap loaders in useCallback so their identity is stable — a new function
  // every render re-triggers the fetch.
  const loadCurriculum = useCallback(async (): Promise<Curriculum> => {
    const { data } = await supabase.from("modules").select("key,label,content").order("position");
    return Object.fromEntries((data ?? []).map((m) => [m.key, { label: m.label, content: m.content }]));
  }, []);

  const loadProgress = useCallback(async (id: string | undefined): Promise<TutorProgress | null> => {
    if (!id) return null;
    const { data } = await supabase.from("progress").select("counts,typing_xp").eq("user_id", id).single();
    return data ? { counts: data.counts, typingXp: data.typing_xp } : null;
  }, []);

  const saveProgress = useCallback((p: TutorProgress) => {
    void supabase.from("progress").upsert({ user_id: userId, counts: p.counts, typing_xp: p.typingXp });
  }, [userId]);

  const saveTranscript = useCallback((t: TranscriptTurn) => {
    void supabase.from("transcripts").insert({
      user_id: t.userId, module: t.module, question: t.question, reply: t.reply, modality: t.modality,
    });
  }, []);

  return (
    <AITutor
      api={{ apiEndpoint: "/api/tutor" }}
      user={{ id: userId }}
      loadCurriculum={loadCurriculum}
      loadProgress={loadProgress}
      onProgressChange={saveProgress}
      onTranscript={saveTranscript}
    />
  );
}
```

**Behavior worth knowing:**
- While `loadCurriculum` is fetching, the widget shows a loading state instead of
  the static fallback. If it rejects, it falls back to the `curriculum` prop (or the
  bundled demo) and surfaces the error.
- A value from `loadProgress` seeds the widget but is **not** echoed back to
  `onProgressChange` — only real learner activity triggers a save, so you won't get
  a write-back loop on load.
- `onTranscript` is fire-and-forget. The widget doesn't await it, and if it throws
  the chat keeps working. Do your own batching/retries if you need them.
- Loading async? You don't need `initialProgress` when you pass `loadProgress`. If
  you pass both, `loadProgress` wins once it resolves.

---

## System prompt

The system prompt controls *how* Claude behaves as a tutor. The default uses a Socratic approach — it asks questions, gives hints, and doesn't hand over answers.

Override it fully:

```tsx
<AITutor
  systemPrompt={`
    You are a patient, encouraging tutor for adult learners returning to the workforce.
    Your tone is warm and direct. Never use jargon.
    Guide the learner with questions — don't give the answer unless they've tried twice.
    Stay within the curriculum content below.

    — CURRICULUM —
    ${moduleContent}
  `}
/>
```

Or use the `systemPrompt` prop to inject your own framing around the built-in structure.

**Prompting Claude well — a short guide:**

Claude responds to *role + behavior + constraints*:

```
Role: "You are a tutor for..."
Behavior: "Guide with questions. Use simple language. Give one idea at a time."
Constraints: "Only answer questions covered in the curriculum. If asked something outside it, say so."
Tone: "Warm, direct, never condescending."
Format: "Keep responses under 3 short paragraphs."
```

What makes a system prompt stronger:
- **Be specific about tone.** "Warm" alone is vague. "Treat the fellow like a capable adult who is new to this topic" is concrete.
- **Name what NOT to do.** "Don't lecture. Don't use bullet lists unless necessary." Claude takes negative instructions seriously.
- **Tell it what to do when it doesn't know.** "If the question is outside the curriculum, say: 'That's a bit outside what we're covering this week — let's come back to [topic].' "
- **Control length.** Claude defaults to thorough. Add: "Keep responses short — 2-4 sentences per turn."

For a more advanced customization, pass a function instead of a string so the prompt updates per-module:

```tsx
// In your wrapper component:
const systemPrompt = `
  You are helping ${orgName} visitors with ${activeModule.label}.
  Tone: encouraging, peer-to-peer, never institutional.
  ${activeModule.content}
`;

<AITutor systemPrompt={systemPrompt} ... />
```

---

## Model selection

The default model is `claude-haiku-4-5-20251001` — it's fast and affordable for a chat widget.

For more thoughtful, nuanced responses, switch to `claude-sonnet-5`:

```tsx
<AITutor model="claude-sonnet-5" ... />
```

Cost comparison (approximate, 2025 pricing):
- Haiku: ~$0.001 per conversation turn
- Sonnet: ~$0.01 per conversation turn

For a free community program, Haiku keeps costs low. For a small paid cohort, Sonnet may be worth it.

---

## Production setup

For any site accessible to the public, run Claude server-side. Here's the pattern:

```
Browser → POST /api/tutor → Your server → Anthropic API → reply → Browser
```

Your API key never leaves your server. Here's a minimal Express route:

```ts
import Anthropic from "@anthropic-ai/sdk";
import express from "express";

const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.post("/api/tutor", async (req, res) => {
  const { systemPrompt, messages } = req.body;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const reply = response.content.find((b) => b.type === "text")?.text ?? "";
  res.json({ reply });
});
```

---

## Real images (Unsplash)

The **images** modality tells Claude to suggest images, and the widget renders any
Markdown image (`![alt](url)`) in a reply. But Claude doesn't have real photo URLs —
so to show actual pictures, fetch one in your **proxy** and append it to the reply.

The widget encodes the active modality in `systemPrompt` (a line like
`PREFERRED EXPLANATION STYLE — Images: …`), so the proxy can tell when images are
wanted.

1. Get a free **Access Key** at [unsplash.com/developers](https://unsplash.com/developers) and set it as `UNSPLASH_ACCESS_KEY`.
2. In your `/api/tutor` route, when images mode is on, search Unsplash for the topic and append the photo as Markdown:

```ts
// app/api/tutor/route.ts (Next.js)
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function unsplashImage(query: string): Promise<string | null> {
  const res = await fetch(
    `https://api.unsplash.com/search/photos?per_page=1&query=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const photo = data.results?.[0];
  if (!photo) return null;
  // Markdown image + attribution link (Unsplash guidelines ask for credit).
  return `![${photo.alt_description ?? query}](${photo.urls.small})\n\n_Photo by [${photo.user.name}](${photo.user.links.html}?utm_source=thepplbot&utm_medium=referral) on [Unsplash](https://unsplash.com/?utm_source=thepplbot&utm_medium=referral)_`;
}

export async function POST(req: Request) {
  const { systemPrompt, messages } = await req.json();
  const wantsImage = /PREFERRED EXPLANATION STYLE — Images/i.test(systemPrompt);

  const res = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });
  let reply = res.content.find((b) => b.type === "text")?.text ?? "";

  if (wantsImage) {
    // Use the learner's last question as the search query.
    const query = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const img = await unsplashImage(query);
    if (img) reply = `${img}\n\n${reply}`;
  }

  return Response.json({ reply });
}
```

That's it — no widget changes. When the learner is in images mode, the reply now
leads with a real photo, which the widget renders inline.

**Notes:**
- Unsplash's free tier allows 50 requests/hour (demo) — apply for production limits when you launch.
- Their guidelines require crediting the photographer; the snippet appends that automatically.
- Prefer generated images instead? Swap `unsplashImage` for a call to your image-generation provider and return a Markdown image the same way.

---

## Questions?

Open an issue on the [GitHub repo](https://github.com/firme-coding/thepplbot) or reach out at [firmecoding.org](https://firmecoding.org).

Maintained by [Firme Coding](https://firmecoding.org) — built by formerly incarcerated developers, for communities building their future in tech. Use it well, and consider [donating](https://firmecoding.org/donate).
