import { playback } from "./playback.js";
export function mountReel(root, cue) {
  const scenes = [...root.querySelectorAll("[data-scene]")],
    bars = [...root.querySelectorAll(".reel-progress i")];
  const play = root.querySelector("[data-play-show]"),
    label = play.querySelector("span"),
    counter = root.querySelector("[data-counter]");
  const player = playback(
    () => scenes.length,
    ({ index, running, finished, remaining, reduced }) => {
      scenes.forEach((s, i) => {
        s.hidden = i !== index;
        s.inert = i !== index;
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
          : reduced
            ? "Next highlight"
            : remaining < 5000
              ? "Resume highlights"
              : "Play highlights";
    },
    5000,
  );
  const { pause, step } = player;
  play.addEventListener("click", player.toggle);
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
  player.reset();
  return pause;
}
