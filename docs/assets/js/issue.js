import { mountLab } from "./lab.js?v=2";
import { mountProfiles } from "./profile.js";
import { mountReel } from "./reel.js";
import { mountStandings } from "./standings.js";
const lab = mountLab(document.querySelector("#lab"));
const pauseReel = mountReel(document.querySelector("#highlights"), (data) =>
  lab?.cue(data),
);
const openProfile = mountProfiles(document.querySelector("#profile"), () => {
  pauseReel();
  lab?.stop();
});
mountStandings(document.querySelector("#standings"));
function failedPortrait(img) {
  if (img.matches?.(".portrait img")) img.hidden = true;
}
document.addEventListener("error", (e) => failedPortrait(e.target), true);
document.querySelectorAll(".portrait img").forEach((img) => {
  if (img.complete && !img.naturalWidth) failedPortrait(img);
});
document
  .querySelectorAll("[data-enable-js]")
  .forEach((el) => (el.hidden = false));
const scope = document.body.dataset.issue;
document.querySelectorAll("[data-pick]").forEach((field) => {
  const buttons = [...field.querySelectorAll("[data-choice]")],
    key = "touchdown-pick:" + scope + ":" + field.dataset.pick;
  let picked = null;
  try {
    picked = localStorage.getItem(key);
  } catch {}
  function update() {
    const selected = buttons.find((b) => b.dataset.choice === picked);
    buttons.forEach((b) => b.setAttribute("aria-pressed", b === selected));
    field.querySelector("[role=status]").textContent = selected
      ? "Picked " + selected.textContent + "."
      : "";
  }
  buttons.forEach((b) =>
    b.addEventListener("click", () => {
      picked = picked === b.dataset.choice ? null : b.dataset.choice;
      try {
        if (picked) localStorage.setItem(key, picked);
        else localStorage.removeItem(key);
      } catch {}
      update();
    }),
  );
  field.hidden = false;
  update();
});

const jump = document.querySelector("#team-jump");
jump?.addEventListener("change", () => {
  const team = document.getElementById("manager-" + jump.value);
  if (!team) return;
  if (openProfile) openProfile(jump.value, jump);
  else location.hash = team.id;
  jump.value = "";
});

const draw = document.querySelector("#roast-draw");
const pool = [...document.querySelectorAll(".manager .roast")].map((el) => {
  const team = el.closest(".manager");
  const name = team.dataset.name;
  return { id: team.id, name, quip: el.querySelector("p").textContent };
});
if (draw && pool.length) {
  draw.hidden = false;
  const line = draw.querySelector("[data-draw-result]"),
    link = draw.querySelector("a"),
    button = draw.querySelector("button");
  let bag = [],
    last = "";
  button.addEventListener("click", async () => {
    if (!bag.length) bag = [...pool];
    const choices = bag.filter((p) => p.id !== last);
    const list = choices.length ? choices : bag;
    const pick = list[Math.floor(Math.random() * list.length)];
    bag = bag.filter((p) => p !== pick);
    last = pick.id;
    button.disabled = true;
    if (
      !matchMedia("(prefers-reduced-motion: reduce)").matches &&
      line.animate
    ) {
      await line.animate(
        [
          { opacity: 1, transform: "translateY(0)" },
          {
            opacity: 0,
            transform: "perspective(600px) rotateY(-75deg) translateX(-8px)",
          },
        ],
        { duration: 140 },
      ).finished;
    }
    const title = document.createElement("strong");
    title.textContent = pick.name;
    line.replaceChildren(title, document.createTextNode(pick.quip));
    link.href = "#" + pick.id;
    link.hidden = false;
    button.textContent = "Deal another";
    button.disabled = false;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
      line.animate?.(
        [
          {
            opacity: 0.1,
            transform: "perspective(600px) rotateY(70deg) translateX(12px)",
          },
          { opacity: 1, transform: "none" },
        ],
        { duration: 260 },
      );
  });
}
