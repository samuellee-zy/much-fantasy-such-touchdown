import { esc } from "../html.js";

export function masthead(f, issue, active, sections, skip) {
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(issue.publishedAt));
  return `<a class="skip" href="#${skip}">Skip to content</a><header class="bar"><div class="wrap toolbar">
<a href="./" class="brand"><span class="ball" aria-hidden="true"><i></i></span>${esc(f.name)}</a>
<nav aria-label="Issue sections">${sections}</nav><a class="sleeper" href="https://sleeper.com/leagues/${encodeURIComponent(f.leagueId)}">View on Sleeper</a></div></header>
<div class="wrap"><div class="mast"><p class="mast-title">The Touchdown Post</p><div class="issue-date"><span>${esc(f.season)} SEASON</span><time datetime="${esc(issue.publishedAt.slice(0, 10))}">${date}</time></div></div>
<nav class="edition-nav" aria-label="Editions"><a href="./"${active === "week" ? ' aria-current="page"' : ""}>Weekly edition</a><a href="./season.html"${active === "season" ? ' aria-current="page"' : ""}>Season analysis</a></nav></div>`;
}
