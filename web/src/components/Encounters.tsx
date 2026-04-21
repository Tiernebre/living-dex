import { encounters, lookup, type EncounterPokemon } from "../data";
import { formatSpeciesName, serebiiGen3DexUrl } from "../format";
import type { Ownership } from "../owned";
import { ChanceBar, MethodChip, TypeBadge } from "./atoms";

type Row = {
  method: string;
  methodRate: number;
  enc: EncounterPokemon;
};

export function Encounters({
  location,
  ownership,
}: {
  location: { mapGroup: number; mapNum: number } | null;
  // Optional: when provided, annotates each row with a chain-wide
  // ownership marker. Omitted in contexts where save state isn't available.
  ownership?: (nationalDex: number) => Ownership;
}) {
  if (!location) {
    return <p style={{ opacity: 0.6, fontStyle: "italic" }}>No location yet.</p>;
  }
  const entry = encounters[`${location.mapGroup}:${location.mapNum}`];
  if (!entry) {
    return (
      <p style={{ opacity: 0.6, fontStyle: "italic" }}>
        No wild encounters for map {location.mapGroup}:{location.mapNum}.
      </p>
    );
  }

  const rows: Row[] = [];
  for (const m of entry.methods) {
    for (const enc of m.encounters) {
      rows.push({ method: m.method, methodRate: m.rate, enc });
    }
  }

  const uniqueSpecies = new Set(rows.map((r) => r.enc.species));
  const ownershipCounts = ownership
    ? (() => {
        let here = 0, elsewhere = 0, missing = 0;
        for (const sp of uniqueSpecies) {
          const info = lookup(sp);
          if (!info) continue;
          const o = ownership(info.nationalDex);
          if (o === "here") here++;
          else if (o === "elsewhere") elsewhere++;
          else missing++;
        }
        return { here, elsewhere, missing };
      })()
    : null;

  const methodOrder = ["walk", "surf", "rock-smash", "old-rod", "good-rod", "super-rod"];
  const methodIdx = (m: string) => {
    const i = methodOrder.indexOf(m);
    return i < 0 ? methodOrder.length : i;
  };

  const th: React.CSSProperties = {
    textAlign: "left",
    fontWeight: 500,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "var(--accent-strong)",
    padding: "10px 12px",
    borderBottom: "1px solid var(--accent)",
    background: "color-mix(in srgb, var(--accent) 18%, var(--bg-surface))",
    position: "sticky",
    top: 0,
  };
  const td: React.CSSProperties = {
    padding: "8px 12px",
    borderBottom: "1px solid var(--border)",
    verticalAlign: "middle",
    fontSize: 13,
  };

  let lastMethod: string | null = null;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontSize: 15 }}>{entry.label.replace(/([A-Za-z])(\d)/g, "$1 $2")}</strong>
        {ownershipCounts && (
          <div style={{ display: "flex", gap: 10, fontSize: 11, fontWeight: 600 }}>
            <OwnCountChip tone="missing" count={ownershipCounts.missing} label="needed" />
            <OwnCountChip tone="elsewhere" count={ownershipCounts.elsewhere} label="elsewhere" />
            <OwnCountChip tone="here" count={ownershipCounts.here} label="caught" />
          </div>
        )}
        <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.6 }}>
          {rows.length} encounter{rows.length === 1 ? "" : "s"} · {entry.methods.length} method
          {entry.methods.length === 1 ? "" : "s"}
        </span>
      </div>
      <div
        style={{
          border: "1px solid var(--accent)",
          borderRadius: 10,
          overflow: "hidden",
          background: "color-mix(in srgb, var(--accent) 5%, var(--bg-elevated))",
          boxShadow: "var(--shadow)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 140 }}>Method</th>
              <th style={{ ...th, width: 56 }}></th>
              {ownership && <th style={{ ...th, width: 38, textAlign: "center" }}>Own</th>}
              <th style={th}>Species</th>
              <th style={{ ...th, width: 100 }}>Types</th>
              <th style={{ ...th, width: 80, textAlign: "right" }}>Level</th>
              <th style={{ ...th, width: 160, textAlign: "right" }}>Chance</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .sort(
                (a, b) => methodIdx(a.method) - methodIdx(b.method) || b.enc.chance - a.enc.chance,
              )
              .map((r, i) => {
                const info = lookup(r.enc.species);
                const firstOfMethod = r.method !== lastMethod;
                lastMethod = r.method;
                const own: Ownership =
                  ownership && info ? ownership(info.nationalDex) : "missing";
                // Un-owned rows get a subtle warm highlight so they pop while scanning.
                // Owned-here rows dim slightly — still legible, just out of focus.
                const rowTint =
                  ownership && own === "missing"
                    ? "color-mix(in srgb, #e8b86b 22%, var(--bg-elevated))"
                    : ownership && own === "here"
                      ? `color-mix(in srgb, var(--accent) ${i % 2 === 0 ? 3 : 7}%, var(--bg-elevated))`
                      : `color-mix(in srgb, var(--accent) ${i % 2 === 0 ? 6 : 12}%, var(--bg-elevated))`;
                return (
                  <tr
                    key={i}
                    style={{
                      borderTop: firstOfMethod && i > 0 ? "2px solid var(--accent)" : undefined,
                      background: rowTint,
                      opacity: ownership && own === "here" ? 0.55 : 1,
                    }}
                  >
                    <td style={td}>
                      {firstOfMethod ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <MethodChip method={r.method} />
                          <span style={{ fontSize: 10, opacity: 0.55 }}>rate {r.methodRate}</span>
                        </div>
                      ) : null}
                    </td>
                    <td style={{ ...td, padding: "4px 12px" }}>
                      {info?.sprite &&
                        (info ? (
                          <a
                            href={serebiiGen3DexUrl(info.nationalDex)}
                            target="_blank"
                            rel="noreferrer"
                            title={`${formatSpeciesName(info.name)} on Serebii (Gen 3)`}
                            style={{ display: "inline-block" }}
                          >
                            <img
                              src={info.sprite}
                              alt=""
                              width={40}
                              height={40}
                              style={{ imageRendering: "pixelated", display: "block" }}
                            />
                          </a>
                        ) : null)}
                    </td>
                    {ownership && (
                      <td style={{ ...td, textAlign: "center" }}>
                        <OwnMarker tone={own} />
                      </td>
                    )}
                    <td style={td}>
                      {info ? (
                        <a
                          href={serebiiGen3DexUrl(info.nationalDex)}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: "var(--accent-strong)",
                            fontWeight: 600,
                            textDecoration: "underline",
                            textDecorationColor:
                              "color-mix(in srgb, var(--accent) 60%, transparent)",
                            textUnderlineOffset: 3,
                          }}
                        >
                          {formatSpeciesName(info.name)}
                        </a>
                      ) : (
                        <span style={{ fontWeight: 600 }}>{formatSpeciesName(r.enc.name)}</span>
                      )}
                    </td>
                    <td style={td}>
                      <div
                        style={{
                          display: "flex",
                          gap: 4,
                          flexWrap: "wrap",
                          minHeight: 44,
                          alignContent: "center",
                        }}
                      >
                        {info?.types.map((t) => (
                          <TypeBadge key={t} type={t} />
                        ))}
                      </div>
                    </td>
                    <td
                      style={{
                        ...td,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: 600,
                      }}
                    >
                      {r.enc.minLevel === r.enc.maxLevel
                        ? r.enc.minLevel
                        : `${r.enc.minLevel}–${r.enc.maxLevel}`}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <ChanceBar chance={r.enc.chance} />
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const OWN_TONE: Record<Ownership, { color: string; glyph: string; title: string }> = {
  here: { color: "#52b26a", glyph: "✓", title: "Caught in this game" },
  elsewhere: { color: "#e2a13a", glyph: "◐", title: "Caught in an earlier save — not here yet" },
  missing: { color: "#8a8a8a", glyph: "○", title: "Still missing across the chain" },
};

function OwnMarker({ tone }: { tone: Ownership }) {
  const t = OWN_TONE[tone];
  return (
    <span
      title={t.title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        borderRadius: 11,
        border: `1.5px solid ${t.color}`,
        color: t.color,
        fontSize: 13,
        fontWeight: 700,
        background: `color-mix(in srgb, ${t.color} 12%, transparent)`,
        lineHeight: 1,
      }}
    >
      {t.glyph}
    </span>
  );
}

function OwnCountChip({
  tone,
  count,
  label,
}: {
  tone: Ownership;
  count: number;
  label: string;
}) {
  const t = OWN_TONE[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 999,
        border: `1px solid color-mix(in srgb, ${t.color} 55%, transparent)`,
        background: `color-mix(in srgb, ${t.color} 15%, transparent)`,
        color: t.color,
        fontVariantNumeric: "tabular-nums",
        opacity: count === 0 ? 0.4 : 1,
      }}
    >
      <span>{t.glyph}</span>
      <span>{count}</span>
      <span style={{ opacity: 0.7, fontWeight: 500 }}>{label}</span>
    </span>
  );
}
