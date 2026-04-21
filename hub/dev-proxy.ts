// Reverse-proxies non-hub requests to the vite dev server so the hub can be
// the single user-facing URL while keeping HMR. Used only when LIVING_DEX_DEV=1.

const VITE_HOST = "127.0.0.1";
const VITE_PORT = 5173;

export function proxyToVite(req: Request): Response | Promise<Response> {
  const url = new URL(req.url);
  const target = `http://${VITE_HOST}:${VITE_PORT}${url.pathname}${url.search}`;

  if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
    return proxyWebSocket(req, target.replace(/^http/, "ws"));
  }

  const headers = new Headers(req.headers);
  headers.set("host", `${VITE_HOST}:${VITE_PORT}`);
  return fetch(target, {
    method: req.method,
    headers,
    body: req.body,
    redirect: "manual",
  });
}

function proxyWebSocket(req: Request, targetUrl: string): Response {
  const protocols = req.headers.get("sec-websocket-protocol")?.split(",").map((s) => s.trim());
  const { socket: client, response } = Deno.upgradeWebSocket(req, { protocol: protocols?.[0] });
  const upstream = new WebSocket(targetUrl, protocols);
  upstream.binaryType = "arraybuffer";

  const clientQueue: (string | ArrayBufferLike | Blob)[] = [];
  let upstreamOpen = false;

  upstream.onopen = () => {
    upstreamOpen = true;
    for (const msg of clientQueue) upstream.send(msg as string);
    clientQueue.length = 0;
  };
  upstream.onmessage = (e) => {
    if (client.readyState === WebSocket.OPEN) client.send(e.data);
  };
  upstream.onclose = (e) => {
    if (client.readyState === WebSocket.OPEN) client.close(e.code <= 1015 ? e.code : 1000, e.reason);
  };
  upstream.onerror = () => {
    if (client.readyState === WebSocket.OPEN) client.close(1011, "upstream error");
  };

  client.onmessage = (e) => {
    if (upstreamOpen && upstream.readyState === WebSocket.OPEN) {
      upstream.send(e.data);
    } else {
      clientQueue.push(e.data);
    }
  };
  client.onclose = (e) => {
    if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
      upstream.close(e.code <= 1015 ? e.code : 1000, e.reason);
    }
  };
  client.onerror = () => {
    if (upstream.readyState === WebSocket.OPEN) upstream.close(1011, "client error");
  };

  return response;
}
