const motion = matchMedia("(prefers-reduced-motion: reduce)");
export function mountReel(root, cue) {
  const scenes = [...root.querySelectorAll("[data-scene]")],
    bars = [...root.querySelectorAll(".reel-progress i")];
  const play = root.querySelector("[data-play-show]"),
    label = play.querySelector("span"),
    counter = root.querySelector("[data-counter]");
  let index = 0,
    running = false,
    timer,
    started = 0,
    remaining = 5000,
    finished = false;
  function paint() {
    scenes.forEach((s, i) => {
      s.hidden = i !== index;
    });
    bars.forEach((bar, i) => {
      bar.classList.toggle("past", i < index || finished);
      bar.classList.toggle("now", i === index && !finished);
    });
    root.dataset.playing = String(running);
    counter.textContent = `${index + 1} / ${scenes.length}`;
    label.textContent = running
      ? "Pause highlights"
      : finished
        ? "Replay highlights"
        : motion.matches
          ? "Next highlight"
          : remaining < 5000
            ? "Resume highlights"
            : "Play highlights";
  }
  function pause() {
    if (running)
      remaining = Math.max(20, remaining - (performance.now() - started));
    running = false;
    clearTimeout(timer);
    paint();
  }
  function schedule() {
    clearTimeout(timer);
    running = true;
    started = performance.now();
    paint();
    timer = setTimeout(() => {
      if (index === scenes.length - 1) {
        running = false;
        finished = true;
        remaining = 5000;
        paint();
        return;
      }
      index++;
      remaining = 5000;
      schedule();
    }, remaining);
  }
  function step(by) {
    pause();
    index = (index + by + scenes.length) % scenes.length;
    remaining = 5000;
    finished = false;
    paint();
  }
  play.addEventListener("click", () => {
    if (running) {
      pause();
      return;
    }
    if (motion.matches) {
      step(1);
      return;
    }
    if (finished) {
      index = 0;
      remaining = 5000;
      finished = false;
    }
    schedule();
  });
  root.querySelector("[data-prev]").addEventListener("click", () => step(-1));
  root.querySelector("[data-next]").addEventListener("click", () => step(1));
  root.addEventListener("keydown", (e) => {
    if (e.target.closest("select,input")) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      step(e.key === "ArrowLeft" ? -1 : 1);
    }
  });
  root.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!link || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    pause();
    if (link.dataset.cue) cue(link.dataset);
  });
  root.querySelector("select").addEventListener("focus", pause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
  });
  motion.addEventListener("change", pause);
  paint();
  return pause;
}
