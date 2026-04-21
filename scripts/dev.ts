// Dev orchestrator: runs the hub and the web UI together.
// Streams both outputs with a color-coded label and forwards Ctrl-C.

const procs: { name: string; color: string; proc: Deno.ChildProcess }[] = [];

function spawn(name: string, color: string, cmd: string, args: string[], cwd?: string, env?: Record<string, string>) {
  const proc = new Deno.Command(cmd, {
    args,
    cwd,
    env,
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  pipe(name, color, proc.stdout);
  pipe(name, color, proc.stderr);
  procs.push({ name, color, proc });
}

async function pipe(name: string, color: string, stream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  let carry = "";
  for await (const chunk of stream) {
    const lines = (carry + decoder.decode(chunk)).split("\n");
    carry = lines.pop() ?? "";
    for (const line of lines) console.log(prefix + line);
  }
  if (carry) console.log(prefix + carry);
}

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
spawn("web", "35", "npm", ["run", "dev"], "web");
console.log("\x1b[36m[hub]\x1b[0m open http://127.0.0.1:8080 (single user-facing URL; vite :5173 is proxied)");

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
