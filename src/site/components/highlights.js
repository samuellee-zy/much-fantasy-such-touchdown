import { points, record } from "../../analysis/format.js";
import { fixtureKey } from "../../analysis/fixtures.js";
import { esc } from "../html.js";
import { identity, finder } from "./identity.js";

export function buildHighlights(f, games, preview) {
  const vacancy = f.standings.find(
    (t) => t.result === "win" && t.lineup.vacancies.length,
  );
  const closest = [...f.games].sort((a, b) => a.margin - b.margin)[0];
  const opener = vacancy
    ? f.games.find((g) => g.ids.includes(vacancy.id))
    : closest;
  const teams = opener.ids
    .map((id) => f.teams[id])
    .sort((a, b) => b.score - a.score);
  const [a, b] = teams;
  const slot = vacancy?.lineup.vacancies[0].slot;
  const title = vacancy
    ? `They left ${slot === "DEF" ? "the defense" : `the ${slot} slot`} empty. They still won by ${points(opener.margin)}.`
    : opener.margin === 0
      ? "Even the decimals called it a draw."
      : `The closest finish? ${points(opener.margin)} points.`;
  const scenes = [
    {
      kind: "result",
      label: "The final score",
      title,
      deck: `${a.name} and ${b.name} finished ${points(a.score)}–${points(b.score)}. See which positions made the difference.`,
      teams,
      metric: points(opener.margin),
      unit: "Point margin",
      game: opener.id,
    },
  ];
  const swings = [];
  for (const game of games) {
    for (const [side, t] of game.teams.entries()) {
      const other = game.teams[1 - side];
      for (const p of t.reserves)
        for (const target of p.targets) {
          const out = t.starters.find((s) => s.id === target),
            gain = p.score - out.score;
          if (gain <= 0) continue;
          const margin = t.score - other.score,
            revised = margin + gain;
          swings.push({
            gain,
            flip: margin <= 0 && revised >= 0,
            game: game.id,
            team: f.teams[t.id],
            opponent: f.teams[other.id],
            p,
            out,
          });
        }
    }
  }
  const swing = swings.sort(
    (a, b) => Number(b.flip) - Number(a.flip) || b.gain - a.gain,
  )[0];
  if (swing) {
    const s = swing;
    scenes.push({
      kind: "swap",
      label: "The bench decision",
      title: `${points(s.gain)} points in one swap.`,
      deck: `${s.team.name} could have gained ${points(s.gain)} by starting ${s.p.name} over ${s.out.name}. Would it have changed the result?`,
      teams: [s.team, s.opponent],
      game: s.game,
      inId: s.p.id,
      outId: s.out.id,
      metric: "+" + points(s.gain),
      unit: "Single-swap gain",
      incoming: s.p,
      outgoing: s.out,
    });
  } else {
    const star = f.standings
      .filter((t) => t.top)
      .sort((x, y) => y.top.score - x.top.score)[0];
    if (star)
      scenes.push({
        kind: "star",
        label: "The game ball",
        title: `${star.top.name} takes the spotlight.`,
        deck: `${star.name} got ${points(star.top.score)} points from the ${star.top.slot} slot.`,
        teams: [star],
        metric: points(star.top.score),
        unit: "Starter points",
      });
  }
  if (f.champion) {
    const champ =
      f.teams[f.championId] || f.standings.find((t) => t.name === f.champion);
    scenes.push({
      kind: "champion",
      label: "The championship",
      title: `${f.champion} takes the title.`,
      deck: `The ${f.season} championship belongs to ${f.champion}. Open the manager’s final report.`,
      teams: [champ],
      metric: f.season,
      unit: "League champion",
    });
  } else if (preview && f.upcoming.length) {
    const game = f.upcoming[0],
      pair = game.ids.map((id) => f.teams[id]);
    scenes.push({
      kind: "preview",
      label: "Game to watch",
      title: `Next up: ${pair[0].name} vs. ${pair[1].name}.`,
      deck: `The records are ${record(pair[0])} and ${record(pair[1])}. Meet the lineups and scout the NFL matchups for Week ${f.week + 1}.`,
      teams: pair,
      fixture: fixtureKey(game),
      metric: `WK ${f.week + 1}`,
      unit: "Coming up",
    });
  }
  return scenes;
}

function action(s) {
  if (s.kind === "swap")
    return `<a href="#lab" data-enable-js hidden data-cue="${s.game}" data-side-id="${s.teams[0].id}" data-in-id="${esc(s.inId)}" data-out-id="${esc(s.outId)}">Try the swap</a>`;
  if (s.kind === "result")
    return `<a href="#lab" data-enable-js hidden data-cue="${s.game}">Replay this matchup</a>`;
  if (s.kind === "preview")
    return `<a href="#fixture-${esc(s.fixture)}">Scout this matchup</a>`;
  return `<a href="#manager-${s.teams[0].id}">Open manager profile</a>`;
}
function scene(s, i) {
  const heading = i === 0 ? "h1" : "h2";
  const lower = s.teams
    .map(
      (t) =>
        `<div>${identity(t, true)}<b>${s.kind === "preview" ? record(t) : t.score !== null ? points(t.score) : "–"}</b></div>`,
    )
    .join("");
  return `<article class="reel-scene scene-${s.kind}" data-scene="${i}" aria-label="${esc(s.label)}" ${i ? "hidden" : ""}>
  <div class="reel-story"><span class="show-tag">${esc(s.label)}</span><${heading}>${esc(s.title)}</${heading}><p>${esc(s.deck)}</p><div class="scene-link">${action(s)}</div></div>
  <div class="show-art"><div class="show-image" aria-hidden="true"></div>
  <div class="show-graphic"><small>${esc(s.unit)}</small><strong>${esc(s.metric)}</strong></div>
  ${s.kind === "swap" ? `<div class="reel-trade"><span>Out · ${esc(s.outgoing.name)}</span><b>In · ${esc(s.incoming.name)}</b></div>` : ""}
  <div class="show-scorebug">${lower}</div></div></article>`;
}
export function highlightReel(f, scenes) {
  return `<section id="highlights" class="reel" aria-label="Weekly highlight reel" tabindex="-1">
    <div class="reel-mast"><span><i aria-hidden="true"></i> Weekly highlights</span><b>Week ${f.week} <em>/</em> ${esc(f.season)}</b></div>
    <div class="reel-stage">${scenes.map(scene).join("")}</div>
    <div class="reel-desk"><div class="reel-actions"><button type="button" data-play-show data-enable-js hidden><i aria-hidden="true"></i><span>Play highlights</span></button>${finder(f.standings)}<noscript><a href="#recap">Read the matchups</a></noscript></div>
    <div class="reel-transport" data-enable-js hidden><button type="button" data-prev aria-label="Previous highlight">‹</button><span data-counter aria-live="polite">1 / ${scenes.length}</span><button type="button" data-next aria-label="Next highlight">›</button></div></div>
    <div class="reel-progress" aria-hidden="true">${scenes.map(() => "<i></i>").join("")}</div></section>
    <div class="archive-credit"><a href="#recap">Skip to results ↓</a><span>Field photograph · <a href="https://www.loc.gov/pictures/item/2014694757/">Carlisle vs. Dartmouth, Library of Congress</a></span></div>`;
}
