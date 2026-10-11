import type { NodeProps } from "@xyflow/react";
import { Handles } from "./Handles";
import type { ScratchNode as T } from "../types";

export function ScratchCard({ data, selected }: NodeProps<T>) {
  return (
    <div className={`node scratch ${selected ? "is-selected" : ""}`}>
      <Handles />
      <span className="eyebrow">Scratch</span>
      <p>{data.text || "Empty — type in the panel →"}</p>
    </div>
  );
}
