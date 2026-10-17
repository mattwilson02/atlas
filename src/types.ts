import type { Edge, Node } from "@xyflow/react";
import type { FlowModel } from "./flow";

export type NoteData = {
  title: string;
  sentence: string;
  problem: string;
  how: string;
  gains: string;
  costs: string;
  useWhen: string;
  avoidWhen: string;
  example: string;
  recall: string;
  unclear: string;
  confidence: number;
  /** Card density on the canvas. Absent = "summary". */
  size?: "compact" | "summary" | "full";
};
/** An "X vs Y" card, for things the source teaches as a pair. Core: question, x, y. The rest is the full card. */
export type DistinctionData = {
  xName: string;
  yName: string;
  /** The one question whose answer tells you which side you are on. */
  question: string;
  x: string;
  y: string;
  why: string;
  together: string;
  recall: string;
  confidence: number;
  size?: "compact" | "summary" | "full";
};
export type ScratchData = { text: string };
export type DiagramData = {
  title: string;
  /** Mermaid source. Generated from `model` while the visual editor owns the diagram. */
  code: string;
  /** Present while the diagram is edited visually; absent once switched to raw code. */
  model?: FlowModel;
  /** The state before the last replace (template / switch), for one-step undo. */
  backup?: { code: string; model?: FlowModel };
};
export type LabelData = { text: string };
export type BoardLinkData = { title: string; boardId: string };

export type NoteNode = Node<NoteData, "note">;
export type DistinctionNode = Node<DistinctionData, "distinction">;
export type ScratchNode = Node<ScratchData, "scratch">;
export type DiagramNode = Node<DiagramData, "diagram">;
export type LabelNode = Node<LabelData, "label">;
export type BoardLinkNode = Node<BoardLinkData, "board">;
export type AtlasNode = NoteNode | DistinctionNode | ScratchNode | DiagramNode | LabelNode | BoardLinkNode;
export type NodeKind = AtlasNode["type"];

export type ResourceKind = "book" | "course" | "video" | "article" | "other";

export type Folder = { id: string; name: string; kind: ResourceKind };
export type Board = {
  id: string;
  folderId: string;
  name: string;
  nodes: AtlasNode[];
  edges: Edge[];
};

export const emptyNote = (): NoteData => ({
  title: "",
  sentence: "",
  problem: "",
  how: "",
  gains: "",
  costs: "",
  useWhen: "",
  avoidWhen: "",
  example: "",
  recall: "",
  unclear: "",
  confidence: 1,
});

export const emptyDistinction = (): DistinctionData => ({
  xName: "",
  yName: "",
  question: "",
  x: "",
  y: "",
  why: "",
  together: "",
  recall: "",
  confidence: 1,
});

export const distinctionTitle = (d: Pick<DistinctionData, "xName" | "yName">) =>
  d.xName.trim() || d.yName.trim() ? `${d.xName.trim() || "?"} vs ${d.yName.trim() || "?"}` : "Untitled distinction";
