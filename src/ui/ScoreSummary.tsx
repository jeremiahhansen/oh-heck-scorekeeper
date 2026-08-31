import { standings } from "../domain/scoring";
import type { Game } from "../domain/types";

interface ScoreSummaryProps {
  game: Game;
}

/** Ranked totals with burn counts — same table as on the round entry screen. */
export function ScoreSummary({ game }: ScoreSummaryProps) {
  if (game.rounds.length === 0) return null;

  return (
    <div className="card score-summary">
      <h2>Score summary</h2>
      <table className="summary-table">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>Player</th>
            <th className="num">Tricks</th>
            <th className="num">Burns</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {standings(game).map(({ player, total, tricks, burns, rank }) => (
            <tr key={player.id}>
              <td className="num muted">{rank}</td>
              <td>{player.name}</td>
              <td className="num muted">{tricks}</td>
              <td className="num muted">{burns}</td>
              <td className={`num${total < 0 ? " negative" : ""}`}>{total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
