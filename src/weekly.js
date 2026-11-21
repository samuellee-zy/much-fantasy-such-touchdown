import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  link,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { buildFacts } from "./analysis/facts.js";
import { render } from "./site/render.js";
import { fetchLeague } from "./data/sleeper.js";
import { researchNotebook } from "./editorial/notebook.js";
import { writeManagers } from "./editorial/writing.js";

process.chdir(fileURLToPath(new URL("../", import.meta.url)));
const config = JSON.parse(await readFile("league.json", "utf8"));
const publish = process.argv.includes("--publish");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

async function readPrevious() {
  try {
    return JSON.parse(await readFile("edition.json", "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return null;
  }
}

async function acquire() {
  await mkdir(".weekly", { recursive: true });
  const own = ".weekly/" + randomUUID() + ".lock";
  const lock = ".weekly/publisher.lock";
  await writeFile(own, String(process.pid));
  try {
    for (;;) {
      try {
        await link(own, lock);
        return () => unlink(lock);
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
      const pid = Number(await readFile(lock, "utf8"));
      try {
        process.kill(pid, 0);
      } catch (error) {
        if (error.code === "ESRCH") {
          await unlink(lock);
          continue;
        }
        throw error;
      }
      throw new Error("Another weekly update is running.");
    }
  } finally {
    await unlink(own);
  }
}

async function replaceIfChanged(file, contents) {
  const old = await readFile(file, "utf8").catch((error) => {
    if (error.code !== "ENOENT") throw error;
    return null;
  });
  if (old === contents) return;
  const temp = ".weekly/" + randomUUID();
  await writeFile(temp, contents);
  await rename(temp, file);
}

async function verifyPages(url, html) {
  for (let i = 0; i < 32; i++) {
    try {
      const target = new URL(url);
      target.searchParams.set("verify", String(Date.now()));
      const res = await fetch(target, { signal: AbortSignal.timeout(10_000) });
      if (res.ok && (await res.text()).trim() === html.trim()) return;
    } catch {
      /* A deployment or transient network issue may still be clearing. */
    }
    await delay(5000);
  }
  throw new Error(
    `The push succeeded. GitHub Pages has yet to serve this edition at ${url}. Rerun npm run weekly to retry verification.`,
  );
}

async function run() {
  if (publish && git("branch", "--show-current") !== "main")
    throw new Error("Publish from the main branch.");
  const facts = buildFacts(await fetchLeague(config.leagueId));
  const previous = await readPrevious();
  const same =
    previous?.leagueId === config.leagueId &&
    previous.season === facts.season &&
    previous.week === facts.week;
  if (
    previous?.leagueId === config.leagueId &&
    Number(previous.season) * 100 + previous.week >
      Number(facts.season) * 100 + facts.week
  ) {
    throw new Error(
      "Sleeper returned an older scoring week than the published edition.",
    );
  }
  const issue = {
    leagueId: config.leagueId,
    season: facts.season,
    week: facts.week,
    publishedAt: same ? previous.publishedAt : new Date().toISOString(),
    managers: await writeManagers(facts, same ? previous : null, config.model),
  };
  if (config.columns.notebook) {
    issue.notebook =
      same && previous.notebook?.length
        ? previous.notebook
        : await researchNotebook(facts, config.model);
  }
  const html = render(facts, issue, config.columns);
  const managerCount = [...html.matchAll(/data-manager="(\d+)"/g)].map((m) =>
    Number(m[1]),
  );
  if (
    managerCount.length !== facts.standings.length ||
    new Set(managerCount).size !== managerCount.length ||
    !facts.standings.every(
      (t) => managerCount.includes(t.id) && issue.managers[t.id]?.text,
    )
  )
    throw new Error("Manager coverage is incomplete.");
  const rosterEntries = facts.standings.reduce((total, team) => total + (team.lineup ? team.lineup.starters.length + team.lineup.reserves.length : 0), 0);
  if ([...html.matchAll(/class="player-row" data-player=/g)].length !== rosterEntries) throw new Error("Player coverage is incomplete.");
  await replaceIfChanged("edition.json", JSON.stringify(issue, null, 2) + "\n");
  await replaceIfChanged("docs/index.html", html);
  console.log(
    `Week ${facts.week}: ${facts.games.length} results, ${managerCount.length} managers, ${facts.upcoming.length} upcoming matchups.`,
  );
  if (!publish) return;
  const files = ["docs/index.html", "edition.json"];
  if (git("status", "--porcelain", "--", ...files)) {
    git("add", "--", ...files);
    git(
      "commit",
      "--only",
      "-m",
      `Publish ${facts.season} Week ${facts.week} newsletter`,
      "--",
      ...files,
    );
  }
  // Retry a previous local commit's push even when this run's output is unchanged.
  git("push", "origin", "main");
  await verifyPages(config.siteUrl, html);
  console.log("Live at " + config.siteUrl);
}

let release;
try {
  release = await acquire();
  await run();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (release) await release();
}
