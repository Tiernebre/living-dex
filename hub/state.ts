import type { DecodedPokemon, GameInfo, HubState, Source, WsMessage } from "./protocol.ts";

type Subscriber = (msg: WsMessage) => void;

class StateStore {
  private state: HubState = {
    connected: false,
    game: null,
    party: Array(6).fill(null),
    enemyParty: Array(6).fill(null),
    inBattle: false,
    currentBox: null,
    source: null,
    lastUpdateAt: null,
  };
  private subscribers = new Set<Subscriber>();

  snapshot(): HubState {
    return structuredClone(this.state);
  }

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    fn({ type: "snapshot", state: this.snapshot() });
    return () => this.subscribers.delete(fn);
  }

  private broadcast(msg: WsMessage) {
    for (const fn of this.subscribers) {
      try {
        fn(msg);
      } catch (err) {
        console.error("[state] subscriber threw:", err);
      }
    }
  }

  setGame(game: GameInfo | null) {
    this.state.game = game;
    this.broadcast({ type: "game", game });
  }

  setLiveConnected(live: boolean) {
    this.state.connected = live;
    this.broadcast({ type: "connection", live });
  }

  setPartySlot(slot: number, pokemon: DecodedPokemon | null, source: Source) {
    this.state.party[slot] = pokemon;
    this.state.source = source;
    this.state.lastUpdateAt = Date.now();
    this.broadcast({ type: "party", slot, pokemon, source });
  }

  setEnemySlot(slot: number, pokemon: DecodedPokemon | null, source: Source) {
    this.state.enemyParty[slot] = pokemon;
    this.state.source = source;
    this.state.lastUpdateAt = Date.now();
    this.broadcast({ type: "enemy", slot, pokemon, source });
  }

  setInBattle(inBattle: boolean) {
    if (this.state.inBattle === inBattle) return;
    this.state.inBattle = inBattle;
    if (!inBattle) {
      this.state.enemyParty = Array(6).fill(null);
    }
    this.broadcast({ type: "battle", inBattle });
  }

  setBoxSlot(index: number, slot: number, pokemon: DecodedPokemon | null, source: Source) {
    if (!this.state.currentBox || this.state.currentBox.index !== index) {
      this.state.currentBox = { index, slots: Array(30).fill(null) };
    }
    this.state.currentBox.slots[slot] = pokemon;
    this.state.source = source;
    this.state.lastUpdateAt = Date.now();
    this.broadcast({ type: "box", index, slot, pokemon, source });
  }
}

export const store = new StateStore();
