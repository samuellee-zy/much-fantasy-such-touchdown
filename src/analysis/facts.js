import { previewLineups } from "./fixtures.js";
import assert from "node:assert/strict";
import { cents } from "./format.js";
import { playerHistory, lineup, compareLineups } from "./lineups.js";
function groups(rows, playoff, known, label) {
  assert.ok(Array.isArray(rows), label + " matchups missing");
  const seen = new Set();
  const pairs = new Map();
  for (const row of rows) {
    assert.ok(
      known.has(row.roster_id) && !seen.has(row.roster_id),
      label + " roster mismatch",
    );
    seen.add(row.roster_id);
    if (row.matchup_id == null && playoff) continue;
    assert.ok(Number.isInteger(row.matchup_id), label + " unassigned matchup");
    if (!pairs.has(row.matchup_id)) pairs.set(row.matchup_id, []);
    pairs.get(row.matchup_id).push(row.roster_id);
  }
  if (!playoff) assert.equal(seen.size, known.size, label + " missing teams");
  const complete = [];
  for (const [id, ids] of pairs) {
    if (playoff && ids.length === 1 && label === "Upcoming") continue;
    assert.equal(ids.length, 2, label + " incomplete pairing");
    complete.push({ id, ids });
  }
  return complete.sort((a, b) => a.id - b.id);
}

function ranking(teams) {
  const order = [...teams].sort(
    (a, b) =>
      2 * b.wins + b.ties - (2 * a.wins + a.ties) ||
      b.pf - a.pf ||
      b.pa - a.pa ||
      a.id - b.id,
  );
  order.forEach((team, index) => {
    const previous = order[index - 1];
    team.rank =
      previous &&
      2 * previous.wins + previous.ties === 2 * team.wins + team.ties &&
      previous.pf === team.pf &&
      previous.pa === team.pa
        ? previous.rank
        : index + 1;
  });
  return order;
}

const total = (row) => {
  const score = row.custom_points ?? row.points;
  assert.ok(Number.isFinite(score), "Missing team score");
  return cents(score);
};

export function buildFacts({
  league,
  week,
  users,
  rosters,
  directory,
  history,
  next,
  bracket,
}) {
  const s = league.settings;
  assert.equal(rosters.length, league.total_rosters, "Incomplete roster list");
  const known = new Set(rosters.map((r) => r.roster_id));
  assert.equal(known.size, rosters.length, "Duplicate roster");
  const playoff = s.playoff_week_start > 0 && week >= s.playoff_week_start;
  const played = history.at(-1);
  const games = groups(played, playoff, known, "Completed");
  assert.ok(games.length, "No completed pairings");
  const owners = new Map(users.map((u) => [u.user_id, u]));
  const slots = league.roster_positions.filter(
    (slot) => !["BN", "IR", "TAXI"].includes(slot),
  );
  const rows = new Map(played.map((row) => [row.roster_id, row]));
  const start = s.start_week || 1;
  const priorRounds = history.slice(0, -1);
  const priorPlayers = playerHistory(priorRounds);
  const teams = rosters.map((roster) => {
    const id = roster.roster_id;
    const owner = owners.get(roster.owner_id);
    assert.ok(!roster.owner_id || owner, "Missing manager");
    const name =
      owner?.metadata?.team_name || owner?.display_name || `Team ${id}`;
    const manager = owner?.display_name || "Unassigned team";
    const {
      wins,
      losses,
      ties = 0,
      fpts,
      fpts_decimal = 0,
      fpts_against = 0,
      fpts_against_decimal = 0,
    } = roster.settings;
    assert.ok(
      [wins, losses, ties, fpts, fpts_decimal].every(Number.isFinite),
      "Incomplete standings",
    );
    if (!playoff && !s.league_average_match)
      assert.equal(
        wins + losses + ties,
        week - start + 1,
        "Standings have not caught up with the results",
      );
    const row = rows.get(id);
    const active = row?.matchup_id != null;
    const recent = history.slice(-3).flatMap((round) => {
      const game = round.find(
        (r) => r.roster_id === id && r.matchup_id != null,
      );
      return game ? [total(game)] : [];
    });
    const previousScores = priorRounds.slice(-3).flatMap((round) => {
      const previous = round.find(
        (r) => r.roster_id === id && r.matchup_id != null,
      );
      return previous ? [total(previous)] : [];
    });
    return {
      id,
      name,
      manager,
      wins,
      losses,
      ties,
      pf: 100 * fpts + fpts_decimal,
      pa: 100 * fpts_against + fpts_against_decimal,
      score: active ? total(row) : null,
      recent,
      previousScores,
      ...(active
        ? lineup(
            row,
            slots,
            directory,
            !s.reserve_slots && !s.taxi_slots,
            priorPlayers,
          )
        : {}),
    };
  });
  const byId = Object.fromEntries(teams.map((t) => [t.id, t]));
  const active = teams.filter((t) => t.score !== null);
  const standings = ranking(teams);
  for (const game of games) {
    const [a, b] = game.ids.map((id) => byId[id]);
    game.margin = Math.abs(a.score - b.score);
    for (const [team, other] of [
      [a, b],
      [b, a],
    ]) {
      team.opponent = other.id;
      team.result =
        team.score > other.score
          ? "win"
          : team.score < other.score
            ? "loss"
            : "tie";
      team.weekRank = 1 + active.filter((t) => t.score > team.score).length;
      team.outscored = active.filter((t) => t.score < team.score).length;
    }
  }
  if (!playoff && !s.league_average_match && week > start) {
    const previous = ranking(
      teams.map((t) => ({
        ...t,
        wins: t.wins - Number(t.result === "win"),
        losses: t.losses - Number(t.result === "loss"),
        ties: t.ties - Number(t.result === "tie"),
        pf: t.pf - t.score,
        pa: t.pa - byId[t.opponent].score,
      })),
    );
    for (const t of previous) byId[t.id].priorRank = t.rank;
  }
  compareLineups(teams);
  const titleGame = bracket?.find((g) => g.p === 1);
  const champion = titleGame?.w && byId[titleGame.w];
  const final = Boolean(champion || league.status === "complete" || week >= 18);
  if (final && playoff && s.playoff_teams > 1 && !champion) {
    throw new Error(
      "The championship result has not been confirmed by Sleeper.",
    );
  }
  const nextPlayoff =
    s.playoff_week_start > 0 && week + 1 >= s.playoff_week_start;
  const upcoming = final ? [] : groups(next, nextPlayoff, known, "Upcoming");
  // Use only completed weeks in previews, even when the next slate is already live.
  for (const g of upcoming) {
    const [a, b] = g.ids.map((id) => byId[id]);
    const past = history
      .slice()
      .reverse()
      .find((round) => {
        const ar = round.find((r) => r.roster_id === a.id);
        return (
          ar?.matchup_id != null &&
          round.some(
            (r) => r.roster_id === b.id && r.matchup_id === ar.matchup_id,
          )
        );
      });
    if (past)
      g.lastMeeting = g.ids.map((id) =>
        total(past.find((r) => r.roster_id === id)),
      );
    g.rankSum = a.rank + b.rank;
  }
  previewLineups(upcoming, next, history, directory, slots);
  upcoming.sort((a, b) => a.rankSum - b.rankSum || a.id - b.id);
  return {
    name: league.name,
    leagueId: league.league_id,
    season: league.season,
    week,
    playoff,
    cutoff: s.playoff_teams,
    nextPlayoff,
    final,
    champion: champion?.name,
    teams: byId,
    standings,
    games,
    upcoming,
  };
}
