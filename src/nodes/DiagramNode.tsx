import { useEffect, useState } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { Handles } from "./Handles";
import type { DiagramNode as T } from "../types";

let seq = 0;
let ready: Promise<typeof import("mermaid").default> | null = null;

function mermaidReady() {
  ready ??= import("mermaid").then(({ default: m }) => {
    m.initialize({
      startOnLoad: false,
      theme: "base",
      fontFamily: "Inter Variable, Inter, system-ui, sans-serif",
      flowchart: { curve: "basis", padding: 16, nodeSpacing: 46, rankSpacing: 56, htmlLabels: true },
      sequence: { actorMargin: 60, messageMargin: 36, mirrorActors: false },
      themeVariables: {
        darkMode: true,
        background: "transparent",
        fontSize: "14px",
        primaryColor: "#16233f",
        primaryBorderColor: "#2563eb",
        primaryTextColor: "#e8eefc",
        secondaryColor: "#241c45",
        secondaryBorderColor: "#a78bfa",
        secondaryTextColor: "#efe9ff",
        tertiaryColor: "#0f1013",
        tertiaryBorderColor: "#2f3340",
        lineColor: "#7c8497",
        textColor: "#ededed",
        edgeLabelBackground: "#16171b",
        clusterBkg: "#101219",
        clusterBorder: "#2f3340",
        noteBkgColor: "#2b2410",
        noteBorderColor: "#fbbf24",
        noteTextColor: "#fff4d1",
        actorBkg: "#16233f",
        actorBorder: "#2563eb",
        actorTextColor: "#e8eefc",
        signalColor: "#a3a3a3",
        signalTextColor: "#ededed",
        // mindmap / pie branch colours
        cScale0: "#2563eb", cScale1: "#a78bfa", cScale2: "#22d3ee", cScale3: "#4ade80", cScale4: "#fbbf24", cScale5: "#f87171",
      },
      themeCSS: `
        .node rect, .node polygon, .node circle, .node ellipse, .node path { stroke-width: 1.5px; rx: 11px; ry: 11px; filter: drop-shadow(0 6px 16px rgba(0,0,0,.45)); }
        .cluster rect { rx: 14px; ry: 14px; stroke-dasharray: 5 4; }
        .cluster-label .nodeLabel, .cluster text { fill: #a3a3a3; color: #a3a3a3; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; font-weight: 600; }
        .flowchart-link, .edgePath .path { stroke-width: 1.8px; }
        .edgeLabel, .edgeLabel p { background-color: #16171b; color: #cfcfd2; font-size: 12px; border-radius: 6px; }
        .edgeLabel rect { opacity: 1; fill: #16171b; }
        .marker { fill: #7c8497; stroke: #7c8497; }
      `,
    });
    return m;
  });
  return ready;
}

export function DiagramCard({ id, data, selected }: NodeProps<T>) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    const timer = setTimeout(async () => {
      const renderId = `mmd-${++seq}`;
      try {
        const m = await mermaidReady();
        const out = await m.render(renderId, data.code);
        if (live) {
          setSvg(out.svg);
          setError("");
        }
      } catch (e) {
        document.getElementById(`d${renderId}`)?.remove(); // mermaid leaves its error graphic in <body>
        if (live) setError(e instanceof Error ? e.message.split("\n")[0] : "Invalid diagram");
      }
    }, 350);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [data.code, id]);

  return (
    <div className={`node diagram ${selected ? "is-selected" : ""}`}>
      <NodeResizer isVisible={selected} minWidth={240} minHeight={140} lineClassName="resize-line" handleClassName="resize-handle" />
      <Handles />
      <div className="node-head">
        <span className="eyebrow">Diagram</span>
        <span className="muted">{data.title}</span>
      </div>
      {error ? <pre className="diagram-error">{error}</pre> : null}
      <div className="diagram-body" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
