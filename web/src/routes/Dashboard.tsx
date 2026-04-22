import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { DecodedPokemon, GameStem } from "../../../hub/protocol.ts";
import { GAME_STEMS } from "../../../hub/protocol.ts";
import { CHALLENGE_CHAIN, CODE_TO_STEM, GEN_LABELS } from "../chain";
import { formatFirstSeen } from "../format";
import { countOwnedSpecies, trainerStarsBreakdown } from "../owned";
import { useLivingDex } from "../store";
import { Pokeball } from "../components/atoms";
import { ChainCard } from "../components/ChainCard";
import { LatestCatchCard } from "../components/LatestCatchCard";
import { TrainerSaveCard } from "../components/TrainerSaveCard";

export function Dashboard() {
  const { saves, connected, game, catchLog } = useLivingDex();
  const runningStem = game ? CODE_TO_STEM[game.code] : null;

  const perGame = useMemo(() => {
    const perGame: Partial<Record<GameStem, Set<number>>> = {};
    for (const stem of GAME_STEMS) {
      const s = saves[stem];
      if (!s) continue;
      perGame[stem] = countOwnedSpecies(s);
    }
    return perGame;
  }, [saves]);

  const mostRecentlyPlayed = useMemo(() => {
    let best: { stem: GameStem; at: number } | null = null;
    for (const stem of GAME_STEMS) {
      const s = saves[stem];
      if (!s) continue;
      if (!best || s.savedAtMs > best.at) best = { stem, at: s.savedAtMs };
    }
    if (!best) return null;
    const step = CHALLENGE_CHAIN.find((c) => c.stem === best!.stem);
    return {
      stem: best.stem,
      at: best.at,
      label: step?.label ?? best.stem,
      tint: step?.tint ?? "var(--accent)",
    };
  }, [saves]);

  const latestCatch = useMemo<{ stem: GameStem; mon: DecodedPokemon; at: number } | null>(() => {
    type Best = { stem: GameStem; mon: DecodedPokemon; at: number };
    let best: Best | null = null;
    for (const stem of GAME_STEMS) {
      const s = saves[stem];
      if (!s) continue;
      const scan = (mon: DecodedPokemon | null) => {
        if (!mon) return;
        const at = catchLog[`${mon.pid}:${mon.otId}`];
        if (at == null) return;
        const current: Best | null = best;
        if (!current || at > current.at) best = { stem, mon, at };
      };
      s.party.forEach(scan);
      s.boxes.forEach((b) => b.slots.forEach(scan));
    }
    return best;
  }, [saves, catchLog]);

  const loaded = GAME_STEMS.filter((s) => saves[s]);

  // State machine: a stage is unlocked when every game in the prior stage has
  // met its completion bar — primaries need a 4★ trainer card, secondaries need
  // to have cleared the Elite Four. Stage 1 always unlocks.
  const stageUnlocked = useMemo(() => {
    const stages = Array.from(new Set(CHALLENGE_CHAIN.map((s) => s.stage))).sort((a, b) => a - b);
    const unlocked = new Set<number>();
    let prevComplete = true;
    for (const stage of stages) {
      if (prevComplete) unlocked.add(stage);
      const games = CHALLENGE_CHAIN.filter((s) => s.stage === stage);
      // GameCube games aren't tracked by the hub — they sit in the chain
      // for release-order context but don't gate progression either way.
      const trackable = games.filter((s) => !s.external);
      if (trackable.length === 0) continue;
      prevComplete = trackable.every((s) => {
        const save = s.stem ? saves[s.stem] : null;
        if (!save) return false;
        if (s.primary) {
          return trainerStarsBreakdown(s, save).every((t) => t.earned);
        }
        return save.enteredHof;
      });
    }
    return unlocked;
  }, [saves]);

  return (
    <>
      <section
        className="trainer-hero"
        style={{
          position: "relative",
          padding: "18px 22px",
          marginBottom: 22,
          border: "1px solid color-mix(in srgb, #ef4444 25%, var(--border))",
          borderRadius: 14,
          background:
            "linear-gradient(135deg, color-mix(in srgb, #ef4444 14%, var(--bg-elevated)) 0%, var(--bg-elevated) 55%, color-mix(in srgb, #2563eb 10%, var(--bg-elevated)) 100%)",
          overflow: "hidden",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            right: -40,
            top: -40,
            opacity: 0.15,
          }}
        >
          <Pokeball size={180} />
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            position: "relative",
          }}
        >
          {mostRecentlyPlayed ? (
            <Link
              to={`/${mostRecentlyPlayed.stem}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                fontSize: 12,
                fontWeight: 700,
                color: "inherit",
                textDecoration: "none",
              }}
            >
              <Pokeball size={14} />
              <span style={{ opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.8 }}>
                Most recently played
              </span>
              <span style={{ color: mostRecentlyPlayed.tint, fontSize: 15 }}>
                {mostRecentlyPlayed.label}
              </span>
              <span style={{ opacity: 0.6, fontWeight: 600 }}>
                {formatFirstSeen(mostRecentlyPlayed.at)}
              </span>
            </Link>
          ) : (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                fontSize: 12,
                opacity: 0.7,
                fontWeight: 700,
              }}
            >
              <Pokeball size={14} />
              <span style={{ textTransform: "uppercase", letterSpacing: 0.8 }}>
                No saves loaded yet
              </span>
            </div>
          )}
          <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.75, fontWeight: 600 }}>
            {loaded.length} of {GAME_STEMS.length} Gen 3 saves loaded
          </div>
        </div>
      </section>

      {latestCatch && <LatestCatchCard {...latestCatch} />}

      {(() => {
        const boxStep = CHALLENGE_CHAIN.find((s) => s.stem === "box");
        if (!boxStep) return null;
        const saveInfo = boxStep.stem ? saves[boxStep.stem] ?? null : null;
        const owned = boxStep.stem ? perGame[boxStep.stem] ?? null : null;
        const isLive = !!(boxStep.stem && runningStem === boxStep.stem && connected);
        return (
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ margin: "0 0 10px" }}>Pokémon Box</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 12,
              }}
            >
              <ChainCard
                step={boxStep}
                loaded={!!saveInfo}
                caught={owned?.size ?? 0}
                owned={owned}
                saveInfo={saveInfo}
                unsupported={false}
                isLive={isLive}
                locked={false}
              />
            </div>
          </section>
        );
      })()}

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 10px" }}>Challenge chain</h2>
        {([3, 4, 5] as const).map((gen) => {
          const genSteps = CHALLENGE_CHAIN.filter((s) => s.gen === gen && s.stem !== "box");
          if (genSteps.length === 0) return null;
          const stages = Array.from(new Set(genSteps.map((s) => s.stage))).sort((a, b) => a - b);
          return (
            <div key={gen} style={{ marginBottom: 18 }}>
              <h3
                style={{
                  margin: "0 0 8px",
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  opacity: 0.65,
                  fontWeight: 700,
                }}
              >
                {GEN_LABELS[gen]}
              </h3>
              {stages.map((stage) => {
                const steps = genSteps.filter((s) => s.stage === stage);
                const locked = !stageUnlocked.has(stage);
                return (
                  <div
                    key={stage}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: 12,
                      marginBottom: 10,
                    }}
                  >
                    {steps.map((step) => {
                      const saveInfo = step.stem ? saves[step.stem] ?? null : null;
                      const loaded = !!saveInfo;
                      const owned = step.stem ? perGame[step.stem] ?? null : null;
                      const caught = owned?.size ?? 0;
                      const unsupported = !step.stem;
                      const isLive = !!(step.stem && runningStem === step.stem && connected);
                      return (
                        <ChainCard
                          key={step.label}
                          step={step}
                          loaded={loaded}
                          caught={caught}
                          owned={owned}
                          saveInfo={saveInfo}
                          unsupported={unsupported}
                          isLive={isLive}
                          locked={locked && !step.external}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </section>

      <section>
        <h2 style={{ margin: "0 0 10px" }}>Loaded saves</h2>
        {loaded.length === 0 ? (
          <p style={{ opacity: 0.6, fontStyle: "italic" }}>
            No saves loaded yet. Drop one into the <code>saves/</code> directory.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {loaded.map((stem) => (
              <TrainerSaveCard
                key={stem}
                stem={stem}
                saveInfo={saves[stem]!}
                speciesCount={perGame[stem]?.size ?? 0}
                linkTo={`/${stem}`}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
