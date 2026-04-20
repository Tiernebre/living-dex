// Watch saves/*.sav; on change, parse and push SaveInfo into the store, keyed by game stem.
// Ruby and Sapphire use the same Gen 3 RS format; Emerald and FR/LG need their own parsers.

import { parseRubySave } from "../decoder/save-ruby.ts";
import { store } from "../state.ts";
import type { GameStem, SaveInfo } from "../protocol.ts";
import { GAME_STEMS } from "../protocol.ts";

const SAVES_DIR = new URL("../../saves/", import.meta.url).pathname;
const DEBOUNCE_MS = 150;

type Parser = (buf: Uint8Array, game: GameStem) => SaveInfo | null;

const PARSERS: Partial<Record<GameStem, Parser>> = {
  ruby: parseRubySave,
  sapphire: parseRubySave,
};

function stemOf(path: string): GameStem | null {
  const name = path.split("/").pop()?.toLowerCase() ?? "";
  if (!name.endsWith(".sav")) return null;
  const stem = name.slice(0, -4);
  return (GAME_STEMS as readonly string[]).includes(stem) ? (stem as GameStem) : null;
}

async function parseAndPush(path: string) {
  const game = stemOf(path);
  if (!game) return;
  const parse = PARSERS[game];
  if (!parse) {
    console.warn(`[save-watcher] ${game}: no parser yet, skipping`);
    return;
  }
  try {
    const buf = await Deno.readFile(path);
    const info = parse(buf, game);
    if (!info) {
      console.warn(`[save-watcher] ${path}: no valid save data found`);
      return;
    }
    const { playerName, playTime } = info;
    console.log(
      `[save-watcher] ${game}: ${playerName || "(no name)"} — ` +
        `${playTime.hours}:${String(playTime.minutes).padStart(2, "0")}:` +
        `${String(playTime.seconds).padStart(2, "0")}`,
    );
    store.setSave(game, info);
  } catch (err) {
    console.error(`[save-watcher] failed to parse ${path}:`, err);
  }
}

export async function startSaveWatcher() {
  console.log(`[save-watcher] watching ${SAVES_DIR}`);

  try {
    for await (const entry of Deno.readDir(SAVES_DIR)) {
      if (entry.isFile && entry.name.toLowerCase().endsWith(".sav")) {
        await parseAndPush(`${SAVES_DIR}${entry.name}`);
      }
    }
  } catch (err) {
    console.error("[save-watcher] initial scan failed:", err);
  }

  const pending = new Map<string, number>();
  const watcher = Deno.watchFs(SAVES_DIR);
  for await (const event of watcher) {
    if (event.kind !== "modify" && event.kind !== "create") continue;
    for (const path of event.paths) {
      if (!path.toLowerCase().endsWith(".sav")) continue;
      const existing = pending.get(path);
      if (existing !== undefined) clearTimeout(existing);
      pending.set(
        path,
        setTimeout(() => {
          pending.delete(path);
          void parseAndPush(path);
        }, DEBOUNCE_MS),
      );
    }
  }
}
