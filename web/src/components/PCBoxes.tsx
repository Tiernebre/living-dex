import { useState } from "react";
import type { SaveInfo } from "../../../hub/protocol.ts";
import { PokemonCard } from "./PokemonCard";

const boxNavBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "var(--bg-surface)",
  color: "var(--accent-strong)",
  fontSize: 20,
  lineHeight: 1,
  cursor: "pointer",
  fontFamily: "inherit",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

export function PCBoxes({ saveInfo }: { saveInfo: SaveInfo }) {
  const boxes = saveInfo.boxes;
  const [idx, setIdx] = useState(() => Math.min(saveInfo.currentBox ?? 0, boxes.length - 1));
  const box = boxes[idx];
  if (!box) return null;
  const filled = box.slots.filter((m) => m).length;
  const prev = () => setIdx((i) => (i - 1 + boxes.length) % boxes.length);
  const next = () => setIdx((i) => (i + 1) % boxes.length);
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--bg-surface)",
          borderLeft: "4px solid var(--accent)",
        }}
      >
        <button onClick={prev} aria-label="Previous box" style={boxNavBtn}>
          ‹
        </button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{box.name}</div>
          <div style={{ fontSize: 11, opacity: 0.65, fontVariantNumeric: "tabular-nums" }}>
            Box {idx + 1} of {boxes.length} · {filled}/30
            {idx === (saveInfo.currentBox ?? -1) && " · current"}
          </div>
        </div>
        <button onClick={next} aria-label="Next box" style={boxNavBtn}>
          ›
        </button>
      </div>
      {filled === 0 ? (
        <p style={{ opacity: 0.6, fontStyle: "italic", padding: "16px 4px" }}>Empty box.</p>
      ) : (
        <ol
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
            gridAutoRows: "1fr",
            gap: 12,
          }}
        >
          {box.slots.map((mon, i) =>
            mon ? (
              <li key={i} style={{ display: "flex", minWidth: 0 }}>
                <div style={{ flex: 1, minWidth: 0, display: "flex" }}>
                  <PokemonCard mon={mon} movesRight linkToDetail />
                </div>
              </li>
            ) : null,
          )}
        </ol>
      )}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 12 }}>
        {boxes.map((b, i) => {
          const count = b.slots.filter((m) => m).length;
          const selected = i === idx;
          return (
            <button
              key={i}
              onClick={() => setIdx(i)}
              title={`${b.name} · ${count}/30`}
              style={{
                padding: "4px 8px",
                fontSize: 11,
                borderRadius: 6,
                border: selected ? "1px solid var(--accent)" : "1px solid var(--border)",
                background: selected
                  ? "color-mix(in srgb, var(--accent) 18%, transparent)"
                  : "var(--bg-surface)",
                color: selected ? "var(--accent-strong)" : "var(--text-muted)",
                fontWeight: selected ? 700 : 500,
                cursor: "pointer",
                fontFamily: "inherit",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {i + 1}
              <span style={{ opacity: 0.55, marginLeft: 4 }}>{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
