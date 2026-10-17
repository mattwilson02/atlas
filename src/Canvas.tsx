import { useCallback, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import { ArrowLeft, ClipboardPaste, Keyboard, Redo2, Undo2, GitBranch, Heading, NotebookPen, Share2, StickyNote, Scale } from "lucide-react";
import { useAtlas } from "./store";
import { Dialog } from "./Dialog";
import { useUi } from "./ui";
import { redo, undo, useHistory } from "./history";
import { keyFor, useShortcuts, type ShortcutId } from "./shortcuts";
import { NoteCard } from "./nodes/NoteNode";
import { DistinctionCard } from "./nodes/DistinctionNode";
import { ScratchCard } from "./nodes/ScratchNode";
import { DiagramCard } from "./nodes/DiagramNode";
import { LabelCard } from "./nodes/LabelNode";
import { BoardCard } from "./nodes/BoardNode";
import type { AtlasNode, NodeKind } from "./types";

const nodeTypes = {
  note: NoteCard,
  distinction: DistinctionCard,
  scratch: ScratchCard,
  diagram: DiagramCard,
  label: LabelCard,
  board: BoardCard,
} as NodeTypes;

const edgeDefaults = {
  type: "default",
  markerEnd: { type: MarkerType.ArrowClosed, color: "#6b7280", width: 18, height: 18 },
};

const TOOLS: { kind: NodeKind; label: string; icon: typeof NotebookPen }[] = [
  { kind: "note", label: "Note", icon: NotebookPen },
  { kind: "distinction", label: "X vs Y", icon: Scale },
  { kind: "scratch", label: "Scratch", icon: StickyNote },
  { kind: "diagram", label: "Diagram", icon: Share2 },
  { kind: "board", label: "Sub-board", icon: GitBranch },
  { kind: "label", label: "Label", icon: Heading },
];

export function Canvas() {
  const { boards, folders, activeBoardId, history, back, openBoard, renameBoard, onNodesChange, onEdgesChange, onConnect, addNode, importNoteMarkdown } =
    useAtlas();
  const board = boards.find((b) => b.id === activeBoardId);
  const folder = folders.find((f) => f.id === board?.folderId);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const wrap = useRef<HTMLDivElement>(null);
  const { canUndo, canRedo } = useHistory();
  const pasting = useUi((s) => s.pasting);
  const setPasting = (v: boolean) => useUi.setState({ pasting: v });
  const [md, setMd] = useState("");
  const [mdTitle, setMdTitle] = useState("");

  const centre = useCallback(() => {
    const r = wrap.current?.getBoundingClientRect();
    const jitter = () => (Math.random() - 0.5) * 60;
    return screenToFlowPosition({
      x: (r ? r.left + r.width / 2 : window.innerWidth / 2) + jitter(),
      y: (r ? r.top + r.height / 2 : window.innerHeight / 2) + jitter(),
    });
  }, [screenToFlowPosition]);

  useShortcuts({ centre, fit: () => fitView({ padding: 0.2, duration: 300, maxZoom: 1 }) });

  if (!board) {
    return (
      <main className="canvas empty">
        <h2>No boards yet</h2>
        <p>Create a resource in the sidebar to start.</p>
      </main>
    );
  }

  return (
    <main className="canvas" ref={wrap}>
      <header className="topbar">
        {history.length > 0 && (
          <button className="icon" title="Back" onClick={back}>
            <ArrowLeft size={16} />
          </button>
        )}
        <div className="crumbs">
          <span className="eyebrow">{folder?.name}</span>
          <input
            className="board-title"
            value={board.name}
            onChange={(e) => renameBoard(board.id, e.target.value)}
            aria-label="Board name"
          />
        </div>
        <div className="tools">
          {TOOLS.map(({ kind, label, icon: Icon }) => (
            <button key={kind} className="tool" title={`${label} (${keyFor(`add-${kind}` as ShortcutId)})`} onClick={() => addNode(kind, centre())}>
              <Icon size={15} /> <span className="lbl">{label}</span>
            </button>
          ))}
          <button className="tool" onClick={() => setPasting(true)} title={`Paste a Study OS note from Notion (${keyFor("paste")})`}>
            <ClipboardPaste size={15} /> <span className="lbl">Paste note</span>
          </button>
          <button className="tool" title={`Undo (${keyFor("undo")})`} aria-label="Undo" disabled={!canUndo} onClick={() => void undo()}>
            <Undo2 size={15} />
          </button>
          <button className="tool" title={`Redo (${keyFor("redo")})`} aria-label="Redo" disabled={!canRedo} onClick={() => void redo()}>
            <Redo2 size={15} />
          </button>
          <button className="tool" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" onClick={() => useUi.setState({ help: true })}>
            <Keyboard size={15} />
          </button>
        </div>
      </header>

      <div
        className="flow"
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).classList.contains("react-flow__pane"))
            addNode("note", screenToFlowPosition({ x: e.clientX, y: e.clientY }));
        }}
      >
        <ReactFlow
          key={board.id}
          nodes={board.nodes}
          edges={board.edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={(_, n: AtlasNode) => n.type === "board" && n.data.boardId && openBoard(n.data.boardId)}
          connectionMode={ConnectionMode.Loose}
          defaultEdgeOptions={edgeDefaults}
          zoomOnDoubleClick={false}
          colorMode="dark"
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
          minZoom={0.15}
          attributionPosition="bottom-center"
          deleteKeyCode={["Backspace", "Delete"]}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#23252b" />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable maskColor="rgba(10,10,10,.75)" nodeColor="#2a2d36" />
        </ReactFlow>
        <button className="fit" onClick={() => fitView({ padding: 0.2, duration: 300, maxZoom: 1 })}>
          Fit view
        </button>
      </div>

      {pasting && (
        <Dialog title="Paste a note" onClose={() => setPasting(false)}>
          <p className="muted">Paste a Study OS page copied from Notion (the “In one sentence … Still unclear” template).</p>
          <input autoFocus placeholder="Title (optional if the paste has a # heading)" value={mdTitle} onChange={(e) => setMdTitle(e.target.value)} />
          <textarea rows={14} value={md} onChange={(e) => setMd(e.target.value)} />
          <button
            className="primary"
            disabled={!md.trim()}
            onClick={() => {
              importNoteMarkdown(md, centre(), mdTitle);
              setMd("");
              setMdTitle("");
              setPasting(false);
            }}
          >
            Add to board
          </button>
        </Dialog>
      )}
    </main>
  );
}
