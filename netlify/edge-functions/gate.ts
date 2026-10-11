// Single-user gate. Every request needs a signed session cookie, issued by posting the
// password to /__login. Fails closed: with no ATLAS_PASSWORD / ATLAS_SECRET set, nothing is served.
//   ATLAS_PASSWORD  the password you type
//   ATLAS_SECRET    long random string used to sign cookies (rotating it logs everyone out)

const COOKIE = "atlas_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const enc = new TextEncoder();

const env = (k: string): string | undefined =>
  (globalThis as unknown as { Netlify?: { env: { get(k: string): string | undefined } } }).Netlify?.env.get(k);

async function hmac(secret: string, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

/** Constant-time equality of two strings (compared as HMACs so lengths never leak). */
async function same(secret: string, a: string, b: string) {
  const [x, y] = await Promise.all([hmac(secret, a), hmac(secret, b)]);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

async function validSession(secret: string, cookieHeader: string | null) {
  const raw = cookieHeader?.split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!raw) return false;
  const [exp, sig] = raw.split(".");
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return same(secret, sig, hex(await hmac(secret, `atlas:${exp}`)));
}

const page = (error: boolean) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Atlas · Sign in</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0a0a;color:#ededed;font-family:Inter,system-ui,sans-serif}
form{width:min(340px,88vw);background:#16171b;border:1px solid #262626;border-radius:16px;padding:26px;display:grid;gap:14px}
.mark{width:34px;height:34px;border-radius:9px;background:#0a0a0a;border:1px solid #262626;color:#2563eb;display:grid;place-items:center;font:700 12px ui-monospace,monospace}
h1{margin:0;font-size:18px}p{margin:0;color:#a3a3a3;font-size:13px}.err{color:#f87171}
input{background:#0f1013;border:1px solid #262626;border-radius:9px;padding:11px 12px;color:inherit;font:inherit}
input:focus{outline:none;border-color:#2563eb}
button{background:#2563eb;border:0;border-radius:9px;padding:11px;color:#fff;font:inherit;font-weight:600;cursor:pointer}button:hover{background:#1d4ed8}
</style></head><body><form method="post" action="/__login">
<div class="mark">MW</div><h1>Atlas</h1>
<p class="${error ? "err" : ""}">${error ? "Wrong password." : "Private. Sign in to continue."}</p>
<input type="password" name="password" placeholder="Password" autocomplete="current-password" autofocus required>
<button>Sign in</button></form></body></html>`;

const html = (body: string, status: number) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });

export default async function gate(request: Request, context: { next: () => Promise<Response> }) {
  const password = env("ATLAS_PASSWORD");
  const secret = env("ATLAS_SECRET");
  if (!password || !secret) return new Response("Atlas is not configured.", { status: 503, headers: { "cache-control": "no-store" } });

  const url = new URL(request.url);

  if (url.pathname === "/__login" && request.method === "POST") {
    const given = String((await request.formData()).get("password") ?? "");
    if (!(await same(secret, given, password))) {
      await new Promise((r) => setTimeout(r, 800)); // slow down guessing
      return html(page(true), 401);
    }
    const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
    const sig = hex(await hmac(secret, `atlas:${exp}`));
    return new Response(null, {
      status: 303,
      headers: {
        location: "/",
        "cache-control": "no-store",
        "set-cookie": `${COOKIE}=${exp}.${sig}; Max-Age=${MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Strict`,
      },
    });
  }

  if (url.pathname === "/__logout") {
    return new Response(null, {
      status: 303,
      headers: { location: "/", "set-cookie": `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`, "cache-control": "no-store" },
    });
  }

  if (await validSession(secret, request.headers.get("cookie"))) return context.next();

  // Anything but a page load gets a bare 401 so the service worker / fetches fail cleanly.
  const wantsPage = request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html");
  return wantsPage ? html(page(false), 401) : new Response("Unauthorized", { status: 401, headers: { "cache-control": "no-store" } });
}

export const config = { path: "/*" };
