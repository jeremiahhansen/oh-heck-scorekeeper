/**
 * Game rules: how many cards get dealt each round, who deals, what the hook
 * rule forbids, and whether a round is coherent enough to record.
 *
 * Pure functions only. No React, no DOM, no storage.
 */

import type { Entry, Game, Player } from "./types";

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 9;

/** A standard deck. This is what caps the cards dealt in a big game. */
export const DECK_SIZE = 52;

/** House maximum for the top of the sequence, regardless of deck headroom. */
export const MAX_CARDS_PER_HAND = 7;

/** Every game on the reference scoresheets runs 13 rounds. */
export const DEFAULT_ROUNDS = 13;

/**
 * Largest number of cards that can be dealt to every player at once.
 *
 * Capped at MAX_CARDS_PER_HAND, and below that by the deck: 8 players can only
 * be dealt 6 each (48 cards) and 9 players only 5 each (45 cards).
 */
export function maxCardsFor(playerCount: number): number {
  return Math.min(MAX_CARDS_PER_HAND, Math.floor(DECK_SIZE / playerCount));
}

/**
 * Cards dealt per round, derived from the player count.
 *
 * Descends from the max down to 1, climbs back up, then repeats the max
 * symmetrically at both ends until the sequence reaches `rounds` entries.
 *
 *   2-7 players -> 7,6,5,4,3,2,1,2,3,4,5,6,7
 *     8 players -> 6,6,5,4,3,2,1,2,3,4,5,6,6
 *     9 players -> 5,5,5,4,3,2,1,2,3,4,5,5,5
 */
export function cardsSequenceFor(playerCount: number, rounds = DEFAULT_ROUNDS): number[] {
  const maxCards = maxCardsFor(playerCount);
  const down = Array.from({ length: maxCards }, (_, i) => maxCards - i);
  const up = Array.from({ length: maxCards - 1 }, (_, i) => i + 2);
  const core = [...down, ...up];
  const pad = Math.max(0, Math.floor((rounds - core.length) / 2));
  const cap = Array<number>(pad).fill(maxCards);
  return [...cap, ...core, ...cap];
}

/** Players ordered by seat, which is also the scoresheet's column order. */
export function playersInSeatOrder(game: Game): Player[] {
  return [...game.players].sort((a, b) => a.position - b.position);
}

/**
 * Who deals round `handNumber` (1-based).
 *
 * The starting dealer deals round 1, then the deal moves one seat per round.
 * Returns null only if the game has no players or an unknown starting dealer.
 */
export function dealerForRound(game: Game, handNumber: number): Player | null {
  const seated = playersInSeatOrder(game);
  if (seated.length === 0) return null;
  const startIndex = seated.findIndex((p) => p.id === game.startingDealerId);
  if (startIndex < 0) return null;
  const offset = (startIndex + handNumber - 1) % seated.length;
  return seated[offset];
}

/**
 * Players in the order they bid: the dealer's left-hand neighbour first, the
 * dealer last. Seat order is preserved, just rotated, so the same faces stay in
 * the same relative order from round to round.
 *
 * Falls back to seat order when the dealer can't be determined.
 */
export function playersInBiddingOrder(game: Game, handNumber: number): Player[] {
  const seated = playersInSeatOrder(game);
  const dealer = dealerForRound(game, handNumber);
  if (!dealer) return seated;
  const dealerIndex = seated.findIndex((player) => player.id === dealer.id);
  if (dealerIndex < 0) return seated;
  return [...seated.slice(dealerIndex + 1), ...seated.slice(0, dealerIndex + 1)];
}

/**
 * The single bid the dealer is not allowed to make, because it would leave the
 * table's bids summing exactly to the cards dealt.
 *
 * Returns null when the other players have already over- or under-bid far
 * enough that no legal bid is blocked.
 */
export function forbiddenDealerBid(cardsDealt: number, otherBidsTotal: number): number | null {
  const forbidden = cardsDealt - otherBidsTotal;
  if (forbidden < 0 || forbidden > cardsDealt) return null;
  return forbidden;
}

/**
 * Codes let the UI decide when each problem is worth showing, without matching
 * on message text.
 */
export type RoundProblemCode = "out-of-range" | "bid-total" | "taken-total";

export interface RoundProblem {
  code: RoundProblemCode;
  message: string;
}

export interface RoundValidation {
  /** Everything that must be fixed before the round can be recorded. */
  problems: RoundProblem[];
  canRecord: boolean;
  bidTotal: number;
  takenTotal: number;
}

/**
 * Check one round's entries. Every problem blocks recording.
 *
 * The tricks played in a round always add up to the cards dealt, and the hook
 * rule means the bids never can, so either total being wrong is a data-entry
 * mistake rather than something to record faithfully.
 */
export function validateRound(cardsDealt: number, entries: Entry[]): RoundValidation {
  const problems: RoundProblem[] = [];

  const bidTotal = entries.reduce((sum, e) => sum + e.bid, 0);
  const takenTotal = entries.reduce((sum, e) => sum + e.taken, 0);

  const outOfRange = entries.some(
    (e) => e.bid < 0 || e.bid > cardsDealt || e.taken < 0 || e.taken > cardsDealt,
  );
  if (outOfRange) {
    problems.push({
      code: "out-of-range",
      message: `Bids and tricks taken must each be between 0 and ${cardsDealt}.`,
    });
  }

  if (bidTotal === cardsDealt) {
    problems.push({ code: "bid-total", message: `The bids can't add up to ${cardsDealt}.` });
  }

  if (takenTotal !== cardsDealt) {
    const diff = takenTotal - cardsDealt;
    problems.push({
      code: "taken-total",
      message:
        diff > 0
          ? `Tricks taken add up to ${takenTotal}, which is ${diff} more than the ${cardsDealt} dealt.`
          : `Tricks taken add up to ${takenTotal}, which is ${-diff} short of the ${cardsDealt} dealt.`,
    });
  }

  return { problems, canRecord: problems.length === 0, bidTotal, takenTotal };
}
