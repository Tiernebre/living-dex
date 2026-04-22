import type { SaveInfo } from "../../../hub/protocol.ts";
import { lookup } from "../data";
import { formatSpeciesName } from "../format";
import { isMirageVisibleToday, predictMirageHits } from "../mirage";

type Props = {
  saveInfo: SaveInfo;
  // Override party (for live view — use current in-memory party instead of
  // what was in the save at the last save point).
  party?: SaveInfo["party"];
  tint: string;
};

const HORIZON_DAYS = 365 * 3;

export function MirageIslandCard({ saveInfo, party, tint }: Props) {
  const rnd = saveInfo.mirageRnd;
  if (rnd === null) return null;
  const team = party ?? saveInfo.party;
  const today = isMirageVisibleToday(rnd, team);
  const upcoming = predictMirageHits(rnd, team, HORIZON_DAYS)
    .filter((h) => h.dayOffset > 0)
    .slice(0, 5);

  const visible = today !== null;
  const cardTint = visible ? "#f59e0b" : tint;
  const bg = visible
    ? `linear-gradient(135deg, color-mix(in srgb, ${cardTint} 28%, var(--bg-surface)), color-mix(in srgb, ${cardTint} 10%, var(--bg-surface)) 75%)`
    : `linear-gradient(135deg, color-mix(in srgb, ${cardTint} 12%, var(--bg-surface)), var(--bg-surface) 75%)`;

  return (
    <section
      style={{
        position: "relative",
        padding: "14px 16px 14px 22px",
        borderRadius: 12,
        border: `1px solid color-mix(in srgb, ${cardTint} ${visible ? 65 : 35}%, var(--border))`,
        background: bg,
        marginBottom: 16,
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
          width: 5,
          background: cardTint,
          boxShadow: visible ? `0 0 14px ${cardTint}` : undefined,
        }}
      />
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 20 }} aria-hidden>
          {visible ? "🏝️" : "🌊"}
        </span>
        <h3
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: 0.3,
            color: visible ? cardTint : `color-mix(in srgb, ${cardTint} 80%, var(--text))`,
          }}
        >
          Mirage Island
        </h3>
        {visible ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              padding: "3px 10px",
              borderRadius: 999,
              background: cardTint,
              color: "#1a1202",
              boxShadow: `0 0 10px color-mix(in srgb, ${cardTint} 60%, transparent)`,
            }}
          >
            Visible today
          </span>
        ) : (
          <span style={{ fontSize: 12, opacity: 0.65 }}>Not visible today</span>
        )}
      </header>

      {visible && today ? (
        <p style={{ margin: "0 0 8px", fontSize: 13 }}>
          <strong>
            {today.mon.nickname ||
              formatSpeciesName(lookup(today.mon.species)?.name ?? "?")}
          </strong>{" "}
          (party slot {today.slot + 1}) is triggering the island today — check
          Pacifidlog's eastern-most house for the old man's report, then surf
          east.
        </p>
      ) : null}

      {upcoming.length > 0 ? (
        <div style={{ fontSize: 12, opacity: 0.85 }}>
          <div style={{ marginBottom: 4, fontWeight: 700, letterSpacing: 0.3 }}>
            Next visible
          </div>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 4,
            }}
          >
            {upcoming.map((h, i) => {
              const info = lookup(h.mon.species);
              const name = h.mon.nickname ||
                (info ? formatSpeciesName(info.name) : "?");
              return (
                <li key={i}>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    +{h.dayOffset}d
                  </span>{" "}
                  — {name} <span style={{ opacity: 0.55 }}>(slot {h.slot + 1})</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 12, opacity: 0.65 }}>
          No party member's PID matches an upcoming RNG roll within{" "}
          {HORIZON_DAYS} days — swap someone in to chase it.
        </p>
      )}

      <p
        style={{
          margin: "10px 0 0",
          fontSize: 11,
          opacity: 0.5,
          fontStyle: "italic",
        }}
      >
        RNG advances once per in-game day. Predictions assume the save's stored
        RND; if the game hasn't booted recently the current day may have
        shifted.
      </p>
    </section>
  );
}
