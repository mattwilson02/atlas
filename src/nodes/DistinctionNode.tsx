import type { NodeProps } from "@xyflow/react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Handles } from "./Handles";
import { Markdown } from "../MarkdownText";
import { useAtlas } from "../store";
import { distinctionTitle, type DistinctionNode as T } from "../types";

function Section({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <section className="sec">
      <b>{label}</b>
      <Markdown text={text} />
    </section>
  );
}

export function DistinctionCard({ id, data, selected }: NodeProps<T>) {
  const update = useAtlas((s) => s.updateNodeData);
  const size = data.size ?? "summary";
  const set = (next: typeof size) => update(id, { size: next });
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className={`node note distinction size-${size} ${selected ? "is-selected" : ""}`}>
      <Handles />
      <div className="node-head">
        <span className="eyebrow">Distinction</span>
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

      <h3>{distinctionTitle(data)}</h3>

      {size !== "compact" && (
        <>
          {data.question && <Markdown className="sentence" text={data.question} />}
          {(data.x || data.y) && (
            <div className="versus">
              <section className="sec side-x">
                <b>{data.xName || "X"}</b>
                <Markdown text={data.x} />
              </section>
              <section className="sec side-y">
                <b>{data.yName || "Y"}</b>
                <Markdown text={data.y} />
              </section>
            </div>
          )}
        </>
      )}

      {size === "full" && (
        <div className="full-body">
          <Section label="Why both exist" text={data.why} />
          <Section label="Where you see both together" text={data.together} />
          <Section label="Recall question" text={data.recall} />
        </div>
      )}
    </div>
  );
}
