import { scorecardMatrix } from "../domain/scoring";
import type { Game } from "../domain/types";

interface ScorecardProps {
  game: Game;
}

export function Scorecard({ game }: ScorecardProps) {
  const { players, rounds } = scorecardMatrix(game);

  return (
    <div className="scorecard-scroller">
      <table className="scorecard">
        <thead>
          <tr>
            <th className="scorecard-corner" scope="col" />
            {players.map((player) => (
              <th key={player.id} scope="col" className="scorecard-player">
                {player.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rounds.map((round) => (
            <tr key={round.handNumber}>
              <th scope="row" className="scorecard-round">
                <span className="scorecard-round-num">R{round.handNumber}</span>
                <span className="muted"> · {round.cardsDealt}</span>
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
                    className={`scorecard-cell${cell.burned ? " is-burn" : ""}`}
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
