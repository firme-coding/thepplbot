import { KokoroTTS } from "kokoro-js";

const VOICE = process.argv[2] || "af_heart";
const TEXT =
  process.argv[3] ||
  "Hi! I'm your typing tutor. Let's find the home row together — rest your fingers on F and J, and we'll take it one key at a time.";

console.log(`Loading Kokoro (voice: ${VOICE})… first run downloads ~80MB.`);
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
  dtype: "q8",
  device: "cpu",
});

console.log("Generating audio…");
const audio = await tts.generate(TEXT, { voice: VOICE });
const out = new URL("./sample.wav", import.meta.url).pathname;
await audio.save(out);
console.log("Saved:", out);
