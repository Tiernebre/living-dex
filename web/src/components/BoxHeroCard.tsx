import { CHALLENGE_CHAIN } from "../chain";
import { thumbnailUrl } from "../format";
import { HeroStat, Pokeball } from "./atoms";

export function BoxHeroCard({
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
        style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: tint }}
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
