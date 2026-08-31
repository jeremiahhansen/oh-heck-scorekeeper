import type { Game } from "../domain/types";
import { compareGamesNewestFirst } from "../domain/gameIdentity";
import { playersInSeatOrder } from "../domain/rules";

interface GamesOverviewProps {
  games: Game[];
  onNewGame: () => void;
  onImportGame: () => void;
  onOpenGame: (game: Game) => void;
}

function gameComplete(game: Game): boolean {
  return game.rounds.length >= game.cardsSequence.length;
}

function playerNames(game: Game): string {
  return playersInSeatOrder(game)
    .map((player) => player.name)
    .join(", ");
}

export function GamesOverview({
  games,
  onNewGame,
  onImportGame,
  onOpenGame,
}: GamesOverviewProps) {
  return (
    <>
      <h1>Games</h1>
      <p className="subtitle">Oh Heck Scorekeeper</p>

      {games.length === 0 ? (
        <div className="card">
          <p className="hint" style={{ marginBottom: 12 }}>
            No games yet. Start one and it will stay on this device until you delete it.
          </p>
          <button type="button" className="primary" onClick={onNewGame}>
            New game
          </button>
          <button
            type="button"
            className="ghost"
            style={{ width: "100%", marginTop: 10 }}
            onClick={onImportGame}
          >
            Import game
          </button>
        </div>
      ) : (
        <>
          <ul className="game-list">
            {[...games].sort(compareGamesNewestFirst).map((game) => {
              const complete = gameComplete(game);
              const totalRounds = game.cardsSequence.length;
              return (
                <li key={game.id}>
                  <button
                    type="button"
                    className="game-list-row"
                    onClick={() => onOpenGame(game)}
                  >
                    <span className="game-list-title">
                      {game.gameDate}
                      {game.gameNumber !== null && (
                        <span className="muted"> · #{game.gameNumber}</span>
                      )}
                    </span>
                    <span className="game-list-meta">{playerNames(game)}</span>
                    <span className="game-list-status">
                      <span>
                        {game.rounds.length} of {totalRounds} rounds
                      </span>
                      <span className={complete ? "status-complete" : "status-progress"}>
                        {complete ? "Complete" : "In progress"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="footer">
            <button type="button" className="primary" onClick={onNewGame}>
              New game
            </button>
            <div className="footer-nav">
              <button type="button" className="ghost" onClick={onImportGame}>
                Import game
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
