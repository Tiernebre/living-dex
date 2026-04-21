import { Link, Navigate, useParams } from "react-router-dom";
import { lookup, mapsecLabel, ORIGIN_GAME_LABEL } from "../data";
import { CHALLENGE_CHAIN, GAME_DISPLAY_NAME } from "../chain";
import { formatFirstSeen, formatSpeciesName } from "../format";
import { findAllOwnedByKey, locationLabel, type OwnedInSave } from "../owned";
import { useLivingDex } from "../store";
import { Detail } from "../components/atoms";
import { PokemonCard } from "../components/PokemonCard";

export function PokemonDetail() {
  const { key } = useParams<{ key: string }>();
  const { saves, catchLog } = useLivingDex();
  const history = key ? findAllOwnedByKey(saves, key) : [];

  if (!key) return <Navigate to="/" replace />;
  if (history.length === 0) {
    return (
      <section style={{ padding: 32, textAlign: "center", opacity: 0.6, fontStyle: "italic" }}>
        No Pokémon with key <code>{key}</code> in any loaded save.{" "}
        <Link to="/">Back to dashboard</Link>.
      </section>
    );
  }

  // Newest save wins — that's the mon's current home after any transfer chain.
  const current = history[0];
  const { mon } = current;
  const info = lookup(mon.species);
  const metLoc = mapsecLabel(mon.metLocation);
  const origin = ORIGIN_GAME_LABEL[mon.originGame] ?? `Game ${mon.originGame}`;
  const firstSeenAt = catchLog[`${mon.pid}:${mon.otId}`];
  const displayName = mon.nickname || (info ? formatSpeciesName(info.name) : key);

  return (
    <>
      <div style={{ marginBottom: 16, fontSize: 13 }}>
        <Link to="/" style={{ color: "var(--accent-strong)" }}>
          Dashboard
        </Link>
        <span style={{ opacity: 0.4, padding: "0 6px" }}>/</span>
        <Link to={`/${current.stem}`} style={{ color: "var(--accent-strong)" }}>
          {GAME_DISPLAY_NAME[current.stem]}
        </Link>
        <span style={{ opacity: 0.4, padding: "0 6px" }}>/</span>
        <span style={{ opacity: 0.7 }}>{displayName}</span>
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
        <h3
          style={{
            margin: "0 0 10px",
            fontSize: 14,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            opacity: 0.7,
          }}
        >
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
          <Detail label="Currently in" value={`${GAME_DISPLAY_NAME[current.stem]} · ${locationLabel(current.location)}`} />
          <Detail label="Met at" value={mon.metLevel ? `Lv ${mon.metLevel} · ${metLoc}` : "Hatched"} />
          <Detail
            label="OT"
            value={`${mon.otName || "?"} (${mon.otGender === "male" ? "♂" : "♀"}) · ID ${String(
              mon.otId & 0xffff,
            ).padStart(5, "0")}`}
          />
          <Detail label="Origin" value={origin} />
          <Detail label="First seen" value={firstSeenAt ? formatFirstSeen(firstSeenAt) : "—"} />
          <Detail
            label="PID"
            value={mon.pid.toString(16).toUpperCase().padStart(8, "0")}
            mono
          />
          <Detail
            label="OT ID (full)"
            value={mon.otId.toString(16).toUpperCase().padStart(8, "0")}
            mono
          />
        </div>
      </section>
      <JourneySection history={history} />
    </>
  );
}

function JourneySection({ history }: { history: OwnedInSave[] }) {
  return (
    <section
      style={{
        marginTop: 16,
        padding: 16,
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--bg-elevated)",
      }}
    >
      <h3
        style={{
          margin: "0 0 10px",
          fontSize: 14,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          opacity: 0.7,
        }}
      >
        Journey {history.length > 1 && <span style={{ opacity: 0.5 }}>· {history.length} saves</span>}
      </h3>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
        {history.map((entry, i) => {
          const step = CHALLENGE_CHAIN.find((c) => c.stem === entry.stem);
          const tint = step?.tint ?? "var(--accent)";
          const latest = i === 0;
          return (
            <li
              key={entry.stem}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px 10px 16px",
                borderRadius: 10,
                border: `1px solid color-mix(in srgb, ${tint} 35%, var(--border))`,
                background: `linear-gradient(135deg, color-mix(in srgb, ${tint} 10%, var(--bg-surface)), var(--bg-surface) 80%)`,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  insetBlock: 0,
                  left: 0,
                  width: 4,
                  background: tint,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: tint }}>
                  {GAME_DISPLAY_NAME[entry.stem]}
                  {latest && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: tint,
                        color: "var(--bg-base)",
                        marginLeft: 8,
                        verticalAlign: 2,
                      }}
                    >
                      Current
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                  {locationLabel(entry.location)} · Lv {entry.mon.level}
                </div>
              </div>
              <div style={{ fontSize: 11, opacity: 0.7, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                saved {formatFirstSeen(entry.saveInfo.savedAtMs)}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
