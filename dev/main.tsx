// Dev-only harness for previewing <AITutor /> in the browser.
// Not part of the published package (the package entry is src/index.ts).
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { AITutor, DEMO_CURRICULUM } from "../src/index";
import { FRENCH_QUARTER_CURRICULUM } from "../src/curriculum-french-quarter";

const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;

// With a key → talk to Claude directly. Without one → hit the mock /api/tutor
// endpoint served by dev/mock-tutor-plugin.ts so you can see the flow offline.
// (The mock only has canned replies for the demo modules; French Quarter modules
//  echo a generic line — switching still demonstrates the curriculum swap.)
const api = apiKey ? { apiKey } : { apiEndpoint: "/api/tutor" };

const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif';

const COURSES = {
  firme: { label: "Firme Coding (demo)", curriculum: DEMO_CURRICULUM, color: "#007AFF" },
  history: { label: "French Quarter History", curriculum: FRENCH_QUARTER_CURRICULUM, color: "#8B5CF6" },
} as const;

type CourseId = keyof typeof COURSES;

function DevApp() {
  const [courseId, setCourseId] = useState<CourseId>("firme");
  const course = COURSES[courseId];

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

      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        Course
      </label>
      <select
        value={courseId}
        onChange={(e) => setCourseId(e.target.value as CourseId)}
        style={{
          fontFamily: FONT,
          fontSize: 15,
          padding: "8px 12px",
          borderRadius: 10,
          border: "1px solid rgba(60,60,67,0.2)",
          background: "#fff",
          marginBottom: 12,
        }}
      >
        {Object.entries(COURSES).map(([id, c]) => (
          <option key={id} value={id}>
            {c.label}
          </option>
        ))}
      </select>

      <p style={{ color: "rgba(60,60,67,0.6)", maxWidth: 520 }}>
        Switch courses above — the floating tutor (bottom-right) remounts with that
        course's curriculum. Tap the chat bubble to open it.
      </p>

      <AITutor
        key={courseId}
        api={api}
        orgName={course.label}
        curriculum={course.curriculum}
        primaryColor={course.color}
        position="bottom-right"
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DevApp />
  </React.StrictMode>
);
