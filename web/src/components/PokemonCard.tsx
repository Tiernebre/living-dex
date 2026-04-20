import type { DecodedPokemon } from "../../../hub/protocol.ts";
import { lookup } from "../data";
import { formatSpeciesName, serebiiGen3DexUrl, thumbnailUrl } from "../format";
import { effectiveLevel, hiddenPower } from "../stats";
import { GRADE_CARD_CLASS, gradePokemon } from "../grade";
import { Confetti, MovesList, TypeBadge } from "./atoms";
import { GradeChip } from "./Grade";
import { ExpProgress, StatsTable } from "./StatsTable";

export function PokemonCard({
  mon,
  movesRight = false,
  fancyGrade = false,
}: {
  mon: DecodedPokemon;
  movesRight?: boolean;
  // Wild encounters opt into the glow/confetti badge. Party/PC get a plain
  // colored letter — the grade is still useful but the card shouldn't scream.
  fancyGrade?: boolean;
}) {
  const info = lookup(mon.species);
  const graded = info ? gradePokemon(mon.ivs, mon.nature, info.baseStats) : null;
  const gradeClass = fancyGrade && graded ? GRADE_CARD_CLASS[graded.grade] ?? "" : "";
  const level = effectiveLevel(mon, info);
  return (
    <div
      className={gradeClass}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: 8,
        border: "1px solid var(--accent)",
        borderRadius: 8,
        position: "relative",
        height: "100%",
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      {fancyGrade && graded?.grade === "S+" && <Confetti />}
      {info && (
        <img
          src={thumbnailUrl(info.nationalDex)}
          alt={info.name}
          width={72}
          height={72}
          style={{ flexShrink: 0 }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            marginBottom: 4,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span>
            {mon.nickname}
            {info && (
              <span style={{ fontWeight: 400, opacity: 0.7 }}>
                {" — "}
                <a
                  href={serebiiGen3DexUrl(info.nationalDex)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "inherit" }}
                >
                  {formatSpeciesName(info.name)}
                </a>
              </span>
            )}
          </span>
          {graded && <GradeChip graded={graded} nature={mon.nature} fancy={fancyGrade} />}
        </div>
        {info && info.types.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
            {info.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
        )}
        <div
          style={{
            fontSize: 13,
            opacity: 0.8,
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <span>
            Lv {level} · {mon.nature}
          </span>
          {info && <span style={{ opacity: 0.6 }}>·</span>}
          {info && (
            <span>
              <span style={{ opacity: 0.6 }}>Ability </span>
              <span style={{ fontWeight: 600 }}>
                {formatSpeciesName(info.abilities[mon.abilityBit] ?? info.abilities[0] ?? "?")}
              </span>
            </span>
          )}
        </div>
        {(() => {
          const hp = hiddenPower(mon.ivs);
          return (
            <div
              style={{
                fontSize: 13,
                opacity: 0.8,
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 4,
              }}
              title={`Hidden Power ${hp.type} · base power ${hp.power}`}
            >
              <span style={{ opacity: 0.6 }}>Hidden Power</span>
              <TypeBadge type={hp.type} />
              <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{hp.power}</span>
            </div>
          );
        })()}
        {info && <ExpProgress level={level} exp={mon.experience} rate={info.growthRate} />}
        {movesRight ? (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 240px", minWidth: 0 }}>
              <StatsTable
                ivs={mon.ivs}
                evs={mon.evs}
                nature={mon.nature}
                baseStats={info?.baseStats}
                level={level}
              />
            </div>
            <div style={{ flex: "1 1 240px", minWidth: 0 }}>
              <MovesList moves={mon.moves} />
            </div>
          </div>
        ) : (
          <>
            <StatsTable
              ivs={mon.ivs}
              evs={mon.evs}
              nature={mon.nature}
              baseStats={info?.baseStats}
              level={level}
            />
            <MovesList moves={mon.moves} />
          </>
        )}
      </div>
    </div>
  );
}
