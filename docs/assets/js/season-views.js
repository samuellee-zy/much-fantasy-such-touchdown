// Shared by the static edition and the interactive controls.
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
const points = (n) => (n / 100).toFixed(2);
const record = (r) => [r.wins, r.losses, ...(r.ties ? [r.ties] : [])].join("–");
export const winGap = (r, count) =>
  r.headWins + r.headTies / 2 - (r.allWins + r.allTies / 2) / (count - 1);
export const signed = (n) =>
  (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(2);
const teamLink = (team) =>
  `<a href="./#manager-${team.id}">${escape(team.name)}</a>`;

export function roundTable(data, index, mode) {
  const round = data.rounds[index],
    lines = round.lines;
  const rank = [...data.teams].sort(
    (a, b) => lines[a.id].rank - lines[b.id].rank,
  );
  if (mode === "race") {
    return `<table><caption>Standings after Week ${round.week}</caption><thead><tr><th>Rank</th><th>Team</th><th>Record</th><th>Last five</th><th>Points for</th></tr></thead><tbody>
      ${rank
        .map((t, i) => {
          const form = data.rounds
            .slice(Math.max(0, index - 4), index + 1)
            .map((r) => {
              const mine = r.lines[t.id],
                other = r.lines[mine.opponent];
              return mine.score > other.score
                ? "W"
                : mine.score < other.score
                  ? "L"
                  : "T";
            })
            .join(" ");
          return `<tr${i === data.cutoff && i > 0 ? ' class="cut-line"' : ""}><td>${lines[t.id].rank}</td><th scope="row">${teamLink(t)}</th><td>${record(lines[t.id])}</td><td>${form}</td><td>${points(lines[t.id].pf)}</td></tr>`;
        })
        .join("")}</tbody></table>`;
  }
  const games = data.teams.filter((t) => t.id < lines[t.id].opponent);
  return `<table><caption>Week ${round.week} results</caption><thead><tr><th>Team</th><th>Score</th><th>Score</th><th>Opponent</th></tr></thead><tbody>
    ${games
      .map((t) => {
        const first = lines[t.id],
          other = data.teams.find((x) => x.id === first.opponent);
        const second = lines[other.id];
        return `<tr><th scope="row">${teamLink(t)}</th><td class="${first.score > second.score ? "won" : ""}">${points(first.score)}</td><td class="${second.score > first.score ? "won" : ""}">${points(second.score)}</td><td>${teamLink(other)}</td></tr>`;
      })
      .join("")}</tbody></table>`;
}

export function playerRows(data, team, position) {
  const players = data.players
    .filter(
      (p) =>
        (!team || p.team === Number(team)) &&
        (!position || p.position === position),
    )
    .slice(0, 10);
  const max = players[0]?.points || 1;
  return (
    players
      .map((p, i) => {
        const owner = data.teams.find((t) => t.id === p.team);
        return `<tr><td>${i + 1}</td><th scope="row">${escape(p.name)}<small>${escape(p.position)} · ${escape(owner.name)}</small></th>
      <td>${p.starts}</td><td><strong>${points(p.points)}</strong><span class="points-bar" style="--share:${Math.max(0, (100 * p.points) / max)}%"></span></td></tr>`;
      })
      .join("") ||
    '<tr><td colspan="4">No recorded starts for this selection.</td></tr>'
  );
}

export function chartValues(data, mode, team) {
  return data.rounds.map((r) =>
    team === "average"
      ? r.average
      : r.lines[team][mode === "race" ? "rank" : "score"],
  );
}

export function teamForm(data, id, through) {
  const rounds = data.rounds.slice(0, through + 1);
  const team = data.teams.find((t) => t.id === Number(id));
  const best = rounds.reduce((a, b) =>
    a.lines[id].score >= b.lines[id].score ? a : b,
  );
  const scores = rounds.map((r) => r.lines[id].score);
  const last = rounds.at(-1);
  return `${team.name} averaged ${points(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length))} through Week ${last.week}. Their high was ${points(best.lines[id].score)} in Week ${best.week}.`;
}

export function trendChart(data, mode, first, second, index, width = 760) {
  const rank = mode === "race",
    left = 36,
    right = 18,
    top = 15,
    bottom = 175;
  const a = chartValues(data, mode, first),
    b = chartValues(data, mode, second);
  const low = rank
    ? 1
    : Math.min(0, Math.floor(Math.min(...a, ...b) / 2500) * 2500);
  const high = rank
    ? data.teams.length
    : Math.max(low + 2500, Math.ceil(Math.max(...a, ...b) / 2500) * 2500);
  const x = (i) =>
    data.rounds.length === 1
      ? (width + left - right) / 2
      : left + (i * (width - left - right)) / (data.rounds.length - 1);
  const y = (value) =>
    top +
    (bottom - top) *
      (rank ? (value - low) / (high - low) : (high - value) / (high - low));
  const ticks = rank
    ? [...new Set([1, Math.ceil(high / 2), high])]
    : Array.from({ length: 5 }, (_, i) => low + ((high - low) * i) / 4);
  const series = (
    values,
    cls,
  ) => `<polyline class="line ${cls}" points="${values.map((v, i) => x(i) + "," + y(v)).join(" ")}"/>
    ${values.map((v, i) => `<circle class="dot ${cls}" cx="${x(i)}" cy="${y(v)}" r="${i === index ? 5 : 2.5}"/>`).join("")}`;
  const every = Math.ceil(data.rounds.length / (width < 480 ? 6 : 13));
  return `<svg role="img" aria-label="${rank ? "League rank" : "Fantasy points"} by week" viewBox="0 0 ${width} 205">
    ${ticks.map((v) => `<line class="grid" x1="${left}" x2="${width - right}" y1="${y(v)}" y2="${y(v)}"/><text text-anchor="end" x="${left - 8}" y="${y(v) + 4}">${rank ? v : +(v / 100).toFixed(1)}</text>`).join("")}
    ${data.rounds.map((r, i) => (i === data.rounds.length - 1 || (i % every === 0 && data.rounds.length - 1 - i >= every) ? `<text text-anchor="middle" x="${x(i)}" y="199">W${r.week}</text>` : "")).join("")}
    <line class="guide" x1="${x(index)}" x2="${x(index)}" y1="${top}" y2="${bottom}"/>
    ${series(b, "secondary")}${series(a, "primary")}</svg>`;
}

export function scheduleRows(data, sort = "gap") {
  const last = data.rounds.at(-1),
    fieldSize = data.teams.length;
  const rows = data.teams
    .map((team) => {
      const r = last.lines[team.id],
        expected = (r.allWins + r.allTies / 2) / (fieldSize - 1);
      return {
        team,
        expected,
        gap: winGap(r, fieldSize),
        actual: r.headWins + r.headTies / 2,
        against: r.pa,
      };
    })
    .sort((a, b) => b[sort] - a[sort] || b.expected - a.expected);
  const scale = Math.max(1, ...rows.map((r) => Math.abs(r.gap)));
  return rows
    .map(
      (
        r,
      ) => `<tr><th scope="row">${teamLink(r.team)}</th><td>${points(r.against)}</td><td>${r.actual}</td><td>${r.expected.toFixed(2)}</td>
    <td><strong>${signed(r.gap)}</strong><span class="gap-bar ${r.gap < 0 ? "below" : ""}" style="--length:${(50 * Math.abs(r.gap)) / scale}%"></span></td></tr>`,
    )
    .join("");
}
