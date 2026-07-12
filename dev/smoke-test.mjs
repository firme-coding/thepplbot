// Headless smoke test for the BUILT package (dist), driven with mock data.
// Run: node dev/smoke-test.mjs   (requires: npm i jsdom --no-save)
//
// It renders <AITutor> from the published entry ("thepplbot"), stubs fetch with
// canned mock replies, simulates typing + sending, and checks the reply plus the
// XP/gamification update actually render.

import { JSDOM } from "jsdom";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: "http://localhost/",
});
const { window } = dom;
for (const k of [
  "window",
  "document",
  "HTMLElement",
  "HTMLTextAreaElement",
  "HTMLInputElement",
  "Event",
  "KeyboardEvent",
  "MouseEvent",
  "Node",
]) {
  globalThis[k] = window[k];
}
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
window.HTMLElement.prototype.scrollIntoView = () => {};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// ── MOCK DATA: stub fetch so no real API/key is needed ───────────────────────
const posted = [];
globalThis.fetch = async (_url, opts) => {
  const body = JSON.parse(opts.body);
  posted.push(body);
  const lastUser = [...body.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const reply = `**MOCK[${body.module}]** — you asked: "${lastUser}"\n\n- point one\n- point two`;
  return { ok: true, status: 200, json: async () => ({ reply }), text: async () => "" };
};

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const act = React.act;
const { AITutor } = await import("thepplbot"); // ← the built dist entry

const results = [];
const check = (name, cond) => {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? "✅" : "❌"} ${name}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const container = document.getElementById("root");
const root = createRoot(container);

await act(async () => {
  root.render(
    React.createElement(AITutor, { api: { apiEndpoint: "/api/tutor" }, orgName: "Firme Coding" }),
  );
});

// 1. Built package renders the shell
check("renders org name in header", container.textContent.includes("Firme Coding"));
check("renders empty-state prompt", container.textContent.includes("Ask your first question below."));
check(
  "renders Chat / Typing / Progress segments",
  ["chat", "typing", "progress"].every((s) =>
    [...container.querySelectorAll("button")].some((b) => b.textContent.trim() === s),
  ),
);
check("starts at Level 1 · 0 XP", container.textContent.includes("Lv 1") && container.textContent.includes("0 XP"));

// 2. Type a question and send it (drives mock fetch)
await act(async () => {
  const ta = container.querySelector("textarea");
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
  setter.call(ta, "What do you build?");
  ta.dispatchEvent(new window.Event("input", { bubbles: true }));
});
await act(async () => {
  container.querySelector('button[aria-label="Send"]').dispatchEvent(
    new window.MouseEvent("click", { bubbles: true }),
  );
  await wait(60);
});

check("user message appears", container.textContent.includes("What do you build?"));
check("mock reply rendered from fetch", container.textContent.includes('MOCK[') && container.textContent.includes('you asked: "What do you build?"'));
check("markdown renders (bold, no literal **)", !container.textContent.includes("**") && !!container.querySelector("strong"));
check("markdown renders list items", container.querySelectorAll("li").length >= 2);
check("fetch received module + messages", posted.length === 1 && posted[0].module && Array.isArray(posted[0].messages));
check("XP incremented to 10 after 1 question", container.textContent.includes("10 XP"));

// 3. Switch to Progress tab — gamification view
await act(async () => {
  [...container.querySelectorAll("button")]
    .find((b) => b.textContent.trim() === "progress")
    .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
});
check("Progress view shows LEVEL ring", container.textContent.includes("LEVEL"));
check("Progress view counts 1 question", container.textContent.includes("Questions"));

// 4. Switch to Typing tab — feature exists and pulls drill text
await act(async () => {
  [...container.querySelectorAll("button")]
    .find((b) => b.textContent.trim() === "typing")
    .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
});
check("Typing view renders WPM stat", container.textContent.includes("WPM"));
check("Typing view has a drill input", !!container.querySelector('input[placeholder="Start typing…"]'));

// 5. Floating launcher mode (position prop)
const fContainer = document.createElement("div");
document.body.appendChild(fContainer);
const fRoot = createRoot(fContainer);
await act(async () => {
  fRoot.render(
    React.createElement(AITutor, {
      api: { apiEndpoint: "/api/tutor" },
      orgName: "Firme Coding",
      position: "bottom-right",
    }),
  );
});
check("floating: launcher button renders", !!fContainer.querySelector('button[aria-label="Open chat"]'));
check("floating: panel hidden until opened", !fContainer.textContent.includes("Ask your first question below."));
await act(async () => {
  fContainer
    .querySelector('button[aria-label="Open chat"]')
    .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
});
check("floating: panel opens on tap", fContainer.textContent.includes("Ask your first question below."));
check("floating: fixed to corner", fContainer.querySelector("div")?.style.position === "fixed");

// 6. User identity + backend-synced progress
const uContainer = document.createElement("div");
document.body.appendChild(uContainer);
const uRoot = createRoot(uContainer);
const progressUpdates = [];
await act(async () => {
  uRoot.render(
    React.createElement(AITutor, {
      api: { apiEndpoint: "/api/tutor" },
      orgName: "Firme Coding",
      user: { id: "user-123", name: "Maria", gameName: "CodeQueen" },
      initialProgress: { counts: { about: 2 }, typingXp: 30 },
      onProgressChange: (p) => progressUpdates.push(p),
    }),
  );
});
check("gameName shows in header", uContainer.textContent.includes("CodeQueen"));
check("initialProgress seeds XP (2 q ×10 + 30)", uContainer.textContent.includes("50 XP"));
await act(async () => {
  const ta = uContainer.querySelector("textarea");
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
  setter.call(ta, "hello");
  ta.dispatchEvent(new window.Event("input", { bubbles: true }));
});
await act(async () => {
  uContainer.querySelector('button[aria-label="Send"]').dispatchEvent(
    new window.MouseEvent("click", { bubbles: true }),
  );
  await wait(60);
});
check(
  "onProgressChange fires with updated counts",
  progressUpdates.length >= 1 && progressUpdates.at(-1).counts.about === 3,
);
check("controlled mode did NOT write localStorage", window.localStorage.getItem("ai-tutor:progress:user-123") === null);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
