import { identity } from "./identity.js";
import { ordinal, record, points } from "../../analysis/format.js";
import { esc } from "../html.js";
import { teamAnalysis } from "./team-analysis.js";
export function resultCard(game, f, copy, closestId) {
  const sides = game.ids
    .map((id) => f.teams[id])
    .sort((a, b) => b.score - a.score || a.id - b.id);
  const label =
    game.margin === 0 ? "Tie game" : `${points(game.margin)}-point margin`;
  return `<article class="match" data-game="${game.id}">
    <header class="match-meta"><span>${game.id === closestId ? "Closest game" : "Final score"}</span><span>${esc(label)}</span></header>
    <div class="scoreboard">${sides.map((t) => `<div class="score-side ${t.result}"><div class="score-name">${identity(t)}</div><strong>${points(t.score)}</strong></div>`).join('<span class="versus">vs</span>')}</div>
    <div class="reports">${sides.map((t) => managerReport(t, copy[t.id], f.teams[t.opponent])).join("")}</div>
  </article>`;
}
export function managerReport(t, entry, opponent) {
  const analysis =
    entry.quip && entry.text.endsWith(entry.quip)
      ? entry.text.slice(0, -entry.quip.length).trimEnd()
      : entry.text;
  return `<section class="manager" id="manager-${t.id}" data-manager="${t.id}" data-name="${esc(t.name)}" data-handle="${esc(t.manager)}" data-rank="${ordinal(t.rank)}" data-record="${record(t)}" data-points="${t.score === null ? "—" : points(t.score)}" data-opponent="${esc(opponent?.name || "")}"><h4 id="wrapped-${t.id}"><span class="outcome ${t.result || "idle"}">${{ win: "W", loss: "L", tie: "T" }[t.result] || "–"}</span>${identity(t, true)}</h4><p>${esc(analysis)}</p>${entry.quip ? `<div class="roast"><b>The roast</b><p>${esc(entry.quip)}</p></div>` : ""}${teamAnalysis(t)}</section>`;
}
