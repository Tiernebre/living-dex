// Dev orchestrator: runs the hub and the web UI together.
// Streams both outputs with a color-coded label and forwards Ctrl-C.

const procs: { name: string; color: string; proc: Deno.ChildProcess }[] = [];

type LineFilter = (line: string) => boolean;

function spawn(
  name: string,
  color: string,
  cmd: string,
  args: string[],
  cwd?: string,
  env?: Record<string, string>,
  filter?: LineFilter,
) {
  const proc = new Deno.Command(cmd, {
    args,
    cwd,
    env,
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  pipe(name, color, proc.stdout, filter);
  pipe(name, color, proc.stderr, filter);
  procs.push({ name, color, proc });
}

async function pipe(
  name: string,
  color: string,
  stream: ReadableStream<Uint8Array>,
  filter?: LineFilter,
) {
  const decoder = new TextDecoder();
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  let carry = "";
  let lastBlank = false;
  for await (const chunk of stream) {
    const lines = (carry + decoder.decode(chunk)).split("\n");
    carry = lines.pop() ?? "";
    for (const line of lines) {
      if (filter && !filter(line)) continue;
      const isBlank = line.trim() === "";
      if (isBlank && lastBlank) continue;
      lastBlank = isBlank;
      console.log(prefix + line);
    }
  }
  if (carry) console.log(prefix + carry);
}

// Vite prints its own ready banner with a :5173 URL that the user shouldn't
// click — the hub at :8080 is the single user-facing endpoint. Swallow vite's
// banner; the hub prints an authoritative one on startup.
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
const viteBannerFilter: LineFilter = (line) => {
  const s = stripAnsi(line).trim();
  if (s.startsWith("VITE v")) return false;
  if (s.startsWith("➜")) return false;
  if (s.startsWith("press h")) return false;
  return true;
};

async function shutdown() {
  for (const { proc } of procs) {
    try { proc.kill("SIGTERM"); } catch { /* already exited */ }
  }
  const results = await Promise.allSettled(procs.map((p) => p.proc.status));
  const failed = results.some((r) => r.status === "fulfilled" && !r.value.success);
  Deno.exit(failed ? 1 : 0);
}

Deno.addSignalListener("SIGINT", shutdown);
Deno.addSignalListener("SIGTERM", shutdown);

const args = Deno.args.filter((a) => a !== "--no-mgba");
const noMgba = Deno.args.includes("--no-mgba");

spawn("hub", "36", "deno", ["task", "dev:hub"], undefined, { LIVING_DEX_DEV: "1" });
spawn("web", "35", "npm", ["run", "dev"], "web", undefined, viteBannerFilter);

if (!noMgba) {
  const ROM = args[0] ?? "roms/ruby.gba";
  const MGBA = "/Applications/mGBA.app/Contents/MacOS/mGBA";
  try {
    await Deno.stat(MGBA);
    spawn("mgba", "33", MGBA, [ROM]);
  } catch {
    console.log(`\x1b[33m[mgba]\x1b[0m not found at ${MGBA} — skipping`);
  }
}

// If either child exits on its own, tear the whole thing down.
await Promise.race(procs.map((p) => p.proc.status));
await shutdown();
