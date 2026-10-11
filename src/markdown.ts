import { emptyNote, type NoteData } from "./types";

const clean = (s: string) =>
  s
    .replace(/<mention-page[^>]*\/>/g, "")
    .replace(/\*\*/g, "")
    .trim();

// A line like "Gains: foo" / "**Gains:** foo" -> "foo". Returns null if no match.
function labelled(text: string, label: string): string | null {
  const m = clean(text).match(new RegExp(`^${label}\\s*:[ \\t]*(.*)$`, "im"));
  return m ? m[1].trim() : null;
}

const HEADINGS: Record<string, keyof NoteData | "tradeoffs" | "usage" | "links"> = {
  "in one sentence": "sentence",
  "problem it solves": "problem",
  "how it works": "how",
  "trade-offs": "tradeoffs",
  "use when / avoid when": "usage",
  "real examples": "example",
  links: "links",
  "recall questions": "recall",
  "still unclear": "unclear",
};

/** True when the text follows the Study OS atomic-note template. */
export const looksStructured = (text: string) => /^##\s+in one sentence/im.test(text);

/** Parse a Study OS atomic note (Notion markdown export / copy) into note fields. */
export function parseNote(text: string, fallbackTitle = ""): NoteData {
  const note = emptyNote();
  const lines = text.replace(/\r/g, "").split("\n");
  const titleLine = lines.find((l) => /^#\s+/.test(l));
  note.title = titleLine ? titleLine.replace(/^#\s+/, "").trim() : fallbackTitle;

  const sections: Record<string, string> = {};
  let current: string | null = null;
  for (const line of lines) {
    const h = line.match(/^##\s+(.*)$/);
    if (h) {
      current = h[1].trim().toLowerCase();
      sections[current] = "";
    } else if (current) {
      sections[current] += line + "\n";
    }
  }

  for (const [heading, body] of Object.entries(sections)) {
    const key = HEADINGS[heading];
    const value = clean(body);
    if (!key || !value) continue;
    if (key === "tradeoffs") {
      note.gains = labelled(body, "Gains") ?? "";
      note.costs = labelled(body, "Costs") ?? "";
      if (!note.gains && !note.costs) note.gains = value;
    } else if (key === "usage") {
      note.useWhen = labelled(body, "Use when") ?? "";
      note.avoidWhen = labelled(body, "Avoid when") ?? "";
    } else if (key === "links") {
      // mentions don't survive; nothing to keep
    } else {
      note[key] = value as never;
    }
  }
  return note;
}

/** Free dictation / scratch text -> a note: first line is the title, rest is the sentence. */
export function noteFromScratch(text: string): NoteData {
  if (looksStructured(text)) return parseNote(text);
  const [first = "", ...rest] = text.trim().split("\n");
  const note = emptyNote();
  note.title = first.replace(/^#+\s*/, "").slice(0, 120);
  note.sentence = rest.join("\n").trim();
  return note;
}

/** Back to the Study OS template, ready to paste into Notion. */
export function noteToMarkdown(n: NoteData): string {
  const out = [`# ${n.title}`, "", "## In one sentence", n.sentence];
  out.push("", "## Problem it solves", n.problem);
  out.push("", "## How it works", n.how);
  out.push("", "## Trade-offs", `**Gains:** ${n.gains}`, `**Costs:** ${n.costs}`);
  out.push("", "## Use when / avoid when", `**Use when:** ${n.useWhen}`, `**Avoid when:** ${n.avoidWhen}`);
  out.push("", "## Real examples", n.example);
  out.push("", "## Recall questions", n.recall);
  out.push("", "## Still unclear", n.unclear);
  return out.join("\n") + "\n";
}
