import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

/** Textarea that grows with its content (up to 70vh); drag the corner to go bigger still. */
export function Grow({ value, onChange, min = 2 }: { value: string; onChange: (v: string) => void; min?: number }) {
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
  return <textarea ref={ref} rows={min} value={value} onChange={(e) => onChange(e.target.value)} />;
}

const closed = new Set<string>(); // remembered for the session so collapsing survives selection changes

export function Field({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  const [shut, setShut] = useState(closed.has(label));
  const toggle = () => {
    shut ? closed.delete(label) : closed.add(label);
    setShut(!shut);
  };
  return (
    <div className="field">
      <button className="field-label" onClick={toggle} aria-expanded={!shut}>
        {shut ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        <span className="eyebrow">{label}</span>
        {shut && value && <span className="peek">{value.slice(0, 40)}</span>}
      </button>
      {!shut && <Grow value={value} onChange={onChange} min={rows} />}
    </div>
  );
}

