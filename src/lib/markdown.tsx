// Tiny, dependency-free Markdown renderer for assistant replies.
// Supports the subset the tutor actually produces: headings, bold, italics,
// inline code, code fences, ordered/unordered lists, links, and images.
// Builds React elements directly — no dangerouslySetInnerHTML, so it's safe.

import React from "react";

const INLINE =
  /(!\[([^\]]*)\]\(([^)]+)\))|(\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(_([^_]+)_)|(`([^`]+)`)/;

function inline(text: string, accent: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let rest = text;
  let n = 0;
  while (rest.length) {
    const m = rest.match(INLINE);
    if (!m || m.index === undefined) {
      out.push(rest);
      break;
    }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const key = `${keyBase}-${n++}`;
    if (m[1]) {
      out.push(
        <img
          key={key}
          src={m[3]}
          alt={m[2]}
          style={{ maxWidth: "100%", borderRadius: 12, margin: "6px 0", display: "block" }}
        />,
      );
    } else if (m[4]) {
      out.push(
        <a key={key} href={m[6]} target="_blank" rel="noreferrer" style={{ color: accent, textDecoration: "underline" }}>
          {m[5]}
        </a>,
      );
    } else if (m[7]) {
      out.push(<strong key={key}>{m[8]}</strong>);
    } else if (m[9]) {
      out.push(<em key={key}>{m[10]}</em>);
    } else if (m[11]) {
      out.push(<em key={key}>{m[12]}</em>);
    } else if (m[13]) {
      out.push(
        <code
          key={key}
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: "0.9em",
            background: "rgba(0,0,0,0.06)",
            padding: "1px 5px",
            borderRadius: 5,
          }}
        >
          {m[14]}
        </code>,
      );
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

export function Markdown({ text, accent }: { text: string; accent: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push(
        <pre
          key={key++}
          style={{
            background: "rgba(0,0,0,0.06)",
            borderRadius: 10,
            padding: "10px 12px",
            overflowX: "auto",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 13,
            margin: "6px 0",
          }}
        >
          <code>{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Heading (#, ##, ###)
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      blocks.push(
        <div
          key={key++}
          style={{ fontWeight: 700, fontSize: lvl === 1 ? 18 : lvl === 2 ? 16 : 15, margin: "10px 0 4px" }}
        >
          {inline(h[2], accent, `h${key}`)}
        </div>,
      );
      i++;
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} style={{ margin: "6px 0", paddingLeft: 20 }}>
          {items.map((it, j) => (
            <li key={j} style={{ margin: "3px 0", lineHeight: 1.45 }}>
              {inline(it, accent, `ul${key}-${j}`)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={key++} style={{ margin: "6px 0", paddingLeft: 22 }}>
          {items.map((it, j) => (
            <li key={j} style={{ margin: "3px 0", lineHeight: 1.45 }}>
              {inline(it, accent, `ol${key}-${j}`)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph — gather consecutive plain lines
    const para: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith("```")
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} style={{ margin: "5px 0", lineHeight: 1.5 }}>
        {inline(para.join(" "), accent, `p${key}`)}
      </p>,
    );
  }

  return <>{blocks}</>;
}

/** Strip markdown to plain text (for speech synthesis / accessibility). */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`#>]/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}
