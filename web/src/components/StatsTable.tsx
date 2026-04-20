import { useEffect, useRef, useState } from "react";
import type { GrowthRate, StatBlock, StatKey } from "../data";
import {
  STATS,
  computeStats,
  expForLevel,
  ivLabel,
  ivStyle,
  natureEffect,
} from "../stats";
import { formatInt } from "../format";

export function StatsTable({
  ivs,
  evs,
  nature,
  baseStats,
  level,
}: {
  ivs: StatBlock;
  evs: StatBlock;
  nature: string;
  baseStats?: StatBlock;
  level?: number;
}) {
  const effect = natureEffect(nature);
  const colorFor = (k: StatKey) =>
    effect?.plus === k ? "var(--iv-great)" : effect?.minus === k ? "var(--iv-worst)" : undefined;
  const labelFor = (k: StatKey, label: string) =>
    effect?.plus === k ? `${label}+` : effect?.minus === k ? `${label}−` : label;
  return (
    <table style={{ marginTop: 6, fontSize: 12, borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ opacity: 0.6 }}>
          <th style={{ textAlign: "left", paddingRight: 10 }}></th>
          {STATS.map(([k, label]) => (
            <th
              key={k}
              style={{ textAlign: "right", padding: "0 6px", fontWeight: 500, color: colorFor(k) }}
            >
              {labelFor(k, label)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {baseStats && (
          <tr>
            <td style={{ paddingRight: 10, opacity: 0.7 }}>Base</td>
            {STATS.map(([k]) => (
              <td
                key={k}
                style={{ textAlign: "right", padding: "0 6px", fontVariantNumeric: "tabular-nums" }}
              >
                {baseStats[k]}
              </td>
            ))}
          </tr>
        )}
        <tr>
          <td style={{ paddingRight: 10, opacity: 0.7 }}>IV</td>
          {STATS.map(([k]) => {
            const v = ivs[k];
            const { color, weight } = ivStyle(v);
            return (
              <td
                key={k}
                style={{
                  textAlign: "right",
                  padding: "0 6px",
                  fontVariantNumeric: "tabular-nums",
                  color,
                  fontWeight: weight,
                }}
                title={ivLabel(v)}
              >
                {v}
              </td>
            );
          })}
        </tr>
        <tr>
          <td style={{ paddingRight: 10, opacity: 0.7 }}>EV</td>
          {STATS.map(([k]) => (
            <td
              key={k}
              style={{ textAlign: "right", padding: "0 6px", fontVariantNumeric: "tabular-nums" }}
            >
              {evs[k]}
            </td>
          ))}
        </tr>
        {baseStats &&
          level !== undefined &&
          level !== 100 &&
          (() => {
            const current = computeStats(baseStats, ivs, evs, nature, level);
            return (
              <tr>
                <td style={{ paddingRight: 10, opacity: 0.7 }}>Lv{level}</td>
                {STATS.map(([k]) => (
                  <td
                    key={k}
                    style={{
                      textAlign: "right",
                      padding: "0 6px",
                      fontVariantNumeric: "tabular-nums",
                      color: colorFor(k),
                      fontWeight: 600,
                    }}
                  >
                    {current[k]}
                  </td>
                ))}
              </tr>
            );
          })()}
        {baseStats &&
          (() => {
            const lv100 = computeStats(baseStats, ivs, evs, nature, 100);
            return (
              <tr>
                <td style={{ paddingRight: 10, opacity: 0.7 }}>Lv100</td>
                {STATS.map(([k]) => (
                  <td
                    key={k}
                    style={{
                      textAlign: "right",
                      padding: "0 6px",
                      fontVariantNumeric: "tabular-nums",
                      color: colorFor(k),
                      fontWeight: 500,
                      opacity: 0.75,
                    }}
                  >
                    {lv100[k]}
                  </td>
                ))}
              </tr>
            );
          })()}
      </tbody>
    </table>
  );
}

export function ExpProgress({
  level,
  exp,
  rate,
}: {
  level: number;
  exp: number;
  rate: GrowthRate;
}) {
  const isMax = level >= 100;
  const curLevelExp = expForLevel(level, rate);
  const nextLevelExp = expForLevel(level + 1, rate);
  const span = Math.max(1, nextLevelExp - curLevelExp);
  const into = Math.max(0, exp - curLevelExp);
  const toGo = Math.max(0, nextLevelExp - exp);
  const pct = isMax ? 100 : Math.min(100, Math.max(0, (into / span) * 100));

  // Mimic the in-game bar: on level up, fill to 100% first, snap back to 0, then
  // animate to the new percent. We track the previous level and stage the transition.
  const [displayPct, setDisplayPct] = useState(pct);
  const [animate, setAnimate] = useState(true);
  const prevLevel = useRef(level);

  useEffect(() => {
    if (level === prevLevel.current) {
      setAnimate(true);
      setDisplayPct(pct);
      return;
    }
    prevLevel.current = level;
    setAnimate(true);
    setDisplayPct(100);
    const t1 = setTimeout(() => {
      setAnimate(false);
      setDisplayPct(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimate(true);
          setDisplayPct(pct);
        });
      });
    }, 750);
    return () => clearTimeout(t1);
  }, [level, pct]);

  if (isMax) {
    return (
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
        EXP {formatInt(exp)} · <span style={{ fontWeight: 600 }}>Max level</span>
      </div>
    );
  }

  return (
    <div
      style={{
        fontSize: 12,
        marginTop: 6,
        display: "flex",
        flexDirection: "column",
        gap: 3,
        maxWidth: 260,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, opacity: 0.8 }}>
        <span>
          EXP{" "}
          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
            {formatInt(exp)}
          </span>
        </span>
        <span style={{ opacity: 0.75 }}>
          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
            {formatInt(toGo)}
          </span>{" "}
          to Lv {level + 1}
        </span>
      </div>
      <div
        style={{
          height: 5,
          borderRadius: 999,
          background: "var(--bg-muted)",
          overflow: "hidden",
        }}
        title={`${formatInt(into)} / ${formatInt(span)} EXP this level · ${rate}`}
      >
        <div
          style={{
            width: `${displayPct}%`,
            height: "100%",
            background: "var(--accent)",
            transition: animate ? "width 700ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
          }}
        />
      </div>
    </div>
  );
}
