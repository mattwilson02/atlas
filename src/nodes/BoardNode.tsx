import type { NodeProps } from "@xyflow/react";
import { ArrowUpRight } from "lucide-react";
import { Handles } from "./Handles";
import { useAtlas } from "../store";
import type { BoardLinkNode as T } from "../types";

export function BoardCard({ data, selected }: NodeProps<T>) {
  const target = useAtlas((s) => s.boards.find((b) => b.id === data.boardId));
  return (
    <div className={`node boardlink ${selected ? "is-selected" : ""}`}>
      <Handles />
      <div className="node-head">
        <span className="eyebrow">Sub-board</span>
        <ArrowUpRight size={14} />
      </div>
      <h3>{data.title || "Sub-board"}</h3>
      <p className="muted">
        {target ? `${target.nodes.length} nodes · double-click to open` : "Not linked yet — pick or create a board in the panel"}
      </p>
    </div>
  );
}
