import { mean, playerHistory } from "./lineups.js";

export const fixtureKey = (g) => [...g.ids].sort((a, b) => a - b).join("-");

export function previewLineups(games, upcomingRows, history, directory, slots) {
  const scores = playerHistory(history);
  const rows = new Map(upcomingRows.map((row) => [row.roster_id, row]));
  for (const g of games) {
    g.lineups = g.ids.map((teamId) => {
      const starters = rows.get(teamId)?.starters || [];
      const players = starters
        .flatMap((id, index) => {
          const p = directory[id];
          if (!p?.name || id === "0") return [];
          const sample = scores.get(id) || [];
          return [
            {
              id,
              name: p.name,
              slot: slots[index],
              count: sample.length,
              average: mean(sample),
              low: sample.length ? Math.min(...sample) : null,
              high: sample.length ? Math.max(...sample) : null,
            },
          ];
        })
        .sort(
          (a, b) =>
            Number(b.count >= 2) - Number(a.count >= 2) ||
            (b.average ?? -Infinity) - (a.average ?? -Infinity),
        );
      return { teamId, players };
    });
  }
}
