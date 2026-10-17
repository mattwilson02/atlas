import { useEffect, useRef } from "react";
import type { NodeKind } from "./types";
import { useAtlas } from "./store";
import { toast, useUi } from "./ui";
import { redo, undo } from "./history";
import { toggleTimer } from "./Pomodoro";

export type ShortcutId =
  | `add-${NodeKind}`
  | "paste"
  | "fit"
  | "duplicate"
  | "size"
  | "open"
  | "back"
  | "timer"
  | "switcher"
  | "help"
  | "escape"
  | "undo"
  | "redo"
  | "conf1" | "conf2" | "conf3" | "conf4" | "conf5";

export type Shortcut = {
  id?: ShortcutId;
  /** "n", "mod+k", "alt+arrowleft". Empty = documented only (handled by the canvas itself). */
  combo: string;
  label: string;
  group: "Add" | "Selection" | "Navigate" | "Timer" | "Canvas";
  display?: string;
  hidden?: boolean;
  /** Also fires while typing in a field / when an overlay is open. */
  inInputs?: boolean;
  inModal?: boolean;
};

// One list drives both the key handler and the cheat sheet, so they cannot drift apart.
export const SHORTCUTS: Shortcut[] = [
  { id: "add-note", combo: "n", label: "New note", group: "Add" },
  { id: "add-distinction", combo: "v", label: "New distinction (X vs Y)", group: "Add" },
  { id: "add-scratch", combo: "s", label: "New scratch", group: "Add" },
  { id: "add-diagram", combo: "d", label: "New diagram", group: "Add" },
  { id: "add-board", combo: "b", label: "New sub-board link", group: "Add" },
  { id: "add-label", combo: "l", label: "New label", group: "Add" },
  { id: "paste", combo: "p", label: "Paste a note from Notion", group: "Add" },

  { id: "undo", combo: "mod+z", label: "Undo", group: "Selection" },
  { id: "redo", combo: "mod+shift+z", label: "Redo", group: "Selection" },
  { id: "redo", combo: "mod+y", label: "Redo", group: "Selection", hidden: true },
  { id: "duplicate", combo: "mod+d", label: "Duplicate selection", group: "Selection" },
  { id: "size", combo: "e", label: "Cycle note size (summary, full, compact)", group: "Selection" },
  { id: "conf1", combo: "1", label: "Set note confidence", group: "Selection", display: "1 – 5" },
  { id: "conf2", combo: "2", label: "", group: "Selection", hidden: true },
  { id: "conf3", combo: "3", label: "", group: "Selection", hidden: true },
  { id: "conf4", combo: "4", label: "", group: "Selection", hidden: true },
  { id: "conf5", combo: "5", label: "", group: "Selection", hidden: true },
  { id: "open", combo: "enter", label: "Open the selected sub-board", group: "Selection" },
  { combo: "", display: "Delete", label: "Delete selection (undo brings it back)", group: "Selection" },
  { id: "escape", combo: "escape", label: "Deselect (or leave a field)", group: "Selection", inInputs: true },

  { id: "switcher", combo: "mod+k", label: "Jump to a board", group: "Navigate", inInputs: true },
  { id: "switcher", combo: "/", label: "Jump to a board", group: "Navigate", hidden: true },
  { id: "back", combo: "alt+arrowleft", label: "Back to the previous board", group: "Navigate" },
  { id: "fit", combo: "f", label: "Fit the board in view", group: "Canvas" },
  { combo: "", display: "Double-click", label: "New note where you click", group: "Canvas" },
  { combo: "", display: "Shift + drag", label: "Box-select several cards", group: "Canvas" },
  { id: "help", combo: "?", label: "Show this list", group: "Canvas" },

  { id: "timer", combo: "t", label: "Start / pause the pomodoro", group: "Timer" },
];

export function matches(combo: string, e: KeyboardEvent): boolean {
  if (!combo) return false;
  const parts = combo.split("+");
  const key = parts.pop()!;
  const mods = new Set(parts);
  if (mods.has("mod") !== (e.metaKey || e.ctrlKey)) return false;
  if (mods.has("alt") !== e.altKey) return false;
  // shift only matters for letters, so "?" works whatever the keyboard layout needs to type it
  if (/^[a-z]$/.test(key) && mods.has("shift") !== e.shiftKey) return false;
  return e.key.toLowerCase() === key;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const NAMES: Record<string, string> = {
  mod: isMac ? "⌘" : "Ctrl",
  alt: isMac ? "⌥" : "Alt",
  arrowleft: "←",
  enter: "↵",
  escape: "Esc",
};
export const prettyCombo = (s: Shortcut) =>
  s.display ?? s.combo.split("+").map((p) => NAMES[p] ?? p.toUpperCase()).join(isMac ? " " : " + ");

/** The key for a toolbar button's tooltip, e.g. "N". */
export const keyFor = (id: ShortcutId) => {
  const s = SHORTCUTS.find((x) => x.id === id);
  return s ? prettyCombo(s) : "";
};

const typingIn = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable || el.getAttribute?.("role") === "textbox");
};

type Ctx = {
  centre: () => { x: number; y: number };
  fit: () => void;
};

export function useShortcuts(ctx: Ctx) {
  const ref = useRef(ctx);
  ref.current = ctx;

  useEffect(() => {
    const selected = () => {
      const a = useAtlas.getState();
      return a.boards.find((b) => b.id === a.activeBoardId)?.nodes.filter((n) => n.selected) ?? [];
    };

    const run: Record<ShortcutId, () => void> = {
      "add-note": () => useAtlas.getState().addNode("note", ref.current.centre()),
      "add-distinction": () => useAtlas.getState().addNode("distinction", ref.current.centre()),
      "add-scratch": () => useAtlas.getState().addNode("scratch", ref.current.centre()),
      "add-diagram": () => useAtlas.getState().addNode("diagram", ref.current.centre()),
      "add-board": () => useAtlas.getState().addNode("board", ref.current.centre()),
      "add-label": () => useAtlas.getState().addNode("label", ref.current.centre()),
      paste: () => useUi.setState({ pasting: true }),
      fit: () => ref.current.fit(),
      duplicate: () => useAtlas.getState().duplicateSelected(),
      size: () => {
        const next = { summary: "full", full: "compact", compact: "summary" } as const;
        for (const n of selected()) {
          if (n.type === "note" || n.type === "distinction") useAtlas.getState().updateNodeData(n.id, { size: next[n.data.size ?? "summary"] });
        }
      },
      open: () => {
        const [n, ...rest] = selected();
        if (n?.type === "board" && !rest.length && n.data.boardId) useAtlas.getState().openBoard(n.data.boardId);
      },
      back: () => useAtlas.getState().back(),
      undo: () => toast(undo() ? "Undone" : "Nothing to undo"),
      redo: () => toast(redo() ? "Redone" : "Nothing to redo"),
      timer: () => toggleTimer(),
      switcher: () => useUi.setState({ switcher: true }),
      help: () => useUi.setState({ help: true }),
      escape: () => {
        if (typingIn(document.activeElement)) (document.activeElement as HTMLElement).blur();
        else useAtlas.getState().deselectAll();
      },
      conf1: () => setConfidence(1),
      conf2: () => setConfidence(2),
      conf3: () => setConfidence(3),
      conf4: () => setConfidence(4),
      conf5: () => setConfidence(5),
    };

    function setConfidence(n: number) {
      for (const node of selected()) if (node.type === "note" || node.type === "distinction") useAtlas.getState().updateNodeData(node.id, { confidence: n });
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.repeat) return;
      const typing = typingIn(e.target);
      const modal = !!document.querySelector(".scrim");
      for (const s of SHORTCUTS) {
        if (!s.id || !matches(s.combo, e)) continue;
        if (typing && !s.inInputs) continue;
        if (modal && !s.inModal) continue;
        // Enter on a focused button/link belongs to that control
        if (e.key === "Enter" && (e.target as HTMLElement | null)?.closest?.("button,a,[role=button]")) continue;
        e.preventDefault();
        run[s.id]();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
