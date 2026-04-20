import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import type { GameStem } from "../../../hub/protocol.ts";
import type { SaveInfo } from "../../../hub/protocol.ts";
import { hoennDex } from "../data";
import { CHALLENGE_CHAIN, GAME_DISPLAY_NAME } from "../chain";
import { thumbnailUrl, trainerArtUrl, trainerCharacterName } from "../format";
import type { TrainerStar } from "../owned";
import { StarIcon } from "./atoms";

export function TrainerSaveCard({
  stem,
  saveInfo,
  speciesCount,
  linkTo,
  showSeconds,
  savedAtMs,
}: {
  stem: GameStem;
  saveInfo: SaveInfo;
  speciesCount: number;
  linkTo?: string;
  showSeconds?: boolean;
  savedAtMs?: number;
}) {
  const step = CHALLENGE_CHAIN.find((c) => c.stem === stem);
  const tint = step?.tint ?? "#6b7280";
  const mascots = step?.mascots ?? [];
  const s = saveInfo;

  const containerStyle: React.CSSProperties = {
    color: "inherit",
    textDecoration: "none",
    position: "relative",
    padding: "14px 16px 14px 20px",
    border: `1px solid color-mix(in srgb, ${tint} 35%, var(--border))`,
    borderRadius: 14,
    background: `linear-gradient(135deg, color-mix(in srgb, ${tint} 12%, var(--bg-elevated)), var(--bg-elevated) 70%)`,
    display: "flex",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap",
    overflow: "hidden",
  };

  const body = (
    <>
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 72,
          flexShrink: 0,
        }}
      >
        {mascots.map((dex, i) => (
          <img
            key={dex}
            src={thumbnailUrl(dex)}
            alt=""
            width={mascots.length > 1 ? 56 : 68}
            height={mascots.length > 1 ? 56 : 68}
            loading="lazy"
            style={{
              filter: `drop-shadow(0 2px 4px ${tint}66)`,
              marginLeft: i > 0 ? -18 : 0,
              zIndex: mascots.length - i,
              position: "relative",
            }}
          />
        ))}
      </div>
      <div style={{ minWidth: 0 }}>
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
          {GAME_DISPLAY_NAME[stem]}
        </div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{s.playerName || "(unnamed)"}</div>
        <div
          style={{
            fontSize: 12,
            opacity: 0.7,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <img
            src={trainerArtUrl(stem, s.playerGender)}
            alt={trainerCharacterName(stem, s.playerGender)}
            title={trainerCharacterName(stem, s.playerGender)}
            height={36}
            loading="lazy"
            style={{
              imageRendering: "pixelated",
              filter: `drop-shadow(0 1px 2px ${tint}55)`,
            }}
          />
          <span>
            {trainerCharacterName(stem, s.playerGender)} · ID{" "}
            {String(s.trainerId & 0xffff).padStart(5, "0")}
          </span>
        </div>
      </div>
      <div style={{ marginLeft: "auto", textAlign: "right", position: "relative" }}>
        <div
          style={{
            fontSize: 11,
            opacity: 0.6,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Play time
        </div>
        <div
          style={{
            fontSize: showSeconds ? 22 : 20,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {s.playTime.hours}:{String(s.playTime.minutes).padStart(2, "0")}
          {showSeconds ? `:${String(s.playTime.seconds).padStart(2, "0")}` : ""}
        </div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {savedAtMs
            ? `saved ${new Date(savedAtMs).toLocaleString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                ...(showSeconds ? { second: "2-digit" } : {}),
              })}`
            : `${speciesCount} / ${hoennDex.length} species`}
        </div>
      </div>
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
          pointerEvents: "none",
        }}
      />
    </>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} style={containerStyle}>
        {body}
      </Link>
    );
  }
  return <div style={containerStyle}>{body}</div>;
}

export function TrainerStars({
  breakdown,
  tint,
  dim,
}: {
  breakdown: TrainerStar[];
  tint: string;
  dim: boolean;
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const open = pos !== null;
  const close = () => setPos(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onClick = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);
  const earned = breakdown.filter((s) => s.earned).length;
  return (
    <div onClick={(e) => e.preventDefault()}>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (open) {
            close();
          } else {
            const r = e.currentTarget.getBoundingClientRect();
            setPos({ left: r.left, top: r.bottom + 6 });
          }
        }}
        title={breakdown.map((s) => `${s.unknown ? "?" : s.earned ? "★" : "☆"} ${s.label}`).join("\n")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          borderRadius: 999,
          border: `1px solid color-mix(in srgb, ${tint} 35%, var(--border))`,
          background: `color-mix(in srgb, ${tint} 10%, var(--bg-elevated))`,
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 11,
          color: "inherit",
          opacity: dim ? 0.55 : 1,
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            opacity: 0.7,
          }}
        >
          Trainer card
        </span>
        <span style={{ display: "inline-flex", gap: 4 }}>
          {breakdown.map((s, i) => (
            <span key={i} title={`${s.label} — ${s.detail}`}>
              <StarIcon filled={s.earned} />
            </span>
          ))}
        </span>
        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            fontWeight: 700,
            color: `color-mix(in srgb, ${tint} 80%, var(--text))`,
          }}
        >
          {earned}/{breakdown.length}
        </span>
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              zIndex: 1000,
              width: 240,
              padding: 10,
              borderRadius: 10,
              background: "var(--bg-surface)",
              border: `1px solid color-mix(in srgb, ${tint} 35%, var(--border))`,
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.18)",
              fontSize: 12,
            }}
          >
            {breakdown.map((s, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "6px 0",
                  borderTop:
                    i === 0
                      ? "none"
                      : "1px dashed color-mix(in srgb, var(--border) 70%, transparent)",
                  opacity: s.unknown ? 0.55 : 1,
                }}
              >
                <span style={{ marginTop: 1 }}>
                  <StarIcon filled={s.earned} size={20} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{s.label}</div>
                  <div style={{ opacity: 0.75 }}>{s.detail}</div>
                  {s.unknown && (
                    <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>
                      Not yet decoded from the save.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
