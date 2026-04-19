// TCP listener for the mGBA Lua collector.
// Envelope frame (see lua/core/envelope.lua):
//   magic(2) "LD" | version(1) | type(1) | region(1) | index(1) | length(2 BE) | payload(length)

import { MSG_TYPE, REGION, type GameCode, type GameInfo } from "../protocol.ts";
import { decodePokemon } from "../decoder/gen3.ts";
import { store } from "../state.ts";

const HEADER_SIZE = 8;
const PARTY_SLOT_BYTES = 100;

const GAME_NAMES: Record<GameCode, string> = {
  AXVE: "Ruby",
  AXPE: "Sapphire",
  BPEE: "Emerald",
  BPRE: "FireRed",
  BPGE: "LeafGreen",
};

export async function startLuaListener(port: number) {
  const listener = Deno.listen({ hostname: "127.0.0.1", port });
  console.log(`[lua-tcp] listening on 127.0.0.1:${port}`);
  for await (const conn of listener) {
    handleConnection(conn).catch((err) => console.error("[lua-tcp]", err));
  }
}

async function handleConnection(conn: Deno.TcpConn) {
  console.log("[lua-tcp] collector connected");
  store.setLiveConnected(true);
  const buf = new Uint8Array(64 * 1024);
  let acc = new Uint8Array(0);

  try {
    while (true) {
      const n = await conn.read(buf);
      if (n === null) break;
      acc = concat(acc, buf.subarray(0, n));
      acc = drainFrames(acc);
    }
  } catch (err) {
    console.error("[lua-tcp] read error:", err);
  } finally {
    store.setLiveConnected(false);
    store.setGame(null);
    console.log("[lua-tcp] collector disconnected");
  }
}

function drainFrames(acc: Uint8Array): Uint8Array {
  while (acc.length >= HEADER_SIZE) {
    if (acc[0] !== 0x4C || acc[1] !== 0x44) { // "LD"
      console.warn("[lua-tcp] bad magic; dropping stream");
      return new Uint8Array(0);
    }
    const length = (acc[6] << 8) | acc[7];
    const total = HEADER_SIZE + length;
    if (acc.length < total) return acc;
    handleFrame(acc[3], acc[4], acc[5], acc.subarray(HEADER_SIZE, total));
    acc = acc.subarray(total);
  }
  return acc;
}

function handleFrame(type: number, region: number, index: number, payload: Uint8Array) {
  if (type === MSG_TYPE.HELLO) {
    const code = new TextDecoder().decode(payload.subarray(0, 4)) as GameCode;
    const revision = payload[4];
    const info: GameInfo = { code, revision, name: GAME_NAMES[code] ?? "Unknown" };
    console.log(`[lua-tcp] hello: ${info.name} rev ${revision}`);
    store.setGame(info);
    return;
  }

  if (type !== MSG_TYPE.REGION) return;

  const source = "live" as const;
  if (region === REGION.PARTY) {
    for (let slot = 0; slot < 6; slot++) {
      const bytes = payload.subarray(slot * PARTY_SLOT_BYTES, (slot + 1) * PARTY_SLOT_BYTES);
      store.setPartySlot(slot, decodePokemon(bytes), source);
    }
    return;
  }
  if (region === REGION.ENEMY_PARTY) {
    for (let slot = 0; slot < 6; slot++) {
      const bytes = payload.subarray(slot * PARTY_SLOT_BYTES, (slot + 1) * PARTY_SLOT_BYTES);
      store.setEnemySlot(slot, decodePokemon(bytes), source);
    }
    return;
  }
  if (region === REGION.LOCATION) {
    const mapGroup = payload[0];
    const mapNum = payload[1];
    store.setLocation({ mapGroup, mapNum });
    return;
  }
  if (region === REGION.BATTLE) {
    // gMain.inBattle is bit 1 of a u8 packed with oamLoadDisabled at bit 0.
    store.setInBattle((payload[0] & 0x02) !== 0);
    return;
  }
  // TODO: BOX_SLOT, DAYCARE, TRAINER, DEX.
  void index;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
