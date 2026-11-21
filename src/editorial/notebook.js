import { generate } from "./codex.js";

const domains = new Set(
  "nfl.com azcardinals.com atlantafalcons.com baltimoreravens.com buffalobills.com panthers.com chicagobears.com bengals.com clevelandbrowns.com dallascowboys.com denverbroncos.com detroitlions.com packers.com houstontexans.com colts.com jaguars.com chiefs.com raiders.com chargers.com therams.com miamidolphins.com vikings.com patriots.com neworleanssaints.com giants.com newyorkjets.com philadelphiaeagles.com steelers.com 49ers.com seahawks.com buccaneers.com tennesseetitans.com commanders.com".split(
    " ",
  ),
);

function sourceUrl(value) {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    !domains.has(u.hostname.replace(/^www\./, "")) ||
    !u.pathname.includes("/news/")
  )
    throw new Error("Expected an official NFL or team article");
  u.search = "";
  u.hash = "";
  return u;
}
function plain(html) {
  const entities = {
    nbsp: " ",
    amp: "&",
    quot: '"',
    apos: "'",
    rsquo: "'",
    lsquo: "'",
    ndash: "–",
    mdash: "—",
  };
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) =>
      String.fromCodePoint(
        n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n),
      ),
    )
    .replace(/&([a-z]+);/gi, (all, k) => entities[k] ?? all)
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function verifyArticle(item, player, html, issue, now = new Date()) {
  const url = sourceUrl(item.url);
  const published =
    html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1] ||
    html.match(
      /<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)/i,
    )?.[1];
  const date = new Date(published);
  if (
    !Number.isFinite(date.getTime()) ||
    date > now ||
    now - date > 16 * 86400000 ||
    date.getUTCFullYear() < Number(issue.season)
  )
    throw new Error("Outside the issue date window");
  const body = plain(html),
    evidence = plain(item.evidence || "");
  const count = evidence.split(" ").length;
  const where = body.toLowerCase().indexOf(evidence.toLowerCase());
  if (count < 5 || count > 20 || where < 0)
    throw new Error("Missing or overlong source passage");
  const lastName = plain(player.name)
    .split(" ")
    .filter((n) => !["Jr.", "Sr.", "II", "III", "IV"].includes(n))
    .at(-1)
    .toLowerCase();
  if (
    !body
      .toLowerCase()
      .slice(Math.max(0, where - 220), where + evidence.length + 220)
      .includes(lastName)
  )
    throw new Error("Passage does not identify the player");
  if (
    !new RegExp(
      "week[\\s-]+(?:" + issue.week + "|" + (issue.week + 1) + ")\\b",
      "i",
    ).test(body + " " + url.pathname)
  )
    throw new Error("Missing week reference");
  return {
    playerId: player.id,
    url: url.href,
    date: date.toISOString().slice(0, 10),
    evidence,
  };
}

async function getArticle(value) {
  const url = sourceUrl(value);
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(14_000),
  });
  if (!response.ok) throw new Error("Source unavailable");
  return response.text();
}

async function search(players, facts, model) {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["articles"],
    properties: {
      articles: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["playerId", "url", "evidence"],
          properties: {
            playerId: { type: "string" },
            url: { type: "string" },
            evidence: { type: "string" },
          },
        },
      },
    },
  };
  const prompt = [
    `Search the live web for three distinct official NFL or team news stories relating to ${facts.season} NFL Week ${facts.week} or its next week.`,
    "Choose different named players from the list. Open the dated primary articles. Find a self-contained exact contiguous passage of 5–20 words about each player’s actual game performance or upcoming matchup. Prefer a concrete statistic, and include the player’s name in the passage or the same paragraph.",
    "Use canonical HTTPS /news/ articles on NFL.com or official team sites, published in the last 16 days. Skip unconfirmed stories, predictions, and undated sources. Return only playerId, url, evidence. Return fewer if necessary. Do not use shell commands.",
    JSON.stringify(players.map((p) => ({ id: p.id, name: p.name }))),
  ].join("\n");
  return (await generate({ model, prompt, schema, web: true })).articles;
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
