import test from "node:test";
import assert from "node:assert/strict";
import { verifyArticle } from "../src/editorial/notebook.js";
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
