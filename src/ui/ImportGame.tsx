import { useState } from "react";
import { csvToGame } from "../domain/csv";
import type { Game } from "../domain/types";

interface ImportGameProps {
  onImport: (game: Game) => void;
  onCancel: () => void;
}

export function ImportGame({ onImport, onCancel }: ImportGameProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleImport() {
    const result = csvToGame(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onImport(result.game);
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
        <button type="button" className="primary" onClick={handleImport} disabled={!text.trim()}>
          Import game
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
