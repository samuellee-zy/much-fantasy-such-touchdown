import { masthead } from "./components/masthead.js";
import { buildHighlights, highlightReel } from "./components/highlights.js";
import { wrappedViewer } from "./components/wrapped.js";
import { profileDialog } from "./components/identity.js";
import { labGames, matchupLab } from "./components/matchup-lab.js";
import { notebookPanel } from "./components/notebook.js";
import { points } from "../analysis/format.js";
import { esc } from "./html.js";
import { resultCard, managerReport } from "./components/matchup.js";
import { standingsPanel, awardPanel } from "./components/standings.js";
import { previewSection } from "./components/preview.js";
export function render(f, issue, columns) {
  const notebook = columns.notebook
    ? notebookPanel(f, issue.notebook || [])
    : "";
  const games = labGames(f);
  const scenes = buildHighlights(f, games, columns.preview);
  const lead = scenes[0];
  const high = f.standings
    .filter((t) => t.score !== null)
    .sort((a, b) => b.score - a.score)[0];
  const closest = [...f.games].sort((a, b) => a.margin - b.margin)[0];
  const scores = f.standings
    .filter((t) => t.score !== null)
    .map((t) => t.score);
  const weekAvg = points(
    Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
  );
  const idle = f.standings.filter((t) => t.score === null);
  const sections = `<a href="#recap">Results</a>${notebook ? '<a href="#notebook">NFL notebook</a>' : ""}${columns.standings ? '<a href="#standings">Standings</a>' : ""}${columns.preview ? '<a href="#next">Week ahead</a>' : ""}`;
  const title = `Week ${f.week} · The Touchdown Post`;
  const link = `https://sleeper.com/leagues/${encodeURIComponent(f.leagueId)}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(lead.deck)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(lead.deck)}"><meta name="theme-color" content="#143b30"><link rel="stylesheet" href="./assets/paper.css"><link rel="stylesheet" href="./assets/show.css?v=3"><link rel="stylesheet" href="./assets/wrapped.css"><script type="module" src="./assets/js/issue.js?v=3"></script></head>
<body data-issue="${esc(f.leagueId)}-${esc(f.season)}-${f.week + 1}">${masthead(f, issue, "week", sections, "recap")}
<main class="wrap" id="top">${highlightReel(f, scenes)}
<div class="stat-strip"><div><span>Top score</span><b>${points(high.score)}</b><small>${esc(high.name)}</small></div><div><span>Closest margin</span><b>${points(closest.margin)}</b><small>points apart</small></div><div><span>League average</span><b>${weekAvg}</b><small>points per team</small></div></div>
${matchupLab(f, games)}<div class="body-grid"><section id="recap"><div class="section-heading"><div><span class="eyebrow">Week ${f.week} results</span><h2>Matchup breakdown</h2></div><span class="count">${f.games.length} games</span></div>
${f.games.map((g) => resultCard(g, f, issue.managers, closest.id)).join("")}${idle.length ? '<article class="match"><h3>Off the slate</h3>' + idle.map((t) => managerReport(t, issue.managers[t.id])).join("") + "</article>" : ""}</section>
<aside><section id="roast-draw" class="roast-draw" hidden><span class="eyebrow">League banter</span><h2>Roast roulette</h2><p data-draw-result aria-live="polite">Deal a manager’s roast from this week’s results.</p><div><button type="button">Draw a roast</button><a data-draw-link hidden>Read the recap</a></div></section>${columns.standings ? standingsPanel(f) : ""}${columns.awards ? awardPanel(f) : ""}${notebook}</aside></div>
${columns.preview ? previewSection(f, issue.previewResearch) : ""}</main>
<footer><div class="wrap"><b>The Touchdown Post</b><span>Week ${f.week} · ${esc(f.season)}</span><a href="${link}">League data from Sleeper</a></div></footer>${profileDialog(wrappedViewer(f, issue, columns.preview))}</body></html>\n`.replace(
    /[ \t]+$/gm,
    "",
  );
}
