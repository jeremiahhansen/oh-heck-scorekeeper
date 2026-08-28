import { scorecardMatrix, standings } from "../domain/scoring";
import type { Game } from "../domain/types";

interface ScorecardProps {
  game: Game;
}

export function Scorecard({ game }: ScorecardProps) {
  const { players, rounds } = scorecardMatrix(game);
  const rankByPlayerId = new Map(
    standings(game).map((row) => [row.player.id, row.rank]),
  );

  return (
    <div className="scorecard-scroller">
      <table className="scorecard">
        <thead>
          <tr>
            <th className="scorecard-corner" scope="col" />
            {players.map((player) => (
              <th key={player.id} scope="col" className="scorecard-player">
                <span className="scorecard-place">{rankByPlayerId.get(player.id)}</span>
                <span className="scorecard-player-name">{player.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rounds.map((round) => (
            <tr key={round.handNumber}>
              <th
                scope="row"
                className="scorecard-round"
                aria-label={`Round ${round.handNumber}, ${round.cardsDealt} cards`}
              >
                <span className="scorecard-round-num">{round.cardsDealt}</span>
              </th>
              {round.cells.map((cell, index) => {
                const player = players[index];
                if (!cell) {
                  return (
                    <td key={player?.id ?? index} className="scorecard-cell is-empty">
                      <span className="muted">—</span>
                    </td>
                  );
                }
                return (
                  <td
                    key={player?.id ?? index}
                    className={[
                      "scorecard-cell",
                      cell.burned ? "is-burn" : "",
                      cell.forcedBurn ? "is-forced-burn" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    title={cell.forcedBurn ? "Forced burn" : undefined}
                  >
                    <span
                      className={`scorecard-total${cell.runningTotal < 0 ? " negative" : ""}`}
                    >
                      {cell.runningTotal}
                    </span>
                    <span className="scorecard-detail">
                      {cell.bid} / {cell.taken}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
