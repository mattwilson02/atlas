// Keeps boards on disk via the local server (scripts/serve.mjs) so they survive the browser losing its storage
// and get snapshotted to the cloud folder. Where there is no server (the dev server, a plain static host) every
// call fails quietly and Atlas is just browser-local, as before.
import { create } from "zustand";
import { useAtlas } from "./store";
import { resetHistory } from "./history";

const URL_STATE = "/api/state";
const DELAY = 1500;

type Status = "off" | "syncing" | "saved" | "backed-up" | "offline";
export const useSync = create<{ status: Status; at: number }>(() => ({ status: "off", at: 0 }));

let applying = false;
let enabled = false; // a save endpoint answered (the dev server has none, so nothing is pushed there)
let ready = false; // nothing is pushed until the first pull has decided who is newer
let lastSig = "";
let timer: ReturnType<typeof setTimeout> | undefined;

// Content only. React Flow rewrites nodes on load/click/drag (measured size, selected, dragging); those are not edits.
const TRANSIENT = new Set(["measured", "selected", "dragging", "resizing"]);
const sig = () => {
  const { folders, boards } = useAtlas.getState();
  return JSON.stringify([folders, boards], (k, v) => (TRANSIENT.has(k) ? undefined : v));
};

const snapshot = () => {
  const { folders, boards, updatedAt } = useAtlas.getState();
  return { app: "atlas", version: 1, folders, boards, updatedAt };
};

async function push() {
  if (!enabled) return;
  try {
    const res = await fetch(URL_STATE, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(snapshot()),
    });
    if (res.status === 409) return void (await pull()); // the server has newer data: take it
    if (!res.ok) throw new Error(String(res.status));
    const { savedAt, mirrored } = await res.json();
    useSync.setState({ status: mirrored ? "backed-up" : "saved", at: savedAt });
  } catch {
    useSync.setState({ status: "offline" });
  }
}

/** Server wins if it is newer; the browser wins (and is pushed up) if it is newer, e.g. edited while offline. */
async function pull() {
  try {
    const res = await fetch(URL_STATE, { cache: "no-store" });
    if (res.status === 404 && (await res.clone().json().catch(() => null))?.error === "empty") {
      enabled = true;
      return void (await push()); // server is empty: seed it from this browser
    }
    if (!res.ok) throw new Error(String(res.status));
    const remote = await res.json();
    enabled = true;
    const local = useAtlas.getState();
    if (remote.updatedAt > local.updatedAt) {
      applying = true;
      local.applyRemote(remote);
      applying = false;
      lastSig = sig();
      resetHistory();
      useSync.setState({ status: "saved", at: Date.now() });
    } else if (local.updatedAt > remote.updatedAt) {
      await push();
    } else if (["off", "offline"].includes(useSync.getState().status)) {
      useSync.setState({ status: "saved", at: Date.now() }); // in step already; keep "backed up" if we know it
    }
  } catch {
    enabled = false;
    useSync.setState({ status: "off" });
  }
}

export function startSync() {
  lastSig = sig();
  void pull().finally(() => {
    lastSig = sig();
    ready = true;
  });
  useAtlas.subscribe((s, prev) => {
    if (!ready || applying || (s.folders === prev.folders && s.boards === prev.boards)) return;
    const now = sig();
    if (now === lastSig) return; // selection, measuring, a drag that ended where it began
    lastSig = now;
    useAtlas.setState({ updatedAt: Date.now() });
    if (!enabled) return; // no save endpoint answered (dev server): browser-only, nothing to show
    useSync.setState({ status: "syncing" });
    clearTimeout(timer);
    timer = setTimeout(push, DELAY);
  });
  // another tab changed the browser copy: pick it up (rehydrate), and re-check the server when we regain focus
  window.addEventListener("storage", (e) => e.key === "atlas:v1" && void useAtlas.persist.rehydrate());
  window.addEventListener("focus", () => void pull());
}
