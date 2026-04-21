import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import type { DecodedPokemon, GameStem, HubState, SaveInfo } from "../../../hub/protocol.ts";
import { CHALLENGE_CHAIN, CODE_TO_STEM, GAME_DISPLAY_NAME, isGameStem } from "../chain";
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
  const tint = CHALLENGE_CHAIN.find((c) => c.stem === stem)?.tint ?? "#6b7280";
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
        {(saveInfo.enteredHof || saveInfo.secretBases.length > 0) && (
          <div
            style={{
              marginTop: 8,
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {saveInfo.enteredHof && (
              <PillLink
                to={`/${stem}/hall-of-fame`}
                tint={tint}
                icon="★"
                label="Hall of Fame"
                count={saveInfo.hallOfFame.length}
              />
            )}
            {saveInfo.secretBases.length > 0 && (
              <PillLink
                to={`/${stem}/secret-bases`}
                tint={tint}
                icon="⌂"
                label="Secret Bases"
                count={saveInfo.secretBases.length}
              />
            )}
          </div>
        )}
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

function PillLink({
  to,
  tint,
  icon,
  label,
  count,
}: {
  to: string;
  tint: string;
  icon: string;
  label: string;
  count: number;
}) {
  return (
    <Link
      to={to}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0.8,
        textTransform: "uppercase",
        textDecoration: "none",
        borderRadius: 999,
        border: `1px solid color-mix(in srgb, ${tint} 40%, var(--border))`,
        background: `color-mix(in srgb, ${tint} 14%, var(--bg-elevated))`,
        color: `color-mix(in srgb, ${tint} 80%, var(--text))`,
      }}
    >
      <span aria-hidden>{icon}</span>
      {label}
      <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, opacity: 0.8 }}>
        ({count})
      </span>
    </Link>
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
            {mon ? <PokemonCard mon={mon} movesRight linkToDetail /> : "—"}
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
                    {activeMon ? <PokemonCard mon={activeMon} linkToDetail /> : <div style={{ opacity: 0.5 }}>—</div>}
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
