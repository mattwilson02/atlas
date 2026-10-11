#!/usr/bin/env node
// Read-only MCP server over the Atlas notes.
//
// Purpose: let an assistant read Matt's own notes so it can fact-check and critique them.
// It returns his words verbatim. It generates nothing, rewrites nothing, and has no way to write:
// the only filesystem call is readFile on the saved copy, and every tool is annotated read-only.
//
//   node server.mjs                       reads ~/.local/share/atlas-data/atlas.json
//   ATLAS_DATA=/path/to/atlas.json node server.mjs
//
// The saved copy is written by the Atlas service as you edit, so this sees the notes as of your last save.
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DATA = process.env.ATLAS_DATA ?? join(homedir(), ".local/share/atlas-data/atlas.json");

const INSTRUCTIONS = `These are the user's OWN study notes (atomic notes from reading, with diagrams). The server is read-only.

How to use them:
- The job is to FACT-CHECK and CRITIQUE what the user wrote. Do not write, rewrite, extend or "improve" their notes, and do not offer replacement text for them.
- Quote the note's own words when you point at a claim. Say which note (title) and which field.
- Fact-check: say whether each claim is correct, incomplete or wrong, and why. Give a source or the standard term where you can; say plainly when you are unsure rather than guessing.
- Critique: look for vague wording, claims that overreach, trade-offs missing a side, and "use when / avoid when" that do not follow from the how-it-works. Point at the gap and ask a question; do not fill it in for them.
- "Still unclear" and "Recall questions" are the user's own. Do not answer the recall questions unprompted; they are for self-testing.
- Confidence (1 to 5) is the user's own estimate. Use it to decide where to look hardest, not to overrule it.`;

// ---- data ---------------------------------------------------------------------------------

async function load() {
  let raw;
  try {
    raw = await readFile(DATA, "utf8");
  } catch (e) {
    throw new Error(
      `Cannot read the Atlas notes at ${DATA} (${e.code ?? e.message}). The file appears once the Atlas app has saved at least once; ` +
        `open http://localhost:5181 and make an edit, or set ATLAS_DATA to a different file.`,
    );
  }
  const d = JSON.parse(raw);
  if (d?.app !== "atlas" || !Array.isArray(d.boards) || !Array.isArray(d.folders)) throw new Error(`${DATA} is not an Atlas export.`);
  return d;
}

const NOTE_FIELDS = [
  ["sentence", "In one sentence"],
  ["problem", "Problem it solves"],
  ["how", "How it works"],
  ["gains", "Gains"],
  ["costs", "Costs"],
  ["useWhen", "Use when"],
  ["avoidWhen", "Avoid when"],
  ["example", "Real examples"],
  ["recall", "Recall questions"],
  ["unclear", "Still unclear"],
];

/** Flatten to nodes that know where they live. */
function index(d) {
  const folder = new Map(d.folders.map((f) => [f.id, f]));
  const nodes = [];
  for (const b of d.boards) {
    for (const n of b.nodes ?? []) nodes.push({ node: n, board: b, resource: folder.get(b.folderId) });
  }
  return { folder, nodes, byId: new Map(nodes.map((x) => [x.node.id, x])) };
}

const titleOf = (n) =>
  n.type === "note" ? n.data.title || "(untitled note)" : n.type === "scratch" ? `Scratch: ${(n.data.text ?? "").split("\n")[0].slice(0, 60)}` : n.data.title ?? n.data.text ?? n.type;

const where = (x) => `${x.resource?.name ?? "?"} › ${x.board.name}`;

/** id, exact title, then a unique substring. Throws with the candidates when it cannot decide. */
function findNode(ix, ref, types) {
  const pool = ix.nodes.filter((x) => !types || types.includes(x.node.type));
  const q = ref.trim().toLowerCase();
  const byId = pool.find((x) => x.node.id === ref.trim());
  if (byId) return byId;
  const exact = pool.filter((x) => titleOf(x.node).toLowerCase() === q);
  if (exact.length === 1) return exact[0];
  const pick = exact.length ? exact : pool.filter((x) => titleOf(x.node).toLowerCase().includes(q));
  if (pick.length === 1) return pick[0];
  if (pick.length === 0) throw new Error(`Nothing matches "${ref}". Try search, or list_notes.`);
  throw new Error(`"${ref}" matches ${pick.length} items; use an id:\n` + pick.map((x) => `- ${x.node.id}  ${titleOf(x.node)}  (${where(x)})`).join("\n"));
}

function findBoard(d, ref) {
  const q = ref.trim().toLowerCase();
  const hit =
    d.boards.find((b) => b.id === ref.trim()) ??
    d.boards.filter((b) => b.name.toLowerCase() === q)[0] ??
    (() => {
      const m = d.boards.filter((b) => b.name.toLowerCase().includes(q));
      if (m.length > 1) throw new Error(`"${ref}" matches several boards: ${m.map((b) => `${b.name} [${b.id}]`).join(", ")}`);
      return m[0];
    })();
  if (!hit) throw new Error(`No board matches "${ref}". Use list_boards.`);
  return hit;
}

function resourceBoards(d, resource) {
  if (!resource) return d.boards;
  const q = resource.trim().toLowerCase();
  const f = d.folders.filter((x) => x.id === resource || x.name.toLowerCase().includes(q));
  if (!f.length) throw new Error(`No resource matches "${resource}". Use list_resources.`);
  return d.boards.filter((b) => f.some((x) => x.id === b.folderId));
}

function renderNote(x, d, ix) {
  const { node: n } = x;
  const out = [`# ${titleOf(n)}`, `id: ${n.id} · confidence ${n.data.confidence}/5 · ${where(x)}`, ""];
  if (n.data.confidence == null) out.splice(1, 1, `id: ${n.id} · ${where(x)}`);
  for (const [key, label] of NOTE_FIELDS) {
    const v = (n.data[key] ?? "").trim();
    out.push(`## ${label}`, v || "(empty)", "");
  }
  const links = (x.board.edges ?? []).filter((e) => e.source === n.id || e.target === n.id);
  out.push("## Links on the board");
  if (!links.length) out.push("(none)");
  for (const e of links) {
    const other = ix.byId.get(e.source === n.id ? e.target : e.source);
    const arrow = e.source === n.id ? "→" : "←";
    out.push(`- ${arrow} ${other ? titleOf(other.node) : "(missing)"} [${other?.node.id ?? "?"}]${e.label ? `, labelled "${e.label}"` : ""}`);
  }
  return out.join("\n");
}

function renderDiagram(x) {
  const { node: n } = x;
  const out = [`# Diagram: ${n.data.title}`, `id: ${n.id} · ${where(x)}`, "", "## Mermaid source", "```mermaid", n.data.code, "```"];
  const m = n.data.model;
  if (m) {
    const name = (id) => m.nodes.find((s) => s.id === id)?.label ?? id;
    out.push("", "## Steps");
    for (const s of m.nodes) out.push(`- ${s.label}${s.group ? ` (group: ${s.group})` : ""}`);
    out.push("", "## Connections");
    for (const e of m.edges) out.push(`- ${name(e.from)} ${e.arrow === "both" ? "↔" : e.arrow === "none" ? "—" : "→"} ${name(e.to)}${e.label ? `: "${e.label}"` : ""}`);
  }
  return out.join("\n");
}

const text = (s) => ({ content: [{ type: "text", text: s }] });
const wrap = (fn) => async (args) => {
  try {
    return text(await fn(args ?? {}));
  } catch (e) {
    return { isError: true, content: [{ type: "text", text: e.message }] };
  }
};

// ---- server -------------------------------------------------------------------------------

const server = new McpServer({ name: "atlas-notes", version: "0.1.0" }, { instructions: INSTRUCTIONS });
const ro = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

server.registerTool(
  "list_resources",
  { title: "List resources", description: "The user's resources (books, courses, videos) with how many boards and notes each holds.", inputSchema: {}, annotations: ro },
  wrap(async () => {
    const d = await load();
    const ix = index(d);
    return d.folders
      .map((f) => {
        const bs = d.boards.filter((b) => b.folderId === f.id);
        const notes = ix.nodes.filter((x) => x.resource?.id === f.id && x.node.type === "note").length;
        return `- ${f.name} [${f.kind}] · ${bs.length} board(s), ${notes} note(s)`;
      })
      .join("\n");
  }),
);

server.registerTool(
  "list_boards",
  {
    title: "List boards",
    description: "Boards with their ids and a count of what is on each. Optionally limited to one resource (name or id).",
    inputSchema: { resource: z.string().optional().describe("Resource name (partial is fine) or id") },
    annotations: ro,
  },
  wrap(async ({ resource }) => {
    const d = await load();
    return resourceBoards(d, resource)
      .map((b) => {
        const c = {};
        for (const n of b.nodes) c[n.type] = (c[n.type] ?? 0) + 1;
        const f = d.folders.find((x) => x.id === b.folderId);
        return `- ${b.name} [${b.id}] · ${f?.name ?? "?"} · ${Object.entries(c).map(([k, v]) => `${v} ${k}`).join(", ") || "empty"}`;
      })
      .join("\n");
  }),
);

server.registerTool(
  "list_notes",
  {
    title: "List notes",
    description:
      "One line per atomic note: title, confidence, location, and whether it has an open 'Still unclear'. Filters narrow it; none of them change anything. Good for choosing which notes to check first.",
    inputSchema: {
      resource: z.string().optional(),
      board: z.string().optional().describe("Board name or id"),
      max_confidence: z.number().int().min(1).max(5).optional().describe("Only notes at or below this confidence"),
      has_unclear: z.boolean().optional().describe("Only notes whose 'Still unclear' is filled in"),
    },
    annotations: ro,
  },
  wrap(async ({ resource, board, max_confidence, has_unclear }) => {
    const d = await load();
    const ix = index(d);
    const boardIds = new Set((board ? [findBoard(d, board)] : resourceBoards(d, resource)).map((b) => b.id));
    const rows = ix.nodes.filter(
      (x) =>
        x.node.type === "note" &&
        boardIds.has(x.board.id) &&
        (max_confidence == null || x.node.data.confidence <= max_confidence) &&
        (has_unclear == null || !!(x.node.data.unclear ?? "").trim() === has_unclear),
    );
    if (!rows.length) return "No notes match.";
    return rows
      .map((x) => `- ${titleOf(x.node)} [${x.node.id}] · confidence ${x.node.data.confidence}/5${(x.node.data.unclear ?? "").trim() ? " · has open question" : ""} · ${where(x)}`)
      .join("\n");
  }),
);

server.registerTool(
  "get_note",
  {
    title: "Get a note",
    description: "One atomic note, every field verbatim in the Study OS template, plus what it is linked to on its board (with the user's link labels). Reference by id, exact title, or a unique part of the title.",
    inputSchema: { note: z.string().describe("Note id or title") },
    annotations: ro,
  },
  wrap(async ({ note }) => {
    const d = await load();
    const ix = index(d);
    return renderNote(findNode(ix, note, ["note"]), d, ix);
  }),
);

server.registerTool(
  "get_board",
  {
    title: "Get a board",
    description: "Everything on one board, verbatim: every note in full, scratch text, labels, diagram sources, and the links between them. Use for a whole-topic check, e.g. whether two notes contradict each other.",
    inputSchema: { board: z.string().describe("Board name or id") },
    annotations: ro,
  },
  wrap(async ({ board }) => {
    const d = await load();
    const ix = index(d);
    const b = findBoard(d, board);
    const f = d.folders.find((x) => x.id === b.folderId);
    const parts = [`# Board: ${b.name}`, `resource: ${f?.name ?? "?"} · id: ${b.id}`, ""];
    for (const n of b.nodes) {
      const x = ix.byId.get(n.id);
      if (n.type === "note") parts.push(renderNote(x, d, ix));
      else if (n.type === "diagram") parts.push(renderDiagram(x));
      else if (n.type === "scratch") parts.push(`# Scratch [${n.id}]\n${(n.data.text ?? "").trim() || "(empty)"}`);
      else if (n.type === "label") parts.push(`# Label [${n.id}]: ${n.data.text}`);
      else if (n.type === "board") parts.push(`# Sub-board link [${n.id}]: ${n.data.title}${d.boards.find((x2) => x2.id === n.data.boardId) ? ` → ${d.boards.find((x2) => x2.id === n.data.boardId).name}` : ""}`);
      parts.push("\n---\n");
    }
    return parts.join("\n");
  }),
);

server.registerTool(
  "get_diagram",
  {
    title: "Get a diagram",
    description: "A diagram's Mermaid source and, for flowcharts built in the visual editor, its steps and connections in plain words, so the relationships can be checked.",
    inputSchema: { diagram: z.string().describe("Diagram id or title") },
    annotations: ro,
  },
  wrap(async ({ diagram }) => {
    const d = await load();
    return renderDiagram(findNode(index(d), diagram, ["diagram"]));
  }),
);

server.registerTool(
  "search",
  {
    title: "Search the notes",
    description: "Case-insensitive text search across note fields, scratch text, labels and diagram text. Returns where it matched, with the user's own words around it.",
    inputSchema: { query: z.string().min(1), limit: z.number().int().min(1).max(50).optional() },
    annotations: ro,
  },
  wrap(async ({ query, limit = 20 }) => {
    const d = await load();
    const ix = index(d);
    const q = query.toLowerCase();
    const hits = [];
    const snip = (s) => {
      const i = s.toLowerCase().indexOf(q);
      const a = Math.max(0, i - 60);
      return (a > 0 ? "…" : "") + s.slice(a, i + q.length + 80).replace(/\s+/g, " ") + (i + q.length + 80 < s.length ? "…" : "");
    };
    for (const x of ix.nodes) {
      const n = x.node;
      const fields =
        n.type === "note"
          ? [["title", n.data.title], ...NOTE_FIELDS.map(([k, l]) => [l, n.data[k]])]
          : n.type === "scratch"
            ? [["scratch", n.data.text]]
            : n.type === "diagram"
              ? [["diagram", `${n.data.title}\n${n.data.code}`]]
              : [["text", n.data.text ?? n.data.title]];
      for (const [label, v] of fields) {
        if (typeof v === "string" && v.toLowerCase().includes(q)) hits.push(`- ${titleOf(n)} [${n.id}] › ${label} · ${where(x)}\n  ${snip(v)}`);
      }
    }
    return hits.length ? `${hits.length} match(es)${hits.length > limit ? `, showing ${limit}` : ""}:\n` + hits.slice(0, limit).join("\n") : `No matches for "${query}".`;
  }),
);

await server.connect(new StdioServerTransport());
