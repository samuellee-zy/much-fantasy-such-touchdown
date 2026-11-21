import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const api = "https://api.sleeper.app/v1";

async function read(path) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(api + path, {
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === 3)
        throw new Error(`Sleeper ${path}: ${error.message}`, { cause: error });
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
}

async function players() {
  const file = ".weekly/players.json";
  if (
    await stat(file).then(
      (s) => Date.now() - s.mtimeMs < 86_400_000,
      () => false,
    )
  ) {
    try {
      return JSON.parse(await readFile(file, "utf8"));
    } catch {
      /* Refresh the cache. */
    }
  }
  const catalog = await read("/players/nfl");
  if (!catalog || !Object.keys(catalog).length)
    throw new Error("Sleeper returned an empty player catalog.");
  const names = Object.fromEntries(
    Object.entries(catalog).map(([id, p]) => [
      id,
      {
        name:
          p.position === "DEF"
            ? `${id} defense`
            : p.full_name ||
              [p.first_name, p.last_name].filter(Boolean).join(" "),
        positions: p.fantasy_positions || [p.position],
      },
    ]),
  );
  await mkdir(".weekly", { recursive: true });
  const temp = `${file}.${randomUUID()}`;
  await writeFile(temp, JSON.stringify(names));
  await rename(temp, file);
  return names;
}

export async function fetchLeague(leagueId) {
  const path = "/league/" + encodeURIComponent(leagueId);
  const league = await read(path);
  if (!league || league.sport !== "nfl")
    throw new Error("Expected a Sleeper NFL league.");
  const week = Number(league.settings.last_scored_leg);
  const start = Number(league.settings.start_week || 1);
  if (!Number.isInteger(week) || week < start || week > 18)
    throw new Error("There is no completed week to publish.");
  const playoffStart = league.settings.playoff_week_start;
  const [users, rosters, directory, history, next, bracket] = await Promise.all(
    [
      read(path + "/users"),
      read(path + "/rosters"),
      players(),
      Promise.all(
        Array.from({ length: week - start + 1 }, (_, i) =>
          read(path + "/matchups/" + (start + i)),
        ),
      ),
      week < 18 && league.status !== "complete"
        ? read(path + "/matchups/" + (week + 1))
        : [],
      playoffStart > 0 && week >= playoffStart
        ? read(path + "/winners_bracket")
        : [],
    ],
  );
  return { league, week, users, rosters, directory, history, next, bracket };
}
