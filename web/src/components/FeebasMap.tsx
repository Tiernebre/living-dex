import { useCallback, useEffect, useRef, useState } from "react";
import { ROUTE119, feebasTiles, spotIdToXY } from "../feebas";

// Schematic map of Route 119 showing the 6 Feebas tiles for a given seed.
// The grid is 40 × 140 metatiles; water tiles are rendered as blue cells,
// waterfalls as capped cells, and the Feebas spots as gold with a halo.
// Section dividers (the 3 y-bands the game splits the route into) are drawn
// as subtle horizontal lines. The player's live position, when on Route 119,
// shows as a tinted Pokéball marker.

type Props = {
  seed: number;
  tint: string;
  // Live player tile on Route 119, if known. null = not on Route 119.
  player: { x: number; y: number } | null;
};

const CELL = 10; // svg units per tile
const BASE_WIDTH = 240; // px — 1× zoom renders the full 40-tile width this wide
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

export function FeebasMap({ seed, tint, player }: Props) {
  const { spots, unique } = feebasTiles(seed);
  const feebasSet = new Set(unique.map((t) => `${t.x},${t.y}`));
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const clamp = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  const zoomAt = useCallback((delta: number) => setZoom((z) => clamp(+(z + delta).toFixed(2))), []);

  // Center a tile within the scroll viewport at the current zoom.
  const centerOnTile = useCallback(
    (x: number, y: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const pxPerCell = (BASE_WIDTH * zoom) / ROUTE119.width;
      const cx = x * pxPerCell + pxPerCell / 2;
      const cy = y * pxPerCell + pxPerCell / 2;
      el.scrollTo({
        left: cx - el.clientWidth / 2,
        top: cy - el.clientHeight / 2,
        behavior: "smooth",
      });
    },
    [zoom],
  );

  // Ctrl/⌘-wheel zooms, plain wheel scrolls — matches map-viewer conventions.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      zoomAt(e.deltaY < 0 ? 0.5 : -0.5);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Pre-slice the flat water/waterfall arrays for JSX clarity.
  const waterCells: JSX.Element[] = [];
  for (let i = 0; i < ROUTE119.water.length; i += 2) {
    const x = ROUTE119.water[i];
    const y = ROUTE119.water[i + 1];
    const key = `${x},${y}`;
    if (feebasSet.has(key)) continue; // drawn separately on top
    waterCells.push(
      <rect
        key={`w${i}`}
        x={x * CELL}
        y={y * CELL}
        width={CELL}
        height={CELL}
        fill="#2d6ea3"
        opacity={0.75}
      />,
    );
  }
  const waterfallCells: JSX.Element[] = [];
  for (let i = 0; i < ROUTE119.waterfall.length; i += 2) {
    const x = ROUTE119.waterfall[i];
    const y = ROUTE119.waterfall[i + 1];
    waterfallCells.push(
      <rect
        key={`f${i}`}
        x={x * CELL}
        y={y * CELL}
        width={CELL}
        height={CELL}
        fill="#a8cfe7"
        opacity={0.85}
      />,
    );
  }

  const W = ROUTE119.width * CELL;
  const H = ROUTE119.height * CELL;
  const onRoute = player !== null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 12,
        border: `1px solid color-mix(in srgb, ${tint} 35%, var(--border))`,
        background: `linear-gradient(135deg, color-mix(in srgb, ${tint} 10%, var(--bg-elevated)), var(--bg-elevated) 70%)`,
        boxShadow: "var(--shadow)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <strong
          style={{
            fontSize: 14,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            color: `color-mix(in srgb, ${tint} 75%, var(--text))`,
          }}
        >
          Feebas tiles · Route 119
        </strong>
        <span style={{ fontSize: 11, opacity: 0.6, fontVariantNumeric: "tabular-nums" }}>
          seed 0x{seed.toString(16).padStart(4, "0").toUpperCase()}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.7, display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {unique.length} unique of 6 ·
          {spots.map((id, i) => {
            const { x, y } = spotIdToXY(id);
            return (
              <button
                key={i}
                type="button"
                onClick={() => centerOnTile(x, y)}
                title={`Scroll to spot ${id} at (${x}, ${y})`}
                style={{
                  fontFamily: "inherit",
                  fontSize: 11,
                  fontVariantNumeric: "tabular-nums",
                  padding: "1px 7px",
                  borderRadius: 999,
                  border: "1px solid color-mix(in srgb, #f7c84a 55%, transparent)",
                  background: "color-mix(in srgb, #f7c84a 18%, transparent)",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                {id}
              </button>
            );
          })}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Legend tint={tint} onRoute={onRoute} />
        <div
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
          }}
        >
          <button
            type="button"
            onClick={() => zoomAt(-0.5)}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
            style={zoomBtnStyle}
          >
            −
          </button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.25}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ width: 90 }}
            aria-label="Zoom"
          />
          <button
            type="button"
            onClick={() => zoomAt(0.5)}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
            style={zoomBtnStyle}
          >
            +
          </button>
          <span style={{ fontVariantNumeric: "tabular-nums", opacity: 0.65, minWidth: 34 }}>
            {zoom.toFixed(2)}×
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        style={{
          maxHeight: 560,
          overflow: "auto",
          borderRadius: 8,
          background: "color-mix(in srgb, #0b1d2f 55%, var(--bg-surface))",
          padding: 8,
          alignSelf: "center",
          maxWidth: "100%",
          touchAction: "pinch-zoom",
        }}
        title="Ctrl/⌘ + scroll to zoom"
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={BASE_WIDTH * zoom}
          height={(BASE_WIDTH * zoom * H) / W}
          shapeRendering="crispEdges"
          style={{ display: "block" }}
        >
          {/* Section dividers — the 3 y-bands the game splits Route 119 into. */}
          {ROUTE119.sections.slice(0, -1).map((s, i) => (
            <line
              key={i}
              x1={0}
              x2={W}
              y1={(s.yMax + 1) * CELL}
              y2={(s.yMax + 1) * CELL}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          ))}
          {waterCells}
          {waterfallCells}
          {/* Feebas tiles with a soft halo on top of the water layer. */}
          {unique.map((t, i) => {
            const cx = t.x * CELL + CELL / 2;
            const cy = t.y * CELL + CELL / 2;
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={CELL * 1.7} fill="#f7c84a" opacity={0.18} />
                <circle cx={cx} cy={cy} r={CELL * 1.1} fill="#f7c84a" opacity={0.32} />
                <rect
                  x={t.x * CELL}
                  y={t.y * CELL}
                  width={CELL}
                  height={CELL}
                  fill="#f7c84a"
                  stroke="#b8860b"
                  strokeWidth={1}
                />
              </g>
            );
          })}
          {player && (
            <g>
              <circle
                cx={player.x * CELL + CELL / 2}
                cy={player.y * CELL + CELL / 2}
                r={CELL * 1.3}
                fill={tint}
                opacity={0.25}
              />
              <circle
                cx={player.x * CELL + CELL / 2}
                cy={player.y * CELL + CELL / 2}
                r={CELL * 0.55}
                fill={tint}
                stroke="#fff"
                strokeWidth={1.5}
              />
            </g>
          )}
        </svg>
      </div>

      <p style={{ fontSize: 11, opacity: 0.55, margin: 0, lineHeight: 1.5 }}>
        Feebas has a 50% chance to appear on each of these tiles when fished. The
        seed (and therefore the tiles) changes over time as Dewford Trends
        update — don't expect the same spots next play session.
      </p>
    </div>
  );
}

const zoomBtnStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg-surface)",
  color: "inherit",
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};

function Legend({ tint, onRoute }: { tint: string; onRoute: boolean }) {
  const item = (color: string, label: string, borderColor?: string): JSX.Element => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span
        style={{
          width: 10,
          height: 10,
          background: color,
          border: borderColor ? `1px solid ${borderColor}` : undefined,
          borderRadius: 2,
        }}
      />
      {label}
    </span>
  );
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, opacity: 0.85 }}>
      {item("#2d6ea3", "water")}
      {item("#a8cfe7", "waterfall")}
      {item("#f7c84a", "Feebas tile", "#b8860b")}
      {onRoute && item(tint, "you")}
    </div>
  );
}
