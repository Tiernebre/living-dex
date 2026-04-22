import { useEffect, useState } from "react";
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
import { Contest } from "./routes/Contest";
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
          <Route path="/contest" element={<Contest />} />
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
const SIDEBAR_WIDTH_COLLAPSED = 60;
const SIDEBAR_COLLAPSED_KEY = "living-dex:sidebar-collapsed";

function Layout({ children }: { children: React.ReactNode }) {
  const { game } = useLivingDex();
  const location = useLocation();
  const routeStem = location.pathname.split("/")[1] || undefined;
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* no-op */
    }
  }, [collapsed]);
  useEffect(() => {
    const root = document.documentElement;
    const stem =
      (routeStem && isGameStem(routeStem) ? routeStem : undefined) ??
      (game ? CODE_TO_STEM[game.code] : undefined);
    if (stem) root.setAttribute("data-game", stem);
    else root.removeAttribute("data-game");
  }, [game, routeStem]);
  const width = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <Sidebar
        routeStem={routeStem}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
        width={width}
      />
      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding: "24px 28px",
          marginLeft: width,
          transition: "margin-left 180ms ease",
        }}
      >
        {children}
      </main>
    </div>
  );
}

function Sidebar({
  routeStem,
  collapsed,
  onToggleCollapsed,
  width,
}: {
  routeStem: string | undefined;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  width: number;
}) {
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
        width,
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border)",
        overflowY: "auto",
        overflowX: "hidden",
        zIndex: 10,
        transition: "width 180ms ease",
      }}
    >
      <div
        style={{
          padding: collapsed ? "14px 8px 10px" : "16px 14px 10px",
          display: "flex",
          flexDirection: collapsed ? "column" : "row",
          alignItems: "center",
          gap: collapsed ? 10 : 8,
        }}
      >
        <Link
          to="/"
          title="Living Dex"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            color: "inherit",
            textDecoration: "none",
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: 0.2,
            flex: collapsed ? "0 0 auto" : 1,
            minWidth: 0,
          }}
        >
          <Pokeball size={24} />
          {!collapsed && <span>Living Dex</span>}
        </Link>
        <CollapseToggle collapsed={collapsed} onClick={onToggleCollapsed} />
      </div>

      <nav style={{ padding: "4px 8px", display: "grid", gap: 2 }}>
        <SideNavLink
          to="/pokemon"
          icon={<span aria-hidden>◎</span>}
          label="All Pokémon"
          collapsed={collapsed}
        />
        <SideNavLink
          to="/contest"
          icon={<span aria-hidden>★</span>}
          label="Contest Tiers"
          collapsed={collapsed}
        />
      </nav>

      {!collapsed && <SectionTitle>Games</SectionTitle>}
      <div style={{ padding: collapsed ? "8px 8px 0" : "0 8px", display: "grid", gap: 2 }}>
        {loadedStems.length === 0 ? (
          !collapsed && (
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
          )
        ) : (
          loadedStems.map((stem) => (
            <GameNavItem
              key={stem}
              stem={stem}
              save={saves[stem]!}
              active={activeStem === stem}
              live={runningStem === stem && connected}
              collapsed={collapsed}
            />
          ))
        )}
      </div>

      <div style={{ flex: 1 }} />

      <div
        style={{
          padding: collapsed ? "10px 8px 12px" : "12px 14px 16px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
        {!collapsed && <ThemeToggle />}
      </div>
    </aside>
  );
}

function CollapseToggle({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      style={{
        width: 26,
        height: 26,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        border: "1px solid var(--border)",
        background: "var(--bg-elevated)",
        color: "var(--text-muted)",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 13,
        lineHeight: 1,
        padding: 0,
        flexShrink: 0,
      }}
    >
      <span aria-hidden style={{ display: "inline-block", transform: collapsed ? "none" : "scaleX(-1)" }}>
        »
      </span>
    </button>
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
  collapsed,
}: {
  to: string;
  end?: boolean;
  icon?: React.ReactNode;
  label: string;
  collapsed?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      style={({ isActive }) => ({
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: collapsed ? "8px 0" : "8px 10px",
        justifyContent: collapsed ? "center" : "flex-start",
        borderRadius: 8,
        textDecoration: "none",
        color: isActive ? "var(--accent-strong)" : "inherit",
        background: isActive ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "transparent",
        fontSize: 13,
        fontWeight: isActive ? 700 : 500,
      })}
    >
      <span style={{ width: 18, display: "inline-flex", justifyContent: "center" }}>{icon}</span>
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}

function GameNavItem({
  stem,
  save,
  active,
  live,
  collapsed,
}: {
  stem: GameStem;
  save: SaveInfo;
  active: boolean;
  live: boolean;
  collapsed: boolean;
}) {
  const step = CHALLENGE_CHAIN.find((c) => c.stem === stem);
  const tint = step?.tint ?? "#6b7280";
  const mascots = step?.mascots ?? [];
  const hasSubNav =
    stem !== "box" || save.enteredHof || save.secretBases.length > 0;
  // Auto-open when this game becomes the active route; otherwise stay collapsed
  // so the sidebar isn't a wall of links. The user can toggle independently.
  const [expanded, setExpanded] = useState(active);
  useEffect(() => {
    if (active) setExpanded(true);
  }, [active]);
  const showSubNav = !collapsed && hasSubNav && expanded;
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: 2,
          borderRadius: 10,
          background: active
            ? `color-mix(in srgb, ${tint} 18%, var(--bg-elevated))`
            : "transparent",
          border: active
            ? `1px solid color-mix(in srgb, ${tint} 45%, var(--border))`
            : "1px solid transparent",
          position: "relative",
          overflow: "hidden",
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
        <NavLink
          to={`/${stem}`}
          end
          title={collapsed ? GAME_DISPLAY_NAME[stem] : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: collapsed ? "6px 0" : "6px 8px 6px 8px",
            justifyContent: collapsed ? "center" : "flex-start",
            textDecoration: "none",
            color: "inherit",
            flex: 1,
            minWidth: 0,
          }}
        >
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
          {!collapsed && (
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
          )}
          {live && !collapsed && (
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
        {!collapsed && hasSubNav && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            title={expanded ? `Hide ${GAME_DISPLAY_NAME[stem]} sections` : `Show ${GAME_DISPLAY_NAME[stem]} sections`}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse" : "Expand"}
            style={{
              width: 24,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 11,
              color: `color-mix(in srgb, ${tint} 70%, var(--text-muted))`,
              padding: "0 6px 0 0",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span
              aria-hidden
              style={{
                display: "inline-block",
                transition: "transform 140ms ease",
                transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              }}
            >
              ▸
            </span>
          </button>
        )}
      </div>
      {showSubNav && (
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
      )}
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
