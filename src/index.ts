// ─────────────────────────────────────────────────────────────────────────────
// ai-tutor-widget — public API
// ─────────────────────────────────────────────────────────────────────────────

// Main component
export { AITutor } from "./components/AITutor";

// Curriculum data — use as default or as a reference for building your own
export { DEMO_CURRICULUM } from "./curriculum";

// Types — useful if you're building custom curriculum or wrapping the component
export type {
  AITutorProps,
  BrandConfig,
  ApiConfig,
  Curriculum,
  CurriculumModule,
  ChatMessage,
} from "./types";
