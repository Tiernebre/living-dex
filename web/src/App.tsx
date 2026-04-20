import { useEffect } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { CODE_TO_STEM, isGameStem } from "./chain";
import { useLivingDex } from "./store";
import { Pokeball, StatusBadge } from "./components/atoms";
import { ThemeToggle } from "./components/controls";
import { Dashboard } from "./routes/Dashboard";
import { GameView } from "./routes/GameView";
import { PokemonDetail } from "./routes/PokemonDetail";

export function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/:game" element={<GameView />} />
          <Route path="/:game/pokemon/:key" element={<PokemonDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const { connected, game, source, lastUpdateAt } = useLivingDex();
  // Layout sits outside <Routes>, so useParams won't see :game. Parse the URL directly.
  const location = useLocation();
  const routeStem = location.pathname.split("/")[1] || undefined;
  useEffect(() => {
    const root = document.documentElement;
    // Route stem wins — user is explicitly viewing that game's page.
    // Fall back to the connected cart so the global index still themes to whatever's running.
    const stem =
      (routeStem && isGameStem(routeStem) ? routeStem : undefined) ??
      (game ? CODE_TO_STEM[game.code] : undefined);
    if (stem) root.setAttribute("data-game", stem);
    else root.removeAttribute("data-game");
  }, [game, routeStem]);
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <h1 style={{ margin: 0, marginRight: "auto" }}>
          <Link
            to="/"
            style={{
              color: "inherit",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Pokeball size={26} />
            <span>Living Dex</span>
          </Link>
        </h1>
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
        <ThemeToggle />
      </header>
      {children}
    </main>
  );
}
