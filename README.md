# Oh Heck Scorekeeper

An offline, installable web app for keeping score at a game of **Oh Heck**, built to
replace the paper scoresheet. It exports CSV in exactly the format produced by
[oh-heck-scoresheets](../../Repos/oh-heck-scoresheets), so games scored on a phone and games
read from a photographed sheet land in the same analysis.

Three screens, nothing more:

1. **Setup** - date, optional game number, 2 to 9 players in seat order, who deals first.
2. **Round entry** - one round at a time, a row per player with tricks bid, tricks taken, and
   a forced-burn toggle. Rows follow the bidding order, so the dealer is always the bottom row.
3. **Export** - final scores plus CSV, sent through the iOS share sheet.

## Running it locally

Requires Node.js 20 or newer.

```powershell
npm install
npm run dev
```

Then open http://localhost:5173.

## Getting it onto an iPhone

### Quick testing over Wi-Fi

```powershell
npm run dev:lan
```

Vite prints a `Network:` address such as `http://192.168.1.42:5173`. Open that in Safari on a
phone connected to the same Wi-Fi. Note that a plain-http LAN address is not a "secure context",
so the service worker and Add to Home Screen won't work there - it's for trying out the screens,
not for installing.

### Installing it properly

Installing needs HTTPS. Build and deploy the static output anywhere that serves it over TLS:

```powershell
npm run build      # writes dist/
```

`dist/` is a plain static folder, so GitHub Pages, Netlify, and Vercel all work with no
configuration. The Vite `base` is relative, so serving from a subpath such as
`https://user.github.io/oh-heck-scorekeeper/` is fine.

Then, on the phone: open the URL in **Safari** (not Chrome), tap **Share**, and choose
**Add to Home Screen**. After that it launches full-screen with its own icon and works with no
network at all.

## Scoring rules encoded here

| Outcome | Condition | Points |
| --- | --- | --- |
| Made Bid | tricks taken equals tricks bid | `5 + tricks taken` |
| Burn | anything else | `-abs(bid - taken)` |

`src/domain/scoring.ts` is a direct port of `csv_writer.py` from the scoresheets project, and
`tests/csv.test.ts` checks it against a real 7-player, 13-round reference export, so the two
tools cannot drift apart silently.

### Cards per round

The sequence is derived from the player count, because a 52-card deck limits how much can be
dealt to everyone at once: `maxCards = min(7, floor(52 / players))`. The sequence descends from
that maximum to 1, climbs back, then repeats the maximum at both ends to fill 13 rounds.

| Players | Cards per round |
| --- | --- |
| 2 to 7 | 7, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 7 |
| 8 | 6, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 6 |
| 9 | 5, 5, 5, 4, 3, 2, 1, 2, 3, 4, 5, 5, 5 |

Every game is 13 rounds with the single-card round in the middle and six rounds either side, the
first six counting down and the last six counting back up. There is nothing to configure, so setup
doesn't ask.

### The dealer, the hook, and forced burns

The starting dealer deals round 1 and the deal moves one seat per round. Knowing the dealer lets
the entry screen show the one bid the dealer cannot make - the value that would leave the table's
bids summing exactly to the cards dealt.

It also sets the row order. Entry rows run in bidding order, starting with the dealer's left-hand
neighbour and ending with the dealer, which is a rotation of seat order rather than a re-sort, so
everyone stays in the same relative position round to round.

**Forced burn stays a manual toggle.** On the reference scoresheets the `FB` marks always land on
the dealer's cell, but they are not mechanically derivable: in one hand the dealer was hooked off
a 0 bid, still made 1 for 1, and was marked `FB`, while in another hand a dealer was hooked
identically and was not marked. It records the scorekeeper's judgment about being forced off the
bid they wanted, so the app highlights the dealer's row and leaves the call to you. This is still
an improvement over the OCR path, where the column is hardcoded to `No` because the shaded
markers produced too many false positives.

### Validation during entry

Recording a round is blocked until it is coherent, which catches typos on the spot in a way paper
never did:

- The tricks taken must total the cards dealt.
- The bids must not total the cards dealt, because the hook rule makes that impossible.
- Steppers are clamped to `0..cardsDealt`, so out-of-range values can't be entered at all.

Each problem carries a code rather than just a message, so the screen can hold back the
tricks-taken mismatch while the bids are still being entered instead of nagging about a total that
cannot be right yet.

## Export format

One row per player per round, ordered by player position then hand number:

```
Game Number,Game Date,Player Name,Player Position,Hand Number,Cards Dealt,Tricks Bid,Tricks Taken,Forced Burn Flag,Hand Status,Hand Score
```

Lines end with CRLF and dates are `YYYY-MM-DD`, matching Python's `csv` writer and
`format_game_date`. The OCR tool's leading `Source File` column is omitted, since there is no
source image; `gameToCsv(game, { includeSourceFile: true, sourceFile: "..." })` adds it back for
concatenating the two tools' output.

**Share CSV** hands the file to the iOS share sheet for Mail, Files, or AirDrop. **Download** and
**Copy** are there for desktop browsers and as fallbacks.

## Data and durability

One game at a time, autosaved to `localStorage` after every tap, so a locked or crashed phone
loses nothing. Reopening the app resumes exactly where you left off.

iOS can evict a web app's storage if it goes unused for a long stretch, so treat the CSV export as
the real archive: export at the end of each game. Starting a new game discards the previous one,
which is why that button asks twice.

## Project layout

```
src/
  domain/          rules, scoring, CSV. No React, no DOM - portable as-is
    types.ts       Player, Entry, Round, Game
    rules.ts       cards-per-round derivation, dealer rotation, hook rule, validation
    scoring.ts     hand status, hand score, running totals, standings
    csv.ts         export columns and serialization
  storage/
    persistence.ts localStorage autosave, with runtime validation on load
  ui/              GameSetup, RoundEntry, Export
  components/      Stepper
tests/
  rules.test.ts    card sequences, dealer rotation, hook rule, round validation
  scoring.test.ts  scoring formulas and standings
  csv.test.ts      golden test against tests/fixtures/sample1_input.csv
  app.test.tsx     full walkthrough of the three screens
scripts/
  generate-icons.mjs   renders public/icon.svg into the PNG sizes iOS needs
```

Everything in `src/domain/` is deliberately free of React and DOM references. That keeps two
future options cheap: wrapping this codebase with [Capacitor](https://capacitorjs.com) to ship an
App Store build with no UI rewrite, or moving to React Native and reusing the whole folder while
replacing only the views.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server on localhost |
| `npm run dev:lan` | Dev server reachable from a phone on the same Wi-Fi |
| `npm run build` | Type check, then build to `dist/` |
| `npm run preview` | Serve the built output locally |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Re-run tests on change |
| `npm run icons` | Regenerate the PNG icons from `public/icon.svg` |

## Not built yet

Deliberately left out of this first version: the full scoresheet grid view, keeping a library of
past games, tournament standings across games, JSON backup and restore, and the placings and notes
that appear on the paper sheet. The CSV export is the bridge to all of it, so none of them require
reworking the data model.
