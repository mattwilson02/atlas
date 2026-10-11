// Structured flowchart model behind the no-code diagram editor. The Mermaid text is generated from it.

export type Shape = "rect" | "round" | "pill" | "db" | "diamond" | "io" | "circle";
export type Tone = "plain" | "app" | "store" | "actor" | "out" | "risk";
export type LineStyle = "solid" | "thick" | "dotted";
export type Arrow = "one" | "both" | "none";

export type FlowNode = { id: string; label: string; shape: Shape; tone: Tone; group: string };
export type FlowEdge = { id: string; from: string; to: string; label: string; line: LineStyle; arrow: Arrow };
export type FlowModel = { dir: "TB" | "LR"; nodes: FlowNode[]; edges: FlowEdge[] };

export const SHAPES: { value: Shape; label: string }[] = [
  { value: "rect", label: "Box" },
  { value: "round", label: "Rounded" },
  { value: "pill", label: "Pill" },
  { value: "db", label: "Database" },
  { value: "diamond", label: "Decision" },
  { value: "io", label: "Input / output" },
  { value: "circle", label: "Circle" },
];

export const TONES: { value: Tone; label: string; colour: string }[] = [
  { value: "plain", label: "Plain", colour: "#7c8497" },
  { value: "app", label: "Blue", colour: "#2563eb" },
  { value: "store", label: "Violet", colour: "#a78bfa" },
  { value: "actor", label: "Green", colour: "#4ade80" },
  { value: "out", label: "Amber", colour: "#fbbf24" },
  { value: "risk", label: "Red", colour: "#f87171" },
];

const CLASS_DEFS: Record<Exclude<Tone, "plain">, string> = {
  app: "fill:#16233f,stroke:#2563eb,stroke-width:1.5px,color:#e8eefc",
  store: "fill:#241c45,stroke:#a78bfa,stroke-width:1.5px,color:#efe9ff",
  actor: "fill:#0e2a22,stroke:#4ade80,stroke-width:1.5px,color:#e3fbe9",
  out: "fill:#2b2410,stroke:#fbbf24,stroke-width:1.5px,color:#fff4d1",
  risk: "fill:#2e1517,stroke:#f87171,stroke-width:1.5px,color:#ffe4e4",
};

export const uid = () => Math.random().toString(36).slice(2, 8);

const q = (s: string) => `"${s.replace(/"/g, "#quot;") || " "}"`;

const SHAPE_SYNTAX: Record<Shape, (l: string) => string> = {
  rect: (l) => `[${q(l)}]`,
  round: (l) => `(${q(l)})`,
  pill: (l) => `([${q(l)}])`,
  db: (l) => `[(${q(l)})]`,
  diamond: (l) => `{${q(l)}}`,
  io: (l) => `[/${q(l)}/]`,
  circle: (l) => `((${q(l)}))`,
};

const ARROWS: Record<LineStyle, Record<Arrow, string>> = {
  solid: { one: "-->", both: "<-->", none: "---" },
  thick: { one: "==>", both: "<==>", none: "===" },
  dotted: { one: "-.->", both: "<-.->", none: "-.-" },
};

export function toMermaid(m: FlowModel): string {
  if (m.nodes.length === 0) return `flowchart ${m.dir}\n  start["Add a step to begin"]`;
  const ref = new Map(m.nodes.map((n, i) => [n.id, `n${i}`]));
  const out = [`flowchart ${m.dir}`];
  const decl = (n: FlowNode) => `${ref.get(n.id)}${SHAPE_SYNTAX[n.shape](n.label)}`;

  m.nodes.filter((n) => !n.group.trim()).forEach((n) => out.push(`  ${decl(n)}`));
  const groups = [...new Set(m.nodes.map((n) => n.group.trim()).filter(Boolean))];
  groups.forEach((g, i) => {
    out.push(`  subgraph g${i}[${q(` ${g} `)}]`);
    m.nodes.filter((n) => n.group.trim() === g).forEach((n) => out.push(`    ${decl(n)}`));
    out.push("  end");
  });

  for (const e of m.edges) {
    const a = ref.get(e.from);
    const b = ref.get(e.to);
    if (!a || !b) continue;
    const arrow = ARROWS[e.line][e.arrow];
    out.push(`  ${a} ${arrow}${e.label.trim() ? `|${q(e.label.trim())}|` : ""} ${b}`);
  }

  const used = new Set(m.nodes.map((n) => n.tone).filter((t): t is Exclude<Tone, "plain"> => t !== "plain"));
  for (const t of used) {
    out.push(`  classDef ${t} ${CLASS_DEFS[t]}`);
    out.push(`  class ${m.nodes.filter((n) => n.tone === t).map((n) => ref.get(n.id)).join(",")} ${t}`);
  }
  return out.join("\n");
}

const node = (id: string, label: string, shape: Shape, tone: Tone, group = ""): FlowNode => ({ id, label, shape, tone, group });
const edge = (id: string, from: string, to: string, label = "", line: LineStyle = "solid", arrow: Arrow = "one"): FlowEdge => ({
  id, from, to, label, line, arrow,
});

export const blankModel = (): FlowModel => ({
  dir: "LR",
  nodes: [node("a", "Start", "pill", "actor"), node("b", "Do the thing", "rect", "app"), node("c", "Result", "rect", "out")],
  edges: [edge("e1", "a", "b"), edge("e2", "b", "c")],
});

/** Ready-made flowcharts: pick one, then edit it with the form. */
export const flowTemplates: Record<string, () => FlowModel> = {
  "Operational vs analytical": () => ({
    dir: "TB",
    nodes: [
      node("users", "Users", "pill", "actor", "Operational · OLTP"),
      node("app", "Application", "rect", "app", "Operational · OLTP"),
      node("oltp", "Operational DB", "db", "store", "Operational · OLTP"),
      node("wh", "Data warehouse", "db", "store", "Analytical · OLAP"),
      node("rep", "Reports & dashboards", "io", "out", "Analytical · OLAP"),
      node("an", "Analysts", "pill", "actor", "Analytical · OLAP"),
    ],
    edges: [
      edge("e1", "users", "app", "requests"),
      edge("e2", "app", "oltp", "read / write by key", "solid", "both"),
      edge("e3", "oltp", "wh", "ETL / change stream", "thick"),
      edge("e4", "wh", "rep", "aggregate queries"),
      edge("e5", "rep", "an"),
    ],
  }),
  "Simple flow": blankModel,
  "Decision": () => ({
    dir: "TB",
    nodes: [
      node("s", "Start", "pill", "actor"),
      node("q", "Is it true?", "diamond", "plain"),
      node("y", "Yes path", "rect", "app"),
      node("n", "No path", "rect", "risk"),
      node("e", "Done", "pill", "out"),
    ],
    edges: [edge("e1", "s", "q"), edge("e2", "q", "y", "yes"), edge("e3", "q", "n", "no", "dotted"), edge("e4", "y", "e"), edge("e5", "n", "e")],
  }),
  "Client · server · database": () => ({
    dir: "LR",
    nodes: [node("c", "Client", "pill", "actor"), node("s", "Server", "rect", "app"), node("d", "Database", "db", "store")],
    edges: [edge("e1", "c", "s", "request"), edge("e2", "s", "d", "query", "solid", "both")],
  }),
};
