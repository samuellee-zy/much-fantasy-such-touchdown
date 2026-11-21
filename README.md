# The Touchdown Post

The weekly fantasy football newsletter for **Much Fantasy. So Touchdown.** Each issue covers the latest completed Sleeper week, every manager’s lineup, the playoff race, and the next slate. [Read the current issue](https://samuellee-zy.github.io/much-fantasy-such-touchdown/).

## Publish this week

On the publishing Mac, run `npm run weekly` from this checkout. You can also ask Codex here to “publish this week’s newsletter.” Use Node.js 22 or newer, Git access to the repository, and a signed-in Codex CLI for the AI column. The project uses Node’s built-in modules and works without an npm install.

The command fetches Sleeper’s latest completed scoring week and the following pairings. It validates the scores, writes the edition, commits the generated files, pushes to `main`, and verifies the public page. Run it after Sleeper advances the scored week. Run it again after a scoring correction. An unchanged issue keeps its publication date and prose. GitHub Pages serves the `docs/` directory on `main`.

Use `npm run build` to generate the issue locally. Open `docs/index.html` to preview it. Run `npm test` for the scoring, writing, and rendering checks.

## Change the edition

Set the Sleeper league ID, writing model, public URL, and optional standings, awards, and preview columns in `league.json`. Update the league ID at season rollover. The current league uses regular-season head-to-head records with points as the tiebreak and single-week playoff matchups.

| Directory | Responsibility |
| --- | --- |
| `src/data/` | Fetch Sleeper history, rosters, upcoming fixtures, and the cached NFL player directory. |
| `src/analysis/` | Calculate standings, matchup results, position-group margins, league slot rankings, recent scoring trends, and single-slot bench comparisons. |
| `src/editorial/` | Run the local Codex writer and search the live web for dated, attributable reporting from the NFL and its teams. |
| `src/site/components/` | Render reusable matchup, team analysis, standings, weekly award, preview, and NFL notebook sections. |
| `docs/` | Serve the current static edition and its locally hosted assets through GitHub Pages. |
| `test/` | Exercise scoring, player coverage, editorial fallback, source verification, and the rendered edition. |

The entry point is `src/weekly.js`. The current issue’s prose and dated sources are saved in `edition.json`. Each manager has an expandable player breakdown. Starter rankings compare players in the same assigned league slot. Historical player averages use recorded scores from the preceding three league weeks. Bench scenarios change a single eligible slot, keeping the opponent and all other selections fixed.

The NFL notebook checks short passages against official article text, publication dates, named players, and the issue week. The site links to each original article. Validated reports carry forward on repeat runs of the same issue. If new reporting is unavailable, the weekly league analysis can still publish.

The masthead photograph shows Carlisle playing Dartmouth at the Polo Grounds. [Library of Congress collection record](https://www.loc.gov/pictures/item/2014694757/). DM Sans and DM Serif Text use the SIL Open Font License included with each font in `docs/assets/`.
