// @vitest-environment jsdom

/**
 * End-to-end walk through the three screens: set up a game, enter every round,
 * correct one, and land on export. Every game runs the standard 13 rounds, so
 * the longer tests drive the rounds through a loop.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "../src/App";

/** What 2 to 7 players are dealt, round by round. */
const CARDS = [7, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 7];

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

function setName(seat: number, name: string) {
  fireEvent.change(screen.getByPlaceholderText(`Seat ${seat}`), { target: { value: name } });
}

function bump(label: string, times = 1) {
  for (let i = 0; i < times; i += 1) fireEvent.click(screen.getByLabelText(label));
}

function recordRound() {
  fireEvent.click(screen.getByRole("button", { name: /^Record (round \d+|final round)$/ }));
}

function recordButton() {
  return screen.getByRole("button", { name: /^Record (round \d+|final round)$/ });
}

/** Three players. The blank seats are trailing, so they're dropped on submit. */
function setUpGame(names = ["Ada", "Bo", "Cy"]) {
  render(<App />);
  names.forEach((name, index) => setName(index + 1, name));
  fireEvent.click(screen.getByRole("button", { name: "Start game" }));
}

/** Give every trick in the current round to one player, then record it. */
function takeAllTricks(name: string, cards: number) {
  bump(`Increase tricks taken by ${name}`, cards);
  recordRound();
}

describe("setup screen", () => {
  it("starts with six seats and can add or remove them", () => {
    render(<App />);
    expect(screen.getAllByPlaceholderText(/^Seat \d$/)).toHaveLength(6);

    fireEvent.click(screen.getByLabelText("Remove seat 6"));
    expect(screen.getAllByPlaceholderText(/^Seat \d$/)).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: "Add a player" }));
    expect(screen.getAllByPlaceholderText(/^Seat \d$/)).toHaveLength(6);
  });

  it("refuses to start with a duplicate player name", () => {
    render(<App />);
    setName(1, "Ada");
    setName(2, "Ada");
    fireEvent.click(screen.getByRole("button", { name: "Start game" }));
    expect(screen.getByText(/Two players are both called "Ada"/)).toBeTruthy();
  });

  it("deals the standard 13 rounds starting at 7 cards", () => {
    setUpGame();
    expect(screen.getByText("Round 1 of 13")).toBeTruthy();
    expect(screen.getByText(/^7 cards$/)).toBeTruthy();
  });

  it("deals fewer cards when the deck can't stretch to every player", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Add a player" }));
    fireEvent.click(screen.getByRole("button", { name: "Add a player" }));
    ["Ada", "Bo", "Cy", "Dee", "Eli", "Fay", "Gus", "Hal"].forEach((name, index) =>
      setName(index + 1, name),
    );
    fireEvent.click(screen.getByRole("button", { name: "Start game" }));

    // Eight players can only be dealt 6 each from 52 cards, still over 13 rounds.
    expect(screen.getByText("Round 1 of 13")).toBeTruthy();
    expect(screen.getByText(/^6 cards$/)).toBeTruthy();
  });
});

describe("round entry", () => {
  it("shows the round, the cards dealt, and the dealer", () => {
    setUpGame();
    expect(screen.getByText("Round 1 of 13")).toBeTruthy();
    expect(screen.getByText(/^7 cards$/)).toBeTruthy();
    // The rightmost seat deals first by default.
    const dealerRow = screen.getByText("deals").closest(".entry-row");
    expect(dealerRow?.textContent).toContain("Cy");
  });

  it("puts the dealer in the bottom row, since they bid last", () => {
    setUpGame();
    const namesInOrder = () =>
      [...document.querySelectorAll(".entry-table .player-name")].map((cell) =>
        cell.textContent?.replace("deals", ""),
      );

    // Cy deals round 1, so bidding runs Ada, Bo, Cy.
    expect(namesInOrder()).toEqual(["Ada", "Bo", "Cy"]);

    takeAllTricks("Ada", 7);

    // Ada deals round 2, so the table rotates to Bo, Cy, Ada.
    expect(namesInOrder()).toEqual(["Bo", "Cy", "Ada"]);
    expect(screen.getByText("deals").closest(".entry-row")?.textContent).toContain("Ada");
  });

  it("keeps Record disabled until the tricks taken match the cards dealt", () => {
    setUpGame();
    expect(recordButton().hasAttribute("disabled")).toBe(true);

    bump("Increase tricks taken by Ada", 6);
    expect(recordButton().hasAttribute("disabled")).toBe(true); // 6 of 7

    bump("Increase tricks taken by Bo");
    expect(recordButton().hasAttribute("disabled")).toBe(false); // 7 of 7

    bump("Increase tricks taken by Cy");
    expect(recordButton().hasAttribute("disabled")).toBe(true); // 8 of 7, one too many
  });

  it("totals the bids and tricks taken under their own columns", () => {
    setUpGame();
    const totals = () =>
      [...document.querySelectorAll(".entry-row.totals .total-cell")].map(
        (cell) => cell.textContent,
      );

    expect(totals()).toEqual(["0", "0 of 7"]);

    bump("Increase tricks bid by Ada");
    bump("Increase tricks taken by Bo", 7);

    // Bids first, then tricks taken, matching the column order above.
    expect(totals()).toEqual(["1", "7 of 7"]);
    const takenCell = document.querySelectorAll(".entry-row.totals .total-cell")[1];
    expect(takenCell?.className).toContain("ok");
  });

  it("blocks recording when the bids total the cards dealt", () => {
    setUpGame();
    // Seven tricks dealt, and Ada alone bids all of them, so the bids can't stand.
    bump("Increase tricks bid by Ada", 7);
    bump("Increase tricks taken by Ada", 7);

    const bidTotalCell = () => document.querySelectorAll(".entry-row.totals .total-cell")[0];

    expect(screen.getByText("The bids can't add up to 7.")).toBeTruthy();
    expect(recordButton().hasAttribute("disabled")).toBe(true);
    expect(bidTotalCell()?.className).toContain("bad");

    // Dropping Ada's bid to six makes the round legal.
    fireEvent.click(screen.getByLabelText("Decrease tricks bid by Ada"));
    expect(screen.queryByText("The bids can't add up to 7.")).toBeNull();
    expect(recordButton().hasAttribute("disabled")).toBe(false);
    expect(bidTotalCell()?.className).not.toContain("bad");
  });

  it("stays quiet about the tricks total while the bids are being entered", () => {
    setUpGame();
    bump("Increase tricks bid by Ada");
    expect(screen.queryByText(/Tricks taken add up to/)).toBeNull();

    // Once tricks start going in, the running mismatch is worth showing.
    bump("Increase tricks taken by Bo");
    expect(screen.getByText(/6 short of the 7 dealt/)).toBeTruthy();
  });

  it("advances to the next round and shows running totals", () => {
    setUpGame();
    takeAllTricks("Ada", 7);

    expect(screen.getByText("Round 2 of 13")).toBeTruthy();
    expect(screen.getByText(/^6 cards$/)).toBeTruthy();
    // Ada bid none and took all seven, so she burned by seven; the others made
    // their nothing bids.
    const standings = screen.getByRole("list");
    expect(standings.textContent).toContain("Ada-7");
    expect(standings.textContent).toContain("Bo5");
  });

  it("reopens the previous round with its entries intact", () => {
    setUpGame();
    takeAllTricks("Ada", 7);

    fireEvent.click(screen.getByRole("button", { name: "Fix round 1" }));
    expect(screen.getByText("Round 1 of 13")).toBeTruthy();
    expect(screen.getByLabelText("tricks taken by Ada").textContent).toContain("7");

    // Hand one of Ada's tricks to Bo and re-record.
    fireEvent.click(screen.getByLabelText("Decrease tricks taken by Ada"));
    bump("Increase tricks taken by Bo");
    recordRound();
    expect(screen.getByText("Round 2 of 13")).toBeTruthy();
  });
});

describe("export screen", () => {
  it("is reached after the final round, with final scores and a CSV", () => {
    setUpGame();

    // Ada takes every trick for the first twelve rounds, having bid none, so she
    // burns by the cards dealt each time while Bo and Cy make nothing bids.
    for (let round = 0; round < 12; round += 1) {
      takeAllTricks("Ada", CARDS[round]!);
    }

    // Split the last round of seven so nobody ties.
    bump("Increase tricks taken by Ada", 6);
    bump("Increase tricks taken by Bo");
    recordRound();

    expect(screen.getByRole("heading", { name: "Game complete" })).toBeTruthy();

    // Ada burned 48 over the first twelve rounds, then 6 more: -54.
    // Bo made twelve nothing bids for 60, then burned by one: 59.
    // Cy made all thirteen: 65.
    const rows = screen.getAllByRole("row").map((row) => row.textContent);
    expect(rows).toContain("1Cy65");
    expect(rows).toContain("2Bo59");
    expect(rows).toContain("3Ada-54");

    // Three players over thirteen rounds.
    expect(screen.getByText(/39 rows, one per player per round/)).toBeTruthy();
  });

  it("restores an in-progress game after a reload", () => {
    setUpGame();
    takeAllTricks("Ada", 7);

    cleanup();
    render(<App />);

    expect(screen.getByText("Round 2 of 13")).toBeTruthy();
  });
});
