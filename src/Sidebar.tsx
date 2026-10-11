import { useRef, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, Download, FileText, GraduationCap, Layers, Play, Plus, Trash2, Upload } from "lucide-react";
import { useAtlas } from "./store";
import { Dialog } from "./Dialog";
import { Pomodoro } from "./Pomodoro";
import { useSync } from "./sync";
import type { ResourceKind } from "./types";

const ICONS: Record<ResourceKind, typeof BookOpen> = {
  book: BookOpen,
  course: GraduationCap,
  video: Play,
  article: FileText,
  other: Layers,
};

type Ask = { type: "folder" } | { type: "board"; folderId: string } | null;

export function Sidebar() {
  const { folders, boards, activeBoardId, openBoard, addFolder, addBoard, deleteBoard, deleteFolder, exportJson, importJson } =
    useAtlas();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [ask, setAsk] = useState<Ask>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ResourceKind>("book");
  const fileRef = useRef<HTMLInputElement>(null);
  const sync = useSync();
  // In-app confirm/notice: native confirm()/alert() are blocked in embedded browsers and some PWAs.
  const [confirm, setConfirm] = useState<{ text: string; label: string; run: () => void } | null>(null);
  const [notice, setNotice] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !ask) return;
    if (ask.type === "folder") addFolder(name.trim(), kind);
    else addBoard(ask.folderId, name.trim());
    setAsk(null);
    setName("");
  };

  const doExport = () => {
    const url = URL.createObjectURL(new Blob([exportJson()], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `atlas-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = (file?: File) => {
    if (!file) return;
    setConfirm({
      text: "Importing replaces everything currently in Atlas. Export first if unsure.",
      label: "Replace everything",
      run: async () => {
        try {
          importJson(await file.text());
        } catch (e) {
          setNotice(e instanceof Error ? e.message : "Import failed");
        }
      },
    });
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="mark">MW</span>
        <div>
          <strong>Atlas</strong>
          <span className="eyebrow">Study boards</span>
        </div>
      </div>

      <div className="side-head">
        <span className="eyebrow">Resources</span>
        <button className="icon" title="New resource" onClick={() => setAsk({ type: "folder" })}>
          <Plus size={15} />
        </button>
      </div>

      <nav className="tree">
        {folders.map((f) => {
          const Icon = ICONS[f.kind];
          const fb = boards.filter((b) => b.folderId === f.id);
          const open = !collapsed[f.id];
          return (
            <div key={f.id} className="folder">
              <div className="folder-row">
                <button className="folder-name" onClick={() => setCollapsed({ ...collapsed, [f.id]: open })}>
                  {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <Icon size={14} />
                  <span>{f.name}</span>
                </button>
                <button className="icon hover-only" title="New board" onClick={() => setAsk({ type: "board", folderId: f.id })}>
                  <Plus size={14} />
                </button>
                <button
                  className="icon hover-only"
                  title="Delete resource"
                  onClick={() => setConfirm({ text: `Delete "${f.name}" and all its boards?`, label: "Delete", run: () => deleteFolder(f.id) })}
                >
                  <Trash2 size={13} />
                </button>
              </div>
              {open &&
                fb.map((b) => (
                  <div key={b.id} className={`board-row ${b.id === activeBoardId ? "active" : ""}`}>
                    <button onClick={() => openBoard(b.id, false)}>{b.name}</button>
                    <button
                      className="icon hover-only"
                      title="Delete board"
                      onClick={() => setConfirm({ text: `Delete board "${b.name}"?`, label: "Delete", run: () => deleteBoard(b.id) })}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
            </div>
          );
        })}
      </nav>

      <Pomodoro />

      {sync.status !== "off" && (
        <p className={`sync ${sync.status}`} title="Boards are saved on this computer; a dated copy goes to iCloud Drive">
          <i />
          {{ syncing: "Saving…", saved: "Saved on this computer", "backed-up": "Backed up to iCloud", offline: "Server unreachable · kept in browser" }[sync.status]}
          {sync.at > 0 && sync.status !== "syncing" && sync.status !== "offline" ? ` · ${new Date(sync.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
        </p>
      )}

      <div className="side-foot">
        <button className="ghost" onClick={doExport}>
          <Download size={14} /> Export
        </button>
        <button className="ghost" onClick={() => fileRef.current?.click()}>
          <Upload size={14} /> Import
        </button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => {
            doImport(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {confirm && (
        <Dialog title="Are you sure?" onClose={() => setConfirm(null)}>
          <p className="muted">{confirm.text}</p>
          <div className="row">
            <button className="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              className="primary danger"
              autoFocus
              onClick={() => {
                const run = confirm.run;
                setConfirm(null);
                run();
              }}
            >
              {confirm.label}
            </button>
          </div>
        </Dialog>
      )}

      {notice && (
        <Dialog title="Couldn't do that" onClose={() => setNotice("")}>
          <p className="muted">{notice}</p>
          <button className="ghost" onClick={() => setNotice("")}>
            OK
          </button>
        </Dialog>
      )}

      {ask && (
        <Dialog title={ask.type === "folder" ? "New resource" : "New board"} onClose={() => setAsk(null)}>
          <form onSubmit={submit} className="stack">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={ask.type === "folder" ? "e.g. AWS Solutions Architect course" : "e.g. Ch 2 · Data models"}
            />
            {ask.type === "folder" && (
              <select value={kind} onChange={(e) => setKind(e.target.value as ResourceKind)}>
                <option value="book">Book</option>
                <option value="course">Course</option>
                <option value="video">Video</option>
                <option value="article">Article</option>
                <option value="other">Other</option>
              </select>
            )}
            <button className="primary" type="submit">
              Create
            </button>
          </form>
        </Dialog>
      )}
    </aside>
  );
}
