import { useEffect, useState } from "react";
import { useLivingDex } from "./store";
import speciesData from "./species.json";
import movesData from "./moves.json";
import encountersData from "./encounters.json";
import type { DecodedPokemon } from "../../hub/protocol.ts";

type EncounterPokemon = {
  species: number;
  nationalDex: number;
  name: string;
  minLevel: number;
  maxLevel: number;
  chance: number;
};
type MethodTable = { method: string; rate: number; encounters: EncounterPokemon[] };
type LocationEntry = { name: string; label: string; methods: MethodTable[] };
const encounters = encountersData as Record<string, LocationEntry>;

type GrowthRate =
  | "slow"
  | "medium"
  | "fast"
  | "medium-slow"
  | "slow-then-very-fast"
  | "fast-then-very-slow";

type Species = {
  nationalDex: number;
  name: string;
  types: string[];
  sprite: string | null;
  internalIndex: number;
  baseStats: StatBlock;
  growthRate: GrowthRate;
};
const species = speciesData as Record<string, Species>;

type MoveInfo = {
  id: number;
  name: string;
  type: string;
  category: string;
  power: number | null;
  accuracy: number | null;
  pp: number;
};
const moves = movesData as Record<string, MoveInfo>;

function lookupMove(id: number): MoveInfo | undefined {
  return moves[String(id)];
}

function lookup(id: number): Species | undefined {
  return species[String(id)];
}

function formatSpeciesName(name: string): string {
  return name
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function serebiiGen3DexUrl(nationalDex: number): string {
  return `https://www.serebii.net/pokedex-rs/${String(nationalDex).padStart(3, "0")}.shtml`;
}

// Cumulative EXP to reach a given level for each growth curve.
// Formulas from Bulbapedia "Experience".
function expForLevel(level: number, rate: GrowthRate): number {
  if (level <= 1) return 0;
  const n = level;
  const n3 = n * n * n;
  switch (rate) {
    case "fast":
      return Math.floor((4 * n3) / 5);
    case "medium":
      return n3;
    case "slow":
      return Math.floor((5 * n3) / 4);
    case "medium-slow":
      return Math.floor((6 * n3) / 5 - 15 * n * n + 100 * n - 140);
    case "slow-then-very-fast":
      if (n < 50) return Math.floor((n3 * (100 - n)) / 50);
      if (n < 68) return Math.floor((n3 * (150 - n)) / 100);
      if (n < 98) return Math.floor((n3 * Math.floor((1911 - 10 * n) / 3)) / 500);
      return Math.floor((n3 * (160 - n)) / 100);
    case "fast-then-very-slow":
      if (n < 15) return Math.floor((n3 * (Math.floor((n + 1) / 3) + 24)) / 50);
      if (n < 36) return Math.floor((n3 * (n + 14)) / 50);
      return Math.floor((n3 * (Math.floor(n / 2) + 32)) / 50);
  }
}

function formatInt(n: number): string {
  return n.toLocaleString("en-US");
}

const STATS = [
  ["hp", "HP"],
  ["atk", "Atk"],
  ["def", "Def"],
  ["spa", "SpA"],
  ["spd", "SpD"],
  ["spe", "Spe"],
] as const;

type StatKey = (typeof STATS)[number][0];
type StatBlock = Record<StatKey, number>;

// Gen 3 nature table. Index matches hub/decoder/gen3.ts NATURES order.
// Natures where plus === minus are neutral (no effect).
const NATURE_STAT_ORDER: StatKey[] = ["atk", "def", "spe", "spa", "spd"];

function natureEffect(nature: string): { plus: StatKey; minus: StatKey } | null {
  const names = [
    "Hardy", "Lonely", "Brave", "Adamant", "Naughty",
    "Bold", "Docile", "Relaxed", "Impish", "Lax",
    "Timid", "Hasty", "Serious", "Jolly", "Naive",
    "Modest", "Mild", "Quiet", "Bashful", "Rash",
    "Calm", "Gentle", "Sassy", "Careful", "Quirky",
  ];
  const idx = names.indexOf(nature);
  if (idx < 0) return null;
  const plus = NATURE_STAT_ORDER[Math.floor(idx / 5)];
  const minus = NATURE_STAT_ORDER[idx % 5];
  if (plus === minus) return null;
  return { plus, minus };
}

// Colors chosen to clear WCAG AAA (7:1) against white.
const TYPE_COLORS: Record<string, string> = {
  normal: "#9099a1",
  fire: "#e62829",
  water: "#2980ef",
  electric: "#b8a429",
  grass: "#3fa129",
  ice: "#3fc8ef",
  fighting: "#a63129",
  poison: "#8f4096",
  ground: "#cca255",
  flying: "#8198e0",
  psychic: "#ef408f",
  bug: "#91a119",
  rock: "#a69138",
  ghost: "#704170",
  dragon: "#5060e1",
  dark: "#624d4e",
  steel: "#60a1b8",
  fairy: "#ef70ef",
};

function MovesList({ moves }: { moves: { id: number; pp: number }[] }) {
  if (moves.length === 0) return null;
  return (
    <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 6, maxWidth: 520 }}>
      {moves.map((m, i) => {
        const info = lookupMove(m.id);
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 8px",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 12,
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            {info ? <TypeBadge type={info.type} /> : <span style={{ opacity: 0.5 }}>?</span>}
            <span
              style={{
                fontWeight: 600,
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {info ? formatSpeciesName(info.name) : `Move #${m.id}`}
            </span>
            <span style={{ opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>
              {m.pp}/{info?.pp ?? "?"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const bg = TYPE_COLORS[type] ?? "#6b7280";
  return (
    <span
      style={{
        display: "inline-block",
        background: bg,
        color: "#fff",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        padding: "2px 8px",
        borderRadius: 999,
        textShadow: "0 1px 1px rgba(0,0,0,0.35)",
        lineHeight: 1.4,
      }}
    >
      {type}
    </span>
  );
}

function ivStyle(v: number): { color?: string; weight?: number } {
  if (v === 31) return { color: "var(--iv-perfect)", weight: 700 };
  if (v >= 26) return { color: "var(--iv-great)", weight: 600 };
  if (v >= 16) return {};
  if (v >= 1) return { color: "var(--iv-low)" };
  return { color: "var(--iv-worst)", weight: 600 };
}

function ivLabel(v: number): string {
  if (v === 31) return "Perfect (31)";
  if (v >= 26) return `Great (${v})`;
  if (v >= 16) return `Decent (${v})`;
  if (v >= 1) return `Low (${v})`;
  return "Worst (0)";
}

// Gen 3 stat formula (Bulbapedia "Stat"):
//   HP    = floor((2*Base + IV + floor(EV/4)) * L/100) + L + 10
//   Other = floor((floor((2*Base + IV + floor(EV/4)) * L/100) + 5) * nature)
function computeStats(
  base: StatBlock,
  ivs: StatBlock,
  evs: StatBlock,
  nature: string,
  level: number,
): StatBlock {
  const effect = natureEffect(nature);
  const out = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  for (const [k] of STATS) {
    const common = Math.floor(((2 * base[k] + ivs[k] + Math.floor(evs[k] / 4)) * level) / 100);
    if (k === "hp") {
      out[k] = common + level + 10;
    } else {
      const mod = effect?.plus === k ? 1.1 : effect?.minus === k ? 0.9 : 1.0;
      out[k] = Math.floor((common + 5) * mod);
    }
  }
  return out;
}

function StatsTable({
  ivs,
  evs,
  nature,
  baseStats,
  level,
}: {
  ivs: StatBlock;
  evs: StatBlock;
  nature: string;
  baseStats?: StatBlock;
  level?: number;
}) {
  const effect = natureEffect(nature);
  const colorFor = (k: StatKey) =>
    effect?.plus === k ? "var(--iv-great)" : effect?.minus === k ? "var(--iv-worst)" : undefined;
  const labelFor = (k: StatKey, label: string) =>
    effect?.plus === k ? `${label}+` : effect?.minus === k ? `${label}−` : label;
  return (
    <table style={{ marginTop: 6, fontSize: 12, borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ opacity: 0.6 }}>
          <th style={{ textAlign: "left", paddingRight: 10 }}></th>
          {STATS.map(([k, label]) => (
            <th
              key={k}
              style={{ textAlign: "right", padding: "0 6px", fontWeight: 500, color: colorFor(k) }}
            >
              {labelFor(k, label)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {baseStats && (
          <tr>
            <td style={{ paddingRight: 10, opacity: 0.7 }}>Base</td>
            {STATS.map(([k]) => (
              <td key={k} style={{ textAlign: "right", padding: "0 6px", fontVariantNumeric: "tabular-nums" }}>
                {baseStats[k]}
              </td>
            ))}
          </tr>
        )}
        <tr>
          <td style={{ paddingRight: 10, opacity: 0.7 }}>IV</td>
          {STATS.map(([k]) => {
            const v = ivs[k];
            const { color, weight } = ivStyle(v);
            return (
              <td
                key={k}
                style={{
                  textAlign: "right",
                  padding: "0 6px",
                  fontVariantNumeric: "tabular-nums",
                  color,
                  fontWeight: weight,
                }}
                title={ivLabel(v)}
              >
                {v}
              </td>
            );
          })}
        </tr>
        <tr>
          <td style={{ paddingRight: 10, opacity: 0.7 }}>EV</td>
          {STATS.map(([k]) => (
            <td key={k} style={{ textAlign: "right", padding: "0 6px", fontVariantNumeric: "tabular-nums" }}>
              {evs[k]}
            </td>
          ))}
        </tr>
        {baseStats && level !== undefined && level !== 100 && (() => {
          const current = computeStats(baseStats, ivs, evs, nature, level);
          return (
            <tr>
              <td style={{ paddingRight: 10, opacity: 0.7 }}>Lv{level}</td>
              {STATS.map(([k]) => (
                <td
                  key={k}
                  style={{
                    textAlign: "right",
                    padding: "0 6px",
                    fontVariantNumeric: "tabular-nums",
                    color: colorFor(k),
                    fontWeight: 600,
                  }}
                >
                  {current[k]}
                </td>
              ))}
            </tr>
          );
        })()}
        {baseStats && (() => {
          const lv100 = computeStats(baseStats, ivs, evs, nature, 100);
          return (
            <tr>
              <td style={{ paddingRight: 10, opacity: 0.7 }}>Lv100</td>
              {STATS.map(([k]) => (
                <td
                  key={k}
                  style={{
                    textAlign: "right",
                    padding: "0 6px",
                    fontVariantNumeric: "tabular-nums",
                    color: colorFor(k),
                    fontWeight: 500,
                    opacity: 0.75,
                  }}
                >
                  {lv100[k]}
                </td>
              ))}
            </tr>
          );
        })()}
      </tbody>
    </table>
  );
}

const BADGE_TONES: Record<string, { bg: string; fg: string; dot: string }> = {
  success: { bg: "#dcfce7", fg: "#14532d", dot: "#16a34a" },
  danger: { bg: "#fee2e2", fg: "#7f1d1d", dot: "#dc2626" },
  info: { bg: "#dbeafe", fg: "#1e3a8a", dot: "#2563eb" },
  muted: { bg: "#f1f5f9", fg: "#475569", dot: "#94a3b8" },
};

function StatusBadge({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: string;
  tone: keyof typeof BADGE_TONES;
  detail?: string;
}) {
  const t = BADGE_TONES[tone];
  return (
    <span
      title={detail}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.4,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: t.dot }} />
      <span style={{ opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 10 }}>{label}</span>
      <span>{value}</span>
      {detail && <span style={{ opacity: 0.6, fontWeight: 400 }}>· {detail}</span>}
    </span>
  );
}

function ExpProgress({ level, exp, rate }: { level: number; exp: number; rate: GrowthRate }) {
  if (level >= 100) {
    return (
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
        EXP {formatInt(exp)} · <span style={{ fontWeight: 600 }}>Max level</span>
      </div>
    );
  }
  const curLevelExp = expForLevel(level, rate);
  const nextLevelExp = expForLevel(level + 1, rate);
  const span = Math.max(1, nextLevelExp - curLevelExp);
  const into = Math.max(0, exp - curLevelExp);
  const toGo = Math.max(0, nextLevelExp - exp);
  const pct = Math.min(100, Math.max(0, (into / span) * 100));
  return (
    <div style={{ fontSize: 12, marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, opacity: 0.8 }}>
        <span>
          EXP <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{formatInt(exp)}</span>
        </span>
        <span style={{ opacity: 0.75 }}>
          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{formatInt(toGo)}</span> to Lv {level + 1}
        </span>
      </div>
      <div
        style={{
          height: 5,
          borderRadius: 999,
          background: "var(--bg-muted)",
          overflow: "hidden",
        }}
        title={`${formatInt(into)} / ${formatInt(span)} EXP this level · ${rate}`}
      >
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)" }} />
      </div>
    </div>
  );
}

function PokemonCard({ mon, movesRight = false }: { mon: DecodedPokemon; movesRight?: boolean }) {
  const info = lookup(mon.species);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: 8,
        border: "1px solid var(--accent)",
        borderRadius: 8,
      }}
    >
      {info?.sprite && (
        <img src={info.sprite} alt={info.name} width={64} height={64} style={{ imageRendering: "pixelated" }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          {mon.nickname}
          {info && (
            <span style={{ fontWeight: 400, opacity: 0.7 }}>
              {" — "}
              <a
                href={serebiiGen3DexUrl(info.nationalDex)}
                target="_blank"
                rel="noreferrer"
                style={{ color: "inherit" }}
              >
                {formatSpeciesName(info.name)}
              </a>
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, opacity: 0.8, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span>Lv {mon.level} · {mon.nature}</span>
          {info && info.types.map((t) => <TypeBadge key={t} type={t} />)}
        </div>
        {info && <ExpProgress level={mon.level} exp={mon.experience} rate={info.growthRate} />}
        {movesRight ? (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 240px", minWidth: 0 }}>
              <StatsTable ivs={mon.ivs} evs={mon.evs} nature={mon.nature} baseStats={info?.baseStats} level={mon.level} />
            </div>
            <div style={{ flex: "1 1 240px", minWidth: 0 }}>
              <MovesList moves={mon.moves} />
            </div>
          </div>
        ) : (
          <>
            <StatsTable ivs={mon.ivs} evs={mon.evs} nature={mon.nature} baseStats={info?.baseStats} level={mon.level} />
            <MovesList moves={mon.moves} />
          </>
        )}
      </div>
    </div>
  );
}

function methodLabel(method: string): string {
  return method
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

const METHOD_STYLE: Record<string, { bg: string; fg: string; icon: string }> = {
  walk: { bg: "#dcfce7", fg: "#14532d", icon: "🌿" },
  surf: { bg: "#dbeafe", fg: "#1e3a8a", icon: "🌊" },
  "rock-smash": { bg: "#fef3c7", fg: "#78350f", icon: "⛏" },
  "old-rod": { bg: "#f3e8ff", fg: "#581c87", icon: "🎣" },
  "good-rod": { bg: "#ede9fe", fg: "#4c1d95", icon: "🎣" },
  "super-rod": { bg: "#e0e7ff", fg: "#3730a3", icon: "🎣" },
};

function MethodChip({ method }: { method: string }) {
  const s = METHOD_STYLE[method] ?? { bg: "#f1f5f9", fg: "#475569", icon: "" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: s.bg,
        color: s.fg,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {s.icon && <span aria-hidden>{s.icon}</span>}
      {methodLabel(method)}
    </span>
  );
}

function ChanceBar({ chance }: { chance: number }) {
  const pct = Math.min(100, Math.max(0, chance));
  const hue = 120 - (100 - pct) * 0.6; // red (rare) → green (common)
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 100 }}>
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 999,
          background: "var(--bg-muted)",
          overflow: "hidden",
          minWidth: 48,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: `hsl(${hue}, 65%, 45%)`,
            borderRadius: 999,
          }}
        />
      </div>
      <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, minWidth: 28, textAlign: "right" }}>
        {chance}%
      </span>
    </div>
  );
}

type Row = {
  method: string;
  methodRate: number;
  enc: EncounterPokemon;
};

function Encounters({ location }: { location: { mapGroup: number; mapNum: number } | null }) {
  if (!location) {
    return <p style={{ opacity: 0.6, fontStyle: "italic" }}>No location yet.</p>;
  }
  const entry = encounters[`${location.mapGroup}:${location.mapNum}`];
  if (!entry) {
    return (
      <p style={{ opacity: 0.6, fontStyle: "italic" }}>
        No wild encounters for map {location.mapGroup}:{location.mapNum}.
      </p>
    );
  }

  const rows: Row[] = [];
  for (const m of entry.methods) {
    for (const enc of m.encounters) {
      rows.push({ method: m.method, methodRate: m.rate, enc });
    }
  }

  const methodOrder = ["walk", "surf", "rock-smash", "old-rod", "good-rod", "super-rod"];
  const methodIdx = (m: string) => {
    const i = methodOrder.indexOf(m);
    return i < 0 ? methodOrder.length : i;
  };

  const th: React.CSSProperties = {
    textAlign: "left",
    fontWeight: 500,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "var(--accent-strong)",
    padding: "10px 12px",
    borderBottom: "1px solid var(--accent)",
    background: "color-mix(in srgb, var(--accent) 18%, var(--bg-surface))",
    position: "sticky",
    top: 0,
  };
  const td: React.CSSProperties = {
    padding: "8px 12px",
    borderBottom: "1px solid var(--border)",
    verticalAlign: "middle",
    fontSize: 13,
  };

  let lastMethod: string | null = null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 15 }}>{entry.label.replace(/([A-Za-z])(\d)/g, "$1 $2")}</strong>
        <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.6 }}>
          {rows.length} encounter{rows.length === 1 ? "" : "s"} · {entry.methods.length} method
          {entry.methods.length === 1 ? "" : "s"}
        </span>
      </div>
      <div
        style={{
          border: "1px solid var(--accent)",
          borderRadius: 10,
          overflow: "hidden",
          background: "color-mix(in srgb, var(--accent) 5%, var(--bg-elevated))",
          boxShadow: "var(--shadow)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 140 }}>Method</th>
              <th style={{ ...th, width: 56 }}></th>
              <th style={th}>Species</th>
              <th style={{ ...th, width: 100 }}>Types</th>
              <th style={{ ...th, width: 80, textAlign: "right" }}>Level</th>
              <th style={{ ...th, width: 160, textAlign: "right" }}>Chance</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .sort(
                (a, b) =>
                  methodIdx(a.method) - methodIdx(b.method) || b.enc.chance - a.enc.chance,
              )
              .map((r, i) => {
                const info = lookup(r.enc.species);
                const firstOfMethod = r.method !== lastMethod;
                lastMethod = r.method;
                return (
                  <tr
                    key={i}
                    style={{
                      borderTop: firstOfMethod && i > 0 ? "2px solid var(--accent)" : undefined,
                      background: `color-mix(in srgb, var(--accent) ${i % 2 === 0 ? 6 : 12}%, var(--bg-elevated))`,
                    }}
                  >
                    <td style={td}>
                      {firstOfMethod ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <MethodChip method={r.method} />
                          <span style={{ fontSize: 10, opacity: 0.55 }}>rate {r.methodRate}</span>
                        </div>
                      ) : null}
                    </td>
                    <td style={{ ...td, padding: "4px 12px" }}>
                      {info?.sprite && (
                        info ? (
                          <a
                            href={serebiiGen3DexUrl(info.nationalDex)}
                            target="_blank"
                            rel="noreferrer"
                            title={`${formatSpeciesName(info.name)} on Serebii (Gen 3)`}
                            style={{ display: "inline-block" }}
                          >
                            <img
                              src={info.sprite}
                              alt=""
                              width={40}
                              height={40}
                              style={{ imageRendering: "pixelated", display: "block" }}
                            />
                          </a>
                        ) : null
                      )}
                    </td>
                    <td style={td}>
                      {info ? (
                        <a
                          href={serebiiGen3DexUrl(info.nationalDex)}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: "var(--accent-strong)",
                            fontWeight: 600,
                            textDecoration: "underline",
                            textDecorationColor: "color-mix(in srgb, var(--accent) 60%, transparent)",
                            textUnderlineOffset: 3,
                          }}
                        >
                          {formatSpeciesName(info.name)}
                        </a>
                      ) : (
                        <span style={{ fontWeight: 600 }}>{formatSpeciesName(r.enc.name)}</span>
                      )}
                    </td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", minHeight: 44, alignContent: "center" }}>
                        {info?.types.map((t) => <TypeBadge key={t} type={t} />)}
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {r.enc.minLevel === r.enc.maxLevel
                        ? r.enc.minLevel
                        : `${r.enc.minLevel}–${r.enc.maxLevel}`}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <ChanceBar chance={r.enc.chance} />
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Theme = "light" | "dark" | "system";

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("living-dex:theme") as Theme | null) ?? "system";
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    localStorage.setItem("living-dex:theme", theme);
  }, [theme]);
  const cycle = () => setTheme((t) => (t === "system" ? "light" : t === "light" ? "dark" : "system"));
  const label = theme === "system" ? "Auto" : theme === "dark" ? "Dark" : "Light";
  const icon = theme === "system" ? "🌓" : theme === "dark" ? "🌙" : "☀️";
  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${label} (click to cycle)`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: "var(--bg-surface)",
        color: "var(--text-muted)",
        border: "1px solid var(--border)",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </button>
  );
}

type Tab = { id: string; label: string; content: React.ReactNode };

function Tabs({ tabs, initial, storageKey }: { tabs: Tab[]; initial: string; storageKey?: string }) {
  const [active, setActive] = useState(() => {
    if (!storageKey) return initial;
    const saved = localStorage.getItem(storageKey);
    if (saved && tabs.some((t) => t.id === saved)) return saved;
    return initial;
  });
  const select = (id: string) => {
    setActive(id);
    if (storageKey) localStorage.setItem(storageKey, id);
  };
  return (
    <div style={{ marginTop: 24 }}>
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--border)",
          marginBottom: 16,
        }}
      >
        {tabs.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              onClick={() => select(t.id)}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: selected ? "2px solid var(--accent)" : "2px solid transparent",
                padding: "8px 14px",
                marginBottom: -1,
                fontSize: 14,
                fontWeight: selected ? 600 : 500,
                color: selected ? "var(--accent-strong)" : "var(--text-muted)",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.find((t) => t.id === active)?.content}
    </div>
  );
}

const GAME_THEME_KEY: Record<string, string> = {
  AXVE: "ruby",
  AXPE: "sapphire",
  BPEE: "emerald",
  BPRE: "firered",
  BPGE: "leafgreen",
};

export function App() {
  const { connected, game, party, enemyParty, inBattle, location, source, lastUpdateAt } = useLivingDex();
  useEffect(() => {
    const root = document.documentElement;
    const key = game ? GAME_THEME_KEY[game.code] : undefined;
    if (key) root.setAttribute("data-game", key);
    else root.removeAttribute("data-game");
  }, [game]);
  const activeMon = party.find((p) => p !== null) ?? null;
  const activeEnemy = enemyParty.find((p) => p !== null) ?? null;
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <h1 style={{ margin: 0, marginRight: "auto" }}>Living Dex</h1>
        <StatusBadge
          label="mGBA"
          value={connected ? "connected" : "disconnected"}
          tone={connected ? "success" : "danger"}
          detail={game ? `${game.name} (rev ${game.revision})` : undefined}
        />
        <StatusBadge
          label="Source"
          value={source ?? "none"}
          tone={source ? "info" : "muted"}
          detail={lastUpdateAt ? new Date(lastUpdateAt).toLocaleTimeString() : undefined}
        />
        <ThemeToggle />
      </header>
      <h2>Party</h2>
      <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
        {party.map((mon, i) => (
          <li key={i} style={mon ? undefined : { opacity: 0.4 }}>
            {mon ? <PokemonCard mon={mon} movesRight /> : "—"}
          </li>
        ))}
      </ol>
      <Tabs
        tabs={[
          {
            id: "matchup",
            label: "Current Matchup",
            content:
              inBattle && activeEnemy ? (
                <div className="matchup">
                  <div className="matchup-card">
                    <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      You
                    </div>
                    {activeMon ? <PokemonCard mon={activeMon} /> : <div style={{ opacity: 0.5 }}>—</div>}
                  </div>
                  <div className="matchup-vs">vs</div>
                  <div className="matchup-card">
                    <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Opponent
                    </div>
                    <PokemonCard mon={activeEnemy!} />
                  </div>
                </div>
              ) : (
                <p style={{ opacity: 0.6, fontStyle: "italic" }}>Not in a battle.</p>
              ),
          },
          {
            id: "encounters",
            label: "Wild Encounters",
            content: <Encounters location={location} />,
          },
        ]}
        initial={inBattle ? "matchup" : "encounters"}
        storageKey="living-dex:active-tab"
      />
    </main>
  );
}
