import { useState } from "react";
import { csvFilename, gameToCsv } from "../domain/csv";
import { standings } from "../domain/scoring";
import type { Game } from "../domain/types";

interface ExportScreenProps {
  game: Game;
  onBackToEntry: () => void;
  onBackToOverview: () => void;
  onNewGame: () => void;
}

interface Status {
  text: string;
  isError: boolean;
}

/**
 * Web Share is feature-detected through a narrow local shape rather than the
 * DOM lib, so this compiles the same way regardless of the TypeScript version's
 * view of navigator.share.
 */
const shareApi = navigator as unknown as {
  canShare?: (data: unknown) => boolean;
  share?: (data: unknown) => Promise<void>;
};

const PREVIEW_LINES = 12;

export function ExportScreen({
  game,
  onBackToEntry,
  onBackToOverview,
  onNewGame,
}: ExportScreenProps) {
  const [status, setStatus] = useState<Status | null>(null);

  const csv = gameToCsv(game);
  const filename = csvFilename(game);
  const rowCount = csv.trimEnd().split("\r\n").length - 1;
  const complete = game.rounds.length >= game.cardsSequence.length;

  const lines = csv.trimEnd().split("\r\n");
  const preview = lines.slice(0, PREVIEW_LINES).join("\n");

  function download() {
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    setStatus({ text: `Saved ${filename}.`, isError: false });
  }

  async function share() {
    const file = new File([csv], filename, { type: "text/csv" });
    if (!shareApi.share || !shareApi.canShare?.({ files: [file] })) {
      download();
      return;
    }
    try {
      await shareApi.share({ files: [file], title: filename });
      setStatus({ text: "Sent to the share sheet.", isError: false });
    } catch (error) {
      // Dismissing the iOS share sheet rejects with AbortError; that's not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus({ text: "Sharing failed. Try Download instead.", isError: true });
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(csv);
      setStatus({ text: "CSV copied to the clipboard.", isError: false });
    } catch {
      setStatus({ text: "Couldn't reach the clipboard. Use Share or Download.", isError: true });
    }
  }

  return (
    <>
      <h1>{complete ? "Game complete" : "Export"}</h1>
      <p className="subtitle">
        {game.gameDate}
        {game.gameNumber !== null && ` · Game #${game.gameNumber}`}
        {` · ${game.rounds.length} of ${game.cardsSequence.length} rounds`}
      </p>

      <div className="card">
        <h2>Final scores</h2>
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
      </div>

      <div className="card">
        <h2>CSV</h2>
        <p className="hint">
          {rowCount} rows, one per player per round. Same columns as the scoresheet reader, so this
          drops straight into the same analysis.
        </p>
        <button type="button" className="primary" onClick={share}>
          Share CSV
        </button>
        <div className="button-row" style={{ marginTop: 10 }}>
          <button type="button" className="ghost" onClick={download}>
            Download
          </button>
          <button type="button" className="ghost" onClick={copy}>
            Copy
          </button>
        </div>
        {status && (
          <p className={`status-line${status.isError ? " error" : ""}`}>{status.text}</p>
        )}
        <details style={{ marginTop: 12 }}>
          <summary className="muted">Preview</summary>
          <pre className="csv-preview" style={{ marginTop: 8 }}>
            {preview}
            {lines.length > PREVIEW_LINES && `\n… ${lines.length - PREVIEW_LINES} more rows`}
          </pre>
        </details>
      </div>

      <div className="footer">
        <button type="button" className="primary" onClick={onNewGame}>
          Start a new game
        </button>
        <div className="footer-nav">
          {!complete && (
            <button type="button" className="ghost" onClick={onBackToEntry}>
              Round {game.rounds.length + 1}
            </button>
          )}
          <button type="button" className="ghost" onClick={onBackToOverview}>
            Overview
          </button>
        </div>
      </div>
    </>
  );
}
