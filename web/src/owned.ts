import type { DecodedPokemon, GameStem, SaveInfo } from "../../hub/protocol.ts";
import { hoennDex, lookup } from "./data";
import { pokemonKey } from "./format";

export type OwnedLocation =
  | { kind: "party"; slot: number }
  | { kind: "box"; boxIndex: number; boxName: string; slotIndex: number };

export type OwnedMon = { mon: DecodedPokemon; location: OwnedLocation };

export function collectOwned(saveInfo: SaveInfo | null): Map<number, OwnedMon[]> {
  const byNational = new Map<number, OwnedMon[]>();
  const push = (mon: DecodedPokemon, location: OwnedLocation) => {
    const info = lookup(mon.species);
    if (!info) return;
    const list = byNational.get(info.nationalDex) ?? [];
    list.push({ mon, location });
    byNational.set(info.nationalDex, list);
  };
  if (!saveInfo) return byNational;
  saveInfo.party.forEach((mon, slot) => {
    if (mon) push(mon, { kind: "party", slot });
  });
  saveInfo.boxes.forEach((box, boxIndex) => {
    box.slots.forEach((mon, slotIndex) => {
      if (mon) push(mon, { kind: "box", boxIndex, boxName: box.name, slotIndex });
    });
  });
  return byNational;
}

export function locationLabel(loc: OwnedLocation): string {
  if (loc.kind === "party") return `Party · slot ${loc.slot + 1}`;
  return `${loc.boxName} · slot ${loc.slotIndex + 1}`;
}

export function countBoxMons(saveInfo: SaveInfo): number {
  let n = 0;
  for (const box of saveInfo.boxes) for (const m of box.slots) if (m) n++;
  return n;
}

export function countOwnedSpecies(saveInfo: SaveInfo): Set<number> {
  const set = new Set<number>();
  const push = (mon: DecodedPokemon | null) => {
    if (!mon) return;
    const info = lookup(mon.species);
    if (info) set.add(info.nationalDex);
  };
  saveInfo.party.forEach(push);
  saveInfo.boxes.forEach((b) => b.slots.forEach(push));
  return set;
}

export type OwnedInSave = {
  stem: GameStem;
  saveInfo: SaveInfo;
  mon: DecodedPokemon;
  location: OwnedLocation;
};

// Scan every loaded save for this PID+OTID. A Pokémon's PID and OTID are
// preserved across trades/transfers, so the same pair in two saves means the
// same mon (or a clone produced via the box trick). Newest `savedAtMs` first —
// the most recent save is treated as the "current" instance.
export function findAllOwnedByKey(
  saves: Partial<Record<GameStem, SaveInfo>>,
  key: string,
): OwnedInSave[] {
  const hits: OwnedInSave[] = [];
  for (const [stem, saveInfo] of Object.entries(saves) as [GameStem, SaveInfo][]) {
    if (!saveInfo) continue;
    const hit = findOwnedByKey(saveInfo, key);
    if (hit) hits.push({ stem, saveInfo, mon: hit.mon, location: hit.location });
  }
  hits.sort((a, b) => b.saveInfo.savedAtMs - a.saveInfo.savedAtMs);
  return hits;
}

export function findOwnedByKey(saveInfo: SaveInfo, key: string): OwnedMon | null {
  const scan = (
    mon: DecodedPokemon | null,
    location: OwnedLocation,
  ): OwnedMon | null => (mon && pokemonKey(mon) === key ? { mon, location } : null);

  for (let i = 0; i < saveInfo.party.length; i++) {
    const hit = scan(saveInfo.party[i], { kind: "party", slot: i });
    if (hit) return hit;
  }
  for (let b = 0; b < saveInfo.boxes.length; b++) {
    const box = saveInfo.boxes[b];
    for (let i = 0; i < box.slots.length; i++) {
      const hit = scan(box.slots[i], {
        kind: "box",
        boxIndex: b,
        boxName: box.name,
        slotIndex: i,
      });
      if (hit) return hit;
    }
  }
  return null;
}

// Mirror of pokeruby/src/trainer_card.c TrainerCard_GetStarCount.
// Stars: HoF cleared, Hoenn dex completed, Battle Tower 50+ streak, >4 museum paintings.
export type TrainerStar = {
  label: string;
  detail: string;
  earned: boolean;
  // null when we can't yet read the underlying stat from the save.
  unknown?: boolean;
};

export function trainerStarsBreakdown(saveInfo: SaveInfo | null): TrainerStar[] {
  if (!saveInfo) {
    return [
      { label: "Hall of Fame", detail: "Beat the Elite Four", earned: false, unknown: true },
      { label: "Hoenn Dex", detail: "Catch all 200 Hoenn Pokémon", earned: false, unknown: true },
      { label: "Battle Tower", detail: "50-win streak in the Battle Tower", earned: false, unknown: true },
      { label: "Contests", detail: "5+ paintings in the Lilycove museum", earned: false, unknown: true },
    ];
  }
  const dexSet = new Set(saveInfo.pokedexOwned);
  // Mirrors pokeruby's CompletedHoennPokedex: only Hoenn dex #1..200 are required.
  // Jirachi (#201) and Deoxys (#202) are event-only and don't count toward the star.
  const hoennDone = hoennDex
    .filter((e) => e.hoennDex <= 200)
    .every((e) => dexSet.has(e.nationalDex));
  // Mirrors pokeruby/src/trainer_card.c TrainerCard_GetStarCount: star awarded
  // when bestBattleTowerWinStreak > 49.
  const battleTowerDone = saveInfo.battleTowerBestStreak > 49;
  return [
    { label: "Hall of Fame", detail: "Beat the Elite Four", earned: saveInfo.enteredHof },
    { label: "Hoenn Dex", detail: "Catch all 200 main Hoenn Pokémon (Jirachi/Deoxys not required)", earned: hoennDone },
    {
      label: "Battle Tower",
      detail: `50-win streak in the Battle Tower (best: ${saveInfo.battleTowerBestStreak})`,
      earned: battleTowerDone,
    },
    { label: "Contests", detail: "5+ paintings in the Lilycove museum", earned: false, unknown: true },
  ];
}
