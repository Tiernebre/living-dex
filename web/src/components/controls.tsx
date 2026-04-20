import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("living-dex:theme") as Theme | null) ?? "system";
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    localStorage.setItem("living-dex:theme", theme);
  }, [theme]);
  const cycle = () => setTheme((t) => (t === "system" ? "light" : t === "light" ? "dark" : "system"));
  const label = theme === "system" ? "Auto" : theme === "dark" ? "Dark" : "Light";
  const icon = theme === "system" ? "🌓" : theme === "dark" ? "🌙" : "☀️";
  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${label} (click to cycle)`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: "var(--bg-surface)",
        color: "var(--text-muted)",
        border: "1px solid var(--border)",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </button>
  );
}

type Tab = { id: string; label: string; content: React.ReactNode };

export function Tabs({
  tabs,
  initial,
  storageKey,
}: {
  tabs: Tab[];
  initial: string;
  storageKey?: string;
}) {
  const [active, setActive] = useState(() => {
    if (!storageKey) return initial;
    const saved = localStorage.getItem(storageKey);
    if (saved && tabs.some((t) => t.id === saved)) return saved;
    return initial;
  });
  const select = (id: string) => {
    setActive(id);
    if (storageKey) localStorage.setItem(storageKey, id);
  };
  return (
    <div style={{ marginTop: 24 }}>
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--border)",
          marginBottom: 16,
        }}
      >
        {tabs.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              onClick={() => select(t.id)}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: selected ? "2px solid var(--accent)" : "2px solid transparent",
                padding: "8px 14px",
                marginBottom: -1,
                fontSize: 14,
                fontWeight: selected ? 600 : 500,
                color: selected ? "var(--accent-strong)" : "var(--text-muted)",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.find((t) => t.id === active)?.content}
    </div>
  );
}

export type Mode = "live" | "saved";

export function ModeToggle({
  mode,
  setMode,
  connected,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  connected: boolean;
}) {
  const opts: { id: Mode; label: string; icon: string }[] = [
    { id: "saved", label: "Saved", icon: "💾" },
    { id: "live", label: "Live", icon: "⚡" },
  ];
  return (
    <div
      role="tablist"
      style={{
        display: "inline-flex",
        padding: 3,
        borderRadius: 999,
        background: "var(--bg-muted)",
        border: "1px solid var(--border)",
        gap: 2,
      }}
    >
      {opts.map((o) => {
        const selected = o.id === mode;
        const liveDot = o.id === "live" && connected;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={selected}
            onClick={() => setMode(o.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 14px",
              borderRadius: 999,
              border: "none",
              background: selected ? "var(--bg-surface)" : "transparent",
              color: selected ? "var(--accent-strong)" : "var(--text-muted)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: selected ? "0 1px 2px rgba(0,0,0,0.08)" : undefined,
            }}
          >
            <span aria-hidden>{o.icon}</span>
            {o.label}
            {liveDot && (
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
          </button>
        );
      })}
    </div>
  );
}
