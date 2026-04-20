import { useEffect, useRef, useState } from "react";
import { useLivingDex } from "./store";
import speciesData from "./species.json";
import movesData from "./moves.json";
import encountersData from "./encounters.json";
import hoennDexData from "./hoenn-dex.json";
import type { DecodedPokemon, HubState } from "../../hub/protocol.ts";

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
  return `https://raw.githubusercontent.com/HybridShivam/Pokemon/master/assets/thumbnails/${String(nationalDex).padStart(3, "0")}.png`;
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

const GAME_THEME_KEY: Record<string, string> = {
  AXVE: "ruby",
  AXPE: "sapphire",
  BPEE: "emerald",
  BPRE: "firered",
  BPGE: "leafgreen",
};

export function App() {
  const { connected, game, party, enemyParty, inBattle, location, source, lastUpdateAt, saveInfo } = useLivingDex();
  useEffect(() => {
    const root = document.documentElement;
    const key = game ? GAME_THEME_KEY[game.code] : undefined;
    if (key) root.setAttribute("data-game", key);
    else root.removeAttribute("data-game");
  }, [game]);
  const [mode, setMode] = useState<Mode>("saved");
  const prevConnected = useRef(connected);
  useEffect(() => {
    if (!prevConnected.current && connected) setMode("live");
    prevConnected.current = connected;
  }, [connected]);
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
      <div style={{ marginBottom: 20 }}>
        <ModeToggle mode={mode} setMode={setMode} connected={connected} />
      </div>
      {mode === "saved" ? (
        <SavedView saveInfo={saveInfo} />
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
    </main>
  );
}

function SavedView({ saveInfo }: { saveInfo: HubState["saveInfo"] }) {
  if (!saveInfo) {
    return (
      <section style={{ padding: 32, textAlign: "center", opacity: 0.6, fontStyle: "italic" }}>
        No save file loaded.
      </section>
    );
  }
  return (
    <>
      <section
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          padding: "12px 16px",
          marginBottom: 16,
          border: "1px solid var(--border)",
          borderRadius: 10,
          background: "var(--bg-elevated)",
        }}
      >
        <div>
          <div style={{ fontSize: 11, opacity: 0.6, textTransform: "uppercase", letterSpacing: 0.5 }}>Trainer</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{saveInfo.playerName || "(unnamed)"}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {saveInfo.playerGender} · ID {String(saveInfo.trainerId & 0xFFFF).padStart(5, "0")}
          </div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 11, opacity: 0.6, textTransform: "uppercase", letterSpacing: 0.5 }}>Play time</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {saveInfo.playTime.hours}:{String(saveInfo.playTime.minutes).padStart(2, "0")}
            :{String(saveInfo.playTime.seconds).padStart(2, "0")}
          </div>
          <div style={{ fontSize: 11, opacity: 0.55 }}>
            saved {new Date(saveInfo.savedAtMs).toLocaleTimeString()}
          </div>
        </div>
      </section>
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
      <LivingDexGrid party={saveInfo.party} />
    </>
  );
}

function LivingDexGrid({ party }: { party: (DecodedPokemon | null)[] }) {
  const caught = new Set<number>();
  for (const mon of party) {
    if (!mon) continue;
    const info = lookup(mon.species);
    if (info) caught.add(info.nationalDex);
  }
  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Hoenn Dex</h2>
        <span style={{ fontSize: 13, opacity: 0.7 }}>
          <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{caught.size}</span>
          {" / "}
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{hoennDex.length}</span> caught
        </span>
      </div>
      <div className="dex-grid">
        {hoennDex.map((entry) => {
          const info = speciesByNationalDex[entry.nationalDex];
          const isCaught = caught.has(entry.nationalDex);
          const cls = `dex-cell ${isCaught ? "dex-cell-caught" : "dex-cell-missing"}`;
          const title = `#${entry.hoennDex} ${formatSpeciesName(entry.name)}${isCaught ? " — caught" : ""}`;
          return (
            <a
              key={entry.hoennDex}
              className={cls}
              href={info ? serebiiGen3DexUrl(info.nationalDex) : "#"}
              target="_blank"
              rel="noreferrer"
              title={title}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <span className="dex-cell-num">{String(entry.hoennDex).padStart(3, "0")}</span>
              {info?.sprite ? (
                <img src={info.sprite} alt={entry.name} width={56} height={56} loading="lazy" />
              ) : (
                <div style={{ width: 56, height: 56 }} />
              )}
              <span className="dex-cell-name">{formatSpeciesName(entry.name)}</span>
            </a>
          );
        })}
      </div>
    </section>
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
