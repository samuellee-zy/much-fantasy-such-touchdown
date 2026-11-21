import test from "node:test";
import assert from "node:assert/strict";
import { verifyArticle } from "../src/editorial/sources.js";
const issue = { season: "2026", week: 10 };
const subject = { id: "123", name: "Example Runner" };
const item = {
  playerId: "123",
  url: "https://www.nfl.com/news/example-week-10",
  evidence: "Runner carried the ball for 100 yards",
};
const page =
  '<script>{"datePublished":"2026-11-17T12:00:00Z"}</script><p>In Week 10, Example Runner carried the ball for 100 yards.</p>';
const now = new Date("2026-11-21T12:00:00Z");
test("a notebook item needs a fresh official source and matching passage about the named player", () => {
  assert.equal(
    verifyArticle(item, subject, page, issue, now).date,
    "2026-11-17",
  );
  for (const bad of [
    { ...item, url: "https://www.nfl.com.evil.example/news/fake" },
    { ...item, evidence: "Runner carried the ball for 300 yards" },
  ]) {
    assert.throws(() => verifyArticle(bad, subject, page, issue, now));
  }
  assert.throws(() =>
    verifyArticle(item, { id: "bad", name: "Someone Else" }, page, issue, now),
  );
  assert.throws(() =>
    verifyArticle(
      item,
      subject,
      page.replace("2026-11-17", "2026-10-01"),
      issue,
      now,
    ),
  );
  assert.throws(() =>
    verifyArticle(
      { ...item, url: "https://www.nfl.com/news/story" },
      subject,
      page.replace("Week 10", "Week 7"),
      issue,
      now,
    ),
  );
});

test("fixture-specific research requires the target week and a named upcoming starter", async () => {
  const { researchPreviews } = await import(
    "../src/editorial/preview-research.js"
  );
  const facts = {
    ...issue,
    upcoming: [
      { ids: [1, 2], lineups: [{ players: [subject] }, { players: [] }] },
    ],
  };
  const next = { ...item, url: "https://www.nfl.com/news/preview-week-11" };
  let calls = 0;
  const result = await researchPreviews(facts, "test", null, {
    now,
    discover: async () => [next],
    fetchArticle: async () => page.replace("Week 10", "Week 11"),
  });
  assert.equal(result.articles["1-2"].playerId, subject.id);
  assert.deepEqual(
    await researchPreviews(facts, "test", result, {
      now,
      discover: async () => {
        calls++;
        return [];
      },
    }),
    result,
  );
  assert.equal(calls, 0);
  const stale = await researchPreviews(facts, "test", null, {
    now,
    discover: async () => [item],
    fetchArticle: async () => page,
  });
  assert.deepEqual(stale.articles, {});
});
