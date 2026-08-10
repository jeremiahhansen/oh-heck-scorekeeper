/**
 * CSV export, byte-compatible with the oh-heck-scoresheets reference output
 * (see samples/sample1_input.csv and samples/all.csv in that project).
 *
 * Rows are ordered by player position, then hand number, matching
 * scoresheet_to_rows() there.
 */

import { handScore, handStatus } from "./scoring";
import { playersInSeatOrder } from "./rules";
import type { Game } from "./types";

/** Column order is part of the contract with the downstream analysis. */
export const CSV_COLUMNS = [
  "Game Number",
  "Game Date",
  "Player Name",
  "Player Position",
  "Hand Number",
  "Cards Dealt",
  "Tricks Bid",
  "Tricks Taken",
  "Forced Burn Flag",
  "Hand Status",
  "Hand Score",
] as const;

/**
 * The OCR tool prefixes a "Source File" column so rows can be traced back to a
 * photographed sheet. There is no source image here, so it is omitted by
 * default; enable this to concatenate our output with the OCR tool's.
 */
export const SOURCE_FILE_COLUMN = "Source File";

export interface CsvOptions {
  includeSourceFile?: boolean;
  /** Value for the Source File column. Ignored unless includeSourceFile. */
  sourceFile?: string;
}

export function gameToRows(game: Game, options: CsvOptions = {}): string[][] {
  const rows: string[][] = [];
  const gameNumber = game.gameNumber === null ? "" : String(game.gameNumber);

  for (const player of playersInSeatOrder(game)) {
    for (const round of game.rounds) {
      const entry = round.entries[player.id];
      if (!entry) continue;
      const row = [
        gameNumber,
        game.gameDate,
        player.name,
        String(player.position),
        String(round.handNumber),
        String(round.cardsDealt),
        String(entry.bid),
        String(entry.taken),
        entry.forcedBurn ? "Yes" : "No",
        handStatus(entry.bid, entry.taken),
        String(handScore(entry.bid, entry.taken)),
      ];
      rows.push(options.includeSourceFile ? [options.sourceFile ?? "", ...row] : row);
    }
  }
  return rows;
}

/** Quote a field only when it would otherwise break the row. */
function escapeField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function toLine(fields: string[]): string {
  return fields.map(escapeField).join(",");
}

export function gameToCsv(game: Game, options: CsvOptions = {}): string {
  const header = options.includeSourceFile
    ? [SOURCE_FILE_COLUMN, ...CSV_COLUMNS]
    : [...CSV_COLUMNS];
  const lines = [toLine(header), ...gameToRows(game, options).map(toLine)];
  return `${lines.join("\r\n")}\r\n`;
}

/** e.g. "oh-heck-2024-12-25-game-50.csv" */
export function csvFilename(game: Game): string {
  const parts = ["oh-heck", game.gameDate];
  if (game.gameNumber !== null) parts.push(`game-${game.gameNumber}`);
  return `${parts.join("-")}.csv`;
}
