import type { Plugin } from "vite";

// Dev-only mock of the /api/tutor proxy endpoint.
//
// Lets you see the widget's full request → typing → reply flow without a real
// Anthropic API key. `apply: "serve"` means it ONLY runs under `npm run dev` —
// it is never part of the library build.

const CANNED: Record<string, string[]> = {
  about: [
    "Good question. Before I answer — what made you curious about Firme Coding? Is it the software work, or the people behind it?",
    "Firme is a team of developers building real production software, and a lot of us learned to build after being counted out. We ship websites, maintain them, and build custom platforms. Which of those is closest to what you need?",
  ],
  websites: [
    "Happy to help. Are you starting a brand-new site, or replacing one you already have?",
    "Firme builds custom sites — designed to your brand, fast, mobile-first, with the SEO basics done properly. Rough sense of how many pages you're imagining?",
  ],
  maintenance: [
    "Great — maintenance is the part people forget until something breaks. Do you have a site live right now that needs looking after?",
    "The monthly plan covers security patches, uptime monitoring, backups, and content updates — you email what you need, it gets done. Want me to walk through what a typical month looks like?",
  ],
  platform: [
    "Custom platforms are my favorite topic. What's the process you're trying to replace — a spreadsheet, a manual workflow, something else?",
    "Firme builds admin dashboards, member portals, and workflow tools tailored to how you actually work. We even built our own to run our training program. What would yours need to track?",
  ],
  donate: [
    "That means a lot. Donations fund laptops, instruction, and mentorship so the program stays free for the people who need it. Want the link?",
    "You can give at firmecoding.org/donate — every dollar opens a door for someone who's been counted out. Thank you for even asking.",
  ],
};

function replyFor(mod: string, turnCount: number): string {
  const lines = CANNED[mod] ?? [
    "That's a bit outside what I can cover here — but ask me about Firme's websites, maintenance, or custom platform work and I've got you.",
  ];
  return lines[Math.min(turnCount, lines.length - 1)];
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
          let mod = "about";
          let userTurns = 0;
          try {
            const parsed = JSON.parse(body || "{}");
            mod = parsed.module ?? "about";
            userTurns = (parsed.messages ?? []).filter(
              (m: { role: string }) => m.role === "user",
            ).length;
          } catch {
            /* ignore malformed body — fall back to defaults */
          }
          const reply = replyFor(mod, userTurns - 1);
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
