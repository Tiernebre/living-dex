import { useLivingDex } from "./store";
import speciesData from "./species.json";
import movesData from "./moves.json";
import type { DecodedPokemon } from "../../hub/protocol.ts";

type Species = {
  nationalDex: number;
  name: string;
  types: string[];
  sprite: string | null;
  internalIndex: number;
  baseStats: StatBlock;
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
              border: "1px solid #e5e7eb",
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
  if (v === 31) return { color: "#6b5500", weight: 700 };
  if (v >= 26) return { color: "#1b5e20", weight: 600 };
  if (v >= 16) return {};
  if (v >= 1) return { color: "#8f3d00" };
  return { color: "#a30000", weight: 600 };
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
}: {
  ivs: StatBlock;
  evs: StatBlock;
  nature: string;
  baseStats?: StatBlock;
}) {
  const effect = natureEffect(nature);
  const colorFor = (k: StatKey) =>
    effect?.plus === k ? "#1b5e20" : effect?.minus === k ? "#a30000" : undefined;
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
                    fontWeight: 600,
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

function PokemonCard({ mon, movesRight = false }: { mon: DecodedPokemon; movesRight?: boolean }) {
  const info = lookup(mon.species);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: 8,
        border: "1px solid #ddd",
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
        {movesRight ? (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 240px", minWidth: 0 }}>
              <StatsTable ivs={mon.ivs} evs={mon.evs} nature={mon.nature} baseStats={info?.baseStats} />
            </div>
            <div style={{ flex: "1 1 240px", minWidth: 0 }}>
              <MovesList moves={mon.moves} />
            </div>
          </div>
        ) : (
          <>
            <StatsTable ivs={mon.ivs} evs={mon.evs} nature={mon.nature} baseStats={info?.baseStats} />
            <MovesList moves={mon.moves} />
          </>
        )}
      </div>
    </div>
  );
}

export function App() {
  const { connected, game, party, enemyParty, inBattle, source, lastUpdateAt } = useLivingDex();
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
      </header>
      <h2>Current Matchup</h2>
      {inBattle && activeEnemy ? (
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
      )}
      <h2>Party</h2>
      <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
        {party.map((mon, i) => (
          <li key={i} style={mon ? undefined : { opacity: 0.4 }}>
            {mon ? <PokemonCard mon={mon} movesRight /> : "—"}
          </li>
        ))}
      </ol>
    </main>
  );
}
