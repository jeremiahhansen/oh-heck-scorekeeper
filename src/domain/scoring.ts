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
  /** 1-based placing. Ties share the lower number. */
  rank: number;
}

/**
 * Players ranked by score, highest first.
 *
 * This matches how placings are marked at the top of the paper sheet, which
 * are purely a function of the final totals.
 */
export function standings(game: Game): Standing[] {
  const totals = runningTotals(game);
  const sorted = playersInSeatOrder(game)
    .map((player) => ({ player, total: totals[player.id] ?? 0 }))
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
