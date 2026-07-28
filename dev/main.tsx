// Dev-only harness / live playground for <AITutor />.
// Not part of the published package (the package entry is src/index.ts).
import React, { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { AITutor, DEMO_CURRICULUM } from "../src/index";
import type { Curriculum, TranscriptTurn, TutorProgress, Theme } from "../src/index";
import { FRENCH_QUARTER_CURRICULUM } from "../src/curriculum-french-quarter";

const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;

// With a key → talk to Claude directly. Without one → hit the mock /api/tutor
// endpoint served by dev/mock-tutor-plugin.ts so you can see the flow offline.
const api = apiKey ? { apiKey } : { apiEndpoint: "/api/tutor" };

const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
// Page colors are CSS variables so the whole homepage flips with the theme
// control below (see DevApp). BLUE is the accent and reads fine in both modes.
const INK = "var(--doc-ink)";
const INK2 = "var(--doc-ink2)";
const CARD = "var(--doc-card)";
const BORDER = "var(--doc-border)";
const BLUE = "#007AFF";

// CSS-variable values for each page theme, set on the root container.
const DOC_VARS = {
  light: {
    "--doc-bg": "linear-gradient(180deg,#f5f6f8,#eceef2)",
    "--doc-card": "#ffffff",
    "--doc-ink": "#1C1C1E",
    "--doc-ink2": "rgba(60,60,67,0.62)",
    "--doc-border": "rgba(60,60,67,0.16)",
    "--doc-code-bg": "#1C1C2E",
    "--doc-subtle": "#F2F2F7",
  },
  dark: {
    "--doc-bg": "linear-gradient(180deg,#0a0a0c,#000000)",
    "--doc-card": "#1C1C1E",
    "--doc-ink": "#F5F5F7",
    "--doc-ink2": "rgba(235,235,245,0.6)",
    "--doc-border": "rgba(235,235,245,0.16)",
    "--doc-code-bg": "#000000",
    "--doc-subtle": "#2C2C2E",
  },
} as const;

const COURSES = {
  firme: { label: "Firme Coding (demo)", curriculum: DEMO_CURRICULUM, color: "#007AFF" },
  history: { label: "French Quarter History", curriculum: FRENCH_QUARTER_CURRICULUM, color: "#8B5CF6" },
} as const;
type CourseId = keyof typeof COURSES;

// ── Fake "database" for the DB-mode demo ────────────────────────────────────
// Stands in for Supabase/Prisma/your REST API. Progress is persisted in
// localStorage; curriculum is served from the in-memory COURSES map. Every read
// is delayed so the widget's loading state is actually visible.
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const progressKey = (userId: string | undefined) => `pplbot.demo.progress.${userId ?? "anon"}`;

const fakeDb = {
  async fetchCurriculum(courseId: CourseId): Promise<Curriculum> {
    await sleep(900); // simulate a network round-trip
    return COURSES[courseId].curriculum;
  },
  async fetchProgress(userId: string | undefined): Promise<TutorProgress | null> {
    await sleep(500);
    const raw = localStorage.getItem(progressKey(userId));
    return raw ? (JSON.parse(raw) as TutorProgress) : null;
  },
  saveProgress(userId: string | undefined, p: TutorProgress) {
    localStorage.setItem(progressKey(userId), JSON.stringify(p));
  },
};

const DEMO_USER = { id: "demo-user-1", name: "Demo Learner", gameName: "demo" };

const PROPS: { name: string; req: boolean; type: string; def: string; desc: string }[] = [
  { name: "api", req: true, type: "{ apiKey } | { apiEndpoint }", def: "—", desc: "How to reach Claude. Exactly one." },
  { name: "curriculum", req: false, type: "Curriculum", def: "demo", desc: "Your lessons (object of modules)." },
  { name: "orgName", req: false, type: "string", def: '"AI Tutor"', desc: "Name in the header." },
  { name: "logoUrl", req: false, type: "string", def: "—", desc: "Logo instead of the letter avatar." },
  { name: "primaryColor", req: false, type: "string", def: '"#007AFF"', desc: "Main accent color." },
  { name: "secondaryColor", req: false, type: "string", def: '"#5856D6"', desc: "Gradient accent." },
  { name: "theme", req: false, type: '"light" | "dark" | "auto"', def: '"light"', desc: "Chrome theme; auto follows the OS." },
  { name: "launcherIcon", req: false, type: "ReactNode", def: "—", desc: "Custom floating-bubble icon (URL/emoji/node)." },
  { name: "model", req: false, type: "string", def: "claude-haiku-4-5", desc: "Which Claude model." },
  { name: "systemPrompt", req: false, type: "string", def: "Socratic", desc: "Override how the AI behaves." },
  { name: "placeholder", req: false, type: "string", def: '"Ask a question…"', desc: "Input hint text." },
  { name: "defaultModality", req: false, type: "Modality", def: '"reading"', desc: "Starting example style." },
  { name: "position", req: false, type: "ChatPosition", def: "—", desc: "Float in a corner vs. inline." },
  { name: "onClose", req: false, type: "() => void", def: "—", desc: "Runs when the ✕ is tapped." },
  { name: "user", req: false, type: "TutorUser", def: "—", desc: "Learner { id, name, gameName }." },
  { name: "initialProgress", req: false, type: "TutorProgress", def: "—", desc: "Restore saved XP/progress." },
  { name: "onProgressChange", req: false, type: "(p) => void", def: "—", desc: "Save progress when it changes." },
  { name: "loadCurriculum", req: false, type: "() => Promise<Curriculum>", def: "—", desc: "Async-load modules from your DB." },
  { name: "loadProgress", req: false, type: "(userId?) => Promise<TutorProgress | null>", def: "—", desc: "Async-load saved progress from your DB." },
  { name: "onTranscript", req: false, type: "(t: TranscriptTurn) => void", def: "—", desc: "Persist each Q&A turn to your DB." },
  { name: "className", req: false, type: "string", def: "—", desc: "CSS class on the root element." },
];

const EXAMPLES: { title: string; code: string }[] = [
  {
    title: "Install",
    code: `npm install thepplbot`,
  },
  {
    title: "Quick start (local dev key)",
    code: `import { AITutor } from "thepplbot";

<div style={{ height: 640, maxWidth: 440 }}>
  <AITutor
    api={{ apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY }}
    orgName="My Org"
  />
</div>`,
  },
  {
    title: "Floating launcher (corner bubble)",
    code: `<AITutor
  api={{ apiEndpoint: "/api/tutor" }}
  position="bottom-right"   // bottom-left | top-right | top-left
/>`,
  },
  {
    title: "Dark mode (match your app)",
    code: `<AITutor api={{ apiEndpoint: "/api/tutor" }} theme="dark" />   // or "light"
<AITutor api={{ apiEndpoint: "/api/tutor" }} theme="auto" />   // follow the OS, live

// Driving it from your own theme toggle:
<AITutor api={{ apiEndpoint: "/api/tutor" }} theme={appIsDark ? "dark" : "light"} />`,
  },
  {
    title: "Custom launcher icon",
    code: `// Floating bubble icon — image URL, emoji, or any React node.
<AITutor api={{ apiEndpoint: "/api/tutor" }} position="bottom-right" launcherIcon="/bot.png" />
<AITutor api={{ apiEndpoint: "/api/tutor" }} position="bottom-right" launcherIcon="🤖" />
<AITutor api={{ apiEndpoint: "/api/tutor" }} position="bottom-right" launcherIcon={<MyIcon />} />`,
  },
  {
    title: "Your own curriculum",
    code: `import type { Curriculum } from "thepplbot";

const MY_CURRICULUM: Curriculum = {
  week_01: { label: "Variables", content: "Overview: ..." },
  week_02: { label: "Loops",     content: "Overview: ..." },
};

<AITutor api={{ apiEndpoint: "/api/tutor" }} curriculum={MY_CURRICULUM} />`,
  },
  {
    title: "Signed-in user + saved progress",
    code: `<AITutor
  api={{ apiEndpoint: "/api/tutor" }}
  user={{ id: u.id, name: u.fullName, gameName: u.handle }}
  initialProgress={saved}
  onProgressChange={(p) => saveProgress(u.id, p)}
/>`,
  },
  {
    title: "Plug in your database",
    code: `// Load curriculum + progress from your DB; save progress + transcripts back.
// Wrap loaders in useCallback so their identity is stable. See
// CUSTOMIZATION.md → Connecting your database.
<AITutor
  api={{ apiEndpoint: "/api/tutor" }}
  user={{ id: u.id }}
  loadCurriculum={loadCurriculum}          // () => Promise<Curriculum>
  loadProgress={loadProgress}              // (userId?) => Promise<TutorProgress | null>
  onProgressChange={(p) => saveProgress(u.id, p)}
  onTranscript={(t) => saveTranscript(t)}  // fire-and-forget per Q&A turn
/>`,
  },
];

function Code({ code }: { code: string }) {
  return (
    <pre
      style={{
        margin: "8px 0 0",
        padding: "14px 16px",
        background: "var(--doc-code-bg)",
        color: "#E7E7EA",
        borderRadius: 12,
        overflowX: "auto",
        fontFamily: MONO,
        fontSize: 12.5,
        lineHeight: 1.55,
      }}
    >
      <code>{code}</code>
    </pre>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: CARD,
        borderRadius: 18,
        padding: 20,
        border: `1px solid ${BORDER}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.05)",
      }}
    >
      {children}
    </div>
  );
}

function DevApp() {
  const [courseId, setCourseId] = useState<CourseId>("firme");
  const course = COURSES[courseId];

  // ── Appearance controls (theme + launcher icon) ───────────────────────────
  // The theme control drives BOTH the widget and this demo page, so toggling to
  // dark visibly recolors the whole homepage (not just the widget panel).
  const [theme, setTheme] = useState<Theme>("light");
  const [systemDark, setSystemDark] = useState(false);
  React.useEffect(() => {
    if (theme !== "auto" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);
  const pageDark = theme === "dark" || (theme === "auto" && systemDark);
  const BOT_ICONS: { id: string; label: string; value: string | undefined }[] = [
    { id: "default", label: "Default chat glyph", value: undefined },
    { id: "robot", label: "🤖 Robot", value: "🤖" },
    { id: "grad", label: "🎓 Graduate", value: "🎓" },
    { id: "sparkles", label: "✨ Sparkles", value: "✨" },
  ];
  const [botIconId, setBotIconId] = useState<string>("default");
  const launcherIcon = BOT_ICONS.find((b) => b.id === botIconId)?.value;

  // ── DB-mode demo: drive the widget from the fake database above ───────────
  const [dbMode, setDbMode] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [savedProgress, setSavedProgress] = useState<TutorProgress | null>(null);

  // Loaders are wrapped in useCallback so their identity is stable — a new
  // function each render would re-trigger the fetch on every render.
  const loadCurriculum = useCallback(() => fakeDb.fetchCurriculum(courseId), [courseId]);
  const loadProgress = useCallback((userId: string | undefined) => fakeDb.fetchProgress(userId), []);
  const onProgressChange = useCallback((p: TutorProgress) => {
    fakeDb.saveProgress(DEMO_USER.id, p);
    setSavedProgress(p);
  }, []);
  const onTranscript = useCallback((t: TranscriptTurn) => {
    setTranscript((prev) => [t, ...prev].slice(0, 8)); // keep the last 8 turns
  }, []);

  return (
    <div
      style={{
        ...(pageDark ? DOC_VARS.dark : DOC_VARS.light),
        minHeight: "100%",
        padding: "32px 20px 80px",
        fontFamily: FONT,
        color: "var(--doc-ink)",
        background: "var(--doc-bg)",
        transition: "background .25s, color .25s",
      } as React.CSSProperties}
    >
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <h1 style={{ fontSize: 32, letterSpacing: "-0.03em", margin: 0 }}>thepplbot</h1>
          <p style={{ color: INK2, fontSize: 15, marginTop: 6 }}>
            Live playground. The tutor is docked bottom-right — tap the bubble to open it.
          </p>
          {!apiKey && (
            <p style={{ color: BLUE, fontSize: 13, marginTop: 4 }}>
              No <code>VITE_ANTHROPIC_API_KEY</code> set — using the <strong>mock</strong> endpoint.
              Add a key to <code>.env.local</code> and restart for real Claude replies.
            </p>
          )}
        </div>

        <Card>
          <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
            Try a course
          </label>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value as CourseId)}
            style={{
              fontFamily: FONT,
              fontSize: 15,
              padding: "8px 12px",
              borderRadius: 10,
              border: `1px solid ${BORDER}`,
              background: CARD,
            }}
          >
            {Object.entries(COURSES).map(([id, c]) => (
              <option key={id} value={id}>
                {c.label}
              </option>
            ))}
          </select>
          <p style={{ color: INK2, fontSize: 13, marginTop: 10, marginBottom: 0 }}>
            Switching courses remounts the widget with that curriculum (via a changing{" "}
            <code>key</code>).
          </p>
        </Card>

        {/* Appearance: theme + launcher icon */}
        <Card>
          <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
            Appearance
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 12, color: INK2, marginBottom: 4 }}>
                <code>theme</code>
              </div>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as Theme)}
                style={{
                  fontFamily: FONT,
                  fontSize: 15,
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: `1px solid ${BORDER}`,
                  background: CARD,
                }}
              >
                <option value="light">light</option>
                <option value="dark">dark</option>
                <option value="auto">auto (follow OS)</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: INK2, marginBottom: 4 }}>
                <code>launcherIcon</code>
              </div>
              <select
                value={botIconId}
                onChange={(e) => setBotIconId(e.target.value)}
                style={{
                  fontFamily: FONT,
                  fontSize: 15,
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: `1px solid ${BORDER}`,
                  background: CARD,
                }}
              >
                {BOT_ICONS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p style={{ color: INK2, fontSize: 13, marginTop: 12, marginBottom: 0 }}>
            <code>theme</code> recolors the chrome (background, text, surfaces) while keeping your
            brand accent. <code>launcherIcon</code> also accepts an image URL or any React node —
            here we demo emoji.
          </p>
        </Card>

        {/* DB-mode demo */}
        <Card>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={dbMode} onChange={(e) => setDbMode(e.target.checked)} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Database mode</span>
          </label>
          <p style={{ color: INK2, fontSize: 13, marginTop: 8, marginBottom: 0 }}>
            Wires <code>loadCurriculum</code>, <code>loadProgress</code>,{" "}
            <code>onProgressChange</code>, and <code>onTranscript</code> to a fake localStorage
            "database" (curriculum load is delayed ~1s so you can see the loading state). Progress
            persists across reloads; each Q&amp;A turn is captured below.
          </p>

          {dbMode && (
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13 }}>
                <strong>Saved progress:</strong>{" "}
                {savedProgress ? (
                  <code style={{ fontFamily: MONO, fontSize: 12 }}>
                    {savedProgress.typingXp} XP · {Object.keys(savedProgress.counts).length} module(s)
                  </code>
                ) : (
                  <span style={{ color: INK2 }}>none yet — ask a question or run the typing drill</span>
                )}
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Captured transcript ({transcript.length})
                </div>
                {transcript.length === 0 ? (
                  <p style={{ color: INK2, fontSize: 13, margin: 0 }}>
                    Ask the tutor something — each completed turn lands here via{" "}
                    <code>onTranscript</code>.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {transcript.map((t, i) => (
                      <div
                        key={i}
                        style={{
                          fontSize: 12.5,
                          lineHeight: 1.5,
                          padding: "8px 10px",
                          borderRadius: 10,
                          background: "var(--doc-subtle)",
                        }}
                      >
                        <div style={{ color: INK2, fontFamily: MONO, fontSize: 11 }}>
                          {t.module} · {t.modality}
                        </div>
                        <div style={{ marginTop: 3 }}>
                          <strong>Q:</strong> {t.question}
                        </div>
                        <div style={{ marginTop: 2, color: INK2 }}>
                          <strong style={{ color: INK }}>A:</strong>{" "}
                          {t.reply.length > 160 ? `${t.reply.slice(0, 160)}…` : t.reply}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Props reference */}
        <Card>
          <h2 style={{ fontSize: 20, letterSpacing: "-0.02em", marginTop: 0 }}>Props</h2>
          <p style={{ color: INK2, fontSize: 13, marginTop: 0 }}>
            Only <code>api</code> is required. Everything else is optional.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: INK2 }}>
                  <th style={{ padding: "6px 8px" }}>Prop</th>
                  <th style={{ padding: "6px 8px" }}>Req</th>
                  <th style={{ padding: "6px 8px" }}>Type</th>
                  <th style={{ padding: "6px 8px" }}>Default</th>
                  <th style={{ padding: "6px 8px" }}>What it does</th>
                </tr>
              </thead>
              <tbody>
                {PROPS.map((p) => (
                  <tr key={p.name} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td style={{ padding: "7px 8px", fontFamily: MONO, color: BLUE, whiteSpace: "nowrap" }}>
                      {p.name}
                    </td>
                    <td style={{ padding: "7px 8px", color: p.req ? "#FF3B30" : INK2, fontWeight: p.req ? 700 : 400 }}>
                      {p.req ? "yes" : "no"}
                    </td>
                    <td style={{ padding: "7px 8px", fontFamily: MONO, fontSize: 12, color: INK }}>{p.type}</td>
                    <td style={{ padding: "7px 8px", fontFamily: MONO, fontSize: 12, color: INK2 }}>{p.def}</td>
                    <td style={{ padding: "7px 8px", color: INK }}>{p.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Examples */}
        <Card>
          <h2 style={{ fontSize: 20, letterSpacing: "-0.02em", marginTop: 0 }}>Examples</h2>
          {EXAMPLES.map((ex) => (
            <div key={ex.title} style={{ marginTop: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{ex.title}</div>
              <Code code={ex.code} />
            </div>
          ))}
          <p style={{ color: INK2, fontSize: 13, marginTop: 16, marginBottom: 0 }}>
            Full reference: <code>README.md</code> · Tutorial: <code>GETTING_STARTED.md</code> ·
            Theming &amp; curriculum: <code>CUSTOMIZATION.md</code>
          </p>
        </Card>
      </div>

      {/* The live widget */}
      <AITutor
        key={`${courseId}-${dbMode ? "db" : "static"}`}
        api={api}
        orgName={course.label}
        primaryColor={course.color}
        theme={theme}
        launcherIcon={launcherIcon}
        position="bottom-right"
        // Static mode: pass the curriculum directly.
        curriculum={course.curriculum}
        // DB mode: load everything through the fake database and save back.
        {...(dbMode
          ? {
              user: DEMO_USER,
              loadCurriculum,
              loadProgress,
              onProgressChange,
              onTranscript,
            }
          : {})}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DevApp />
  </React.StrictMode>
);
