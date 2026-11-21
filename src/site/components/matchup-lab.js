import { eligible } from "../../analysis/lineups.js";
import { esc } from "../html.js";

function labTeam(t) {
  const l = t.lineup;
  const starters = [...l.starters, ...l.vacancies].map((s, i) => ({
    id: s.id || "empty-" + i,
    name: s.name,
    slot: s.slot,
    score: s.score,
  }));
  const reserves = l.reserves
    .filter((p) => p.comparison && !l.adjusted)
    .map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      targets: starters
        .filter((s) => eligible(s.slot, p.positions))
        .map((s) => s.id),
    }));
  return {
    id: t.id,
    name: t.name,
    score: t.score,
    units: l.units,
    starters,
    reserves,
  };
}

export function matchupLab(f) {
  const pairs = f.games.map((g) => ({
    id: g.id,
    teams: g.ids.map((id) => labTeam(f.teams[id])),
  }));
  const data = JSON.stringify(pairs).replace(/</g, "\\u003c");
  return `<section class="lab" id="lab" aria-labelledby="lab-title" hidden>
    <div class="lab-cap"><div><span class="eyebrow">Week ${f.week} · Interactive</span><h2 id="lab-title">The matchup lab</h2></div>
    <label>Choose a matchup<select data-control="game">${pairs.map((g) => `<option value="${g.id}">${g.teams.map((t) => esc(t.name)).join(" vs. ")}</option>`).join("")}</select></label></div>
    <div class="lab-modes" aria-label="Explorer mode"><button type="button" data-mode="replay" aria-pressed="true">Score replay</button><button type="button" data-mode="swap" aria-pressed="false">Bench what-if</button></div>
    <div class="lab-stage"><div class="lab-score"><small data-team="0"></small><strong data-value="0"></strong></div><span class="lab-vs">VS</span><div class="lab-score"><small data-team="1"></small><strong data-value="1"></strong></div></div>
    <div class="lab-meter" aria-hidden="true"><i></i></div>
    <div data-panel="replay" class="lab-controls"><div><label for="reveal">Reveal scoring by lineup slot</label><output for="reveal" data-step></output></div><div class="play-row"><button type="button" data-play>Play replay</button><input id="reveal" aria-label="Position reveal step" type="range" min="0" step="1"></div></div>
    <div data-panel="swap" class="lab-controls" hidden><div class="swap-form"><label>Manager<select data-control="side"></select></label><label>Bring off the bench<select data-control="bench"></select></label><label>Replace starter<select data-control="starter"></select></label></div></div>
    <p class="lab-call" role="status" aria-live="polite"></p><script type="application/json" id="lab-data">${data}</script></section>`;
}
