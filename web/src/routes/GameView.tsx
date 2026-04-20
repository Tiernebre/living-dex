import { useEffect, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import type { DecodedPokemon, GameStem, HubState, SaveInfo } from "../../../hub/protocol.ts";
import { CODE_TO_STEM, GAME_DISPLAY_NAME, isGameStem } from "../chain";
import { countBoxMons, countOwnedSpecies } from "../owned";
import { useLivingDex } from "../store";
import { BoxHeroCard } from "../components/BoxHeroCard";
import { LivingDexGrid } from "../components/LivingDexGrid";
import { ModeToggle, type Mode, Tabs } from "../components/controls";
import { PCBoxes } from "../components/PCBoxes";
import { PokemonCard } from "../components/PokemonCard";
import { TrainerSaveCard } from "../components/TrainerSaveCard";
import { Encounters } from "../components/Encounters";

export function GameView() {
  const params = useParams<{ game: string }>();
  const { connected, game, party, enemyParty, inBattle, location, saves } = useLivingDex();
  const stem = params.game && isGameStem(params.game) ? params.game : null;
  const saveInfo = stem ? saves[stem] ?? null : null;
  const runningStem = game ? CODE_TO_STEM[game.code] : null;
  const canShowLive = connected && runningStem === stem;

  const [mode, setMode] = useState<Mode>("saved");
  const prevCanShowLive = useRef(canShowLive);
  useEffect(() => {
    if (!prevCanShowLive.current && canShowLive) setMode("live");
    prevCanShowLive.current = canShowLive;
  }, [canShowLive]);

  // Pokémon Box RS is just a PC-box extension — no trainer, no party, no live mode.
  // Render its own slim view rather than pretending it has a trainer card.
  if (stem === "box") return <BoxSavedView saveInfo={saveInfo} />;
  if (!stem) return <Navigate to="/" replace />;

  const activeMon = party.find((p) => p !== null) ?? null;
  const activeEnemy = enemyParty.find((p) => p !== null) ?? null;

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20 }}>{GAME_DISPLAY_NAME[stem]}</h2>
        <ModeToggle mode={mode} setMode={setMode} connected={connected} />
      </div>
      {mode === "saved" ? (
        <SavedView stem={stem} saveInfo={saveInfo} />
      ) : !canShowLive ? (
        <section style={{ padding: 32, textAlign: "center", opacity: 0.6, fontStyle: "italic" }}>
          {connected
            ? `mGBA is running ${
                runningStem ? GAME_DISPLAY_NAME[runningStem] : "a different game"
              }, not ${GAME_DISPLAY_NAME[stem]}.`
            : "Waiting for mGBA connection…"}
        </section>
      ) : (
        <LiveView
          connected={connected}
          party={party}
          inBattle={inBattle}
          activeMon={activeMon}
          activeEnemy={activeEnemy}
          location={location}
        />
      )}
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
                    {mon ? <PokemonCard mon={mon} movesRight /> : "—"}
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
      <LivingDexGrid stem={stem} saveInfo={saveInfo} />
    </>
  );
}

// Pokémon Box: R/S has no trainer card — just the PC extension it is.
// Hero card + box grid, nothing else.
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

function LiveView({
  connected,
  party,
  inBattle,
  activeMon,
  activeEnemy,
  location,
}: {
  connected: boolean;
  party: HubState["party"];
  inBattle: boolean;
  activeMon: DecodedPokemon | null;
  activeEnemy: DecodedPokemon | null;
  location: HubState["location"];
}) {
  if (!connected) {
    return (
      <section style={{ padding: 32, textAlign: "center", opacity: 0.6, fontStyle: "italic" }}>
        Waiting for mGBA connection…
      </section>
    );
  }
  return (
    <>
      <h2>Party</h2>
      <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
        {party.map((mon, i) => (
          <li key={i} style={mon ? undefined : { opacity: 0.4 }}>
            {mon ? <PokemonCard mon={mon} movesRight /> : "—"}
          </li>
        ))}
      </ol>
      <Tabs
        tabs={[
          {
            id: "matchup",
            label: "Current Matchup",
            content:
              inBattle && activeEnemy ? (
                <div className="matchup">
                  <div className="matchup-card">
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.6,
                        marginBottom: 4,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      You
                    </div>
                    {activeMon ? <PokemonCard mon={activeMon} /> : <div style={{ opacity: 0.5 }}>—</div>}
                  </div>
                  <div className="matchup-vs">vs</div>
                  <div className="matchup-card">
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.6,
                        marginBottom: 4,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      Opponent
                    </div>
                    <PokemonCard mon={activeEnemy!} fancyGrade />
                  </div>
                </div>
              ) : (
                <p style={{ opacity: 0.6, fontStyle: "italic" }}>Not in a battle.</p>
              ),
          },
          {
            id: "encounters",
            label: "Wild Encounters",
            content: <Encounters location={location} />,
          },
        ]}
        initial={inBattle ? "matchup" : "encounters"}
        storageKey="living-dex:active-tab"
      />
    </>
  );
}
