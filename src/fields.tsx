import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Markdown } from "./MarkdownText";

/** Textarea that grows with its content (up to 70vh); drag the corner to go bigger still. */
export function Grow({
  value,
  onChange,
  min = 2,
  autoFocus,
  onBlur,
  onFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: number;
  autoFocus?: boolean;
  onBlur?: () => void;
  onFocus?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight + 2, min * 22)}px`;
  };
  useLayoutEffect(fit, [value, min]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let w = el.clientWidth;
    // re-fit when the panel width changes (drag-resize, first layout) — not on our own height writes
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== w) {
        w = el.clientWidth;
        fit();
      }
    });
    ro.observe(el);
    document.fonts?.ready.then(fit);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (autoFocus && el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [autoFocus]);
  return (
    <textarea
      ref={ref}
      rows={min}
      value={value}
      placeholder="Markdown supported"
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
    />
  );
}

const closed = new Set<string>(); // remembered for the session so collapsing survives selection changes

/**
 * `extra` fields belong to the full card: they start collapsed while empty, and open by default once filled.
 * Their state is per card (the form is keyed by node), not remembered across cards.
 */
export function Field({
  label,
  value,
  onChange,
  rows = 2,
  extra,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  extra?: boolean;
}) {
  const [shut, setShut] = useState(extra ? !value.trim() : closed.has(label));
  const [editing, setEditing] = useState(false);
  const toggle = () => {
    if (!extra) shut ? closed.delete(label) : closed.add(label);
    setShut(!shut);
  };
  return (
    <div className="field">
      <button className="field-label" onClick={toggle} aria-expanded={!shut}>
        {shut ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        <span className="eyebrow">{label}</span>
        {shut && value && <span className="peek">{value.slice(0, 40)}</span>}
      </button>
      {!shut &&
        (editing || !value.trim() ? (
          <Grow value={value} onChange={onChange} min={rows} autoFocus={editing} onFocus={() => setEditing(true)} onBlur={() => setEditing(false)} />
        ) : (
          <div
            className="md-preview"
            tabIndex={0}
            role="textbox"
            aria-label={`${label} (click to edit)`}
            onClick={(e) => !(e.target as HTMLElement).closest("a") && setEditing(true)}
            onKeyDown={(e) => e.key === "Enter" && setEditing(true)}
          >
            <Markdown text={value} />
          </div>
        ))}
    </div>
  );
}

