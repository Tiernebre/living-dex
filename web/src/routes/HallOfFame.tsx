import { Link, Navigate, useParams } from "react-router-dom";
import type { HallOfFameMon, HallOfFameTeam } from "../../../hub/protocol.ts";
import { CHALLENGE_CHAIN, GAME_DISPLAY_NAME, isGameStem } from "../chain";
import { lookup } from "../data";
import { formatSpeciesName, thumbnailUrl } from "../format";
import { useLivingDex } from "../store";

export function HallOfFame() {
  const params = useParams<{ game: string }>();
  const { saves } = useLivingDex();
  const stem = params.game && isGameStem(params.game) ? params.game : null;
  if (!stem || stem === "box") return <Navigate to="/" replace />;
  const saveInfo = saves[stem] ?? null;
  const step = CHALLENGE_CHAIN.find((c) => c.stem === stem);
  const tint = step?.tint ?? "#6b7280";

  const teams = saveInfo?.hallOfFame ?? [];
  // Newest first — the parser emits oldest-first (in-game ordering).
  const ordered = [...teams].reverse();

  return (
    <>
      <div style={{ marginBottom: 16, display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <Link
          to={`/${stem}`}
          style={{
            fontSize: 12,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.8,
            color: `color-mix(in srgb, ${tint} 80%, var(--text))`,
            textDecoration: "none",
          }}
        >
          ← {GAME_DISPLAY_NAME[stem]}
        </Link>
      </div>
      <header
        style={{
          position: "relative",
          padding: "28px 24px",
          marginBottom: 20,
          borderRadius: 16,
          overflow: "hidden",
          textAlign: "center",
          border: `1px solid color-mix(in srgb, ${tint} 40%, var(--border))`,
          background: `
            radial-gradient(ellipse at top, color-mix(in srgb, ${tint} 30%, var(--bg-elevated)), var(--bg-elevated) 70%),
            var(--bg-elevated)
          `,
        }}
      >
        <Confetti tint={tint} />
        <div
          style={{
            position: "relative",
            fontSize: 11,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 2,
            opacity: 0.75,
            color: `color-mix(in srgb, ${tint} 80%, var(--text))`,
          }}
        >
          {GAME_DISPLAY_NAME[stem]}
        </div>
        <h1 style={{ position: "relative", margin: "4px 0 6px", fontSize: 32, letterSpacing: 1 }}>
          Hall of Fame
        </h1>
        <div style={{ position: "relative", fontSize: 13, opacity: 0.75 }}>
          {saveInfo
            ? teams.length === 0
              ? "No champions recorded yet."
              : `${teams.length} champion${teams.length === 1 ? "" : "s"} enshrined` +
                (saveInfo.playerName ? ` — trainer ${saveInfo.playerName}` : "")
            : "No save loaded."}
        </div>
      </header>

      {ordered.length === 0 ? (
        <section style={{ padding: 32, textAlign: "center", opacity: 0.6, fontStyle: "italic" }}>
          Clear the Elite Four to record your first champion team.
        </section>
      ) : (
        <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: 16 }}>
          {ordered.map((team, i) => (
            <li key={i}>
              <TeamPlacard
                team={team}
                number={teams.length - i}
                isLatest={i === 0}
                tint={tint}
              />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function TeamPlacard({
  team,
  number,
  isLatest,
  tint,
}: {
  team: HallOfFameTeam;
  number: number;
  isLatest: boolean;
  tint: string;
}) {
  return (
    <article
      style={{
        position: "relative",
        padding: "16px 18px 18px 22px",
        border: `1px solid color-mix(in srgb, ${tint} ${isLatest ? 50 : 30}%, var(--border))`,
        borderRadius: 14,
        background: `linear-gradient(135deg, color-mix(in srgb, ${tint} ${isLatest ? 14 : 8}%, var(--bg-elevated)), var(--bg-elevated) 75%)`,
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
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 0.8,
            color: `color-mix(in srgb, ${tint} 80%, var(--text))`,
          }}
        >
          Clear #{number}
        </div>
        {isLatest && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              padding: "2px 8px",
              borderRadius: 999,
              background: tint,
              color: "white",
            }}
          >
            Latest
          </span>
        )}
      </header>
      <ol
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
        }}
      >
        {team.mons.map((mon, i) => (
          <li key={i}>
            <HofMonCard mon={mon} tint={tint} />
          </li>
        ))}
      </ol>
    </article>
  );
}

function HofMonCard({ mon, tint }: { mon: HallOfFameMon; tint: string }) {
  const info = lookup(mon.species);
  const displayName = info ? formatSpeciesName(info.name) : `#${mon.species}`;
  const nickShownAsSpecies =
    !mon.nickname || mon.nickname.toUpperCase() === (info?.name ?? "").toUpperCase();
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 10,
        border: `1px solid color-mix(in srgb, ${tint} 25%, var(--border))`,
        background: "var(--bg-surface)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        textAlign: "center",
      }}
    >
      {info ? (
        <img
          src={thumbnailUrl(info.nationalDex)}
          alt={displayName}
          width={64}
          height={64}
          loading="lazy"
          style={{ filter: `drop-shadow(0 2px 3px ${tint}55)` }}
        />
      ) : (
        <div
          style={{
            width: 64,
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.5,
            fontSize: 11,
          }}
        >
          ?
        </div>
      )}
      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.1 }}>
        {nickShownAsSpecies ? displayName : mon.nickname}
      </div>
      {!nickShownAsSpecies && (
        <div style={{ fontSize: 11, opacity: 0.65 }}>{displayName}</div>
      )}
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.5,
          color: `color-mix(in srgb, ${tint} 70%, var(--text))`,
        }}
      >
        Lv. {mon.level}
      </div>
    </div>
  );
}

// Decorative confetti specks inspired by the in-game HoF / credits.
function Confetti({ tint }: { tint: string }) {
  const specks = [
    { l: "8%", t: "22%", s: 5, c: tint, d: 0.7 },
    { l: "18%", t: "68%", s: 4, c: "#f4c430", d: 0.8 },
    { l: "27%", t: "14%", s: 6, c: "#4caaff", d: 0.55 },
    { l: "38%", t: "78%", s: 4, c: tint, d: 0.6 },
    { l: "54%", t: "18%", s: 5, c: "#ff4d6d", d: 0.7 },
    { l: "68%", t: "72%", s: 6, c: "#f4c430", d: 0.55 },
    { l: "80%", t: "30%", s: 4, c: tint, d: 0.75 },
    { l: "90%", t: "62%", s: 5, c: "#4caaff", d: 0.5 },
  ];
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {specks.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: p.l,
            top: p.t,
            width: p.s,
            height: p.s,
            borderRadius: 999,
            background: p.c,
            opacity: p.d,
            boxShadow: `0 0 6px ${p.c}`,
          }}
        />
      ))}
    </div>
  );
}
