const money = (cents) => (cents / 100).toFixed(2);
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function options(select, items) {
  select.replaceChildren(
    ...items.map(([value, label]) => new Option(label, value)),
  );
  select.disabled = !items.length;
}
export function mountLab(root) {
  if (!root) return;
  const games = JSON.parse(root.querySelector("#lab-data").textContent);
  if (!games.length) return;
  const select = (name) => root.querySelector(`[data-control="${name}"]`);
  const game = select("game"),
    side = select("side"),
    bench = select("bench"),
    starter = select("starter");
  const range = root.querySelector("#reveal"),
    play = root.querySelector("[data-play]"),
    status = root.querySelector(".lab-call");
  const stepText = root.querySelector("[data-step]"),
    stage = root.querySelector(".lab-stage"),
    meter = root.querySelector(".lab-meter i");
  const scoreEls = [...root.querySelectorAll("[data-value]")],
    teamEls = [...root.querySelectorAll("[data-team]")];
  let pair,
    steps,
    mode = "replay",
    timer = null,
    frame,
    previous = [];
  function stop() {
    clearInterval(timer);
    timer = null;
    play.textContent = "Play replay";
  }
  function draw(values, animate = false) {
    cancelAnimationFrame(frame);
    const from = previous.length ? previous : values;
    previous = values.slice();
    const started = performance.now();
    function paint(now) {
      const t = animate && !reduced() ? Math.min(1, (now - started) / 240) : 1;
      const ease = 1 - (1 - t) ** 3;
      values.forEach(
        (v, i) =>
          (scoreEls[i].textContent = money(
            Math.round(from[i] + (v - from[i]) * ease),
          )),
      );
      if (t < 1) frame = requestAnimationFrame(paint);
    }
    paint(started);
    const denominator = Math.max(0, values[0]) + Math.max(0, values[1]);
    meter.style.width =
      (denominator ? (100 * Math.max(0, values[0])) / denominator : 50) + "%";
  }
  function resetBench() {
    const t = pair.teams[Number(side.value)];
    options(
      bench,
      t.reserves.map((p) => [p.id, `${p.name} · ${money(p.score)}`]),
    );
    resetStarter();
  }
  function resetStarter() {
    const t = pair.teams[Number(side.value)],
      p = t.reserves.find((p) => p.id === bench.value);
    const eligible = t.starters
      .filter((s) => p?.targets.includes(s.id))
      .sort((a, b) => a.score - b.score);
    options(
      starter,
      eligible.map((s) => [s.id, `${s.name} · ${s.slot} · ${money(s.score)}`]),
    );
  }
  function show(animate = false) {
    const teams = pair.teams;
    teamEls.forEach((el, i) => (el.textContent = teams[i].name));
    if (mode === "replay") {
      const step = Number(range.value),
        slots = steps.slice(0, step);
      const values = teams.map((t) =>
        slots.reduce(
          (sum, slot) =>
            sum +
            (slot === "Team adjustment"
              ? t.score - Object.values(t.units).reduce((a, b) => a + b, 0)
              : t.units[slot] || 0),
          0,
        ),
      );
      draw(values, animate);
      const last = slots.at(-1),
        full = step === steps.length;
      stepText.textContent = full
        ? "Final score"
        : last
          ? `Through ${last} · ${step}/${steps.length}`
          : "Before the first slot";
      range.setAttribute("aria-valuetext", stepText.textContent);
      if (full)
        status.textContent =
          values[0] === values[1]
            ? "The official matchup finished tied."
            : `${teams[values[0] > values[1] ? 0 : 1].name} won by ${money(Math.abs(values[0] - values[1]))} points.`;
      else
        status.textContent = last
          ? `${last} added ${money(values[0] - (step > 1 ? sumThrough(teams[0], step - 1) : 0))} for ${teams[0].name} and ${money(values[1] - (step > 1 ? sumThrough(teams[1], step - 1) : 0))} for ${teams[1].name}.`
          : "Move the slider or press play to add each position group.";
    } else {
      const i = Number(side.value),
        own = teams[i],
        other = teams[1 - i],
        incoming = own.reserves.find((p) => p.id === bench.value),
        outgoing = own.starters.find((p) => p.id === starter.value);
      const delta = incoming && outgoing ? incoming.score - outgoing.score : 0;
      const values = teams.map((t) => t.score);
      values[i] += delta;
      draw(values, animate);
      const margin = values[i] - other.score,
        original = own.score - other.score;
      if (!incoming || !outgoing) {
        status.textContent =
          "No comparable single-slot swap is available for this team.";
        return;
      }
      const effect =
        margin === 0
          ? "takes the game to a tie"
          : Math.sign(margin) !== Math.sign(original)
            ? `changes the result to a ${money(Math.abs(margin))}-point ${margin > 0 ? "win" : "loss"}`
            : `leaves a ${money(Math.abs(margin))}-point ${margin > 0 ? "win" : "loss"}`;
      status.textContent = `Starting ${incoming.name} for ${outgoing.name} ${delta >= 0 ? "adds" : "costs"} ${money(Math.abs(delta))} points and ${effect}.`;
    }
  }
  function sumThrough(t, n) {
    return steps.slice(0, n).reduce((sum, s) => sum + (t.units[s] || 0), 0);
  }
  function changeGame() {
    stop();
    pair = games.find((g) => g.id === Number(game.value));
    steps = [...new Set(pair.teams.flatMap((t) => Object.keys(t.units)))];
    if (pair.teams.some((t) => sumThrough(t, steps.length) !== t.score))
      steps.push("Team adjustment");
    range.max = steps.length;
    range.value = steps.length;
    options(
      side,
      pair.teams.map((t, i) => [i, t.name]),
    );
    resetBench();
    show();
  }
  root.querySelectorAll("[data-mode]").forEach((button) =>
    button.addEventListener("click", () => {
      stop();
      mode = button.dataset.mode;
      root
        .querySelectorAll("[data-mode]")
        .forEach((b) => b.setAttribute("aria-pressed", b === button));
      root
        .querySelectorAll("[data-panel]")
        .forEach((p) => (p.hidden = p.dataset.panel !== mode));
      stage.dataset.mode = mode;
      show(true);
    }),
  );
  game.addEventListener("change", changeGame);
  side.addEventListener("change", () => {
    resetBench();
    show(true);
  });
  bench.addEventListener("change", () => {
    resetStarter();
    show(true);
  });
  starter.addEventListener("change", () => show(true));
  range.addEventListener("input", () => {
    stop();
    show();
  });
  play.addEventListener("click", () => {
    if (timer) {
      stop();
      return;
    }
    if (Number(range.value) === steps.length) range.value = 0;
    if (reduced()) {
      range.value = Number(range.value) + 1;
      show();
      return;
    }
    show();
    play.textContent = "Pause replay";
    timer = setInterval(() => {
      range.value = Number(range.value) + 1;
      show(true);
      if (Number(range.value) === steps.length) stop();
    }, 770);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });
  root.hidden = false;
  changeGame();
}
