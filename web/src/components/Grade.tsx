import { useEffect, useState } from "react";
import { GRADE_STYLE, GRADE_THRESHOLDS, type Grade, gradePokemon } from "../grade";
import { DexPopover } from "./DexPopover";

export function GradeLetter({ grade }: { grade: Grade }) {
  const s = GRADE_STYLE[grade];
  return (
    <span
      style={{
        fontWeight: 800,
        fontSize: 18,
        lineHeight: 1,
        color: s.ring,
        letterSpacing: 0.5,
        fontVariantNumeric: "tabular-nums",
        textShadow: "0 1px 0 rgba(0,0,0,0.15)",
      }}
    >
      {grade}
    </span>
  );
}

export function GradeBadge({ grade }: { grade: Grade }) {
  const s = GRADE_STYLE[grade];
  const glow = grade === "A" || grade === "S" || grade === "S+";
  return (
    <span
      className={glow ? "grade-badge-glow" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 34,
        height: 34,
        padding: "0 8px",
        borderRadius: 8,
        background: s.bg,
        color: s.fg,
        fontWeight: 800,
        fontSize: 15,
        letterSpacing: 0.3,
        boxShadow: `0 0 0 1px ${s.ring}, 0 1px 2px rgba(0,0,0,0.15)`,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {grade}
    </span>
  );
}

export function GradeBreakdown({
  graded,
  nature,
}: {
  graded: ReturnType<typeof gradePokemon>;
  nature: string;
}) {
  const s = GRADE_STYLE[graded.grade];
  const rankLabel = (r: number | null) =>
    r == null ? "?" : r === 1 ? "#1 (highest)" : r === 5 ? "#5 (lowest)" : `#${r}`;
  const nextUp = [...GRADE_THRESHOLDS].reverse().find((t) => t.min > graded.total);
  const autoSPlus = graded.grade === "S+";

  const base = (graded.ivSum / 186) * 100;
  const Row = ({
    label,
    value,
    accent,
  }: {
    label: string;
    value: React.ReactNode;
    accent?: string;
  }) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        fontSize: 12,
        padding: "2px 0",
      }}
    >
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span style={{ fontWeight: 600, color: accent, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  );

  return (
    <div style={{ minWidth: 240, fontSize: 13 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 34,
            height: 34,
            padding: "0 8px",
            borderRadius: 8,
            background: s.bg,
            color: s.fg,
            fontWeight: 800,
            fontSize: 16,
            boxShadow: `0 0 0 1px ${s.ring}`,
          }}
        >
          {graded.grade}
        </span>
        <div>
          <div style={{ fontWeight: 700 }}>Grade {graded.grade}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>
            score <span style={{ fontWeight: 700 }}>{graded.total.toFixed(1)}</span>
          </div>
        </div>
      </div>

      <div
        style={{
          paddingTop: 8,
          borderTop: "1px dashed color-mix(in srgb, var(--border) 60%, transparent)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            opacity: 0.65,
            marginBottom: 4,
          }}
        >
          IVs
        </div>
        <Row
          label="Total"
          value={`${graded.ivSum} / 186 (${((graded.ivSum / 186) * 100).toFixed(0)}%)`}
        />
        <Row
          label="Perfect (31)"
          value={`${graded.perfectCount} ×`}
          accent={graded.perfectCount > 0 ? "var(--iv-perfect, #059669)" : undefined}
        />
        <Row
          label="Green+ (≥26)"
          value={`${graded.greenCount} ×`}
          accent={graded.greenCount > 0 ? "var(--iv-great, #16a34a)" : undefined}
        />
        <Row
          label="IV score"
          value={
            <>
              {base.toFixed(1)}
              {graded.perfectCount > 0 && (
                <span style={{ opacity: 0.7 }}> +{graded.perfectCount * 2}</span>
              )}
              {graded.greenCount > 0 && <span style={{ opacity: 0.7 }}> +{graded.greenCount}</span>}
              {" = "}
              <strong>{graded.ivScore.toFixed(1)}</strong>
            </>
          }
        />
      </div>

      <div
        style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: "1px dashed color-mix(in srgb, var(--border) 60%, transparent)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            opacity: 0.65,
            marginBottom: 4,
          }}
        >
          Nature
        </div>
        <Row
          label={graded.nature.neutral ? "Kind" : nature}
          value={graded.nature.neutral ? "Neutral" : nature}
        />
        {!graded.nature.neutral && (
          <>
            <Row label="Boosts" value={rankLabel(graded.nature.plusRank)} />
            <Row label="Lowers" value={rankLabel(graded.nature.minusRank)} />
          </>
        )}
        <Row
          label="Multiplier"
          value={`×${graded.nature.factor.toFixed(2)}`}
          accent={
            graded.nature.factor >= 0.88
              ? "#16a34a"
              : graded.nature.factor < 0.6
              ? "#ef4444"
              : undefined
          }
        />
      </div>

      <div
        style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: "1px dashed color-mix(in srgb, var(--border) 60%, transparent)",
          fontSize: 12,
          opacity: 0.85,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            opacity: 0.75,
            marginBottom: 4,
          }}
        >
          Final
        </div>
        <div>
          {graded.ivScore.toFixed(1)} × {graded.nature.factor.toFixed(2)} ={" "}
          <strong style={{ color: s.ring }}>{graded.total.toFixed(1)}</strong>
        </div>
        {autoSPlus && (
          <div style={{ marginTop: 6, color: "#f59e0b", fontWeight: 600 }}>
            ✨ S+: near-flawless IVs (all ≥25) with a well-fit nature.
          </div>
        )}
        {nextUp && (
          <div style={{ marginTop: 6 }}>
            Needs <strong>≥{nextUp.min}</strong> for <strong>{nextUp.grade}</strong> (short by{" "}
            <strong>{(nextUp.min - graded.total).toFixed(1)}</strong>).
          </div>
        )}
      </div>
    </div>
  );
}

export function GradeChip({
  graded,
  nature,
  fancy,
}: {
  graded: ReturnType<typeof gradePokemon>;
  nature: string;
  fancy: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const close = () => setAnchor(null);

  useEffect(() => {
    if (!anchor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [anchor]);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          if (anchor) close();
          else setAnchor(e.currentTarget);
        }}
        aria-label={`Grade ${graded.grade} — show breakdown`}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          margin: 0,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        {fancy ? <GradeBadge grade={graded.grade} /> : <GradeLetter grade={graded.grade} />}
      </button>
      {anchor && (
        <DexPopover anchor={anchor} onClose={close}>
          <GradeBreakdown graded={graded} nature={nature} />
        </DexPopover>
      )}
    </>
  );
}
