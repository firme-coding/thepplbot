import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import type { ChatMessage, AITutorProps, Modality, Curriculum } from "../types";
import { DEMO_CURRICULUM } from "../curriculum";

// Stable empty reference so the loading-state fallback doesn't churn identity.
const EMPTY_CURRICULUM: Curriculum = {};
import { sendMessage } from "../lib/claude";
import { Markdown } from "../lib/markdown";
import { speak, stopSpeaking, speechSupported } from "../lib/speech";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

// iOS system font stack — the point of the design is that it feels native.
const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif';

// ── Theme tokens ─────────────────────────────────────────────────────────────
// Every neutral color the chrome uses lives here so light/dark is a single swap.
// Brand accents (primaryColor/secondaryColor) are passed in separately and apply
// unchanged in both themes.
export interface Tokens {
  ink: string; // primary text
  ink2: string; // secondary text
  ink3: string; // faint text (chevrons, untyped chars)
  sep: string; // hairline separators
  fill: string; // subtle button/pill fill
  fill2: string; // stronger fill (disabled send, handles)
  groupBg: string; // grouped background (progress view, sheets)
  panelBg: string; // main panel + chat/toolbar/input surfaces
  surface: string; // raised cards, bubbles-in, inputs
  navBg: string; // frosted bars (nav + input bar)
  bubble: string; // assistant message bubble
  segActive: string; // active segmented / modality control
  dot: string; // typing-indicator dots
  border: string; // panel outer border
}

function makeTokens(dark: boolean): Tokens {
  return dark
    ? {
        ink: "#F5F5F7",
        ink2: "rgba(235,235,245,0.6)",
        ink3: "rgba(235,235,245,0.3)",
        sep: "rgba(235,235,245,0.14)",
        fill: "rgba(118,118,128,0.24)",
        fill2: "rgba(118,118,128,0.36)",
        groupBg: "#000000",
        panelBg: "#1C1C1E",
        surface: "#2C2C2E",
        navBg: "rgba(30,30,32,0.8)",
        bubble: "#3A3A3C",
        segActive: "#636366",
        dot: "rgba(235,235,245,0.45)",
        border: "rgba(255,255,255,0.1)",
      }
    : {
        ink: "#1C1C1E",
        ink2: "rgba(60,60,67,0.6)",
        ink3: "rgba(60,60,67,0.3)",
        sep: "rgba(60,60,67,0.14)",
        fill: "rgba(118,118,128,0.12)",
        fill2: "rgba(118,118,128,0.2)",
        groupBg: "#F2F2F7",
        panelBg: "#ffffff",
        surface: "#ffffff",
        navBg: "rgba(255,255,255,0.72)",
        bubble: "#E9E9EB",
        segActive: "#ffffff",
        dot: "rgba(60,60,67,0.45)",
        border: "rgba(0,0,0,0.08)",
      };
}

// Render a caller-supplied launcher icon: an image URL/path → <img>, an emoji or
// short string → text, any other React node → as-is.
function renderLauncherIcon(icon: ReactNode): ReactNode {
  if (typeof icon === "string") {
    const looksLikeUrl = /^(https?:|data:|blob:|\/|\.\.?\/)/.test(icon);
    if (looksLikeUrl)
      return (
        <img
          src={icon}
          alt=""
          style={{ width: 30, height: 30, objectFit: "contain", borderRadius: 8 }}
        />
      );
    return <span style={{ fontSize: 26, lineHeight: 1 }}>{icon}</span>;
  }
  return icon;
}

const MASTERY_THRESHOLD = 3; // questions in a module before it counts as "mastered"
const XP_PER_QUESTION = 10;
const XP_PER_LEVEL = 100;

// ── Learning modalities ──────────────────────────────────────────────────────
const MODALITIES: { key: Modality; label: string; hint: string }[] = [
  {
    key: "reading",
    label: "Reading",
    hint: "Present ideas as clear, concise written explanations the learner can read.",
  },
  {
    key: "visual",
    label: "Visual",
    hint: "Describe concepts visually — spatial layouts, what things look like, diagrams in words.",
  },
  {
    key: "audio",
    label: "Audio",
    hint: "Explain as if narrating aloud — conversational and rhythmic, like an audio lesson.",
  },
  {
    key: "images",
    label: "Images",
    hint: "Suggest concrete images or scenes that illustrate the idea, and describe them vividly.",
  },
  {
    key: "hands-on",
    label: "Hands-on",
    hint: "Give a small hands-on exercise or activity the learner can try right now.",
  },
];

const DEFAULT_SYSTEM = (orgName: string, moduleContent: string) =>
  `
You are the AI assistant for ${orgName}. Your role is to guide the person through the material below — not to go beyond it, and not to give answers away directly. Ask questions, give hints, and encourage them to think it through.

Keep your tone warm, direct, and encouraging. No jargon. No lecturing. One idea at a time.

If a question is completely outside the material, say so honestly and redirect.

— CONTENT —
${moduleContent}
`.trim();

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

// ── One-time injected CSS (animations + platform niceties) ───────────────────
function injectStyles() {
  if (document.getElementById("ai-tutor-styles")) return;
  const style = document.createElement("style");
  style.id = "ai-tutor-styles";
  style.textContent = `
    @keyframes ai-tutor-bounce {
      0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
      40% { transform: translateY(-4px); opacity: 1; }
    }
    @keyframes ai-tutor-pop {
      from { opacity: 0; transform: translateY(8px) scale(0.98); }
      to   { opacity: 1; transform: none; }
    }
    @keyframes ai-tutor-sheet-up {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }
    @keyframes ai-tutor-fade { from { opacity: 0; } to { opacity: 1; } }
    .ai-tutor-tap { transition: transform .12s ease, background .18s ease, opacity .18s ease; }
    .ai-tutor-tap:active { transform: scale(0.94); }
    .ai-tutor-scroll::-webkit-scrollbar { width: 5px; }
    .ai-tutor-scroll::-webkit-scrollbar-thumb { background: rgba(60,60,67,0.2); border-radius: 5px; }
    .ai-tutor-scroll::-webkit-scrollbar-track { background: transparent; }
  `;
  document.head.appendChild(style);
}

// ── Icon set (SF-Symbol-ish line glyphs) ─────────────────────────────────────
function Glyph({
  k,
  size = 20,
  color = "currentColor",
  stroke = 2,
}: {
  k: string;
  size?: number;
  color?: string;
  stroke?: number;
}) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (k) {
    case "eye":
      return (
        <svg {...p}>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "audio":
      return (
        <svg {...p}>
          <path d="M11 5 6 9H2v6h4l5 4V5Z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 6a9 9 0 0 1 0 12" />
        </svg>
      );
    case "image":
      return (
        <svg {...p}>
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <circle cx="8.5" cy="8.5" r="1.6" />
          <path d="m21 15-4.5-4.5L6 21" />
        </svg>
      );
    case "hand":
      return (
        <svg {...p}>
          <path d="M18 11V6a2 2 0 0 0-4 0" />
          <path d="M14 10V4a2 2 0 0 0-4 0v2" />
          <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.3l-3.6-3.6a2 2 0 0 1 2.9-2.8L7 15" />
        </svg>
      );
    case "expand":
      return (
        <svg {...p}>
          <path d="M15 3h6v6" />
          <path d="M21 3l-8 8" />
          <path d="M9 21H3v-6" />
          <path d="M3 21l8-8" />
        </svg>
      );
    case "collapse":
      return (
        <svg {...p}>
          <path d="M20 10h-6V4" />
          <path d="M14 10l7-7" />
          <path d="M4 14h6v6" />
          <path d="M10 14l-7 7" />
        </svg>
      );
    case "close":
      return (
        <svg {...p}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      );
    case "chat":
      return (
        <svg {...p}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "speaker":
      return (
        <svg {...p}>
          <path d="M11 5 6 9H2v6h4l5 4V5Z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        </svg>
      );
    case "list":
      return (
        <svg {...p}>
          <path d="M8 6h13M8 12h13M8 18h13" />
          <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" strokeWidth={2.6} />
        </svg>
      );
    case "chevron":
      return (
        <svg {...p}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );
    case "check":
      return (
        <svg {...p}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    case "send":
      return (
        <svg {...p} strokeWidth={2.4}>
          <path d="M12 19V5" />
          <path d="M5 12l7-7 7 7" />
        </svg>
      );
    default:
      return null;
  }
}

// A modality button either shows an SVG glyph or the "Aa" reading mark.
function modalityGlyph(key: Modality, color: string) {
  if (key === "reading")
    return (
      <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em", color }}>
        Aa
      </span>
    );
  const map: Record<Exclude<Modality, "reading">, string> = {
    visual: "eye",
    audio: "audio",
    images: "image",
    "hands-on": "hand",
  };
  return <Glyph k={map[key as Exclude<Modality, "reading">]} size={18} color={color} />;
}

// ── Progress persistence (localStorage) ──────────────────────────────────────
type Counts = Record<string, number>;

function loadCounts(key: string): Counts {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Counts) : {};
  } catch {
    return {};
  }
}

function loadNumber(key: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

// Pull short, typeable drill lines (key terms + a couple of overview sentences)
// straight from the module content, so typing practice tracks the curriculum.
function drillLines(content: string): string[] {
  const bullets = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("-"))
    .map((l) => l.replace(/^-\s*/, "").replace(/\s+/g, " ").trim())
    .filter((l) => l.length >= 6 && l.length <= 64);
  const ov = (content.match(/Overview:\s*([\s\S]*?)(?:\n\s*\n|$)/i)?.[1] ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = ov
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 14 && s.length <= 90);
  const lines = [...sentences.slice(0, 2), ...bullets].slice(0, 8);
  return lines.length ? lines : ["Practice makes progress."];
}

/**
 * AITutor — embeddable AI tutor widget with an iOS-native feel.
 *
 * Segmented Chat / Progress views, per-module learning modalities
 * (reading · visual · audio · images · hands-on), and built-in gamification
 * (XP, levels, module mastery, badges).
 *
 * ```tsx
 * <AITutor api={{ apiKey: "sk-ant-..." }} orgName="My Org" onClose={() => …} />
 * ```
 */
export function AITutor({
  api,
  curriculum = DEMO_CURRICULUM,
  orgName = "AI Tutor",
  logoUrl,
  primaryColor = "#007AFF",
  secondaryColor = "#5856D6",
  theme = "light",
  model = DEFAULT_MODEL,
  systemPrompt,
  placeholder = "Ask a question…",
  className,
  onClose,
  defaultModality = "reading",
  position,
  launcherIcon,
  user,
  initialProgress,
  onProgressChange,
  loadCurriculum,
  loadProgress,
  onTranscript,
}: AITutorProps) {
  const [launcherOpen, setLauncherOpen] = useState(false);

  // ── Curriculum source: static prop, or async-loaded from the host's DB ──────
  const [remoteCurriculum, setRemoteCurriculum] = useState<Curriculum | null>(null);
  const [curriculumLoading, setCurriculumLoading] = useState<boolean>(!!loadCurriculum);
  const [curriculumError, setCurriculumError] = useState<string | null>(null);

  // While a loader is still fetching, show nothing (loading state) rather than
  // flashing the static fallback. On success use the remote data; on failure
  // fall back to the `curriculum` prop (which defaults to the demo).
  const activeCurriculum: Curriculum =
    remoteCurriculum ?? (loadCurriculum && curriculumLoading ? EMPTY_CURRICULUM : curriculum);

  const moduleKeys = useMemo(() => Object.keys(activeCurriculum), [activeCurriculum]);
  const [selectedKey, setSelectedKey] = useState(moduleKeys[0] ?? "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"chat" | "typing" | "progress">("chat");
  const [modality, setModality] = useState<Modality>(defaultModality);
  const [showModules, setShowModules] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Progress: host-controlled (persisted in your backend) when onProgressChange
  // is provided, otherwise cached in localStorage keyed by userId (or orgName).
  const controlled = typeof onProgressChange === "function";
  const progressId = user?.id ?? orgName;
  const storageKey = `ai-tutor:progress:${progressId}`;
  const typingKey = `ai-tutor:typingxp:${progressId}`;
  const [counts, setCounts] = useState<Counts>(() =>
    controlled ? initialProgress?.counts ?? {} : loadCounts(storageKey),
  );
  const [typingXp, setTypingXp] = useState<number>(() =>
    controlled ? initialProgress?.typingXp ?? 0 : loadNumber(typingKey),
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const didMountProgress = useRef(false);
  // Set when we seed state from an async source (loadProgress) so the persist
  // effect skips that one change and doesn't write the loaded value back out.
  const skipNextPersist = useRef(false);

  useEffect(() => injectStyles(), []);

  // ── Theme: resolve light/dark, following the OS when theme="auto" ────────────
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    if (theme !== "auto" || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [theme]);
  const isDark = theme === "dark" || (theme === "auto" && systemDark);

  // ── Load curriculum from the host's backend/DB when a loader is provided ────
  useEffect(() => {
    if (!loadCurriculum) return;
    let cancelled = false;
    setCurriculumLoading(true);
    setCurriculumError(null);
    loadCurriculum()
      .then((c) => {
        if (!cancelled) setRemoteCurriculum(c);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setCurriculumError(err instanceof Error ? err.message : "Failed to load curriculum.");
      })
      .finally(() => {
        if (!cancelled) setCurriculumLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadCurriculum]);

  // Keep the selected module valid as the curriculum arrives or changes.
  useEffect(() => {
    if (moduleKeys.length === 0) return;
    if (!selectedKey || !activeCurriculum[selectedKey]) setSelectedKey(moduleKeys[0]);
  }, [moduleKeys, selectedKey, activeCurriculum]);

  // ── Load saved progress from the host's backend/DB when a loader is provided ─
  useEffect(() => {
    if (!loadProgress) return;
    let cancelled = false;
    Promise.resolve(loadProgress(user?.id))
      .then((p) => {
        if (cancelled || !p) return;
        skipNextPersist.current = true;
        setCounts(p.counts ?? {});
        setTypingXp(p.typingXp ?? 0);
      })
      .catch(() => {
        /* load failed — keep whatever defaults we seeded with */
      });
    return () => {
      cancelled = true;
    };
  }, [loadProgress, user?.id]);

  // Persist progress — emit to the host, or fall back to localStorage.
  useEffect(() => {
    if (!didMountProgress.current) {
      didMountProgress.current = true;
      return; // don't echo the seeded value back on mount
    }
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return; // this change came from loadProgress, not the learner
    }
    if (controlled) {
      onProgressChange?.({ counts, typingXp });
      return;
    }
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(counts));
      window.localStorage.setItem(typingKey, String(typingXp));
    } catch {
      /* storage unavailable — ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts, typingXp]);

  // Reset chat when the module changes
  useEffect(() => {
    setMessages([]);
    setError(null);
    stopSpeaking();
  }, [selectedKey]);

  // Stop any speech when the widget unmounts
  useEffect(() => () => stopSpeaking(), []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const activeModule = activeCurriculum[selectedKey];
  const activeModality = MODALITIES.find((m) => m.key === modality)!;

  const resolvedSystemPrompt =
    (systemPrompt ?? DEFAULT_SYSTEM(orgName, activeModule?.content ?? "")) +
    (user?.name ? `\n\nThe learner's name is ${user.name}. Address them warmly by name when it feels natural.` : "") +
    `\n\nPREFERRED EXPLANATION STYLE — ${activeModality.label}: ${activeModality.hint}`;

  // ── Gamification derived values ────────────────────────────────────────────
  const totalQuestions = Object.values(counts).reduce((a, b) => a + b, 0);
  const masteredKeys = moduleKeys.filter((k) => (counts[k] ?? 0) >= MASTERY_THRESHOLD);
  const visitedKeys = moduleKeys.filter((k) => (counts[k] ?? 0) > 0);
  const xp = totalQuestions * XP_PER_QUESTION + typingXp;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = xp % XP_PER_LEVEL;
  const levelPct = xpIntoLevel / XP_PER_LEVEL;

  const submit = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: text, id: generateId() };
    const next = [...messages, userMessage];
    setMessages(next);
    setInput("");
    setError(null);
    setIsLoading(true);
    setCounts((prev) => ({ ...prev, [selectedKey]: (prev[selectedKey] ?? 0) + 1 }));

    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const reply = await sendMessage({
        api,
        model,
        systemPrompt: resolvedSystemPrompt,
        messages: next,
        module: selectedKey,
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply, id: generateId() },
      ]);
      if (modality === "audio") speak(reply); // read it aloud in audio mode
      // Hand the completed turn to the host to persist (fire-and-forget).
      if (onTranscript) {
        try {
          onTranscript({ module: selectedKey, question: text, reply, modality, userId: user?.id });
        } catch {
          /* host persistence failing must never break the chat */
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }, [api, input, isLoading, messages, model, modality, resolvedSystemPrompt, selectedKey, onTranscript, user?.id]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 110)}px`;
  };

  // ── Design tokens ──────────────────────────────────────────────────────────
  const t = useMemo(() => makeTokens(isDark), [isDark]);
  const { ink, ink2, sep, fill, fill2, groupBg } = t;
  const tint = (c: string, a: string) => `${c}${a}`;

  // When a curriculum loader is running (or failed) and we have no modules yet,
  // the chat/typing/progress body is replaced by a loading or error state.
  const showCurriculumLoading = !!loadCurriculum && curriculumLoading && moduleKeys.length === 0;
  const showCurriculumError = !!curriculumError && moduleKeys.length === 0;
  const curriculumBlocked = showCurriculumLoading || showCurriculumError;

  // In floating mode the ✕ always shows and collapses back to the launcher.
  const showClose = position ? true : typeof onClose === "function";
  const closeAction = () => {
    if (position) setLauncherOpen(false);
    onClose?.();
  };

  // ── Small building blocks ──────────────────────────────────────────────────
  const navButton = (kind: "expand" | "collapse" | "close", onClick: () => void, label: string) => (
    <button
      className="ai-tutor-tap"
      onClick={onClick}
      aria-label={label}
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        border: "none",
        background: fill,
        color: ink,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      <Glyph k={kind} size={16} color={ink} stroke={2.2} />
    </button>
  );

  const segmented = (
    <div
      style={{
        display: "flex",
        background: fill,
        borderRadius: 9,
        padding: 2,
        gap: 2,
      }}
    >
      {(["chat", "typing", "progress"] as const).map((v) => {
        const active = view === v;
        return (
          <button
            key={v}
            onClick={() => setView(v)}
            className="ai-tutor-tap"
            style={{
              flex: 1,
              border: "none",
              cursor: "pointer",
              padding: "6px 18px",
              borderRadius: 7,
              fontFamily: FONT,
              fontSize: 13,
              fontWeight: 600,
              color: active ? ink : ink2,
              background: active ? t.segActive : "transparent",
              boxShadow: active ? "0 1px 3px rgba(0,0,0,0.14)" : "none",
              textTransform: "capitalize",
            }}
          >
            {v}
          </button>
        );
      })}
    </div>
  );

  const panel = (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: expanded ? "none" : view === "typing" ? 760 : 460,
        margin: "0 auto",
        height: "100%",
        minHeight: expanded ? 0 : view === "typing" ? 560 : 540,
        maxHeight: expanded ? "none" : view === "typing" ? 900 : 760,
        borderRadius: 26,
        overflow: "hidden",
        position: "relative",
        boxShadow:
          "0 20px 50px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.10)",
        fontFamily: FONT,
        background: view === "progress" ? groupBg : t.panelBg,
        border: `0.5px solid ${t.border}`,
        transition: "max-width .32s cubic-bezier(.22,1,.36,1), max-height .32s cubic-bezier(.22,1,.36,1), background .25s",
      }}
    >
      {/* ── Frosted nav bar ── */}
      <div
        style={{
          padding: "12px 14px 10px",
          background: t.navBg,
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          borderBottom: `0.5px solid ${sep}`,
          position: "relative",
          zIndex: 3,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${orgName} logo`}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  objectFit: "cover",
                  flexShrink: 0,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.14)",
                }}
              />
            ) : (
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: `0 2px 8px ${tint(primaryColor, "44")}`,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>
                  {orgName.trim().charAt(0).toUpperCase() || "A"}
                </span>
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: ink,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {orgName}
              </div>
              <div style={{ fontSize: 12, color: ink2, marginTop: 1 }}>
                {user?.gameName ? `${user.gameName} · ` : ""}Lv {level} · {xp} XP
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {navButton(expanded ? "collapse" : "expand", () => setExpanded((e) => !e), "Toggle size")}
            {showClose && navButton("close", closeAction, "Close")}
          </div>
        </div>
        {segmented}
      </div>

      {/* ── Curriculum loading / error state (async loader) ── */}
      {curriculumBlocked && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            padding: "40px 28px",
            background: t.panelBg,
            textAlign: "center",
          }}
        >
          {showCurriculumError ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, color: ink }}>
                Couldn't load the curriculum
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: ink2 }}>{curriculumError}</div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", gap: 5 }}>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: primaryColor,
                      animation: "ai-tutor-bounce 1.2s ease-in-out infinite",
                      animationDelay: `${i * 0.18}s`,
                    }}
                  />
                ))}
              </div>
              <div style={{ fontSize: 14, color: ink2 }}>Loading curriculum…</div>
            </>
          )}
        </div>
      )}

      {/* ── Toolbar: Modules + modality picker ── */}
      {!curriculumBlocked && view !== "progress" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "10px 14px",
            borderBottom: `0.5px solid ${sep}`,
            background: t.panelBg,
          }}
        >
          <button
            className="ai-tutor-tap"
            onClick={() => setShowModules(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              border: "none",
              cursor: "pointer",
              background: fill,
              color: primaryColor,
              padding: "7px 12px",
              borderRadius: 10,
              fontFamily: FONT,
              fontSize: 13.5,
              fontWeight: 600,
              maxWidth: "52%",
            }}
          >
            <Glyph k="list" size={16} color={primaryColor} />
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {activeModule?.label ?? "Modules"}
            </span>
          </button>

          {view === "chat" && (
            <div style={{ display: "flex", background: fill, borderRadius: 10, padding: 2 }}>
              {MODALITIES.map((m) => {
                const active = modality === m.key;
                return (
                  <button
                    key={m.key}
                    className="ai-tutor-tap"
                    onClick={() => setModality(m.key)}
                    aria-label={m.label}
                    title={m.label}
                    style={{
                      width: 34,
                      height: 30,
                      border: "none",
                      cursor: "pointer",
                      borderRadius: 8,
                      background: active ? t.segActive : "transparent",
                      boxShadow: active ? "0 1px 3px rgba(0,0,0,0.16)" : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {modalityGlyph(m.key, active ? primaryColor : ink2)}
                  </button>
                );
              })}
            </div>
          )}
          {view === "typing" && (
            <span style={{ fontSize: 12.5, fontWeight: 600, color: ink2 }}>⌨️ Typing practice</span>
          )}
        </div>
      )}

      {/* ── CHAT VIEW ── */}
      {!curriculumBlocked && view === "chat" && (
        <>
          <div
            className="ai-tutor-scroll"
            style={{ flex: 1, overflowY: "auto", padding: "16px 0", background: t.panelBg }}
          >
            {messages.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "44px 28px",
                  color: ink2,
                  animation: "ai-tutor-fade .4s ease",
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 18,
                    margin: "0 auto 14px",
                    background: tint(primaryColor, "14"),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Glyph k="eye" size={26} color={primaryColor} stroke={1.8} />
                </div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: ink }}>
                  Ask your first question below.
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.5 }}>
                  Learning <strong style={{ color: ink }}>{activeModule?.label}</strong> in{" "}
                  <strong style={{ color: primaryColor }}>{activeModality.label}</strong> style.
                </p>
              </div>
            )}

            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isUser ? "flex-end" : "flex-start",
                    padding: "0 14px",
                    marginBottom: 8,
                    animation: "ai-tutor-pop .28s cubic-bezier(.22,1,.36,1)",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "82%",
                      padding: "9px 14px",
                      fontSize: 15.5,
                      lineHeight: 1.42,
                      whiteSpace: isUser ? "pre-wrap" : "normal",
                      wordBreak: "break-word",
                      color: isUser ? "#fff" : ink,
                      background: isUser ? primaryColor : t.bubble,
                      borderRadius: 20,
                      borderBottomRightRadius: isUser ? 6 : 20,
                      borderBottomLeftRadius: isUser ? 20 : 6,
                    }}
                  >
                    {isUser ? msg.content : <Markdown text={msg.content} accent={primaryColor} />}
                  </div>
                  {!isUser && speechSupported() && (
                    <button
                      className="ai-tutor-tap"
                      onClick={() => speak(msg.content)}
                      aria-label="Read aloud"
                      title="Read aloud"
                      style={{
                        marginTop: 3,
                        marginLeft: 4,
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        color: ink2,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11,
                        fontFamily: FONT,
                        padding: "2px 4px",
                      }}
                    >
                      <Glyph k="speaker" size={13} color={ink2} stroke={2} />
                      Listen
                    </button>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div style={{ display: "flex", padding: "0 14px", marginBottom: 8 }}>
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: 20,
                    borderBottomLeftRadius: 6,
                    background: t.bubble,
                    display: "flex",
                    gap: 4,
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: t.dot,
                        animation: "ai-tutor-bounce 1.2s ease-in-out infinite",
                        animationDelay: `${i * 0.18}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div
                style={{
                  margin: "8px 14px",
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: "rgba(255,59,48,0.10)",
                  color: "#FF3B30",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div
            style={{
              padding: "10px 12px calc(10px + env(safe-area-inset-bottom))",
              borderTop: `0.5px solid ${sep}`,
              background: t.navBg,
              backdropFilter: "saturate(180%) blur(20px)",
              WebkitBackdropFilter: "saturate(180%) blur(20px)",
              display: "flex",
              gap: 9,
              alignItems: "flex-end",
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={autoResize}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              disabled={isLoading}
              style={{
                flex: 1,
                resize: "none",
                border: `0.5px solid ${fill2}`,
                borderRadius: 20,
                padding: "9px 15px",
                fontSize: 16,
                fontFamily: FONT,
                lineHeight: 1.4,
                outline: "none",
                background: t.surface,
                color: ink,
                overflow: "hidden",
                transition: "border-color .15s, box-shadow .15s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = primaryColor;
                e.currentTarget.style.boxShadow = `0 0 0 3.5px ${tint(primaryColor, "1f")}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = fill2;
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <button
              className="ai-tutor-tap"
              onClick={() => void submit()}
              disabled={isLoading || !input.trim()}
              aria-label="Send"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                border: "none",
                cursor: input.trim() ? "pointer" : "default",
                background: input.trim() ? primaryColor : fill2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Glyph k="send" size={19} color="#fff" />
            </button>
          </div>
        </>
      )}

      {/* ── TYPING VIEW (gamified drill) ── */}
      {!curriculumBlocked && view === "typing" && (
        <TypingView
          key={selectedKey}
          content={activeModule?.content ?? ""}
          moduleLabel={activeModule?.label ?? ""}
          primary={primaryColor}
          secondary={secondaryColor}
          t={t}
          dark={isDark}
          expanded={expanded}
          onAward={(amt) => setTypingXp((x) => x + amt)}
        />
      )}

      {/* ── PROGRESS VIEW (gamification) ── */}
      {!curriculumBlocked && view === "progress" && (
        <div
          className="ai-tutor-scroll"
          style={{ flex: 1, overflowY: "auto", padding: "18px 16px 24px", background: groupBg }}
        >
          {/* Greeting */}
          {user?.gameName && (
            <div style={{ textAlign: "center", marginBottom: 8, fontSize: 20, fontWeight: 700, color: ink, letterSpacing: "-0.02em" }}>
              {user.gameName}
            </div>
          )}

          {/* Level ring */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
            <LevelRing pct={levelPct} level={level} primary={primaryColor} secondary={secondaryColor} t={t} />
            <div style={{ marginTop: 10, fontSize: 13, color: ink2 }}>
              {xpIntoLevel} / {XP_PER_LEVEL} XP to Level {level + 1}
            </div>
          </div>

          {/* Stat chips */}
          <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
            <StatChip value={String(totalQuestions)} label="Questions" emoji="💬" t={t} />
            <StatChip value={`${masteredKeys.length}/${moduleKeys.length}`} label="Mastered" emoji="🏆" t={t} />
            <StatChip value={String(visitedKeys.length)} label="Explored" emoji="🧭" t={t} />
          </div>

          {/* Module progress list */}
          <SectionLabel text="Modules" ink2={ink2} />
          <div style={{ background: t.surface, borderRadius: 14, overflow: "hidden", marginBottom: 22 }}>
            {moduleKeys.map((k, i) => {
              const c = counts[k] ?? 0;
              const mastered = c >= MASTERY_THRESHOLD;
              const pct = Math.min(c / MASTERY_THRESHOLD, 1);
              return (
                <button
                  key={k}
                  className="ai-tutor-tap"
                  onClick={() => {
                    setSelectedKey(k);
                    setView("chat");
                  }}
                  style={{
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    borderTop: i === 0 ? "none" : `0.5px solid ${sep}`,
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: mastered ? primaryColor : fill,
                    }}
                  >
                    {mastered ? (
                      <Glyph k="check" size={15} color="#fff" stroke={2.6} />
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 700, color: ink2 }}>{i + 1}</span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14.5,
                        fontWeight: 500,
                        color: ink,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {activeCurriculum[k].label}
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: fill, marginTop: 6, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${pct * 100}%`,
                          height: "100%",
                          borderRadius: 3,
                          background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
                          transition: "width .4s ease",
                        }}
                      />
                    </div>
                  </div>
                  <Glyph k="chevron" size={16} color={t.ink3} />
                </button>
              );
            })}
          </div>

          {/* Badges */}
          <SectionLabel text="Badges" ink2={ink2} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
            <Badge emoji="🎯" title="First Question" earned={totalQuestions >= 1} primary={primaryColor} t={t} />
            <Badge emoji="💡" title="Curious Mind" sub="Ask 5" earned={totalQuestions >= 5} primary={primaryColor} t={t} />
            <Badge
              emoji="🧭"
              title="Explorer"
              sub="Visit all"
              earned={visitedKeys.length === moduleKeys.length && moduleKeys.length > 0}
              primary={primaryColor}
              t={t}
            />
            <Badge
              emoji="🎓"
              title="Scholar"
              sub="Master all"
              earned={masteredKeys.length === moduleKeys.length && moduleKeys.length > 0}
              primary={primaryColor}
              t={t}
            />
            <Badge emoji="⌨️" title="Typist" sub="Type 3 terms" earned={typingXp >= 45} primary={primaryColor} t={t} />
          </div>
        </div>
      )}

      {/* ── Modules action sheet ── */}
      {showModules && (
        <>
          <div
            onClick={() => setShowModules(false)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.28)",
              zIndex: 8,
              animation: "ai-tutor-fade .2s ease",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              maxHeight: "76%",
              background: groupBg,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              zIndex: 9,
              display: "flex",
              flexDirection: "column",
              animation: "ai-tutor-sheet-up .34s cubic-bezier(.22,1,.36,1)",
              boxShadow: "0 -8px 30px rgba(0,0,0,0.18)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 4px" }}>
              <div style={{ width: 36, height: 5, borderRadius: 3, background: fill2 }} />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "4px 16px 10px",
              }}
            >
              <span style={{ fontSize: 17, fontWeight: 700, color: ink }}>Modules</span>
              <button
                className="ai-tutor-tap"
                onClick={() => setShowModules(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: primaryColor,
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: FONT,
                  cursor: "pointer",
                }}
              >
                Done
              </button>
            </div>
            <div className="ai-tutor-scroll" style={{ overflowY: "auto", padding: "0 12px 16px" }}>
              <div style={{ background: t.surface, borderRadius: 14, overflow: "hidden" }}>
                {moduleKeys.map((k, i) => {
                  const selected = k === selectedKey;
                  const mastered = (counts[k] ?? 0) >= MASTERY_THRESHOLD;
                  return (
                    <button
                      key={k}
                      className="ai-tutor-tap"
                      onClick={() => {
                        setSelectedKey(k);
                        setShowModules(false);
                        setView("chat");
                      }}
                      style={{
                        width: "100%",
                        border: "none",
                        background: selected ? tint(primaryColor, "12") : "transparent",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "13px 14px",
                        borderTop: i === 0 ? "none" : `0.5px solid ${sep}`,
                        textAlign: "left",
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          fontSize: 15,
                          fontWeight: selected ? 600 : 400,
                          color: ink,
                        }}
                      >
                        {activeCurriculum[k].label}
                      </span>
                      {mastered && <span style={{ fontSize: 14 }}>🏆</span>}
                      {selected && <Glyph k="check" size={18} color={primaryColor} stroke={2.4} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  // Inline mode — render the panel directly, filling the parent.
  if (!position) return panel;

  // Floating mode — a corner launcher that toggles the panel.
  const isBottom = position.startsWith("bottom");
  const isRight = position.endsWith("right");
  const fab = (
    <button
      className="ai-tutor-tap"
      onClick={() => setLauncherOpen((o) => !o)}
      aria-label={launcherOpen ? "Close chat" : "Open chat"}
      style={{
        width: 58,
        height: 58,
        borderRadius: 29,
        border: "none",
        cursor: "pointer",
        flexShrink: 0,
        background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
        boxShadow: `0 8px 24px ${primaryColor}55, 0 2px 6px rgba(0,0,0,0.18)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {launcherOpen ? (
        <Glyph k="close" size={26} color="#fff" stroke={2.2} />
      ) : launcherIcon != null && launcherIcon !== false ? (
        renderLauncherIcon(launcherIcon)
      ) : (
        <Glyph k="chat" size={26} color="#fff" stroke={2.2} />
      )}
    </button>
  );

  const panelWrap = launcherOpen ? (
    <div
      style={{
        width: expanded
          ? "min(80vw, calc(100vw - 40px))"
          : view === "typing"
          ? "min(760px, calc(100vw - 40px))"
          : "min(400px, calc(100vw - 40px))",
        height: expanded
          ? "min(90vh, calc(100vh - 40px))"
          : view === "typing"
          ? "min(720px, calc(100vh - 108px))"
          : "min(660px, calc(100vh - 108px))",
        animation: "ai-tutor-pop .26s cubic-bezier(.22,1,.36,1)",
        transition: "width .32s cubic-bezier(.22,1,.36,1), height .32s cubic-bezier(.22,1,.36,1)",
      }}
    >
      {panel}
    </div>
  ) : null;

  return (
    <div
      style={{
        position: "fixed",
        zIndex: 2147483000,
        [isBottom ? "bottom" : "top"]: 20,
        [isRight ? "right" : "left"]: 20,
        display: "flex",
        flexDirection: "column",
        alignItems: isRight ? "flex-end" : "flex-start",
        gap: 12,
        fontFamily: FONT,
      }}
    >
      {isBottom ? (
        <>
          {panelWrap}
          {fab}
        </>
      ) : (
        <>
          {fab}
          {panelWrap}
        </>
      )}
    </div>
  );
}

// ── Finger-guide keyboard ────────────────────────────────────────────────────
// Standard touch-typing finger assignments. Each finger has a pastel key tint,
// a stronger "solid" tone for the active key + legend, a readable label ink, and
// a short label shown under the home-row keys (A S D F J K L ;).
type FingerId = "lp" | "lr" | "lm" | "li" | "ri" | "rm" | "rr" | "rp" | "thumb";

const FINGERS: Record<
  FingerId,
  { hand: "Left" | "Right" | ""; name: string; short: string; pastel: string; solid: string; ink: string }
> = {
  lp: { hand: "Left", name: "Pinky", short: "pinky", pastel: "#F5C6C2", solid: "#E58C86", ink: "#8A362F" },
  lr: { hand: "Left", name: "Ring", short: "ring", pastel: "#F7D8B6", solid: "#EBAE6E", ink: "#875321" },
  lm: { hand: "Left", name: "Middle", short: "mid", pastel: "#F6ECAE", solid: "#E6CF54", ink: "#736312" },
  li: { hand: "Left", name: "Index", short: "index", pastel: "#C7E7B3", solid: "#79C56C", ink: "#356329" },
  ri: { hand: "Right", name: "Index", short: "index", pastel: "#C2D5F3", solid: "#7BA0E7", ink: "#2C4C8C" },
  rm: { hand: "Right", name: "Middle", short: "mid", pastel: "#DBCBEF", solid: "#AE93D8", ink: "#533883" },
  rr: { hand: "Right", name: "Ring", short: "ring", pastel: "#F5CADD", solid: "#E68FB8", ink: "#8A345F" },
  rp: { hand: "Right", name: "Pinky", short: "pinky", pastel: "#C1EADF", solid: "#79CEBB", ink: "#216356" },
  thumb: { hand: "", name: "Thumb", short: "thumb", pastel: "#E4E4E8", solid: "#C2C2C7", ink: "#6B6B70" },
};

type KeyDef = { code: string; label: string; finger: FingerId; flex?: number };

// QWERTY layout. `code` is what we match the next character against (letters are
// stored uppercase). Home-row keys carry a finger label under the letter.
const HOME_KEYS = new Set(["A", "S", "D", "F", "J", "K", "L", ";"]);
const KEYBOARD_ROWS: KeyDef[][] = [
  [
    { code: "`", label: "`", finger: "lp" }, { code: "1", label: "1", finger: "lp" },
    { code: "2", label: "2", finger: "lr" }, { code: "3", label: "3", finger: "lm" },
    { code: "4", label: "4", finger: "li" }, { code: "5", label: "5", finger: "li" },
    { code: "6", label: "6", finger: "ri" }, { code: "7", label: "7", finger: "ri" },
    { code: "8", label: "8", finger: "rm" }, { code: "9", label: "9", finger: "rr" },
    { code: "0", label: "0", finger: "rp" }, { code: "-", label: "-", finger: "rp" },
    { code: "=", label: "=", finger: "rp" },
  ],
  [
    { code: "Q", label: "Q", finger: "lp" }, { code: "W", label: "W", finger: "lr" },
    { code: "E", label: "E", finger: "lm" }, { code: "R", label: "R", finger: "li" },
    { code: "T", label: "T", finger: "li" }, { code: "Y", label: "Y", finger: "ri" },
    { code: "U", label: "U", finger: "ri" }, { code: "I", label: "I", finger: "rm" },
    { code: "O", label: "O", finger: "rr" }, { code: "P", label: "P", finger: "rp" },
    { code: "[", label: "[", finger: "rp" }, { code: "]", label: "]", finger: "rp" },
    { code: "\\", label: "\\", finger: "rp" },
  ],
  [
    { code: "A", label: "A", finger: "lp" }, { code: "S", label: "S", finger: "lr" },
    { code: "D", label: "D", finger: "lm" }, { code: "F", label: "F", finger: "li" },
    { code: "G", label: "G", finger: "li" }, { code: "H", label: "H", finger: "ri" },
    { code: "J", label: "J", finger: "ri" }, { code: "K", label: "K", finger: "rm" },
    { code: "L", label: "L", finger: "rr" }, { code: ";", label: ";", finger: "rp" },
    { code: "'", label: "'", finger: "rp" },
  ],
  [
    { code: "LSHIFT", label: "Shift", finger: "lp", flex: 1.9 },
    { code: "Z", label: "Z", finger: "lp" }, { code: "X", label: "X", finger: "lr" },
    { code: "C", label: "C", finger: "lm" }, { code: "V", label: "V", finger: "li" },
    { code: "B", label: "B", finger: "li" }, { code: "N", label: "N", finger: "ri" },
    { code: "M", label: "M", finger: "ri" }, { code: ",", label: ",", finger: "rm" },
    { code: ".", label: ".", finger: "rr" }, { code: "/", label: "/", finger: "rp" },
    { code: "RSHIFT", label: "Shift", finger: "rp", flex: 1.9 },
  ],
];

// Shifted symbol → its base (unshifted) key, so we can highlight the right key
// and show the "Shift + <base>" combo.
const SHIFT_SYMBOL: Record<string, string> = {
  "!": "1", "@": "2", "#": "3", $: "4", "%": "5", "^": "6", "&": "7", "*": "8",
  "(": "9", ")": "0", _: "-", "+": "=", "{": "[", "}": "]", "|": "\\",
  ":": ";", '"': "'", "<": ",", ">": ".", "?": "/", "~": "`",
};

// Resolve the next character into: the key to press, whether Shift is needed,
// the pressing finger, and (if shifting) which Shift key to hold.
function resolveKey(ch: string | undefined): {
  key?: string;
  base?: string;
  finger?: FingerId;
  needsShift: boolean;
  shiftKey?: "LSHIFT" | "RSHIFT";
  shiftFinger?: FingerId;
} {
  if (ch === undefined) return { needsShift: false };
  if (ch === " ") return { key: "SPACE", base: " ", finger: "thumb", needsShift: false };

  let key: string;
  let needsShift = false;
  if (/[A-Z]/.test(ch)) {
    key = ch;
    needsShift = true;
  } else if (/[a-z]/.test(ch)) {
    key = ch.toUpperCase();
  } else if (SHIFT_SYMBOL[ch]) {
    key = SHIFT_SYMBOL[ch];
    needsShift = true;
  } else {
    key = ch; // already an unshifted key like . , ; ' - =
  }

  const finger = KEY_TO_FINGER[key];
  if (!finger) return { needsShift };
  // Touch-typing rule: shift with the hand opposite the pressing finger.
  const shiftKey = needsShift ? (finger.startsWith("l") ? "RSHIFT" : "LSHIFT") : undefined;
  const shiftFinger: FingerId | undefined = shiftKey === "LSHIFT" ? "lp" : shiftKey === "RSHIFT" ? "rp" : undefined;
  return { key, base: key, finger, needsShift, shiftKey, shiftFinger };
}

const KEY_TO_FINGER: Record<string, FingerId> = KEYBOARD_ROWS.flat().reduce(
  (m, k) => {
    if (k.code !== "LSHIFT" && k.code !== "RSHIFT") m[k.code] = k.finger;
    return m;
  },
  {} as Record<string, FingerId>,
);

function FingerKeyboard({
  activeKey,
  activeShift,
  activeFinger,
  shiftFinger,
  dark,
  expanded,
}: {
  activeKey?: string;
  activeShift?: "LSHIFT" | "RSHIFT";
  activeFinger?: FingerId;
  shiftFinger?: FingerId;
  dark: boolean;
  expanded?: boolean;
}) {
  // Scale the whole board up when expanded so low-vision users can read it.
  const kh = expanded ? 56 : 40; // key height
  const kf = expanded ? 17 : 12; // key label font
  const shortF = expanded ? 11 : 8; // home-row finger label
  const maxW = expanded ? 880 : 620;
  const spaceH = expanded ? 40 : 30;
  const circle = expanded ? 48 : 34; // legend circle diameter
  const circleF = expanded ? 11 : 8.5;

  const spaceActive = activeKey === "SPACE";
  const keyCell = (k: KeyDef) => {
    const f = FINGERS[k.finger];
    const isActive = k.code === activeKey || (k.code === activeShift);
    const isHome = HOME_KEYS.has(k.code);
    return (
      <div
        key={k.code}
        style={{
          flex: k.flex ?? 1,
          minWidth: 0,
          height: kh,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
          background: isActive ? f.solid : f.pastel,
          color: isActive ? "#fff" : f.ink,
          fontWeight: isActive ? 800 : 600,
          fontSize: kf,
          lineHeight: 1.1,
          boxShadow: isActive
            ? `0 0 0 2px ${f.solid}, 0 3px 8px ${f.solid}66`
            : "inset 0 -1.5px 0 rgba(0,0,0,0.06)",
          transform: isActive ? "translateY(-1px)" : "none",
          transition: "background .12s, transform .12s, box-shadow .12s",
          opacity: dark && !isActive ? 0.82 : 1,
        }}
      >
        <span>{k.label}</span>
        {isHome && (
          <span style={{ fontSize: shortF, fontWeight: 700, opacity: isActive ? 0.95 : 0.75 }}>{f.short}</span>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
      <div style={{ width: "100%", maxWidth: maxW, margin: "0 auto", display: "flex", flexDirection: "column", gap: 4, minWidth: 360 }}>
        {KEYBOARD_ROWS.map((row, i) => (
          <div key={i} style={{ display: "flex", gap: 4, paddingLeft: [0, 10, 16, 0][i] }}>
            {row.map(keyCell)}
          </div>
        ))}
        {/* Space bar */}
        <div style={{ display: "flex", gap: 4, paddingLeft: 60, paddingRight: 60 }}>
          <div
            style={{
              flex: 1,
              height: spaceH,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: expanded ? 14 : 11,
              fontWeight: 700,
              background: spaceActive ? FINGERS.thumb.solid : FINGERS.thumb.pastel,
              color: spaceActive ? "#fff" : FINGERS.thumb.ink,
              boxShadow: spaceActive
                ? `0 0 0 2px ${FINGERS.thumb.solid}, 0 3px 8px ${FINGERS.thumb.solid}66`
                : "inset 0 -1.5px 0 rgba(0,0,0,0.06)",
              transition: "background .12s",
            }}
          >
            Space
          </div>
        </div>
      </div>
      </div>

      {/* Hand / finger legend */}
      <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 12, paddingTop: 6, flexWrap: "wrap" }}>
        {(
          [
            { title: "LEFT HAND", ids: ["lp", "lr", "lm", "li"] as FingerId[] },
            { title: "RIGHT HAND", ids: ["ri", "rm", "rr", "rp"] as FingerId[] },
          ]
        ).map((group) => (
          <div key={group.title} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
            <div style={{ fontSize: expanded ? 11 : 9, fontWeight: 700, letterSpacing: "0.06em", color: FINGERS.thumb.ink }}>
              {group.title}
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              {group.ids.map((id) => {
                const f = FINGERS[id];
                const on = id === activeFinger || id === shiftFinger;
                return (
                  <div
                    key={id}
                    title={`${f.hand} ${f.name}`}
                    style={{
                      width: circle,
                      height: circle,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: circleF,
                      fontWeight: 700,
                      textAlign: "center",
                      background: on ? f.solid : f.pastel,
                      color: on ? "#fff" : f.ink,
                      boxShadow: on ? `0 0 0 3px ${f.solid}44` : "none",
                      transform: on ? "scale(1.08)" : "none",
                      transition: "transform .12s, background .12s",
                    }}
                  >
                    {f.name}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Typing practice view ─────────────────────────────────────────────────────
function TypingView({
  content,
  moduleLabel,
  primary,
  secondary,
  t,
  dark,
  expanded,
  onAward,
}: {
  content: string;
  moduleLabel: string;
  primary: string;
  secondary: string;
  t: Tokens;
  dark: boolean;
  expanded: boolean;
  onAward: (amount: number) => void;
}) {
  const lines = useMemo(() => drillLines(content), [content]);
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [awarded, setAwarded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const target = lines[idx] ?? "";
  const { ink, ink2, fill } = t;

  useEffect(() => {
    inputRef.current?.focus();
  }, [idx]);

  const correctChars = Array.from(typed).filter((ch, i) => ch === target[i]).length;
  const done = typed.length >= target.length && target.length > 0;
  const accuracy = typed.length ? Math.round((correctChars / typed.length) * 100) : 100;
  const minutes = startedAt ? Math.max((Date.now() - startedAt) / 60000, 0.0001) : 0;
  const wpm = startedAt ? Math.max(0, Math.round(correctChars / 5 / minutes)) : 0;

  // Which key/finger to guide toward next.
  const nextChar = !done ? target[typed.length] : undefined;
  const guide = resolveKey(nextChar);
  const guideFinger = guide.finger ? FINGERS[guide.finger] : undefined;
  const shiftFinger = guide.shiftFinger ? FINGERS[guide.shiftFinger] : undefined;

  // Expanded → scale everything up for low-vision readability.
  const sz = expanded
    ? { colMax: 900, sentence: 32, hint: 20, combo: 15, stat: 30, statLabel: 13, btn: 20, btnPad: 18, gap: 22 }
    : { colMax: 680, sentence: 20, hint: 14, combo: 12, stat: 18, statLabel: 11, btn: 15, btnPad: 12, gap: 16 };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.slice(0, target.length);
    if (startedAt === null && v.length > 0) setStartedAt(Date.now());
    setTyped(v);
    if (v.length >= target.length && !awarded) {
      setAwarded(true);
      onAward(15);
    }
  };

  const reset = (nextIdx: number) => {
    setIdx(nextIdx);
    setTyped("");
    setStartedAt(null);
    setAwarded(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div
      className="ai-tutor-scroll"
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "20px 18px 22px",
        background: t.panelBg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ width: "100%", maxWidth: sz.colMax, margin: "0 auto", display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 12, color: ink2, marginBottom: 4 }}>
        {moduleLabel} · term {idx + 1} of {lines.length}
      </div>
      <div style={{ fontSize: 13, color: ink2, marginBottom: 16 }}>Type the line below exactly.</div>

      {/* Target text with per-character feedback */}
      <div
        onClick={() => inputRef.current?.focus()}
        style={{
          fontSize: sz.sentence,
          lineHeight: 1.55,
          fontWeight: 600,
          letterSpacing: "0.01em",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          marginBottom: 18,
          cursor: "text",
        }}
      >
        {Array.from(target).map((ch, i) => {
          const state =
            i < typed.length ? (typed[i] === ch ? "ok" : "bad") : i === typed.length ? "cur" : "todo";
          return (
            <span
              key={i}
              style={{
                color:
                  state === "ok"
                    ? ink
                    : state === "bad"
                    ? "#FF3B30"
                    : state === "cur"
                    ? ink
                    : t.ink3,
                background:
                  state === "bad"
                    ? "rgba(255,59,48,0.14)"
                    : state === "cur"
                    ? `${primary}22`
                    : "transparent",
                borderRadius: 3,
                boxShadow: state === "cur" ? `inset 0 -2px 0 ${primary}` : "none",
              }}
            >
              {ch}
            </span>
          );
        })}
      </div>

      {/* Capture keystrokes with a visually-hidden input — the sentence above
          shows live progress, so no visible field is needed. Click the sentence
          (or the keyboard area) to refocus. */}
      <input
        ref={inputRef}
        value={typed}
        onChange={onChange}
        disabled={done}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Type the sentence above"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          opacity: 0,
          padding: 0,
          border: "none",
          pointerEvents: "none",
        }}
      />

      {/* Finger guide */}
      <div style={{ marginTop: 18, cursor: "text" }} onClick={() => inputRef.current?.focus()}>
        <div style={{ textAlign: "center", fontSize: sz.hint, color: ink2, marginBottom: 10 }}>
          {done ? (
            <span>Line complete 🎉</span>
          ) : guide.needsShift && guideFinger && shiftFinger ? (
            <span>
              Hold <strong style={{ color: shiftFinger.solid }}>{shiftFinger.hand} Shift</strong> + use your{" "}
              <strong style={{ color: guideFinger.solid }}>
                {guideFinger.hand} {guideFinger.name}
              </strong>
            </span>
          ) : guideFinger ? (
            <span>
              Use your{" "}
              <strong style={{ color: guideFinger.solid }}>
                {guide.key === "SPACE" ? "Thumb" : `${guideFinger.hand} ${guideFinger.name}`}
              </strong>
            </span>
          ) : (
            <span>&nbsp;</span>
          )}
        </div>

        {/* Shift combo pill — how to produce a capital or symbol */}
        {guide.needsShift && guide.base && (
          <div style={{ textAlign: "center", marginBottom: 10 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: sz.combo,
                fontWeight: 600,
                color: ink,
                background: fill,
                borderRadius: 999,
                padding: "5px 12px",
              }}
            >
              <kbd style={kbdStyle(t)}>Shift</kbd>
              <span style={{ opacity: 0.6 }}>+</span>
              <kbd style={kbdStyle(t)}>{guide.base}</kbd>
              {nextChar && nextChar !== guide.base && (
                <>
                  <span style={{ opacity: 0.6 }}>→</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{nextChar}</span>
                </>
              )}
            </span>
          </div>
        )}

        <FingerKeyboard
          activeKey={guide.key}
          activeShift={guide.shiftKey}
          activeFinger={guide.finger}
          shiftFinger={guide.shiftFinger}
          dark={dark}
          expanded={expanded}
        />
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <TypingStat value={String(wpm)} label="WPM" t={t} big={expanded} />
        <TypingStat value={`${accuracy}%`} label="Accuracy" t={t} big={expanded} />
        <TypingStat value={`${typed.length}/${target.length}`} label="Chars" t={t} big={expanded} />
      </div>

      {done && (
        <div
          style={{
            marginTop: 18,
            padding: "12px 16px",
            borderRadius: 14,
            background: `linear-gradient(135deg, ${primary}, ${secondary})`,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            animation: "ai-tutor-pop .28s cubic-bezier(.22,1,.36,1)",
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700 }}>Nice — +15 XP</span>
          <span style={{ fontSize: 13, opacity: 0.9 }}>
            {wpm} WPM · {accuracy}%
          </span>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button
          className="ai-tutor-tap"
          onClick={() => reset(idx)}
          style={{
            flex: 1,
            border: "none",
            cursor: "pointer",
            borderRadius: 13,
            padding: sz.btnPad,
            fontFamily: FONT,
            fontSize: sz.btn,
            fontWeight: 600,
            color: primary,
            background: fill,
          }}
        >
          Restart
        </button>
        <button
          className="ai-tutor-tap"
          onClick={() => reset((idx + 1) % lines.length)}
          style={{
            flex: 1,
            border: "none",
            cursor: "pointer",
            borderRadius: 13,
            padding: sz.btnPad,
            fontFamily: FONT,
            fontSize: sz.btn,
            fontWeight: 600,
            color: "#fff",
            background: primary,
          }}
        >
          Next term
        </button>
      </div>
      </div>
    </div>
  );
}

function kbdStyle(t: Tokens): React.CSSProperties {
  return {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 11,
    fontWeight: 700,
    color: t.ink,
    background: t.surface,
    border: `0.5px solid ${t.fill2}`,
    borderRadius: 5,
    padding: "1px 6px",
    boxShadow: "0 1px 0 rgba(0,0,0,0.08)",
  };
}

function TypingStat({ value, label, t, big }: { value: string; label: string; t: Tokens; big?: boolean }) {
  return (
    <div style={{ flex: 1, background: t.fill, borderRadius: 12, padding: big ? "16px 10px" : "10px 8px", textAlign: "center" }}>
      <div style={{ fontSize: big ? 28 : 18, fontWeight: 700, color: t.ink, letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: big ? 13 : 11, color: t.ink2, marginTop: 1 }}>{label}</div>
    </div>
  );
}

// ── Progress sub-components ───────────────────────────────────────────────────
function LevelRing({
  pct,
  level,
  primary,
  secondary,
  t,
}: {
  pct: number;
  level: number;
  primary: string;
  secondary: string;
  t: Tokens;
}) {
  const size = 128;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const gid = "ai-tutor-ring-grad";
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={primary} />
            <stop offset="100%" stopColor={secondary} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.fill2} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - Math.max(0.02, pct))}
          style={{ transition: "stroke-dashoffset .6s cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.ink2 }}>
          LEVEL
        </div>
        <div style={{ fontSize: 40, fontWeight: 800, color: t.ink, lineHeight: 1, letterSpacing: "-0.03em" }}>
          {level}
        </div>
      </div>
    </div>
  );
}

function StatChip({ value, label, emoji, t }: { value: string; label: string; emoji: string; t: Tokens }) {
  return (
    <div
      style={{
        flex: 1,
        background: t.surface,
        borderRadius: 14,
        padding: "12px 8px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 18, marginBottom: 2 }}>{emoji}</div>
      <div style={{ fontSize: 19, fontWeight: 700, color: t.ink, letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: t.ink2, marginTop: 1 }}>{label}</div>
    </div>
  );
}

function SectionLabel({ text, ink2 }: { text: string; ink2: string }) {
  return (
    <div
      style={{
        fontSize: 12.5,
        fontWeight: 600,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        color: ink2,
        margin: "0 6px 8px",
      }}
    >
      {text}
    </div>
  );
}

function Badge({
  emoji,
  title,
  sub,
  earned,
  primary,
  t,
}: {
  emoji: string;
  title: string;
  sub?: string;
  earned: boolean;
  primary: string;
  t: Tokens;
}) {
  return (
    <div
      style={{
        background: t.surface,
        borderRadius: 14,
        padding: "14px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        opacity: earned ? 1 : 0.5,
        border: earned ? `1px solid ${primary}33` : "1px solid transparent",
      }}
    >
      <div
        style={{
          fontSize: 22,
          filter: earned ? "none" : "grayscale(1)",
        }}
      >
        {emoji}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: t.ink, lineHeight: 1.15 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: earned ? primary : t.ink2, marginTop: 1 }}>
          {earned ? "Earned" : sub ?? "Locked"}
        </div>
      </div>
    </div>
  );
}
