import { useState } from "react";
import type { Game } from "../domain/types";
import { GameNotes } from "./GameNotes";
import { Scorecard } from "./Scorecard";
import { ScoreSummary } from "./ScoreSummary";

interface GameOverviewProps {
  game: Game;
  onContinue: () => void;
  onNotesChange: (notes: string[]) => void;
  onExport: () => void;
  onAllGames: () => void;
  onDelete: () => void;
}

export function GameOverview({
  game,
  onContinue,
  onNotesChange,
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
        <h2>Scorecard</h2>
        {game.rounds.length === 0 ? (
          <p className="hint">No rounds recorded yet.</p>
        ) : (
          <Scorecard game={game} />
        )}
      </div>

      <ScoreSummary game={game} />

      <GameNotes notes={game.notes} onChange={onNotesChange} />

      <div className="footer">
        <button type="button" className="primary" onClick={onContinue}>
          {complete
            ? "Change scoring"
            : game.rounds.length === 0
              ? "Start scoring"
              : "Continue scoring"}
        </button>
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
