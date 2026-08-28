import { useState } from "react";
import { csvToGame, withStartingDealer } from "../domain/csv";
import { duplicateGameMessage, findDuplicateGame } from "../domain/gameIdentity";
import { playersInSeatOrder } from "../domain/rules";
import type { Game } from "../domain/types";

interface ImportGameProps {
  games: Game[];
  onImport: (game: Game) => void;
  onCancel: () => void;
}

export function ImportGame({ games, onImport, onCancel }: ImportGameProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Game | null>(null);
  const [dealerId, setDealerId] = useState<string | null>(null);

  function handleContinue() {
    const result = csvToGame(text);
    if (!result.ok) {
      setError(result.error);
      setDraft(null);
      setDealerId(null);
      return;
    }
    if (findDuplicateGame(result.game, games)) {
      setError(duplicateGameMessage(result.game));
      setDraft(null);
      setDealerId(null);
      return;
    }
    setError(null);
    setDraft(result.game);
    setDealerId(result.game.startingDealerId);
  }

  function handleImport() {
    if (!draft || !dealerId) return;
    if (findDuplicateGame(draft, games)) {
      setError(duplicateGameMessage(draft));
      return;
    }
    onImport(withStartingDealer(draft, dealerId));
  }

  function backToCsv() {
    setDraft(null);
    setDealerId(null);
    setError(null);
  }

  if (draft) {
    const seated = playersInSeatOrder(draft);
    return (
      <>
        <h1>Import game</h1>
        <p className="subtitle">
          {draft.gameDate}
          {draft.gameNumber !== null && ` · Game #${draft.gameNumber}`}
          {` · ${draft.players.length} players · ${draft.rounds.length} rounds`}
        </p>

        <div className="card">
          <h2>Who deals first?</h2>
          <div className="dealer-options">
            {seated.map((player) => (
              <button
                type="button"
                key={player.id}
                className="chip"
                aria-pressed={dealerId === player.id}
                onClick={() => setDealerId(player.id)}
              >
                {player.name}
              </button>
            ))}
          </div>
          <p className="hint">The deal moves one seat to the left after every round.</p>
        </div>

        <div className="footer">
          {error && <p className="notice error">{error}</p>}
          <button type="button" className="primary" onClick={handleImport} disabled={!dealerId}>
            Import game
          </button>
          <div className="footer-nav">
            <button type="button" className="ghost" onClick={backToCsv}>
              Back to CSV
            </button>
            <button type="button" className="ghost" onClick={onCancel}>
              All games
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>Import game</h1>
      <p className="subtitle">Paste a CSV exported from this app</p>

      <div className="card">
        <label className="field">
          <span className="label">CSV</span>
          <textarea
            className="csv-import"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              if (error) setError(null);
            }}
            rows={12}
            placeholder="Game Number,Game Date,Player Name,…"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </label>
      </div>

      <div className="footer">
        {error && <p className="notice error">{error}</p>}
        <button type="button" className="primary" onClick={handleContinue} disabled={!text.trim()}>
          Continue
        </button>
        <div className="footer-nav">
          <button type="button" className="ghost" onClick={onCancel}>
            All games
          </button>
        </div>
      </div>
    </>
  );
}
