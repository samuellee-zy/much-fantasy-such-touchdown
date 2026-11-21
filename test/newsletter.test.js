import test from "node:test";
import assert from "node:assert/strict";
import { buildFacts } from "../src/analysis/facts.js";
import { eligible } from "../src/analysis/lineups.js";
import { writeManagers } from "../src/editorial/writing.js";
import { render } from "../src/site/render.js";

import { buildHighlights } from "../src/site/components/highlights.js";
import { managerStories } from "../src/site/components/wrapped.js";
import { labGames } from "../src/site/components/matchup-lab.js";

function sample() {
  const row = (id, a, b, qb) => ({
    roster_id: id,
    matchup_id: 1,
    points: a + b,
    custom_points: null,
    starters: ["r" + id, "w" + id],
    starters_points: [a, b],
    players: ["r" + id, "w" + id, "q" + id],
    players_points: { ["r" + id]: a, ["w" + id]: b, ["q" + id]: qb },
  });
  const history = [[row(1, 25, 12, 45), row(2, 10, 12, 35)]];
  return {
    league: {
      league_id: "123",
      name: "A & B",
      season: "2026",
      sport: "nfl",
      total_rosters: 2,
      roster_positions: ["RB", "FLEX", "BN"],
      settings: { start_week: 1, playoff_week_start: 3, playoff_teams: 1 },
    },
    week: 1,
    users: [
      { user_id: "a", display_name: "<Alice>" },
      { user_id: "b", display_name: "Bob" },
    ],
    rosters: [1, 2].map((id) => ({
      roster_id: id,
      owner_id: id === 1 ? "a" : "b",
      settings: {
        wins: id === 1 ? 1 : 0,
        losses: id === 1 ? 0 : 1,
        ties: 0,
        fpts: id === 1 ? 37 : 22,
      },
    })),
    directory: Object.fromEntries(
      [1, 2].flatMap((id) =>
        ["r", "w", "q"].map((p, i) => [
          p + id,
          {
            name: ["Runner", "Receiver", "Passer"][i] + id,
            positions: [["RB", "WR", "QB"][i]],
          },
        ]),
      ),
    ),
    history,
    next: history[0].map((r) => ({ ...r, points: 9999 })),
    bracket: [],
  };
}
const allColumns = { awards: true, standings: true, preview: true };

test("commissioner score overrides include zero, and tied weeks have no winner", () => {
  const data = sample();
  for (const row of data.history[0]) row.custom_points = 0;
  const f = buildFacts(data);
  assert.equal(f.games[0].margin, 0);
  assert.ok(
    f.standings.every(
      (t) => t.score === 0 && t.result === "tie" && t.weekRank === 1,
    ),
  );
});

test("bench alternatives use starter slots and position eligibility", () => {
  assert.ok(eligible("FLEX", ["TE"]));
  assert.ok(!eligible("FLEX", ["QB"]));
  const data = sample();
  assert.equal(buildFacts(data).teams[1].bench, null);
  data.directory.q1.positions = ["TE"];
  const bench = buildFacts(data).teams[1].bench;
  assert.deepEqual(bench, {
    name: "Passer1",
    starter: "Receiver1",
    slot: "FLEX",
    gain: 3300,
  });
});

test("missing scores, rosters, lineup data, records, or upcoming opponents prevent publication", () => {
  for (const damage of [
    (d) => d.history[0].pop(),
    (d) => (d.history[0][0].points = null),
    (d) => (d.history[0][1].roster_id = 1),
    (d) => d.history[0][0].starters_points.pop(),
    (d) => d.next.pop(),
    (d) => (d.rosters[0].settings.wins = 0),
  ]) {
    const data = sample();
    damage(data);
    assert.throws(() => buildFacts(data));
  }
});

test("prose, team names, keys and preview scores remain tied to the completed issue", async () => {
  const f = buildFacts(sample());
  const managers = await writeManagers(f, null, "test", async () => {
    throw new Error("Writer offline");
  });
  const html = render(
    f,
    { managers, publishedAt: "2026-11-21T12:00:00Z" },
    allColumns,
  );
  assert.equal((html.match(/data-manager=/g) || []).length, 2);
  assert.equal((html.match(/data-game=/g) || []).length, 1);
  assert.ok(html.includes("&lt;Alice&gt;") && !html.includes("<Alice>"));
  assert.ok(!html.includes("9999") && !html.includes("999,900"));
  assert.ok(
    managers[1].text.includes("37.00") && managers[2].text.includes("22.00"),
  );
  assert.ok(
    !render(f, { managers, publishedAt: "2026-11-21" }, {}).includes(
      'id="next"',
    ),
  );
});

test("bad AI copy falls back per manager and unchanged notes are reused on reruns", async () => {
  const f = buildFacts(sample());
  let calls = 0;
  const writer = async (briefs) => {
    calls++;
    return briefs.map((b) => ({
      id: b.id,
      angle: "duo",
      quip:
        b.id === 1 ? "Give the lineup a curtain call." : "A made-up 99 points!",
    }));
  };
  const managers = await writeManagers(f, null, "test", writer);
  assert.ok(managers[1].text.includes("curtain call"));
  assert.ok(!managers[2].text.includes("99"));
  assert.deepEqual(
    await writeManagers(f, { managers }, "test", writer),
    managers,
  );
  assert.equal(calls, 1);
  f.teams[1].top.name = "Corrected name";
  const corrected = await writeManagers(
    f,
    { managers },
    "test",
    async (briefs) => {
      assert.deepEqual(
        briefs.map((b) => b.id),
        [1],
      );
      return [];
    },
  );
  assert.match(corrected[1].text, /Corrected name/);
  assert.deepEqual(corrected[2], managers[2]);
});

test("championship names the winner and closes without an upcoming fixture", async () => {
  const d = sample();
  d.league.status = "complete";
  d.league.settings.playoff_week_start = 1;
  d.bracket = [{ p: 1, w: 2 }];
  d.next = [];
  const f = buildFacts(d);
  assert.equal(f.champion, "Bob");
  assert.deepEqual(f.upcoming, []);
  const managers = await writeManagers(f, null, "test", async () => []);
  const html = render(f, { managers, publishedAt: "2026-11-21" }, allColumns);
  assert.ok(
    html.includes("Bob takes the title.") && !html.includes("Week 2 preview"),
  );
});

test("full breakdown covers each starter and reserve and uses only earlier weeks for form", async () => {
  const data = sample();
  const prior = structuredClone(data.history[0]);
  prior[0].points = 20;
  prior[0].players_points.r1 = 13;
  prior[0].players_points.w1 = 7;
  data.history.unshift(prior);
  data.week = 2;
  for (const roster of data.rosters) roster.settings.wins++;
  const f = buildFacts(data);
  const l = f.teams[1].lineup;
  assert.equal(l.starters[0].priorAvg, 1300);
  assert.equal(l.starters[0].rank, 1);
  assert.equal(l.starters[0].peers, 2);
  assert.equal(l.starters[0].share, 68);
  assert.equal(l.edges[0].delta, 1500);
  assert.deepEqual(l.allPlay, { wins: 1, losses: 0, ties: 0 });
  assert.deepEqual(f.teams[1].previousScores, [2000]);
  assert.equal(l.reserves.length, 1);
  const copy = await writeManagers(f, null, "test", async () => []);
  const html = render(
    f,
    { managers: copy, publishedAt: "2026-11-21" },
    allColumns,
  );
  assert.equal([...html.matchAll(/data-player=/g)].length, 6);
  assert.equal([...html.matchAll(/<details class="analysis"/g)].length, 2);
  assert.match(html, /12.00 above the recent average of 13.00/);
});

test("a missing bench score is retained as unavailable and an eligible bench swap can overturn the loss", async () => {
  const data = sample();
  delete data.history[0][0].players_points.q1;
  data.directory.q2.positions = ["RB"];
  const f = buildFacts(data);
  assert.equal(f.teams[1].lineup.reserves[0].score, null);
  const html = render(
    f,
    {
      managers: await writeManagers(f, null, "test", async () => []),
      publishedAt: "2026-11-21",
    },
    allColumns,
  );
  assert.match(html, /changes the result to a 10.00-point win/);
  assert.match(html, /no individual score recorded/);
});

test("preview watches only the new starters and calculates form from completed games", async () => {
  const data = sample();
  data.next[0].starters = ["q1", "w1"];
  data.next[0].players_points = { ...data.next[0].players_points, q1: 9999 };
  const f = buildFacts(data),
    line = f.upcoming[0].lineups[0];
  assert.deepEqual(
    line.players.map((p) => p.id),
    ["q1", "w1"],
  );
  assert.equal(line.players[0].average, 4500);
  assert.equal(line.players[0].count, 1);
  assert.equal(line.players[1].low, 1200);
  assert.equal(line.players[1].high, 1200);
});

test("lab exposes only eligible swaps and safely serializes team names", async () => {
  const data = sample();
  data.users[0].display_name = "</script><fake>";
  data.directory.q2.positions = ["TE"];
  const f = buildFacts(data);
  const html = render(
    f,
    {
      managers: await writeManagers(f, null, "test", async () => []),
      publishedAt: "2026-11-21",
    },
    allColumns,
  );
  const lab = JSON.parse(html.match(/id="lab-data">([^<]*)<\/script>/)[1]);
  assert.equal(lab[0].teams[0].name, "</script><fake>");
  assert.deepEqual(lab[0].teams[0].reserves, []);
  assert.deepEqual(lab[0].teams[1].reserves[0].targets, ["w2"]);
});

test("highlight cues select a result-changing eligible swap and its exact starter", () => {
  const data = sample();
  data.directory.q1.positions = ["TE"];
  data.directory.q2.positions = ["RB"];
  const f = buildFacts(data);
  const scenes = buildHighlights(f, labGames(f), true);
  assert.deepEqual(
    scenes.map((s) => s.kind),
    ["result", "swap", "preview"],
  );
  const swap = scenes[1];
  assert.equal(swap.game, f.games[0].id);
  assert.equal(swap.teams[0].id, 2);
  assert.equal(swap.inId, "q2");
  assert.equal(swap.outId, "r2");
  assert.equal(swap.metric, "+25.00");
  assert.equal(swap.teams[0].score + 2500 - swap.teams[1].score, 1000);
});

test("a tie, no eligible bench move, and a completed championship have usable highlights", () => {
  const data = sample();
  data.history[0].forEach((r) => (r.custom_points = 22));
  data.league.status = "complete";
  data.league.settings.playoff_week_start = 1;
  data.bracket = [{ p: 1, w: 2 }];
  data.next = [];
  const f = buildFacts(data);
  const scenes = buildHighlights(f, labGames(f), true);
  assert.deepEqual(
    scenes.map((s) => s.kind),
    ["result", "star", "champion"],
  );
  assert.match(scenes[0].title, /draw/);
  assert.equal(scenes[2].teams[0].id, 2);
});

test("the standings switch appears only when the prior records are known", async () => {
  const data = sample();
  const issue = {
    managers: await writeManagers(
      buildFacts(data),
      null,
      "test",
      async () => [],
    ),
    publishedAt: "2026-11-21",
  };
  assert.doesNotMatch(
    render(buildFacts(data), issue, allColumns),
    /data-period="prior"/,
  );
  data.history.push(structuredClone(data.history[0]));
  data.rosters[0].settings.wins++;
  data.rosters[1].settings.losses++;
  data.week++;
  const facts = buildFacts(data);
  assert.deepEqual(facts.teams[2].priorRecord, { wins: 0, losses: 1, ties: 0 });
  assert.match(
    render(facts, issue, allColumns),
    /data-record-now="0–2" data-record-prior="0–1"/,
  );
});

test("Wrapped tells each manager's own result, top starter, eligible swap, roast and upcoming game", () => {
  const data = sample();
  data.directory.q2.positions = ["RB"];
  const facts = buildFacts(data);
  const issue = {
    managers: { 1: { quip: "Winner quip." }, 2: { quip: "Runner-up quip." } },
  };
  const stories = managerStories(facts, facts.teams[2], issue, true);
  assert.deepEqual(
    stories.map((s) => s.kind),
    ["score", "star", "bench", "roast", "next"],
  );
  assert.equal(stories[0].value, "22.00");
  assert.equal(stories[1].title, "Receiver2");
  assert.equal(stories[2].value, "+25.00");
  assert.match(stories[2].body, /10.00-point win/);
  assert.equal(stories[3].title, "Runner-up quip.");
  assert.match(stories[4].title, /<Alice>/);
  data.history[0][1].custom_points = 22;
  const adjusted = buildFacts(data);
  assert.equal(
    managerStories(adjusted, adjusted.teams[2], issue, true)[2].unit,
    "all-play record",
  );
});

test("a manager on a playoff bye gets a shareable story without fabricated scores", () => {
  const data = sample();
  const facts = buildFacts(data);
  const team = { ...facts.teams[1], lineup: undefined, score: null };
  facts.upcoming = [];
  facts.final = true;
  const cards = managerStories(facts, team, { managers: {} }, true);
  assert.deepEqual(
    cards.map((s) => s.kind),
    ["score", "next"],
  );
  assert.equal(cards[0].unit, "season record");
  assert.equal(cards[1].label, "The final whistle");
  assert.doesNotMatch(JSON.stringify(cards), /NaN|undefined/);
});
