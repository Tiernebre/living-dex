// Pretty startup banner. Replaces the one-line ready log and stands in for
// vite's own banner (filtered in scripts/dev.ts) so the user only sees one
// authoritative URL — the hub's, which is the single user-facing endpoint.

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

export type BannerRow = { label: string; value: string; dim?: boolean };

export function printBanner(opts: { mode: "dev" | "prod"; rows: BannerRow[] }) {
  const { mode, rows } = opts;
  const title = `${C.bold}${C.red}LIVING${C.reset} ${C.bold}${C.blue}DEX${C.reset}`;
  const tag = `${C.gray}·${C.reset}  ${C.dim}${mode}${C.reset}`;
  const labelWidth = Math.max(...rows.map((r) => r.label.length));

  const out: string[] = ["", `  ${title}  ${tag}`, ""];
  for (const { label, value, dim } of rows) {
    const pad = " ".repeat(labelWidth - label.length);
    const arrow = dim ? `${C.gray}➜${C.reset}` : `${C.green}➜${C.reset}`;
    const lbl = dim
      ? `${C.dim}${label}${C.reset}`
      : `${C.bold}${label}${C.reset}`;
    const val = dim ? `${C.dim}${value}${C.reset}` : `${C.cyan}${value}${C.reset}`;
    out.push(`  ${arrow}  ${lbl}${pad}   ${val}`);
  }
  out.push("");
  console.log(out.join("\n"));
}
