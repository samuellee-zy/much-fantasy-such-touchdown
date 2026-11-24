import test from "node:test";
import assert from "node:assert/strict";
import { buildSeason } from "../src/analysis/season.js";
import { previewLineups } from "../src/analysis/fixtures.js";
import { renderSeason } from "../src/site/season.js";
import {
  chartValues,
  playerRows,
  roundTable,
  winGap,
} from "../docs/assets/js/season-views.js";

function sample() {
  const teams = [1, 2, 3, 4].map((id) => ({
    id,
    name: id === 1 ? "</script><fake>" : "Team " + id,
  }));
  const score = (id, pair, n, player = "p" + id) => ({
    roster_id: id,
    matchup_id: pair,
    points: n,
    starters: [player],
    starters_points: [n],
  });
  const history = [
    [score(1, 1, 10), score(2, 1, 15), score(3, 2, 5), score(4, 2, 15)],
    [
      score(1, 1, 18, "p2"),
      score(2, 2, 30, "p1"),
      score(3, 1, 15),
      { ...score(4, 2, 25), custom_points: 0 },
    ],
    [],
  ];
  const facts = {
    standings: teams,
    cutoff: 2,
    leagueId: "123",
    name: "League",
    season: "2026",
  };
  const snapshot = {
    league: { settings: { start_week: 4, playoff_week_start: 6 } },
    directory: {},
    history,
    week: 6,
  };
  return { facts, snapshot };
}

test("rank history, ties against the field and transferred starters use each completed regular-season week", () => {
  const { facts, snapshot } = sample(),
    season = buildSeason(snapshot, facts);
  assert.deepEqual(
    season.rounds.map((r) => r.week),
    [4, 5],
  );
  const lines = season.rounds.at(-1).lines;
  assert.deepEqual([lines[2].rank, lines[2].wins, lines[2].pf], [1, 2, 4500]);
  assert.equal(lines[4].score, 0);
  assert.deepEqual([lines[2].allWins, lines[2].allTies], [5, 1]);
  assert.ok(Math.abs(winGap(lines[2], 4) - 1 / 6) < 1e-8);
  assert.deepEqual(chartValues(season, "scoring", "average"), [1125, 1575]);
  assert.deepEqual(chartValues(season, "race", "1"), [3, 2]);
  assert.deepEqual(
    season.players.filter((p) => p.id === "p2").map((p) => [p.team, p.points]),
    [
      [1, 1800],
      [2, 1500],
    ],
  );
  assert.match(playerRows(season, "1", "Other"), /18\.00/);
  assert.match(roundTable(season, 0, "scoring"), /Week 4 results/);
  const html = renderSeason(facts, { publishedAt: "2026-11-24" }, season, {});
  assert.ok(!html.includes("<fake>"));
  assert.equal(
    JSON.parse(html.match(/id="season-data">([^<]*)<\/script>/)[1]).teams[0]
      .name,
    facts.standings[0].name,
  );
  assert.doesNotMatch(html, /NaN|undefined/);
});

test("a stale upcoming assignment does not put a traded player on both teams", () => {
  const games = [{ ids: [1, 2] }],
    rows = [1, 2].map((id) => ({ roster_id: id, starters: ["z"] }));
  previewLineups(
    games,
    rows,
    [],
    { z: { name: "Zay Flowers" } },
    ["WR"],
    [
      { roster_id: 1, players: [] },
      { roster_id: 2, players: ["z"] },
    ],
  );
  assert.deepEqual(
    games[0].lineups.map((l) => l.players.map((p) => p.id)),
    [[], ["z"]],
  );
});
