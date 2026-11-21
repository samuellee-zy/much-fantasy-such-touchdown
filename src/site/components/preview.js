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
export function previewSection(f) {
  if (f.final)
    return `<section id="next" class="preview"><span class="eyebrow">Season finale</span><h2>The final whistle</h2><p>${f.champion ? esc(f.champion) + " finishes the season as league champion." : "The final slate is complete."}</p></section>`;
  return `<section id="next" class="preview"><div class="section-heading"><div><span class="eyebrow">Week ${f.week + 1} preview</span><h2>The week ahead</h2></div></div>
  ${
    f.upcoming.length
      ? f.upcoming
          .map((g, i) => {
            const [a, b] = g.ids.map((id) => f.teams[id]);
            return `<article class="fixture ${i === 0 ? "featured" : ""}">${i === 0 ? '<span class="eyebrow">Game to watch</span>' : ""}<h3>${esc(a.name)} <span>vs.</span> ${esc(b.name)}</h3><p>${esc(previewHook(g, a, b, i === 0, f))}</p></article>`;
          })
          .join("")
      : "<p>Sleeper has yet to assign the next pairings.</p>"
  }</section>`;
}
