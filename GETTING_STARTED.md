# Getting Started

A step-by-step tutorial to get **thepplbot** running in a React app, written for someone who hasn't shipped a package integration before. Follow it top to bottom.

By the end you'll have the AI tutor widget on a page, answering questions.

> Prefer the reference docs? See the [README](./README.md) for the full props table and [CUSTOMIZATION.md](./CUSTOMIZATION.md) for theming and curriculum.

---

## What you'll need

- A React 18+ app (Vite or Next.js is fine).
- Node 18 or newer.
- An Anthropic API key (we'll get one in Step 2).

---

## Step 1 — Install the package

In your project folder, run:

```bash
npm install thepplbot
```

That's it — the widget has no other dependencies.

---

## Step 2 — Get an Anthropic API key

The widget talks to Claude (Anthropic's AI), so you need a key. It's pay-as-you-go and testing costs pennies.

1. Go to **[console.anthropic.com](https://console.anthropic.com)** and sign up or log in.
2. Add credits under **Settings → Billing**. Without credits, calls fail. A few dollars is plenty.
3. Go to **Settings → API Keys → Create Key**. Name it something like `thepplbot-dev`.
4. **Copy the key immediately** — it looks like `sk-ant-api03-XXXX…` and is shown only once. Lost it? Just create another.

Keep that key handy for the next step. Don't paste it into your code.

---

## Step 3 — Store your key safely

Create a file named `.env.local` in your project root:

```bash
# .env.local
VITE_ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

Then make sure it's ignored by git. Open `.gitignore` and confirm it contains:

```
.env.local
```

> **Why?** Committing an API key lets anyone who sees your repo spend your money. `.env.local` keeps it on your machine only.

*(Using Next.js? The variable name and access differ slightly — see Step 6.)*

---

## Step 4 — Drop the widget on a page

Create a component and render `<AITutor>`. Give its container a height so it has room to show.

```tsx
import { AITutor } from "thepplbot";

export default function TutorPage() {
  return (
    <div style={{ height: "640px", maxWidth: "440px", margin: "0 auto" }}>
      <AITutor
        api={{ apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY }}
        orgName="My Org"
      />
    </div>
  );
}
```

Run your dev server (`npm run dev`) and open the page. You should see the tutor. Type a question and it replies.

✅ **You now have a working AI tutor.** Everything below is optional polish.

---

## Step 5 — Try the common options

Pass a few extra props to customize it. All are optional.

```tsx
<AITutor
  api={{ apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY }}
  orgName="My Org"
  primaryColor="#007AFF"        // your brand color
  secondaryColor="#5856D6"      // gradient accent
  logoUrl="/logo.png"           // shows instead of the letter avatar
  position="bottom-right"       // float it in a corner instead of inline
/>
```

With `position` set, the widget becomes a chat bubble in the corner that opens on tap — you don't need the sized `<div>` wrapper from Step 4.

---

## Step 6 — Go to production (IMPORTANT)

The Step 4 setup puts your API key in the browser. That's fine for **local dev** or a **login-only internal tool**, but **never** for a public website — visitors can read the key and run up your bill.

For a public site, run Claude on **your server** and point the widget at it:

```tsx
<AITutor api={{ apiEndpoint: "/api/tutor" }} />
```

Then create the server route. Example for **Next.js** (`app/api/tutor/route.ts`):

```ts
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

Install the SDK (`npm install @anthropic-ai/sdk`) and set `ANTHROPIC_API_KEY` in your server environment (not `.env.local`, and not prefixed with `VITE_`/`NEXT_PUBLIC_` — those get exposed to the browser).

The widget POSTs `{ module, systemPrompt, messages }` and expects `{ reply }` back. Your key never leaves the server.

---

## Props cheat sheet

Only **`api`** is required. Everything else has a default.

| Prop | Required | Type | Default | What it does |
|------|----------|------|---------|--------------|
| `api` | **Yes** | `{ apiKey }` or `{ apiEndpoint }` | — | How to reach Claude. One of the two |
| `orgName` | no | `string` | `"AI Tutor"` | Name in the header |
| `logoUrl` | no | `string` | — | Logo in the header |
| `primaryColor` | no | `string` | `"#007AFF"` | Main accent color |
| `secondaryColor` | no | `string` | `"#5856D6"` | Gradient accent |
| `curriculum` | no | `Curriculum` | demo content | The material the tutor teaches |
| `model` | no | `string` | `"claude-haiku-4-5-20251001"` | Which Claude model |
| `systemPrompt` | no | `string` | Socratic default | Override how the AI behaves |
| `placeholder` | no | `string` | `"Ask a question…"` | Input hint text |
| `defaultModality` | no | `Modality` | `"reading"` | Starting example style |
| `position` | no | `ChatPosition` | — | Float in a corner vs. inline |
| `onClose` | no | `() => void` | — | Runs when the ✕ is tapped |
| `user` | no | `TutorUser` | — | Signed-in learner `{ id, name, gameName }` |
| `initialProgress` | no | `TutorProgress` | — | Restore saved XP/progress |
| `onProgressChange` | no | `(p) => void` | — | Save progress when it changes |
| `className` | no | `string` | — | CSS class on the root element |

Types you can import for TypeScript:

```ts
import type {
  Curriculum, Modality, ChatPosition, TutorUser, TutorProgress,
} from "thepplbot";
```

---

## Troubleshooting

- **"Widget shows but sending a message errors."** Your key is missing, wrong, or out of credits. Check `.env.local`, restart the dev server (env changes need a restart), and confirm billing in the Anthropic console.
- **`import.meta.env` is undefined.** You're not on Vite, or forgot the `VITE_` prefix. In Next.js use `process.env` (server) or the proxy from Step 6.
- **Nothing renders / zero height.** The inline widget fills its parent — give the parent a height (Step 4). Or use `position` to float it.
- **Don't expose the key.** If your site is public and you used `apiKey`, switch to the proxy (Step 6) before launch.

---

## Next steps

- **Theme it & add your own lessons** → [CUSTOMIZATION.md](./CUSTOMIZATION.md)
- **Full API reference** → [README](./README.md)

Built with ♥ by [Firme Coding](https://firmecoding.org).
