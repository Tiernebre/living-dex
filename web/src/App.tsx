import { useEffect } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { GAME_STEMS } from "../../hub/protocol.ts";
import type { GameStem, SaveInfo } from "../../hub/protocol.ts";
import { CHALLENGE_CHAIN, CODE_TO_STEM, GAME_DISPLAY_NAME, isGameStem } from "./chain";
import { useLivingDex } from "./store";
import { Pokeball } from "./components/atoms";
import { ThemeToggle } from "./components/controls";
import { thumbnailUrl } from "./format";
import { Dashboard } from "./routes/Dashboard";
import { GameView } from "./routes/GameView";
import { GameLive } from "./routes/GameLive";
import { AllPokemon } from "./routes/AllPokemon";
import { PokemonDetail } from "./routes/PokemonDetail";
import { HallOfFame } from "./routes/HallOfFame";
import { SecretBases } from "./routes/SecretBases";

export function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pokemon" element={<AllPokemon />} />
          <Route path="/:game" element={<GameView />} />
          <Route path="/:game/live" element={<GameLive />} />
          <Route path="/:game/hall-of-fame" element={<HallOfFame />} />
          <Route path="/:game/secret-bases" element={<SecretBases />} />
          <Route path="/pokemon/:key" element={<PokemonDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

const SIDEBAR_WIDTH = 248;

function Layout({ children }: { children: React.ReactNode }) {
  const { game } = useLivingDex();
  const location = useLocation();
  const routeStem = location.pathname.split("/")[1] || undefined;
  useEffect(() => {
    const root = document.documentElement;
    const stem =
      (routeStem && isGameStem(routeStem) ? routeStem : undefined) ??
      (game ? CODE_TO_STEM[game.code] : undefined);
    if (stem) root.setAttribute("data-game", stem);
    else root.removeAttribute("data-game");
  }, [game, routeStem]);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <Sidebar routeStem={routeStem} />
      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding: "24px 28px",
          marginLeft: SIDEBAR_WIDTH,
        }}
      >
        {children}
      </main>
    </div>
  );
}

function Sidebar({ routeStem }: { routeStem: string | undefined }) {
  const { connected, game, saves } = useLivingDex();
  const runningStem = game ? CODE_TO_STEM[game.code] : null;
  const loadedStems = GAME_STEMS.filter((s) => saves[s]);
  const activeStem = routeStem && isGameStem(routeStem) ? routeStem : null;

  return (
    <aside
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        width: SIDEBAR_WIDTH,
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border)",
        overflowY: "auto",
        zIndex: 10,
      }}
    >
      <div style={{ padding: "18px 16px 12px" }}>
        <Link
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            color: "inherit",
            textDecoration: "none",
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: 0.2,
          }}
        >
          <Pokeball size={24} />
          <span>Living Dex</span>
        </Link>
      </div>

      <nav style={{ padding: "4px 8px", display: "grid", gap: 2 }}>
        <SideNavLink to="/" end icon={<Pokeball size={14} />} label="Dashboard" />
        <SideNavLink to="/pokemon" icon={<span aria-hidden>◎</span>} label="All Pokémon" />
      </nav>

      <SectionTitle>Games</SectionTitle>
      <div style={{ padding: "0 8px", display: "grid", gap: 2 }}>
        {loadedStems.length === 0 ? (
          <div
            style={{
              padding: "8px 10px",
              fontSize: 11,
              fontStyle: "italic",
              opacity: 0.6,
            }}
          >
            No saves loaded yet.
          </div>
        ) : (
          loadedStems.map((stem) => (
            <GameNavItem
              key={stem}
              stem={stem}
              save={saves[stem]!}
              active={activeStem === stem}
              live={runningStem === stem && connected}
            />
          ))
        )}
      </div>

      <div style={{ flex: 1 }} />

      <div
        style={{
          padding: "12px 14px 16px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "flex-start",
        }}
      >
        <ThemeToggle />
      </div>
    </aside>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        margin: "16px 18px 6px",
        fontSize: 10,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: 1,
        opacity: 0.55,
      }}
    >
      {children}
    </div>
  );
}

function SideNavLink({
  to,
  end,
  icon,
  label,
}: {
  to: string;
  end?: boolean;
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 8,
        textDecoration: "none",
        color: isActive ? "var(--accent-strong)" : "inherit",
        background: isActive ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "transparent",
        fontSize: 13,
        fontWeight: isActive ? 700 : 500,
      })}
    >
      <span style={{ width: 18, display: "inline-flex", justifyContent: "center" }}>{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

function GameNavItem({
  stem,
  save,
  active,
  live,
}: {
  stem: GameStem;
  save: SaveInfo;
  active: boolean;
  live: boolean;
}) {
  const step = CHALLENGE_CHAIN.find((c) => c.stem === stem);
  const tint = step?.tint ?? "#6b7280";
  const mascots = step?.mascots ?? [];
  return (
    <div>
      <NavLink
        to={`/${stem}`}
        end
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "6px 10px 6px 8px",
          borderRadius: 10,
          textDecoration: "none",
          color: "inherit",
          background: active
            ? `color-mix(in srgb, ${tint} 18%, var(--bg-elevated))`
            : "transparent",
          border: active
            ? `1px solid color-mix(in srgb, ${tint} 45%, var(--border))`
            : "1px solid transparent",
          position: "relative",
        }}
      >
        {active && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              top: 6,
              bottom: 6,
              width: 3,
              borderRadius: 2,
              background: tint,
            }}
          />
        )}
        <span style={{ width: 28, display: "inline-flex", justifyContent: "center" }}>
          {mascots.length > 0 ? (
            <img
              src={thumbnailUrl(mascots[0])}
              alt=""
              width={26}
              height={26}
              loading="lazy"
              style={{ filter: `drop-shadow(0 1px 2px ${tint}55)` }}
            />
          ) : (
            <Pokeball size={14} color={tint} />
          )}
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            fontWeight: active ? 700 : 600,
            color: active ? `color-mix(in srgb, ${tint} 80%, var(--text))` : "inherit",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {GAME_DISPLAY_NAME[stem]}
        </span>
        {live && (
          <span
            title="mGBA running"
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: "#16a34a",
              boxShadow: "0 0 0 2px color-mix(in srgb, #16a34a 30%, transparent)",
            }}
          />
        )}
      </NavLink>
      <div style={{ display: "grid", gap: 1, margin: "2px 0 6px 32px" }}>
        {stem !== "box" && (
          <SubNavLink to={`/${stem}/live`} tint={tint} icon="⚡" label="Live" live={live} />
        )}
        {save.enteredHof && (
          <SubNavLink
            to={`/${stem}/hall-of-fame`}
            tint={tint}
            icon="★"
            label="Hall of Fame"
            count={save.hallOfFame.length}
          />
        )}
        {save.secretBases.length > 0 && (
          <SubNavLink
            to={`/${stem}/secret-bases`}
            tint={tint}
            icon="⌂"
            label="Secret Bases"
            count={save.secretBases.length}
          />
        )}
      </div>
    </div>
  );
}

function SubNavLink({
  to,
  tint,
  icon,
  label,
  count,
  live,
}: {
  to: string;
  tint: string;
  icon: string;
  label: string;
  count?: number;
  live?: boolean;
}) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 10px",
        borderRadius: 6,
        textDecoration: "none",
        color: isActive ? `color-mix(in srgb, ${tint} 85%, var(--text))` : "inherit",
        background: isActive ? `color-mix(in srgb, ${tint} 12%, transparent)` : "transparent",
        fontSize: 12,
        fontWeight: isActive ? 700 : 500,
        opacity: isActive ? 1 : 0.85,
      })}
    >
      <span aria-hidden style={{ color: tint, width: 12, textAlign: "center" }}>
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
      {live && (
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: "#16a34a",
            boxShadow: "0 0 0 2px color-mix(in srgb, #16a34a 30%, transparent)",
          }}
        />
      )}
      {count !== undefined && (
        <span
          style={{
            fontSize: 10,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 700,
            opacity: 0.65,
          }}
        >
          {count}
        </span>
      )}
    </NavLink>
  );
}
