import { playback } from "./playback.js";

export function mountWrapped(root, stories) {
  const card = root.querySelector(".wrap-card"),
    title = root.querySelector("#wrapped-title");
  const progress = root.querySelector(".wrap-progress"),
    source = root.querySelector(".wrap-source");
  const play = root.querySelector("[data-wrap-play]"),
    next = root.querySelector("[data-wrap-next]");
  const number = root.querySelector(".wrap-number");
  let cards = [],
    lastIndex = -1,
    touch;
  function paint({ index, running, finished, reduced }) {
    const story = cards[index];
    if (!story) return;
    if (index !== lastIndex) {
      lastIndex = index;
      card.dataset.kind = story.kind;
      root.querySelector(".wrap-kicker").textContent = story.label;
      title.textContent = story.title;
      number.hidden = !story.value;
      number.querySelector("strong").textContent = story.value;
      number.querySelector("small").textContent = story.unit;
      card.querySelector("p").textContent = story.body;
      const chart = card.querySelector(".wrap-chart");
      const scores = story.scores || [],
        max = Math.max(1, ...scores.map((row) => row.score));
      chart.hidden = !scores.length;
      chart.setAttribute(
        "aria-label",
        story.kind === "star"
          ? "Your highest-scoring starters"
          : "Final matchup scores",
      );
      chart.replaceChildren(
        ...scores.map(({ name, score }) => {
          const row = document.createElement("li"),
            label = document.createElement("span"),
            value = document.createElement("b");
          label.textContent = name;
          value.textContent = (score / 100).toFixed(2);
          row.style.setProperty("--fill", Math.max(0, score / max) * 100 + "%");
          row.append(label, value);
          return row;
        }),
      );
      source.hidden = !story.source;
      if (story.source) source.href = story.source;
      else source.removeAttribute("href");
      card.scrollTop = 0;
      if (!reduced)
        root.querySelector(".wrap-copy").animate(
          [
            { opacity: 0.35, transform: "translateY(12px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 300, easing: "ease-out" },
        );
    }
    [...progress.children].forEach((p, i) => {
      p.classList.toggle("seen", i < index || finished);
      p.classList.toggle("active", i === index && !finished);
    });
    root.dataset.playing = String(running);
    root.querySelector("[data-wrap-count]").textContent =
      index + 1 + " / " + cards.length;
    root.querySelector("[data-wrap-prev]").disabled = index === 0;
    next.textContent =
      index === cards.length - 1 ? "Start over ↺" : "Next story →";
    play.hidden = reduced;
    play.textContent = running ? "Pause" : finished ? "Replay" : "Play";
  }
  const player = playback(() => cards.length, paint, 7500);
  root
    .querySelector("[data-wrap-prev]")
    .addEventListener("click", () => player.step(-1));
  next.addEventListener("click", () => player.step(1));
  play.addEventListener("click", player.toggle);
  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      if (e.key === "ArrowRight" || lastIndex > 0)
        player.step(e.key === "ArrowRight" ? 1 : -1);
    }
  });
  card.addEventListener(
    "touchstart",
    (e) => {
      touch =
        e.touches.length === 1
          ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
          : null;
    },
    { passive: true },
  );
  card.addEventListener(
    "touchend",
    (e) => {
      if (!touch) return;
      const dx = e.changedTouches[0].clientX - touch.x,
        dy = e.changedTouches[0].clientY - touch.y;
      if (
        Math.abs(dx) > 48 &&
        Math.abs(dx) > 1.4 * Math.abs(dy) &&
        (dx < 0 || lastIndex > 0)
      )
        player.step(dx < 0 ? 1 : -1);
      touch = null;
    },
    { passive: true },
  );
  source.addEventListener("focus", player.pause);
  return {
    show(team, autoplay, portrait) {
      cards = stories[team.manager];
      lastIndex = -1;
      root
        .querySelector(".wrap-art i")
        .replaceChildren(portrait.cloneNode(true));
      root.querySelector("[data-wrap-owner]").textContent =
        "@" + team.handle + " · " + team.name;
      progress.replaceChildren(...cards.map(() => document.createElement("i")));
      player.reset();
      if (autoplay && !matchMedia("(prefers-reduced-motion: reduce)").matches)
        player.toggle();
    },
    pause: player.pause,
  };
}
