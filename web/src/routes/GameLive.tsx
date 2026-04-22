import { Navigate, useParams } from "react-router-dom";
import { CHALLENGE_CHAIN, CODE_TO_STEM, GAME_DISPLAY_NAME, isGameStem } from "../chain";
import { useLivingDex } from "../store";
import { Pokeball, StatusBadge } from "../components/atoms";
import { PokemonCard, useAnyExpanded } from "../components/PokemonCard";
import { pokemonKey } from "../format";
import { Tabs } from "../components/controls";
import { Encounters } from "../components/Encounters";
import { FeebasMap } from "../components/FeebasMap";
import { ownershipIndex, regionalDexStarEarned } from "../owned";

export function GameLive() {
  const params = useParams<{ game: string }>();
  const stem = params.game && isGameStem(params.game) ? params.game : null;
  const {
    connected,
    game,
    party,
    enemyParty,
    inBattle,
    location,
    source,
    lastUpdateAt,
    saves,
  } = useLivingDex();
  // Must come before the early-return so hook order stays stable across
  // renders (react-hooks/rules-of-hooks).
  const partyKeys = party.flatMap((m) => (m ? [pokemonKey(m)] : []));
  const anyExpanded = useAnyExpanded(partyKeys);
  if (!stem) return <Navigate to="/" replace />;

  const runningStem = game ? CODE_TO_STEM[game.code] : null;
  const canShowLive = connected && runningStem === stem;
  const chainStep = CHALLENGE_CHAIN.find((c) => c.stem === stem);
  const tint = chainStep?.tint ?? "#6b7280";
  const activeMon = party.find((p) => p !== null) ?? null;
  const activeEnemy = enemyParty.find((p) => p !== null) ?? null;
  // Skip the encounter ownership tracker when it has nothing useful to say:
  //  - secondary games in a stage (Ruby when Sapphire is the primary) don't
  //    need their own living-dex pressure — progress happens in the primary
  //  - primaries that have already earned the regional-dex trainer star
  //    (Hoenn #1..200 for RSE — Jirachi/Deoxys excluded) don't need markers
  const starEarned = regionalDexStarEarned(stem, saves[stem] ?? null);
  const showEncounterOwnership = chainStep?.primary === true && !starEarned;
  const ownership = showEncounterOwnership ? ownershipIndex(saves, stem) : undefined;
  const save = saves[stem] ?? null;
  const feebasSeed = save?.feebasSeed ?? null;
  // Route 119 is mapGroup 0, mapNum 34 in R/S/E. Only show the Feebas map
  // when we actually have a seed to compute it from.
  const onRoute119 = location?.mapGroup === 0 && location?.mapNum === 34;
  const showFeebas = feebasSeed !== null && (stem === "ruby" || stem === "sapphire" || stem === "emerald");
  const eggsInParty = party.filter((m) => m?.isEgg).length;

  return (
    <>
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
          {GAME_DISPLAY_NAME[stem]} <span style={{ opacity: 0.55, fontWeight: 600 }}>· Live</span>
        </h2>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <StatusBadge
            label="mGBA"
            value={connected ? "connected" : "disconnected"}
            tone={connected ? "success" : "danger"}
            detail={game ? `${game.name} (rev ${game.revision})` : undefined}
          />
          <StatusBadge
            label="Source"
            value={source ?? "none"}
            tone={source ? "info" : "muted"}
            detail={lastUpdateAt ? new Date(lastUpdateAt).toLocaleTimeString() : undefined}
          />
        </div>
      </div>

      {!canShowLive ? (
        <section style={{ padding: 32, textAlign: "center", opacity: 0.6, fontStyle: "italic" }}>
          {connected
            ? `mGBA is running ${
                runningStem ? GAME_DISPLAY_NAME[runningStem] : "a different game"
              }, not ${GAME_DISPLAY_NAME[stem]}.`
            : "Waiting for mGBA connection…"}
        </section>
      ) : (
        <>
          {eggsInParty > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                marginBottom: 14,
                borderRadius: 10,
                border: `1px solid color-mix(in srgb, ${tint} 45%, var(--border))`,
                background: `linear-gradient(135deg, color-mix(in srgb, ${tint} 14%, var(--bg-surface)), var(--bg-surface) 75%)`,
                fontSize: 13,
              }}
            >
              <span style={{ fontSize: 18 }} aria-hidden>🥚</span>
              <span>
                <strong style={{ color: tint }}>
                  {eggsInParty} egg{eggsInParty === 1 ? "" : "s"}
                </strong>{" "}
                in party — walk to hatch.
              </span>
            </div>
          )}
          <h2>Party</h2>
          <ol
            style={{
              listStyle: "none",
              padding: 0,
              display: "grid",
              gridTemplateColumns: anyExpanded ? "1fr" : "repeat(2, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {party.map((mon, i) => (
              <li key={i} style={mon ? undefined : { opacity: 0.4 }}>
                {mon ? <PokemonCard mon={mon} linkToDetail collapsible /> : "—"}
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
                        {activeMon ? (
                          <PokemonCard mon={activeMon} linkToDetail />
                        ) : (
                          <div style={{ opacity: 0.5 }}>—</div>
                        )}
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
                        <PokemonCard mon={activeEnemy} fancyGrade />
                      </div>
                    </div>
                  ) : (
                    <p style={{ opacity: 0.6, fontStyle: "italic" }}>Not in a battle.</p>
                  ),
              },
              {
                id: "encounters",
                label: "Wild Encounters",
                content: <Encounters location={location} ownership={ownership} />,
              },
              ...(showFeebas
                ? [{
                    id: "feebas",
                    label: "Feebas Tiles",
                    content: (
                      <FeebasMap seed={feebasSeed!} tint={tint} player={null} />
                    ),
                  }]
                : []),
            ]}
            initial={inBattle ? "matchup" : onRoute119 && showFeebas ? "feebas" : "encounters"}
            storageKey="living-dex:active-tab"
          />
        </>
      )}
    </>
  );
}
