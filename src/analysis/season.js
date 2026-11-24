import assert from "node:assert/strict";
import { cents } from "./format.js";
import { groups, ranking, total } from "./scoring.js";

function addStarts(players, row, directory) {
  assert.equal(
    row.starters?.length,
    row.starters_points?.length,
    "Missing historical starter scores",
  );
  row.starters.forEach((id, i) => {
    if (!id || id === "0") return;
    const value = row.starters_points[i];
    assert.ok(Number.isFinite(value), "Incomplete historical starter score");
    const key = row.roster_id + "-" + id;
    const player = players.get(key) || {
      id,
      team: row.roster_id,
      name: directory[id]?.name || `Sleeper player ${id}`,
      position: directory[id]?.positions?.[0] || "Other",
      starts: 0,
      points: 0,
    };
    player.starts++;
    player.points += cents(value);
    players.set(key, player);
  });
}

export function buildSeason({ league, history, directory, week }, facts) {
  const start = Number(league.settings.start_week || 1);
  const playoffs = Number(league.settings.playoff_week_start);
  const lastWeek = playoffs > 0 ? Math.min(week, playoffs - 1) : week;
  const teams = facts.standings.map(({ id, name }) => ({ id, name }));
  const known = new Set(teams.map((t) => t.id));
  const players = new Map();
  const rounds = [];
  const totals = Object.fromEntries(
    teams.map(({ id }) => [
      id,
      {
        id,
        wins: 0,
        losses: 0,
        ties: 0,
        pf: 0,
        pa: 0,
        allWins: 0,
        allTies: 0,
        headWins: 0,
        headTies: 0,
      },
    ]),
  );
  for (let w = start; w <= lastWeek; w++) {
    const rows = history[w - start];
    const games = groups(rows, false, known, `Week ${w}`);
    const scores = new Map(rows.map((row) => [row.roster_id, total(row)]));
    const field = [...scores.values()].sort((a, b) => a - b);
    const middle =
      (field[Math.floor((field.length - 1) / 2)] +
        field[Math.floor(field.length / 2)]) /
      2;
    const lines = {};
    for (const { ids } of games) {
      for (const [i, id] of ids.entries()) {
        const opponent = ids[1 - i];
        const score = scores.get(id),
          against = scores.get(opponent);
        const team = totals[id];
        team.headWins += Number(score > against);
        team.headTies += Number(score === against);
        team.wins += Number(score > against);
        team.losses += Number(score < against);
        team.ties += Number(score === against);
        if (league.settings.league_average_match) {
          team.wins += Number(score > middle);
          team.losses += Number(score < middle);
          team.ties += Number(score === middle);
        }
        team.pf += score;
        team.pa += against;
        team.allWins += field.filter((s) => s < score).length;
        team.allTies += field.filter((s) => s === score).length - 1;
        lines[id] = { ...team, score, opponent };
      }
    }
    ranking(Object.values(lines));
    for (const row of rows) addStarts(players, row, directory);
    rounds.push({
      week: w,
      average: Math.round(field.reduce((a, b) => a + b, 0) / field.length),
      lines,
    });
  }
  return {
    teams,
    rounds,
    playoffStart: playoffs,
    cutoff: facts.cutoff,
    medianGame: Boolean(league.settings.league_average_match),
    players: [...players.values()].sort(
      (a, b) => b.points - a.points || a.name.localeCompare(b.name),
    ),
  };
}
