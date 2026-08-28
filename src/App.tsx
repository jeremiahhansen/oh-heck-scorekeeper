import { useEffect, useState } from "react";
import type { Game, Round } from "./domain/types";
import {
  deleteGame,
  loadStore,
  setActiveGameId,
  upsertGame,
} from "./storage/persistence";
import { GameSetup } from "./ui/GameSetup";
import { GamesOverview } from "./ui/GamesOverview";
import { GameOverview } from "./ui/GameOverview";
import { ImportGame } from "./ui/ImportGame";
import { RoundEntry } from "./ui/RoundEntry";
import { ExportScreen } from "./ui/Export";

type Screen = "overview" | "setup" | "import" | "entry" | "gameOverview" | "export";

interface AppState {
  games: Game[];
  game: Game | null;
  screen: Screen;
}

function isComplete(game: Game): boolean {
  return game.rounds.length >= game.cardsSequence.length;
}

function initialState(): AppState {
  const store = loadStore();
  const active =
    store.activeGameId === null
      ? null
      : (store.games.find((game) => game.id === store.activeGameId) ?? null);

  if (active && !isComplete(active)) {
    return {
      games: store.games,
      game: active,
      screen: "entry",
    };
  }

  return {
    games: store.games,
    game: null,
    screen: "overview",
  };
}

export default function App() {
  const [state, setState] = useState<AppState>(initialState);
  const { games, game, screen } = state;

  // Autosave on every change so a locked or crashed phone loses nothing.
  useEffect(() => {
    if (game) upsertGame(game);
  }, [game]);

  function startGame(newGame: Game) {
    const store = upsertGame(newGame);
    setState({
      games: store.games,
      game: newGame,
      screen: "entry",
    });
  }

  function importGame(imported: Game) {
    const store = upsertGame(imported);
    setState({
      games: store.games,
      game: imported,
      screen: "gameOverview",
    });
  }

  function openGame(selected: Game) {
    const store = setActiveGameId(selected.id);
    setState({
      games: store.games,
      game: selected,
      screen: "gameOverview",
    });
  }

  function saveRound(round: Round) {
    setState((previous) => {
      if (!previous.game) return previous;
      const existing = previous.game.rounds;
      const index = existing.findIndex((item) => item.handNumber === round.handNumber);
      let rounds: Round[];
      if (index >= 0) {
        rounds = existing.map((item, i) => (i === index ? round : item));
      } else if (round.handNumber === existing.length + 1) {
        rounds = [...existing, round];
      } else {
        return previous;
      }

      const wasComplete = isComplete(previous.game);
      const nextGame = { ...previous.game, rounds };
      const nowComplete = isComplete(nextGame);
      return {
        ...previous,
        game: nextGame,
        screen: !wasComplete && nowComplete ? "export" : "entry",
      };
    });
  }

  function goNewGame() {
    setState((previous) => ({
      ...previous,
      game: null,
      screen: "setup",
    }));
  }

  function goImportGame() {
    setState((previous) => ({
      ...previous,
      game: null,
      screen: "import",
    }));
  }

  function goHome() {
    const store = loadStore();
    setState({
      games: store.games,
      game: null,
      screen: "overview",
    });
  }

  function goGameOverview() {
    setState((previous) => {
      if (!previous.game) return { ...previous, screen: "overview" };
      return { ...previous, screen: "gameOverview" };
    });
  }

  function removeGame() {
    if (!game) return;
    const store = deleteGame(game.id);
    setState({
      games: store.games,
      game: null,
      screen: "overview",
    });
  }

  if (screen === "overview") {
    return (
      <div className="app">
        <GamesOverview
          games={games}
          onNewGame={goNewGame}
          onImportGame={goImportGame}
          onOpenGame={openGame}
        />
      </div>
    );
  }

  if (screen === "import") {
    return (
      <div className="app">
        <ImportGame games={games} onImport={importGame} onCancel={goHome} />
      </div>
    );
  }

  if (screen === "setup") {
    return (
      <div className="app">
        <GameSetup onStart={startGame} onCancel={goHome} />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="app">
        <GamesOverview
          games={games}
          onNewGame={goNewGame}
          onImportGame={goImportGame}
          onOpenGame={openGame}
        />
      </div>
    );
  }

  if (screen === "gameOverview") {
    return (
      <div className="app">
        <GameOverview
          game={game}
          onContinue={() => setState((previous) => ({ ...previous, screen: "entry" }))}
          onExport={() => setState((previous) => ({ ...previous, screen: "export" }))}
          onAllGames={goHome}
          onDelete={removeGame}
        />
      </div>
    );
  }

  if (screen === "export") {
    return (
      <div className="app">
        <ExportScreen
          game={game}
          onBackToEntry={() => setState((previous) => ({ ...previous, screen: "entry" }))}
          onBackToOverview={goGameOverview}
          onNewGame={goNewGame}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <RoundEntry
        key={game.id}
        game={game}
        onSave={saveRound}
        onExport={() => setState((previous) => ({ ...previous, screen: "export" }))}
        onOverview={goGameOverview}
        onHome={goHome}
      />
    </div>
  );
}
