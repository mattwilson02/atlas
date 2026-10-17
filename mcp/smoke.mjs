// Drives the server over stdio like an MCP client would, against a throwaway fixture.
//   pnpm smoke
import { mkdtemp, writeFile, stat, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const here = dirname(fileURLToPath(import.meta.url));
const note = (id, title, over = {}) => ({
  id, type: "note", position: { x: 0, y: 0 },
  data: { title, sentence: `${title} in one sentence`, problem: "", how: "", gains: "fast reads", costs: "", useWhen: "", avoidWhen: "", example: "", recall: "1. Why?", unclear: "", confidence: 3, ...over },
});
const fixture = {
  app: "atlas", version: 1, updatedAt: 1,
  folders: [{ id: "f1", name: "Designing Data-Intensive Applications", kind: "book" }],
  boards: [{
    id: "b1", folderId: "f1", name: "Ch 1",
    nodes: [
      note("n1", "Operational Systems (OLTP)", { confidence: 2, unclear: "tradeoffs tbd" }),
      note("n2", "Analytical Systems (OLAP)", { confidence: 5 }),
      { id: "x1", type: "distinction", position: { x: 0, y: 0 }, data: { xName: "System of record", yName: "Derived data", question: "Was this first written here, or computed from elsewhere?", x: "source of truth", y: "rebuildable cache", why: "reads vs correctness", together: "Postgres plus a Redis cache", recall: "Which one do you back up?", confidence: 4 } },
      { id: "d1", type: "diagram", position: { x: 0, y: 0 }, data: { title: "Flow", code: "flowchart LR\n a-->b", model: { dir: "LR", nodes: [{ id: "a", label: "App", group: "" }, { id: "b", label: "DB", group: "" }], edges: [{ id: "e", from: "a", to: "b", label: "queries", arrow: "one" }] } } },
      { id: "s1", type: "scratch", position: { x: 0, y: 0 }, data: { text: "warehouse freshness?" } },
    ],
    edges: [{ id: "e1", source: "n1", target: "n2", label: "ETL copies into" }],
  }],
};

const dir = await mkdtemp(join(tmpdir(), "atlas-mcp-"));
const file = join(dir, "atlas.json");
await writeFile(file, JSON.stringify(fixture));
const before = { mtime: (await stat(file)).mtimeMs, body: await readFile(file, "utf8") };

const client = new Client({ name: "smoke", version: "0" });
await client.connect(new StdioClientTransport({ command: "node", args: [join(here, "server.mjs")], env: { ...process.env, ATLAS_DATA: file } }));

let failed = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + detail}`); if (!ok) failed++; };
const call = async (name, args = {}) => { const r = await client.callTool({ name, arguments: args }); return { err: !!r.isError, text: r.content.map((c) => c.text).join("\n") }; };

const tools = (await client.listTools()).tools;
check("exposes the 7 expected tools", tools.length === 7, tools.map((t) => t.name).join(","));
check("every tool is marked read-only", tools.every((t) => t.annotations?.readOnlyHint === true && t.annotations?.destructiveHint === false));
check("no tool name suggests writing", !tools.some((t) => /create|update|delete|write|add|edit|set|save|generate|rewrite/i.test(t.name)), tools.map((t) => t.name).join(","));
check("instructions forbid rewriting the notes", /Do not write, rewrite/.test(client.getInstructions() ?? ""));

let r = await call("list_resources");
check("list_resources", /Designing Data-Intensive Applications \[book\] · 1 board\(s\), 3 note\(s\)/.test(r.text), r.text);
r = await call("list_notes", { max_confidence: 2 });
check("list_notes filters by confidence", /OLTP/.test(r.text) && !/OLAP/.test(r.text) && /open question/.test(r.text), r.text);
r = await call("list_notes", { has_unclear: true });
check("list_notes filters by open question", /OLTP/.test(r.text) && !/OLAP/.test(r.text), r.text);
r = await call("get_note", { note: "oltp" });
check("get_note by partial title, verbatim + link label", /Operational Systems \(OLTP\) in one sentence/.test(r.text) && /→ Analytical Systems \(OLAP\).*labelled "ETL copies into"/.test(r.text), r.text);
r = await call("get_note", { note: "n2" });
check("get_note by id shows the reverse link", /← Operational Systems/.test(r.text), r.text);
r = await call("get_note", { note: "Systems" });
check("ambiguous title is refused with candidates, not guessed", r.err && /matches 2/.test(r.text) && /n1/.test(r.text), r.text);
r = await call("get_note", { note: "system of record" });
check("get_note finds a distinction and names its sides", /# System of record vs Derived data/.test(r.text) && /## System of record\nsource of truth/.test(r.text) && /## The question that separates them/.test(r.text), r.text);
r = await call("search", { query: "redis" });
check("search reaches distinction fields", /System of record vs Derived data.*Where you see both together/.test(r.text), r.text);
r = await call("get_note", { note: "nonexistent" });
check("unknown note is a clear error", r.err && /Nothing matches/.test(r.text), r.text);
r = await call("get_board", { board: "ch 1" });
check("get_board returns everything verbatim", /OLTP/.test(r.text) && /OLAP/.test(r.text) && /Mermaid source/.test(r.text) && /warehouse freshness\?/.test(r.text), r.text.slice(0, 200));
r = await call("get_diagram", { diagram: "Flow" });
check("get_diagram explains connections in words", /App → DB: "queries"/.test(r.text), r.text);
r = await call("search", { query: "FRESHNESS" });
check("search is case-insensitive and finds scratch", /Scratch/.test(r.text) && /warehouse freshness/.test(r.text), r.text);
r = await call("search", { query: "zzzz" });
check("search with no hit says so", /No matches/.test(r.text));

const after = { mtime: (await stat(file)).mtimeMs, body: await readFile(file, "utf8") };
check("data file untouched (same bytes, same mtime)", after.body === before.body && after.mtime === before.mtime);

await client.close();

// a missing file must give a helpful message, not a crash
const c2 = new Client({ name: "smoke2", version: "0" });
await c2.connect(new StdioClientTransport({ command: "node", args: [join(here, "server.mjs")], env: { ...process.env, ATLAS_DATA: join(dir, "nope.json") } }));
const m = await c2.callTool({ name: "list_resources", arguments: {} });
check("missing data file gives a helpful error", m.isError && /Cannot read the Atlas notes/.test(m.content[0].text), m.content[0].text);
await c2.close();

console.log(failed ? `\n${failed} FAILED` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
