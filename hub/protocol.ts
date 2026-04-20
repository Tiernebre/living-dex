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
export const GAME_STEMS = ["ruby", "sapphire", "emerald", "firered", "leafgreen"] as const;
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
