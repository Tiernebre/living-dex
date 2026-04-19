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
} as const;

export type RegionId = (typeof REGION)[keyof typeof REGION];

export const MSG_TYPE = {
  HELLO: 0x01,
  REGION: 0x02,
  BYE: 0x03,
} as const;

export type Source = "live" | `save@${number}`;

export type GameCode = "AXVE" | "AXPE" | "BPEE" | "BPRE" | "BPGE";

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
  ivs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  evs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  nature: string;
  // TODO: ability, moves, hidden power, ribbons, OT info, etc.
};

export type HubState = {
  connected: boolean;
  game: GameInfo | null;
  party: (DecodedPokemon | null)[];
  enemyParty: (DecodedPokemon | null)[];
  currentBox: { index: number; slots: (DecodedPokemon | null)[] } | null;
  source: Source | null;
  lastUpdateAt: number | null;
};

export type WsMessage =
  | { type: "snapshot"; state: HubState }
  | { type: "party"; slot: number; pokemon: DecodedPokemon | null; source: Source }
  | { type: "enemy"; slot: number; pokemon: DecodedPokemon | null; source: Source }
  | { type: "box"; index: number; slot: number; pokemon: DecodedPokemon | null; source: Source }
  | { type: "game"; game: GameInfo | null }
  | { type: "connection"; live: boolean };
