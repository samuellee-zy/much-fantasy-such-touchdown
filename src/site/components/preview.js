import { fixtureKey } from "../../analysis/fixtures.js";
import { points, ordinal, record } from "../../analysis/format.js";
import { esc } from "../html.js";
const average = (team) =>
  team.recent.length
    ? points(
        Math.round(team.recent.reduce((a, b) => a + b, 0) / team.recent.length),
      )
    : null;
function previewHook(g, a, b, featured, f) {
  const cutoff = f.cutoff;
  const [higher, lower] = a.rank <= b.rank ? [a, b] : [b, a];
  let context;
  if (f.nextPlayoff) {
    context = `The regular-season records were ${record(a)} for ${a.name} and ${record(b)} for ${b.name}. Their next meeting comes in the postseason.`;
  } else if (featured) {
    context = `The ${ordinal(higher.rank)}- and ${ordinal(lower.rank)}-placed teams bring records of ${record(higher)} and ${record(lower)}.`;
  } else if (lower.rank === cutoff + 1) {
    context = `${lower.name} is first in line below the playoff cut. Beating the league’s ${ordinal(higher.rank)}-placed team would make quite a case.`;
  } else if (lower.rank === cutoff) {
    context = `${lower.name} holds the last playoff spot. A date with ${higher.name} is the price of defending it.`;
  } else if (higher.rank > cutoff) {
    context = `Both teams are chasing the playoff field. ${higher.name} comes in at ${record(higher)}, with ${lower.name} at ${record(lower)}.`;
  } else if (average(a) && average(b)) {
    context = `${a.name} has averaged ${average(a)} over its last ${a.recent.length} scored games. ${b.name} comes in averaging ${average(b)} over ${b.recent.length}.`;
  } else {
    context = `${a.name} enters at ${record(a)} and ${b.name} at ${record(b)}.`;
  }
  if (!g.lastMeeting) return context;
  const [sa, sb] = g.lastMeeting;
  const rematch =
    sa === sb
      ? `Their last meeting ended level on ${points(sa)}.`
      : `${(sa > sb ? a : b).name} took the last meeting ${points(Math.max(sa, sb))}–${points(Math.min(sa, sb))}.`;
  return context + " " + rematch;
}
function scouting(g, f, article) {
  const lines = g.lineups.flatMap((line) => {
    const p =
      line.players.find((p) => p.id === article?.playerId) || line.players[0];
    if (!p) return [];
    const form =
      p.average === null
        ? "The league has no recent scoring sample for this player."
        : p.count === 1
          ? `The available game in the last three league weeks produced ${points(p.average)} points.`
          : `Averaged ${points(p.average)} across ${p.count} recorded weeks, ranging from ${points(p.low)} to ${points(p.high)}.`;
    return [
      `<div class="scout-player"><small>${esc(f.teams[line.teamId].name)} · ${esc(p.slot)}</small><strong>${esc(p.name)}</strong><p>${esc(form)}</p></div>`,
    ];
  });
  const player = g.lineups
    .flatMap((l) => l.players)
    .find((p) => p.id === article?.playerId);
  const story = player
    ? `<div class="scout-report" data-preview-source="${esc(player.id)}"><b>The NFL angle</b><p>${esc(article.summary || "“" + article.evidence + "”")}</p><a href="${esc(article.url)}">${esc(new URL(article.url).hostname.replace(/^www\./, ""))} · ${esc(article.date)}</a></div>`
    : "";
  return `${lines.length ? '<div class="scout-grid">' + lines.join("") + "</div>" : ""}${story}`;
}
function ballot(g, f) {
  return `<div class="ballot" data-pick="${fixtureKey(g)}" hidden><strong>Your pick</strong>${g.ids.map((id) => `<button type="button" data-choice="${id}" aria-pressed="false">${esc(f.teams[id].name)}</button>`).join("")}<span role="status" class="pick-status"></span></div>`;
}
export function previewSection(f, research) {
  if (f.final)
    return `<section id="next" class="preview"><span class="eyebrow">Season finale</span><h2>The final whistle</h2><p>${f.champion ? esc(f.champion) + " finishes the season as league champion." : "The final slate is complete."}</p></section>`;
  return `<section id="next" class="preview"><div class="section-heading"><div><span class="eyebrow">Week ${f.week + 1} preview</span><h2>The week ahead</h2></div></div><p class="preview-intro">Players to watch from the lineups on Sleeper. Recent scoring uses the three completed league weeks before this slate.<span data-enable-js hidden> Tap a team to make your pick in this browser.</span></p>
  ${
    f.upcoming.length
      ? f.upcoming
          .map((g, i) => {
            const [a, b] = g.ids.map((id) => f.teams[id]);
            return `<article class="fixture ${i === 0 ? "featured" : ""}">${i === 0 ? '<span class="eyebrow">Game to watch</span>' : ""}<h3>${esc(a.name)} <span>vs.</span> ${esc(b.name)}</h3><p>${esc(previewHook(g, a, b, i === 0, f))}</p>${scouting(g, f, research?.articles?.[fixtureKey(g)])}${ballot(g, f)}</article>`;
          })
          .join("")
      : "<p>Sleeper has yet to assign the next pairings.</p>"
  }</section>`;
}
