import { describe, expect, it } from "vitest";
import {
  duplicateGameMessage,
  findDuplicateGame,
  isSameGameIdentity,
} from "../src/domain/gameIdentity";

describe("game identity", () => {
  it("matches on date and game number, including both null", () => {
    expect(
      isSameGameIdentity(
        { gameDate: "2026-08-23", gameNumber: 12 },
        { gameDate: "2026-08-23", gameNumber: 12 },
      ),
    ).toBe(true);
    expect(
      isSameGameIdentity(
        { gameDate: "2026-08-23", gameNumber: null },
        { gameDate: "2026-08-23", gameNumber: null },
      ),
    ).toBe(true);
    expect(
      isSameGameIdentity(
        { gameDate: "2026-08-23", gameNumber: 12 },
        { gameDate: "2026-08-23", gameNumber: 13 },
      ),
    ).toBe(false);
    expect(
      isSameGameIdentity(
        { gameDate: "2026-08-23", gameNumber: 12 },
        { gameDate: "2026-08-24", gameNumber: 12 },
      ),
    ).toBe(false);
  });

  it("finds a duplicate among existing games", () => {
    const existing = [
      { gameDate: "2026-08-23", gameNumber: 12 },
      { gameDate: "2026-08-24", gameNumber: null },
    ];
    expect(findDuplicateGame({ gameDate: "2026-08-23", gameNumber: 12 }, existing)).toEqual(
      existing[0],
    );
    expect(findDuplicateGame({ gameDate: "2026-08-23", gameNumber: 99 }, existing)).toBeUndefined();
  });

  it("describes the duplicate for the import error", () => {
    expect(duplicateGameMessage({ gameDate: "2026-08-23", gameNumber: 12 })).toBe(
      "A game dated 2026-08-23 with number 12 is already saved.",
    );
    expect(duplicateGameMessage({ gameDate: "2026-08-23", gameNumber: null })).toBe(
      "A game dated 2026-08-23 with no game number is already saved.",
    );
  });
});
