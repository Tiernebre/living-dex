// Watch saves/*.sav; on change, parse and push SaveInfo into the store.
// MVP: only handles ruby.sav.

import { parseRubySave } from "../decoder/save-ruby.ts";
import { store } from "../state.ts";

const SAVES_DIR = new URL("../../saves/", import.meta.url).pathname;
const DEBOUNCE_MS = 150;

async function parseAndPush(path: string) {
  try {
    const buf = await Deno.readFile(path);
    const info = parseRubySave(buf);
    if (!info) {
      console.warn(`[save-watcher] ${path}: no valid SaveBlock2 found`);
      return;
    }
    const { playerName, playTime } = info;
    console.log(
      `[save-watcher] ${path}: ${playerName || "(no name)"} — ` +
        `${playTime.hours}:${String(playTime.minutes).padStart(2, "0")}:` +
        `${String(playTime.seconds).padStart(2, "0")}`,
    );
    store.setSaveInfo(info);
  } catch (err) {
    console.error(`[save-watcher] failed to parse ${path}:`, err);
  }
}

export async function startSaveWatcher() {
  console.log(`[save-watcher] watching ${SAVES_DIR}`);

  // Parse whatever's already on disk so a fresh session shows something.
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
