// Shared types between the hub internals and the browser UI.
// Mirrors the Lua envelope framing (see lua/core/envelope.lua).

export const REGION = {
  NONE: 0x00,
  PARTY: 0x01,
  PARTY_SLOT: 0x02,
  BOX: 0x03,
  BOX_SLOT: 0x04,
  ENEMY_PARTY: 0x05,
  DAYCARE: 0x06,
  TRAINER: 0x07,
  DEX: 0x08,
  BATTLE: 0x09,
  LOCATION: 0x0A,
} as const;

export type RegionId = (typeof REGION)[keyof typeof REGION];

export const MSG_TYPE = {
  HELLO: 0x01,
  REGION: 0x02,
  BYE: 0x03,
} as const;

export type Source = "live" | `save@${number}`;

export type GameCode = "AXVE" | "AXPE" | "BPEE" | "BPRE" | "BPGE";

// Filename stem of each .sav/.gba we care about. Each game is unique in this project —
// there is only ever one Ruby, one Emerald, etc. — so the stem also identifies the save.
// "box" = Pokémon Box: Ruby & Sapphire (GameCube). No trainer/party/dex —
// it's just a 50-box PC extension, stored as a .gci memory card file.
export const GAME_STEMS = ["ruby", "sapphire", "emerald", "firered", "leafgreen", "box"] as const;
export type GameStem = (typeof GAME_STEMS)[number];

export type GameInfo = {
  code: GameCode;
  revision: number;
  name: string;
};

// Shape broadcast to the browser over WebSocket. Decoder outputs these.
export type DecodedPokemon = {
  pid: number;
  species: number;
  nickname: string;
  level: number;
  experience: number;
  abilityBit: 0 | 1;
  ivs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  evs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  nature: string;
  moves: { id: number; pp: number }[];
  otName: string;
  otId: number;
  otGender: "male" | "female";
  metLevel: number;
  // Gen 3 map-section id. 0xFD/0xFE/0xFF are special (egg/trade/fateful).
  // Null if metLevel is 0 (hatched via egg before this save) or corrupt.
  metLocation: number | null;
  // Bits 7-10 of origins word. 1=Sapphire, 2=Ruby, 3=Emerald, 4=FireRed, 5=LeafGreen.
  originGame: number;
  isEgg: boolean;
  // Contest conditions (0..255 each) and Sheen (0..255) from the EV/Condition
  // substructure. Raised via Pokéblocks in R/S/E and Poffins-equivalent data
  // doesn't exist here — FR/LG store zeros.
  contest: { cool: number; beauty: number; cute: number; smart: number; tough: number; sheen: number };
  // TODO: ability, hidden power, ribbons, etc.
};

export type BoxEntry = {
  pokemon: DecodedPokemon;
  boxIndex: number; // 0..13
  slotIndex: number; // 0..29
};

export type BoxInfo = {
  name: string;
  slots: (DecodedPokemon | null)[];
};

export type SaveInfo = {
  game: GameStem;
  playerName: string;
  playerGender: "male" | "female";
  trainerId: number;
  playTime: { hours: number; minutes: number; seconds: number; frames: number };
  savedAtMs: number;
  party: (DecodedPokemon | null)[];
  boxes: BoxInfo[];
  currentBox: number;
  // National-dex IDs the player has registered as caught in their in-game Pokédex.
  // Distinct from "owned in storage" — it includes mons evolved/traded away,
  // and excludes mons received but never registered.
  pokedexOwned: number[];
  // gameStats[GAME_STAT_ENTERED_HOF] > 0 — has the player ever beaten the Elite Four.
  // Worth one star on the in-game trainer card.
  enteredHof: boolean;
  // gSaveBlock2.battleTower.bestBattleTowerWinStreak — best-ever Battle Tower
  // streak across both level modes. Trainer card awards a star at >= 50.
  battleTowerBestStreak: number;
  // Hall of Fame teams, oldest-first. Lives in flash sectors 28-29 outside
  // the A/B slot rotation; up to 50 teams of 6 mons. Only the fields the HoF
  // struct actually stores (tid/personality/species/level/nickname) — no
  // IVs, moves, or met-location.
  hallOfFame: HallOfFameTeam[];
  // 20-slot SecretBaseRecord array from SaveBlock1 @ 0x1A08. Slot 0 is the
  // player's own base; 1..19 are mix-records. Empty slots filtered out.
  // R/S only — FR/LG/Emerald layouts differ and aren't handled yet.
  secretBases: SecretBase[];
  // Seed used by the Feebas tile selection on Route 119. Games differ: R/S
  // read a u16 from easyChatPairs[0].unk2; Emerald reads from
  // dewfordTrends[0].rand (same semantics, different SaveBlock1 offset).
  // null for games where the seed isn't parsed yet (FR/LG have no Feebas).
  feebasSeed: number | null;
};

export type HallOfFameMon = {
  species: number;
  level: number;
  nickname: string;
  tid: number;
  personality: number;
};

export type HallOfFameTeam = {
  mons: HallOfFameMon[];
};

// A single mon on a secret-base opponent party. Unlike DecodedPokemon, the
// in-save SecretBaseParty struct only stores species/level/moves/heldItem/
// personality + a shared EV byte applied to every stat at battle-spawn time.
// No IVs, no nickname, no per-stat EVs.
export type SecretBaseTeamMember = {
  species: number;
  level: number;
  heldItem: number;
  moves: number[];
  personality: number;
  ev: number;
};

export type SecretBase = {
  // Player's own base lives in slot 0; slots 1..19 are mix-records from other
  // trainers. Slot 0 has secretBaseId == 0 until the player places their own.
  isPlayer: boolean;
  // 1..84-ish — indexes a specific in-game secret-base spot on the Hoenn map.
  // 0 means "unset"; we filter those out before emitting.
  secretBaseId: number;
  trainerName: string;
  trainerGender: "male" | "female";
  trainerId: number;
  // (trainerId byte 0 % 5) + gender*5. 0..9 — maps to one of 10 gfx/class slots.
  ownerType: number;
  battledOwnerToday: boolean;
  numTimesEntered: number;
  // { id, pos } pairs where id != 0. pos is a packed tile coord (x in high
  // nibble, y in low nibble) but we just store the raw byte.
  decorations: { id: number; pos: number }[];
  // Up to 6 mons; entries where species == 0 are dropped.
  team: SecretBaseTeamMember[];
};

export type HubState = {
  connected: boolean;
  game: GameInfo | null;
  party: (DecodedPokemon | null)[];
  enemyParty: (DecodedPokemon | null)[];
  inBattle: boolean;
  location: { mapGroup: number; mapNum: number } | null;
  currentBox: { index: number; slots: (DecodedPokemon | null)[] } | null;
  source: Source | null;
  lastUpdateAt: number | null;
  saves: Partial<Record<GameStem, SaveInfo>>;
  // First-seen-by-the-app timestamps keyed by `${pid}:${otId}`.
  // Gen 3 saves don't carry a real catch date, so this stands in.
  catchLog: Record<string, number>;
};

export type WsMessage =
  | { type: "snapshot"; state: HubState }
  | { type: "party"; slot: number; pokemon: DecodedPokemon | null; source: Source }
  | { type: "enemy"; slot: number; pokemon: DecodedPokemon | null; source: Source }
  | { type: "box"; index: number; slot: number; pokemon: DecodedPokemon | null; source: Source }
  | { type: "game"; game: GameInfo | null }
  | { type: "connection"; live: boolean }
  | { type: "battle"; inBattle: boolean }
  | { type: "location"; location: { mapGroup: number; mapNum: number } | null }
  | { type: "save"; game: GameStem; saveInfo: SaveInfo | null }
  | { type: "catch-log"; entries: Record<string, number> };
