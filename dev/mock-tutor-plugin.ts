import type { Plugin } from "vite";

// Dev-only mock of the /api/tutor proxy endpoint.
//
// `apply: "serve"` means it ONLY runs under `npm run dev` — never in the build.
//
// It is CURRICULUM-AWARE: the widget sends the active module's content inside
// `systemPrompt`, and this mock answers from THAT text. So whatever course /
// curriculum is loaded (Firme demo, French Quarter, your own) drives the reply —
// no per-module hardcoding, no key needed.

/** Everything after the "— CONTENT —" marker is the active module's content. */
function extractContent(systemPrompt: string): string {
  const marker = "— CONTENT —";
  const idx = systemPrompt.lastIndexOf(marker);
  return (idx >= 0 ? systemPrompt.slice(idx + marker.length) : systemPrompt).trim();
}

/** Break the module content into short, quotable facts (overview + bullets). */
function facts(content: string): string[] {
  const bullets = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("-"))
    .map((l) => l.replace(/^-\s*/, "").replace(/\s+/g, " ").trim());
  const overview = (content.match(/Overview:\s*([\s\S]*?)(?:\n\s*\n|$)/i)?.[1] ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = overview
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
  return [...sentences, ...bullets].filter((f) => f.length >= 12);
}

const words = (s: string) => s.toLowerCase().match(/[a-z]{4,}/g) ?? [];

/** Rank facts by keyword overlap with the question (best first). */
function rankFacts(pool: string[], question: string): { fact: string; score: number }[] {
  const q = new Set(words(question));
  return pool
    .map((fact) => ({ fact, score: words(fact).filter((w) => q.has(w)).length }))
    .sort((a, b) => b.score - a.score);
}

const MATCH_LEADS = [
  "Good question — here's what this lesson says about that:",
  "Let's look at what the material tells us:",
  "Here's the relevant piece:",
];
const NOMATCH_LEADS = [
  "We haven't hit that exact point, but here's what this lesson covers:",
  "That's a little outside this bit — but here's what we're working with:",
];
const FOLLOWUPS = [
  "What do you make of that?",
  "Why do you think that mattered?",
  "Want to dig into any of those?",
  "Which part stands out to you?",
];

function buildReply(systemPrompt: string, question: string, userTurns: number): string {
  const pool = facts(extractContent(systemPrompt));
  if (!pool.length) return "Tell me a bit about what you'd like to explore, and we'll start there.";

  const ranked = rankFacts(pool, question);
  const matched = ranked.filter((r) => r.score > 0);
  const hit = matched.length > 0;

  // Top 2–3 relevant facts (or the first few if nothing matched), de-duplicated.
  const chosen = (hit ? matched : ranked).slice(0, 3).map((r) => r.fact);
  const unique = [...new Set(chosen)];

  const pick = <T,>(arr: T[]) => arr[Math.max(0, userTurns - 1) % arr.length];
  const lead = hit ? pick(MATCH_LEADS) : pick(NOMATCH_LEADS);
  const body = unique.map((f) => `- ${f}`).join("\n");
  return `${lead}\n\n${body}\n\n${pick(FOLLOWUPS)}`;
}

export function mockTutorApi(): Plugin {
  return {
    name: "mock-tutor-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/tutor", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          return res.end();
        }
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          let systemPrompt = "";
          let question = "";
          let userTurns = 0;
          try {
            const parsed = JSON.parse(body || "{}");
            systemPrompt = parsed.systemPrompt ?? "";
            const msgs = (parsed.messages ?? []) as { role: string; content: string }[];
            userTurns = msgs.filter((m) => m.role === "user").length;
            question = [...msgs].reverse().find((m) => m.role === "user")?.content ?? "";
          } catch {
            /* ignore malformed body — fall back to defaults */
          }
          const reply = buildReply(systemPrompt, question, userTurns);
          // Small delay so the typing indicator is visible
          setTimeout(() => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ reply }));
          }, 600);
        });
      });
    },
  };
}
