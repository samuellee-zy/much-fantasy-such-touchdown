import { generate } from "./codex.js";
import {
  articleSchema,
  sourceUrl,
  getArticle,
  verifyArticle,
} from "./sources.js";

import { fixtureKey } from "../analysis/fixtures.js";

async function findPreviewSources(fixtures, facts, model) {
  const prompt = [
    `Use live web search to research the upcoming NFL Week ${facts.week + 1} of ${facts.season}. Find one official NFL or team preview for each supplied fantasy pairing. Include an alternate for a different starter when possible.`,
    "Each article must discuss the upcoming NFL opponent, a defensive tendency, expected usage backed by the team, or a meaningful on-field matchup. Look for a concrete reason the named starter matters. Exclude postgame recaps of the target week, injury speculation, and predictions presented as facts.",
    "Return a player ID, the canonical HTTPS URL of the official /news/ article, and a contiguous 5–20 word passage about the named player or the opponent in that player’s paragraph. Use published articles from the past 16 days which identify the target week. Open each source. Do not run shell commands.",
    JSON.stringify(
      fixtures.map((g) =>
        g.lineups.map((l) =>
          l.players.map((p) => ({ id: p.id, name: p.name })),
        ),
      ),
    ),
  ].join("\n");
  return (await generate({ model, prompt, schema: articleSchema, web: true }))
    .articles;
}

export async function researchPreviews(
  facts,
  model,
  previous,
  {
    discover = findPreviewSources,
    fetchArticle = getArticle,
    now = new Date(),
  } = {},
) {
  const articles = {},
    missing = [],
    day = now.toISOString().slice(0, 10);
  for (const g of facts.upcoming) {
    const key = fixtureKey(g),
      old = previous?.articles?.[key];
    const starters = g.lineups.flatMap((l) => l.players);
    if (old && starters.some((p) => p.id === old.playerId)) articles[key] = old;
    else if (starters.length && (previous?.checkedOn !== day || old))
      missing.push(g);
  }
  if (!missing.length)
    return { checkedOn: previous?.checkedOn || day, articles };
  const candidates = new Map();
  for (const g of missing)
    for (const l of g.lineups)
      for (const p of l.players)
        candidates.set(p.id, { player: p, key: fixtureKey(g) });
  try {
    const items = await discover(missing, facts, model);
    const used = new Set(Object.values(articles).map((a) => a.url));
    const checked = await Promise.allSettled(
      items.slice(0, missing.length * 2).map(async (item) => {
        const match = candidates.get(item.playerId);
        if (!match) throw new Error("Not in the upcoming lineups");
        const url = sourceUrl(item.url);
        const story = verifyArticle(
          item,
          match.player,
          await fetchArticle(url.href),
          facts,
          now,
          [facts.week + 1],
        );
        return { key: match.key, story };
      }),
    );
    for (const result of checked) {
      if (result.status !== "fulfilled") continue;
      const { key, story } = result.value;
      if (!articles[key] && !used.has(story.url)) {
        articles[key] = story;
        used.add(story.url);
      }
    }
  } catch (error) {
    console.warn("Week-ahead research unavailable:", error.message);
  }
  return { checkedOn: day, articles };
}
