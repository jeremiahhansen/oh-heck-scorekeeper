import { describe, expect, it } from "vitest";
import {
  handScore,
  handStatus,
  runningTotals,
  scorecardMatrix,
  standings,
} from "../src/domain/scoring";
import type { Game } from "../src/domain/types";

describe("handStatus", () => {
  it("is Made Bid only on an exact call", () => {
    expect(handStatus(0, 0)).toBe("Made Bid");
    expect(handStatus(3, 3)).toBe("Made Bid");
    expect(handStatus(2, 1)).toBe("Burn");
    expect(handStatus(0, 1)).toBe("Burn");
  });
});

describe("handScore", () => {
  it("pays 5 plus a point per trick when the bid is made", () => {
    expect(handScore(0, 0)).toBe(5);
    expect(handScore(1, 1)).toBe(6);
    expect(handScore(3, 3)).toBe(8);
  });

  it("loses a point per trick missed by, in either direction", () => {
    expect(handScore(2, 1)).toBe(-1);
    expect(handScore(0, 2)).toBe(-2);
    expect(handScore(3, 0)).toBe(-3);
  });
});

const game: Game = {
  id: "g",
  gameNumber: 1,
  gameDate: "2026-01-01",
  players: [
    { id: "a", name: "Ada", position: 1 },
    { id: "b", name: "Bo", position: 2 },
    { id: "c", name: "Cy", position: 3 },
  ],
  cardsSequence: [2, 1],
  startingDealerId: "c",
  notes: [],
  rounds: [
    {
      handNumber: 1,
      cardsDealt: 2,
      dealerId: "c",
      entries: {
        a: { bid: 1, taken: 1, forcedBurn: false }, // +6
        b: { bid: 0, taken: 1, forcedBurn: false }, // -1
        c: { bid: 0, taken: 0, forcedBurn: false }, // +5
      },
    },
    {
      handNumber: 2,
      cardsDealt: 1,
      dealerId: "a",
      entries: {
        a: { bid: 0, taken: 0, forcedBurn: false }, // +5
        b: { bid: 1, taken: 1, forcedBurn: false }, // +6
        c: { bid: 1, taken: 0, forcedBurn: true }, //  -1
      },
    },
  ],
};

describe("runningTotals", () => {
  it("sums every recorded round per player", () => {
    expect(runningTotals(game)).toEqual({ a: 11, b: 5, c: 4 });
  });

  it("reports zero for a game with no rounds yet", () => {
    expect(runningTotals({ ...game, rounds: [] })).toEqual({ a: 0, b: 0, c: 0 });
  });
});

describe("standings", () => {
  it("ranks by total, highest first, and counts burns", () => {
    expect(
      standings(game).map((row) => [row.rank, row.player.name, row.tricks, row.burns, row.total]),
    ).toEqual([
      [1, "Ada", 1, 0, 11],
      [2, "Bo", 2, 1, 5],
      [3, "Cy", 0, 1, 4],
    ]);
  });

  it("gives tied players the same rank", () => {
    const tied = standings({ ...game, rounds: [] });
    expect(tied.map((row) => row.rank)).toEqual([1, 1, 1]);
    expect(tied.map((row) => row.burns)).toEqual([0, 0, 0]);
  });

  it("skips places after a tie (competition ranking)", () => {
    // Scores 8, 5, 5, 5, -1, -1, -2 → ranks 1, 2, 2, 2, 5, 5, 7
    const tiedGame: Game = {
      ...game,
      players: [
        { id: "a", name: "Ada", position: 1 },
        { id: "b", name: "Bo", position: 2 },
        { id: "c", name: "Cy", position: 3 },
        { id: "d", name: "Dee", position: 4 },
        { id: "e", name: "Eli", position: 5 },
        { id: "f", name: "Fay", position: 6 },
        { id: "g", name: "Gus", position: 7 },
      ],
      cardsSequence: [3],
      startingDealerId: "g",
      rounds: [
        {
          handNumber: 1,
          cardsDealt: 3,
          dealerId: "g",
          entries: {
            a: { bid: 3, taken: 3, forcedBurn: false }, // 8
            b: { bid: 0, taken: 0, forcedBurn: false }, // 5
            c: { bid: 0, taken: 0, forcedBurn: false }, // 5
            d: { bid: 0, taken: 0, forcedBurn: false }, // 5
            e: { bid: 0, taken: 1, forcedBurn: false }, // -1
            f: { bid: 1, taken: 0, forcedBurn: false }, // -1
            g: { bid: 2, taken: 0, forcedBurn: false }, // -2
          },
        },
      ],
    };

    expect(standings(tiedGame).map((row) => [row.player.name, row.rank, row.total])).toEqual([
      ["Ada", 1, 8],
      ["Bo", 2, 5],
      ["Cy", 2, 5],
      ["Dee", 2, 5],
      ["Eli", 5, -1],
      ["Fay", 5, -1],
      ["Gus", 7, -2],
    ]);
  });
});

describe("scorecardMatrix", () => {
  it("puts players in seat order as columns and tracks running totals", () => {
    const matrix = scorecardMatrix(game);
    expect(matrix.players.map((player) => player.name)).toEqual(["Ada", "Bo", "Cy"]);
    expect(matrix.rounds).toHaveLength(2);

    const round1 = matrix.rounds[0]!;
    expect(round1.handNumber).toBe(1);
    expect(round1.cardsDealt).toBe(2);
    expect(round1.cells).toEqual([
      { bid: 1, taken: 1, score: 6, runningTotal: 6, burned: false, forcedBurn: false },
      { bid: 0, taken: 1, score: -1, runningTotal: -1, burned: true, forcedBurn: false },
      { bid: 0, taken: 0, score: 5, runningTotal: 5, burned: false, forcedBurn: false },
    ]);

    const round2 = matrix.rounds[1]!;
    expect(round2.cells.map((cell) => cell?.runningTotal)).toEqual([11, 5, 4]);
    expect(round2.cells[2]?.burned).toBe(true);
    expect(round2.cells[2]?.forcedBurn).toBe(true);
  });

  it("leaves unplayed rounds empty and marks a burn when Ada takes all", () => {
    const inProgress: Game = {
      ...game,
      cardsSequence: [7, 6, 5],
      rounds: [
        {
          handNumber: 1,
          cardsDealt: 7,
          dealerId: "c",
          entries: {
            a: { bid: 0, taken: 7, forcedBurn: false },
            b: { bid: 0, taken: 0, forcedBurn: false },
            c: { bid: 0, taken: 0, forcedBurn: false },
          },
        },
      ],
    };

    const matrix = scorecardMatrix(inProgress);
    expect(matrix.rounds).toHaveLength(3);
    expect(matrix.rounds[0]?.cells).toEqual([
      { bid: 0, taken: 7, score: -7, runningTotal: -7, burned: true, forcedBurn: false },
      { bid: 0, taken: 0, score: 5, runningTotal: 5, burned: false, forcedBurn: false },
      { bid: 0, taken: 0, score: 5, runningTotal: 5, burned: false, forcedBurn: false },
    ]);
    expect(matrix.rounds[1]?.cells).toEqual([null, null, null]);
    expect(matrix.rounds[2]?.cells).toEqual([null, null, null]);
  });
});
