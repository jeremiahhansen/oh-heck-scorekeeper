/**
 * Saves every game to localStorage as a multi-game archive.
 *
 * Written after every change so a locked or crashed phone never loses a round.
 * This is the one place data crosses back into the program from outside, and
 * TypeScript types are erased at runtime, so the load path validates shape
 * rather than trusting it.
 */

import type { Entry, Game, Player, Round } from "../domain/types";

const STORAGE_KEY = "oh-heck.games";
const SCHEMA_VERSION = 1;

export interface GameStore {
  version: number;
  games: Game[];
  activeGameId: string | null;
}

function emptyStore(): GameStore {
  return { version: SCHEMA_VERSION, games: [], activeGameId: null };
}

export function saveStore(store: GameStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage can be unavailable (private browsing, quota). Losing autosave is
    // better than crashing mid-game; the export screen is the real backstop.
  }
}

export function loadStore(): GameStore {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return emptyStore();
  }
  if (!raw) return emptyStore();

  try {
    const parsed: unknown = JSON.parse(raw);
    return asStore(parsed) ?? emptyStore();
  } catch {
    return emptyStore();
  }
}

/** Insert or replace by id, move it to the front, and mark it active. */
export function upsertGame(game: Game): GameStore {
  const store = loadStore();
  const games = [game, ...store.games.filter((existing) => existing.id !== game.id)];
  const next: GameStore = { version: SCHEMA_VERSION, games, activeGameId: game.id };
  saveStore(next);
  return next;
}

export function deleteGame(id: string): GameStore {
  const store = loadStore();
  const games = store.games.filter((game) => game.id !== id);
  const next: GameStore = {
    version: SCHEMA_VERSION,
    games,
    activeGameId: store.activeGameId === id ? null : store.activeGameId,
  };
  saveStore(next);
  return next;
}

export function setActiveGameId(id: string | null): GameStore {
  const store = loadStore();
  const next: GameStore = { ...store, activeGameId: id };
  saveStore(next);
  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function asPlayer(value: unknown): Player | null {
  if (!isRecord(value)) return null;
  const { id, name, position } = value;
  if (typeof id !== "string" || typeof name !== "string" || !isFiniteNumber(position)) return null;
  return { id, name, position };
}

function asEntry(value: unknown): Entry | null {
  if (!isRecord(value)) return null;
  const { bid, taken, forcedBurn } = value;
  if (!isFiniteNumber(bid) || !isFiniteNumber(taken)) return null;
  return { bid, taken, forcedBurn: forcedBurn === true };
}

function asRound(value: unknown): Round | null {
  if (!isRecord(value)) return null;
  const { handNumber, cardsDealt, dealerId, entries } = value;
  if (!isFiniteNumber(handNumber) || !isFiniteNumber(cardsDealt)) return null;
  if (typeof dealerId !== "string" || !isRecord(entries)) return null;

  const parsedEntries: Record<string, Entry> = {};
  for (const [playerId, rawEntry] of Object.entries(entries)) {
    const entry = asEntry(rawEntry);
    if (!entry) return null;
    parsedEntries[playerId] = entry;
  }
  return { handNumber, cardsDealt, dealerId, entries: parsedEntries };
}

/** Returns null on anything unexpected. */
function asGame(value: unknown): Game | null {
  if (!isRecord(value)) return null;
  const { id, gameNumber, gameDate, players, cardsSequence, startingDealerId, rounds } = value;

  if (typeof id !== "string" || typeof gameDate !== "string") return null;
  if (typeof startingDealerId !== "string") return null;
  if (gameNumber !== null && !isFiniteNumber(gameNumber)) return null;
  if (!Array.isArray(players) || !Array.isArray(cardsSequence) || !Array.isArray(rounds)) {
    return null;
  }
  if (!cardsSequence.every(isFiniteNumber)) return null;

  const parsedPlayers: Player[] = [];
  for (const rawPlayer of players) {
    const player = asPlayer(rawPlayer);
    if (!player) return null;
    parsedPlayers.push(player);
  }
  if (parsedPlayers.length === 0) return null;

  const parsedRounds: Round[] = [];
  for (const rawRound of rounds) {
    const round = asRound(rawRound);
    if (!round) return null;
    parsedRounds.push(round);
  }

  return {
    id,
    gameNumber: gameNumber as number | null,
    gameDate,
    players: parsedPlayers,
    cardsSequence: cardsSequence as number[],
    startingDealerId,
    rounds: parsedRounds,
  };
}

function asStore(value: unknown): GameStore | null {
  if (!isRecord(value) || value.version !== SCHEMA_VERSION) return null;
  if (!Array.isArray(value.games)) return null;
  if (value.activeGameId !== null && typeof value.activeGameId !== "string") return null;

  const games: Game[] = [];
  for (const rawGame of value.games) {
    const game = asGame(rawGame);
    if (!game) return null;
    games.push(game);
  }

  const activeGameId = value.activeGameId as string | null;
  if (activeGameId !== null && !games.some((game) => game.id === activeGameId)) {
    return { version: SCHEMA_VERSION, games, activeGameId: null };
  }

  return { version: SCHEMA_VERSION, games, activeGameId };
}
