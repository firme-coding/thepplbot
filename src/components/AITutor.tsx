import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { ChatMessage, AITutorProps, Modality } from "../types";
import { DEMO_CURRICULUM } from "../curriculum";
import { sendMessage } from "../lib/claude";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

// iOS system font stack — the point of the design is that it feels native.
const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif';

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
  model = DEFAULT_MODEL,
  systemPrompt,
  placeholder = "Ask a question…",
  className,
  onClose,
  defaultModality = "reading",
  position,
}: AITutorProps) {
  const [launcherOpen, setLauncherOpen] = useState(false);
  const moduleKeys = Object.keys(curriculum);
  const [selectedKey, setSelectedKey] = useState(moduleKeys[0] ?? "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"chat" | "typing" | "progress">("chat");
  const [modality, setModality] = useState<Modality>(defaultModality);
  const [showModules, setShowModules] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const storageKey = `ai-tutor:progress:${orgName}`;
  const [counts, setCounts] = useState<Counts>(() => loadCounts(storageKey));
  const typingKey = `ai-tutor:typingxp:${orgName}`;
  const [typingXp, setTypingXp] = useState<number>(() => loadNumber(typingKey));

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => injectStyles(), []);

  // Persist progress
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(counts));
    } catch {
      /* storage unavailable — ignore */
    }
  }, [counts, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(typingKey, String(typingXp));
    } catch {
      /* storage unavailable — ignore */
    }
  }, [typingXp, typingKey]);

  // Reset chat when the module changes
  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [selectedKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const activeModule = curriculum[selectedKey];
  const activeModality = MODALITIES.find((m) => m.key === modality)!;

  const resolvedSystemPrompt =
    (systemPrompt ?? DEFAULT_SYSTEM(orgName, activeModule?.content ?? "")) +
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }, [api, input, isLoading, messages, model, resolvedSystemPrompt, selectedKey]);

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
  const ink = "#1C1C1E";
  const ink2 = "rgba(60,60,67,0.6)";
  const sep = "rgba(60,60,67,0.14)";
  const fill = "rgba(118,118,128,0.12)";
  const fill2 = "rgba(118,118,128,0.2)";
  const groupBg = "#F2F2F7";
  const tint = (c: string, a: string) => `${c}${a}`;

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
              background: active ? "#fff" : "transparent",
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
        maxWidth: expanded ? 720 : 460,
        margin: "0 auto",
        height: "100%",
        minHeight: expanded ? 620 : 540,
        maxHeight: expanded ? 900 : 760,
        borderRadius: 26,
        overflow: "hidden",
        position: "relative",
        boxShadow:
          "0 20px 50px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.10)",
        fontFamily: FONT,
        background: view === "progress" ? groupBg : "#ffffff",
        border: "0.5px solid rgba(0,0,0,0.08)",
        transition: "max-width .32s cubic-bezier(.22,1,.36,1), max-height .32s cubic-bezier(.22,1,.36,1), background .25s",
      }}
    >
      {/* ── Frosted nav bar ── */}
      <div
        style={{
          padding: "12px 14px 10px",
          background: "rgba(255,255,255,0.72)",
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
                Lv {level} · {xp} XP
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

      {/* ── Toolbar: Modules + modality picker ── */}
      {view !== "progress" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "10px 14px",
            borderBottom: `0.5px solid ${sep}`,
            background: "#fff",
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
                      background: active ? "#fff" : "transparent",
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
      {view === "chat" && (
        <>
          <div
            className="ai-tutor-scroll"
            style={{ flex: 1, overflowY: "auto", padding: "16px 0", background: "#fff" }}
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
                    justifyContent: isUser ? "flex-end" : "flex-start",
                    padding: "0 14px",
                    marginBottom: 8,
                    animation: "ai-tutor-pop .28s cubic-bezier(.22,1,.36,1)",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "78%",
                      padding: "9px 14px",
                      fontSize: 15.5,
                      lineHeight: 1.42,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      color: isUser ? "#fff" : ink,
                      background: isUser ? primaryColor : "#E9E9EB",
                      borderRadius: 20,
                      borderBottomRightRadius: isUser ? 6 : 20,
                      borderBottomLeftRadius: isUser ? 20 : 6,
                    }}
                  >
                    {msg.content}
                  </div>
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
                    background: "#E9E9EB",
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
                        background: "rgba(60,60,67,0.45)",
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
              background: "rgba(255,255,255,0.86)",
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
                background: "#fff",
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
      {view === "typing" && (
        <TypingView
          key={selectedKey}
          content={activeModule?.content ?? ""}
          moduleLabel={activeModule?.label ?? ""}
          primary={primaryColor}
          secondary={secondaryColor}
          onAward={(amt) => setTypingXp((x) => x + amt)}
        />
      )}

      {/* ── PROGRESS VIEW (gamification) ── */}
      {view === "progress" && (
        <div
          className="ai-tutor-scroll"
          style={{ flex: 1, overflowY: "auto", padding: "18px 16px 24px", background: groupBg }}
        >
          {/* Level ring */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
            <LevelRing pct={levelPct} level={level} primary={primaryColor} secondary={secondaryColor} />
            <div style={{ marginTop: 10, fontSize: 13, color: ink2 }}>
              {xpIntoLevel} / {XP_PER_LEVEL} XP to Level {level + 1}
            </div>
          </div>

          {/* Stat chips */}
          <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
            <StatChip value={String(totalQuestions)} label="Questions" emoji="💬" />
            <StatChip value={`${masteredKeys.length}/${moduleKeys.length}`} label="Mastered" emoji="🏆" />
            <StatChip value={String(visitedKeys.length)} label="Explored" emoji="🧭" />
          </div>

          {/* Module progress list */}
          <SectionLabel text="Modules" ink2={ink2} />
          <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", marginBottom: 22 }}>
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
                      {curriculum[k].label}
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
                  <Glyph k="chevron" size={16} color="rgba(60,60,67,0.3)" />
                </button>
              );
            })}
          </div>

          {/* Badges */}
          <SectionLabel text="Badges" ink2={ink2} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
            <Badge emoji="🎯" title="First Question" earned={totalQuestions >= 1} primary={primaryColor} />
            <Badge emoji="💡" title="Curious Mind" sub="Ask 5" earned={totalQuestions >= 5} primary={primaryColor} />
            <Badge
              emoji="🧭"
              title="Explorer"
              sub="Visit all"
              earned={visitedKeys.length === moduleKeys.length && moduleKeys.length > 0}
              primary={primaryColor}
            />
            <Badge
              emoji="🎓"
              title="Scholar"
              sub="Master all"
              earned={masteredKeys.length === moduleKeys.length && moduleKeys.length > 0}
              primary={primaryColor}
            />
            <Badge emoji="⌨️" title="Typist" sub="Type 3 terms" earned={typingXp >= 45} primary={primaryColor} />
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
              <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden" }}>
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
                        {curriculum[k].label}
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
      <Glyph k={launcherOpen ? "close" : "chat"} size={26} color="#fff" stroke={2.2} />
    </button>
  );

  const panelWrap = launcherOpen ? (
    <div
      style={{
        width: "min(400px, calc(100vw - 40px))",
        height: "min(660px, calc(100vh - 108px))",
        animation: "ai-tutor-pop .26s cubic-bezier(.22,1,.36,1)",
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

// ── Typing practice view ─────────────────────────────────────────────────────
function TypingView({
  content,
  moduleLabel,
  primary,
  secondary,
  onAward,
}: {
  content: string;
  moduleLabel: string;
  primary: string;
  secondary: string;
  onAward: (amount: number) => void;
}) {
  const lines = useMemo(() => drillLines(content), [content]);
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [awarded, setAwarded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const target = lines[idx] ?? "";
  const ink = "#1C1C1E";
  const ink2 = "rgba(60,60,67,0.6)";
  const fill = "rgba(118,118,128,0.12)";

  useEffect(() => {
    inputRef.current?.focus();
  }, [idx]);

  const correctChars = Array.from(typed).filter((ch, i) => ch === target[i]).length;
  const done = typed.length >= target.length && target.length > 0;
  const accuracy = typed.length ? Math.round((correctChars / typed.length) * 100) : 100;
  const minutes = startedAt ? Math.max((Date.now() - startedAt) / 60000, 0.0001) : 0;
  const wpm = startedAt ? Math.max(0, Math.round(correctChars / 5 / minutes)) : 0;

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
        background: "#fff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ fontSize: 12, color: ink2, marginBottom: 4 }}>
        {moduleLabel} · term {idx + 1} of {lines.length}
      </div>
      <div style={{ fontSize: 13, color: ink2, marginBottom: 16 }}>Type the line below exactly.</div>

      {/* Target text with per-character feedback */}
      <div
        onClick={() => inputRef.current?.focus()}
        style={{
          fontSize: 20,
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
                    : "rgba(60,60,67,0.32)",
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

      <input
        ref={inputRef}
        value={typed}
        onChange={onChange}
        disabled={done}
        placeholder="Start typing…"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        style={{
          width: "100%",
          boxSizing: "border-box",
          border: `0.5px solid rgba(118,118,128,0.2)`,
          borderRadius: 14,
          padding: "12px 15px",
          fontSize: 16,
          fontFamily: FONT,
          outline: "none",
          background: done ? fill : "#fff",
          color: ink,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = primary;
          e.currentTarget.style.boxShadow = `0 0 0 3.5px ${primary}1f`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "rgba(118,118,128,0.2)";
          e.currentTarget.style.boxShadow = "none";
        }}
      />

      {/* Stats */}
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <TypingStat value={String(wpm)} label="WPM" />
        <TypingStat value={`${accuracy}%`} label="Accuracy" />
        <TypingStat value={`${typed.length}/${target.length}`} label="Chars" />
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
            padding: "12px",
            fontFamily: FONT,
            fontSize: 15,
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
            padding: "12px",
            fontFamily: FONT,
            fontSize: 15,
            fontWeight: 600,
            color: "#fff",
            background: primary,
          }}
        >
          Next term
        </button>
      </div>
    </div>
  );
}

function TypingStat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ flex: 1, background: "rgba(118,118,128,0.1)", borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#1C1C1E", letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: 11, color: "rgba(60,60,67,0.6)", marginTop: 1 }}>{label}</div>
    </div>
  );
}

// ── Progress sub-components ───────────────────────────────────────────────────
function LevelRing({
  pct,
  level,
  primary,
  secondary,
}: {
  pct: number;
  level: number;
  primary: string;
  secondary: string;
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
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(118,118,128,0.16)" strokeWidth={stroke} />
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
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(60,60,67,0.6)" }}>
          LEVEL
        </div>
        <div style={{ fontSize: 40, fontWeight: 800, color: "#1C1C1E", lineHeight: 1, letterSpacing: "-0.03em" }}>
          {level}
        </div>
      </div>
    </div>
  );
}

function StatChip({ value, label, emoji }: { value: string; label: string; emoji: string }) {
  return (
    <div
      style={{
        flex: 1,
        background: "#fff",
        borderRadius: 14,
        padding: "12px 8px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 18, marginBottom: 2 }}>{emoji}</div>
      <div style={{ fontSize: 19, fontWeight: 700, color: "#1C1C1E", letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "rgba(60,60,67,0.6)", marginTop: 1 }}>{label}</div>
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
}: {
  emoji: string;
  title: string;
  sub?: string;
  earned: boolean;
  primary: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
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
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1C1C1E", lineHeight: 1.15 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: earned ? primary : "rgba(60,60,67,0.6)", marginTop: 1 }}>
          {earned ? "Earned" : sub ?? "Locked"}
        </div>
      </div>
    </div>
  );
}
