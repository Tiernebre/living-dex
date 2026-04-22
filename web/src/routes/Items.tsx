import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { GameStem, ItemLocation } from "../../../hub/protocol.ts";
import { GAME_STEMS } from "../../../hub/protocol.ts";
import { CHALLENGE_CHAIN, GAME_DISPLAY_NAME } from "../chain";
import { useLivingDex } from "../store";
import itemsData from "../data/items-gen3.json";

type Pocket = "items" | "balls" | "tms" | "berries" | "key";
type ItemEntry = { id: number; name: string; pocket: Pocket };
const ITEMS: ItemEntry[] = itemsData as ItemEntry[];
const ITEM_BY_ID = new Map<number, ItemEntry>(ITEMS.map((i) => [i.id, i]));

const POCKET_LABEL: Record<Pocket, string> = {
  items: "Items",
  balls: "Poké Balls",
  tms: "TMs/HMs",
  berries: "Berries",
  key: "Key Items",
};
const POCKET_ORDER: Pocket[] = ["items", "balls", "tms", "berries", "key"];
const POCKET_TINT: Record<Pocket, string> = {
  items: "#f59e0b",
  balls: "#ef4444",
  tms: "#6366f1",
  berries: "#84cc16",
  key: "#0ea5e9",
};

const LOCATION_LABEL: Record<ItemLocation, string> = {
  pc: "PC",
  items: "Bag · Items",
  balls: "Bag · Balls",
  tms: "Bag · TMs/HMs",
  berries: "Bag · Berries",
  key: "Bag · Key",
};

type Sighting = {
  stem: GameStem;
  where: ItemLocation;
  quantity: number;
};

type Row = {
  id: number;
  name: string;
  pocket: Pocket;
  sightings: Sighting[];
  total: number;
};

export function Items() {
  const { saves } = useLivingDex();
  const [query, setQuery] = useState("");
  const [pocketFilter, setPocketFilter] = useState<Set<Pocket>>(new Set(POCKET_ORDER));
  const [gameFilter, setGameFilter] = useState<Set<GameStem>>(new Set(GAME_STEMS));

  const rows = useMemo<Row[]>(() => {
    const byId = new Map<number, Row>();
    for (const stem of GAME_STEMS) {
      const save = saves[stem];
      if (!save || !save.bag) continue;
      for (const where of Object.keys(save.bag) as ItemLocation[]) {
        for (const slot of save.bag[where]) {
          const info = ITEM_BY_ID.get(slot.id);
          if (!info) continue;
          let row = byId.get(slot.id);
          if (!row) {
            row = { id: slot.id, name: info.name, pocket: info.pocket, sightings: [], total: 0 };
            byId.set(slot.id, row);
          }
          row.sightings.push({ stem, where, quantity: slot.quantity });
          row.total += slot.quantity;
        }
      }
    }
    return Array.from(byId.values());
  }, [saves]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (!pocketFilter.has(r.pocket)) return false;
        if (!r.sightings.some((s) => gameFilter.has(s.stem))) return false;
        if (q && !r.name.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const pd = POCKET_ORDER.indexOf(a.pocket) - POCKET_ORDER.indexOf(b.pocket);
        return pd !== 0 ? pd : a.name.localeCompare(b.name);
      });
  }, [rows, query, pocketFilter, gameFilter]);

  const loadedGames = GAME_STEMS.filter((s) => saves[s]);
  const togglePocket = (p: Pocket) =>
    setPocketFilter((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  const toggleGame = (s: GameStem) =>
    setGameFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const pocketCounts = useMemo(() => {
    const c: Record<Pocket, number> = { items: 0, balls: 0, tms: 0, berries: 0, key: 0 };
    for (const r of rows) c[r.pocket]++;
    return c;
  }, [rows]);

  return (
    <>
      <div style={{ marginBottom: 14, fontSize: 13 }}>
        <Link to="/" style={{ color: "var(--accent-strong)" }}>
          Dashboard
        </Link>
        <span style={{ opacity: 0.4, padding: "0 6px" }}>/</span>
        <span style={{ opacity: 0.7 }}>Items</span>
      </div>
      <header style={{ marginBottom: 14 }}>
        <h2 style={{ margin: "0 0 4px" }}>Items — {rows.length}</h2>
        <div style={{ fontSize: 13, opacity: 0.7 }}>
          Across {loadedGames.length} loaded save{loadedGames.length === 1 ? "" : "s"}. Search by
          name; each entry shows which save and pocket holds it.
        </div>
      </header>

      <section
        style={{
          padding: 14,
          border: "1px solid var(--border)",
          borderRadius: 10,
          background: "var(--bg-elevated)",
          marginBottom: 14,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <FilterRow label="Search">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Item name…"
            style={{
              flex: "1 1 240px",
              maxWidth: 320,
              padding: "6px 10px",
              fontSize: 13,
              border: "1px solid var(--border)",
              borderRadius: 6,
              background: "var(--bg)",
              color: "inherit",
            }}
          />
        </FilterRow>
        <FilterRow label="Pocket">
          {POCKET_ORDER.map((p) => {
            const on = pocketFilter.has(p);
            const tint = POCKET_TINT[p];
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePocket(p)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: `1px solid ${on ? tint : "var(--border)"}`,
                  background: on ? `color-mix(in srgb, ${tint} 18%, transparent)` : "transparent",
                  color: on ? tint : "inherit",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  opacity: on ? 1 : 0.5,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {POCKET_LABEL[p]}{" "}
                <span style={{ opacity: 0.7, fontWeight: 500 }}>({pocketCounts[p]})</span>
              </button>
            );
          })}
        </FilterRow>
        <FilterRow label="Game">
          {loadedGames.map((stem) => {
            const on = gameFilter.has(stem);
            const step = CHALLENGE_CHAIN.find((c) => c.stem === stem);
            const tint = step?.tint ?? "var(--accent)";
            return (
              <button
                key={stem}
                type="button"
                onClick={() => toggleGame(stem)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: `1px solid ${on ? tint : "var(--border)"}`,
                  background: on ? `color-mix(in srgb, ${tint} 18%, transparent)` : "transparent",
                  color: on ? tint : "inherit",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  opacity: on ? 1 : 0.5,
                }}
              >
                {GAME_DISPLAY_NAME[stem]}
              </button>
            );
          })}
        </FilterRow>
      </section>

      {filtered.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", opacity: 0.6, fontStyle: "italic" }}>
          No items match these filters.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 10,
          }}
        >
          {filtered.map((row) => (
            <ItemCard key={row.id} row={row} gameFilter={gameFilter} />
          ))}
        </div>
      )}
    </>
  );
}

function ItemCard({ row, gameFilter }: { row: Row; gameFilter: Set<GameStem> }) {
  const tint = POCKET_TINT[row.pocket];
  const visible = row.sightings.filter((s) => gameFilter.has(s.stem));
  const visibleTotal = visible.reduce((n, s) => n + s.quantity, 0);
  const displayName = formatItemName(row.name);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 10,
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${tint}`,
        borderRadius: 10,
        background: "var(--bg-elevated)",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <ItemThumb name={row.name} pocket={row.pocket} tint={tint} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            title={displayName}
            style={{
              fontWeight: 700,
              fontSize: 13,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {displayName}
          </div>
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              fontWeight: 700,
              color: tint,
              opacity: 0.85,
            }}
          >
            {POCKET_LABEL[row.pocket]}
          </div>
        </div>
        <div
          style={{
            flex: "0 0 auto",
            fontSize: 12,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            opacity: 0.75,
            minWidth: 32,
            textAlign: "right",
          }}
          title="Total across selected games"
        >
          ×{visibleTotal}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {visible.map((s, i) => (
          <SightingChip key={i} sighting={s} />
        ))}
      </div>
    </div>
  );
}

// PokéAPI's sprite repo hosts item icons with broad coverage (balls, berries,
// key items, stones). Slug convention is diacritics-stripped, lowercase,
// hyphen-separated words. TMs have no per-number icon; HM01–07 do, HM08
// doesn't — the onError fallback covers that gap.
function itemSpriteUrl(name: string): string | null {
  if (/^TM\d+/i.test(name)) return null;
  const hm = /^HM(\d+)/i.exec(name);
  if (hm) return pokeapiUrl(`hm${hm[1].padStart(2, "0")}`);
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) return null;
  return pokeapiUrl(slug);
}

function pokeapiUrl(slug: string): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${slug}.png`;
}

function ItemThumb({ name, pocket, tint }: { name: string; pocket: Pocket; tint: string }) {
  const [broken, setBroken] = useState(false);
  const url = itemSpriteUrl(name);
  const placeholderStyle: CSSProperties = {
    flex: "0 0 auto",
    width: 32,
    height: 32,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    background: `color-mix(in srgb, ${tint} 20%, var(--bg))`,
    border: `1px solid color-mix(in srgb, ${tint} 40%, var(--border))`,
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 0.5,
    color: tint,
    textTransform: "uppercase",
  };
  if (!url || broken) {
    const tmLabel = /^(TM|HM)(\d+)/i.exec(name);
    return (
      <span style={placeholderStyle} aria-hidden>
        {tmLabel ? tmLabel[0] : POCKET_LABEL[pocket].slice(0, 2)}
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      width={32}
      height={32}
      loading="lazy"
      onError={() => setBroken(true)}
      style={{
        flex: "0 0 auto",
        imageRendering: "pixelated",
        objectFit: "contain",
      }}
    />
  );
}

function SightingChip({ sighting }: { sighting: Sighting }) {
  const step = CHALLENGE_CHAIN.find((c) => c.stem === sighting.stem);
  const tint = step?.tint ?? "var(--accent)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 8px",
        borderRadius: 999,
        border: `1px solid color-mix(in srgb, ${tint} 45%, var(--border))`,
        background: `color-mix(in srgb, ${tint} 12%, transparent)`,
        fontSize: 11,
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: tint, fontWeight: 700 }}>{GAME_DISPLAY_NAME[sighting.stem]}</span>
      <span style={{ opacity: 0.55 }}>{LOCATION_LABEL[sighting.where]}</span>
      <span style={{ opacity: 0.85 }}>×{sighting.quantity}</span>
    </span>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 0.8,
          fontWeight: 700,
          opacity: 0.65,
          minWidth: 56,
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

// Decomp names are ALL CAPS. Title-case for readability, preserving é, ♂/♀,
// and the TM/HM prefixes.
function formatItemName(raw: string): string {
  return raw
    .split(" ")
    .map((w) => {
      if (/^(TM|HM)\d+/.test(w)) return w;
      return w.charAt(0) + w.slice(1).toLowerCase();
    })
    .join(" ");
}
