import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { GameStem, SaveInfo } from "../../../hub/protocol.ts";
import {
  hoennDex,
  lookup,
  mapsecLabel,
  ORIGIN_GAME_LABEL,
  speciesByNationalDex,
  type HoennDexEntry,
} from "../data";
import { formatFirstSeen, formatSpeciesName, pokemonKey, serebiiGen3DexUrl } from "../format";
import { effectiveLevel } from "../stats";
import {
  collectOwned,
  locationLabel,
  type OwnedMon,
} from "../owned";
import { useLivingDex } from "../store";
import { Detail, StatusBadge, TypeBadge } from "./atoms";
import { DexPopover } from "./DexPopover";

export function LivingDexGrid({ stem, saveInfo }: { stem: GameStem; saveInfo: SaveInfo }) {
  const owned = collectOwned(saveInfo);
  const dexCaught = useMemo(() => new Set(saveInfo.pokedexOwned), [saveInfo.pokedexOwned]);
  const hoennCaught = hoennDex.reduce(
    (n, e) => n + (dexCaught.has(e.nationalDex) ? 1 : 0),
    0,
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);

  const close = () => {
    setSelected(null);
    setAnchor(null);
  };

  useEffect(() => {
    if (selected == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);

  const selectedEntry =
    selected != null ? hoennDex.find((e) => e.hoennDex === selected) ?? null : null;
  const selectedOwned = selectedEntry ? owned.get(selectedEntry.nationalDex) ?? [] : [];

  return (
    <section style={{ marginTop: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0 }}>Hoenn Dex</h2>
        <span style={{ fontSize: 13, opacity: 0.7 }}>
          <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{hoennCaught}</span>
          {" / "}
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{hoennDex.length}</span> caught
        </span>
      </div>
      <div className="dex-grid">
        {hoennDex.map((entry) => {
          const info = speciesByNationalDex[entry.nationalDex];
          const entries = owned.get(entry.nationalDex);
          const isStored = !!entries?.length;
          const isCaught = isStored || dexCaught.has(entry.nationalDex);
          const isSelected = selected === entry.hoennDex;
          const stateCls = isStored
            ? "dex-cell-stored"
            : isCaught
            ? "dex-cell-caught"
            : "dex-cell-missing";
          const cls = `dex-cell ${stateCls}${isSelected ? " dex-cell-selected" : ""}`;
          const title = `#${entry.hoennDex} ${formatSpeciesName(entry.name)}${
            entries?.length
              ? ` — ${locationLabel(entries[0].location)}`
              : isCaught
              ? " — caught"
              : ""
          }`;
          const inner = (
            <>
              <span className="dex-cell-num">{String(entry.hoennDex).padStart(3, "0")}</span>
              {info?.sprite ? (
                <img src={info.sprite} alt={entry.name} width={56} height={56} loading="lazy" />
              ) : (
                <div style={{ width: 56, height: 56 }} />
              )}
              <span className="dex-cell-name">{formatSpeciesName(entry.name)}</span>
              {entries && entries.length > 1 && (
                <span className="dex-cell-badge" title={`${entries.length} owned`}>
                  ×{entries.length}
                </span>
              )}
            </>
          );
          if (!isStored) {
            return (
              <div key={entry.hoennDex} className={`${cls} dex-cell-static`} title={title}>
                {inner}
              </div>
            );
          }
          return (
            <button
              type="button"
              key={entry.hoennDex}
              className={cls}
              title={title}
              onClick={(e) => {
                if (isSelected) {
                  close();
                } else {
                  setSelected(entry.hoennDex);
                  setAnchor(e.currentTarget);
                }
              }}
            >
              {inner}
            </button>
          );
        })}
      </div>
      {selectedEntry && anchor && (
        <DexPopover anchor={anchor} onClose={close}>
          <DexDetail stem={stem} entry={selectedEntry} owned={selectedOwned} onClose={close} />
        </DexPopover>
      )}
    </section>
  );
}

function DexDetail({
  stem,
  entry,
  owned,
  onClose,
}: {
  stem: GameStem;
  entry: HoennDexEntry;
  owned: OwnedMon[];
  onClose: () => void;
}) {
  const info = speciesByNationalDex[entry.nationalDex];
  return (
    <div aria-label={`${formatSpeciesName(entry.name)} details`}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: owned.length ? 12 : 0,
        }}
      >
        {info?.sprite && (
          <img
            src={info.sprite}
            alt=""
            width={72}
            height={72}
            style={{ imageRendering: "pixelated" }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            <a
              href={info ? serebiiGen3DexUrl(info.nationalDex) : "#"}
              target="_blank"
              rel="noreferrer"
              style={{ color: "inherit" }}
            >
              #{String(entry.hoennDex).padStart(3, "0")} {formatSpeciesName(entry.name)}
            </a>
          </div>
          <div
            style={{
              fontSize: 12,
              opacity: 0.7,
              marginTop: 4,
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <span>National #{entry.nationalDex}</span>
            {info && <span style={{ opacity: 0.5 }}>·</span>}
            {info?.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            background: "transparent",
            border: "none",
            fontSize: 20,
            lineHeight: 1,
            padding: 4,
            cursor: "pointer",
            color: "var(--text-muted)",
            fontFamily: "inherit",
          }}
        >
          ×
        </button>
      </div>
      {owned.length === 0 ? (
        <p style={{ opacity: 0.6, fontStyle: "italic", margin: 0 }}>Not yet caught.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {owned.map((o, i) => (
            <OwnedMonRow key={i} stem={stem} owned={o} />
          ))}
        </div>
      )}
    </div>
  );
}

function OwnedMonRow({ stem, owned }: { stem: GameStem; owned: OwnedMon }) {
  const { mon, location } = owned;
  const info = lookup(mon.species);
  const locLabel = locationLabel(location);
  const locTone = location.kind === "party" ? "success" : "info";
  const metLoc = mapsecLabel(mon.metLocation);
  const origin = ORIGIN_GAME_LABEL[mon.originGame] ?? `Game ${mon.originGame}`;
  const isTraded = info && mon.originGame !== 2; // Ruby's origin = 2
  const firstSeenAt = useLivingDex((s) => s.catchLog[`${mon.pid}:${mon.otId}`]);
  const label = mon.isEgg ? "Egg" : mon.nickname || (info ? formatSpeciesName(info.name) : "?");
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: 10,
        border: "1px solid var(--border)",
        borderRadius: 8,
        background: "var(--bg-surface)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 6,
          }}
        >
          <Link
            to={`/${stem}/pokemon/${pokemonKey(mon)}`}
            style={{ fontSize: 15, fontWeight: 700, color: "inherit" }}
          >
            {label}
          </Link>
          <span style={{ fontSize: 12, opacity: 0.7 }}>
            Lv {effectiveLevel(mon, info)} · {mon.nature}
          </span>
          <StatusBadge label="Where" value={locLabel} tone={locTone} />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "4px 16px",
            fontSize: 12,
          }}
        >
          <Detail
            label="Met at"
            value={mon.metLevel ? `Lv ${mon.metLevel} · ${metLoc}` : "Hatched"}
          />
          <Detail
            label="OT"
            value={`${mon.otName || "?"} (${mon.otGender === "male" ? "♂" : "♀"}) · ID ${String(
              mon.otId & 0xffff,
            ).padStart(5, "0")}`}
          />
          <Detail label="Origin" value={origin + (isTraded ? " · traded" : "")} />
          <Detail label="First seen" value={firstSeenAt ? formatFirstSeen(firstSeenAt) : "—"} />
          <Detail
            label="PID"
            value={mon.pid.toString(16).toUpperCase().padStart(8, "0")}
            mono
          />
        </div>
      </div>
    </div>
  );
}
