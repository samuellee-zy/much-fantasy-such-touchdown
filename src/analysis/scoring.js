import assert from "node:assert/strict";
import { cents } from "./format.js";

export function groups(rows, playoff, known, label) {
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

export function ranking(teams) {
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

export function total(row) {
  const score = row.custom_points ?? row.points;
  assert.ok(Number.isFinite(score), "Missing team score");
  return cents(score);
}
