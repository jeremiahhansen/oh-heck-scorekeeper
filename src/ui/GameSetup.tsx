import { useState } from "react";
import { createId } from "../domain/id";
import { MAX_PLAYERS, MIN_PLAYERS, cardsSequenceFor } from "../domain/rules";
import type { Game, Player } from "../domain/types";

interface GameSetupProps {
  onStart: (game: Game) => void;
  onCancel: () => void;
}

const INITIAL_SEATS = 7;

/** Local date, so a game played late in the evening doesn't roll to tomorrow. */
function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function GameSetup({ onStart, onCancel }: GameSetupProps) {
  const [gameDate, setGameDate] = useState(todayIso);
  const [gameNumber, setGameNumber] = useState("");
  const [names, setNames] = useState<string[]>(() => Array<string>(INITIAL_SEATS).fill(""));
  const [dealerSeat, setDealerSeat] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Trailing blank seats are ignored; a blank between two names is a mistake.
  const trimmed = names.map((name) => name.trim());
  let lastFilled = trimmed.length;
  while (lastFilled > 0 && trimmed[lastFilled - 1] === "") lastFilled -= 1;
  const seats = trimmed.slice(0, lastFilled);
  const playerCount = seats.filter((name) => name !== "").length;

  // Leftmost seat deals first by default (same as import).
  const effectiveDealerSeat =
    dealerSeat !== null && dealerSeat >= 1 && dealerSeat <= playerCount ? dealerSeat : 1;

  function updateName(index: number, value: string) {
    setNames((previous) => previous.map((name, i) => (i === index ? value : name)));
  }

  function addSeat() {
    setNames((previous) =>
      previous.length >= MAX_PLAYERS ? previous : [...previous, ""],
    );
  }

  function removeSeat(index: number) {
    setNames((previous) =>
      previous.length <= MIN_PLAYERS ? previous : previous.filter((_, i) => i !== index),
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) {
      setError("Pick a game date.");
      return;
    }
    if (seats.some((name) => name === "")) {
      setError("Fill in every seat, or remove the blank ones.");
      return;
    }
    if (playerCount < MIN_PLAYERS) {
      setError(`Enter at least ${MIN_PLAYERS} players.`);
      return;
    }
    if (playerCount > MAX_PLAYERS) {
      setError(`This app handles up to ${MAX_PLAYERS} players.`);
      return;
    }

    const duplicate = seats.find((name, index) => seats.indexOf(name) !== index);
    if (duplicate !== undefined) {
      setError(`Two players are both called "${duplicate}". Make the names distinct.`);
      return;
    }
    const players: Player[] = seats.map((name, index) => ({
      id: createId(),
      name,
      position: index + 1,
    }));

    const dealer = players[effectiveDealerSeat - 1] ?? players[0];
    if (!dealer) {
      setError("Pick who deals first.");
      return;
    }

    const parsedGameNumber = Number.parseInt(gameNumber.trim(), 10);
    onStart({
      id: createId(),
      gameNumber: Number.isFinite(parsedGameNumber) ? parsedGameNumber : null,
      gameDate,
      players,
      cardsSequence: cardsSequenceFor(playerCount),
      startingDealerId: dealer.id,
      rounds: [],
      notes: [],
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>New game</h1>
      <p className="subtitle">Oh Heck Scorekeeper</p>

      <div className="card">
        <div className="row">
          <label className="field field-date">
            <span className="label">Date</span>
            <input
              type="date"
              value={gameDate}
              onChange={(event) => setGameDate(event.target.value)}
              required
            />
          </label>
          <label className="field field-game-number">
            <span className="label">Game #</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="50"
              value={gameNumber}
              onChange={(event) => setGameNumber(event.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="card">
        <h2>Players</h2>
        <p className="hint">In seat order, left to right, same as the paper sheet.</p>
        {names.map((name, index) => (
          <div className="player-input-row" key={index}>
            <span className="seat-number">{index + 1}</span>
            <input
              type="text"
              value={name}
              placeholder={`Seat ${index + 1}`}
              autoCapitalize="words"
              autoComplete="off"
              onChange={(event) => updateName(index, event.target.value)}
            />
            <button
              type="button"
              className="icon-button"
              onClick={() => removeSeat(index)}
              disabled={names.length <= MIN_PLAYERS}
              aria-label={`Remove seat ${index + 1}`}
            >
              &times;
            </button>
          </div>
        ))}
        <button
          type="button"
          className="ghost"
          onClick={addSeat}
          disabled={names.length >= MAX_PLAYERS}
          style={{ width: "100%", marginTop: 4 }}
        >
          {names.length >= MAX_PLAYERS ? `Maximum ${MAX_PLAYERS} players` : "Add a player"}
        </button>
      </div>

      {playerCount >= MIN_PLAYERS && (
        <div className="card">
          <h2>Who deals first?</h2>
          <div className="dealer-options">
            {seats.map((name, index) =>
              name === "" ? null : (
                <button
                  type="button"
                  key={index}
                  className="chip"
                  aria-pressed={effectiveDealerSeat === index + 1}
                  onClick={() => setDealerSeat(index + 1)}
                >
                  {name}
                </button>
              ),
            )}
          </div>
          <p className="hint">The deal moves one seat to the left after every round.</p>
        </div>
      )}

      <div className="footer">
        {error && <p className="notice error">{error}</p>}
        <button type="submit" className="primary">
          Start game
        </button>
        <button
          type="button"
          className="ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={onCancel}
        >
          All games
        </button>
      </div>
    </form>
  );
}
