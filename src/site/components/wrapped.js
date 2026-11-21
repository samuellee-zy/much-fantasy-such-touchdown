import { ordinal, points, record } from "../../analysis/format.js";
import { fixtureKey } from "../../analysis/fixtures.js";

export function managerStories(f, team, issue, preview) {
  const cards = [];
  const card = (kind, label, title, value, unit, body) => {
    cards.push({ kind, label, title, value, unit, body });
  };
  if (team.lineup) {
    const opponent = f.teams[team.opponent];
    const margin = points(Math.abs(team.score - opponent.score));
    const result = {
      win: "You took the W.",
      loss: "One for the group chat.",
      tie: "A dead heat.",
    }[team.result];
    const outcome =
      team.result === "tie"
        ? `You tied ${opponent.name}.`
        : `You ${team.result === "win" ? "beat" : "trailed"} ${opponent.name} by ${margin}.`;
    card(
      "score",
      "Your final score",
      result,
      points(team.score),
      "team points",
      `${outcome} Your score ranked ${ordinal(team.weekRank)} among this week’s active teams.`,
    );
    cards.at(-1).scores = [team, opponent].map((t) => ({
      name: t.name,
      score: t.score,
    }));
    const p = team.top;
    if (p) {
      const share =
        p.share !== null && p.score > 0
          ? ` That was ${p.share}% of your starters’ points.`
          : "";
      card(
        "star",
        "Your top starter",
        p.name,
        points(p.score),
        p.slot + " points",
        `${p.tied ? "Tied for" : "Ranked"} ${ordinal(p.rank)} of ${p.peers} league starters in the ${p.slot} slot.${share}`,
      );
      cards.at(-1).scores = [...team.lineup.starters]
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((p) => ({ name: p.name, score: p.score }));
    }
    if (team.bench && !team.lineup.adjusted) {
      const b = team.bench,
        after = team.score + b.gain - opponent.score;
      const verdict =
        after === 0
          ? "a tie"
          : `a ${points(Math.abs(after))}-point ${after > 0 ? "win" : "loss"}`;
      card(
        "bench",
        "The bench decision",
        b.name + " for " + b.starter,
        "+" + points(b.gain),
        "possible points",
        `One eligible swap at ${b.slot} would have made it ${verdict}.`,
      );
    } else if (team.lineup.allPlay) {
      card(
        "bench",
        "Around the league",
        "If you played everybody.",
        record(team.lineup.allPlay),
        "all-play record",
        "Here’s how your official score would have fared against every other active team this week.",
      );
    }
  } else {
    card(
      "score",
      "Your week",
      "Off the slate.",
      record(team),
      "season record",
      `Sleeper listed no matchup for you this week. You stand ${ordinal(team.rank)} in the league.`,
    );
  }
  const roast = issue.managers[team.id]?.quip;
  if (roast) card("roast", "The group chat", roast, "", "", "");
  const game = preview && f.upcoming.find((g) => g.ids.includes(team.id));
  if (game) {
    const other = f.teams[game.ids.find((id) => id !== team.id)];
    const feature = issue.previewResearch?.articles?.[fixtureKey(game)];
    const players = game.lineups.flatMap((l) => l.players);
    const watch =
      players.find((p) => p.id === feature?.playerId) ||
      game.lineups.find((l) => l.teamId === team.id)?.players[0];
    const form = watch
      ? watch.average !== null
        ? ` ${watch.name} averaged ${points(watch.average)} in ${watch.count} recent scored ${watch.count === 1 ? "week" : "weeks"}.`
        : ` Watch ${watch.name} in the ${watch.slot} slot.`
      : "";
    card(
      "next",
      "Your next matchup",
      "Up against " + other.name,
      "WK " + (f.week + 1),
      "on deck",
      `You enter at ${record(team)}. ${other.name} comes in at ${record(other)}.${form}`,
    );
    if (feature?.url && watch?.id === feature.playerId)
      cards.at(-1).source = feature.url;
  } else {
    card(
      "next",
      f.final ? "The final whistle" : "The standings",
      f.championId === team.id ? "You won the league." : team.name,
      ordinal(team.rank),
      "league standing",
      `Your regular-season record: ${record(team)}.`,
    );
  }
  return cards;
}

export function wrappedViewer(f, issue, preview) {
  const stories = Object.fromEntries(
    f.standings.map((t) => [t.id, managerStories(f, t, issue, preview)]),
  );
  const json = JSON.stringify(stories).replace(/</g, "\\u003c");
  return `<div class="wrapped-shell" hidden>
    <div class="wrap-progress" aria-hidden="true"></div>
    <header class="wrap-top"><div><span>Weekly Wrapped · Wk ${f.week}</span><strong data-wrap-owner></strong></div><button type="button" data-dismiss aria-label="Close Weekly Wrapped">×</button></header>
    <div class="wrap-card" aria-live="polite" aria-atomic="true">
      <div class="wrap-art" aria-hidden="true"><i></i></div>
      <div class="wrap-copy"><span class="wrap-kicker"></span><h2 id="wrapped-title"></h2><div class="wrap-number"><strong></strong><small></small></div><p></p><ul class="wrap-chart" hidden></ul><a class="wrap-source" hidden>Read the NFL report ↗</a></div>
    </div>
    <div class="wrap-deck"><button type="button" data-wrap-prev aria-label="Previous story">←</button><span data-wrap-count></span><button type="button" data-wrap-next>Next story →</button><button type="button" data-wrap-play>Play</button></div>
    <footer class="wrap-foot"><button type="button" data-wrap-profile>Manager profile</button><button type="button" data-share>Copy Wrapped link</button></footer>
    <input class="profile-url" aria-label="Share this Wrapped link" readonly hidden>
  </div><script id="wrapped-data" type="application/json">${json}</script>`;
}
