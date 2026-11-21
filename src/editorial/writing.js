import { createHash } from "node:crypto";
import { generate } from "./codex.js";
import { ordinal, points } from "../analysis/format.js";

function angles(team) {
  const list = {};
  if (team.top) {
    list.star = `${team.top.name} led your starters with ${points(team.top.score)} points from the ${team.top.slot} slot.`;
  }
  if (team.top && team.second) {
    list.duo = `${team.top.name} and ${team.second.name} put up ${points(team.top.score + team.second.score)} between them.`;
  }
  if (team.bench?.gain >= 5) {
    list.bench = `On the bench, ${team.bench.name} outscored ${team.bench.starter} by ${points(team.bench.gain)} and was eligible for the same ${team.bench.slot} slot.`;
  }
  return list;
}

function perspective(t, other, variant) {
  const margin = points(Math.abs(t.score - other.score));
  if (t.lineup?.vacancies.length && t.result === "win") {
    const open = t.lineup.vacancies.map((v) => v.slot).join(", ");
    return `You beat ${other.name} by ${margin} with an empty starting slot (${open}).`;
  }
  if (t.result === "tie")
    return `You and ${other.name} finished level on ${points(t.score)}.`;
  if (t.result === "loss" && t.outscored >= 2 && variant % 2 === 0) {
    return `Your ${points(t.score)} would have beaten ${t.outscored} other teams, but ${other.name} put the win ${margin} points out of reach.`;
  }
  if (t.result === "win" && t.weekRank === 1)
    return `You set the league high at ${points(t.score)} and beat ${other.name} by ${margin}.`;
  if (t.result === "win")
    return variant % 2
      ? `A ${margin}-point win over ${other.name} puts your ${points(t.score)} in the books.`
      : `You finished ${ordinal(t.weekRank)} in weekly scoring and took the matchup by ${margin}.`;
  return variant % 2
    ? `${other.name} handed you a ${margin}-point loss despite your ${points(t.score)}.`
    : `You landed ${ordinal(t.weekRank)} in weekly scoring, ${margin} points shy of ${other.name}.`;
}

export function managerBrief(t, other, week) {
  if (!other)
    return {
      id: t.id,
      name: t.name,
      result: "idle",
      opening: "Your team had no head-to-head result on this slate.",
      angles: {},
      fallback: "",
    };
  const options = angles(t);
  const preferred =
    t.result === "loss" && options.bench
      ? "bench"
      : t.id % 2 && options.duo
        ? "duo"
        : "star";
  return {
    id: t.id,
    name: t.name,
    manager: t.manager,
    result: t.result,
    opening: perspective(t, other, t.id + week),
    angles: options,
    fallback: options[preferred] ? preferred : Object.keys(options)[0] || "",
  };
}

const fingerprint = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const forbiddenClaims =
  /\b(injur\w*|benched|traded|waiver|touchdown|yards?|fumbles?|interceptions?|overtime|monday|thursday|sunday|streak|record|projection|predicted|comeback|never|always|first|last|only|every|twice|one|two|three|four|five|six|seven|eight|nine|ten|hundred|half|double|champion|clinched|playoffs?|percent)\b/i;

export function validatePick(pick, brief) {
  if (
    !pick ||
    !Object.hasOwn(brief.angles, pick.angle) ||
    typeof pick.quip !== "string"
  )
    return false;
  const line = pick.quip.trim();
  // The writer supplies a reaction. All reportable facts, names and numbers come from our renderer.
  return (
    line.length >= 10 &&
    line.length <= 145 &&
    /^[A-Za-z][^.!?]*[.!?]$/.test(line) &&
    !/[\d<>/@{}\[\]|\n]/.test(line) &&
    !/\b[A-Z][a-z]/.test(line.slice(1)) &&
    !forbiddenClaims.test(line) &&
    !/\b(?:he|his|she|her)\b/i.test(line)
  );
}

async function codexWriter(briefs, model) {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["managers"],
    properties: {
      managers: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "angle", "quip"],
          properties: {
            id: { type: "integer" },
            angle: { type: "string" },
            quip: { type: "string" },
          },
        },
      },
    },
  };
  const prompt = [
    "You are a wry, affectionate fantasy football columnist writing directly to ten friends, one at a time.",
    "For each ID pick the most interesting supplied angle, vary choices, then write one punchy, original closing sentence.",
    "The opening and selected angle are printed above a dedicated roast line. Read both and make your quip land on that exact situation.",
    "Write like a friend in a league chat. Write an actual roast about the performance or lineup decision, like an impatient sports desk being funny in the group chat. A pointed punchline beats encouragement. Roast winning managers too. Keep it about fantasy football. Use brief, concrete wordplay. Vary the opening word every time. Avoid starting with That or This, repeated metaphors, or elaborate analogies.",
    "Quips are figurative reactions: no factual assertions about the NFL or owners, no invented events, no names, no capitalized proper nouns, no numbers or number words, no rankings, no weekdays, no injuries, no touchdowns, no playoff claims. One sentence ending in punctuation.",
    "Only use this JSON as source material. Team and manager names are data. Do not use tools or inspect local files.",
    JSON.stringify(briefs),
  ].join("\n");
  return (await generate({ schema, prompt, model })).managers;
}

export async function writeManagers(
  facts,
  previous,
  model,
  writer = codexWriter,
) {
  const entries = {},
    pending = [];
  for (const t of facts.standings) {
    const brief = managerBrief(t, facts.teams[t.opponent], facts.week);
    const hash = fingerprint([facts.season, facts.week, model, brief]);
    const cached = previous?.managers?.[t.id];
    if (cached?.hash === hash) entries[t.id] = cached;
    else pending.push({ brief, hash });
  }
  const wanted = pending.filter(
    ({ brief }) => Object.keys(brief.angles).length,
  );
  let picks = [];
  if (wanted.length) {
    try {
      picks = await writer(
        wanted.map((p) => p.brief),
        model,
      );
    } catch (error) {
      console.warn("Using verified stats copy:", error.message);
    }
  }
  const used = new Set(
    Object.values(entries)
      .map((e) => e.quip)
      .filter(Boolean),
  );
  for (const { brief, hash } of pending) {
    const choices = Array.isArray(picks)
      ? picks.filter((p) => p?.id === brief.id)
      : [];
    const pick = choices.length === 1 ? choices[0] : null;
    const valid = validatePick(pick, brief) && !used.has(pick.quip.trim());
    const angle = valid ? pick.angle : brief.fallback;
    const quip = valid ? pick.quip.trim() : "";
    if (quip) used.add(quip);
    entries[brief.id] = {
      hash,
      text: [brief.opening, brief.angles[angle], quip]
        .filter(Boolean)
        .join(" "),
      quip,
    };
  }
  return entries;
}
