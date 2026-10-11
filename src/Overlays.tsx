import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "./Dialog";
import { useAtlas } from "./store";
import { useUi } from "./ui";
import { SHORTCUTS, prettyCombo } from "./shortcuts";

export function Help() {
  const open = useUi((s) => s.help);
  if (!open) return null;
  const groups = ["Add", "Selection", "Navigate", "Canvas", "Timer"] as const;
  return (
    <Dialog title="Keyboard shortcuts" onClose={() => useUi.setState({ help: false })}>
      <div className="keys">
        {groups.map((g) => (
          <section key={g}>
            <h4 className="eyebrow">{g}</h4>
            {SHORTCUTS.filter((s) => s.group === g && !s.hidden).map((s) => (
              <div key={s.label} className="key-row">
                <span>{s.label}</span>
                <kbd>{prettyCombo(s)}</kbd>
              </div>
            ))}
          </section>
        ))}
      </div>
      <p className="muted">Letter keys are ignored while you are typing in a field. ⌘K works everywhere.</p>
    </Dialog>
  );
}

export function Switcher() {
  const open = useUi((s) => s.switcher);
  const { boards, folders, openBoard } = useAtlas();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const close = () => {
    useUi.setState({ switcher: false });
    setQ("");
    setI(0);
  };

  const items = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return boards
      .map((b) => ({ b, folder: folders.find((f) => f.id === b.folderId)?.name ?? "" }))
      .filter(({ b, folder }) => words.every((w) => `${folder} ${b.name}`.toLowerCase().includes(w)));
  }, [boards, folders, q]);

  useEffect(() => setI(0), [q]);
  useEffect(() => {
    list.current?.querySelector(".on")?.scrollIntoView({ block: "nearest" });
  }, [i]);

  if (!open) return null;
  const pick = (id?: string) => {
    if (id) openBoard(id);
    close();
  };

  return (
    <Dialog title="Jump to a board" onClose={close}>
      <input
        autoFocus
        value={q}
        placeholder="Type a resource or board name"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") (e.preventDefault(), setI((n) => Math.min(n + 1, items.length - 1)));
          else if (e.key === "ArrowUp") (e.preventDefault(), setI((n) => Math.max(n - 1, 0)));
          else if (e.key === "Enter") (e.preventDefault(), pick(items[i]?.b.id));
        }}
      />
      <div className="switch-list" ref={list} role="listbox">
        {items.length === 0 && <p className="muted">No board matches.</p>}
        {items.map(({ b, folder }, n) => (
          <button key={b.id} role="option" aria-selected={n === i} className={n === i ? "on" : ""} onMouseEnter={() => setI(n)} onClick={() => pick(b.id)}>
            <span>{b.name}</span>
            <span className="muted">{folder}</span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

export function Toast() {
  const message = useUi((s) => s.toast);
  return (
    <div className={`toast ${message ? "show" : ""}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}
