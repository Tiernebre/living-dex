import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { DecodedPokemon, GameStem } from "../../../hub/protocol.ts";
import { CHALLENGE_CHAIN, GAME_DISPLAY_NAME } from "../chain";
import { lookup } from "../data";
import { formatSpeciesName, pokemonKey, thumbnailUrl } from "../format";
import { effectiveLevel } from "../stats";
import { useLivingDex } from "../store";
import {
  CATEGORY_STYLE,
  CONTEST_TIERS,
  CONTEST_TIER_STYLE,
  getContestEntry,
  moveCategoryBonus,
  type ContestCategory,
  type ContestEntry,
  type ContestTier,
} from "../contest";

// Contests are a Hoenn-only mechanic in Gen 3 (FR/LG has no contest hall),
// so we lock this page to the R/S/E saves.
const CONTEST_GAMES: GameStem[] = ["ruby", "sapphire", "emerald"];

type Row = {
  key: string;
  stem: GameStem;
  mon: DecodedPokemon;
  entry: ContestEntry;
  speciesName: string;
  nationalDex: number;
  level: number;
  combo: ReturnType<typeof moveCategoryBonus>;
};

const CATEGORIES: ContestCategory[] = ["Cool", "Beauty", "Cute", "Smart", "Tough"];

export function Contest() {
  const { saves } = useLivingDex();
  const [tierFilter, setTierFilter] = useState<Set<ContestTier>>(new Set(CONTEST_TIERS));
  const [catFilter, setCatFilter] = useState<Set<ContestCategory>>(new Set(CATEGORIES));
  const [gameFilter, setGameFilter] = useState<Set<GameStem>>(new Set(CONTEST_GAMES));
  const [query, setQuery] = useState("");

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const seen = new Set<string>();
    for (const stem of CONTEST_GAMES) {
      const save = saves[stem];
      if (!save) continue;
      const pushMon = (mon: DecodedPokemon | null, where: string) => {
        if (!mon) return;
        const info = lookup(mon.species);
        if (!info) return;
        // One row per (save, species) — the tier is species-level, so fifteen
        // Zigzagoons would otherwise flood the list.
        const dedupeKey = `${stem}:${info.nationalDex}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        const entry = getContestEntry(info.nationalDex);
        const combo = moveCategoryBonus(
          mon.moves.map((m) => m.id),
          entry.category,
        );
        out.push({
          key: `${stem}:${pokemonKey(mon)}:${where}`,
          stem,
          mon,
          entry,
          speciesName: formatSpeciesName(info.name),
          nationalDex: info.nationalDex,
          level: effectiveLevel(mon, info),
          combo,
        });
      };
      save.party.forEach((m, i) => pushMon(m, `Party ${i + 1}`));
      save.boxes.forEach((b, bi) =>
        b.slots.forEach((m, si) => pushMon(m, `${b.name || `Box ${bi + 1}`} #${si + 1}`)),
      );
    }
    return out;
  }, [saves]);

  const tierCounts = useMemo(() => {
    const c: Record<ContestTier, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const r of rows) c[r.entry.tier]++;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (!tierFilter.has(r.entry.tier)) return false;
      if (!catFilter.has(r.entry.category)) return false;
      if (!gameFilter.has(r.stem)) return false;
      if (q) {
        const name = (r.mon.nickname || r.speciesName).toLowerCase();
        const species = r.speciesName.toLowerCase();
        if (!name.includes(q) && !species.includes(q)) return false;
      }
      return true;
    });
  }, [rows, tierFilter, catFilter, gameFilter, query]);

  const grouped = useMemo(() => {
    const byTier: Record<ContestTier, Row[]> = { S: [], A: [], B: [], C: [], D: [] };
    for (const r of filtered) byTier[r.entry.tier].push(r);
    for (const t of CONTEST_TIERS) {
      byTier[t].sort((a, b) => {
        if (a.combo.count !== b.combo.count) return b.combo.count - a.combo.count;
        return a.speciesName.localeCompare(b.speciesName);
      });
    }
    return byTier;
  }, [filtered]);

  const toggleTier = (t: ContestTier) =>
    setTierFilter((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  const toggleCategory = (c: ContestCategory) =>
    setCatFilter((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  const toggleGame = (g: GameStem) =>
    setGameFilter((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  const loadedGames = CONTEST_GAMES.filter((s) => saves[s]);
  const hasSaves = loadedGames.length > 0;

  return (
    <>
      <div style={{ marginBottom: 14, fontSize: 13 }}>
        <Link to="/" style={{ color: "var(--accent-strong)" }}>
          Dashboard
        </Link>
        <span style={{ opacity: 0.4, padding: "0 6px" }}>/</span>
        <span style={{ opacity: 0.7 }}>Contest Tier List</span>
      </div>
      <header style={{ marginBottom: 14 }}>
        <h2 style={{ margin: "0 0 4px", display: "flex", alignItems: "baseline", gap: 10 }}>
          Contest Tier List
          <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.7 }}>
            {rows.length} mon · {loadedGames.length} Hoenn save{loadedGames.length === 1 ? "" : "s"}
          </span>
        </h2>
        <div style={{ fontSize: 13, opacity: 0.7 }}>
          Community-consensus Master Rank grades for R/S/E Pokémon you own. Tiers reward
          signature combo access (Recover loops, Dragon Dance chains, Perish Song, etc.),
          not raw stats.
        </div>
      </header>

      {!hasSaves ? (
        <div
          style={{
            padding: 32,
            textAlign: "center",
            border: "1px dashed var(--border)",
            borderRadius: 10,
            background: "var(--bg-elevated)",
            opacity: 0.75,
            fontStyle: "italic",
          }}
        >
          No Ruby, Sapphire, or Emerald saves loaded — contests are a Hoenn-only feature.
        </div>
      ) : (
        <>
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
            <FilterRow label="Tier">
              {CONTEST_TIERS.map((t) => {
                const on = tierFilter.has(t);
                const s = CONTEST_TIER_STYLE[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTier(t)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: `1px solid ${on ? s.ring : "var(--border)"}`,
                      background: on ? s.bg : "transparent",
                      color: on ? s.fg : "inherit",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                      opacity: on ? 1 : 0.5,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {t} <span style={{ opacity: 0.7, fontWeight: 500 }}>({tierCounts[t]})</span>
                  </button>
                );
              })}
            </FilterRow>

            <FilterRow label="Category">
              {CATEGORIES.map((c) => {
                const on = catFilter.has(c);
                const style = CATEGORY_STYLE[c];
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCategory(c)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: `1px solid ${on ? style.color : "var(--border)"}`,
                      background: on
                        ? `color-mix(in srgb, ${style.color} 16%, transparent)`
                        : "transparent",
                      color: on ? style.color : "inherit",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                      opacity: on ? 1 : 0.5,
                      display: "inline-flex",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    <span aria-hidden>{style.icon}</span>
                    {c}
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

            <FilterRow label="Search">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Species or nickname…"
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
          </section>

          {filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", opacity: 0.6, fontStyle: "italic" }}>
              No Pokémon match these filters.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {CONTEST_TIERS.map((tier) => {
                const list = grouped[tier];
                if (list.length === 0) return null;
                return <TierBlock key={tier} tier={tier} rows={list} />;
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}

function TierBlock({ tier, rows }: { tier: ContestTier; rows: Row[] }) {
  const style = CONTEST_TIER_STYLE[tier];
  return (
    <section
      style={{
        border: "1px solid var(--border)",
        borderLeft: `4px solid ${style.ring}`,
        borderRadius: 10,
        background: "var(--bg-elevated)",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          background: `color-mix(in srgb, ${style.ring} 10%, transparent)`,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <TierBadge tier={tier} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: 0.3 }}>{tierLabel(tier)}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>{tierBlurb(tier)}</div>
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            opacity: 0.8,
          }}
        >
          {rows.length}
        </div>
      </header>
      <div
        style={{
          padding: 10,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 8,
        }}
      >
        {rows.map((r) => (
          <ContestRow key={r.key} row={r} />
        ))}
      </div>
    </section>
  );
}

function ContestRow({ row }: { row: Row }) {
  const { mon, entry, stem, speciesName, level, combo, nationalDex } = row;
  const step = CHALLENGE_CHAIN.find((c) => c.stem === stem);
  const tint = step?.tint ?? "var(--accent)";
  const name = mon.nickname || speciesName;
  const cat = CATEGORY_STYLE[entry.category];
  const detailHref = `/pokemon/${pokemonKey(mon)}`;
  return (
    <div
      title={entry.note}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "8px 10px",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${tint}`,
        borderRadius: 8,
        background: "var(--bg)",
        minWidth: 0,
      }}
    >
      <img
        src={thumbnailUrl(nationalDex)}
        alt={speciesName}
        width={44}
        height={44}
        style={{ flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 13,
            display: "flex",
            gap: 6,
            alignItems: "baseline",
          }}
        >
          <Link
            to={detailHref}
            style={{
              color: "var(--accent-strong)",
              textDecoration: "underline",
              textDecorationThickness: "1.5px",
              textUnderlineOffset: "3px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
            {name}
          </Link>
          {mon.nickname && (
            <span style={{ fontWeight: 400, opacity: 0.55, fontSize: 11 }}>{speciesName}</span>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            opacity: 0.75,
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            alignItems: "center",
            fontVariantNumeric: "tabular-nums",
            marginTop: 2,
          }}
        >
          <span style={{ color: tint, fontWeight: 700 }}>{GAME_DISPLAY_NAME[stem]}</span>
          <span>·</span>
          <span>Lv {level}</span>
          <span>·</span>
          <span
            style={{
              color: cat.color,
              fontWeight: 700,
              display: "inline-flex",
              gap: 3,
              alignItems: "center",
            }}
          >
            <span aria-hidden>{cat.icon}</span>
            {entry.category}
          </span>
          {combo.count > 0 && (
            <span
              title={combo.moves.map((m) => formatSpeciesName(m.name)).join(", ")}
              style={{
                marginLeft: 2,
                padding: "1px 6px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                background: `color-mix(in srgb, ${cat.color} 16%, transparent)`,
                color: cat.color,
                border: `1px solid ${cat.color}`,
              }}
            >
              {combo.count} combo move{combo.count === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            opacity: 0.7,
            marginTop: 4,
            lineHeight: 1.35,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {entry.note}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        <TierBadge tier={entry.tier} small />
      </div>
    </div>
  );
}

function TierBadge({ tier, small }: { tier: ContestTier; small?: boolean }) {
  const s = CONTEST_TIER_STYLE[tier];
  const size = small ? 28 : 36;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: size / 4,
        background: s.bg,
        color: s.fg,
        fontWeight: 800,
        fontSize: small ? 13 : 16,
        letterSpacing: 0.5,
        boxShadow: `0 0 0 1px ${s.ring} inset`,
      }}
    >
      {tier}
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
          minWidth: 68,
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

function tierLabel(t: ContestTier): string {
  switch (t) {
    case "S": return "S — Master Rank staples";
    case "A": return "A — Strong specialists";
    case "B": return "B — Workable with effort";
    case "C": return "C — Unranked / niche";
    case "D": return "D — Contest-weak";
  }
}

function tierBlurb(t: ContestTier): string {
  switch (t) {
    case "S": return "Community-consensus top picks — easy Master Rank sweeps.";
    case "A": return "Solid pick with a clear combo; Master Rank with good Pokéblocks.";
    case "B": return "Viable but needs the right moveset and category.";
    case "C": return "No strong community consensus — buildable as a novelty.";
    case "D": return "Limited movepool or pre-evolution; evolve or skip.";
  }
}
