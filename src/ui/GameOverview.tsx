import { useState } from "react";
import { standings } from "../domain/scoring";
import type { Game } from "../domain/types";

interface GameOverviewProps {
  game: Game;
  onContinue: () => void;
  onExport: () => void;
  onAllGames: () => void;
  onDelete: () => void;
}

export function GameOverview({
  game,
  onContinue,
  onExport,
  onAllGames,
  onDelete,
}: GameOverviewProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const totalRounds = game.cardsSequence.length;
  const complete = game.rounds.length >= totalRounds;
  const progressLabel = complete
    ? `Complete · ${totalRounds} rounds`
    : `Round ${game.rounds.length + 1} of ${totalRounds}`;

  return (
    <>
      <h1>Game overview</h1>
      <p className="subtitle">
        {game.gameDate}
        {game.gameNumber !== null && ` · Game #${game.gameNumber}`}
        {` · ${progressLabel}`}
      </p>

      <div className="card">
        <h2>Standings</h2>
        {game.rounds.length === 0 ? (
          <p className="hint">No rounds recorded yet.</p>
        ) : (
          <table className="summary-table">
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Player</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {standings(game).map(({ player, total, rank }) => (
                <tr key={player.id}>
                  <td className="num muted">{rank}</td>
                  <td>{player.name}</td>
                  <td className="num">{total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="footer">
        {!complete && (
          <button type="button" className="primary" onClick={onContinue}>
            {game.rounds.length === 0 ? "Start scoring" : "Continue scoring"}
          </button>
        )}
        <div className="footer-nav">
          <button type="button" className="ghost" onClick={onExport}>
            Export
          </button>
          <button type="button" className="ghost" onClick={onAllGames}>
            All games
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => {
              if (confirmingDelete) onDelete();
              else setConfirmingDelete(true);
            }}
          >
            {confirmingDelete ? "Tap again to delete" : "Delete"}
          </button>
        </div>
      </div>
    </>
  );
}
