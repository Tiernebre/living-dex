import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { DecodedPokemon, GameStem } from "../../../hub/protocol.ts";
import { GAME_STEMS } from "../../../hub/protocol.ts";
import { CHALLENGE_CHAIN, GAME_DISPLAY_NAME } from "../chain";
import { lookup } from "../data";
import { formatSpeciesName, pokemonKey, thumbnailUrl } from "../format";
import { gradePokemon, GRADE_STYLE, type Grade } from "../grade";
import { effectiveLevel } from "../stats";
import { useLivingDex } from "../store";
import { GradeChip } from "../components/Grade";

type Row = {
  key: string;
  stem: GameStem;
  mon: DecodedPokemon;
  graded: ReturnType<typeof gradePokemon>;
  location: string;
  speciesName: string;
  level: number;
};

const GRADE_ORDER: Grade[] = ["S+", "S", "A", "B", "C", "D", "F"];
type SortKey = "grade" | "score" | "species" | "level" | "game";

export function Grades() {
  const { saves } = useLivingDex();
  const [gradeFilter, setGradeFilter] = useState<Set<Grade>>(new Set(GRADE_ORDER));
  const [gameFilter, setGameFilter] = useState<Set<GameStem>>(new Set(GAME_STEMS));
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("grade");

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const stem of GAME_STEMS) {
      const save = saves[stem];
      if (!save) continue;
      const pushMon = (mon: DecodedPokemon | null, where: string) => {
        if (!mon) return;
        const info = lookup(mon.species);
        if (!info) return;
        const graded = gradePokemon(mon.ivs, mon.nature, info.baseStats);
        out.push({
          key: `${stem}:${pokemonKey(mon)}:${where}`,
          stem,
          mon,
          graded,
          location: where,
          speciesName: formatSpeciesName(info.name),
          level: effectiveLevel(mon, info),
        });
      };
      save.party.forEach((m, i) => pushMon(m, `Party ${i + 1}`));
      save.boxes.forEach((b, bi) =>
        b.slots.forEach((m, si) => pushMon(m, `${b.name || `Box ${bi + 1}`} #${si + 1}`)),
      );
    }
    return out;
  }, [saves]);

  const counts = useMemo(() => {
    const c: Record<Grade, number> = { "S+": 0, S: 0, A: 0, B: 0, C: 0, D: 0, F: 0 };
    for (const r of rows) c[r.graded.grade]++;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (!gradeFilter.has(r.graded.grade)) return false;
      if (!gameFilter.has(r.stem)) return false;
      if (q) {
        const name = (r.mon.nickname || r.speciesName).toLowerCase();
        const species = r.speciesName.toLowerCase();
        if (!name.includes(q) && !species.includes(q)) return false;
      }
      return true;
    });
  }, [rows, gradeFilter, gameFilter, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const gradeIdx = (g: Grade) => GRADE_ORDER.indexOf(g);
    arr.sort((a, b) => {
      switch (sortBy) {
        case "grade": {
          const dg = gradeIdx(a.graded.grade) - gradeIdx(b.graded.grade);
          return dg !== 0 ? dg : b.graded.total - a.graded.total;
        }
        case "score":
          return b.graded.total - a.graded.total;
        case "species":
          return a.speciesName.localeCompare(b.speciesName);
        case "level":
          return b.level - a.level;
        case "game":
          return a.stem.localeCompare(b.stem);
      }
    });
    return arr;
  }, [filtered, sortBy]);

  const toggleGrade = (g: Grade) =>
    setGradeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  const toggleGame = (s: GameStem) =>
    setGameFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const loadedGames = GAME_STEMS.filter((s) => saves[s]);

  return (
    <>
      <div style={{ marginBottom: 14, fontSize: 13 }}>
        <Link to="/" style={{ color: "var(--accent-strong)" }}>
          Dashboard
        </Link>
        <span style={{ opacity: 0.4, padding: "0 6px" }}>/</span>
        <span style={{ opacity: 0.7 }}>Grades</span>
      </div>
      <header style={{ marginBottom: 14 }}>
        <h2 style={{ margin: "0 0 4px" }}>All Pokémon — {rows.length}</h2>
        <div style={{ fontSize: 13, opacity: 0.7 }}>
          Across {loadedGames.length} loaded save{loadedGames.length === 1 ? "" : "s"} · filter &amp;
          sort by grade.
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
        <FilterRow label="Grade">
          {GRADE_ORDER.map((g) => {
            const on = gradeFilter.has(g);
            const s = GRADE_STYLE[g];
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleGrade(g)}
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
                {g} <span style={{ opacity: 0.7, fontWeight: 500 }}>({counts[g]})</span>
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

        <FilterRow label="Sort">
          {(
            [
              ["grade", "Grade"],
              ["score", "Score"],
              ["species", "Species"],
              ["level", "Level"],
              ["game", "Game"],
            ] as const
          ).map(([key, label]) => {
            const on = sortBy === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSortBy(key)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: `1px solid ${on ? "var(--accent-strong)" : "var(--border)"}`,
                  background: on ? "var(--accent)" : "transparent",
                  color: on ? "#fff" : "inherit",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </FilterRow>
      </section>

      {sorted.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", opacity: 0.6, fontStyle: "italic" }}>
          No Pokémon match these filters.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 8,
          }}
        >
          {sorted.map((r) => (
            <GradeRow key={r.key} row={r} />
          ))}
        </div>
      )}
    </>
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

function GradeRow({ row }: { row: Row }) {
  const { mon, graded, stem, speciesName, level } = row;
  const info = lookup(mon.species);
  const step = CHALLENGE_CHAIN.find((c) => c.stem === stem);
  const tint = step?.tint ?? "var(--accent)";
  const name = mon.nickname || speciesName;
  const detailHref = `/pokemon/${pokemonKey(mon)}`;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${tint}`,
        borderRadius: 8,
        background: "var(--bg-elevated)",
        minWidth: 0,
      }}
    >
      {info && (
        <img
          src={thumbnailUrl(info.nationalDex)}
          alt={info.name}
          width={40}
          height={40}
          style={{ flexShrink: 0 }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, display: "flex", gap: 6, alignItems: "baseline" }}>
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
            opacity: 0.7,
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span style={{ color: tint, fontWeight: 600 }}>{GAME_DISPLAY_NAME[stem]}</span>
          <span>·</span>
          <span>Lv {level}</span>
          <span>·</span>
          <span>{mon.nature}</span>
          <span>·</span>
          <span>IV {graded.ivSum}/186</span>
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        <GradeChip graded={graded} nature={mon.nature} fancy />
      </div>
    </div>
  );
}
