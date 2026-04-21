import { Navigate, useParams } from "react-router-dom";
import { CHALLENGE_CHAIN, CODE_TO_STEM, GAME_DISPLAY_NAME, isGameStem } from "../chain";
import { useLivingDex } from "../store";
import { Pokeball, StatusBadge } from "../components/atoms";
import { PokemonCard } from "../components/PokemonCard";
import { Tabs } from "../components/controls";
import { Encounters } from "../components/Encounters";

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
  } = useLivingDex();
  if (!stem) return <Navigate to="/" replace />;

  const runningStem = game ? CODE_TO_STEM[game.code] : null;
  const canShowLive = connected && runningStem === stem;
  const tint = CHALLENGE_CHAIN.find((c) => c.stem === stem)?.tint ?? "#6b7280";
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
                content: <Encounters location={location} />,
              },
            ]}
            initial={inBattle ? "matchup" : "encounters"}
            storageKey="living-dex:active-tab"
          />
        </>
      )}
    </>
  );
}
