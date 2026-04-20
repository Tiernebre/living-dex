import { Link } from "react-router-dom";
import type { DecodedPokemon, GameStem } from "../../../hub/protocol.ts";
import { lookup } from "../data";
import { CHALLENGE_CHAIN } from "../chain";
import { formatFirstSeen, formatSpeciesName, pokemonKey, thumbnailUrl } from "../format";
import { effectiveLevel } from "../stats";
import { TypeBadge } from "./atoms";

export function LatestCatchCard({
  stem,
  mon,
  at,
}: {
  stem: GameStem;
  mon: DecodedPokemon;
  at: number;
}) {
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
          <div
            style={{
              fontSize: 13,
              opacity: 0.8,
              marginTop: 2,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span>
              Lv {effectiveLevel(mon, info)} · {mon.nature}
            </span>
            {info && info.types.map((t) => <TypeBadge key={t} type={t} />)}
            <span style={{ opacity: 0.6 }}>·</span>
            <span
              style={{
                textTransform: "uppercase",
                letterSpacing: 0.5,
                fontSize: 11,
                fontWeight: 700,
                color: tint,
              }}
            >
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
