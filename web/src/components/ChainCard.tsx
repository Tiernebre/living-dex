import { Link } from "react-router-dom";
import type { SaveInfo } from "../../../hub/protocol.ts";
import { type ChainStep, GEN3_NATIONAL_TOTAL, regionalDexProgress } from "../chain";
import { thumbnailUrl } from "../format";
import { countBoxMons, trainerStarsBreakdown } from "../owned";
import { Pokeball, ProgressPill } from "./atoms";
import { TrainerStars } from "./TrainerSaveCard";

function PrimaryProgress({
  step,
  loaded,
  owned,
  saveInfo,
  tint,
}: {
  step: ChainStep;
  loaded: boolean;
  owned: Set<number> | null;
  saveInfo: SaveInfo | null;
  tint: string;
}) {
  const set = owned ?? new Set<number>();
  const regional = step.stem ? regionalDexProgress(step.stem, set) : null;
  const nationalCaught = loaded ? set.size : 0;
  // Museum-paintings star isn't parsed yet, so this caps at 3 stars
  // (HoF + Hoenn dex + Battle Tower). TODO: parse Lilycove contest paintings.
  const trainerStarsCertain = !!saveInfo;
  return (
    <div
      style={{
        marginTop: 8,
        paddingTop: 8,
        borderTop: "1px dashed color-mix(in srgb, var(--border) 60%, transparent)",
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      {regional && step.endOfGen && (
        <ProgressPill
          label="Regional dex"
          caught={regional.caught}
          total={regional.total}
          tint={tint}
          dim={!loaded}
        />
      )}
      {step.endOfGen && (
        <ProgressPill
          label="National dex"
          caught={nationalCaught}
          total={GEN3_NATIONAL_TOTAL}
          tint={tint}
          dim={!loaded}
        />
      )}
      <TrainerStars
        breakdown={trainerStarsBreakdown(saveInfo)}
        tint={tint}
        dim={!trainerStarsCertain}
      />
    </div>
  );
}

export function ChainCard({
  step,
  loaded,
  caught,
  owned,
  saveInfo,
  unsupported,
  isLive,
  locked,
}: {
  step: ChainStep;
  loaded: boolean;
  caught: number;
  owned: Set<number> | null;
  saveInfo: SaveInfo | null;
  unsupported: boolean;
  isLive: boolean;
  locked: boolean;
}) {
  const tint = step.tint;
  const statusLine = locked
    ? "Locked — complete prior stage"
    : unsupported
    ? "Roadmap"
    : loaded
    ? step.external
      ? `${countBoxMons(saveInfo!)} stored`
      : step.endOfGen
      ? `${caught} species owned`
      : step.primary
      ? "4★ trainer card · no dex goal"
      : "Champion required · no dex goal"
    : "No save loaded";
  const inner = (
    <div
      className="chain-card"
      style={{
        position: "relative",
        padding: "14px 14px 14px 16px",
        borderRadius: 14,
        border: `1px solid color-mix(in srgb, ${tint} 35%, var(--border))`,
        background: `linear-gradient(135deg, color-mix(in srgb, ${tint} 12%, var(--bg-elevated)), var(--bg-elevated) 70%)`,
        overflow: "hidden",
        opacity: locked ? 0.35 : unsupported ? 0.6 : 1,
        filter: locked ? "grayscale(0.7)" : undefined,
        display: "flex",
        gap: 12,
        alignItems: "center",
        minHeight: 88,
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 68,
          flexShrink: 0,
        }}
      >
        {step.mascots.map((dex, i) => {
          const filters: string[] = [];
          if (locked) filters.push("grayscale(0.9)");
          else if (unsupported) filters.push("grayscale(0.4)");
          filters.push(`drop-shadow(0 2px 4px ${tint}66)`);
          return (
            <img
              key={dex}
              src={thumbnailUrl(dex)}
              alt=""
              width={step.mascots.length > 1 ? 52 : 64}
              height={step.mascots.length > 1 ? 52 : 64}
              loading="lazy"
              style={{
                filter: filters.join(" "),
                marginLeft: i > 0 ? -18 : 0,
                zIndex: step.mascots.length - i,
                position: "relative",
              }}
            />
          );
        })}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: 0.2,
              color: `color-mix(in srgb, ${tint} 80%, var(--text))`,
              textTransform: "uppercase",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {step.label}
          </span>
          {step.primary && (
            <span
              title="Primary — aim for a 4★ trainer card"
              style={{
                fontSize: 9,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 0.7,
                padding: "2px 6px",
                borderRadius: 4,
                background: `color-mix(in srgb, ${tint} 18%, transparent)`,
                color: `color-mix(in srgb, ${tint} 85%, var(--text))`,
                border: `1px solid color-mix(in srgb, ${tint} 45%, var(--border))`,
              }}
            >
              ★ Primary
            </span>
          )}
          {step.endOfGen && (
            <span
              title="Completion target: national dex"
              style={{
                fontSize: 9,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 0.7,
                padding: "2px 6px",
                borderRadius: 4,
                background: tint,
                color: "#fff",
                border: "1px solid rgba(0,0,0,0.15)",
              }}
            >
              ★ Dex goal
            </span>
          )}
          {isLive && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 9,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 0.7,
                padding: "2px 6px",
                borderRadius: 4,
                background: "#16a34a",
                color: "#fff",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: "#fff",
                  boxShadow: "0 0 4px #fff",
                }}
              />
              Live
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            opacity: 0.8,
            marginTop: 4,
          }}
        >
          <Pokeball size={12} color={tint} />
          <span>{statusLine}</span>
        </div>
        {step.primary && !locked && (
          <PrimaryProgress step={step} loaded={loaded} owned={owned} saveInfo={saveInfo} tint={tint} />
        )}
      </div>
      {loaded && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            right: -18,
            bottom: -18,
            width: 72,
            height: 72,
            borderRadius: 999,
            opacity: 0.08,
            background: `radial-gradient(circle at 30% 30%, ${tint}, transparent 70%)`,
          }}
        />
      )}
    </div>
  );

  if (step.stem && loaded && !locked) {
    return (
      <Link
        to={`/${step.stem}`}
        style={{ color: "inherit", textDecoration: "none", display: "block" }}
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
