// ─────────────────────────────────────────────────────────────────────────────
// Claude API client
//
// Supports two modes:
//   1. Direct — pass `apiKey` (fine for dev / private apps)
//   2. Proxy  — pass `apiEndpoint` pointing to YOUR server route
//               so the key never ships to the browser in production.
//
// Proxy contract:
//   POST { module, systemPrompt, messages: [{role, content}] }
//   Response: { reply: string }
// ─────────────────────────────────────────────────────────────────────────────

import type { ApiConfig, ChatMessage } from "../types";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

interface SendParams {
  api: ApiConfig;
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
  module: string;
}

/** Sends a chat turn to Claude and returns the assistant reply string. */
export async function sendMessage({
  api,
  model,
  systemPrompt,
  messages,
  module,
}: SendParams): Promise<string> {
  const anthropicMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // ── Proxy mode ──────────────────────────────────────────────────────────
  if (api.apiEndpoint) {
    const res = await fetch(api.apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module, systemPrompt, messages: anthropicMessages }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Proxy error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as { reply: string };
    return data.reply;
  }

  // ── Direct mode ─────────────────────────────────────────────────────────
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      "x-api-key": api.apiKey!,
      "anthropic-version": ANTHROPIC_VERSION,
      // Required for browser requests
      "anthropic-dangerous-direct-browser-access": "true",
    } as Record<string, string>,
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: anthropicMessages,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  const data = await res.json() as {
    content: Array<{ type: string; text: string }>;
  };
  const block = data.content.find((b) => b.type === "text");
  return block?.text ?? "";
}
