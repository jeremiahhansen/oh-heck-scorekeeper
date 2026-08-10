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
  /** Entries to prefill when a recorded round has been reopened. */
  initialEntries: Record<string, Entry> | null;
  onRecord: (round: Round) => void;
  onReopenLastRound: () => void;
  onExport: () => void;
}

const BLANK_ENTRY: Entry = { bid: 0, taken: 0, forcedBurn: false };

export function RoundEntry({
  game,
  initialEntries,
  onRecord,
  onReopenLastRound,
  onExport,
}: RoundEntryProps) {
  const seated = playersInSeatOrder(game);
  const totalRounds = game.cardsSequence.length;
  const roundIndex = game.rounds.length;
  const handNumber = roundIndex + 1;
  const cardsDealt = game.cardsSequence[roundIndex] ?? 0;
  const dealer = dealerForRound(game, handNumber);
  // Rows follow the bidding order, so the dealer is always the bottom row.
  const bidOrder = playersInBiddingOrder(game, handNumber);

  const [entries, setEntries] = useState<Record<string, Entry>>(() => {
    const start: Record<string, Entry> = {};
    for (const player of seated) {
      start[player.id] = initialEntries?.[player.id] ?? { ...BLANK_ENTRY };
    }
    return start;
  });

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

  // During the bidding phase no tricks have been entered yet, so don't nag
  // about a total that can't be right until it's being filled in.
  const visibleProblems = validation.problems.filter(
    (problem) => problem.code !== "taken-total" || validation.takenTotal > 0,
  );

  function record() {
    if (!validation.canRecord || !dealer) return;
    const roundEntries: Record<string, Entry> = {};
    for (const player of seated) roundEntries[player.id] = { ...entryFor(player.id) };
    onRecord({ handNumber, cardsDealt, dealerId: dealer.id, entries: roundEntries });
  }

  if (roundIndex >= totalRounds) {
    return (
      <>
        <h1>All {totalRounds} rounds recorded</h1>
        <p className="subtitle">Nothing left to enter for this game.</p>
        <div className="footer">
          <button type="button" className="primary" onClick={onExport}>
            Go to export
          </button>
        </div>
      </>
    );
  }

  return (
    <>
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
          <span className="col-label narrow" title="Forced burn">
            FB
          </span>
        </div>
        {bidOrder.map((player) => {
          const entry = entryFor(player.id);
          const isDealer = player.id === dealer?.id;
          return (
            <div className={`entry-row${isDealer ? " is-dealer" : ""}`} key={player.id}>
              <span className="player-name">
                {player.name}
                {isDealer && <span className="dealer-tag">deals</span>}
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
              <button
                type="button"
                className="burn-toggle"
                aria-pressed={entry.forcedBurn}
                aria-label={`Forced burn for ${player.name}`}
                onClick={() => update(player.id, { forcedBurn: !entry.forcedBurn })}
              >
                FB
              </button>
            </div>
          );
        })}

        <div className="entry-row totals">
          <span className="muted">Totals</span>
          <span className={`total-cell${bidsIllegal ? " bad" : ""}`}>{validation.bidTotal}</span>
          <span className={`total-cell${balanced ? " ok" : ""}`}>
            {validation.takenTotal} of {cardsDealt}
          </span>
          <span />
        </div>
      </div>

      {roundIndex > 0 && (
        <ul className="standings">
          {standings(game).map(({ player, total }) => (
            <li key={player.id}>
              <span>{player.name}</span>
              <span className={`total${total < 0 ? " negative" : ""}`}>{total}</span>
            </li>
          ))}
        </ul>
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
          onClick={record}
          disabled={!validation.canRecord}
        >
          {handNumber >= totalRounds ? "Record final round" : `Record round ${handNumber}`}
        </button>

        <div className="button-row" style={{ marginTop: 10 }}>
          {roundIndex > 0 && (
            <button type="button" className="ghost" onClick={onReopenLastRound}>
              Fix round {roundIndex}
            </button>
          )}
          <button type="button" className="ghost" onClick={onExport}>
            Export
          </button>
        </div>
      </div>
    </>
  );
}
