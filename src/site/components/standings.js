import { points, ordinal, record } from "../../analysis/format.js";
import { esc } from "../html.js";
export function standingsPanel(f) {
  const { standings, cutoff } = f;
  const inside = standings[cutoff - 1],
    outside = standings[cutoff];
  let note = "Teams are ordered by record, then by points for.";
  if (inside && outside && !f.playoff) {
    const changed = standings.filter(
      (t) => t.rank <= cutoff && t.priorRank > cutoff,
    );
    const movers = standings
      .filter((t) => t.priorRank > t.rank)
      .sort((a, b) => b.priorRank - b.rank - (a.priorRank - a.rank));
    const movement = changed.length
      ? `${changed.map((t) => t.name).join(" and ")} moved above the cut. `
      : movers.length
        ? `${movers[0].name} moved from ${ordinal(movers[0].priorRank)} to ${ordinal(movers[0].rank)}. `
        : "";
    note = `${movement}${inside.name} holds the last playoff spot at ${record(inside)}, with ${outside.name} chasing at ${record(outside)}.`;
  }
  return `<section id="standings" class="side-panel"><div class="side-heading"><span class="eyebrow">${f.playoff ? "Regular season" : "Playoff race"}</span><h2>The standings</h2></div>
    <table><caption class="sr-only">Standings after Week ${f.week}</caption><thead><tr><th scope="col">Rank</th><th scope="col">Team</th><th scope="col">W–L${standings.some((t) => t.ties) ? "–T" : ""}</th></tr></thead><tbody>
    ${standings.map((t, i) => `<tr><td>${t.rank}</td><th scope="row"><a href="#manager-${t.id}">${esc(t.name)}</a></th><td>${record(t)}</td></tr>${i + 1 === cutoff && outside ? '<tr class="cut"><td colspan="3">Playoff cutoff</td></tr>' : ""}`).join("")}</tbody></table><p class="cut-note">${esc(note)}</p></section>`;
}

export function awardPanel(f) {
  const tops = f.standings
    .filter((t) => t.top)
    .sort((a, b) => b.top.score - a.top.score);
  if (!tops.length || tops[0].top.score <= 0) return "";
  const winners = tops.filter((t) => t.top.score === tops[0].top.score);
  return `<section class="award"><span class="eyebrow">Weekly honor</span><h2>The game ball</h2>
    ${winners.map((t) => `<p class="player">${esc(t.top.name)}</p><p>${esc(t.name)} got <b>${points(t.top.score)} points</b> out of the ${esc(t.top.slot)} slot${winners.length > 1 ? ", tied for the highest starter score" : ", the highest starter score"} of the week.</p>`).join("")}</section>`;
}
