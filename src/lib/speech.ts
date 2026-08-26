// Text-to-speech for the "audio" modality.
//
// Primary engine: Kokoro-82M, an open (Apache-2.0) neural TTS that runs entirely
// in the browser via WebGPU/WASM — no API key, no server, and the same natural
// voice for every user regardless of OS. It's an OPTIONAL dependency, loaded on
// first use via dynamic import; if it isn't installed (or can't run), we fall
// back to the browser's built-in Web Speech API so audio still works.

import { stripMarkdown } from "./markdown";

// The neural voice. af_heart is Kokoro's highest-graded (A) American English
// voice — warm and natural. Swap for any name from `tts.list_voices()`
// (e.g. am_michael, bf_emma, bm_george) to change the reader.
const KOKORO_VOICE = "af_heart";
const KOKORO_MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";

export function speechSupported(): boolean {
  // Kokoro plays through an <audio> element, so any browser can attempt it;
  // Web Speech is the fallback. Either path means we can offer a reader.
  return typeof window !== "undefined" && (typeof Audio !== "undefined" || "speechSynthesis" in window);
}

// ── Kokoro loading (lazy + cached) ──────────────────────────────────────────

// Loosely typed so we don't force a build-time dependency on kokoro-js's types.
type KokoroTTS = { generate: (text: string, opts: { voice: string }) => Promise<{ toBlob: () => Blob }> };
let ttsPromise: Promise<KokoroTTS> | null = null;

async function getTTS(): Promise<KokoroTTS> {
  if (ttsPromise) return ttsPromise;
  ttsPromise = (async () => {
    // Optional dependency — bundlers keep this as a runtime import.
    const { KokoroTTS } = (await import("kokoro-js")) as {
      KokoroTTS: { from_pretrained: (id: string, opts: { dtype: string; device: string }) => Promise<KokoroTTS> };
    };
    const hasWebGPU = typeof navigator !== "undefined" && "gpu" in navigator && (navigator as { gpu?: unknown }).gpu != null;
    try {
      return hasWebGPU
        ? await KokoroTTS.from_pretrained(KOKORO_MODEL, { dtype: "fp32", device: "webgpu" })
        : await KokoroTTS.from_pretrained(KOKORO_MODEL, { dtype: "q8", device: "wasm" });
    } catch {
      // WebGPU init can fail on some machines — retry on WASM before giving up.
      return await KokoroTTS.from_pretrained(KOKORO_MODEL, { dtype: "q8", device: "wasm" });
    }
  })();
  // Let a failed load be retried on the next click.
  ttsPromise.catch(() => {
    ttsPromise = null;
  });
  return ttsPromise;
}

// Kokoro has a per-utterance token limit, so split long answers into sentence
// chunks and play them back to back. Keeps chunks reasonably sized.
function splitIntoChunks(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [text];
  const chunks: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + s).length > 300 && buf) {
      chunks.push(buf.trim());
      buf = "";
    }
    buf += s;
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

// ── Playback state ──────────────────────────────────────────────────────────

// Monotonic token: bumped on every stop/new request so in-flight generation and
// queued chunks from a superseded request abort cleanly.
let token = 0;
let currentAudio: HTMLAudioElement | null = null;
let currentAudioDone: (() => void) | null = null;

function playBlob(blob: Blob): Promise<void> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const el = new Audio(url);
    const finish = () => {
      el.onended = null;
      el.onerror = null;
      URL.revokeObjectURL(url);
      if (currentAudio === el) {
        currentAudio = null;
        currentAudioDone = null;
      }
      resolve();
    };
    currentAudio = el;
    currentAudioDone = finish;
    el.onended = finish;
    el.onerror = finish;
    el.play().catch(finish);
  });
}

export interface SpeakCallbacks {
  /** Fires when audio actually starts playing (after the model/first chunk is ready). */
  onStart?: () => void;
  /** Fires when playback finishes, errors, is stopped, or there's nothing to say. */
  onEnd?: () => void;
}

/**
 * Speak text aloud with Kokoro, cancelling anything already playing. Falls back
 * to the Web Speech API if Kokoro isn't available. `onStart` lets callers show a
 * loading state while the model downloads on first use.
 */
export async function speak(text: string, cb: SpeakCallbacks = {}): Promise<void> {
  const { onStart, onEnd } = cb;
  const clean = stripMarkdown(text);
  if (!clean) {
    onEnd?.();
    return;
  }
  stopSpeaking();
  const myToken = ++token;

  let tts: KokoroTTS;
  try {
    tts = await getTTS();
  } catch {
    // Kokoro not installed or failed to load — use the browser's own voices.
    if (myToken === token) speakWebSpeech(clean, cb);
    return;
  }
  if (myToken !== token) return; // stopped/superseded during model load

  try {
    let started = false;
    for (const chunk of splitIntoChunks(clean)) {
      if (myToken !== token) return;
      const audio = await tts.generate(chunk, { voice: KOKORO_VOICE });
      if (myToken !== token) return;
      if (!started) {
        started = true;
        onStart?.();
      }
      await playBlob(audio.toBlob());
      if (myToken !== token) return; // stopped mid-playback
    }
    if (myToken === token) onEnd?.();
  } catch {
    if (myToken === token) onEnd?.();
  }
}

export function stopSpeaking(): void {
  token++;
  if (currentAudio) currentAudio.pause();
  if (currentAudioDone) currentAudioDone();
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

// ── Web Speech API fallback ──────────────────────────────────────────────────

// Preferred built-in voices, best first — used only when Kokoro is unavailable.
const VOICE_PREFERENCES = [
  "Google US English",
  "Microsoft Aria Online (Natural) - English (United States)",
  "Samantha",
  "Karen",
  "Daniel",
];
let cachedVoice: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return cachedVoice;
  for (const name of VOICE_PREFERENCES) {
    const match = voices.find((v) => v.name === name);
    if (match) return (cachedVoice = match);
  }
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  return (cachedVoice = english.find((v) => v.localService) ?? english[0] ?? null);
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  pickVoice();
  window.speechSynthesis.addEventListener?.("voiceschanged", pickVoice);
}

function speakWebSpeech(clean: string, { onStart, onEnd }: SpeakCallbacks = {}): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  const voice = pickVoice();
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  }
  u.rate = 1;
  u.pitch = 1;
  u.onstart = () => onStart?.();
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}
