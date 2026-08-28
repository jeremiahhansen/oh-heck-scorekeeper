/**
 * Scoring. A direct port of oh_heck_scoresheets/csv_writer.py so that scores
 * entered here and scores read off a photographed sheet always agree.
 */

import { playersInSeatOrder } from "./rules";
import type { Game, Player } from "./types";

export type HandStatus = "Made Bid" | "Burn";

/** Made Bid only when the player took exactly what they called. */
export function handStatus(bid: number, taken: number): HandStatus {
  return bid === taken ? "Made Bid" : "Burn";
}

/**
 * Points for one round.
 *
 * Made the bid: 5 plus a point per trick taken.
 * Burned: one negative point per trick missed by, in either direction.
 */
export function handScore(bid: number, taken: number): number {
  if (bid === taken) return 5 + taken;
  return -Math.abs(bid - taken);
}

/** Final score per player id, across every recorded round. */
export function runningTotals(game: Game): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const player of game.players) totals[player.id] = 0;
  for (const round of game.rounds) {
    for (const [playerId, entry] of Object.entries(round.entries)) {
      totals[playerId] = (totals[playerId] ?? 0) + handScore(entry.bid, entry.taken);
    }
  }
  return totals;
}

export interface Standing {
  player: Player;
  total: number;
  /** Hands where tricks taken did not match the bid. */
  burns: number;
  /** 1-based placing. Ties share the lower number. */
  rank: number;
}

/** Burn count per player id across recorded rounds. */
export function burnCounts(game: Game): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const player of game.players) counts[player.id] = 0;
  for (const round of game.rounds) {
    for (const [playerId, entry] of Object.entries(round.entries)) {
      if (entry.bid !== entry.taken) counts[playerId] = (counts[playerId] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Players ranked by score, highest first.
 *
 * Ties share a place and the next place skips ahead (1, 2, 2, 2, 5, …), matching
 * how placings are marked at the top of the paper sheet.
 */
export function standings(game: Game): Standing[] {
  const totals = runningTotals(game);
  const burns = burnCounts(game);
  const sorted = playersInSeatOrder(game)
    .map((player) => ({
      player,
      total: totals[player.id] ?? 0,
      burns: burns[player.id] ?? 0,
    }))
    .sort((a, b) => b.total - a.total || a.player.position - b.player.position);

  let lastTotal: number | null = null;
  let lastRank = 0;
  return sorted.map((row, index) => {
    const rank = lastTotal !== null && row.total === lastTotal ? lastRank : index + 1;
    lastTotal = row.total;
    lastRank = rank;
    return { ...row, rank };
  });
}

/** One player's result in one scorecard cell (null when that round is not recorded). */
export interface ScorecardCell {
  bid: number;
  taken: number;
  /** Points earned this round. */
  score: number;
  /** Cumulative total through this round. */
  runningTotal: number;
  burned: boolean;
}

export interface ScorecardRound {
  handNumber: number;
  cardsDealt: number;
  /** Seat-order cells; null for rounds not yet played. */
  cells: Array<ScorecardCell | null>;
}

export interface ScorecardMatrix {
  players: Player[];
  rounds: ScorecardRound[];
}

/** Players as columns, every sequence round as a row, with running totals. */
export function scorecardMatrix(game: Game): ScorecardMatrix {
  const players = playersInSeatOrder(game);
  const totals: Record<string, number> = {};
  for (const player of players) totals[player.id] = 0;

  const recordedByHand = new Map(game.rounds.map((round) => [round.handNumber, round]));

  const rounds: ScorecardRound[] = game.cardsSequence.map((cardsDealt, index) => {
    const handNumber = index + 1;
    const round = recordedByHand.get(handNumber);
    if (!round) {
      return {
        handNumber,
        cardsDealt,
        cells: players.map(() => null),
      };
    }

    const cells = players.map((player) => {
      const entry = round.entries[player.id];
      if (!entry) return null;
      const score = handScore(entry.bid, entry.taken);
      totals[player.id] = (totals[player.id] ?? 0) + score;
      return {
        bid: entry.bid,
        taken: entry.taken,
        score,
        runningTotal: totals[player.id] ?? 0,
        burned: entry.bid !== entry.taken,
      };
    });

    return { handNumber, cardsDealt, cells };
  });

  return { players, rounds };
}
