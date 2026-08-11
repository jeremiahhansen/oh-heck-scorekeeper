import { useState } from "react";
import { Stepper } from "../components/Stepper";
import {
  dealerForRound,
  forbiddenDealerBid,
  playersInBiddingOrder,
  playersInSeatOrder,
  validateRound,
} from "../domain/rules";
import { standings } from "../domain/scoring";
import type { Entry, Game, Round } from "../domain/types";

interface RoundEntryProps {
  game: Game;
  onSave: (round: Round) => void;
  onExport: () => void;
  onOverview: () => void;
  onHome: () => void;
}

const BLANK_ENTRY: Entry = { bid: 0, taken: 0, forcedBurn: false };

function nextHandNumber(game: Game): number {
  const total = game.cardsSequence.length;
  if (game.rounds.length >= total) return total;
  return game.rounds.length + 1;
}

function entriesForHand(game: Game, handNumber: number): Record<string, Entry> {
  const seated = playersInSeatOrder(game);
  const recorded = game.rounds.find((round) => round.handNumber === handNumber);
  const start: Record<string, Entry> = {};
  for (const player of seated) {
    start[player.id] = recorded?.entries[player.id]
      ? { ...recorded.entries[player.id]! }
      : { ...BLANK_ENTRY };
  }
  return start;
}

function maxSelectableHand(game: Game): number {
  const total = game.cardsSequence.length;
  if (game.rounds.length >= total) return total;
  return game.rounds.length + 1;
}

export function RoundEntry({ game, onSave, onExport, onOverview, onHome }: RoundEntryProps) {
  const seated = playersInSeatOrder(game);
  const totalRounds = game.cardsSequence.length;
  const frontier = maxSelectableHand(game);

  const [handNumber, setHandNumber] = useState(() => nextHandNumber(game));
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    entriesForHand(game, nextHandNumber(game)),
  );

  const cardsDealt = game.cardsSequence[handNumber - 1] ?? 0;
  const dealer = dealerForRound(game, handNumber);
  const bidOrder = playersInBiddingOrder(game, handNumber);
  const recorded = game.rounds.some((round) => round.handNumber === handNumber);
  const isFrontier = handNumber === game.rounds.length + 1 && game.rounds.length < totalRounds;

  function selectHand(next: number) {
    if (next < 1 || next > frontier) return;
    setHandNumber(next);
    setEntries(entriesForHand(game, next));
  }

  function update(playerId: string, patch: Partial<Entry>) {
    setEntries((previous) => ({
      ...previous,
      [playerId]: { ...(previous[playerId] ?? BLANK_ENTRY), ...patch },
    }));
  }

  const entryFor = (playerId: string): Entry => entries[playerId] ?? BLANK_ENTRY;
  const validation = validateRound(
    cardsDealt,
    seated.map((player) => entryFor(player.id)),
  );

  const otherBidsTotal = seated.reduce(
    (sum, player) => (player.id === dealer?.id ? sum : sum + entryFor(player.id).bid),
    0,
  );
  const forbidden = dealer ? forbiddenDealerBid(cardsDealt, otherBidsTotal) : null;

  const balanced = validation.takenTotal === cardsDealt;
  const bidsIllegal = validation.problems.some((problem) => problem.code === "bid-total");

  const visibleProblems = validation.problems.filter(
    (problem) => problem.code !== "taken-total" || validation.takenTotal > 0,
  );

  function save() {
    if (!validation.canRecord || !dealer) return;
    if (!recorded && !isFrontier) return;
    const roundEntries: Record<string, Entry> = {};
    for (const player of seated) {
      const entry = entryFor(player.id);
      roundEntries[player.id] = {
        ...entry,
        // Forced burn is a dealer-only judgment call.
        forcedBurn: player.id === dealer.id ? entry.forcedBurn : false,
      };
    }
    const shouldAdvance = isFrontier && handNumber < totalRounds;
    onSave({ handNumber, cardsDealt, dealerId: dealer.id, entries: roundEntries });
    if (shouldAdvance) {
      const next = handNumber + 1;
      setHandNumber(next);
      setEntries(entriesForHand(game, next));
    }
  }

  return (
    <>
      <div className="round-nav" role="navigation" aria-label="Rounds">
        {game.cardsSequence.map((_, index) => {
          const n = index + 1;
          const isRecorded = n <= game.rounds.length;
          const isSelected = n === handNumber;
          const isCurrent = n === game.rounds.length + 1 && game.rounds.length < totalRounds;
          const disabled = n > frontier;
          return (
            <button
              key={n}
              type="button"
              className={[
                "round-nav-pill",
                isSelected ? "is-selected" : "",
                isCurrent ? "is-current" : "",
                isRecorded ? "is-recorded" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-current={isSelected ? "step" : undefined}
              aria-label={`Round ${n}${isRecorded ? ", recorded" : isCurrent ? ", current" : ", locked"}`}
              disabled={disabled}
              onClick={() => selectHand(n)}
            >
              {n}
            </button>
          );
        })}
      </div>

      <div className="round-header">
        <span className="round-title">
          Round {handNumber} of {totalRounds}
        </span>
        <span className="cards-badge">
          {cardsDealt} {cardsDealt === 1 ? "card" : "cards"}
        </span>
      </div>
      <p className="dealer-line">
        {dealer ? (
          <>
            Dealer <strong>{dealer.name}</strong>
          </>
        ) : (
          "Dealer unknown"
        )}
        {dealer && forbidden !== null && (
          <>
            {" · cannot bid "}
            <strong>{forbidden}</strong>
          </>
        )}
      </p>

      <div className="entry-table">
        <div className="entry-row head">
          <span>Player</span>
          <span className="col-label">Bid</span>
          <span className="col-label">Took</span>
        </div>
        {bidOrder.map((player) => {
          const entry = entryFor(player.id);
          const isDealer = player.id === dealer?.id;
          return (
            <div className={`entry-row${isDealer ? " is-dealer" : ""}`} key={player.id}>
              <span className="player-name">
                <span className="player-name-text">{player.name}</span>
                {isDealer && <span className="dealer-tag">deals</span>}
                {isDealer && (
                  <button
                    type="button"
                    className="burn-toggle"
                    aria-pressed={entry.forcedBurn}
                    aria-label={`Forced burn for ${player.name}`}
                    onClick={() => update(player.id, { forcedBurn: !entry.forcedBurn })}
                  >
                    FB
                  </button>
                )}
              </span>
              <Stepper
                label={`tricks bid by ${player.name}`}
                value={entry.bid}
                max={cardsDealt}
                onChange={(bid) => update(player.id, { bid })}
              />
              <Stepper
                label={`tricks taken by ${player.name}`}
                value={entry.taken}
                max={cardsDealt}
                onChange={(taken) => update(player.id, { taken })}
              />
            </div>
          );
        })}

        <div className="entry-row totals">
          <span className="muted">Totals</span>
          <span className={`total-cell${bidsIllegal ? " bad" : ""}`}>{validation.bidTotal}</span>
          <span className={`total-cell${balanced ? " ok" : ""}`}>
            {validation.takenTotal} of {cardsDealt}
          </span>
        </div>
      </div>

      {game.rounds.length > 0 && (
        <div className="card score-summary">
          <h2>Score summary</h2>
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
                  <td className={`num${total < 0 ? " negative" : ""}`}>{total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="footer">
        {visibleProblems.map((problem) => (
          <p className="notice error" key={problem.code}>
            {problem.message}
          </p>
        ))}

        <button
          type="button"
          className="primary"
          onClick={save}
          disabled={!validation.canRecord}
        >
          {recorded
            ? `Save round ${handNumber}`
            : handNumber >= totalRounds
              ? "Record final round"
              : `Record round ${handNumber}`}
        </button>

        <div className="footer-nav">
          <button type="button" className="ghost" onClick={onOverview}>
            Overview
          </button>
          <button type="button" className="ghost" onClick={onHome}>
            All games
          </button>
          <button type="button" className="ghost" onClick={onExport}>
            Export
          </button>
        </div>
      </div>
    </>
  );
}
