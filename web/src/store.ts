import { create } from "zustand";
import type { HubState, WsMessage } from "../../hub/protocol.ts";

type Actions = {
  apply: (msg: WsMessage) => void;
};

const initial: HubState = {
  connected: false,
  game: null,
  party: Array(6).fill(null),
  enemyParty: Array(6).fill(null),
  inBattle: false,
  location: null,
  currentBox: null,
  source: null,
  lastUpdateAt: null,
};

export const useLivingDex = create<HubState & Actions>((set) => ({
  ...initial,
  apply: (msg) =>
    set((s) => {
      switch (msg.type) {
        case "snapshot":
          return { ...s, ...msg.state };
        case "connection":
          return { ...s, connected: msg.live };
        case "battle":
          return {
            ...s,
            inBattle: msg.inBattle,
            enemyParty: msg.inBattle ? s.enemyParty : Array(6).fill(null),
          };
        case "game":
          return { ...s, game: msg.game };
        case "location":
          return { ...s, location: msg.location };
        case "party": {
          const party = [...s.party];
          party[msg.slot] = msg.pokemon;
          return { ...s, party, source: msg.source, lastUpdateAt: Date.now() };
        }
        case "enemy": {
          const enemyParty = [...s.enemyParty];
          enemyParty[msg.slot] = msg.pokemon;
          return { ...s, enemyParty, source: msg.source, lastUpdateAt: Date.now() };
        }
        case "box": {
          const currentBox =
            s.currentBox && s.currentBox.index === msg.index
              ? { ...s.currentBox, slots: [...s.currentBox.slots] }
              : { index: msg.index, slots: Array(30).fill(null) };
          currentBox.slots[msg.slot] = msg.pokemon;
          return { ...s, currentBox, source: msg.source, lastUpdateAt: Date.now() };
        }
        default:
          return s;
      }
    }),
}));
