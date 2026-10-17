import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { noteFromScratch, parseNote } from "./markdown";
import { seedBoards, seedFolders } from "./seed";
import {
  emptyNote,
  emptyDistinction,
  type AtlasNode,
  type Board,
  type Folder,
  type NodeKind,
  type ResourceKind,
} from "./types";

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;

const defaults: Record<NodeKind, () => Record<string, unknown>> = {
  note: () => ({ ...emptyNote() }),
  distinction: () => ({ ...emptyDistinction() }),
  scratch: () => ({ text: "" }),
  diagram: () => ({ title: "Diagram", code: "flowchart LR\n  A[Start] --> B[End]" }),
  label: () => ({ text: "Section" }),
  board: () => ({ title: "Sub-board", boardId: "" }),
};

type State = {
  folders: Folder[];
  boards: Board[];
  activeBoardId: string;
  history: string[];
  /** When boards/folders last changed (ms). Decides who wins when the browser and the server disagree. */
  updatedAt: number;

  applyRemote: (data: { folders: Folder[]; boards: Board[]; updatedAt: number }) => void;
  openBoard: (id: string, push?: boolean) => void;
  back: () => void;

  addFolder: (name: string, kind: ResourceKind) => void;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  addBoard: (folderId: string, name: string) => string;
  renameBoard: (id: string, name: string) => void;
  deleteBoard: (id: string) => void;

  onNodesChange: (c: NodeChange<AtlasNode>[]) => void;
  onEdgesChange: (c: EdgeChange[]) => void;
  onConnect: (c: Connection) => void;
  addNode: (type: NodeKind, position: { x: number; y: number }, data?: Record<string, unknown>) => string;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  updateEdge: (id: string, patch: Partial<Edge>) => void;
  promoteScratch: (id: string) => void;
  importNoteMarkdown: (md: string, position: { x: number; y: number }, title?: string) => void;
  createLinkedBoard: (nodeId: string) => void;
  duplicateSelected: () => void;
  deselectAll: () => void;

  exportJson: () => string;
  importJson: (json: string) => void;
};

const patchBoard = (s: State, id: string, fn: (b: Board) => Board): Partial<State> => ({
  boards: s.boards.map((b) => (b.id === id ? fn(b) : b)),
});

export const useAtlas = create<State>()(
  persist(
    (set, get) => {
      const patchActive = (fn: (b: Board) => Board) =>
        set((s) => patchBoard(s, s.activeBoardId, fn));

      return {
        folders: seedFolders,
        boards: seedBoards,
        activeBoardId: seedBoards[0].id,
        history: [],
        updatedAt: 0,

        applyRemote: (d) =>
          set((s) => ({
            folders: d.folders,
            boards: d.boards,
            updatedAt: d.updatedAt,
            activeBoardId: d.boards.some((b) => b.id === s.activeBoardId) ? s.activeBoardId : (d.boards[0]?.id ?? ""),
            history: [],
          })),
        openBoard: (id, push = true) =>
          set((s) =>
            id === s.activeBoardId
              ? s
              : { activeBoardId: id, history: push ? [...s.history, s.activeBoardId] : s.history },
          ),
        back: () =>
          set((s) => {
            const prev = [...s.history];
            const target = prev.pop();
            return target ? { activeBoardId: target, history: prev } : s;
          }),

        addFolder: (name, kind) => {
          const folder: Folder = { id: uid("f"), name, kind };
          const board: Board = { id: uid("b"), folderId: folder.id, name: "Notes", nodes: [], edges: [] };
          set((s) => ({
            folders: [...s.folders, folder],
            boards: [...s.boards, board],
            activeBoardId: board.id,
            history: [],
          }));
        },
        renameFolder: (id, name) =>
          set((s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)) })),
        deleteFolder: (id) =>
          set((s) => {
            const boards = s.boards.filter((b) => b.folderId !== id);
            const stillActive = boards.some((b) => b.id === s.activeBoardId);
            return {
              folders: s.folders.filter((f) => f.id !== id),
              boards,
              activeBoardId: stillActive ? s.activeBoardId : (boards[0]?.id ?? ""),
              history: [],
            };
          }),
        addBoard: (folderId, name) => {
          const board: Board = { id: uid("b"), folderId, name, nodes: [], edges: [] };
          set((s) => ({
            boards: [...s.boards, board],
            activeBoardId: board.id,
            history: [...s.history, s.activeBoardId].filter(Boolean),
          }));
          return board.id;
        },
        renameBoard: (id, name) => set((s) => patchBoard(s, id, (b) => ({ ...b, name }))),
        deleteBoard: (id) =>
          set((s) => {
            const boards = s.boards.filter((b) => b.id !== id);
            return {
              boards,
              activeBoardId: s.activeBoardId === id ? (boards[0]?.id ?? "") : s.activeBoardId,
              history: s.history.filter((h) => h !== id),
            };
          }),

        onNodesChange: (changes) =>
          patchActive((b) => ({ ...b, nodes: applyNodeChanges(changes, b.nodes) })),
        onEdgesChange: (changes) =>
          patchActive((b) => ({ ...b, edges: applyEdgeChanges(changes, b.edges) })),
        onConnect: (c) => patchActive((b) => ({ ...b, edges: addEdge({ ...c, id: uid("e") }, b.edges) })),

        addNode: (type, position, data) => {
          const id = uid("n");
          const node = {
            id,
            type,
            position,
            data: { ...defaults[type](), ...data },
            selected: true,
            ...(type === "diagram" ? { style: { width: 460, height: 300 } } : {}),
          } as AtlasNode;
          patchActive((b) => ({
            ...b,
            nodes: [...b.nodes.map((n) => ({ ...n, selected: false })), node],
            edges: b.edges.map((e) => ({ ...e, selected: false })),
          }));
          return id;
        },
        updateNodeData: (id, patch) =>
          patchActive((b) => ({
            ...b,
            nodes: b.nodes.map((n) => (n.id === id ? ({ ...n, data: { ...n.data, ...patch } } as AtlasNode) : n)),
          })),
        updateEdge: (id, patch) =>
          patchActive((b) => ({ ...b, edges: b.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),

        promoteScratch: (id) =>
          patchActive((b) => ({
            ...b,
            nodes: b.nodes.map((n) =>
              n.id === id && n.type === "scratch"
                ? ({ id: n.id, type: "note", position: n.position, selected: true, data: noteFromScratch(n.data.text) } as AtlasNode)
                : n,
            ),
          })),
        importNoteMarkdown: (md, position, title) => {
          get().addNode("note", position, { ...parseNote(md, title?.trim() || "Imported note") });
        },
        duplicateSelected: () =>
          patchActive((b) => {
            const picked = b.nodes.filter((n) => n.selected);
            if (!picked.length) return b;
            const copies = picked.map((n) => {
              const { measured: _drop, ...rest } = structuredClone(n) as AtlasNode & { measured?: unknown };
              return { ...rest, id: uid("n"), position: { x: n.position.x + 36, y: n.position.y + 36 }, selected: true, dragging: false } as AtlasNode;
            });
            return { ...b, nodes: [...b.nodes.map((n) => ({ ...n, selected: false })), ...copies] };
          }),
        deselectAll: () =>
          patchActive((b) => ({
            ...b,
            nodes: b.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
            edges: b.edges.map((e) => (e.selected ? { ...e, selected: false } : e)),
          })),
        createLinkedBoard: (nodeId) => {
          const s = get();
          const active = s.boards.find((b) => b.id === s.activeBoardId);
          const node = active?.nodes.find((n) => n.id === nodeId);
          if (!active || !node || node.type !== "board") return;
          const board: Board = {
            id: uid("b"),
            folderId: active.folderId,
            name: node.data.title || "Sub-board",
            nodes: [],
            edges: [],
          };
          set((st) => ({
            boards: [
              ...st.boards.map((b) =>
                b.id === active.id
                  ? { ...b, nodes: b.nodes.map((n) => (n.id === nodeId ? ({ ...n, data: { ...n.data, boardId: board.id } } as AtlasNode) : n)) }
                  : b,
              ),
              board,
            ],
          }));
        },

        exportJson: () => {
          const { folders, boards } = get();
          return JSON.stringify({ app: "atlas", version: 1, folders, boards }, null, 2);
        },
        importJson: (json) => {
          const data = JSON.parse(json);
          if (data?.app !== "atlas" || !Array.isArray(data.folders) || !Array.isArray(data.boards))
            throw new Error("Not an Atlas export");
          set({ folders: data.folders, boards: data.boards, activeBoardId: data.boards[0]?.id ?? "", history: [], updatedAt: Date.now() });
        },
      };
    },
    {
      name: "atlas:v1",
      partialize: (s) => ({ folders: s.folders, boards: s.boards, activeBoardId: s.activeBoardId, updatedAt: s.updatedAt }),
    },
  ),
);
