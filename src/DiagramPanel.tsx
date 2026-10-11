import { Code2, Undo2, Workflow } from "lucide-react";
import { useAtlas } from "./store";
import { Field } from "./fields";
import { FlowEditor } from "./FlowEditor";
import { blankModel, flowTemplates, toMermaid, type FlowModel } from "./flow";
import { diagramTemplates } from "./diagramTemplates";
import type { DiagramNode } from "./types";

export function DiagramPanel({ node }: { node: DiagramNode }) {
  const update = useAtlas((s) => s.updateNodeData);
  const { id, data } = node;
  const visual = !!data.model;
  const snapshot = { code: data.code, model: data.model };

  const setModel = (model: FlowModel) => update(id, { model, code: toMermaid(model) });
  const replace = (code: string, model?: FlowModel) => update(id, { code, model, backup: snapshot });
  const undo = () => data.backup && update(id, { ...data.backup, backup: undefined });

  return (
    <>
      <label className="field">
        <span className="eyebrow">Title</span>
        <input value={data.title} onChange={(e) => update(id, { title: e.target.value })} />
      </label>

      {data.backup && (
        <button className="ghost" onClick={undo}>
          <Undo2 size={14} /> Undo last change of diagram type
        </button>
      )}

      <label className="field">
        <span className="eyebrow">Start from a template</span>
        <select
          value=""
          onChange={(e) => {
            const k = e.target.value;
            if (!k) return;
            if (flowTemplates[k]) {
              const m = flowTemplates[k]();
              replace(toMermaid(m), m);
            } else replace(diagramTemplates[k]);
          }}
        >
          <option value="">Replace this diagram with…</option>
          <optgroup label="Flowcharts (visual editor)">
            {Object.keys(flowTemplates).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </optgroup>
          <optgroup label="Other types (Mermaid text)">
            {Object.keys(diagramTemplates).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </optgroup>
        </select>
      </label>

      {visual ? (
        <>
          <FlowEditor model={data.model!} onChange={setModel} />
          <button className="ghost" onClick={() => update(id, { model: undefined })} title="Keep the diagram, edit its Mermaid text by hand from here on">
            <Code2 size={14} /> Edit as Mermaid text instead
          </button>
        </>
      ) : (
        <>
          <Field label="Mermaid source" rows={10} value={data.code} onChange={(v) => update(id, { code: v })} />
          <button
            className="primary"
            onClick={() => {
              const m = blankModel();
              replace(toMermaid(m), m);
            }}
          >
            <Workflow size={14} /> Build it visually (replaces this text)
          </button>
          <p className="muted">Visual editing is for flowcharts. You can undo the switch.</p>
        </>
      )}
    </>
  );
}
