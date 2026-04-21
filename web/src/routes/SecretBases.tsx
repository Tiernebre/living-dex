import { Link, Navigate, useParams } from "react-router-dom";
import type { SecretBase, SecretBaseTeamMember } from "../../../hub/protocol.ts";
import { CHALLENGE_CHAIN, GAME_DISPLAY_NAME, isGameStem } from "../chain";
import { lookup, lookupMove } from "../data";
import { formatSpeciesName, thumbnailUrl } from "../format";
import { lookupSecretBaseLocation } from "../secret-base-locations";
import { useLivingDex } from "../store";

// In-battle trainer class for each ownerType slot — derived from
// gSecretBaseTrainerClasses in pokeruby/src/pokemon_2.c. ownerType is
// (trainerId byte 0 % 5) + gender*5, so 0..4 are male classes and 5..9
// are female. We show the matching VS-sprite + name from this table
// (rather than the overworld sprite flavor in sSecretBaseOwnerGfxIds)
// so the placard matches what you'd see when you battle the base owner.
const OWNER_TRAINERS: { label: string; sprite: string }[] = [
  // Male
  { label: "Youngster",      sprite: "youngster-gen3rs" },
  { label: "Bug Catcher",    sprite: "bugcatcher-gen3rs" },
  { label: "Rich Boy",       sprite: "richboy-gen3" },
  { label: "Camper",         sprite: "camper-gen3rs" },
  { label: "Cool Trainer ♂", sprite: "acetrainer-gen3rs" },
  // Female
  { label: "Lass",           sprite: "lass-gen3rs" },
  { label: "School Kid ♀",   sprite: "schoolkidf-gen3" },
  { label: "Lady",           sprite: "lady-gen3rs" },
  { label: "Picnicker",      sprite: "picnicker-gen3rs" },
  { label: "Cool Trainer ♀", sprite: "acetrainerf-gen3rs" },
];

function trainerSpriteUrl(sprite: string): string {
  return `https://play.pokemonshowdown.com/sprites/trainers/${sprite}.png`;
}

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
  const trainerInfo = OWNER_TRAINERS[base.ownerType];
  const ownerLabel = trainerInfo?.label ?? "Trainer";
  const emphasis = base.isPlayer;
  const loc = lookupSecretBaseLocation(base.secretBaseId);
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
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        {trainerInfo && (
          <img
            src={trainerSpriteUrl(trainerInfo.sprite)}
            alt={ownerLabel}
            title={ownerLabel}
            height={56}
            loading="lazy"
            style={{
              imageRendering: "pixelated",
              filter: `drop-shadow(0 2px 3px ${tint}55)`,
              flexShrink: 0,
            }}
          />
        )}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
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
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          padding: "5px 10px",
          fontSize: 11,
          fontWeight: 600,
          borderRadius: 999,
          border: `1px solid color-mix(in srgb, ${tint} 30%, var(--border))`,
          background: `color-mix(in srgb, ${tint} 10%, var(--bg-elevated))`,
          color: `color-mix(in srgb, ${tint} 80%, var(--text))`,
        }}
        title={
          loc
            ? `Spot ${base.secretBaseId} · ${loc.interior} · tile (${loc.x}, ${loc.y})`
            : `Spot ${base.secretBaseId} · interior id ${Math.floor(base.secretBaseId / 10)}`
        }
      >
        <span aria-hidden>📍</span>
        {loc ? (
          <>
            <span>{loc.route}</span>
            <span style={{ opacity: 0.55 }}>·</span>
            <span style={{ opacity: 0.75 }}>{loc.interior}</span>
            <span style={{ opacity: 0.45, fontVariantNumeric: "tabular-nums" }}>
              ({loc.x}, {loc.y})
            </span>
          </>
        ) : (
          <span style={{ opacity: 0.7 }}>Spot #{base.secretBaseId}</span>
        )}
      </div>
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
