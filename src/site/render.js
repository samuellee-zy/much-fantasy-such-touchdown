import { matchupLab } from "./components/matchup-lab.js";
import { notebookPanel } from "./components/notebook.js";
import { points } from "../analysis/format.js";
import { esc } from "./html.js";
import { resultCard, managerReport } from "./components/matchup.js";
import { standingsPanel, awardPanel } from "./components/standings.js";
import { previewSection } from "./components/preview.js";
function headlines(f) {
  const sorted = [...f.games].sort((a, b) => a.margin - b.margin);
  const closest = sorted[0];
  const [a, b] = closest.ids.map((id) => f.teams[id]);
  const high = f.standings
    .filter((t) => t.score !== null)
    .sort((x, y) => y.score - x.score)[0];
  let headline, deck;
  if (f.champion) {
    headline = `${f.champion} takes the title.`;
    deck =
      "The championship is settled. Here’s how the final slate played out for every manager.";
  } else if (!closest.margin) {
    headline = "Even the decimals called it a draw.";
    deck = `${a.name} and ${b.name} both finished on ${points(a.score)}. All that lineup tinkering, and the scoreboard still couldn’t pick a side.`;
  } else if (closest.margin >= 3000) {
    headline = "Suspense took a bye week.";
    deck = `The closest game was decided by ${points(closest.margin)} points. ${high.name} set the pace with ${points(high.score)} in a week that did very little for anyone’s blood pressure.`;
  } else if (closest.margin <= 300) {
    headline = "A win you could fit in your pocket.";
    deck = `Just ${points(closest.margin)} separated ${a.name} and ${b.name}. Elsewhere, ${high.name} gave the rest of the scoreboard a target of ${points(high.score)}.`;
  } else {
    headline = `${high.name} sets the pace.`;
    deck = `The weekly high came in at ${points(high.score)}. At the other end of the drama scale, ${a.name} and ${b.name} finished ${points(closest.margin)} apart.`;
  }
  return { headline, deck, closest, high };
}
export function render(f, issue, columns) {
  const notebook = columns.notebook
    ? notebookPanel(f, issue.notebook || [])
    : "";
  const lead = headlines(f);
  const { high, closest } = lead;
  const scores = f.standings
    .filter((t) => t.score !== null)
    .map((t) => t.score);
  const weekAvg = points(
    Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
  );
  const idle = f.standings.filter((t) => t.score === null);
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(issue.publishedAt));
  const title = `Week ${f.week} · The Touchdown Post`;
  const link = `https://sleeper.com/leagues/${encodeURIComponent(f.leagueId)}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(lead.deck)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(lead.deck)}"><meta name="theme-color" content="#143b30"><link rel="stylesheet" href="./assets/paper.css"><script type="module" src="./assets/js/issue.js"></script></head>
<body data-issue="${esc(f.leagueId)}-${esc(f.season)}-${f.week + 1}"><a class="skip" href="#recap">Skip to matchups</a><header class="bar"><div class="wrap toolbar"><a href="#top" class="brand"><span class="ball" aria-hidden="true"><i></i></span>${esc(f.name)}</a>
<nav aria-label="Issue sections"><a href="#recap">Results</a>${notebook ? '<a href="#notebook">NFL notebook</a>' : ""}${columns.standings ? '<a href="#standings">Standings</a>' : ""}${columns.preview ? '<a href="#next">Week ahead</a>' : ""}</nav><a class="sleeper" href="${link}">View on Sleeper</a></div></header>
<main class="wrap" id="top"><div class="mast"><p class="mast-title">The Touchdown Post</p><div class="issue-date"><span>${esc(f.season)} SEASON</span><time datetime="${esc(issue.publishedAt.slice(0, 10))}">${date}</time></div></div>
<article class="lead"><div class="lead-text"><div class="edition-label"><span>Week ${f.week}</span> <b>League report</b></div><h1>${esc(lead.headline)}</h1><p>${esc(lead.deck)}</p><div class="lead-actions"><a class="action" href="#lab" data-enable-js hidden>Explore the matchup lab</a>${columns.preview ? '<a href="#next">Scout the week ahead</a>' : ""}</div></div>
<figure><img src="./assets/carlisle-dartmouth.jpg" width="1024" height="747" alt="Archival football players sprint across the Polo Grounds during Carlisle versus Dartmouth"><figcaption>Carlisle vs. Dartmouth <span>·</span> <a href="https://www.loc.gov/pictures/item/2014694757/">Library of Congress</a></figcaption></figure></article>
<div class="stat-strip"><div><span>Top score</span><b>${points(high.score)}</b><small>${esc(high.name)}</small></div><div><span>Closest margin</span><b>${points(closest.margin)}</b><small>points apart</small></div><div><span>League average</span><b>${weekAvg}</b><small>points per team</small></div></div>
${matchupLab(f)}<div class="body-grid"><section id="recap"><div class="section-heading"><div><span class="eyebrow">Week ${f.week} results</span><h2>Matchup breakdown</h2></div><label class="team-jump" data-enable-js hidden>Find your team<select id="team-jump"><option value="">Select a team</option>${f.standings.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></label></div>
${f.games.map((g) => resultCard(g, f, issue.managers, closest.id)).join("")}${idle.length ? '<article class="match"><h3>Off the slate</h3>' + idle.map((t) => managerReport(t, issue.managers[t.id])).join("") + "</article>" : ""}</section>
<aside><section id="roast-draw" class="roast-draw" hidden><span class="eyebrow">League banter</span><h2>Roast roulette</h2><p data-draw-result aria-live="polite">Draw a manager from this week’s roasting tin.</p><div><button type="button">Draw a roast</button><a data-draw-link hidden>Read the recap</a></div></section>${columns.standings ? standingsPanel(f) : ""}${columns.awards ? awardPanel(f) : ""}${notebook}</aside></div>
${columns.preview ? previewSection(f, issue.previewResearch) : ""}</main>
<footer><div class="wrap"><b>The Touchdown Post</b><span>Week ${f.week} · ${esc(f.season)}</span><a href="${link}">League data from Sleeper</a></div></footer></body></html>\n`.replace(
    /[ \t]+$/gm,
    "",
  );
}
