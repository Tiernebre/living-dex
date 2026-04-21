import { loadCatchLog } from "./catch-log.ts";
import { proxyToVite } from "./dev-proxy.ts";
import { startLuaListener } from "./sources/lua-tcp.ts";
import { startSaveWatcher } from "./sources/save-watcher.ts";
import { store } from "./state.ts";

const TCP_PORT = 8889;
const HTTP_PORT = 8080;
const DEV = Deno.env.get("LIVING_DEX_DEV") === "1";
const WEB_DIST = new URL("../web/dist/", import.meta.url);

function handleWebSocket(req: Request): Response {
  const { socket, response } = Deno.upgradeWebSocket(req);
  let unsubscribe: (() => void) | null = null;

  socket.onopen = () => {
    unsubscribe = store.subscribe((msg) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(msg));
      }
    });
  };
  socket.onclose = () => unsubscribe?.();
  socket.onerror = () => unsubscribe?.();

  return response;
}

function handleHttp(req: Request): Response | Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname === "/ws") {
    if (req.headers.get("upgrade") !== "websocket") {
      return new Response("expected websocket upgrade", { status: 426 });
    }
    return handleWebSocket(req);
  }
  if (url.pathname === "/health") {
    return Response.json({ ok: true, state: store.snapshot() });
  }
  if (DEV) return proxyToVite(req);
  return serveStatic(url.pathname);
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

async function serveStatic(pathname: string): Promise<Response> {
  const safe = pathname.replace(/^\/+/, "").replace(/\.\.+/g, "");
  const candidates = safe ? [safe] : ["index.html"];
  for (const rel of candidates) {
    try {
      const fileUrl = new URL(rel, WEB_DIST);
      const file = await Deno.open(fileUrl, { read: true });
      const ext = rel.slice(rel.lastIndexOf("."));
      return new Response(file.readable, {
        headers: { "content-type": MIME[ext] ?? "application/octet-stream" },
      });
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }
  }
  // SPA fallback: serve index.html for unknown routes (client-side routing).
  try {
    const file = await Deno.open(new URL("index.html", WEB_DIST), { read: true });
    return new Response(file.readable, { headers: { "content-type": MIME[".html"] } });
  } catch {
    return new Response("web/dist not built — run `npm --prefix web run build`", { status: 404 });
  }
}

await loadCatchLog();
store.hydrateCatchLog();
startLuaListener(TCP_PORT);
startSaveWatcher();

Deno.serve({ hostname: "127.0.0.1", port: HTTP_PORT }, handleHttp);
console.log(
  `[hub] http+ws on http://127.0.0.1:${HTTP_PORT} (ws at /ws) — ${DEV ? "dev (proxying to vite :5173)" : "serving web/dist"}`,
);
