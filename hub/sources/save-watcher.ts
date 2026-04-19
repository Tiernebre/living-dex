// Phase 1b: watch saves/*.sav, parse on change, feed the same store as the live source.
// Stub for now — the actual save-sector handling + decoder plumb in here.

import { join } from "jsr:@std/path@^1.0.0";

const SAVES_DIR = new URL("../../saves/", import.meta.url).pathname;

export async function startSaveWatcher() {
  console.log(`[save-watcher] watching ${SAVES_DIR}`);
  const watcher = Deno.watchFs(SAVES_DIR);
  for await (const event of watcher) {
    if (event.kind !== "modify" && event.kind !== "create") continue;
    for (const path of event.paths) {
      if (!path.toLowerCase().endsWith(".sav")) continue;
      console.log(`[save-watcher] change: ${path}`);
      // TODO: read file, identify game from filename or content, parse sectors,
      //       verify checksums, decode party + all boxes, push into `store`
      //       tagged with source = `save@<Date.now()>`.
    }
  }
  void join; // retained for future join usage
}
