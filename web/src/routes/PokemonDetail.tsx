import { Link, Navigate, useParams } from "react-router-dom";
import { lookup, mapsecLabel, ORIGIN_GAME_LABEL } from "../data";
import { GAME_DISPLAY_NAME, isGameStem } from "../chain";
import { formatFirstSeen, formatSpeciesName } from "../format";
import { findOwnedByKey, locationLabel } from "../owned";
import { useLivingDex } from "../store";
import { Detail } from "../components/atoms";
import { PokemonCard } from "../components/PokemonCard";

export function PokemonDetail() {
  const { game: gameParam, key } = useParams<{ game: string; key: string }>();
  const { saves, catchLog } = useLivingDex();
  const stem = gameParam && isGameStem(gameParam) ? gameParam : null;
  const saveInfo = stem ? saves[stem] ?? null : null;
  const found = stem && saveInfo && key ? findOwnedByKey(saveInfo, key) : null;

  if (!stem) return <Navigate to="/" replace />;
  if (!saveInfo) {
    return (
      <section style={{ padding: 32, textAlign: "center", opacity: 0.6, fontStyle: "italic" }}>
        No save loaded for {GAME_DISPLAY_NAME[stem]}. <Link to="/">Back to dashboard</Link>.
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
        <Link to="/" style={{ color: "var(--accent-strong)" }}>
          Dashboard
        </Link>
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
          <Detail label="Where" value={locationLabel(location)} />
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
    </>
  );
}
