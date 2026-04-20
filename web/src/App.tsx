import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
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

// BoxPokemon (80-byte struct) has no party tail, so the decoder returns level=0.
// Derive it from experience using the species growth-rate curve.
function levelFromExp(exp: number, rate: GrowthRate): number {
  let lo = 1, hi = 100;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (expForLevel(mid, rate) <= exp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function effectiveLevel(mon: DecodedPokemon, info: Species | null | undefined): number {
  if (mon.level > 0) return mon.level;
  if (!info) return 0;
  return levelFromExp(mon.experience, info.growthRate);
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

const HIDDEN_POWER_TYPES = [
  "fighting", "flying", "poison", "ground", "rock", "bug", "ghost", "steel",
  "fire", "water", "grass", "electric", "psychic", "ice", "dragon", "dark",
] as const;

function hiddenPower(ivs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }): {
  type: string;
  power: number;
} {
  const a = ivs.hp & 1, b = ivs.atk & 1, c = ivs.def & 1;
  const d = ivs.spe & 1, e = ivs.spa & 1, f = ivs.spd & 1;
  const u = (ivs.hp >> 1) & 1, v = (ivs.atk >> 1) & 1, w = (ivs.def >> 1) & 1;
  const x = (ivs.spe >> 1) & 1, y = (ivs.spa >> 1) & 1, z = (ivs.spd >> 1) & 1;
  const typeIdx = Math.floor(((a + 2 * b + 4 * c + 8 * d + 16 * e + 32 * f) * 15) / 63);
  const power = Math.floor(((u + 2 * v + 4 * w + 8 * x + 16 * y + 32 * z) * 40) / 63) + 30;
  return { type: HIDDEN_POWER_TYPES[typeIdx], power };
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

const GRADE_THRESHOLDS: { grade: Grade; min: number }[] = [
  { grade: "S+", min: 108 },
  { grade: "S", min: 96 },
  { grade: "A", min: 82 },
  { grade: "B", min: 60 },
  { grade: "C", min: 45 },
  { grade: "D", min: 30 },
  { grade: "F", min: 0 },
];

function gradePokemon(ivs: StatBlock, nature: string, base: StatBlock): {
  grade: Grade;
  ivSum: number;
  greenCount: number;
  perfectCount: number;
  ivScore: number;
  total: number;
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

  return { grade, ivSum, greenCount, perfectCount, ivScore, total, nature: nat };
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

function GradeBreakdown({
  graded,
  nature,
}: {
  graded: ReturnType<typeof gradePokemon>;
  nature: string;
}) {
  const s = GRADE_STYLE[graded.grade];
  const rankLabel = (r: number | null) =>
    r == null ? "?" : r === 1 ? "#1 (highest)" : r === 5 ? "#5 (lowest)" : `#${r}`;
  const nextUp = [...GRADE_THRESHOLDS].reverse().find((t) => t.min > graded.total);
  const autoSPlus = graded.perfectCount === 6 && graded.nature.factor >= 0.88;

  const base = (graded.ivSum / 186) * 100;
  const Row = ({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, padding: "2px 0" }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span style={{ fontWeight: 600, color: accent, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );

  return (
    <div style={{ minWidth: 240, fontSize: 13 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span
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
            fontSize: 16,
            boxShadow: `0 0 0 1px ${s.ring}`,
          }}
        >
          {graded.grade}
        </span>
        <div>
          <div style={{ fontWeight: 700 }}>Grade {graded.grade}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>
            score <span style={{ fontWeight: 700 }}>{graded.total.toFixed(1)}</span>
          </div>
        </div>
      </div>

      <div
        style={{
          paddingTop: 8,
          borderTop: "1px dashed color-mix(in srgb, var(--border) 60%, transparent)",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.65, marginBottom: 4 }}>
          IVs
        </div>
        <Row label="Total" value={`${graded.ivSum} / 186 (${(graded.ivSum / 186 * 100).toFixed(0)}%)`} />
        <Row
          label="Perfect (31)"
          value={`${graded.perfectCount} ×`}
          accent={graded.perfectCount > 0 ? "var(--iv-perfect, #059669)" : undefined}
        />
        <Row
          label="Green+ (≥26)"
          value={`${graded.greenCount} ×`}
          accent={graded.greenCount > 0 ? "var(--iv-great, #16a34a)" : undefined}
        />
        <Row
          label="IV score"
          value={
            <>
              {base.toFixed(1)}
              {graded.perfectCount > 0 && <span style={{ opacity: 0.7 }}> +{graded.perfectCount * 2}</span>}
              {graded.greenCount > 0 && <span style={{ opacity: 0.7 }}> +{graded.greenCount}</span>}
              {" = "}
              <strong>{graded.ivScore.toFixed(1)}</strong>
            </>
          }
        />
      </div>

      <div
        style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: "1px dashed color-mix(in srgb, var(--border) 60%, transparent)",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.65, marginBottom: 4 }}>
          Nature
        </div>
        <Row label={graded.nature.neutral ? "Kind" : nature} value={graded.nature.neutral ? "Neutral" : nature} />
        {!graded.nature.neutral && (
          <>
            <Row label="Boosts" value={rankLabel(graded.nature.plusRank)} />
            <Row label="Lowers" value={rankLabel(graded.nature.minusRank)} />
          </>
        )}
        <Row
          label="Multiplier"
          value={`×${graded.nature.factor.toFixed(2)}`}
          accent={graded.nature.factor >= 0.88 ? "#16a34a" : graded.nature.factor < 0.6 ? "#ef4444" : undefined}
        />
      </div>

      <div
        style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: "1px dashed color-mix(in srgb, var(--border) 60%, transparent)",
          fontSize: 12,
          opacity: 0.85,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.75, marginBottom: 4 }}>
          Final
        </div>
        <div>
          {graded.ivScore.toFixed(1)} × {graded.nature.factor.toFixed(2)} ={" "}
          <strong style={{ color: s.ring }}>{graded.total.toFixed(1)}</strong>
        </div>
        {autoSPlus && (
          <div style={{ marginTop: 6, color: "#f59e0b", fontWeight: 600 }}>
            ✨ Auto-S+: 6× perfect IVs with a well-fit nature.
          </div>
        )}
        {nextUp && (
          <div style={{ marginTop: 6 }}>
            Needs <strong>≥{nextUp.min}</strong> for <strong>{nextUp.grade}</strong> (short by{" "}
            <strong>{(nextUp.min - graded.total).toFixed(1)}</strong>).
          </div>
        )}
      </div>
    </div>
  );
}

function GradeChip({
  graded,
  nature,
  fancy,
}: {
  graded: ReturnType<typeof gradePokemon>;
  nature: string;
  fancy: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const close = () => setAnchor(null);

  useEffect(() => {
    if (!anchor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [anchor]);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          if (anchor) close();
          else setAnchor(e.currentTarget);
        }}
        aria-label={`Grade ${graded.grade} — show breakdown`}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          margin: 0,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        {fancy ? <GradeBadge grade={graded.grade} /> : <GradeLetter grade={graded.grade} />}
      </button>
      {anchor && (
        <DexPopover anchor={anchor} onClose={close}>
          <GradeBreakdown graded={graded} nature={nature} />
        </DexPopover>
      )}
    </>
  );
}

function GradeLetter({ grade }: { grade: Grade }) {
  const s = GRADE_STYLE[grade];
  return (
    <span
      style={{
        fontWeight: 800,
        fontSize: 18,
        lineHeight: 1,
        color: s.ring,
        letterSpacing: 0.5,
        fontVariantNumeric: "tabular-nums",
        textShadow: "0 1px 0 rgba(0,0,0,0.15)",
      }}
    >
      {grade}
    </span>
  );
}

function GradeBadge({
  grade,
}: {
  grade: Grade;
}) {
  const s = GRADE_STYLE[grade];
  const glow = grade === "A" || grade === "S" || grade === "S+";
  return (
    <span
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
  fancyGrade = false,
}: {
  mon: DecodedPokemon;
  movesRight?: boolean;
  // Wild encounters opt into the glow/confetti badge. Party/PC get a plain
  // colored letter — the grade is still useful but the card shouldn't scream.
  fancyGrade?: boolean;
}) {
  const info = lookup(mon.species);
  const graded = info ? gradePokemon(mon.ivs, mon.nature, info.baseStats) : null;
  const gradeClass = fancyGrade && graded ? GRADE_CARD_CLASS[graded.grade] ?? "" : "";
  const level = effectiveLevel(mon, info);
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
        height: "100%",
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      {fancyGrade && graded?.grade === "S+" && <Confetti />}
      {info && (
        <img src={thumbnailUrl(info.nationalDex)} alt={info.name} width={72} height={72} style={{ flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>
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
          </span>
          {graded && <GradeChip graded={graded} nature={mon.nature} fancy={fancyGrade} />}
        </div>
        {info && info.types.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
            {info.types.map((t) => <TypeBadge key={t} type={t} />)}
          </div>
        )}
        <div style={{ fontSize: 13, opacity: 0.8, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span>Lv {level} · {mon.nature}</span>
          {info && <span style={{ opacity: 0.6 }}>·</span>}
          {info && (
            <span>
              <span style={{ opacity: 0.6 }}>Ability </span>
              <span style={{ fontWeight: 600 }}>
                {formatSpeciesName(info.abilities[mon.abilityBit] ?? info.abilities[0] ?? "?")}
              </span>
            </span>
          )}
        </div>
        {(() => {
          const hp = hiddenPower(mon.ivs);
          return (
            <div
              style={{ fontSize: 13, opacity: 0.8, display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}
              title={`Hidden Power ${hp.type} · base power ${hp.power}`}
            >
              <span style={{ opacity: 0.6 }}>Hidden Power</span>
              <TypeBadge type={hp.type} />
              <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{hp.power}</span>
            </div>
          );
        })()}
        {info && <ExpProgress level={level} exp={mon.experience} rate={info.growthRate} />}
        {movesRight ? (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 240px", minWidth: 0 }}>
              <StatsTable ivs={mon.ivs} evs={mon.evs} nature={mon.nature} baseStats={info?.baseStats} level={level} />
            </div>
            <div style={{ flex: "1 1 240px", minWidth: 0 }}>
              <MovesList moves={mon.moves} />
            </div>
          </div>
        ) : (
          <>
            <StatsTable ivs={mon.ivs} evs={mon.evs} nature={mon.nature} baseStats={info?.baseStats} level={level} />
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
  box: "Pokémon Box",
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
  gen: 3 | 4 | 5;
  stage: number; // ordered release-stage within the chain; later stages stay
                 // locked until every `primary` game of the prior stage has a
                 // save loaded (proxy for 4-star completion).
  primary?: boolean;
  endOfGen?: boolean;
  // GameCube entries — the hub can't decode their saves, so they sit in the
  // chain for release-order context but don't participate in stage gating.
  external?: boolean;
};
// Ordered by North American release date — the challenge is played as if
// re-living each release year in sequence. See README.md "Challenges".
const CHALLENGE_CHAIN: ChainStep[] = [
  // Stage 1 — 2003-03 (Gen 3)
  { stem: "ruby",      gen: 3, stage: 1, label: "Ruby",       mascots: [383], tint: "#dc2626" },
  { stem: "sapphire",  gen: 3, stage: 1, label: "Sapphire",   mascots: [382], tint: "#2563eb", primary: true },
  // Stage 2 — 2003-11 (Gen 3 · GameCube)
  { stem: null, gen: 3, stage: 2, label: "Colosseum", mascots: [197, 196], tint: "#9333ea", primary: true, external: true },
  // Stage 3 — 2004-09 (Gen 3)
  { stem: "firered",   gen: 3, stage: 3, label: "FireRed",    mascots: [6],   tint: "#ea580c" },
  { stem: "leafgreen", gen: 3, stage: 3, label: "LeafGreen",  mascots: [3],   tint: "#16a34a", primary: true },
  // Pokémon Box: R/S (GameCube PC extension, NA 2004-11). Not a story run — sits
  // in the chain for save browsing only; `external` keeps it out of stage gating.
  { stem: "box",       gen: 3, stage: 3, label: "Pokémon Box", short: "Box", mascots: [251], tint: "#6366f1", external: true },
  // Stage 4 — 2005-05 (Gen 3)
  { stem: "emerald",   gen: 3, stage: 4, label: "Emerald",    mascots: [384], tint: "#059669", primary: true, endOfGen: true },
  // Stage 5 — 2005-10 (Gen 3 · GameCube)
  { stem: null, gen: 3, stage: 5, label: "XD: Gale of Darkness", short: "XD", mascots: [249], tint: "#4c1d95", primary: true, external: true },
  // Stage 6 — 2007-04 (Gen 4)
  { stem: null, gen: 4, stage: 6, label: "Diamond",   mascots: [483], tint: "#38bdf8", primary: true },
  { stem: null, gen: 4, stage: 6, label: "Pearl",     mascots: [484], tint: "#f9a8d4" },
  // Stage 7 — 2009-03 (Gen 4)
  { stem: null, gen: 4, stage: 7, label: "Platinum",  mascots: [487], tint: "#a855f7", primary: true },
  // Stage 8 — 2010-03 (Gen 4)
  { stem: null, gen: 4, stage: 8, label: "HeartGold", mascots: [250], tint: "#f59e0b", primary: true, endOfGen: true },
  { stem: null, gen: 4, stage: 8, label: "SoulSilver", mascots: [249], tint: "#cbd5e1" },
  // Stage 9 — 2011-03 (Gen 5)
  { stem: null, gen: 5, stage: 9, label: "White",     mascots: [643], tint: "#e5e7eb", primary: true },
  { stem: null, gen: 5, stage: 9, label: "Black",     mascots: [644], tint: "#1f2937" },
  // Stage 10 — 2012-10 (Gen 5)
  { stem: null, gen: 5, stage: 10, label: "Black 2",  mascots: [644], tint: "#0ea5e9", primary: true, endOfGen: true },
  { stem: null, gen: 5, stage: 10, label: "White 2",  mascots: [643], tint: "#6b7280" },
];

const GEN_LABELS: Record<3 | 4 | 5, string> = {
  3: "Generation III · Hoenn, Kanto & Orre",
  4: "Generation IV · Sinnoh & Johto",
  5: "Generation V · Unova",
};

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
  // Layout sits outside <Routes>, so useParams won't see :game. Parse the URL directly.
  const location = useLocation();
  const routeStem = location.pathname.split("/")[1] || undefined;
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

  // Pokémon Box RS is just a PC-box extension — no trainer, no party, no live mode.
  // Render its own slim view rather than pretending it has a trainer card.
  if (stem === "box") return <BoxSavedView saveInfo={saveInfo} />;

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
      <Tabs
        tabs={[
          {
            id: "party",
            label: "Party",
            content: saveInfo.party.some((p) => p) ? (
              <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
                {saveInfo.party.map((mon, i) => (
                  <li key={i} style={mon ? undefined : { opacity: 0.4 }}>
                    {mon ? <PokemonCard mon={mon} movesRight /> : "—"}
                  </li>
                ))}
              </ol>
            ) : (
              <p style={{ opacity: 0.6, fontStyle: "italic" }}>No party Pokémon in this save.</p>
            ),
          },
          {
            id: "boxes",
            label: `PC Boxes (${countBoxMons(saveInfo)})`,
            content: <PCBoxes saveInfo={saveInfo} />,
          },
        ]}
        initial="party"
        storageKey={`living-dex:saved-tab:${stem}`}
      />
      <LivingDexGrid stem={stem} saveInfo={saveInfo} />
    </>
  );
}

function countBoxMons(saveInfo: SaveInfo): number {
  let n = 0;
  for (const box of saveInfo.boxes) for (const m of box.slots) if (m) n++;
  return n;
}

// Pokémon Box: R/S has no trainer card — just the PC extension it is.
// Hero card + box grid, nothing else.
function BoxSavedView({ saveInfo }: { saveInfo: SaveInfo | null }) {
  if (!saveInfo) {
    return (
      <section style={{ padding: 32, textAlign: "center", opacity: 0.6, fontStyle: "italic" }}>
        No save file loaded for Pokémon Box. Drop{" "}
        <code>saves/box.gci</code> in place and it'll pick up automatically.
      </section>
    );
  }
  const total = countBoxMons(saveInfo);
  const usedBoxes = saveInfo.boxes.filter((b) => b.slots.some((m) => m)).length;
  const uniqueSpecies = new Set<number>();
  for (const box of saveInfo.boxes) for (const m of box.slots) if (m) uniqueSpecies.add(m.species);
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <BoxHeroCard
          total={total}
          uniqueSpecies={uniqueSpecies.size}
          usedBoxes={usedBoxes}
          totalBoxes={saveInfo.boxes.length}
          savedAtMs={saveInfo.savedAtMs}
        />
      </div>
      <PCBoxes saveInfo={saveInfo} />
    </>
  );
}

function BoxHeroCard({
  total,
  uniqueSpecies,
  usedBoxes,
  totalBoxes,
  savedAtMs,
}: {
  total: number;
  uniqueSpecies: number;
  usedBoxes: number;
  totalBoxes: number;
  savedAtMs?: number;
}) {
  const step = CHALLENGE_CHAIN.find((c) => c.stem === "box")!;
  const tint = step.tint;
  const mascot = step.mascots[0];
  return (
    <div
      style={{
        position: "relative",
        padding: "18px 20px 18px 24px",
        border: `1px solid color-mix(in srgb, ${tint} 35%, var(--border))`,
        borderRadius: 14,
        background: `linear-gradient(135deg, color-mix(in srgb, ${tint} 14%, var(--bg-elevated)), var(--bg-elevated) 70%)`,
        display: "flex",
        gap: 20,
        alignItems: "center",
        flexWrap: "wrap",
        overflow: "hidden",
      }}
    >
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
      <span
        aria-hidden
        style={{
          position: "absolute",
          right: -40,
          bottom: -40,
          width: 180,
          height: 180,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${tint}22, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          width: 84,
          height: 84,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.18,
          }}
        >
          <Pokeball size={82} color={tint} />
        </span>
        <img
          src={thumbnailUrl(mascot)}
          alt=""
          width={72}
          height={72}
          loading="lazy"
          style={{
            filter: `drop-shadow(0 2px 4px ${tint}66)`,
            position: "relative",
          }}
        />
      </div>
      <div style={{ minWidth: 0, flex: "1 1 auto" }}>
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
          GameCube · PC Extension
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.15 }}>Pokémon Box</div>
        <div style={{ fontSize: 13, opacity: 0.7 }}>Ruby &amp; Sapphire</div>
        {savedAtMs && (
          <div
            style={{
              fontSize: 11,
              opacity: 0.6,
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Pokeball size={10} color={tint} />
            <span>Saved {new Date(savedAtMs).toLocaleString()}</span>
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          gap: 18,
          flexWrap: "wrap",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <HeroStat label="Stored" value={total} tint={tint} />
        <HeroStat label="Species" value={uniqueSpecies} tint={tint} />
        <HeroStat label="Boxes used" value={`${usedBoxes}/${totalBoxes}`} tint={tint} />
      </div>
    </div>
  );
}

function HeroStat({
  label,
  value,
  tint,
}: {
  label: string;
  value: number | string;
  tint: string;
}) {
  return (
    <div style={{ minWidth: 72 }}>
      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: `color-mix(in srgb, ${tint} 75%, var(--text))`,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          opacity: 0.7,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function PCBoxes({ saveInfo }: { saveInfo: SaveInfo }) {
  const boxes = saveInfo.boxes;
  const [idx, setIdx] = useState(() => Math.min(saveInfo.currentBox ?? 0, boxes.length - 1));
  const box = boxes[idx];
  if (!box) return null;
  const filled = box.slots.filter((m) => m).length;
  const prev = () => setIdx((i) => (i - 1 + boxes.length) % boxes.length);
  const next = () => setIdx((i) => (i + 1) % boxes.length);
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--bg-surface)",
          borderLeft: "4px solid var(--accent)",
        }}
      >
        <button onClick={prev} aria-label="Previous box" style={boxNavBtn}>‹</button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{box.name}</div>
          <div style={{ fontSize: 11, opacity: 0.65, fontVariantNumeric: "tabular-nums" }}>
            Box {idx + 1} of {boxes.length} · {filled}/30
            {idx === (saveInfo.currentBox ?? -1) && " · current"}
          </div>
        </div>
        <button onClick={next} aria-label="Next box" style={boxNavBtn}>›</button>
      </div>
      {filled === 0 ? (
        <p style={{ opacity: 0.6, fontStyle: "italic", padding: "16px 4px" }}>Empty box.</p>
      ) : (
        <ol
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
            gridAutoRows: "1fr",
            gap: 12,
          }}
        >
          {box.slots.map((mon, i) =>
            mon ? (
              <li key={i} style={{ display: "flex", minWidth: 0 }}>
                <div style={{ flex: 1, minWidth: 0, display: "flex" }}>
                  <PokemonCard mon={mon} movesRight />
                </div>
              </li>
            ) : null,
          )}
        </ol>
      )}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 12 }}>
        {boxes.map((b, i) => {
          const count = b.slots.filter((m) => m).length;
          const selected = i === idx;
          return (
            <button
              key={i}
              onClick={() => setIdx(i)}
              title={`${b.name} · ${count}/30`}
              style={{
                padding: "4px 8px",
                fontSize: 11,
                borderRadius: 6,
                border: selected ? "1px solid var(--accent)" : "1px solid var(--border)",
                background: selected ? "color-mix(in srgb, var(--accent) 18%, transparent)" : "var(--bg-surface)",
                color: selected ? "var(--accent-strong)" : "var(--text-muted)",
                fontWeight: selected ? 700 : 500,
                cursor: "pointer",
                fontFamily: "inherit",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {i + 1}
              <span style={{ opacity: 0.55, marginLeft: 4 }}>{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const boxNavBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "var(--bg-surface)",
  color: "var(--accent-strong)",
  fontSize: 20,
  lineHeight: 1,
  cursor: "pointer",
  fontFamily: "inherit",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

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
  const dexCaught = useMemo(() => new Set(saveInfo.pokedexOwned), [saveInfo.pokedexOwned]);
  const hoennCaught = hoennDex.reduce(
    (n, e) => n + (dexCaught.has(e.nationalDex) ? 1 : 0),
    0,
  );
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
          <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{hoennCaught}</span>
          {" / "}
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{hoennDex.length}</span> caught
        </span>
      </div>
      <div className="dex-grid">
        {hoennDex.map((entry) => {
          const info = speciesByNationalDex[entry.nationalDex];
          const entries = owned.get(entry.nationalDex);
          const isStored = !!entries?.length;
          const isCaught = isStored || dexCaught.has(entry.nationalDex);
          const isSelected = selected === entry.hoennDex;
          const stateCls = isStored ? "dex-cell-stored" : isCaught ? "dex-cell-caught" : "dex-cell-missing";
          const cls = `dex-cell ${stateCls}${isSelected ? " dex-cell-selected" : ""}`;
          const title = `#${entry.hoennDex} ${formatSpeciesName(entry.name)}${
            entries?.length ? ` — ${locationLabel(entries[0].location)}` : isCaught ? " — caught" : ""
          }`;
          const inner = (
            <>
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
            </>
          );
          if (!isStored) {
            return (
              <div key={entry.hoennDex} className={`${cls} dex-cell-static`} title={title}>
                {inner}
              </div>
            );
          }
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
              {inner}
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
    maxHeight: number;
  } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current;
      if (!el) return;
      const anchorRect = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(POPOVER_WIDTH, vw - POPOVER_MARGIN * 2);

      const spaceAbove = Math.max(0, anchorRect.top - POPOVER_MARGIN - POPOVER_GAP);
      const spaceBelow = Math.max(0, vh - anchorRect.bottom - POPOVER_MARGIN - POPOVER_GAP);
      // Pick the side with more room; clamp measured height to that side so a
      // very tall popover stays anchored and scrolls internally instead of
      // running off-screen.
      const placement: "top" | "bottom" = spaceAbove >= spaceBelow ? "top" : "bottom";
      const sideSpace = Math.max(120, placement === "top" ? spaceAbove : spaceBelow);
      const maxHeight = Math.max(120, Math.min(el.scrollHeight, sideSpace));
      const height = Math.min(el.offsetHeight, maxHeight);

      const anchorCenter = anchorRect.left + anchorRect.width / 2;
      const left = Math.min(
        Math.max(POPOVER_MARGIN, anchorCenter - width / 2),
        Math.max(POPOVER_MARGIN, vw - width - POPOVER_MARGIN),
      );

      const top =
        placement === "top"
          ? Math.max(POPOVER_MARGIN, anchorRect.top - height - POPOVER_GAP)
          : Math.min(vh - height - POPOVER_MARGIN, anchorRect.bottom + POPOVER_GAP);

      const arrowLeft = Math.min(
        Math.max(14, anchorCenter - left),
        width - 14,
      );

      setPos({ left, top, width, arrowLeft, placement, maxHeight });
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
        maxHeight: pos?.maxHeight,
        overflowY: "auto",
        overscrollBehavior: "contain",
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
          <span style={{ fontSize: 12, opacity: 0.7 }}>Lv {effectiveLevel(mon, info)} · {mon.nature}</span>
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
                    <PokemonCard mon={activeEnemy!} fancyGrade />
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
            ? `saved ${new Date(savedAtMs).toLocaleString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                ...(showSeconds ? { second: "2-digit" } : {}),
              })}`
            : `${speciesCount} / ${hoennDex.length} species`}
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

// Mirror of pokeruby/src/trainer_card.c TrainerCard_GetStarCount.
// Stars: HoF cleared, Hoenn dex completed, Battle Tower 50+ streak, >4 museum paintings.
type TrainerStar = {
  label: string;
  detail: string;
  earned: boolean;
  // null when we can't yet read the underlying stat from the save.
  unknown?: boolean;
};

function trainerStarsBreakdown(saveInfo: SaveInfo | null): TrainerStar[] {
  if (!saveInfo) {
    return [
      { label: "Hall of Fame", detail: "Beat the Elite Four", earned: false, unknown: true },
      { label: "Hoenn Dex", detail: "Catch all 200 Hoenn Pokémon", earned: false, unknown: true },
      { label: "Battle Tower", detail: "50-win streak in the Battle Tower", earned: false, unknown: true },
      { label: "Contests", detail: "5+ paintings in the Lilycove museum", earned: false, unknown: true },
    ];
  }
  const dexSet = new Set(saveInfo.pokedexOwned);
  // Mirrors pokeruby's CompletedHoennPokedex: only Hoenn dex #1..200 are required.
  // Jirachi (#201) and Deoxys (#202) are event-only and don't count toward the star.
  const hoennDone = hoennDex
    .filter((e) => e.hoennDex <= 200)
    .every((e) => dexSet.has(e.nationalDex));
  // Mirrors pokeruby/src/trainer_card.c TrainerCard_GetStarCount: star awarded
  // when bestBattleTowerWinStreak > 49.
  const battleTowerDone = saveInfo.battleTowerBestStreak > 49;
  return [
    { label: "Hall of Fame", detail: "Beat the Elite Four", earned: saveInfo.enteredHof },
    { label: "Hoenn Dex", detail: "Catch all 200 main Hoenn Pokémon (Jirachi/Deoxys not required)", earned: hoennDone },
    {
      label: "Battle Tower",
      detail: `50-win streak in the Battle Tower (best: ${saveInfo.battleTowerBestStreak})`,
      earned: battleTowerDone,
    },
    { label: "Contests", detail: "5+ paintings in the Lilycove museum", earned: false, unknown: true },
  ];
}

const STAR_GOLD = "#f5b301";
const STAR_GOLD_DARK = "#a86a00";
const STAR_EMPTY = "color-mix(in srgb, #a86a00 30%, var(--border))";

function StarIcon({ filled, size = 24 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ display: "block" }}>
      <path
        d="M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.6l-5.9 3.07 1.13-6.57L2.45 9.44l6.6-.96L12 2.5z"
        fill={filled ? STAR_GOLD : "transparent"}
        stroke={filled ? STAR_GOLD_DARK : STAR_EMPTY}
        strokeWidth={1.5}
        strokeLinejoin="round"
        style={
          filled
            ? { filter: "drop-shadow(0 1px 1px rgba(168, 106, 0, 0.45))" }
            : undefined
        }
      />
    </svg>
  );
}

function TrainerStars({
  breakdown,
  tint,
  dim,
}: {
  breakdown: TrainerStar[];
  tint: string;
  dim: boolean;
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const open = pos !== null;
  const close = () => setPos(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const onClick = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);
  const earned = breakdown.filter((s) => s.earned).length;
  return (
    <div onClick={(e) => e.preventDefault()}>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (open) {
            close();
          } else {
            const r = e.currentTarget.getBoundingClientRect();
            setPos({ left: r.left, top: r.bottom + 6 });
          }
        }}
        title={breakdown
          .map((s) => `${s.unknown ? "?" : s.earned ? "★" : "☆"} ${s.label}`)
          .join("\n")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          borderRadius: 999,
          border: `1px solid color-mix(in srgb, ${tint} 35%, var(--border))`,
          background: `color-mix(in srgb, ${tint} 10%, var(--bg-elevated))`,
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 11,
          color: "inherit",
          opacity: dim ? 0.55 : 1,
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            opacity: 0.7,
          }}
        >
          Trainer card
        </span>
        <span style={{ display: "inline-flex", gap: 4 }}>
          {breakdown.map((s, i) => (
            <span key={i} title={`${s.label} — ${s.detail}`}>
              <StarIcon filled={s.earned} />
            </span>
          ))}
        </span>
        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            fontWeight: 700,
            color: `color-mix(in srgb, ${tint} 80%, var(--text))`,
          }}
        >
          {earned}/{breakdown.length}
        </span>
      </button>
      {open && pos && createPortal(
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            zIndex: 1000,
            width: 240,
            padding: 10,
            borderRadius: 10,
            background: "var(--bg-surface)",
            border: `1px solid color-mix(in srgb, ${tint} 35%, var(--border))`,
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.18)",
            fontSize: 12,
          }}
        >
          {breakdown.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                padding: "6px 0",
                borderTop: i === 0 ? "none" : "1px dashed color-mix(in srgb, var(--border) 70%, transparent)",
                opacity: s.unknown ? 0.55 : 1,
              }}
            >
              <span style={{ marginTop: 1 }}>
                <StarIcon filled={s.earned} size={20} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{s.label}</div>
                <div style={{ opacity: 0.75 }}>{s.detail}</div>
                {s.unknown && (
                  <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>
                    Not yet decoded from the save.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

function PrimaryProgress({
  step,
  loaded,
  owned,
  saveInfo,
  tint,
}: {
  step: ChainStep;
  loaded: boolean;
  owned: Set<number> | null;
  saveInfo: SaveInfo | null;
  tint: string;
}) {
  const set = owned ?? new Set<number>();
  const regional = step.stem ? regionalDexProgress(step.stem, set) : null;
  const nationalCaught = loaded ? set.size : 0;
  // Museum-paintings star isn't parsed yet, so this caps at 3 stars
  // (HoF + Hoenn dex + Battle Tower). TODO: parse Lilycove contest paintings.
  const trainerStarsCertain = !!saveInfo;
  return (
    <div
      style={{
        marginTop: 8,
        paddingTop: 8,
        borderTop: "1px dashed color-mix(in srgb, var(--border) 60%, transparent)",
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      {regional && step.endOfGen && (
        <ProgressPill
          label="Regional dex"
          caught={regional.caught}
          total={regional.total}
          tint={tint}
          dim={!loaded}
        />
      )}
      {step.endOfGen && (
        <ProgressPill
          label="National dex"
          caught={nationalCaught}
          total={GEN3_NATIONAL_TOTAL}
          tint={tint}
          dim={!loaded}
        />
      )}
      <TrainerStars
        breakdown={trainerStarsBreakdown(saveInfo)}
        tint={tint}
        dim={!trainerStarsCertain}
      />
    </div>
  );
}

function ChainCard({
  step,
  loaded,
  caught,
  owned,
  saveInfo,
  unsupported,
  isLive,
  locked,
}: {
  step: ChainStep;
  loaded: boolean;
  caught: number;
  owned: Set<number> | null;
  saveInfo: SaveInfo | null;
  unsupported: boolean;
  isLive: boolean;
  locked: boolean;
}) {
  const tint = step.tint;
  const statusLine = locked
    ? "Locked — complete prior stage"
    : unsupported
    ? "Roadmap"
    : loaded
    ? step.external
      ? `${countBoxMons(saveInfo!)} stored`
      : step.endOfGen
      ? `${caught} species owned`
      : step.primary
      ? "4★ trainer card · no dex goal"
      : "Champion required · no dex goal"
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
        opacity: locked ? 0.35 : unsupported ? 0.6 : 1,
        filter: locked ? "grayscale(0.7)" : undefined,
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
          if (locked) filters.push("grayscale(0.9)");
          else if (unsupported) filters.push("grayscale(0.4)");
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
          {step.primary && (
            <span
              title="Primary — aim for a 4★ trainer card"
              style={{
                fontSize: 9,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 0.7,
                padding: "2px 6px",
                borderRadius: 4,
                background: `color-mix(in srgb, ${tint} 18%, transparent)`,
                color: `color-mix(in srgb, ${tint} 85%, var(--text))`,
                border: `1px solid color-mix(in srgb, ${tint} 45%, var(--border))`,
              }}
            >
              ★ Primary
            </span>
          )}
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
        {step.primary && !locked && (
          <PrimaryProgress step={step} loaded={loaded} owned={owned} saveInfo={saveInfo} tint={tint} />
        )}
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

  if (step.stem && loaded && !locked) {
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


const GEN3_NATIONAL_TOTAL = 386;
const KANTO_DEX_TOTAL = 151;

// Regional-dex completion target for a primary game's 4★ trainer card.
// Only Gen 3 games have parsers right now — later-gen primaries fall through.
function regionalDexProgress(stem: GameStem, owned: Set<number>): { caught: number; total: number } | null {
  if (stem === "firered" || stem === "leafgreen") {
    let caught = 0;
    for (let n = 1; n <= KANTO_DEX_TOTAL; n++) if (owned.has(n)) caught++;
    return { caught, total: KANTO_DEX_TOTAL };
  }
  if (stem === "ruby" || stem === "sapphire" || stem === "emerald") {
    let caught = 0;
    for (const entry of hoennDex) if (owned.has(entry.nationalDex)) caught++;
    return { caught, total: hoennDex.length };
  }
  return null;
}

function ProgressPill({
  label,
  caught,
  total,
  tint,
  dim,
}: {
  label: string;
  caught: number;
  total: number;
  tint: string;
  dim?: boolean;
}) {
  const pct = total === 0 ? 0 : Math.min(100, (caught / total) * 100);
  const done = caught >= total && total > 0;
  return (
    <div style={{ minWidth: 0, flex: "1 1 140px", opacity: dim ? 0.6 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.75, marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {caught} / {total}{done ? " ✓" : ""}
        </span>
      </div>
      <div style={{ height: 4, background: "var(--bg-muted)", borderRadius: 999, overflow: "hidden" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: done ? "#16a34a" : tint,
            transition: "width 200ms ease",
          }}
        />
      </div>
    </div>
  );
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

function LatestCatchCard({ stem, mon, at }: { stem: GameStem; mon: DecodedPokemon; at: number }) {
  const info = lookup(mon.species);
  const step = CHALLENGE_CHAIN.find((c) => c.stem === stem);
  const tint = step?.tint ?? "var(--accent)";
  const label = mon.isEgg ? "Egg" : mon.nickname || (info ? formatSpeciesName(info.name) : "?");
  return (
    <section style={{ marginBottom: 22 }}>
      <h2 style={{ margin: "0 0 10px" }}>Latest catch</h2>
      <Link
        to={`/${stem}/pokemon/${pokemonKey(mon)}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 14px 12px 16px",
          borderRadius: 14,
          border: `1px solid color-mix(in srgb, ${tint} 35%, var(--border))`,
          background: `linear-gradient(135deg, color-mix(in srgb, ${tint} 12%, var(--bg-elevated)), var(--bg-elevated) 70%)`,
          color: "inherit",
          textDecoration: "none",
          position: "relative",
          overflow: "hidden",
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
        {info && (
          <img
            src={thumbnailUrl(info.nationalDex)}
            alt={info.name}
            width={72}
            height={72}
            style={{ flexShrink: 0 }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            {label}
            {info && (
              <span style={{ fontWeight: 400, opacity: 0.7 }}>
                {" — "}
                {formatSpeciesName(info.name)}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span>Lv {effectiveLevel(mon, info)} · {mon.nature}</span>
            {info && info.types.map((t) => <TypeBadge key={t} type={t} />)}
            <span style={{ opacity: 0.6 }}>·</span>
            <span style={{ textTransform: "uppercase", letterSpacing: 0.5, fontSize: 11, fontWeight: 700, color: tint }}>
              {step?.label ?? stem}
            </span>
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            caught {formatFirstSeen(at)}
          </div>
        </div>
      </Link>
    </section>
  );
}

function Dashboard() {
  const { saves, connected, game, catchLog } = useLivingDex();
  const runningStem = game ? CODE_TO_STEM[game.code] : null;

  const perGame = useMemo(() => {
    const perGame: Partial<Record<GameStem, Set<number>>> = {};
    for (const stem of GAME_STEMS) {
      const s = saves[stem];
      if (!s) continue;
      perGame[stem] = countOwnedSpecies(s);
    }
    return perGame;
  }, [saves]);

  const mostRecentlyPlayed = useMemo(() => {
    let best: { stem: GameStem; at: number } | null = null;
    for (const stem of GAME_STEMS) {
      const s = saves[stem];
      if (!s) continue;
      if (!best || s.savedAtMs > best.at) best = { stem, at: s.savedAtMs };
    }
    if (!best) return null;
    const step = CHALLENGE_CHAIN.find((c) => c.stem === best!.stem);
    return {
      stem: best.stem,
      at: best.at,
      label: step?.label ?? best.stem,
      tint: step?.tint ?? "var(--accent)",
    };
  }, [saves]);

  const latestCatch = useMemo<{ stem: GameStem; mon: DecodedPokemon; at: number } | null>(() => {
    type Best = { stem: GameStem; mon: DecodedPokemon; at: number };
    let best: Best | null = null;
    for (const stem of GAME_STEMS) {
      const s = saves[stem];
      if (!s) continue;
      const scan = (mon: DecodedPokemon | null) => {
        if (!mon) return;
        const at = catchLog[`${mon.pid}:${mon.otId}`];
        if (at == null) return;
        const current: Best | null = best;
        if (!current || at > current.at) best = { stem, mon, at };
      };
      s.party.forEach(scan);
      s.boxes.forEach((b) => b.slots.forEach(scan));
    }
    return best;
  }, [saves, catchLog]);

  const loaded = GAME_STEMS.filter((s) => saves[s]);

  // State machine: a stage is unlocked when every game in the prior stage has
  // met its completion bar — primaries need a 4★ trainer card, secondaries need
  // to have cleared the Elite Four. Stage 1 always unlocks.
  const stageUnlocked = useMemo(() => {
    const stages = Array.from(new Set(CHALLENGE_CHAIN.map((s) => s.stage))).sort((a, b) => a - b);
    const unlocked = new Set<number>();
    let prevComplete = true;
    for (const stage of stages) {
      if (prevComplete) unlocked.add(stage);
      const games = CHALLENGE_CHAIN.filter((s) => s.stage === stage);
      // GameCube games aren't tracked by the hub — they sit in the chain
      // for release-order context but don't gate progression either way.
      const trackable = games.filter((s) => !s.external);
      if (trackable.length === 0) continue;
      prevComplete = trackable.every((s) => {
        const save = s.stem ? saves[s.stem] : null;
        if (!save) return false;
        if (s.primary) {
          return trainerStarsBreakdown(save).every((t) => t.earned);
        }
        return save.enteredHof;
      });
    }
    return unlocked;
  }, [saves]);

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
            gap: 12,
            flexWrap: "wrap",
            position: "relative",
          }}
        >
          {mostRecentlyPlayed ? (
            <Link
              to={`/${mostRecentlyPlayed.stem}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                fontSize: 12,
                fontWeight: 700,
                color: "inherit",
                textDecoration: "none",
              }}
            >
              <Pokeball size={14} />
              <span style={{ opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.8 }}>
                Most recently played
              </span>
              <span style={{ color: mostRecentlyPlayed.tint, fontSize: 15 }}>
                {mostRecentlyPlayed.label}
              </span>
              <span style={{ opacity: 0.6, fontWeight: 600 }}>
                {formatFirstSeen(mostRecentlyPlayed.at)}
              </span>
            </Link>
          ) : (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 12, opacity: 0.7, fontWeight: 700 }}>
              <Pokeball size={14} />
              <span style={{ textTransform: "uppercase", letterSpacing: 0.8 }}>No saves loaded yet</span>
            </div>
          )}
          <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.75, fontWeight: 600 }}>
            {loaded.length} of {GAME_STEMS.length} Gen 3 saves loaded
          </div>
        </div>
      </section>

      {latestCatch && <LatestCatchCard {...latestCatch} />}

      {(() => {
        const boxStep = CHALLENGE_CHAIN.find((s) => s.stem === "box");
        if (!boxStep) return null;
        const saveInfo = boxStep.stem ? saves[boxStep.stem] ?? null : null;
        const owned = boxStep.stem ? perGame[boxStep.stem] ?? null : null;
        const isLive = !!(boxStep.stem && runningStem === boxStep.stem && connected);
        return (
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ margin: "0 0 10px" }}>Pokémon Box</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 12,
              }}
            >
              <ChainCard
                step={boxStep}
                loaded={!!saveInfo}
                caught={owned?.size ?? 0}
                owned={owned}
                saveInfo={saveInfo}
                unsupported={false}
                isLive={isLive}
                locked={false}
              />
            </div>
          </section>
        );
      })()}

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 10px" }}>Challenge chain</h2>
        {([3, 4, 5] as const).map((gen) => {
          const genSteps = CHALLENGE_CHAIN.filter((s) => s.gen === gen && s.stem !== "box");
          if (genSteps.length === 0) return null;
          const stages = Array.from(new Set(genSteps.map((s) => s.stage))).sort((a, b) => a - b);
          return (
            <div key={gen} style={{ marginBottom: 18 }}>
              <h3
                style={{
                  margin: "0 0 8px",
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  opacity: 0.65,
                  fontWeight: 700,
                }}
              >
                {GEN_LABELS[gen]}
              </h3>
              {stages.map((stage) => {
                const steps = genSteps.filter((s) => s.stage === stage);
                const locked = !stageUnlocked.has(stage);
                return (
                  <div
                    key={stage}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: 12,
                      marginBottom: 10,
                    }}
                  >
                    {steps.map((step) => {
                      const saveInfo = step.stem ? saves[step.stem] ?? null : null;
                      const loaded = !!saveInfo;
                      const owned = step.stem ? perGame[step.stem] ?? null : null;
                      const caught = owned?.size ?? 0;
                      const unsupported = !step.stem;
                      const isLive = !!(step.stem && runningStem === step.stem && connected);
                      return (
                        <ChainCard
                          key={step.label}
                          step={step}
                          loaded={loaded}
                          caught={caught}
                          owned={owned}
                          saveInfo={saveInfo}
                          unsupported={unsupported}
                          isLive={isLive}
                          locked={locked && !step.external}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
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
      <PokemonCard mon={mon} movesRight />
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
