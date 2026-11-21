import { generate } from "./codex.js";

import {
  articleSchema,
  getArticle,
  sourceUrl,
  verifyArticle,
} from "./sources.js";

async function search(players, facts, model) {
  const prompt = [
    `Search the live web for three distinct official NFL or team news stories relating to ${facts.season} NFL Week ${facts.week} or its next week.`,
    "Choose different named players from the list. Open the dated primary articles. Find a self-contained exact contiguous passage of 5–20 words about each player’s actual game performance or upcoming matchup. Prefer a concrete statistic, and include the player’s name in the passage or the same paragraph.",
    "Use canonical HTTPS /news/ articles on NFL.com or official team sites, published in the last 16 days. Skip unconfirmed stories, predictions, and undated sources. Return only playerId, url, evidence. Return fewer if necessary. Do not use shell commands.",
    JSON.stringify(players.map((p) => ({ id: p.id, name: p.name }))),
  ].join("\n");
  return (await generate({ model, prompt, schema: articleSchema, web: true }))
    .articles;
}

export async function researchNotebook(
  facts,
  model,
  { discover = search, fetchArticle = getArticle } = {},
) {
  const players = facts.standings
    .flatMap((t) => t.lineup?.starters || [])
    .sort((a, b) => b.score - a.score);
  const byId = new Map(players.map((p) => [p.id, p]));
  try {
    const suggestions = await discover(players.slice(0, 24), facts, model);
    const checked = await Promise.allSettled(
      suggestions.slice(0, 6).map(async (item) => {
        const player = byId.get(item.playerId);
        if (!player) throw new Error("Player did not start this week");
        return verifyArticle(
          item,
          player,
          await fetchArticle(sourceUrl(item.url).href),
          facts,
        );
      }),
    );
    const links = new Set(),
      subjects = new Set();
    return checked
      .flatMap((result) => {
        if (result.status !== "fulfilled") return [];
        const item = result.value;
        if (links.has(item.url) || subjects.has(item.playerId)) return [];
        links.add(item.url);
        subjects.add(item.playerId);
        return [item];
      })
      .slice(0, 3);
  } catch (error) {
    console.warn("NFL notebook unavailable:", error.message);
    return [];
  }
}
