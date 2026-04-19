#!/usr/bin/env -S deno run --allow-read

const KNOWN_ROMS: Record<string, { game: string; revision: string }> = {
  "5b64eacf892920518db4ec664e62a086dd5f5bc8": { game: "Ruby", revision: "Rev 2" },
  "89b45fb172e6b55d51fc0e61989775187f6fe63c": { game: "Sapphire", revision: "Rev 2" },
  "f3ae088181bf583e55daf962a92bb46f4f1d07b7": { game: "Emerald", revision: "Rev 0" },
  "dd5945db9b930750cb39d00c84da8571feebf417": { game: "FireRed", revision: "Rev 1" },
  "7862c67bdecbe21d1d69ce082ce34327e1c6ed5e": { game: "LeafGreen", revision: "Rev 1" },
};

async function sha1(path: string): Promise<string> {
  const bytes = await Deno.readFile(path);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const DUMPS_DIR = new URL("../dumps/", import.meta.url).pathname;

async function listDumps(): Promise<string[]> {
  const paths: string[] = [];
  for await (const entry of Deno.readDir(DUMPS_DIR)) {
    if (entry.isFile && entry.name.toLowerCase().endsWith(".gba")) {
      paths.push(`${DUMPS_DIR}${entry.name}`);
    }
  }
  return paths.sort();
}

if (import.meta.main) {
  const paths = Deno.args.length > 0 ? Deno.args : await listDumps();
  if (paths.length === 0) {
    console.error(`no .gba files found in ${DUMPS_DIR}`);
    Deno.exit(1);
  }

  let anyFailed = false;
  for (const path of paths) {
    try {
      const hash = await sha1(path);
      const match = KNOWN_ROMS[hash];
      if (match) {
        console.log(`✅  ${path}  →  ${match.game} (${match.revision})`);
      } else {
        anyFailed = true;
        console.log(`❌  ${path}  →  ${hash} (not a recognized revision)`);
      }
    } catch (err) {
      anyFailed = true;
      const msg = err instanceof Deno.errors.NotFound
        ? "file not found"
        : err instanceof Deno.errors.PermissionDenied
          ? "permission denied"
          : err instanceof Error
            ? err.message
            : String(err);
      console.log(`⚠️  ${path}  →  ${msg}`);
    }
  }
  Deno.exit(anyFailed ? 2 : 0);
}
