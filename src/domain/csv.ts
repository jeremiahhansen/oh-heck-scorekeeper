/**
 * CSV export/import, byte-compatible with the oh-heck-scoresheets reference output
 * (see samples/sample1_input.csv and samples/all.csv in that project).
 *
 * Rows are ordered by player position, then hand number, matching
 * scoresheet_to_rows() there.
 */

import { createId } from "./id";
import {
  cardsSequenceFor,
  dealerForRound,
  MAX_PLAYERS,
  MIN_PLAYERS,
  playersInSeatOrder,
} from "./rules";
import { handScore, handStatus } from "./scoring";
import type { Entry, Game, Player, Round } from "./types";

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

export type CsvImportResult = { ok: true; game: Game } | { ok: false; error: string };

/** Split one CSV line into fields, honouring quotes. */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Rebuild a Game from exported CSV text (with or without a Source File column).
 * Dealer isn't in the CSV; defaults to the leftmost seat until ImportGame asks.
 */
export function csvToGame(text: string): CsvImportResult {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return { ok: false, error: "Paste a CSV with a header row and at least one data row." };
  }

  const header = parseCsvLine(lines[0]!);
  const indexes: Partial<Record<(typeof CSV_COLUMNS)[number], number>> = {};
  for (const column of CSV_COLUMNS) {
    const index = header.indexOf(column);
    if (index < 0) {
      return { ok: false, error: `Missing column "${column}".` };
    }
    indexes[column] = index;
  }

  const cell = (fields: string[], column: (typeof CSV_COLUMNS)[number]): string =>
    (fields[indexes[column]!] ?? "").trim();

  type RawRow = {
    gameNumber: string;
    gameDate: string;
    name: string;
    position: number;
    handNumber: number;
    cardsDealt: number;
    bid: number;
    taken: number;
    forcedBurn: boolean;
  };

  const rawRows: RawRow[] = [];
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const fields = parseCsvLine(lines[lineIndex]!);
    const name = cell(fields, "Player Name");
    const gameDate = cell(fields, "Game Date").slice(0, 10);
    const position = Number(cell(fields, "Player Position"));
    const handNumber = Number(cell(fields, "Hand Number"));
    const cardsDealt = Number(cell(fields, "Cards Dealt"));
    const bid = Number(cell(fields, "Tricks Bid"));
    const taken = Number(cell(fields, "Tricks Taken"));
    const forcedRaw = cell(fields, "Forced Burn Flag").toLowerCase();

    if (!name) {
      return { ok: false, error: `Row ${lineIndex + 1}: missing player name.` };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) {
      return { ok: false, error: `Row ${lineIndex + 1}: game date must be YYYY-MM-DD.` };
    }
    if (!Number.isFinite(position) || position < 1) {
      return { ok: false, error: `Row ${lineIndex + 1}: invalid player position.` };
    }
    if (!Number.isFinite(handNumber) || handNumber < 1) {
      return { ok: false, error: `Row ${lineIndex + 1}: invalid hand number.` };
    }
    if (!Number.isFinite(cardsDealt) || cardsDealt < 1) {
      return { ok: false, error: `Row ${lineIndex + 1}: invalid cards dealt.` };
    }
    if (!Number.isFinite(bid) || !Number.isFinite(taken)) {
      return { ok: false, error: `Row ${lineIndex + 1}: bid and taken must be numbers.` };
    }

    rawRows.push({
      gameNumber: cell(fields, "Game Number"),
      gameDate,
      name,
      position,
      handNumber,
      cardsDealt,
      bid,
      taken,
      forcedBurn: forcedRaw === "yes" || forcedRaw === "true" || forcedRaw === "1",
    });
  }

  const gameDate = rawRows[0]!.gameDate;
  if (rawRows.some((row) => row.gameDate !== gameDate)) {
    return { ok: false, error: "All rows must share the same game date." };
  }

  const gameNumberRaw = rawRows[0]!.gameNumber;
  if (rawRows.some((row) => row.gameNumber !== gameNumberRaw)) {
    return { ok: false, error: "All rows must share the same game number." };
  }
  const parsedGameNumber = Number.parseInt(gameNumberRaw, 10);
  const gameNumber =
    gameNumberRaw === "" || !Number.isFinite(parsedGameNumber) ? null : parsedGameNumber;

  const playersByPosition = new Map<number, string>();
  for (const row of rawRows) {
    const existing = playersByPosition.get(row.position);
    if (existing !== undefined && existing !== row.name) {
      return {
        ok: false,
        error: `Position ${row.position} is used for both "${existing}" and "${row.name}".`,
      };
    }
    playersByPosition.set(row.position, row.name);
  }

  const positions = [...playersByPosition.keys()].sort((a, b) => a - b);
  if (positions.length < MIN_PLAYERS || positions.length > MAX_PLAYERS) {
    return {
      ok: false,
      error: `Need between ${MIN_PLAYERS} and ${MAX_PLAYERS} players.`,
    };
  }
  for (let index = 0; index < positions.length; index += 1) {
    if (positions[index] !== index + 1) {
      return { ok: false, error: "Player positions must be consecutive starting at 1." };
    }
  }

  const players: Player[] = positions.map((position) => ({
    id: createId(),
    name: playersByPosition.get(position)!,
    position,
  }));
  const playerIdByName = new Map(players.map((player) => [player.name, player.id]));

  const handNumbers = [...new Set(rawRows.map((row) => row.handNumber))].sort((a, b) => a - b);
  for (let index = 0; index < handNumbers.length; index += 1) {
    if (handNumbers[index] !== index + 1) {
      return { ok: false, error: "Hand numbers must be consecutive starting at 1." };
    }
  }

  const cardsSequence = cardsSequenceFor(players.length);
  if (handNumbers.length > cardsSequence.length) {
    return {
      ok: false,
      error: `Too many rounds for ${players.length} players (max ${cardsSequence.length}).`,
    };
  }

  const rounds: Round[] = [];
  for (const handNumber of handNumbers) {
    const handRows = rawRows.filter((row) => row.handNumber === handNumber);
    const cardsDealt = handRows[0]!.cardsDealt;
    if (handRows.some((row) => row.cardsDealt !== cardsDealt)) {
      return { ok: false, error: `Round ${handNumber}: cards dealt must match on every row.` };
    }
    if (cardsDealt !== cardsSequence[handNumber - 1]) {
      return {
        ok: false,
        error: `Round ${handNumber}: expected ${cardsSequence[handNumber - 1]} cards, got ${cardsDealt}.`,
      };
    }
    if (handRows.length !== players.length) {
      return {
        ok: false,
        error: `Round ${handNumber}: expected a row for every player.`,
      };
    }

    const entries: Record<string, Entry> = {};
    for (const row of handRows) {
      const playerId = playerIdByName.get(row.name);
      if (!playerId) {
        return { ok: false, error: `Unknown player "${row.name}" in round ${handNumber}.` };
      }
      entries[playerId] = {
        bid: row.bid,
        taken: row.taken,
        forcedBurn: row.forcedBurn,
      };
    }

    rounds.push({
      handNumber,
      cardsDealt,
      dealerId: players[0]!.id,
      entries,
    });
  }

  // CSV has no starting-dealer column; ImportGame asks who dealt first and
  // applies it via withStartingDealer. Leftmost is the usual first dealer.
  const leftmostId = players[0]!.id;
  const draft: Game = {
    id: createId(),
    gameNumber,
    gameDate,
    players,
    cardsSequence,
    startingDealerId: leftmostId,
    rounds,
  };

  return {
    ok: true,
    game: withStartingDealer(draft, draft.startingDealerId),
  };
}

/** Set who dealt round 1 and rebuild each round's dealerId from the rotation. */
export function withStartingDealer(game: Game, startingDealerId: string): Game {
  if (!game.players.some((player) => player.id === startingDealerId)) return game;
  const next: Game = { ...game, startingDealerId };
  return {
    ...next,
    rounds: next.rounds.map((round) => {
      const dealer = dealerForRound(next, round.handNumber);
      return { ...round, dealerId: dealer?.id ?? round.dealerId };
    }),
  };
}
