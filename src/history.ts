// Undo / redo for everything on the boards (resources, boards, cards, links).
// A burst of changes (one drag, one stretch of typing) is a single step. Lives in memory: gone on reload.
import { create } from "zustand";
import { useAtlas } from "./store";

type Snap = { folders: ReturnType<typeof useAtlas.getState>["folders"]; boards: ReturnType<typeof useAtlas.getState>["boards"]; sig: string };

const LIMIT = 100;
const BURST_MS = 700;
const TRANSIENT = new Set(["measured", "selected", "dragging", "resizing"]);

const take = (): Snap => {
  const { folders, boards } = useAtlas.getState();
  return { folders, boards, sig: JSON.stringify([folders, boards], (k, v) => (TRANSIENT.has(k) ? undefined : v)) };
};

let undoStack: Snap[] = [];
let redoStack: Snap[] = [];
let current: Snap = take();
let lastChange = 0;
let restoring = false;

export const useHistory = create<{ canUndo: boolean; canRedo: boolean }>(() => ({ canUndo: false, canRedo: false }));
const publish = () => useHistory.setState({ canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 });

useAtlas.subscribe((s, prev) => {
  if (restoring || (s.folders === prev.folders && s.boards === prev.boards)) return;
  const next = take();
  if (next.sig === current.sig) return; // selection / measuring, not an edit
  const now = Date.now();
  if (now - lastChange > BURST_MS || undoStack.length === 0) {
    undoStack.push(current);
    if (undoStack.length > LIMIT) undoStack.shift();
  }
  lastChange = now;
  current = next;
  redoStack = [];
  publish();
});

function restore(snap: Snap) {
  restoring = true;
  const s = useAtlas.getState();
  useAtlas.setState({
    folders: snap.folders,
    boards: snap.boards,
    activeBoardId: snap.boards.some((b) => b.id === s.activeBoardId) ? s.activeBoardId : (snap.boards[0]?.id ?? ""),
    history: [],
  });
  restoring = false;
  current = snap;
  lastChange = 0; // the next edit starts a fresh step
  publish();
}

export function undo(): boolean {
  const snap = undoStack.pop();
  if (!snap) return false;
  redoStack.push(current);
  restore(snap);
  return true;
}

export function redo(): boolean {
  const snap = redoStack.pop();
  if (!snap) return false;
  undoStack.push(current);
  restore(snap);
  return true;
}

/** Forget the past: used when the whole state is replaced from outside (the server copy loaded on start). */
export function resetHistory() {
  undoStack = [];
  redoStack = [];
  current = take();
  publish();
}
