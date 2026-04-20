import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";
import { useLivingDex } from "./store";
import speciesData from "./species.json";
import movesData from "./moves.json";
import encountersData from "./encounters.json";
import hoennDexData from "./hoenn-dex.json";
import mapsecData from "./mapsec.json";
import type { DecodedPokemon, GameStem, HubState, SaveInfo } from "../../hub/protocol.ts";
import { GAME_STEMS } from "../../hub/protocol.ts";

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
  abilities: string[];
};
const species = speciesData as Record<string, Species>;

type HoennDexEntry = { hoennDex: number; nationalDex: number; name: string };
const hoennDex = hoennDexData as HoennDexEntry[];

const mapsecNames = mapsecData as string[];
const METLOC_SPECIAL_EGG = 0xFD;
const METLOC_IN_GAME_TRADE = 0xFE;
const METLOC_FATEFUL_ENCOUNTER = 0xFF;
function mapsecLabel(id: number | null): string {
  if (id == null) return "Unknown";
  if (id === METLOC_SPECIAL_EGG) return "Egg";
  if (id === METLOC_IN_GAME_TRADE) return "In-game trade";
  if (id === METLOC_FATEFUL_ENCOUNTER) return "Fateful encounter";
  return mapsecNames[id] ?? `Map #${id}`;
}

const ORIGIN_GAME_LABEL: Record<number, string> = {
  1: "Sapphire", 2: "Ruby", 3: "Emerald", 4: "FireRed", 5: "LeafGreen", 15: "Colosseum/XD",
};

const speciesByNationalDex: Record<number, Species> = (() => {
  const map: Record<number, Species> = {};
  for (const s of Object.values(species)) map[s.nationalDex] = s;
  return map;
})();

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

function thumbnailUrl(nationalDex: number): string {
  return `https://raw.githubusercontent.com/HybridShivam/Pokemon/master/assets/thumbnails/${String(nationalDex).padStart(4, "0")}.png`;
}

function trainerArtUrl(stem: GameStem, gender: "male" | "female"): string {
  const base = "https://play.pokemonshowdown.com/sprites/trainers";
  if (stem === "ruby" || stem === "sapphire") {
    return `${base}/${gender === "female" ? "may-gen3rs" : "brendan-gen3rs"}.png`;
  }
  if (stem === "emerald") {
    return `${base}/${gender === "female" ? "may-gen3" : "brendan-gen3"}.png`;
  }
  return `${base}/${gender === "female" ? "leaf-gen3" : "red-gen3"}.png`;
}

function trainerCharacterName(stem: GameStem, gender: "male" | "female"): string {
  if (stem === "firered" || stem === "leafgreen") {
    return gender === "female" ? "Leaf" : "Red";
  }
  return gender === "female" ? "May" : "Brendan";
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

// Grade a Pokemon as a "keeper" signal for the opponent card.
// Combines IV quality (sum of IVs) and how well the nature fits the species'
// base stat distribution (boosting a top stat / lowering a weak one).
type Grade = "S+" | "S" | "A" | "B" | "C" | "D" | "F";

// Weight of a nature's +stat by its rank among non-HP base stats (1 = highest).
// Ties share the rank of the topmost tied value.
const PLUS_RANK_WEIGHT = [1.0, 0.88, 0.75, 0.55, 0.4];
// For the -stat, being lowest is best.
const MINUS_RANK_WEIGHT = [0.4, 0.55, 0.75, 0.88, 1.0];

function statRank(stat: StatKey, base: StatBlock): number {
  const v = base[stat];
  let better = 0;
  for (const k of ["atk", "def", "spa", "spd", "spe"] as StatKey[]) {
    if (base[k] > v) better++;
  }
  return better + 1; // 1..5
}

function natureFitScore(nature: string, base: StatBlock): {
  factor: number;
  plusRank: number | null;
  minusRank: number | null;
  neutral: boolean;
} {
  const effect = natureEffect(nature);
  if (!effect) return { factor: 0.85, plusRank: null, minusRank: null, neutral: true };
  const plusRank = statRank(effect.plus, base);
  const minusRank = statRank(effect.minus, base);
  const factor = (PLUS_RANK_WEIGHT[plusRank - 1] + MINUS_RANK_WEIGHT[minusRank - 1]) / 2;
  return { factor, plusRank, minusRank, neutral: false };
}

function gradePokemon(ivs: StatBlock, nature: string, base: StatBlock): {
  grade: Grade;
  ivSum: number;
  greenCount: number;
  perfectCount: number;
  nature: ReturnType<typeof natureFitScore>;
} {
  const ivVals = (["hp", "atk", "def", "spa", "spd", "spe"] as StatKey[]).map((k) => ivs[k]);
  const ivSum = ivVals.reduce((a, b) => a + b, 0);
  const greenCount = ivVals.filter((v) => v >= 26).length;
  const perfectCount = ivVals.filter((v) => v === 31).length;
  const nat = natureFitScore(nature, base);

  // Raw IV score (0..118): sum%-of-max plus concentration bonus for perfects/greens.
  const ivScore = (ivSum / 186) * 100 + perfectCount * 2 + greenCount * 1;
  // Nature is a multiplier: great fit preserves the IV score, poor fit slashes it.
  const total = ivScore * nat.factor;

  let grade: Grade;
  if (perfectCount === 6 && nat.factor >= 0.88) grade = "S+";
  else if (total >= 108) grade = "S+";
  else if (total >= 96) grade = "S";
  else if (total >= 82) grade = "A";
  else if (total >= 60) grade = "B";
  else if (total >= 45) grade = "C";
  else if (total >= 30) grade = "D";
  else grade = "F";

  return { grade, ivSum, greenCount, perfectCount, nature: nat };
}

const GRADE_CARD_CLASS: Partial<Record<Grade, string>> = {
  "S+": "grade-card grade-card-SPLUS",
  S: "grade-card grade-card-S",
  A: "grade-card grade-card-A",
  B: "grade-card grade-card-B",
};

const CONFETTI_COLORS = ["#f59e0b", "#fde68a", "#fbbf24", "#ef4444", "#3b82f6", "#22c55e", "#ec4899", "#a855f7"];

function Confetti({ count = 28 }: { count?: number }) {
  const pieces = Array.from({ length: count }, (_, i) => {
    const left = (i * 97) % 100;
    const delay = ((i * 53) % 100) / 50; // 0..2s
    const dur = 2 + ((i * 31) % 100) / 40; // 2..4.5s
    const drift = ((i % 7) - 3) * 18; // -54..54px
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const shape = i % 3 === 0 ? "50%" : i % 3 === 1 ? "2px" : "0";
    return (
      <span
        key={i}
        className="confetti-piece"
        style={{
          left: `${left}%`,
          background: color,
          borderRadius: shape,
          animationDelay: `${delay}s`,
          animationDuration: `${dur}s`,
          ["--drift" as string]: `${drift}px`,
        }}
      />
    );
  });
  const sparkles = Array.from({ length: 6 }, (_, i) => (
    <span
      key={`s${i}`}
      className="sparkle"
      style={{
        left: `${(i * 73) % 90 + 5}%`,
        top: `${(i * 41) % 70 + 10}%`,
        animationDelay: `${(i * 0.27) % 1.6}s`,
      }}
    />
  ));
  return (
    <div className="confetti-layer" aria-hidden>
      {pieces}
      {sparkles}
    </div>
  );
}

const GRADE_STYLE: Record<Grade, { bg: string; fg: string; ring: string }> = {
  "S+": { bg: "linear-gradient(135deg,#fde68a,#f59e0b)", fg: "#3f2d04", ring: "#f59e0b" },
  S: { bg: "linear-gradient(135deg,#fef3c7,#eab308)", fg: "#422c05", ring: "#eab308" },
  A: { bg: "linear-gradient(135deg,#fde68a,#fbbf24)", fg: "#3f2d04", ring: "#f59e0b" },
  B: { bg: "linear-gradient(135deg,#bfdbfe,#3b82f6)", fg: "#0b1f44", ring: "#3b82f6" },
  C: { bg: "linear-gradient(135deg,#e5e7eb,#9ca3af)", fg: "#1f2937", ring: "#9ca3af" },
  D: { bg: "linear-gradient(135deg,#fed7aa,#f97316)", fg: "#3b1d05", ring: "#f97316" },
  F: { bg: "linear-gradient(135deg,#fecaca,#ef4444)", fg: "#450a0a", ring: "#ef4444" },
};

function GradeBadge({
  grade,
  detail,
}: {
  grade: Grade;
  detail: string;
}) {
  const s = GRADE_STYLE[grade];
  const glow = grade === "A" || grade === "S" || grade === "S+";
  return (
    <span
      title={detail}
      className={glow ? "grade-badge-glow" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 34,
        height: 34,
        padding: "0 8px",
        borderRadius: 8,
        background: s.bg,
        color: s.fg,
        fontWeight: 800,
        fontSize: 15,
        letterSpacing: 0.3,
        boxShadow: `0 0 0 1px ${s.ring}, 0 1px 2px rgba(0,0,0,0.15)`,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {grade}
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
  const isMax = level >= 100;
  const curLevelExp = expForLevel(level, rate);
  const nextLevelExp = expForLevel(level + 1, rate);
  const span = Math.max(1, nextLevelExp - curLevelExp);
  const into = Math.max(0, exp - curLevelExp);
  const toGo = Math.max(0, nextLevelExp - exp);
  const pct = isMax ? 100 : Math.min(100, Math.max(0, (into / span) * 100));

  // Mimic the in-game bar: on level up, fill to 100% first, snap back to 0, then
  // animate to the new percent. We track the previous level and stage the transition.
  const [displayPct, setDisplayPct] = useState(pct);
  const [animate, setAnimate] = useState(true);
  const prevLevel = useRef(level);

  useEffect(() => {
    if (level === prevLevel.current) {
      setAnimate(true);
      setDisplayPct(pct);
      return;
    }
    // Leveled up (or down). Fill to 100 with animation, then snap to 0, then go to pct.
    prevLevel.current = level;
    setAnimate(true);
    setDisplayPct(100);
    const t1 = setTimeout(() => {
      setAnimate(false);
      setDisplayPct(0);
      // Next frame: re-enable animation and go to target.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimate(true);
          setDisplayPct(pct);
        });
      });
    }, 750);
    return () => clearTimeout(t1);
  }, [level, pct]);

  if (isMax) {
    return (
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
        EXP {formatInt(exp)} · <span style={{ fontWeight: 600 }}>Max level</span>
      </div>
    );
  }

  return (
    <div style={{ fontSize: 12, marginTop: 6, display: "flex", flexDirection: "column", gap: 3, maxWidth: 260 }}>
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
        <div
          style={{
            width: `${displayPct}%`,
            height: "100%",
            background: "var(--accent)",
            transition: animate ? "width 700ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
          }}
        />
      </div>
    </div>
  );
}

function PokemonCard({
  mon,
  movesRight = false,
  showGrade = false,
}: {
  mon: DecodedPokemon;
  movesRight?: boolean;
  showGrade?: boolean;
}) {
  const info = lookup(mon.species);
  const graded = showGrade && info ? gradePokemon(mon.ivs, mon.nature, info.baseStats) : null;
  const rankLabel = (r: number | null) =>
    r == null ? "?" : r === 1 ? "#1" : r === 5 ? "#5 (worst)" : `#${r}`;
  const gradeDetail = graded
    ? [
        `Grade ${graded.grade}`,
        `IV total ${graded.ivSum}/186 · ${graded.perfectCount} perfect, ${graded.greenCount} green+`,
        graded.nature.neutral
          ? "Neutral nature (no stat effect)"
          : `Nature boosts stat ${rankLabel(graded.nature.plusRank)}, lowers stat ${rankLabel(graded.nature.minusRank)} (fit ${(graded.nature.factor * 100).toFixed(0)}%)`,
      ].join("\n")
    : "";
  const gradeClass = graded ? GRADE_CARD_CLASS[graded.grade] ?? "" : "";
  return (
    <div
      className={gradeClass}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: 8,
        border: "1px solid var(--accent)",
        borderRadius: 8,
        position: "relative",
      }}
    >
      {graded?.grade === "S+" && <Confetti />}
      {graded && (
        <div style={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}>
          <GradeBadge grade={graded.grade} detail={gradeDetail} />
        </div>
      )}
      {info && (
        <img src={thumbnailUrl(info.nationalDex)} alt={info.name} width={72} height={72} style={{ flexShrink: 0 }} />
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
          {info && <span style={{ opacity: 0.6 }}>·</span>}
          {info && (
            <span>
              <span style={{ opacity: 0.6 }}>Ability </span>
              <span style={{ fontWeight: 600 }}>
                {formatSpeciesName(info.abilities[mon.abilityBit] ?? info.abilities[0] ?? "?")}
              </span>
            </span>
          )}
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

type Mode = "live" | "saved";

function ModeToggle({ mode, setMode, connected }: { mode: Mode; setMode: (m: Mode) => void; connected: boolean }) {
  const opts: { id: Mode; label: string; icon: string }[] = [
    { id: "saved", label: "Saved", icon: "💾" },
    { id: "live", label: "Live", icon: "⚡" },
  ];
  return (
    <div
      role="tablist"
      style={{
        display: "inline-flex",
        padding: 3,
        borderRadius: 999,
        background: "var(--bg-muted)",
        border: "1px solid var(--border)",
        gap: 2,
      }}
    >
      {opts.map((o) => {
        const selected = o.id === mode;
        const liveDot = o.id === "live" && connected;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={selected}
            onClick={() => setMode(o.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 14px",
              borderRadius: 999,
              border: "none",
              background: selected ? "var(--bg-surface)" : "transparent",
              color: selected ? "var(--accent-strong)" : "var(--text-muted)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: selected ? "0 1px 2px rgba(0,0,0,0.08)" : undefined,
            }}
          >
            <span aria-hidden>{o.icon}</span>
            {o.label}
            {liveDot && (
              <span
                aria-hidden
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: "#16a34a",
                  boxShadow: "0 0 0 2px color-mix(in srgb, #16a34a 30%, transparent)",
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

const CODE_TO_STEM: Record<string, GameStem> = {
  AXVE: "ruby",
  AXPE: "sapphire",
  BPEE: "emerald",
  BPRE: "firered",
  BPGE: "leafgreen",
};

const GAME_DISPLAY_NAME: Record<GameStem, string> = {
  ruby: "Ruby",
  sapphire: "Sapphire",
  emerald: "Emerald",
  firered: "FireRed",
  leafgreen: "LeafGreen",
};

// The challenge (README) progresses Sapphire → ... → B/W2. Gen 3 is what we can decode
// today; later gens exist here as a roadmap so the dashboard can show the whole chain.
// Mascots are national dex numbers for the version legendary — uses the existing
// HybridShivam thumbnail CDN so we don't need game box art.
type ChainStep = {
  stem: GameStem | null;
  label: string;
  short?: string;
  mascots: number[];
  tint: string; // hex; used as subtle gradient + border accent
  endOfGen?: boolean;
};
const CHALLENGE_CHAIN: ChainStep[] = [
  { stem: "sapphire",  label: "Sapphire",               mascots: [382],       tint: "#2563eb" },
  { stem: "ruby",      label: "Ruby",                   mascots: [383],       tint: "#dc2626" },
  { stem: "emerald",   label: "Emerald",                mascots: [384],       tint: "#059669", endOfGen: true },
  { stem: "firered",   label: "FireRed",                mascots: [6],         tint: "#ea580c" },
  { stem: "leafgreen", label: "LeafGreen",              mascots: [3],         tint: "#16a34a" },
  { stem: null,        label: "Diamond / Pearl",        short: "D/P",         mascots: [483, 484], tint: "#7dd3fc" },
  { stem: null,        label: "Platinum",               mascots: [487],       tint: "#a855f7" },
  { stem: null,        label: "HeartGold / SoulSilver", short: "HG/SS",       mascots: [250, 249], tint: "#f59e0b", endOfGen: true },
  { stem: null,        label: "Black / White",          short: "B/W",         mascots: [643, 644], tint: "#4b5563" },
  { stem: null,        label: "Black 2 / White 2",      short: "B2/W2",       mascots: [646],      tint: "#0ea5e9", endOfGen: true },
];

function pokemonKey(mon: DecodedPokemon): string {
  return `${mon.otId.toString(16)}-${mon.pid.toString(16)}`;
}

export function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/:game" element={<GameView />} />
          <Route path="/:game/pokemon/:key" element={<PokemonDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const { connected, game, source, lastUpdateAt } = useLivingDex();
  const { game: routeStem } = useParams<{ game?: string }>();
  useEffect(() => {
    const root = document.documentElement;
    // Route stem wins — user is explicitly viewing that game's page.
    // Fall back to the connected cart so the global index still themes to whatever's running.
    const stem =
      (routeStem && isGameStem(routeStem) ? routeStem : undefined) ??
      (game ? CODE_TO_STEM[game.code] : undefined);
    if (stem) root.setAttribute("data-game", stem);
    else root.removeAttribute("data-game");
  }, [game, routeStem]);
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <h1 style={{ margin: 0, marginRight: "auto" }}>
          <Link
            to="/"
            style={{
              color: "inherit",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Pokeball size={26} />
            <span>Living Dex</span>
          </Link>
        </h1>
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
      {children}
    </main>
  );
}

function isGameStem(s: string): s is GameStem {
  return (GAME_STEMS as readonly string[]).includes(s);
}

function GameView() {
  const params = useParams<{ game: string }>();
  const { connected, game, party, enemyParty, inBattle, location, saves } = useLivingDex();
  const stem = params.game && isGameStem(params.game) ? params.game : null;
  const saveInfo = stem ? saves[stem] ?? null : null;
  const runningStem = game ? CODE_TO_STEM[game.code] : null;
  const canShowLive = connected && runningStem === stem;

  const [mode, setMode] = useState<Mode>("saved");
  const prevCanShowLive = useRef(canShowLive);
  useEffect(() => {
    if (!prevCanShowLive.current && canShowLive) setMode("live");
    prevCanShowLive.current = canShowLive;
  }, [canShowLive]);

  if (!stem) return <Navigate to="/" replace />;

  const activeMon = party.find((p) => p !== null) ?? null;
  const activeEnemy = enemyParty.find((p) => p !== null) ?? null;

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20 }}>{GAME_DISPLAY_NAME[stem]}</h2>
        <ModeToggle mode={mode} setMode={setMode} connected={connected} />
      </div>
      {mode === "saved" ? (
        <SavedView stem={stem} saveInfo={saveInfo} />
      ) : !canShowLive ? (
        <section style={{ padding: 32, textAlign: "center", opacity: 0.6, fontStyle: "italic" }}>
          {connected
            ? `mGBA is running ${runningStem ? GAME_DISPLAY_NAME[runningStem] : "a different game"}, not ${GAME_DISPLAY_NAME[stem]}.`
            : "Waiting for mGBA connection…"}
        </section>
      ) : (
        <LiveView
          connected={connected}
          party={party}
          inBattle={inBattle}
          activeMon={activeMon}
          activeEnemy={activeEnemy}
          location={location}
        />
      )}
    </>
  );
}

function SavedView({ stem, saveInfo }: { stem: GameStem; saveInfo: SaveInfo | null }) {
  if (!saveInfo) {
    return (
      <section style={{ padding: 32, textAlign: "center", opacity: 0.6, fontStyle: "italic" }}>
        No save file loaded for {GAME_DISPLAY_NAME[stem]}. Drop{" "}
        <code>saves/{stem}.sav</code> in place and it'll pick up automatically.
      </section>
    );
  }
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <TrainerSaveCard
          stem={stem}
          saveInfo={saveInfo}
          speciesCount={countOwnedSpecies(saveInfo).size}
          showSeconds
          savedAtMs={saveInfo.savedAtMs}
        />
      </div>
      <h2 style={{ marginTop: 0 }}>Party</h2>
      {saveInfo.party.some((p) => p) ? (
        <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
          {saveInfo.party.map((mon, i) => (
            <li key={i} style={mon ? undefined : { opacity: 0.4 }}>
              {mon ? <PokemonCard mon={mon} movesRight /> : "—"}
            </li>
          ))}
        </ol>
      ) : (
        <p style={{ opacity: 0.6, fontStyle: "italic" }}>No party Pokémon in this save.</p>
      )}
      <LivingDexGrid stem={stem} saveInfo={saveInfo} />
    </>
  );
}

type OwnedLocation =
  | { kind: "party"; slot: number }
  | { kind: "box"; boxIndex: number; boxName: string; slotIndex: number };

type OwnedMon = { mon: DecodedPokemon; location: OwnedLocation };

function collectOwned(saveInfo: SaveInfo | null): Map<number, OwnedMon[]> {
  const byNational = new Map<number, OwnedMon[]>();
  const push = (mon: DecodedPokemon, location: OwnedLocation) => {
    const info = lookup(mon.species);
    if (!info) return;
    const list = byNational.get(info.nationalDex) ?? [];
    list.push({ mon, location });
    byNational.set(info.nationalDex, list);
  };
  if (!saveInfo) return byNational;
  saveInfo.party.forEach((mon, slot) => {
    if (mon) push(mon, { kind: "party", slot });
  });
  saveInfo.boxes.forEach((box, boxIndex) => {
    box.slots.forEach((mon, slotIndex) => {
      if (mon) push(mon, { kind: "box", boxIndex, boxName: box.name, slotIndex });
    });
  });
  return byNational;
}

const FIRST_SEEN_FMT = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatFirstSeen(ms: number): string {
  return FIRST_SEEN_FMT.format(new Date(ms));
}

function locationLabel(loc: OwnedLocation): string {
  if (loc.kind === "party") return `Party · slot ${loc.slot + 1}`;
  return `${loc.boxName} · slot ${loc.slotIndex + 1}`;
}

function LivingDexGrid({ stem, saveInfo }: { stem: GameStem; saveInfo: SaveInfo }) {
  const owned = collectOwned(saveInfo);
  const [selected, setSelected] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);

  const close = () => {
    setSelected(null);
    setAnchor(null);
  };

  useEffect(() => {
    if (selected == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);

  const selectedEntry = selected != null ? hoennDex.find((e) => e.hoennDex === selected) ?? null : null;
  const selectedOwned = selectedEntry ? owned.get(selectedEntry.nationalDex) ?? [] : [];

  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Hoenn Dex</h2>
        <span style={{ fontSize: 13, opacity: 0.7 }}>
          <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{owned.size}</span>
          {" / "}
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{hoennDex.length}</span> caught
        </span>
      </div>
      <div className="dex-grid">
        {hoennDex.map((entry) => {
          const info = speciesByNationalDex[entry.nationalDex];
          const entries = owned.get(entry.nationalDex);
          const isCaught = !!entries?.length;
          const isSelected = selected === entry.hoennDex;
          const cls = `dex-cell ${isCaught ? "dex-cell-caught" : "dex-cell-missing"}${isSelected ? " dex-cell-selected" : ""}`;
          const title = `#${entry.hoennDex} ${formatSpeciesName(entry.name)}${
            isCaught ? ` — ${locationLabel(entries![0].location)}` : ""
          }`;
          return (
            <button
              type="button"
              key={entry.hoennDex}
              className={cls}
              title={title}
              onClick={(e) => {
                if (isSelected) {
                  close();
                } else {
                  setSelected(entry.hoennDex);
                  setAnchor(e.currentTarget);
                }
              }}
            >
              <span className="dex-cell-num">{String(entry.hoennDex).padStart(3, "0")}</span>
              {info?.sprite ? (
                <img src={info.sprite} alt={entry.name} width={56} height={56} loading="lazy" />
              ) : (
                <div style={{ width: 56, height: 56 }} />
              )}
              <span className="dex-cell-name">{formatSpeciesName(entry.name)}</span>
              {entries && entries.length > 1 && (
                <span className="dex-cell-badge" title={`${entries.length} owned`}>×{entries.length}</span>
              )}
            </button>
          );
        })}
      </div>
      {selectedEntry && anchor && (
        <DexPopover anchor={anchor} onClose={close}>
          <DexDetail stem={stem} entry={selectedEntry} owned={selectedOwned} onClose={close} />
        </DexPopover>
      )}
    </section>
  );
}

const POPOVER_WIDTH = 420;
const POPOVER_MARGIN = 8;
const POPOVER_GAP = 12; // distance between anchor and popover

function DexPopover({
  anchor,
  onClose,
  children,
}: {
  anchor: HTMLElement;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    width: number;
    arrowLeft: number;
    placement: "top" | "bottom";
  } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current;
      if (!el) return;
      const anchorRect = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(POPOVER_WIDTH, vw - POPOVER_MARGIN * 2);
      const height = el.offsetHeight;

      const anchorCenter = anchorRect.left + anchorRect.width / 2;
      const left = Math.min(
        Math.max(POPOVER_MARGIN, anchorCenter - width / 2),
        vw - width - POPOVER_MARGIN,
      );

      const spaceAbove = anchorRect.top;
      const spaceBelow = vh - anchorRect.bottom;
      const placement: "top" | "bottom" =
        spaceAbove >= height + POPOVER_GAP || spaceAbove >= spaceBelow ? "top" : "bottom";
      const top =
        placement === "top"
          ? Math.max(POPOVER_MARGIN, anchorRect.top - height - POPOVER_GAP)
          : Math.min(vh - height - POPOVER_MARGIN, anchorRect.bottom + POPOVER_GAP);

      const arrowLeft = Math.min(
        Math.max(14, anchorCenter - left),
        width - 14,
      );

      setPos({ left, top, width, arrowLeft, placement });
    };

    place();
    // Re-place after layout settles (e.g. images loading inside the popover).
    const ro = new ResizeObserver(place);
    if (ref.current) ro.observe(ref.current);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchor]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor.contains(t)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={ref}
      className={`dex-popover dex-popover-${pos?.placement ?? "top"}`}
      role="dialog"
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        width: pos?.width ?? POPOVER_WIDTH,
        visibility: pos ? "visible" : "hidden",
        ["--arrow-left" as string]: pos ? `${pos.arrowLeft}px` : "50%",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

function DexDetail({
  stem,
  entry,
  owned,
  onClose,
}: {
  stem: GameStem;
  entry: HoennDexEntry;
  owned: OwnedMon[];
  onClose: () => void;
}) {
  const info = speciesByNationalDex[entry.nationalDex];
  return (
    <div aria-label={`${formatSpeciesName(entry.name)} details`}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: owned.length ? 12 : 0 }}>
        {info?.sprite && (
          <img src={info.sprite} alt="" width={72} height={72} style={{ imageRendering: "pixelated" }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            <a
              href={info ? serebiiGen3DexUrl(info.nationalDex) : "#"}
              target="_blank"
              rel="noreferrer"
              style={{ color: "inherit" }}
            >
              #{String(entry.hoennDex).padStart(3, "0")} {formatSpeciesName(entry.name)}
            </a>
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span>National #{entry.nationalDex}</span>
            {info && <span style={{ opacity: 0.5 }}>·</span>}
            {info?.types.map((t) => <TypeBadge key={t} type={t} />)}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            background: "transparent",
            border: "none",
            fontSize: 20,
            lineHeight: 1,
            padding: 4,
            cursor: "pointer",
            color: "var(--text-muted)",
            fontFamily: "inherit",
          }}
        >
          ×
        </button>
      </div>
      {owned.length === 0 ? (
        <p style={{ opacity: 0.6, fontStyle: "italic", margin: 0 }}>Not yet caught.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {owned.map((o, i) => (
            <OwnedMonRow key={i} stem={stem} owned={o} />
          ))}
        </div>
      )}
    </div>
  );
}

function OwnedMonRow({ stem, owned }: { stem: GameStem; owned: OwnedMon }) {
  const { mon, location } = owned;
  const info = lookup(mon.species);
  const locLabel = locationLabel(location);
  const locTone = location.kind === "party" ? "success" : "info";
  const metLoc = mapsecLabel(mon.metLocation);
  const origin = ORIGIN_GAME_LABEL[mon.originGame] ?? `Game ${mon.originGame}`;
  const isTraded = info && mon.originGame !== 2; // Ruby's origin = 2
  const firstSeenAt = useLivingDex((s) => s.catchLog[`${mon.pid}:${mon.otId}`]);
  const label = mon.isEgg ? "Egg" : mon.nickname || (info ? formatSpeciesName(info.name) : "?");
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: 10,
        border: "1px solid var(--border)",
        borderRadius: 8,
        background: "var(--bg-surface)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
          <Link
            to={`/${stem}/pokemon/${pokemonKey(mon)}`}
            style={{ fontSize: 15, fontWeight: 700, color: "inherit" }}
          >
            {label}
          </Link>
          <span style={{ fontSize: 12, opacity: 0.7 }}>Lv {mon.level} · {mon.nature}</span>
          <StatusBadge label="Where" value={locLabel} tone={locTone} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "4px 16px", fontSize: 12 }}>
          <Detail label="Met at" value={mon.metLevel ? `Lv ${mon.metLevel} · ${metLoc}` : "Hatched"} />
          <Detail
            label="OT"
            value={`${mon.otName || "?"} (${mon.otGender === "male" ? "♂" : "♀"}) · ID ${String(mon.otId & 0xFFFF).padStart(5, "0")}`}
          />
          <Detail label="Origin" value={origin + (isTraded ? " · traded" : "")} />
          <Detail label="First seen" value={firstSeenAt ? formatFirstSeen(firstSeenAt) : "—"} />
          <Detail label="PID" value={mon.pid.toString(16).toUpperCase().padStart(8, "0")} mono />
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 6, minWidth: 0 }}>
      <span style={{ opacity: 0.55, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 10, flexShrink: 0, alignSelf: "center" }}>
        {label}
      </span>
      <span
        style={{
          fontWeight: 600,
          fontFamily: mono ? "ui-monospace, SFMono-Regular, monospace" : undefined,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function LiveView({
  connected,
  party,
  inBattle,
  activeMon,
  activeEnemy,
  location,
}: {
  connected: boolean;
  party: HubState["party"];
  inBattle: boolean;
  activeMon: DecodedPokemon | null;
  activeEnemy: DecodedPokemon | null;
  location: HubState["location"];
}) {
  if (!connected) {
    return (
      <section style={{ padding: 32, textAlign: "center", opacity: 0.6, fontStyle: "italic" }}>
        Waiting for mGBA connection…
      </section>
    );
  }
  return (
    <>
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
                    <PokemonCard mon={activeEnemy!} showGrade />
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
    </>
  );
}

// ---------- Dashboard (index route) ----------

function Pokeball({ size = 18, color = "#ef4444" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      style={{ display: "inline-block", flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="11" fill="#fff" stroke="#0f172a" strokeWidth="1.5" />
      <path d="M1 12 A11 11 0 0 1 23 12" fill={color} stroke="#0f172a" strokeWidth="1.5" />
      <line x1="1" y1="12" x2="23" y2="12" stroke="#0f172a" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3.2" fill="#fff" stroke="#0f172a" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="1.3" fill="#fff" stroke="#0f172a" strokeWidth="1" />
    </svg>
  );
}

function TrainerSaveCard({
  stem,
  saveInfo,
  speciesCount,
  linkTo,
  showSeconds,
  savedAtMs,
}: {
  stem: GameStem;
  saveInfo: SaveInfo;
  speciesCount: number;
  linkTo?: string;
  showSeconds?: boolean;
  savedAtMs?: number;
}) {
  const step = CHALLENGE_CHAIN.find((c) => c.stem === stem);
  const tint = step?.tint ?? "#6b7280";
  const mascots = step?.mascots ?? [];
  const s = saveInfo;

  const containerStyle: React.CSSProperties = {
    color: "inherit",
    textDecoration: "none",
    position: "relative",
    padding: "14px 16px 14px 20px",
    border: `1px solid color-mix(in srgb, ${tint} 35%, var(--border))`,
    borderRadius: 14,
    background: `linear-gradient(135deg, color-mix(in srgb, ${tint} 12%, var(--bg-elevated)), var(--bg-elevated) 70%)`,
    display: "flex",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap",
    overflow: "hidden",
  };

  const body = (
    <>
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: tint,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 72,
          flexShrink: 0,
        }}
      >
        {mascots.map((dex, i) => (
          <img
            key={dex}
            src={thumbnailUrl(dex)}
            alt=""
            width={mascots.length > 1 ? 56 : 68}
            height={mascots.length > 1 ? 56 : 68}
            loading="lazy"
            style={{
              filter: `drop-shadow(0 2px 4px ${tint}66)`,
              marginLeft: i > 0 ? -18 : 0,
              zIndex: mascots.length - i,
              position: "relative",
            }}
          />
        ))}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            opacity: 0.9,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            color: `color-mix(in srgb, ${tint} 80%, var(--text))`,
          }}
        >
          {GAME_DISPLAY_NAME[stem]}
        </div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{s.playerName || "(unnamed)"}</div>
        <div style={{ fontSize: 12, opacity: 0.7, display: "flex", alignItems: "center", gap: 8 }}>
          <img
            src={trainerArtUrl(stem, s.playerGender)}
            alt={trainerCharacterName(stem, s.playerGender)}
            title={trainerCharacterName(stem, s.playerGender)}
            height={36}
            loading="lazy"
            style={{
              imageRendering: "pixelated",
              filter: `drop-shadow(0 1px 2px ${tint}55)`,
            }}
          />
          <span>
            {trainerCharacterName(stem, s.playerGender)} · ID{" "}
            {String(s.trainerId & 0xFFFF).padStart(5, "0")}
          </span>
        </div>
      </div>
      <div style={{ marginLeft: "auto", textAlign: "right", position: "relative" }}>
        <div style={{ fontSize: 11, opacity: 0.6, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Play time
        </div>
        <div
          style={{
            fontSize: showSeconds ? 22 : 20,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {s.playTime.hours}:{String(s.playTime.minutes).padStart(2, "0")}
          {showSeconds ? `:${String(s.playTime.seconds).padStart(2, "0")}` : ""}
        </div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {savedAtMs
            ? `saved ${new Date(savedAtMs).toLocaleTimeString()}`
            : `${speciesCount} species`}
        </div>
      </div>
      <span
        aria-hidden
        style={{
          position: "absolute",
          right: -18,
          bottom: -18,
          width: 72,
          height: 72,
          borderRadius: 999,
          opacity: 0.08,
          background: `radial-gradient(circle at 30% 30%, ${tint}, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
    </>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} style={containerStyle}>
        {body}
      </Link>
    );
  }
  return <div style={containerStyle}>{body}</div>;
}

function ChainCard({
  step,
  loaded,
  caught,
  unsupported,
  isLive,
}: {
  step: ChainStep;
  loaded: boolean;
  caught: number;
  unsupported: boolean;
  isLive: boolean;
}) {
  const tint = step.tint;
  const statusLine = unsupported
    ? "Roadmap"
    : loaded
    ? `${caught} species caught`
    : "No save loaded";
  const inner = (
    <div
      className="chain-card"
      style={{
        position: "relative",
        padding: "14px 14px 14px 16px",
        borderRadius: 14,
        border: `1px solid color-mix(in srgb, ${tint} 35%, var(--border))`,
        background: `linear-gradient(135deg, color-mix(in srgb, ${tint} 12%, var(--bg-elevated)), var(--bg-elevated) 70%)`,
        overflow: "hidden",
        opacity: unsupported ? 0.6 : 1,
        display: "flex",
        gap: 12,
        alignItems: "center",
        minHeight: 88,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: 4,
          background: tint,
          borderTopLeftRadius: 14,
          borderBottomLeftRadius: 14,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 68,
          flexShrink: 0,
        }}
      >
        {step.mascots.map((dex, i) => {
          const filters: string[] = [];
          if (unsupported) filters.push("grayscale(0.4)");
          filters.push(`drop-shadow(0 2px 4px ${tint}66)`);
          return (
            <img
              key={dex}
              src={thumbnailUrl(dex)}
              alt=""
              width={step.mascots.length > 1 ? 52 : 64}
              height={step.mascots.length > 1 ? 52 : 64}
              loading="lazy"
              style={{
                filter: filters.join(" "),
                marginLeft: i > 0 ? -18 : 0,
                zIndex: step.mascots.length - i,
                position: "relative",
              }}
            />
          );
        })}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: 0.2,
              color: `color-mix(in srgb, ${tint} 80%, var(--text))`,
              textTransform: "uppercase",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {step.label}
          </span>
          {step.endOfGen && (
            <span
              title="Completion target: national dex"
              style={{
                fontSize: 9,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 0.7,
                padding: "2px 6px",
                borderRadius: 4,
                background: tint,
                color: "#fff",
                border: "1px solid rgba(0,0,0,0.15)",
              }}
            >
              ★ Dex goal
            </span>
          )}
          {isLive && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 9,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 0.7,
                padding: "2px 6px",
                borderRadius: 4,
                background: "#16a34a",
                color: "#fff",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: "#fff",
                  boxShadow: "0 0 4px #fff",
                }}
              />
              Live
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            opacity: 0.8,
            marginTop: 4,
          }}
        >
          <Pokeball size={12} color={tint} />
          <span>{statusLine}</span>
        </div>
      </div>
      {loaded && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            right: -18,
            bottom: -18,
            width: 72,
            height: 72,
            borderRadius: 999,
            opacity: 0.08,
            background: `radial-gradient(circle at 30% 30%, ${tint}, transparent 70%)`,
          }}
        />
      )}
    </div>
  );

  if (step.stem && loaded) {
    return (
      <Link
        to={`/${step.stem}`}
        style={{ color: "inherit", textDecoration: "none", display: "block" }}
      >
        {inner}
      </Link>
    );
  }
  return inner;
}


function countOwnedSpecies(saveInfo: SaveInfo): Set<number> {
  const set = new Set<number>();
  const push = (mon: DecodedPokemon | null) => {
    if (!mon) return;
    const info = lookup(mon.species);
    if (info) set.add(info.nationalDex);
  };
  saveInfo.party.forEach(push);
  saveInfo.boxes.forEach((b) => b.slots.forEach(push));
  return set;
}

function Dashboard() {
  const { saves, connected, game } = useLivingDex();
  const runningStem = game ? CODE_TO_STEM[game.code] : null;

  const { totalSpecies, perGame } = useMemo(() => {
    const combined = new Set<number>();
    const perGame: Partial<Record<GameStem, Set<number>>> = {};
    for (const stem of GAME_STEMS) {
      const s = saves[stem];
      if (!s) continue;
      const set = countOwnedSpecies(s);
      perGame[stem] = set;
      for (const n of set) combined.add(n);
    }
    return { totalSpecies: combined.size, perGame };
  }, [saves]);

  const loaded = GAME_STEMS.filter((s) => saves[s]);

  return (
    <>
      <section
        className="trainer-hero"
        style={{
          position: "relative",
          padding: "18px 22px",
          marginBottom: 22,
          border: "1px solid color-mix(in srgb, #ef4444 25%, var(--border))",
          borderRadius: 14,
          background:
            "linear-gradient(135deg, color-mix(in srgb, #ef4444 14%, var(--bg-elevated)) 0%, var(--bg-elevated) 55%, color-mix(in srgb, #2563eb 10%, var(--bg-elevated)) 100%)",
          overflow: "hidden",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            right: -40,
            top: -40,
            opacity: 0.15,
          }}
        >
          <Pokeball size={180} />
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 11,
            opacity: 0.75,
            textTransform: "uppercase",
            letterSpacing: 0.8,
            fontWeight: 700,
          }}
        >
          <Pokeball size={14} />
          Living Dex — across all saves
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 16,
            flexWrap: "wrap",
            marginTop: 6,
            position: "relative",
          }}
        >
          <div
            style={{
              fontSize: 44,
              fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
              background: "linear-gradient(135deg, #ef4444, #f59e0b)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 1px 0 rgba(0,0,0,0.05)",
            }}
          >
            {totalSpecies}
          </div>
          <div style={{ opacity: 0.8, fontWeight: 600 }}>unique species caught</div>
          <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.75, fontWeight: 600 }}>
            {loaded.length} of {GAME_STEMS.length} Gen 3 saves loaded
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 10px" }}>Challenge chain</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          {CHALLENGE_CHAIN.map((step) => {
            const loaded = step.stem ? !!saves[step.stem] : false;
            const caught = step.stem ? perGame[step.stem]?.size ?? 0 : 0;
            const unsupported = !step.stem;
            const isLive = !!(step.stem && runningStem === step.stem && connected);
            return (
              <ChainCard
                key={step.label}
                step={step}
                loaded={loaded}
                caught={caught}
                unsupported={unsupported}
                isLive={isLive}
              />
            );
          })}
        </div>
      </section>

      <section>
        <h2 style={{ margin: "0 0 10px" }}>Loaded saves</h2>
        {loaded.length === 0 ? (
          <p style={{ opacity: 0.6, fontStyle: "italic" }}>
            No saves loaded yet. Drop one into the <code>saves/</code> directory.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {loaded.map((stem) => (
              <TrainerSaveCard
                key={stem}
                stem={stem}
                saveInfo={saves[stem]!}
                speciesCount={perGame[stem]?.size ?? 0}
                linkTo={`/${stem}`}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

// ---------- Pokemon detail route ----------

function findOwnedByKey(saveInfo: SaveInfo, key: string): OwnedMon | null {
  const scan = (
    mon: DecodedPokemon | null,
    location: OwnedLocation,
  ): OwnedMon | null => (mon && pokemonKey(mon) === key ? { mon, location } : null);

  for (let i = 0; i < saveInfo.party.length; i++) {
    const hit = scan(saveInfo.party[i], { kind: "party", slot: i });
    if (hit) return hit;
  }
  for (let b = 0; b < saveInfo.boxes.length; b++) {
    const box = saveInfo.boxes[b];
    for (let i = 0; i < box.slots.length; i++) {
      const hit = scan(box.slots[i], {
        kind: "box",
        boxIndex: b,
        boxName: box.name,
        slotIndex: i,
      });
      if (hit) return hit;
    }
  }
  return null;
}

function PokemonDetail() {
  const { game: gameParam, key } = useParams<{ game: string; key: string }>();
  const { saves, catchLog } = useLivingDex();
  const stem = gameParam && isGameStem(gameParam) ? gameParam : null;
  const saveInfo = stem ? saves[stem] ?? null : null;
  const found = stem && saveInfo && key ? findOwnedByKey(saveInfo, key) : null;

  if (!stem) return <Navigate to="/" replace />;
  if (!saveInfo) {
    return (
      <section style={{ padding: 32, textAlign: "center", opacity: 0.6, fontStyle: "italic" }}>
        No save loaded for {GAME_DISPLAY_NAME[stem]}.{" "}
        <Link to="/">Back to dashboard</Link>.
      </section>
    );
  }
  if (!found) {
    return (
      <section style={{ padding: 32, textAlign: "center", opacity: 0.6, fontStyle: "italic" }}>
        No Pokémon with key <code>{key}</code> in {GAME_DISPLAY_NAME[stem]}.{" "}
        <Link to={`/${stem}`}>Back to {GAME_DISPLAY_NAME[stem]}</Link>.
      </section>
    );
  }
  const { mon, location } = found;
  const info = lookup(mon.species);
  const metLoc = mapsecLabel(mon.metLocation);
  const origin = ORIGIN_GAME_LABEL[mon.originGame] ?? `Game ${mon.originGame}`;
  const firstSeenAt = catchLog[`${mon.pid}:${mon.otId}`];

  return (
    <>
      <div style={{ marginBottom: 16, fontSize: 13 }}>
        <Link to="/" style={{ color: "var(--accent-strong)" }}>Dashboard</Link>
        <span style={{ opacity: 0.4, padding: "0 6px" }}>/</span>
        <Link to={`/${stem}`} style={{ color: "var(--accent-strong)" }}>
          {GAME_DISPLAY_NAME[stem]}
        </Link>
        <span style={{ opacity: 0.4, padding: "0 6px" }}>/</span>
        <span style={{ opacity: 0.7 }}>
          {mon.nickname || (info ? formatSpeciesName(info.name) : key)}
        </span>
      </div>
      <PokemonCard mon={mon} movesRight showGrade />
      <section
        style={{
          marginTop: 16,
          padding: 16,
          border: "1px solid var(--border)",
          borderRadius: 10,
          background: "var(--bg-elevated)",
        }}
      >
        <h3 style={{ margin: "0 0 10px", fontSize: 14, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.7 }}>
          Identity
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "6px 16px",
            fontSize: 13,
          }}
        >
          <Detail label="Where" value={locationLabel(location)} />
          <Detail label="Met at" value={mon.metLevel ? `Lv ${mon.metLevel} · ${metLoc}` : "Hatched"} />
          <Detail
            label="OT"
            value={`${mon.otName || "?"} (${mon.otGender === "male" ? "♂" : "♀"}) · ID ${String(mon.otId & 0xFFFF).padStart(5, "0")}`}
          />
          <Detail label="Origin" value={origin} />
          <Detail label="First seen" value={firstSeenAt ? formatFirstSeen(firstSeenAt) : "—"} />
          <Detail label="PID" value={mon.pid.toString(16).toUpperCase().padStart(8, "0")} mono />
          <Detail label="OT ID (full)" value={mon.otId.toString(16).toUpperCase().padStart(8, "0")} mono />
        </div>
      </section>
    </>
  );
}
