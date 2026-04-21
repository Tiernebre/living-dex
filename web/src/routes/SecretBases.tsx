import { Link, Navigate, useParams } from "react-router-dom";
import type { SecretBase, SecretBaseTeamMember } from "../../../hub/protocol.ts";
import { CHALLENGE_CHAIN, GAME_DISPLAY_NAME, isGameStem } from "../chain";
import { lookup, lookupMove } from "../data";
import { formatSpeciesName, thumbnailUrl } from "../format";
import { useLivingDex } from "../store";

// Sprite bucket (sSecretBaseOwnerGfxIds in pokeruby/src/secret_base.c) for the
// 10 NPC variants a secret-base owner can take. Not the in-battle trainer
// class — just the overworld sprite flavor. Used here as a short label so the
// 20 bases don't all read the same.
const OWNER_LABELS = [
  "Youngster",
  "Bug Catcher",
  "Boy",
  "Camper",
  "Man",
  "Lass",
  "Girl",
  "Woman",
  "Picnicker",
  "Lady",
];

export function SecretBases() {
  const params = useParams<{ game: string }>();
  const { saves } = useLivingDex();
  const stem = params.game && isGameStem(params.game) ? params.game : null;
  if (!stem || stem === "box") return <Navigate to="/" replace />;
  const saveInfo = saves[stem] ?? null;
  const tint = CHALLENGE_CHAIN.find((c) => c.stem === stem)?.tint ?? "#6b7280";

  const bases = saveInfo?.secretBases ?? [];
  // Player's own base first, then guests by most-recently-entered.
  const ordered = [...bases].sort((a, b) => {
    if (a.isPlayer !== b.isPlayer) return a.isPlayer ? -1 : 1;
    return b.numTimesEntered - a.numTimesEntered;
  });

  return (
    <>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          gap: 10,
          alignItems: "baseline",
          flexWrap: "wrap",
        }}
      >
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
        <div
          style={{
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
        <h1 style={{ margin: "4px 0 6px", fontSize: 32, letterSpacing: 1 }}>
          Secret Bases
        </h1>
        <div style={{ fontSize: 13, opacity: 0.75 }}>
          {saveInfo
            ? bases.length === 0
              ? "No secret bases placed or mixed in yet."
              : `${bases.length} base${bases.length === 1 ? "" : "s"} on record`
            : "No save loaded."}
        </div>
      </header>

      {ordered.length === 0 ? (
        <section
          style={{ padding: 32, textAlign: "center", opacity: 0.6, fontStyle: "italic" }}
        >
          Use Secret Power on a bush, tree, or cave wall — then mix records with
          another trainer to fill out this list.
        </section>
      ) : (
        <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: 16 }}>
          {ordered.map((base, i) => (
            <li key={`${base.secretBaseId}-${i}`}>
              <BasePlacard base={base} tint={tint} />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function BasePlacard({ base, tint }: { base: SecretBase; tint: string }) {
  const ownerLabel = OWNER_LABELS[base.ownerType] ?? "Trainer";
  const emphasis = base.isPlayer;
  return (
    <article
      style={{
        position: "relative",
        padding: "16px 18px 18px 22px",
        border: `1px solid color-mix(in srgb, ${tint} ${emphasis ? 50 : 30}%, var(--border))`,
        borderRadius: 14,
        background: `linear-gradient(135deg, color-mix(in srgb, ${tint} ${emphasis ? 14 : 8}%, var(--bg-elevated)), var(--bg-elevated) 75%)`,
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
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
          flexWrap: "wrap",
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
          {ownerLabel}
          <span style={{ opacity: 0.55, marginLeft: 6 }}>
            · {base.trainerGender === "female" ? "♀" : "♂"}
          </span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>
          {base.trainerName || "(unnamed)"}
        </div>
        {emphasis && (
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
            Your base
          </span>
        )}
        {base.battledOwnerToday && !emphasis && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              padding: "2px 8px",
              borderRadius: 999,
              background: `color-mix(in srgb, ${tint} 25%, var(--bg-elevated))`,
              border: `1px solid color-mix(in srgb, ${tint} 40%, var(--border))`,
              color: `color-mix(in srgb, ${tint} 80%, var(--text))`,
            }}
          >
            Battled today
          </span>
        )}
        <div
          style={{
            marginLeft: "auto",
            fontSize: 11,
            opacity: 0.7,
            fontVariantNumeric: "tabular-nums",
            textAlign: "right",
          }}
        >
          <div>
            ID {String(base.trainerId & 0xffff).padStart(5, "0")}
          </div>
          <div style={{ opacity: 0.75 }}>
            {base.decorations.length} deco
            {base.numTimesEntered > 0
              ? ` · entered ${base.numTimesEntered}×`
              : ""}
          </div>
        </div>
      </header>
      {base.team.length === 0 ? (
        <div style={{ fontSize: 12, opacity: 0.55, fontStyle: "italic" }}>
          No party set.
        </div>
      ) : (
        <ol
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          {base.team.map((m, i) => (
            <li key={i}>
              <TeamMember mon={m} tint={tint} />
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

function TeamMember({ mon, tint }: { mon: SecretBaseTeamMember; tint: string }) {
  const info = lookup(mon.species);
  const displayName = info ? formatSpeciesName(info.name) : `#${mon.species}`;
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 10,
        border: `1px solid color-mix(in srgb, ${tint} 25%, var(--border))`,
        background: "var(--bg-surface)",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      {info ? (
        <img
          src={thumbnailUrl(info.nationalDex)}
          alt={displayName}
          width={56}
          height={56}
          loading="lazy"
          style={{ flexShrink: 0, filter: `drop-shadow(0 2px 3px ${tint}55)` }}
        />
      ) : (
        <div
          style={{
            width: 56,
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.5,
            fontSize: 11,
            flexShrink: 0,
          }}
        >
          ?
        </div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 6,
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.1 }}>
            {displayName}
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
              color: `color-mix(in srgb, ${tint} 70%, var(--text))`,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            Lv.{mon.level}
          </div>
        </div>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "4px 0 0",
            fontSize: 11,
            opacity: 0.8,
            display: "grid",
            gap: 1,
          }}
        >
          {mon.moves
            .filter((id) => id !== 0)
            .map((id, i) => {
              const move = lookupMove(id);
              return (
                <li key={i} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {move ? formatSpeciesName(move.name) : `Move #${id}`}
                </li>
              );
            })}
        </ul>
      </div>
    </div>
  );
}
