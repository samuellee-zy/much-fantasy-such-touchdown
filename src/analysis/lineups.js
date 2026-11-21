import assert from "node:assert/strict";
import { cents } from "./format.js";
const flex = {
  FLEX: ["RB", "WR", "TE"],
  SUPER_FLEX: ["QB", "RB", "WR", "TE"],
  REC_FLEX: ["WR", "TE"],
  WRRB_FLEX: ["WR", "RB"],
  IDP_FLEX: ["DL", "LB", "DB"],
};
export function eligible(slot, positions) {
  return (
    positions?.includes(slot) ||
    (flex[slot] || []).some((p) => positions?.includes(p))
  );
}

export function playerHistory(rounds) {
  const history = new Map();
  for (const round of rounds.slice(-3)) {
    const week = new Map();
    for (const row of round) {
      for (const [id, n] of Object.entries(row.players_points || {})) {
        if (Number.isFinite(n)) week.set(id, cents(n));
      }
    }
    for (const [id, score] of week) {
      if (!history.has(id)) history.set(id, []);
      history.get(id).push(score);
    }
  }
  return history;
}

export const mean = (values) =>
  values.length
    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    : null;

export function lineup(row, slots, directory, allowBench, history) {
  assert.ok(
    Array.isArray(row.starters) && row.starters.length === slots.length,
    "Incomplete starter list",
  );
  assert.ok(
    Array.isArray(row.starters_points) &&
      row.starters_points.length === slots.length,
    "Incomplete starter scores",
  );
  assert.ok(Array.isArray(row.players), "Missing weekly roster");
  const knownStarters = row.starters.filter((id) => id && id !== "0");
  assert.equal(
    new Set(knownStarters).size,
    knownStarters.length,
    "Duplicate starter",
  );

  function player(id, slot, score) {
    const prior = history.get(id) || [];
    const p = directory[id];
    return {
      id,
      name: p?.name || `Sleeper player ${id}`,
      positions: p?.positions || [],
      slot,
      score,
      priorCount: prior.length,
      priorAvg: mean(prior),
    };
  }

  const starters = [],
    vacancies = [];
  row.starters.forEach((id, i) => {
    if (!id || id === "0") {
      vacancies.push({ name: "Open slot", slot: slots[i], score: 0 });
      return;
    }
    assert.ok(Number.isFinite(row.starters_points[i]), "Missing starter score");
    starters.push(player(id, slots[i], cents(row.starters_points[i])));
  });
  const sorted = [...starters, ...vacancies].sort((a, b) => b.score - a.score);
  const leaders = sorted.filter((p) => p.id);
  let bench = null;
  const reserves = [...new Set(row.players)]
    .filter((id) => id && id !== "0" && !row.starters.includes(id))
    .map((id) => {
      const n = row.players_points?.[id];
      const p = player(id, "BN", Number.isFinite(n) ? cents(n) : null);
      if (allowBench && p.score !== null) {
        const alternative = sorted.findLast((s) =>
          eligible(s.slot, p.positions),
        );
        if (alternative) {
          p.comparison = {
            name: alternative.name,
            slot: alternative.slot,
            delta: p.score - alternative.score,
          };
          if (p.comparison.delta > (bench?.gain || 0))
            bench = {
              name: p.name,
              starter: alternative.name,
              slot: alternative.slot,
              gain: p.comparison.delta,
            };
        }
      }
      return p;
    })
    .sort(
      (a, b) =>
        (b.score ?? -Infinity) - (a.score ?? -Infinity) ||
        a.name.localeCompare(b.name),
    );
  return {
    top: leaders[0],
    second: leaders[1],
    bench,
    lineup: {
      starters,
      reserves,
      vacancies,
      starterTotal: starters.reduce((sum, p) => sum + p.score, 0),
      adjusted: row.custom_points != null,
    },
  };
}

export function compareLineups(teams) {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const active = teams.filter((t) => t.lineup);
  const peers = new Map();
  for (const t of active) {
    const unit = {};
    for (const p of [...t.lineup.starters, ...t.lineup.vacancies]) {
      unit[p.slot] = (unit[p.slot] || 0) + p.score;
      if (p.id) {
        if (!peers.has(p.slot)) peers.set(p.slot, []);
        peers.get(p.slot).push(p.score);
      }
    }
    t.lineup.units = unit;
  }
  for (const t of active) {
    const l = t.lineup;
    for (const p of l.starters) {
      const group = peers.get(p.slot);
      p.peers = group.length;
      p.rank = 1 + group.filter((n) => n > p.score).length;
      p.tied = group.filter((n) => n === p.score).length > 1;
      p.share =
        l.starterTotal > 0
          ? Math.round((100 * p.score) / l.starterTotal)
          : null;
    }
    const other = byId.get(t.opponent);
    if (!other?.lineup) continue;
    l.edges = Object.entries(l.units)
      .map(([slot, own]) => ({
        slot,
        own,
        opponent: other.lineup.units[slot] || 0,
        delta: own - (other.lineup.units[slot] || 0),
      }))
      .sort((a, b) => b.delta - a.delta);
    l.allPlay = {
      wins: active.filter((x) => x.score < t.score).length,
      losses: active.filter((x) => x.score > t.score).length,
      ties: active.filter((x) => x.id !== t.id && x.score === t.score).length,
    };
    l.opponentScore = other.score;
  }
}
