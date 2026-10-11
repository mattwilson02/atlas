import { useState } from "react";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import {
  SHAPES,
  TONES,
  uid,
  type Arrow,
  type FlowEdge,
  type FlowModel,
  type FlowNode,
  type LineStyle,
} from "./flow";

type Props = { model: FlowModel; onChange: (m: FlowModel) => void };

export function FlowEditor({ model, onChange }: Props) {
  const [justAdded, setJustAdded] = useState("");
  const groups = [...new Set(model.nodes.map((n) => n.group.trim()).filter(Boolean))];
  const nameOf = (id: string) => model.nodes.find((n) => n.id === id)?.label || "(unnamed)";

  const setNode = (id: string, patch: Partial<FlowNode>) =>
    onChange({ ...model, nodes: model.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
  const setEdge = (id: string, patch: Partial<FlowEdge>) =>
    onChange({ ...model, edges: model.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) });

  const addNode = () => {
    const id = uid();
    setJustAdded(id);
    onChange({ ...model, nodes: [...model.nodes, { id, label: "New step", shape: "rect", tone: "app", group: "" }] });
  };
  const removeNode = (id: string) =>
    onChange({
      ...model,
      nodes: model.nodes.filter((n) => n.id !== id),
      edges: model.edges.filter((e) => e.from !== id && e.to !== id),
    });
  const addEdge = () => {
    const [a, b] = model.nodes.length > 1 ? model.nodes.slice(-2) : [model.nodes[0], model.nodes[0]];
    if (!a || !b) return;
    onChange({ ...model, edges: [...model.edges, { id: uid(), from: a.id, to: b.id, label: "", line: "solid", arrow: "one" }] });
  };

  return (
    <div className="flow-editor">
      <div className="seg two">
        {(["TB", "LR"] as const).map((d) => (
          <button key={d} className={model.dir === d ? "on" : ""} onClick={() => onChange({ ...model, dir: d })}>
            {d === "TB" ? "Top → bottom" : "Left → right"}
          </button>
        ))}
      </div>

      <div className="fe-head">
        <span className="eyebrow">Steps</span>
        <button className="ghost small" onClick={addNode}>
          <Plus size={13} /> Add step
        </button>
      </div>
      {model.nodes.length === 0 && <p className="muted">No steps yet. Add one to begin.</p>}
      {model.nodes.map((n) => (
        <div key={n.id} className="fe-card">
          <div className="fe-row">
            <input
              autoFocus={n.id === justAdded}
              value={n.label}
              placeholder="Step name"
              onChange={(e) => setNode(n.id, { label: e.target.value })}
              onFocus={(e) => n.id === justAdded && e.target.select()}
            />
            <button className="icon" title="Delete step" onClick={() => removeNode(n.id)}>
              <Trash2 size={14} />
            </button>
          </div>
          <div className="fe-row">
            <select value={n.shape} onChange={(e) => setNode(n.id, { shape: e.target.value as FlowNode["shape"] })} aria-label="Shape">
              {SHAPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <div className="swatches" role="radiogroup" aria-label="Colour">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  role="radio"
                  aria-checked={n.tone === t.value}
                  aria-label={t.label}
                  title={t.label}
                  className={n.tone === t.value ? "on" : ""}
                  style={{ background: t.colour }}
                  onClick={() => setNode(n.id, { tone: t.value })}
                />
              ))}
            </div>
          </div>
          <input
            list={`groups-${model.nodes.length}`}
            value={n.group}
            placeholder="Group (optional) — same name = boxed together"
            onChange={(e) => setNode(n.id, { group: e.target.value })}
            className="fe-group"
          />
        </div>
      ))}
      <datalist id={`groups-${model.nodes.length}`}>
        {groups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      <div className="fe-head">
        <span className="eyebrow">Connections</span>
        <button className="ghost small" onClick={addEdge} disabled={model.nodes.length === 0}>
          <Plus size={13} /> Add connection
        </button>
      </div>
      {model.edges.map((e) => (
        <div key={e.id} className="fe-card">
          <div className="fe-row">
            <select value={e.from} onChange={(ev) => setEdge(e.id, { from: ev.target.value })} aria-label="From">
              {model.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {nameOf(n.id)}
                </option>
              ))}
            </select>
            <ArrowRight size={14} className="fe-arrow" />
            <select value={e.to} onChange={(ev) => setEdge(e.id, { to: ev.target.value })} aria-label="To">
              {model.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {nameOf(n.id)}
                </option>
              ))}
            </select>
            <button className="icon" title="Delete connection" onClick={() => onChange({ ...model, edges: model.edges.filter((x) => x.id !== e.id) })}>
              <Trash2 size={14} />
            </button>
          </div>
          <input value={e.label} placeholder="Label on the line (optional)" onChange={(ev) => setEdge(e.id, { label: ev.target.value })} />
          <div className="fe-row">
            <select value={e.line} onChange={(ev) => setEdge(e.id, { line: ev.target.value as LineStyle })} aria-label="Line style">
              <option value="solid">Solid line</option>
              <option value="thick">Thick line</option>
              <option value="dotted">Dotted line</option>
            </select>
            <select value={e.arrow} onChange={(ev) => setEdge(e.id, { arrow: ev.target.value as Arrow })} aria-label="Arrowheads">
              <option value="one">One-way →</option>
              <option value="both">Two-way ↔</option>
              <option value="none">No arrow —</option>
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}
