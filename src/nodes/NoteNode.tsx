import type { NodeProps } from "@xyflow/react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Handles } from "./Handles";
import { useAtlas } from "../store";
import type { NoteNode as T } from "../types";

function Section({ label, text, tone }: { label: string; text: string; tone?: "gain" | "cost" | "warn" }) {
  if (!text) return null;
  return (
    <section className={`sec ${tone ?? ""}`}>
      <b>{label}</b>
      <p>{text}</p>
    </section>
  );
}

export function NoteCard({ id, data, selected }: NodeProps<T>) {
  const update = useAtlas((s) => s.updateNodeData);
  const size = data.size ?? "summary";
  const set = (next: typeof size) => update(id, { size: next });
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className={`node note size-${size} ${selected ? "is-selected" : ""}`}>
      <Handles />
      <div className="node-head">
        <span className="eyebrow">Concept</span>
        <span className="head-right">
          <span className="confidence" title={`Confidence ${data.confidence}/5`}>
            {[1, 2, 3, 4, 5].map((i) => (
              <i key={i} className={i <= data.confidence ? "on" : ""} />
            ))}
          </span>
          <button
            className="node-btn nodrag"
            title={size === "compact" ? "Show summary" : "Collapse to title"}
            onClick={(e) => (stop(e), set(size === "compact" ? "summary" : "compact"))}
          >
            <Minimize2 size={13} />
          </button>
          <button
            className="node-btn nodrag"
            title={size === "full" ? "Back to summary" : "Expand every field"}
            onClick={(e) => (stop(e), set(size === "full" ? "summary" : "full"))}
          >
            <Maximize2 size={13} />
          </button>
        </span>
      </div>

      <h3>{data.title || "Untitled note"}</h3>

      {size === "summary" && (
        <>
          {data.sentence && <p className="sentence">{data.sentence}</p>}
          {(data.gains || data.costs) && (
            <div className="tradeoffs">
              <Section label="Gains" text={data.gains} tone="gain" />
              <Section label="Costs" text={data.costs} tone="cost" />
            </div>
          )}
          {data.unclear && <div className="node-foot"><span className="unclear">? still unclear</span></div>}
        </>
      )}

      {size === "full" && (
        <div className="full-body">
          {data.sentence && <p className="sentence">{data.sentence}</p>}
          <Section label="Problem it solves" text={data.problem} />
          <Section label="How it works" text={data.how} />
          <div className="tradeoffs">
            <Section label="Gains" text={data.gains} tone="gain" />
            <Section label="Costs" text={data.costs} tone="cost" />
          </div>
          <Section label="Use when" text={data.useWhen} />
          <Section label="Avoid when" text={data.avoidWhen} />
          <Section label="Real examples" text={data.example} />
          <Section label="Recall questions" text={data.recall} />
          <Section label="Still unclear" text={data.unclear} tone="warn" />
        </div>
      )}
    </div>
  );
}
