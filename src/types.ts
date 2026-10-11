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
export type ScratchNode = Node<ScratchData, "scratch">;
export type DiagramNode = Node<DiagramData, "diagram">;
export type LabelNode = Node<LabelData, "label">;
export type BoardLinkNode = Node<BoardLinkData, "board">;
export type AtlasNode = NoteNode | ScratchNode | DiagramNode | LabelNode | BoardLinkNode;
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
