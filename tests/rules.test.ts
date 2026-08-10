import { describe, expect, it } from "vitest";
import {
  DECK_SIZE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  cardsSequenceFor,
  dealerForRound,
  forbiddenDealerBid,
  maxCardsFor,
  playersInBiddingOrder,
  validateRound,
} from "../src/domain/rules";
import type { Entry, Game } from "../src/domain/types";

const STANDARD = [7, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 7];

describe("cardsSequenceFor", () => {
  it("uses the full 7-card sequence whenever the deck allows it", () => {
    for (let players = MIN_PLAYERS; players <= 7; players += 1) {
      expect(cardsSequenceFor(players)).toEqual(STANDARD);
    }
  });

  it("caps at 6 cards for 8 players, padding to keep 13 rounds", () => {
    expect(cardsSequenceFor(8)).toEqual([6, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 6]);
  });

  it("caps at 5 cards for 9 players, padding to keep 13 rounds", () => {
    expect(cardsSequenceFor(9)).toEqual([5, 5, 5, 4, 3, 2, 1, 2, 3, 4, 5, 5, 5]);
  });

  it("always produces 13 rounds and never deals more than one deck", () => {
    for (let players = MIN_PLAYERS; players <= MAX_PLAYERS; players += 1) {
      const sequence = cardsSequenceFor(players);
      expect(sequence).toHaveLength(13);
      expect(Math.max(...sequence) * players).toBeLessThanOrEqual(DECK_SIZE);
      expect(Math.min(...sequence)).toBe(1);
    }
  });

  it("puts the single-card round in the middle with six rounds either side", () => {
    for (let players = MIN_PLAYERS; players <= MAX_PLAYERS; players += 1) {
      const sequence = cardsSequenceFor(players);
      const [firstHalf, middle, secondHalf] = [
        sequence.slice(0, 6),
        sequence[6],
        sequence.slice(7),
      ];

      expect(middle).toBe(1);
      expect(firstHalf).toHaveLength(6);
      // The second half climbs back through the same counts in reverse.
      expect(secondHalf).toEqual([...firstHalf].reverse());
      for (let i = 1; i < firstHalf.length; i += 1) {
        expect(firstHalf[i]!).toBeLessThanOrEqual(firstHalf[i - 1]!);
      }
    }
  });

  it("honours a non-default round count", () => {
    expect(cardsSequenceFor(9, 9)).toEqual([5, 4, 3, 2, 1, 2, 3, 4, 5]);
  });
});

describe("maxCardsFor", () => {
  it("is limited by the house maximum, then by the deck", () => {
    expect(maxCardsFor(4)).toBe(7);
    expect(maxCardsFor(7)).toBe(7);
    expect(maxCardsFor(8)).toBe(6);
    expect(maxCardsFor(9)).toBe(5);
  });
});

function gameWith(playerCount: number, startingSeat: number): Game {
  const players = Array.from({ length: playerCount }, (_, index) => ({
    id: `p${index + 1}`,
    name: `P${index + 1}`,
    position: index + 1,
  }));
  return {
    id: "g1",
    gameNumber: null,
    gameDate: "2026-01-01",
    players,
    cardsSequence: cardsSequenceFor(playerCount),
    startingDealerId: `p${startingSeat}`,
    rounds: [],
  };
}

describe("dealerForRound", () => {
  it("moves one seat per round and wraps around", () => {
    const game = gameWith(7, 7);
    // Matches sample1: the rightmost seat deals round 1, then seat 1, 2, ...
    expect(dealerForRound(game, 1)?.position).toBe(7);
    expect(dealerForRound(game, 2)?.position).toBe(1);
    expect(dealerForRound(game, 4)?.position).toBe(3);
    expect(dealerForRound(game, 8)?.position).toBe(7);
    expect(dealerForRound(game, 9)?.position).toBe(1);
    expect(dealerForRound(game, 11)?.position).toBe(3);
  });

  it("returns null when the starting dealer isn't in the game", () => {
    const game = { ...gameWith(4, 1), startingDealerId: "nobody" };
    expect(dealerForRound(game, 1)).toBeNull();
  });
});

describe("playersInBiddingOrder", () => {
  it("starts left of the dealer and ends with the dealer", () => {
    const game = gameWith(5, 5);
    // Seat 5 deals round 1, so bidding runs 1, 2, 3, 4, then the dealer.
    expect(playersInBiddingOrder(game, 1).map((player) => player.position)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    // Seat 1 deals round 2, so bidding runs 2, 3, 4, 5, then the dealer.
    expect(playersInBiddingOrder(game, 2).map((player) => player.position)).toEqual([
      2, 3, 4, 5, 1,
    ]);
    expect(playersInBiddingOrder(game, 4).map((player) => player.position)).toEqual([
      4, 5, 1, 2, 3,
    ]);
  });

  it("keeps everyone in the same cyclic order every round", () => {
    const game = gameWith(6, 3);
    for (let handNumber = 1; handNumber <= 6; handNumber += 1) {
      const positions = playersInBiddingOrder(game, handNumber).map((p) => p.position);
      expect(positions).toHaveLength(6);
      expect(new Set(positions).size).toBe(6);
      for (let i = 1; i < positions.length; i += 1) {
        // Each row is the next seat around the table, wrapping at the end.
        expect(positions[i]).toBe((positions[i - 1]! % 6) + 1);
      }
    }
  });

  it("falls back to seat order when the dealer is unknown", () => {
    const game = { ...gameWith(4, 1), startingDealerId: "nobody" };
    expect(playersInBiddingOrder(game, 1).map((player) => player.position)).toEqual([1, 2, 3, 4]);
  });
});

describe("forbiddenDealerBid", () => {
  it("is whatever would make the bids total the cards dealt", () => {
    expect(forbiddenDealerBid(7, 7)).toBe(0);
    expect(forbiddenDealerBid(5, 3)).toBe(2);
    expect(forbiddenDealerBid(4, 0)).toBe(4);
  });

  it("is null when the table has already over-bid past the total", () => {
    expect(forbiddenDealerBid(5, 6)).toBeNull();
  });
});

function entries(pairs: [number, number][]): Entry[] {
  return pairs.map(([bid, taken]) => ({ bid, taken, forcedBurn: false }));
}

function codes(result: ReturnType<typeof validateRound>): string[] {
  return result.problems.map((problem) => problem.code);
}

describe("validateRound", () => {
  it("accepts a round whose tricks taken match the cards dealt", () => {
    const result = validateRound(3, entries([[1, 1], [0, 2], [1, 0]]));
    expect(result.canRecord).toBe(true);
    expect(result.problems).toEqual([]);
    expect(result.takenTotal).toBe(3);
    expect(result.bidTotal).toBe(2);
  });

  it("blocks recording when the tricks taken don't add up", () => {
    const short = validateRound(5, entries([[1, 1], [1, 1]]));
    expect(short.canRecord).toBe(false);
    expect(codes(short)).toEqual(["taken-total"]);
    expect(short.problems[0]!.message).toContain("3 short");

    const over = validateRound(2, entries([[0, 2], [1, 2]]));
    expect(over.canRecord).toBe(false);
    expect(codes(over)).toEqual(["taken-total"]);
    expect(over.problems[0]!.message).toContain("2 more");
  });

  it("rejects values above the cards dealt", () => {
    const result = validateRound(2, entries([[3, 2], [0, 0]]));
    expect(result.canRecord).toBe(false);
    expect(codes(result)).toContain("out-of-range");
    expect(result.problems[0]!.message).toContain("between 0 and 2");
  });

  it("blocks recording when the bids total the cards dealt", () => {
    const result = validateRound(3, entries([[2, 1], [1, 2]]));
    expect(result.canRecord).toBe(false);
    expect(codes(result)).toEqual(["bid-total"]);
    expect(result.problems[0]!.message).toBe("The bids can't add up to 3.");
  });

  it("reports both totals when both are wrong", () => {
    const result = validateRound(2, entries([[1, 0], [1, 0]]));
    expect(codes(result)).toEqual(["bid-total", "taken-total"]);
  });
});
