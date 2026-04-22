import type { SaveInfo } from "../../../hub/protocol.ts";
import {
  bestLotteryMatch,
  hoursUntilTideFlip,
  lotteryMonName,
  shoalTideState,
} from "../daily-events";

type Props = {
  saveInfo: SaveInfo;
  localTime: { days: number; hours: number; minutes: number; seconds: number } | null;
  tint: string;
};

export function DailyEventsCard({ saveInfo, localTime, tint }: Props) {
  if (!localTime) return null;
  const hour = localTime.hours;
  const tide = shoalTideState(hour);
  const flipIn = hoursUntilTideFlip(hour);
  const lottery = saveInfo.lotteryRnd !== null
    ? bestLotteryMatch(saveInfo.lotteryRnd, saveInfo)
    : null;
  const winNumber = saveInfo.lotteryRnd !== null
    ? String(saveInfo.lotteryRnd & 0xFFFF).padStart(5, "0")
    : null;

  return (
    <section
      style={{
        position: "relative",
        padding: "14px 16px 14px 22px",
        borderRadius: 12,
        border: `1px solid color-mix(in srgb, ${tint} 35%, var(--border))`,
        background:
          `linear-gradient(135deg, color-mix(in srgb, ${tint} 12%, var(--bg-surface)), var(--bg-surface) 75%)`,
        marginBottom: 16,
        overflow: "hidden",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 5,
          background: tint,
        }}
      />
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 18 }} aria-hidden>📅</span>
        <h3
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: 0.3,
            color: `color-mix(in srgb, ${tint} 80%, var(--text))`,
          }}
        >
          Daily Events
        </h3>
        <span style={{ fontSize: 11, opacity: 0.55, marginLeft: "auto" }}>
          In-game Day {localTime.days} · {String(localTime.hours).padStart(2, "0")}:
          {String(localTime.minutes).padStart(2, "0")}
        </span>
      </header>

      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
        <EventRow
          icon={tide === "low" ? "🐚" : "🌊"}
          title={tide === "low" ? "Shoal Cave — LOW TIDE" : "Shoal Cave — high tide"}
          highlight={tide === "low"}
          tint={tint}
        >
          {tide === "low"
            ? `Inner rooms accessible. Shoal salt + shells respawning. Flips to high tide in ~${flipIn}h.`
            : `Inner rooms sealed. Low tide returns in ~${flipIn}h.`}
        </EventRow>

        {saveInfo.lotteryRnd !== null && (
          <EventRow
            icon="🎟️"
            title={
              lottery
                ? `Lottery — ${lottery.prize} waiting`
                : "Lottery — no match today"
            }
            highlight={lottery !== null && lottery.digits >= 3}
            tint={tint}
          >
            <div style={{ fontSize: 12 }}>
              Today's number:{" "}
              <strong style={{ fontVariantNumeric: "tabular-nums" }}>{winNumber}</strong>
            </div>
            {lottery ? (
              <div style={{ fontSize: 12, marginTop: 2 }}>
                Best match: <strong>{lotteryMonName(lottery.mon)}</strong>{" "}
                <span style={{ opacity: 0.65 }}>
                  ({lottery.digits} digit{lottery.digits === 1 ? "" : "s"}
                  {lottery.location === "party"
                    ? `, party slot ${(lottery.partySlot ?? 0) + 1}`
                    : `, box ${(lottery.boxIndex ?? 0) + 1} slot ${(lottery.slotIndex ?? 0) + 1}`}
                  )
                </span>{" "}
                — head to Lilycove Pokémon Lottery Corner.
              </div>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                No mon's OT ID shares ≥2 ending digits with today's number. Check
                back tomorrow — the number re-rolls at midnight.
              </div>
            )}
          </EventRow>
        )}
      </ul>
    </section>
  );
}

function EventRow({
  icon,
  title,
  children,
  highlight,
  tint,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
  highlight: boolean;
  tint: string;
}) {
  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "24px 1fr",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 8,
        background: highlight
          ? `color-mix(in srgb, ${tint} 18%, transparent)`
          : "color-mix(in srgb, var(--text) 4%, transparent)",
        border: highlight
          ? `1px solid color-mix(in srgb, ${tint} 50%, transparent)`
          : "1px solid transparent",
      }}
    >
      <span style={{ fontSize: 18, lineHeight: "24px" }} aria-hidden>
        {icon}
      </span>
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 2,
            color: highlight ? `color-mix(in srgb, ${tint} 85%, var(--text))` : undefined,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 12, opacity: 0.9 }}>{children}</div>
      </div>
    </li>
  );
}
