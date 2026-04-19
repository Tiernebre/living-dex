import type { WsMessage } from "../../hub/protocol.ts";
import { useLivingDex } from "./store";

const RECONNECT_MIN_MS = 500;
const RECONNECT_MAX_MS = 10_000;

export function connect() {
  let delay = RECONNECT_MIN_MS;
  let socket: WebSocket | null = null;

  const open = () => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    socket = new WebSocket(`${proto}://${location.host}/ws`);
    socket.onopen = () => {
      delay = RECONNECT_MIN_MS;
    };
    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WsMessage;
        useLivingDex.getState().apply(msg);
      } catch (err) {
        console.error("[ws] bad message", err);
      }
    };
    socket.onclose = () => {
      setTimeout(open, delay);
      delay = Math.min(delay * 2, RECONNECT_MAX_MS);
    };
    socket.onerror = () => socket?.close();
  };

  open();
}
