const domains = new Set(
  "nfl.com azcardinals.com atlantafalcons.com baltimoreravens.com buffalobills.com panthers.com chicagobears.com bengals.com clevelandbrowns.com dallascowboys.com denverbroncos.com detroitlions.com packers.com houstontexans.com colts.com jaguars.com chiefs.com raiders.com chargers.com therams.com miamidolphins.com vikings.com patriots.com neworleanssaints.com giants.com newyorkjets.com philadelphiaeagles.com steelers.com 49ers.com seahawks.com buccaneers.com tennesseetitans.com commanders.com".split(
    " ",
  ),
);

export function sourceUrl(value) {
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

export function verifyArticle(
  item,
  player,
  html,
  issue,
  now = new Date(),
  weeks = [issue.week, issue.week + 1],
) {
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
    !new RegExp("week[\\s-]+(?:" + weeks.join("|") + ")\\b", "i").test(
      body + " " + url.pathname,
    )
  )
    throw new Error("Missing week reference");
  return {
    playerId: player.id,
    url: url.href,
    date: date.toISOString().slice(0, 10),
    evidence,
  };
}

export async function getArticle(value) {
  const url = sourceUrl(value);
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(14_000),
  });
  if (!response.ok) throw new Error("Source unavailable");
  return response.text();
}

export const articleSchema = {
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
