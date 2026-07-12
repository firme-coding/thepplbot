// Dev-only harness for previewing <AITutor /> in the browser.
// Not part of the published package (the package entry is src/index.ts).
import React from "react";
import { createRoot } from "react-dom/client";
import { AITutor } from "../src/index";

const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;

// With a key → talk to Claude directly. Without one → hit the mock /api/tutor
// endpoint served by dev/mock-tutor-plugin.ts so you can see the flow offline.
const api = apiKey ? { apiKey } : { apiEndpoint: "/api/tutor" };

const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif';

function DevApp() {
  return (
    <div
      style={{
        minHeight: "100%",
        padding: 24,
        fontFamily: FONT,
        color: "#1C1C1E",
        background: "linear-gradient(180deg,#f5f6f8,#eceef2)",
      }}
    >
      {!apiKey && (
        <p style={{ color: "#007AFF", fontSize: 13, maxWidth: 520 }}>
          No <code>VITE_ANTHROPIC_API_KEY</code> set — running against the{" "}
          <strong>mock</strong> endpoint. Add a key to <code>.env.local</code> and
          restart to talk to Claude for real.
        </p>
      )}
      <h1 style={{ fontSize: 28, letterSpacing: "-0.02em" }}>Demo page</h1>
      <p style={{ color: "rgba(60,60,67,0.6)", maxWidth: 520 }}>
        The tutor is docked as a floating launcher in the bottom-right corner. Tap
        the chat bubble to open it. Change <code>position</code> to try other
        corners.
      </p>

      <AITutor api={api} orgName="Firme Coding" position="bottom-right" />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DevApp />
  </React.StrictMode>
);
