// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Game } from "../src/domain/types";
import {
  deleteGame,
  loadStore,
  setActiveGameId,
  upsertGame,
} from "../src/storage/persistence";

function sampleGame(id: string, overrides: Partial<Game> = {}): Game {
  return {
    id,
    gameNumber: null,
    gameDate: "2026-08-10",
    players: [
      { id: "p1", name: "Ada", position: 1 },
      { id: "p2", name: "Bo", position: 2 },
      { id: "p3", name: "Cy", position: 3 },
    ],
    cardsSequence: [7, 6, 5],
    startingDealerId: "p3",
    rounds: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("persistence", () => {
  it("starts empty", () => {
    expect(loadStore()).toEqual({ version: 1, games: [], activeGameId: null });
  });

  it("upserts games to the front and marks them active", () => {
    upsertGame(sampleGame("a"));
    upsertGame(sampleGame("b"));

    const store = loadStore();
    expect(store.games.map((game) => game.id)).toEqual(["b", "a"]);
    expect(store.activeGameId).toBe("b");
  });

  it("replaces an existing game without duplicating it", () => {
    upsertGame(sampleGame("a"));
    upsertGame(
      sampleGame("a", {
        rounds: [
          {
            handNumber: 1,
            cardsDealt: 7,
            dealerId: "p3",
            entries: {
              p1: { bid: 0, taken: 7, forcedBurn: false },
              p2: { bid: 0, taken: 0, forcedBurn: false },
              p3: { bid: 0, taken: 0, forcedBurn: false },
            },
          },
        ],
      }),
    );

    const store = loadStore();
    expect(store.games).toHaveLength(1);
    expect(store.games[0]?.rounds).toHaveLength(1);
  });

  it("deletes a game and clears activeGameId when needed", () => {
    upsertGame(sampleGame("a"));
    upsertGame(sampleGame("b"));
    deleteGame("b");

    const store = loadStore();
    expect(store.games.map((game) => game.id)).toEqual(["a"]);
    expect(store.activeGameId).toBeNull();
  });

  it("can set the active game without rewriting bodies", () => {
    upsertGame(sampleGame("a"));
    upsertGame(sampleGame("b"));
    setActiveGameId("a");

    expect(loadStore().activeGameId).toBe("a");
  });

  it("ignores a corrupt or wrong-version payload", () => {
    localStorage.setItem("oh-heck.games", JSON.stringify({ version: 99, games: [] }));
    expect(loadStore()).toEqual({ version: 1, games: [], activeGameId: null });

    localStorage.setItem("oh-heck.games", "{not-json");
    expect(loadStore()).toEqual({ version: 1, games: [], activeGameId: null });
  });
});
