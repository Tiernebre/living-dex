// Tracks the first time the hub has ever seen a given Pokémon (by PID + OT ID).
// Gen 3 saves don't record a real catch date, so this is our "first seen by the
// app" substitute. Persisted to data/catch-log.json so history survives restarts.

import type { DecodedPokemon } from "./protocol.ts";

const LOG_PATH = new URL("../data/catch-log.json", import.meta.url).pathname;
const WRITE_DEBOUNCE_MS = 500;

export type CatchLog = Record<string, number>;

export function catchKey(mon: Pick<DecodedPokemon, "pid" | "otId">): string {
  return `${mon.pid}:${mon.otId}`;
}

let log: CatchLog = {};
let loaded = false;
let writeTimer: number | null = null;

export async function loadCatchLog(): Promise<CatchLog> {
  try {
    const text = await Deno.readTextFile(LOG_PATH);
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") log = parsed as CatchLog;
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) {
      console.warn(`[catch-log] failed to read ${LOG_PATH}:`, err);
    }
    log = {};
  }
  loaded = true;
  return { ...log };
}

export function getCatchLog(): CatchLog {
  return { ...log };
}

// Returns the keys that were newly added (empty if nothing changed).
export function recordPokemon(mons: Iterable<DecodedPokemon | null>, now = Date.now()): string[] {
  if (!loaded) return [];
  const added: string[] = [];
  for (const mon of mons) {
    if (!mon || mon.isEgg) continue;
    const key = catchKey(mon);
    if (log[key] === undefined) {
      log[key] = now;
      added.push(key);
    }
  }
  if (added.length) scheduleWrite();
  return added;
}

function scheduleWrite() {
  if (writeTimer !== null) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void flush();
  }, WRITE_DEBOUNCE_MS);
}

async function flush() {
  try {
    await Deno.mkdir(new URL("../data/", import.meta.url).pathname, { recursive: true });
    const sorted: CatchLog = {};
    for (const k of Object.keys(log).sort()) sorted[k] = log[k];
    await Deno.writeTextFile(LOG_PATH, JSON.stringify(sorted, null, 2) + "\n");
  } catch (err) {
    console.error("[catch-log] write failed:", err);
  }
}
