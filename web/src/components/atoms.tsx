import { TYPE_COLORS } from "../format";
import { lookupMove } from "../data";
import { formatSpeciesName } from "../format";

export function Pokeball({ size = 18, color = "#ef4444" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      style={{ display: "inline-block", flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="11" fill="#fff" stroke="#0f172a" strokeWidth="1.5" />
      <path d="M1 12 A11 11 0 0 1 23 12" fill={color} stroke="#0f172a" strokeWidth="1.5" />
      <line x1="1" y1="12" x2="23" y2="12" stroke="#0f172a" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3.2" fill="#fff" stroke="#0f172a" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="1.3" fill="#fff" stroke="#0f172a" strokeWidth="1" />
    </svg>
  );
}

export function TypeBadge({ type }: { type: string }) {
  const bg = TYPE_COLORS[type] ?? "#6b7280";
  return (
    <span
      style={{
        display: "inline-block",
        background: bg,
        color: "#fff",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        padding: "2px 8px",
        borderRadius: 999,
        textShadow: "0 1px 1px rgba(0,0,0,0.35)",
        lineHeight: 1.4,
      }}
    >
      {type}
    </span>
  );
}

export function MovesList({ moves }: { moves: { id: number; pp: number }[] }) {
  if (moves.length === 0) return null;
  return (
    <div
      style={{
        marginTop: 8,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 6,
        maxWidth: 520,
      }}
    >
      {moves.map((m, i) => {
        const info = lookupMove(m.id);
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 8px",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 12,
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            {info ? <TypeBadge type={info.type} /> : <span style={{ opacity: 0.5 }}>?</span>}
            <span
              style={{
                fontWeight: 600,
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {info ? formatSpeciesName(info.name) : `Move #${m.id}`}
            </span>
            <span style={{ opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>
              {m.pp}/{info?.pp ?? "?"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const BADGE_TONES: Record<string, { bg: string; fg: string; dot: string }> = {
  success: { bg: "#dcfce7", fg: "#14532d", dot: "#16a34a" },
  danger: { bg: "#fee2e2", fg: "#7f1d1d", dot: "#dc2626" },
  info: { bg: "#dbeafe", fg: "#1e3a8a", dot: "#2563eb" },
  muted: { bg: "#f1f5f9", fg: "#475569", dot: "#94a3b8" },
};

export function StatusBadge({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: string;
  tone: keyof typeof BADGE_TONES;
  detail?: string;
}) {
  const t = BADGE_TONES[tone];
  return (
    <span
      title={detail}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.4,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: t.dot }} />
      <span style={{ opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 10 }}>
        {label}
      </span>
      <span>{value}</span>
      {detail && <span style={{ opacity: 0.6, fontWeight: 400 }}>· {detail}</span>}
    </span>
  );
}

export function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 6, minWidth: 0 }}>
      <span
        style={{
          opacity: 0.55,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          fontSize: 10,
          flexShrink: 0,
          alignSelf: "center",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontWeight: 600,
          fontFamily: mono ? "ui-monospace, SFMono-Regular, monospace" : undefined,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function HeroStat({
  label,
  value,
  tint,
}: {
  label: string;
  value: number | string;
  tint: string;
}) {
  return (
    <div style={{ minWidth: 72 }}>
      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: `color-mix(in srgb, ${tint} 75%, var(--text))`,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          opacity: 0.7,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export function ProgressPill({
  label,
  caught,
  total,
  tint,
  dim,
}: {
  label: string;
  caught: number;
  total: number;
  tint: string;
  dim?: boolean;
}) {
  const pct = total === 0 ? 0 : Math.min(100, (caught / total) * 100);
  const done = caught >= total && total > 0;
  return (
    <div style={{ minWidth: 0, flex: "1 1 140px", opacity: dim ? 0.6 : 1 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          opacity: 0.75,
          marginBottom: 2,
        }}
      >
        <span>{label}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {caught} / {total}
          {done ? " ✓" : ""}
        </span>
      </div>
      <div style={{ height: 4, background: "var(--bg-muted)", borderRadius: 999, overflow: "hidden" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: done ? "#16a34a" : tint,
            transition: "width 200ms ease",
          }}
        />
      </div>
    </div>
  );
}

const STAR_GOLD = "#f5b301";
const STAR_GOLD_DARK = "#a86a00";
const STAR_EMPTY = "color-mix(in srgb, #a86a00 30%, var(--border))";

export function StarIcon({ filled, size = 24 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ display: "block" }}>
      <path
        d="M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.6l-5.9 3.07 1.13-6.57L2.45 9.44l6.6-.96L12 2.5z"
        fill={filled ? STAR_GOLD : "transparent"}
        stroke={filled ? STAR_GOLD_DARK : STAR_EMPTY}
        strokeWidth={1.5}
        strokeLinejoin="round"
        style={filled ? { filter: "drop-shadow(0 1px 1px rgba(168, 106, 0, 0.45))" } : undefined}
      />
    </svg>
  );
}

export function ChanceBar({ chance }: { chance: number }) {
  const pct = Math.min(100, Math.max(0, chance));
  const hue = 120 - (100 - pct) * 0.6;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 100 }}>
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 999,
          background: "var(--bg-muted)",
          overflow: "hidden",
          minWidth: 48,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: `hsl(${hue}, 65%, 45%)`,
            borderRadius: 999,
          }}
        />
      </div>
      <span
        style={{
          fontVariantNumeric: "tabular-nums",
          fontWeight: 700,
          minWidth: 28,
          textAlign: "right",
        }}
      >
        {chance}%
      </span>
    </div>
  );
}

const METHOD_STYLE: Record<string, { bg: string; fg: string; icon: string }> = {
  walk: { bg: "#dcfce7", fg: "#14532d", icon: "🌿" },
  surf: { bg: "#dbeafe", fg: "#1e3a8a", icon: "🌊" },
  "rock-smash": { bg: "#fef3c7", fg: "#78350f", icon: "⛏" },
  "old-rod": { bg: "#f3e8ff", fg: "#581c87", icon: "🎣" },
  "good-rod": { bg: "#ede9fe", fg: "#4c1d95", icon: "🎣" },
  "super-rod": { bg: "#e0e7ff", fg: "#3730a3", icon: "🎣" },
};

function methodLabel(method: string): string {
  return method
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function MethodChip({ method }: { method: string }) {
  const s = METHOD_STYLE[method] ?? { bg: "#f1f5f9", fg: "#475569", icon: "" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: s.bg,
        color: s.fg,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {s.icon && <span aria-hidden>{s.icon}</span>}
      {methodLabel(method)}
    </span>
  );
}

import { CONFETTI_COLORS } from "../grade";

export function Confetti({ count = 28 }: { count?: number }) {
  const pieces = Array.from({ length: count }, (_, i) => {
    const left = (i * 97) % 100;
    const delay = ((i * 53) % 100) / 50;
    const dur = 2 + ((i * 31) % 100) / 40;
    const drift = ((i % 7) - 3) * 18;
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const shape = i % 3 === 0 ? "50%" : i % 3 === 1 ? "2px" : "0";
    return (
      <span
        key={i}
        className="confetti-piece"
        style={{
          left: `${left}%`,
          background: color,
          borderRadius: shape,
          animationDelay: `${delay}s`,
          animationDuration: `${dur}s`,
          ["--drift" as string]: `${drift}px`,
        }}
      />
    );
  });
  const sparkles = Array.from({ length: 6 }, (_, i) => (
    <span
      key={`s${i}`}
      className="sparkle"
      style={{
        left: `${((i * 73) % 90) + 5}%`,
        top: `${((i * 41) % 70) + 10}%`,
        animationDelay: `${(i * 0.27) % 1.6}s`,
      }}
    />
  ));
  return (
    <div className="confetti-layer" aria-hidden>
      {pieces}
      {sparkles}
    </div>
  );
}
