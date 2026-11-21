import { points } from "../../analysis/format.js";
import { esc } from "../html.js";

export function notebookPanel(f, stories) {
  const cards = stories.flatMap((s) => {
    const owner = f.standings.find((t) =>
      t.lineup?.starters.some((p) => p.id === s.playerId),
    );
    if (!owner) return [];
    const player = owner.lineup.starters.find((p) => p.id === s.playerId);
    const publisher = new URL(s.url).hostname.replace(/^www\./, "");
    const date = new Intl.DateTimeFormat("en-GB", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(s.date));
    return [
      `<article class="news-item" data-news-player="${esc(s.playerId)}"><h3>${esc(player.name)}</h3><p>${s.summary ? esc(s.summary) : "“" + esc(s.evidence) + "”"}</p><p class="league-tie">${esc(owner.name)} got <b>${points(player.score)} points</b> from ${esc(player.name)} at ${esc(player.slot)}.</p><a href="${esc(s.url)}">${esc(publisher)} · ${esc(date)}</a></article>`,
    ];
  });
  if (!cards.length) return "";
  return `<section id="notebook" class="notebook"><span class="eyebrow">Around the NFL</span><h2>The notebook</h2>${cards.join("")}</section>`;
}
