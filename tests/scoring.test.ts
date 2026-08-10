import { describe, expect, it } from "vitest";
import { handScore, handStatus, runningTotals, standings } from "../src/domain/scoring";
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
  it("ranks by total, highest first", () => {
    expect(standings(game).map((row) => [row.rank, row.player.name, row.total])).toEqual([
      [1, "Ada", 11],
      [2, "Bo", 5],
      [3, "Cy", 4],
    ]);
  });

  it("gives tied players the same rank", () => {
    const tied = standings({ ...game, rounds: [] });
    expect(tied.map((row) => row.rank)).toEqual([1, 1, 1]);
  });
});
