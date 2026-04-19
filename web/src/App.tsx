import { useLivingDex } from "./store";

export function App() {
  const { connected, game, party, source, lastUpdateAt } = useLivingDex();
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <h1>Living Dex</h1>
      <p>
        <strong>mGBA:</strong> {connected ? "connected" : "disconnected"}
        {game && ` — ${game.name} (rev ${game.revision})`}
      </p>
      <p>
        <strong>Source:</strong> {source ?? "none"}
        {lastUpdateAt && ` — updated ${new Date(lastUpdateAt).toLocaleTimeString()}`}
      </p>
      <h2>Party</h2>
      <ol>
        {party.map((mon, i) => (
          <li key={i}>{mon ? `${mon.nickname} (species ${mon.species}) Lv ${mon.level}` : "—"}</li>
        ))}
      </ol>
    </main>
  );
}
