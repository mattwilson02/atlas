import type { NodeProps } from "@xyflow/react";
import { Handles } from "./Handles";
import type { LabelNode as T } from "../types";

export function LabelCard({ data, selected }: NodeProps<T>) {
  return (
    <div className={`node label ${selected ? "is-selected" : ""}`}>
      <Handles />
      {data.text || "Label"}
    </div>
  );
}
