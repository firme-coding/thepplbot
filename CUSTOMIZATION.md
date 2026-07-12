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

## Questions?

Open an issue on the [GitHub repo](https://github.com/firme-coding/thepplbot) or reach out at [firmecoding.org](https://firmecoding.org).

Maintained by [Firme Coding](https://firmecoding.org) — built by formerly incarcerated developers, for communities building their future in tech. Use it well, and consider [donating](https://firmecoding.org/donate).
