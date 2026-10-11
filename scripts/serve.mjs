// Tiny static server for the built app. No dependencies.
// Binds to 127.0.0.1 only, so nothing else on the network can reach it.
//   node serve.mjs <dist-dir> <port> [data-dir] [backup-dir]
//
// Besides the app it keeps the boards on disk (PUT/GET /api/state), so they survive the browser
// losing its storage, and writes a dated snapshot of every change to <data-dir>/snapshots and,
// if given, <backup-dir> (point that at a cloud-synced folder).
import { createServer } from "node:http";
import { copyFile, mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve(process.argv[2] ?? "dist");
const port = Number(process.argv[3] ?? 5181);
const dataDir = process.argv[4] ? resolve(process.argv[4]) : null;
const backupDir = process.argv[5] ? resolve(process.argv[5]) : null;
const KEEP_DAYS = 90;
const MAX_BYTES = 50 * 1024 * 1024;
const ORIGINS = new Set([`http://localhost:${port}`, `http://127.0.0.1:${port}`]);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".map": "application/json",
};

async function file(path) {
  try {
    return (await stat(path)).isFile() ? path : null;
  } catch {
    return null;
  }
}

const json = (res, status, body) =>
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify(body));

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BYTES) throw new Error("too large");
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const day = () => new Date().toISOString().slice(0, 10);

/** Copy today's state into a folder as atlas-YYYY-MM-DD.json (latest write of the day wins) and prune old days. */
async function snapshot(dir, source) {
  await mkdir(dir, { recursive: true });
  await copyFile(source, join(dir, `atlas-${day()}.json`));
  const cutoff = Date.now() - KEEP_DAYS * 864e5;
  for (const f of await readdir(dir)) {
    const m = f.match(/^atlas-(\d{4}-\d{2}-\d{2})\.json$/);
    if (m && Date.parse(m[1]) < cutoff) await unlink(join(dir, f)).catch(() => {});
  }
}

/** Hourly copies (latest write of each hour, kept 48h) so one bad write cannot erase a whole day. */
async function hourly(dir, source) {
  await copyFile(source, join(dir, `atlas-${new Date().toISOString().slice(0, 13)}h.json`));
  for (const f of await readdir(dir)) {
    const m = f.match(/^atlas-(\d{4}-\d{2}-\d{2}T\d{2})h\.json$/);
    if (m && Date.parse(`${m[1]}:00:00Z`) < Date.now() - 48 * 36e5) await unlink(join(dir, f)).catch(() => {});
  }
}

async function api(req, res, url) {
  if (!dataDir) return json(res, 404, { error: "storage not configured" });
  const file = join(dataDir, "atlas.json");

  if (req.method === "GET") {
    let body;
    try {
      body = await readFile(file);
    } catch {
      return json(res, 404, { error: "empty" });
    }
    return res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }).end(body);
  }

  if (req.method === "PUT") {
    // A web page on another site can fire requests at localhost: require our own origin and a JSON body
    // (which browsers will not send cross-origin without a preflight this server never approves).
    if (!ORIGINS.has(req.headers.origin ?? "") || !String(req.headers["content-type"]).startsWith("application/json"))
      return json(res, 403, { error: "forbidden" });
    let data;
    try {
      data = JSON.parse(await readBody(req));
    } catch {
      return json(res, 400, { error: "bad json" });
    }
    if (data?.app !== "atlas" || !Array.isArray(data.folders) || !Array.isArray(data.boards) || typeof data.updatedAt !== "number")
      return json(res, 400, { error: "not an atlas state" });

    // never let an older copy (a stale tab, a browser that was offline) overwrite newer data
    try {
      const current = JSON.parse(await readFile(file, "utf8"));
      if (current.updatedAt > data.updatedAt) return json(res, 409, { error: "stale", updatedAt: current.updatedAt });
    } catch {
      /* no file yet */
    }

    await mkdir(dataDir, { recursive: true });
    const tmp = `${file}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 2));
    await rename(tmp, file);

    let mirrored = false;
    await snapshot(join(dataDir, "snapshots"), file).catch((e) => console.error("snapshot:", e.message));
    await hourly(join(dataDir, "snapshots"), file).catch((e) => console.error("hourly:", e.message));
    if (backupDir) {
      try {
        await snapshot(backupDir, file);
        mirrored = true;
      } catch (e) {
        console.error("backup mirror failed:", e.message);
      }
    }
    return json(res, 200, { ok: true, savedAt: Date.now(), mirrored });
  }

  return json(res, 405, { error: "method not allowed" });
}

createServer(async (req, res) => {
  try {
    // Reject odd Host headers (DNS rebinding): only ever answer as localhost.
    const host = req.headers.host ?? "";
    if (host !== `localhost:${port}` && host !== `127.0.0.1:${port}`) {
      res.writeHead(421).end("Misdirected request");
      return;
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/api/state") return await api(req, res, url);
    const wanted = normalize(join(root, decodeURIComponent(url.pathname)));
    if (wanted !== root && !wanted.startsWith(root + sep)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    // a real file, else the app shell (client-side app)
    const path = (await file(wanted)) ?? (await file(join(wanted, "index.html"))) ?? join(root, "index.html");
    const body = await readFile(path);
    const name = path.slice(root.length + 1);
    res.writeHead(200, {
      "content-type": TYPES[extname(path)] ?? "application/octet-stream",
      // the service worker and the shell must always revalidate; hashed assets never change
      "cache-control": name.startsWith("assets/") ? "public, max-age=31536000, immutable" : "no-cache",
    });
    res.end(body);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500);
    res.end("Server error");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`Atlas on http://localhost:${port} (serving ${root}; data ${dataDir ?? "none"}; backup ${backupDir ?? "none"})`),
);
