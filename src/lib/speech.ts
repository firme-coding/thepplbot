// Thin wrapper over the browser Web Speech API for the "audio" modality.
// No dependencies, no network — the browser speaks the text locally.

import { stripMarkdown } from "./markdown";

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

/** Speak text aloud, cancelling anything already playing. */
export function speak(text: string): void {
  if (!speechSupported()) return;
  const clean = stripMarkdown(text);
  if (!clean) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  u.rate = 1;
  u.pitch = 1;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}
