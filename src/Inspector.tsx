import { useState } from "react";
import { Copy, Sparkles, Wand2 } from "lucide-react";
import { Field } from "./fields";
import { DiagramPanel } from "./DiagramPanel";
import { useAtlas } from "./store";
import { noteToMarkdown } from "./markdown";
import type { AtlasNode, NoteData } from "./types";

function NoteForm({ node }: { node: Extract<AtlasNode, { type: "note" }> }) {
  const update = useAtlas((s) => s.updateNodeData);
  const [copied, setCopied] = useState(false);
  const d = node.data;
  const set = (k: keyof NoteData) => (v: string) => update(node.id, { [k]: v });
  return (
    <>
      <label className="field">
        <span className="eyebrow">Title</span>
        <input value={d.title} onChange={(e) => set("title")(e.target.value)} />
      </label>
      <div className="field">
        <span className="eyebrow">Confidence</span>
        <div className="seg">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} className={d.confidence === i ? "on" : ""} onClick={() => update(node.id, { confidence: i })}>
              {i}
            </button>
          ))}
        </div>
      </div>
      <Field label="In one sentence" value={d.sentence} onChange={set("sentence")} />
      <Field label="Problem it solves" value={d.problem} onChange={set("problem")} />
      <Field label="How it works" value={d.how} onChange={set("how")} rows={3} />
      <Field label="Gains" value={d.gains} onChange={set("gains")} />
      <Field label="Costs" value={d.costs} onChange={set("costs")} />
      <Field label="Use when" value={d.useWhen} onChange={set("useWhen")} />
      <Field label="Avoid when" value={d.avoidWhen} onChange={set("avoidWhen")} />
      <Field label="Real examples" value={d.example} onChange={set("example")} />
      <Field label="Recall questions" value={d.recall} onChange={set("recall")} rows={4} />
      <Field label="Still unclear" value={d.unclear} onChange={set("unclear")} />
      <button
        className="ghost"
        onClick={async () => {
          await navigator.clipboard.writeText(noteToMarkdown(d));
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        <Copy size={14} /> {copied ? "Copied" : "Copy as Study OS markdown"}
      </button>
    </>
  );
}

export function Inspector() {
  const { boards, activeBoardId, updateNodeData, updateEdge, promoteScratch, createLinkedBoard, openBoard } = useAtlas();
  const board = boards.find((b) => b.id === activeBoardId);
  if (!board) return <aside className="inspector" />;

  const selNodes = board.nodes.filter((n) => n.selected);
  const selEdges = board.edges.filter((e) => e.selected);
  const node = selNodes.length === 1 ? selNodes[0] : null;
  const edge = !node && selEdges.length === 1 ? selEdges[0] : null;
  const siblings = boards.filter((b) => b.folderId === board.folderId && b.id !== board.id);

  return (
    <aside className="inspector">
      {!node && !edge && (
        <div className="hint">
          <Sparkles size={18} />
          <h4>Nothing selected</h4>
          <p>Double-click the canvas to drop a note. Drag from a card's edge to another card to link them. Select anything to edit it here.</p>
          <p className="muted">{board.nodes.length} nodes · {board.edges.length} links</p>
        </div>
      )}

      {edge && (
        <>
          <div className="eyebrow">Link</div>
          <label className="field">
            <span className="eyebrow">Label</span>
            <input
              autoFocus
              value={typeof edge.label === "string" ? edge.label : ""}
              placeholder="e.g. depends on, trades off against…"
              onChange={(e) => updateEdge(edge.id, { label: e.target.value })}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={!!edge.animated}
              onChange={(e) => updateEdge(edge.id, { animated: e.target.checked })}
            />
            Animate (use for data flow)
          </label>
        </>
      )}

      {node?.type === "note" && <NoteForm node={node} />}

      {node?.type === "scratch" && (
        <>
          <div className="eyebrow">Scratch</div>
          <Field label="Text" rows={10} value={node.data.text} onChange={(v) => updateNodeData(node.id, { text: v })} />
          <button className="primary" onClick={() => promoteScratch(node.id)}>
            <Wand2 size={14} /> Promote to atomic note
          </button>
          <p className="muted">First line becomes the title, the rest the sentence. Pasted Study OS markdown is split into every field.</p>
        </>
      )}

      {node?.type === "diagram" && <DiagramPanel node={node} />}

      {node?.type === "label" && (
        <label className="field">
          <span className="eyebrow">Label</span>
          <input value={node.data.text} onChange={(e) => updateNodeData(node.id, { text: e.target.value })} />
        </label>
      )}

      {node?.type === "board" && (
        <>
          <label className="field">
            <span className="eyebrow">Title</span>
            <input value={node.data.title} onChange={(e) => updateNodeData(node.id, { title: e.target.value })} />
          </label>
          <label className="field">
            <span className="eyebrow">Opens board</span>
            <select value={node.data.boardId} onChange={(e) => updateNodeData(node.id, { boardId: e.target.value })}>
              <option value="">— none —</option>
              {siblings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <button className="ghost" onClick={() => createLinkedBoard(node.id)}>
            Create a new board for this
          </button>
          {node.data.boardId && (
            <button className="primary" onClick={() => openBoard(node.data.boardId)}>
              Open board
            </button>
          )}
        </>
      )}

      {selNodes.length + selEdges.length > 1 && (
        <p className="muted">{selNodes.length + selEdges.length} items selected — press Delete to remove.</p>
      )}
    </aside>
  );
}
