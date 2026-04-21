import { Navigate, useParams } from "react-router-dom";
import type { GameStem, SaveInfo } from "../../../hub/protocol.ts";
import { CHALLENGE_CHAIN, GAME_DISPLAY_NAME, isGameStem } from "../chain";
import { countBoxMons, countOwnedSpecies } from "../owned";
import { useLivingDex } from "../store";
import { Pokeball } from "../components/atoms";
import { BoxHeroCard } from "../components/BoxHeroCard";
import { LivingDexGrid } from "../components/LivingDexGrid";
import { Tabs } from "../components/controls";
import { PCBoxes } from "../components/PCBoxes";
import { PokemonCard } from "../components/PokemonCard";
import { TrainerSaveCard } from "../components/TrainerSaveCard";

export function GameView() {
  const params = useParams<{ game: string }>();
  const { saves } = useLivingDex();
  const stem = params.game && isGameStem(params.game) ? params.game : null;
  const saveInfo = stem ? saves[stem] ?? null : null;

  if (stem === "box") return <BoxSavedView saveInfo={saveInfo} />;
  if (!stem) return <Navigate to="/" replace />;

  const stepTint = CHALLENGE_CHAIN.find((c) => c.stem === stem)?.tint ?? "#6b7280";
  return (
    <>
      <GameHeader stem={stem} tint={stepTint} />
      <SavedView stem={stem} saveInfo={saveInfo} />
    </>
  );
}

function SavedView({ stem, saveInfo }: { stem: GameStem; saveInfo: SaveInfo | null }) {
  if (!saveInfo) {
    return (
      <section style={{ padding: 32, textAlign: "center", opacity: 0.6, fontStyle: "italic" }}>
        No save file loaded for {GAME_DISPLAY_NAME[stem]}. Drop{" "}
        <code>saves/{stem}.sav</code> in place and it'll pick up automatically.
      </section>
    );
  }
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <TrainerSaveCard
          stem={stem}
          saveInfo={saveInfo}
          speciesCount={countOwnedSpecies(saveInfo).size}
          showSeconds
          savedAtMs={saveInfo.savedAtMs}
        />
      </div>
      <Tabs
        tabs={[
          {
            id: "party",
            label: "Party",
            content: saveInfo.party.some((p) => p) ? (
              <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
                {saveInfo.party.map((mon, i) => (
                  <li key={i} style={mon ? undefined : { opacity: 0.4 }}>
                    {mon ? <PokemonCard mon={mon} movesRight linkToDetail /> : "—"}
                  </li>
                ))}
              </ol>
            ) : (
              <p style={{ opacity: 0.6, fontStyle: "italic" }}>No party Pokémon in this save.</p>
            ),
          },
          {
            id: "boxes",
            label: `PC Boxes (${countBoxMons(saveInfo)})`,
            content: <PCBoxes saveInfo={saveInfo} />,
          },
        ]}
        initial="party"
        storageKey={`living-dex:saved-tab:${stem}`}
      />
      <LivingDexGrid saveInfo={saveInfo} />
    </>
  );
}

function GameHeader({ stem, tint }: { stem: GameStem; tint: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 20,
        flexWrap: "wrap",
        paddingBottom: 12,
        borderBottom: `1px solid color-mix(in srgb, ${tint} 25%, var(--border))`,
      }}
    >
      <Pokeball size={18} color={tint} />
      <h2
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: 0.3,
          color: `color-mix(in srgb, ${tint} 75%, var(--text))`,
        }}
      >
        {GAME_DISPLAY_NAME[stem]}
      </h2>
    </div>
  );
}

function BoxSavedView({ saveInfo }: { saveInfo: SaveInfo | null }) {
  if (!saveInfo) {
    return (
      <section style={{ padding: 32, textAlign: "center", opacity: 0.6, fontStyle: "italic" }}>
        No save file loaded for Pokémon Box. Drop{" "}
        <code>saves/box.gci</code> in place and it'll pick up automatically.
      </section>
    );
  }
  const total = countBoxMons(saveInfo);
  const usedBoxes = saveInfo.boxes.filter((b) => b.slots.some((m) => m)).length;
  const uniqueSpecies = new Set<number>();
  for (const box of saveInfo.boxes) for (const m of box.slots) if (m) uniqueSpecies.add(m.species);
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <BoxHeroCard
          total={total}
          uniqueSpecies={uniqueSpecies.size}
          usedBoxes={usedBoxes}
          totalBoxes={saveInfo.boxes.length}
          savedAtMs={saveInfo.savedAtMs}
        />
      </div>
      <PCBoxes saveInfo={saveInfo} />
    </>
  );
}
