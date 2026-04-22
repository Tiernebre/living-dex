// RTC-driven daily event helpers for R/S/E.
//
// All logic lifted from pokeruby/src (same engine used for Sapphire rev 2):
//   - Shoal Cave tides: time_events.c `sub_80…` tide[24] table
//   - Lottery: lottery_corner.c GetMatchingDigits + sLotteryPrizes

import type { DecodedPokemon, SaveInfo } from "../../hub/protocol.ts";
import { lookup } from "./data";
import { formatSpeciesName } from "./format";

// tide[hour] from pokeruby/src/time_events.c. 1 = FLAG_SYS_SHOAL_TIDE set
// (high tide), 0 = low tide. Low tide is what players want — inner Shoal
// rooms become accessible, shoal salt/shell items respawn.
const SHOAL_TIDE_HIGH: boolean[] = [
  true, true, true,                         // 00-02
  false, false, false, false, false, false, // 03-08  low
  true, true, true, true, true, true,       // 09-14
  false, false, false, false, false, false, // 15-20  low
  true, true, true,                         // 21-23
];

export function shoalTideState(hour: number): "low" | "high" {
  return SHOAL_TIDE_HIGH[((hour % 24) + 24) % 24] ? "high" : "low";
}

// Hours until the tide flips. 0 would mean "flips in <1 hour"; we return 1..6.
export function hoursUntilTideFlip(hour: number): number {
  const now = shoalTideState(hour);
  for (let i = 1; i <= 24; i++) {
    if (shoalTideState(hour + i) !== now) return i;
  }
  return 24;
}

// pokeruby/src/lottery_corner.c:GetMatchingDigits — compares the right-most
// digits of winNumber (u16) and otId (u16) until one mismatches.
function matchingDigits(winNumber: number, otId: number): number {
  let a = winNumber & 0xFFFF;
  let b = otId & 0xFFFF;
  let n = 0;
  for (let i = 0; i < 5; i++) {
    if (a % 10 !== b % 10) break;
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
    n++;
  }
  return n;
}

// sLotteryPrizes[numMatchingDigits - 2]. No prize for <2 matches.
const LOTTERY_PRIZES = ["PP Up", "Exp. Share", "Max Revive", "Master Ball"];

export type LotteryMatch = {
  digits: number;       // 2..5
  prize: string;
  mon: DecodedPokemon;
  location: "party" | "pc";
  boxIndex?: number;
  slotIndex?: number;
  partySlot?: number;
};

// Scans party + all boxes for the highest-matching mon against today's
// number. Mirrors PickLotteryCornerTicket exactly.
export function bestLotteryMatch(
  lotteryRnd: number,
  saveInfo: SaveInfo,
): LotteryMatch | null {
  const winNumber = lotteryRnd & 0xFFFF;
  let best: LotteryMatch | null = null;
  const consider = (
    mon: DecodedPokemon,
    loc: LotteryMatch["location"],
    extra: Partial<LotteryMatch>,
  ) => {
    if (mon.isEgg) return;
    const d = matchingDigits(winNumber, mon.otId);
    if (d < 2) return;
    if (best && d <= best.digits) return;
    best = {
      digits: d,
      prize: LOTTERY_PRIZES[d - 2] ?? "?",
      mon,
      location: loc,
      ...extra,
    };
  };
  saveInfo.party.forEach((m, i) => m && consider(m, "party", { partySlot: i }));
  saveInfo.boxes.forEach((box, b) =>
    box.slots.forEach(
      (m, s) => m && consider(m, "pc", { boxIndex: b, slotIndex: s }),
    )
  );
  return best;
}

export function lotteryMonName(mon: DecodedPokemon): string {
  return mon.nickname || formatSpeciesName(lookup(mon.species)?.name ?? "?");
}
