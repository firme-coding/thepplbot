// ─────────────────────────────────────────────────────────────────────────────
// AI Tutor — TypeScript Types
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactNode } from "react";

/**
 * Color theme for the widget chrome (backgrounds, text, surfaces).
 * - "light" (default): the iOS-light look.
 * - "dark": a dark chrome that matches a dark-themed host app.
 * - "auto": follows the visitor's OS setting (prefers-color-scheme) and updates
 *   live when they toggle it.
 *
 * `primaryColor` / `secondaryColor` are your brand accents and apply in both
 * themes — only the neutral chrome changes.
 */
export type Theme = "light" | "dark" | "auto";

/** A single curriculum module */
export interface CurriculumModule {
  /** Display name shown in the module selector dropdown */
  label: string;
  /** The curriculum content the AI uses as context */
  content: string;
}

/** Full curriculum passed to the tutor */
export type Curriculum = Record<string, CurriculumModule>;

/**
 * How the learner wants examples presented. Selecting one nudges the tutor to
 * tailor its explanations to that learning style.
 */
export type Modality = "reading" | "visual" | "audio" | "images" | "hands-on";

/**
 * Corner to dock the floating chat launcher in. When set, the widget renders as
 * a fixed chat-bubble button that opens the panel. When omitted, it renders
 * inline, filling its container.
 */
export type ChatPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";

/** A single chat message */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  id: string;
}

/**
 * The signed-in learner, supplied by the host app. All fields optional so the
 * widget still works anonymously.
 */
export interface TutorUser {
  /** Stable id from your platform. Used to key saved progress per person. */
  id?: string;
  /** The learner's real name. The tutor addresses them by it. Edit it in your
   *  platform's settings and pass the new value — the widget is read-only. */
  name?: string;
  /** Public display handle shown in the widget (header + progress view). */
  gameName?: string;
}

/** Gamification progress the host can persist and restore across devices. */
export interface TutorProgress {
  /** Questions asked per module key. */
  counts: Record<string, number>;
  /** XP earned from typing practice. */
  typingXp: number;
}

/**
 * A completed Q&A turn, handed to `onTranscript` so the host can persist it to
 * their database (analytics, review, moderation).
 */
export interface TranscriptTurn {
  /** Module key the question was asked in. */
  module: string;
  /** The learner's question. */
  question: string;
  /** The tutor's reply. */
  reply: string;
  /** Explanation modality active for this turn. */
  modality: Modality;
  /** The learner's id, if one was supplied via `user`. */
  userId?: string;
}

/** Config for calling Claude directly or via your own proxy */
export type ApiConfig =
  | {
      /**
       * Your Anthropic API key.
       * ⚠️  Only use this in development or if your site is gated (not public).
       * For production public sites, use `apiEndpoint` with a server-side proxy.
       */
      apiKey: string;
      apiEndpoint?: never;
    }
  | {
      apiKey?: never;
      /**
       * URL of your own API endpoint that proxies calls to Claude.
       * POST body: { module: string; messages: { role: string; content: string }[] }
       * Expected response: { reply: string }
       */
      apiEndpoint: string;
    };

/** Branding / theming props */
export interface BrandConfig {
  /** Your organization name. Defaults to "AI Tutor" */
  orgName?: string;
  /** URL to your logo image. Falls back to text-only header if not provided */
  logoUrl?: string;
  /** Primary brand color (hex). Defaults to iOS system blue #007AFF */
  primaryColor?: string;
  /** Secondary accent (hex), used for gradients. Defaults to iOS indigo #5856D6 */
  secondaryColor?: string;
  /**
   * Color theme for the chrome. "light" (default), "dark", or "auto" to follow
   * the visitor's OS setting. Your `primaryColor`/`secondaryColor` accents apply
   * in both themes.
   */
  theme?: Theme;
}

/** All props for the <AITutor /> component */
export interface AITutorProps extends BrandConfig {
  /** API config — either an API key or your own proxy endpoint */
  api: ApiConfig;
  /**
   * Curriculum modules. Defaults to the bundled demo curriculum.
   * See CUSTOMIZATION.md for how to add your own.
   */
  curriculum?: Curriculum;
  /** Claude model to use. Defaults to claude-haiku-4-5-20251001 for speed */
  model?: string;
  /** System prompt override. See CUSTOMIZATION.md for guidance */
  systemPrompt?: string;
  /** Chat input placeholder text */
  placeholder?: string;
  /** Optional CSS class added to the root element */
  className?: string;
  /**
   * Called when the user taps the close (✕) button. If omitted (and not in
   * floating mode), the close button is hidden.
   */
  onClose?: () => void;
  /** Which example modality is selected on first render. Defaults to "reading" */
  defaultModality?: Modality;
  /**
   * Dock the widget as a floating chat launcher in a viewport corner
   * ("bottom-right" | "bottom-left" | "top-right" | "top-left"). Omit to render
   * inline, filling the parent container.
   */
  position?: ChatPosition;
  /**
   * Custom icon for the floating launcher button (the closed-state chat bubble
   * in `position` mode). Pass:
   *   • an image URL / path — `launcherIcon="/bot.png"` → rendered as an <img>
   *   • an emoji or short text — `launcherIcon="🤖"`
   *   • any React node — `launcherIcon={<MyIcon />}`
   * Omit to use the built-in chat glyph. (The open-state button always shows the
   * ✕ so learners can close it.)
   */
  launcherIcon?: ReactNode;
  /**
   * The signed-in learner (id, name, gameName). Pass this from your platform.
   * `name` is used to address the learner; `gameName` shows in the UI; `id`
   * keys their saved progress.
   */
  user?: TutorUser;
  /**
   * Progress to restore on mount (from your backend). Seeds XP/levels/mastery.
   * To load it asynchronously, mount the widget after it resolves, or pass a
   * changing `key` (e.g. the userId) so it re-seeds.
   */
  initialProgress?: TutorProgress;
  /**
   * Called whenever progress changes (a question asked, typing XP earned).
   * Persist it in your backend keyed by the user. When provided, the widget
   * stops writing to localStorage and treats your store as the source of truth.
   */
  onProgressChange?: (progress: TutorProgress) => void;
  /**
   * Async loader for curriculum from your own backend/DB. When provided, the
   * widget fetches modules on mount (showing a loading state) instead of using
   * the static `curriculum` prop. If it rejects, the widget falls back to
   * `curriculum` (or the bundled demo).
   *
   * Wrap it in `useCallback` so its identity is stable — a new function every
   * render re-triggers the fetch.
   */
  loadCurriculum?: () => Promise<Curriculum>;
  /**
   * Async loader for saved progress from your backend/DB, called with the
   * current `user.id` on mount and whenever that id changes. Resolve `null` (or
   * undefined) when there's nothing saved. When provided, it seeds the widget in
   * place of `initialProgress`, and the seeded value is NOT echoed back to
   * `onProgressChange`. Wrap it in `useCallback` for a stable identity.
   */
  loadProgress?: (userId: string | undefined) => Promise<TutorProgress | null | undefined>;
  /**
   * Called after each completed Q&A turn so you can persist the transcript to
   * your DB. Fire-and-forget — the widget doesn't await it, and throwing won't
   * break the chat.
   */
  onTranscript?: (turn: TranscriptTurn) => void;
}
