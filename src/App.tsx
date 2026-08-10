import { useEffect, useState } from "react";
import type { Entry, Game, Round } from "./domain/types";
import { clearGame, loadGame, saveGame } from "./storage/persistence";
import { GameSetup } from "./ui/GameSetup";
import { RoundEntry } from "./ui/RoundEntry";
import { ExportScreen } from "./ui/Export";

type Screen = "setup" | "entry" | "export";

interface AppState {
  game: Game | null;
  screen: Screen;
  /**
   * Entries loaded back into the form when a recorded round is reopened for
   * correction. Null means start the round blank.
   */
  resumeEntries: Record<string, Entry> | null;
}

function initialState(): AppState {
  const game = loadGame();
  if (!game) return { game: null, screen: "setup", resumeEntries: null };
  const complete = game.rounds.length >= game.cardsSequence.length;
  return { game, screen: complete ? "export" : "entry", resumeEntries: null };
}

export default function App() {
  const [state, setState] = useState<AppState>(initialState);
  const { game, screen, resumeEntries } = state;

  // Autosave on every change so a locked or crashed phone loses nothing.
  useEffect(() => {
    if (game) saveGame(game);
  }, [game]);

  function startGame(newGame: Game) {
    setState({ game: newGame, screen: "entry", resumeEntries: null });
  }

  function recordRound(round: Round) {
    setState((previous) => {
      if (!previous.game) return previous;
      const rounds = [...previous.game.rounds, round];
      const complete = rounds.length >= previous.game.cardsSequence.length;
      return {
        game: { ...previous.game, rounds },
        screen: complete ? "export" : "entry",
        resumeEntries: null,
      };
    });
  }

  /** Pull the last recorded round back into the form so it can be corrected. */
  function reopenLastRound() {
    setState((previous) => {
      if (!previous.game || previous.game.rounds.length === 0) return previous;
      const rounds = [...previous.game.rounds];
      const reopened = rounds.pop();
      return {
        game: { ...previous.game, rounds },
        screen: "entry",
        resumeEntries: reopened ? reopened.entries : null,
      };
    });
  }

  function newGame() {
    clearGame();
    setState({ game: null, screen: "setup", resumeEntries: null });
  }

  if (!game || screen === "setup") {
    return (
      <div className="app">
        <GameSetup onStart={startGame} />
      </div>
    );
  }

  if (screen === "export") {
    return (
      <div className="app">
        <ExportScreen
          game={game}
          onBackToEntry={() => setState((previous) => ({ ...previous, screen: "entry" }))}
          onNewGame={newGame}
        />
      </div>
    );
  }

  return (
    <div className="app">
      {/* Keyed by round so each round starts from a fresh form. */}
      <RoundEntry
        key={game.rounds.length}
        game={game}
        initialEntries={resumeEntries}
        onRecord={recordRound}
        onReopenLastRound={reopenLastRound}
        onExport={() => setState((previous) => ({ ...previous, screen: "export" }))}
      />
    </div>
  );
}
