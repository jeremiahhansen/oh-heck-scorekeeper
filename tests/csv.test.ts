import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CSV_COLUMNS,
  csvFilename,
  csvToGame,
  gameToCsv,
  gameToRows,
  parseCsvLine,
  withStartingDealer,
} from "../src/domain/csv";
import { handScore, handStatus } from "../src/domain/scoring";
import type { Entry, Game, Round } from "../src/domain/types";

/**
 * Reference export produced by the oh-heck-scoresheets project from a
 * photograph of a real 7-player, 13-round scoresheet. Reproducing it exactly
 * is what keeps this app's CSV interchangeable with that tool's.
 */
const FIXTURE = readFileSync(new URL("./fixtures/sample1_input.csv", import.meta.url), "utf8");

/** Adequate for this fixture, which contains no quoted or comma-bearing fields. */
function parseFixture(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  const header = lines[0]!.split(",");
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(header.map((column, index) => [column, cells[index] ?? ""]));
  });
}

const fixtureRows = parseFixture(FIXTURE);

/** Rebuild the Game this app would have produced for that scoresheet. */
function gameFromFixture(rows: Record<string, string>[]): Game {
  const gameDate = rows[0]!["Game Date"]!.slice(0, 10);

  const names = [...new Set(rows.map((row) => row["Player Name"]!))];
  const players = names.map((name) => ({
    id: `p-${name}`,
    name,
    position: Number(rows.find((row) => row["Player Name"] === name)!["Player Position"]),
  }));

  const handNumbers = [...new Set(rows.map((row) => Number(row["Hand Number"])))].sort(
    (a, b) => a - b,
  );

  const rounds: Round[] = handNumbers.map((handNumber) => {
    const handRows = rows.filter((row) => Number(row["Hand Number"]) === handNumber);
    const entries: Record<string, Entry> = {};
    for (const row of handRows) {
      entries[`p-${row["Player Name"]}`] = {
        bid: Number(row["Tricks Bid"]),
        taken: Number(row["Tricks Taken"]),
        forcedBurn: row["Forced Burn Flag"] === "Yes",
      };
    }
    return {
      handNumber,
      cardsDealt: Number(handRows[0]!["Cards Dealt"]),
      // Not recorded on the paper sheet; irrelevant to the CSV.
      dealerId: players[players.length - 1]!.id,
      entries,
    };
  });

  return {
    id: "fixture",
    gameNumber: null,
    gameDate,
    players,
    cardsSequence: rounds.map((round) => round.cardsDealt),
    startingDealerId: players[players.length - 1]!.id,
    rounds,
  };
}

const fixtureGame = gameFromFixture(fixtureRows);

describe("the reference scoresheet", () => {
  it("covers 7 players over 13 rounds", () => {
    expect(fixtureGame.players).toHaveLength(7);
    expect(fixtureGame.rounds).toHaveLength(13);
    expect(fixtureRows).toHaveLength(91);
    expect(fixtureGame.cardsSequence).toEqual([7, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("derives the same Hand Status and Hand Score for every row", () => {
    for (const row of fixtureRows) {
      const bid = Number(row["Tricks Bid"]);
      const taken = Number(row["Tricks Taken"]);
      expect(handStatus(bid, taken)).toBe(row["Hand Status"]);
      expect(handScore(bid, taken)).toBe(Number(row["Hand Score"]));
    }
  });
});

describe("gameToCsv", () => {
  it("reproduces the reference export row for row", () => {
    // The reference came via xlsx, so its dates carry a midnight time component.
    const expected = [
      CSV_COLUMNS.join(","),
      ...fixtureRows.map((row) =>
        CSV_COLUMNS.map((column) =>
          column === "Game Date" ? row[column]!.slice(0, 10) : row[column]!,
        ).join(","),
      ),
    ];
    expect(gameToCsv(fixtureGame).trimEnd().split("\r\n")).toEqual(expected);
  });

  it("uses the exact column order the scoresheet reader emits", () => {
    expect(CSV_COLUMNS.join(",")).toBe(
      "Game Number,Game Date,Player Name,Player Position,Hand Number,Cards Dealt," +
        "Tricks Bid,Tricks Taken,Forced Burn Flag,Hand Status,Hand Score",
    );
  });

  it("orders rows by player position, then hand number", () => {
    const rows = gameToRows(fixtureGame);
    const positions = rows.map((row) => Number(row[3]));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    const firstPlayerHands = rows.filter((row) => row[3] === "1").map((row) => Number(row[4]));
    expect(firstPlayerHands).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it("ends every line with CRLF, matching Python's csv writer", () => {
    expect(gameToCsv(fixtureGame).endsWith("\r\n")).toBe(true);
    expect(gameToCsv(fixtureGame).split("\r\n")).toHaveLength(93); // header + 91 rows + trailing
  });

  it("writes the game number when one is set", () => {
    const csv = gameToCsv({ ...fixtureGame, gameNumber: 50 });
    expect(csv.split("\r\n")[1]!.startsWith("50,2024-12-25,")).toBe(true);
  });

  it("flags a forced burn as Yes", () => {
    const [firstRound, ...rest] = fixtureGame.rounds;
    const playerId = fixtureGame.players[0]!.id;
    const patched: Game = {
      ...fixtureGame,
      rounds: [
        {
          ...firstRound!,
          entries: {
            ...firstRound!.entries,
            [playerId]: { ...firstRound!.entries[playerId]!, forcedBurn: true },
          },
        },
        ...rest,
      ],
    };
    expect(gameToCsv(patched).split("\r\n")[1]).toContain(",Yes,");
  });

  it("can prepend the Source File column for concatenating with OCR output", () => {
    const csv = gameToCsv(fixtureGame, {
      includeSourceFile: true,
      sourceFile: "sample1_input.png",
    });
    const [header, firstRow] = csv.split("\r\n");
    expect(header!.startsWith("Source File,Game Number,")).toBe(true);
    expect(firstRow!.startsWith("sample1_input.png,")).toBe(true);
  });

  it("quotes a player name containing a comma", () => {
    const csv = gameToCsv({
      ...fixtureGame,
      players: fixtureGame.players.map((player, index) =>
        index === 0 ? { ...player, name: 'Jere, Sr. "JJ"' } : player,
      ),
    });
    expect(csv).toContain('"Jere, Sr. ""JJ"""');
  });
});

describe("csvFilename", () => {
  it("includes the date, and the game number when there is one", () => {
    expect(csvFilename(fixtureGame)).toBe("oh-heck-2024-12-25.csv");
    expect(csvFilename({ ...fixtureGame, gameNumber: 50 })).toBe("oh-heck-2024-12-25-game-50.csv");
  });
});

describe("csvToGame", () => {
  it("parses quoted fields", () => {
    expect(parseCsvLine('a,"b,c","d ""e"""')).toEqual(["a", "b,c", 'd "e"']);
  });

  it("round-trips an exported game", () => {
    const exported = gameToCsv({ ...fixtureGame, gameNumber: 50 });
    const result = csvToGame(exported);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.game.gameNumber).toBe(50);
    expect(result.game.gameDate).toBe("2024-12-25");
    expect(result.game.players.map((player) => player.name)).toEqual(
      fixtureGame.players.map((player) => player.name),
    );
    expect(result.game.rounds).toHaveLength(13);
    expect(result.game.cardsSequence).toEqual(fixtureGame.cardsSequence);
    expect(result.game.rounds[0]?.cardsDealt).toBe(7);

    const firstPlayer = result.game.players[0]!;
    const firstEntry = result.game.rounds[0]!.entries[firstPlayer.id]!;
    const fixtureFirst = fixtureGame.rounds[0]!.entries[fixtureGame.players[0]!.id]!;
    expect(firstEntry).toEqual(fixtureFirst);
  });

  it("imports the reference fixture CSV", () => {
    const result = csvToGame(FIXTURE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.game.players).toHaveLength(7);
    expect(result.game.rounds).toHaveLength(13);
  });

  it("applies a chosen starting dealer after import", () => {
    const exported = gameToCsv(fixtureGame);
    const result = csvToGame(exported);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const left = result.game.players.find((player) => player.position === 1)!;
    const withLeft = withStartingDealer(result.game, left.id);
    expect(withLeft.startingDealerId).toBe(left.id);
    expect(withLeft.rounds[0]?.dealerId).toBe(left.id);
  });

  it("rejects CSV missing a required column", () => {
    const result = csvToGame("Game Date,Player Name\n2024-12-25,Ada\n");
    expect(result).toEqual({ ok: false, error: 'Missing column "Game Number".' });
  });
});
