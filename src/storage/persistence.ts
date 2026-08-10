/**
 * Saves the single in-progress game to localStorage.
 *
 * Written after every change so a locked or crashed phone never loses a round.
 * This is the one place data crosses back into the program from outside, and
 * TypeScript types are erased at runtime, so the load path validates shape
 * rather than trusting it.
 */

import type { Entry, Game, Player, Round } from "../domain/types";

const STORAGE_KEY = "oh-heck.game";
const SCHEMA_VERSION = 1;

interface Envelope {
  version: number;
  game: Game;
}

export function saveGame(game: Game): void {
  try {
    const envelope: Envelope = { version: SCHEMA_VERSION, game };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Storage can be unavailable (private browsing, quota). Losing autosave is
    // better than crashing mid-game; the export screen is the real backstop.
  }
}

export function clearGame(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing useful to do if storage is unavailable.
  }
}

export function loadGame(): Game | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== SCHEMA_VERSION) return null;
    return asGame(parsed.game);
  } catch {
    return null;
  }
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

/** Returns null on anything unexpected, which resets the app to a clean setup. */
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
