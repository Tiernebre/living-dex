import { useLivingDex } from "./store";
import speciesData from "./species.json";

type Species = { nationalDex: number; name: string; types: string[]; sprite: string | null; internalIndex: number };
const species = speciesData as Record<string, Species>;

function lookup(id: number): Species | undefined {
  return species[String(id)];
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

function StatsTable({ ivs, evs }: { ivs: StatBlock; evs: StatBlock }) {
  return (
    <table style={{ marginTop: 6, fontSize: 12, borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ opacity: 0.6 }}>
          <th style={{ textAlign: "left", paddingRight: 10 }}></th>
          {STATS.map(([k, label]) => (
            <th key={k} style={{ textAlign: "right", padding: "0 6px", fontWeight: 500 }}>{label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style={{ paddingRight: 10, opacity: 0.7 }}>IV</td>
          {STATS.map(([k]) => (
            <td key={k} style={{ textAlign: "right", padding: "0 6px", fontVariantNumeric: "tabular-nums" }}>
              {ivs[k]}
            </td>
          ))}
        </tr>
        <tr>
          <td style={{ paddingRight: 10, opacity: 0.7 }}>EV</td>
          {STATS.map(([k]) => (
            <td key={k} style={{ textAlign: "right", padding: "0 6px", fontVariantNumeric: "tabular-nums" }}>
              {evs[k]}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

export function App() {
  const { connected, game, party, source, lastUpdateAt } = useLivingDex();
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <h1>Living Dex</h1>
      <p>
        <strong>mGBA:</strong> {connected ? "connected" : "disconnected"}
        {game && ` — ${game.name} (rev ${game.revision})`}
      </p>
      <p>
        <strong>Source:</strong> {source ?? "none"}
        {lastUpdateAt && ` — updated ${new Date(lastUpdateAt).toLocaleTimeString()}`}
      </p>
      <h2>Party</h2>
      <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
        {party.map((mon, i) => {
          if (!mon) return <li key={i} style={{ opacity: 0.4 }}>—</li>;
          const info = lookup(mon.species);
          return (
            <li
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 8,
                border: "1px solid #ddd",
                borderRadius: 8,
              }}
            >
              {info?.sprite && (
                <img src={info.sprite} alt={info.name} width={64} height={64} style={{ imageRendering: "pixelated" }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>
                  {mon.nickname}
                  {info && <span style={{ fontWeight: 400, opacity: 0.7 }}> — {info.name}</span>}
                </div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  Lv {mon.level} · {mon.nature}
                  {info && ` · ${info.types.join(" / ")}`}
                </div>
                <StatsTable ivs={mon.ivs} evs={mon.evs} />
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
