import { encounters, lookup, type EncounterPokemon } from "../data";
import { formatSpeciesName, serebiiGen3DexUrl } from "../format";
import { ChanceBar, MethodChip, TypeBadge } from "./atoms";

type Row = {
  method: string;
  methodRate: number;
  enc: EncounterPokemon;
};

export function Encounters({
  location,
}: {
  location: { mapGroup: number; mapNum: number } | null;
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
                return (
                  <tr
                    key={i}
                    style={{
                      borderTop: firstOfMethod && i > 0 ? "2px solid var(--accent)" : undefined,
                      background: `color-mix(in srgb, var(--accent) ${
                        i % 2 === 0 ? 6 : 12
                      }%, var(--bg-elevated))`,
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
