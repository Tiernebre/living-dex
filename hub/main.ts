import { loadCatchLog } from "./catch-log.ts";
import { startLuaListener } from "./sources/lua-tcp.ts";
import { startSaveWatcher } from "./sources/save-watcher.ts";
import { store } from "./state.ts";

const TCP_PORT = 8889;
const HTTP_PORT = 8080;

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
  return new Response("Living Dex hub. UI served by vite dev server.", { status: 200 });
}

await loadCatchLog();
store.hydrateCatchLog();
startLuaListener(TCP_PORT);
startSaveWatcher();

Deno.serve({ hostname: "127.0.0.1", port: HTTP_PORT }, handleHttp);
console.log(`[hub] http+ws on http://127.0.0.1:${HTTP_PORT} (ws at /ws)`);
