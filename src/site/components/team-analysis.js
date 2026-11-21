import { mean } from "../../analysis/lineups.js";
import { ordinal, points, record } from "../../analysis/format.js";
import { esc } from "../html.js";

function formLine(p) {
  if (p.priorAvg === null || p.score === null) return "";
  const delta = p.score - p.priorAvg;
  const sample =
    p.priorCount === 1
      ? "the one prior week with a recorded score"
      : `the ${p.priorCount} prior weeks with recorded scores`;
  return delta === 0
    ? `Matched the ${points(p.priorAvg)} average from ${sample}.`
    : `${points(Math.abs(delta))} ${delta > 0 ? "above" : "below"} the recent average of ${points(p.priorAvg)} across ${sample}.`;
}

function playerRow(p) {
  let note;
  if (p.score === null)
    note = "Sleeper has no individual score recorded for this roster spot.";
  else if (p.slot !== "BN") {
    note = `${p.tied ? "Tied for" : "Ranked"} ${ordinal(p.rank)} among ${p.peers} league starters in the ${p.slot} slot.`;
    if (p.share !== null && p.score > 0)
      note += ` Supplied ${p.share}% of the starting lineup’s points.`;
    if (p.score === 0) note += " This slot contributed zero to the lineup.";
    if (p.score < 0) note += ` This slot deducted ${points(-p.score)} points.`;
  } else if (p.comparison) {
    const { name, delta, slot } = p.comparison;
    note =
      delta === 0
        ? `Matched ${name} in an eligible ${slot} slot.`
        : `${delta > 0 ? "Would have added" : "Would have cost"} ${points(Math.abs(delta))} points in place of ${name} at ${slot}.`;
  } else
    note =
      "On the bench this week. This score did not count toward the team total.";
  const position = p.slot === "BN" ? p.positions.join("/") || "BN" : p.slot;
  return `<li class="player-row" data-player="${esc(p.id)}"><div class="player-heading"><span class="pos">${esc(position)}</span><strong>${esc(p.name)}</strong><span class="player-score">${p.score === null ? "—" : points(p.score)}</span></div><p>${esc([note, formLine(p)].filter(Boolean).join(" "))}</p></li>`;
}

function benchLine(t) {
  const l = t.lineup;
  if (l.adjusted)
    return "Sleeper records a commissioner adjustment to the team total. Bench comparisons use the underlying player scores.";
  if (!t.bench) return "";
  const change = t.score + t.bench.gain - l.opponentScore;
  const effect =
    t.result === "loss"
      ? change > 0
        ? `changes the result to a ${points(change)}-point win`
        : change === 0
          ? "brings the matchup level"
          : `still leaves a ${points(-change)}-point loss`
      : t.result === "tie"
        ? `breaks the tie by ${points(change)}`
        : `increases the winning margin to ${points(change)}`;
  return `The largest single eligible swap was ${t.bench.name} for ${t.bench.starter}. Holding all other slots fixed, that ${effect}.`;
}
export function teamAnalysis(t) {
  if (!t.lineup) return "";
  const l = t.lineup,
    prior = mean(t.previousScores);
  const strongest = l.edges.find((e) => e.delta > 0),
    weakest = l.edges.findLast((e) => e.delta < 0);
  const edges = [];
  if (strongest)
    edges.push(
      `The biggest advantage came at ${strongest.slot}, where your lineup outscored the opponent ${points(strongest.own)} to ${points(strongest.opponent)} (+${points(strongest.delta)}).`,
    );
  if (weakest)
    edges.push(
      `The largest deficit came at ${weakest.slot}, a ${points(-weakest.delta)}-point gap.`,
    );
  if (!edges.length)
    edges.push(
      "Every starting position group finished level with its counterpart.",
    );
  const delta = prior === null ? null : t.score - prior;
  const form =
    prior === null
      ? "This is the first available team scoring sample."
      : `Your ${points(t.score)} was ${delta === 0 ? "level with" : points(Math.abs(delta)) + (delta > 0 ? " above" : " below")} your ${points(prior)} average across the previous ${t.previousScores.length} scored week${t.previousScores.length === 1 ? "" : "s"} in the three-week window.`;
  return `<details class="analysis"><summary><strong>Team &amp; player analysis</strong><span>${l.starters.length} starters · ${l.reserves.length} bench</span></summary>
    <div class="analysis-body"><h5>How the team performed</h5><p>${esc(form)} Against every other active team, this score would have gone <b>${record(l.allPlay)}</b>.</p>
    <p>${esc(edges.join(" "))}</p>${benchLine(t) ? "<p>" + esc(benchLine(t)) + "</p>" : ""}
    <h5>Starting lineup</h5><ul class="player-list">${l.starters.map(playerRow).join("")}</ul>
    ${l.vacancies.length ? "<p>Unfilled starting slots: " + esc(l.vacancies.map((v) => v.slot).join(", ")) + ".</p>" : ""}
    ${l.reserves.length ? '<h5>Bench</h5><ul class="player-list">' + l.reserves.map(playerRow).join("") + "</ul>" : ""}</div></details>`;
}
