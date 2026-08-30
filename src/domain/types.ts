/**
 * Core data model for an Oh Heck game.
 *
 * Mirrors the shape used by the oh-heck-scoresheets OCR project
 * (src/oh_heck_scoresheets/schema.py) so both tools export identical CSV.
 * The one addition is the dealer, which the paper scoresheet only implies
 * but which we need for the hook rule and the forced-burn cue.
 */

/** One player, seated in a fixed position for the whole game. */
export interface Player {
  id: string;
  /** Name as it would be written on the sheet. Free text: "Milly/JJ" is valid. */
  name: string;
  /** 1-based seat, left to right, matching the scoresheet's column order. */
  position: number;
}

/** One player's result for one round. */
export interface Entry {
  bid: number;
  taken: number;
  /**
   * Whether the player was forced off the bid they wanted by the hook rule.
   * Manually flagged: the real sheets mark this by the scorekeeper's judgment,
   * not by a condition that can be derived from the numbers.
   */
  forcedBurn: boolean;
}

/** One completed round (called a "hand" in the CSV export). */
export interface Round {
  /** 1-based. */
  handNumber: number;
  cardsDealt: number;
  dealerId: string;
  /** Keyed by player id. Every player in the game has an entry. */
  entries: Record<string, Entry>;
}

/** A single game, from setup through export. */
export interface Game {
  id: string;
  /** Optional label written at the top of the paper sheet, e.g. "#50". */
  gameNumber: number | null;
  /** ISO YYYY-MM-DD. */
  gameDate: string;
  players: Player[];
  /** Cards dealt per round, e.g. [7,6,5,4,3,2,1,2,3,4,5,6,7]. */
  cardsSequence: number[];
  /** Player who deals round 1. Rotates one seat per round after that. */
  startingDealerId: string;
  /** Completed rounds only, in order. */
  rounds: Round[];
  /** Game-level notes, in the order they were added. */
  notes: string[];
}
