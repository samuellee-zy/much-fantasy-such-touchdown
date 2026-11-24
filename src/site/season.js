import { masthead } from "./components/masthead.js";
import { esc } from "./html.js";
import { ordinal, points, record } from "../analysis/format.js";
import { mean } from "../analysis/lineups.js";
import {
  playerRows,
  roundTable,
  scheduleRows,
  teamForm,
  trendChart,
  winGap,
} from "../../docs/assets/js/season-views.js";

function options(data, selected, extra = "") {
  return (
    extra +
    data.teams
      .map(
        (t) =>
          `<option value="${t.id}"${t.id === selected ? " selected" : ""}>${esc(t.name)}</option>`,
      )
      .join("")
  );
}

function trend(data, mode) {
  const race = mode === "race",
    last = data.rounds.at(-1),
    index = data.rounds.length - 1;
  const first = data.teams[0],
    other = data.teams[1];
  const second = race ? other.id : "average";
  const chasing = data.teams.find(
    (t) => last.lines[t.id].rank === data.cutoff + 1,
  );
  const inside = data.teams.find((t) => last.lines[t.id].rank === data.cutoff);
  let copy;
  if (race && inside && chasing) {
    const a = last.lines[inside.id],
      b = last.lines[chasing.id];
    copy = `${inside.name} holds ${ordinal(a.rank)} at ${record(a)}. ${chasing.name} sits just below the cut at ${record(b)}.`;
    if (2 * a.wins + a.ties === 2 * b.wins + b.ties)
      copy += ` They are separated by ${points(a.pf - b.pf)} points for.`;
    const left = data.playoffStart - 1 - last.week;
    if (left > 0) {
      copy += ` ${left} regular-season ${left === 1 ? "week remains" : "weeks remain"} before the Week ${data.playoffStart} playoffs.`;
      const winUnits = (t) => 2 * last.lines[t.id].wins + last.lines[t.id].ties;
      const available = left * 2 * (data.medianGame ? 2 : 1);
      const safe = data.teams.filter(
        (t) =>
          data.teams.filter(
            (other) =>
              other.id !== t.id && winUnits(other) + available >= winUnits(t),
          ).length < data.cutoff,
      );
      if (safe.length)
        copy += ` ${safe.map((t) => t.name).join(" and ")} ${safe.length === 1 ? "has" : "have"} already secured a top-${data.cutoff} finish on record alone.`;
    }
  } else if (race) {
    copy =
      "Follow each team’s place after the final game of each regular-season week.";
  } else {
    const recent = data.rounds.slice(-3);
    const form = data.teams
      .map((t) => ({ ...t, avg: mean(recent.map((r) => r.lines[t.id].score)) }))
      .sort((a, b) => b.avg - a.avg);
    const leader = form[0];
    const fieldAvg = mean(recent.map((r) => r.average));
    copy = `Across Weeks ${recent[0].week}–${last.week}, ${leader.name} averaged ${points(leader.avg)} points, ${points(leader.avg - fieldAvg)} above the league average. Their latest score was ${points(last.lines[leader.id].score)}.`;
  }
  const value = (id) =>
    race ? ordinal(last.lines[id].rank) : points(last.lines[id].score);
  return `<section id="${mode}" class="season-panel"><div class="panel-heading"><h2>${race ? "The playoff race" : "Scoring trends"}</h2><p>${esc(copy)}</p></div>
  <div class="chart-card" data-trend="${mode}"><div class="chart-top"><h3>${race ? "League rank" : "Weekly points"}</h3><div class="chart-selects" data-control hidden>
  <label>Team<select data-first>${options(data, first.id)}</select></label><label>Compare with<select data-second>${options(data, second, race ? "" : '<option value="average" selected>League average</option>')}</select></label></div></div>
  <div class="chart-surface">${trendChart(data, mode, first.id, second, index)}</div>
  <div class="chart-legend"><span><i></i><span data-name-first>${esc(first.name)}</span></span><span><i></i><span data-name-second>${race ? esc(other.name) : "League average"}</span></span></div>
  <div class="week-readout"><strong data-week>Week ${last.week}</strong><span data-values>${esc(first.name)} · ${value(first.id)} &nbsp; / &nbsp; ${race ? esc(other.name) + " · " + value(other.id) : "League average · " + points(last.average)}</span></div>
  <label class="week-range" data-control hidden>Inspect week<input type="range" min="0" max="${index}" value="${index}" aria-valuetext="Week ${last.week}"></label></div>
${race ? "" : `<p class="team-form" data-form>${esc(teamForm(data, first.id, index))}</p>`}
  <div class="season-table" data-round-table>${roundTable(data, index, mode)}</div></section>`;
}

function schedule(data) {
  const last = data.rounds.at(-1);
  const ordered = [...data.teams].sort(
    (a, b) =>
      winGap(last.lines[b.id], data.teams.length) -
      winGap(last.lines[a.id], data.teams.length),
  );
  const t = ordered.at(-1),
    r = last.lines[t.id];
  const expected = (r.allWins + r.allTies / 2) / (data.teams.length - 1);
  return `<section id="schedule" class="season-panel"><div class="panel-heading"><h2>Schedule impact</h2><p>${esc(t.name)} earned ${r.headWins} head-to-head wins${r.headTies ? " and " + r.headTies + " ties" : ""}. Facing every possible opponent each week would have yielded an average of ${expected.toFixed(2)} wins across the same slate.</p></div>
  <label class="paper-filter" data-control hidden>Order teams by<select id="schedule-order"><option value="gap">Actual minus expected wins</option><option value="expected">Expected wins</option><option value="against">Points against</option></select></label>
  <div class="season-table"><table><caption>Actual and schedule-neutral wins</caption><thead><tr><th>Team</th><th>Points against</th><th>Actual wins</th><th>Expected wins</th><th>Difference</th></tr></thead><tbody id="schedule-rows">${scheduleRows(data)}</tbody></table></div>
  <p class="method">Each week, a team earns one expected win for beating the entire field, or a fraction for beating part of it. Ties earn half credit in both columns. A positive difference means the actual pairings yielded more wins.</p></section>`;
}
function players(data) {
  const p = data.players[0];
  const copy = p
    ? `${p.name} supplied ${points(p.points)} points in ${p.starts} starts for ${data.teams.find((t) => t.id === p.team).name}, averaging ${points(Math.round(p.points / p.starts))} per start.`
    : "No starts were recorded.";
  const positions = [...new Set(data.players.map((p) => p.position))].sort();
  return `<section id="players" class="season-panel"><div class="panel-heading"><h2>Player leaders</h2><p>${esc(copy)}</p></div>
  <div class="player-filters" data-control hidden><label class="paper-filter">Fantasy team<select id="player-team">${options(data, null, '<option value="">All teams</option>')}</select></label><label class="paper-filter">Position<select id="player-position"><option value="">All positions</option>${positions.map((p) => `<option>${esc(p)}</option>`).join("")}</select></label></div>
  <div class="season-table"><table><caption>Top scorers in starting lineups</caption><thead><tr><th>Rank</th><th>Player</th><th>Starts</th><th>Points</th></tr></thead><tbody id="player-rows">${playerRows(data, "", "")}</tbody></table></div>
  <p class="method">The top ten are ranked by points in the starting lineup. Each start belongs to the fantasy team that fielded the player that week.</p></section>`;
}

export function renderSeason(f, issue, data, columns) {
  const sections =
    '<a href="./#recap">Results</a>' +
    (columns.standings ? '<a href="./#standings">Standings</a>' : "") +
    (columns.preview && !f.final ? '<a href="./#next">Week ahead</a>' : "");
  const header = masthead(f, issue, "season", sections, "season-main");
  const last = data.rounds.at(-1);
  const title = `Season analysis · ${f.season} · The Touchdown Post`;
  let content =
    "<h1>Season analysis</h1><p>No completed regular-season matchups are available.</p>";
  if (last) {
    const order = [...data.teams].sort(
      (a, b) => last.lines[a.id].rank - last.lines[b.id].rank,
    );
    const leader = order[0],
      second = order[1],
      row = last.lines[leader.id];
    const scoring = [...order].sort(
      (a, b) => last.lines[b.id].pf - last.lines[a.id].pf,
    )[0];
    const lastGame = last.lines[second.id];
    const headline = `${leader.name} ${row.rank === lastGame.rank ? "shares first place." : "holds first place."}`;
    let lead = `${leader.name} stands at ${record(row)} after Week ${last.week}. ${second.name} follows at ${record(lastGame)}.`;
    if (row.opponent === second.id) {
      const [winner, loser] =
        row.score > lastGame.score ? [leader, second] : [second, leader];
      if (row.score !== lastGame.score)
        lead += ` They met this week, and ${winner.name} won ${points(last.lines[winner.id].score)}–${points(last.lines[loser.id].score)}.`;
    }
    const tabs = [
      ["scoring", "Scoring trends"],
      ["race", "Playoff race"],
      ["schedule", "Schedule impact"],
      ["players", "Player leaders"],
    ];
    content = `<div class="season-lead"><div><span class="eyebrow">${esc(f.season)} regular season · Through Week ${last.week}</span><h1>${esc(headline)}</h1><p>${esc(lead)}</p></div>
      <dl><div><dt>Points leader</dt><dd>${points(last.lines[scoring.id].pf)}<small>${esc(scoring.name)}</small></dd></div><div><dt>Matchups played</dt><dd>${(data.rounds.length * data.teams.length) / 2}<small>${data.teams.length} teams · ${data.rounds.length} weeks</small></dd></div></dl></div>
      <nav class="analysis-tabs" aria-label="Season analysis views">${tabs.map(([id, label]) => `<a id="tab-${id}" href="#${id}">${label}</a>`).join("")}</nav>
      ${trend(data, "scoring")}${trend(data, "race")}${schedule(data)}${players(data)}
      <script type="application/json" id="season-data">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
  }
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<meta name="description" content="Season standings, weekly scoring trends, schedule comparisons and starting player totals for ${esc(f.name)}"><meta name="theme-color" content="#143b30">
<link rel="stylesheet" href="./assets/paper.css"><link rel="stylesheet" href="./assets/show.css?v=3"><link rel="stylesheet" href="./assets/season.css"><script type="module" src="./assets/js/season.js"></script></head><body>
${header}<main class="wrap season-main" id="season-main">${content}</main><footer><div class="wrap"><b>The Touchdown Post</b><span>${esc(f.season)} season</span><a href="https://sleeper.com/leagues/${encodeURIComponent(f.leagueId)}">League data from Sleeper</a></div></footer></body></html>\n`;
}
