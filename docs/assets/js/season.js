import {
  chartValues,
  playerRows,
  roundTable,
  scheduleRows,
  teamForm,
  trendChart,
} from "./season-views.js";

function mountTrend(panel, data) {
  const chart = panel.querySelector("[data-trend]"),
    mode = chart.dataset.trend;
  const surface = chart.querySelector(".chart-surface"),
    slider = chart.querySelector("input");
  const first = chart.querySelector("[data-first]"),
    second = chart.querySelector("[data-second]");
  const table = panel.querySelector("[data-round-table]");
  let shownWeek = Number(slider.value);
  function draw() {
    const width = surface.clientWidth;
    if (!width) return;
    const index = Number(slider.value),
      week = data.rounds[index].week;
    const teamName = (id) =>
      id === "average"
        ? "League average"
        : data.teams.find((t) => t.id === Number(id)).name;
    const label = (id) => {
      const value = chartValues(data, mode, id)[index];
      return (
        teamName(id) +
        " · " +
        (mode === "race" ? "rank " + value : (value / 100).toFixed(2))
      );
    };
    surface.innerHTML = trendChart(
      data,
      mode,
      first.value,
      second.value,
      index,
      width,
    );
    chart.querySelector("[data-week]").textContent = "Week " + week;
    chart.querySelector("[data-values]").textContent =
      label(first.value) + "   /   " + label(second.value);
    chart.querySelector("[data-name-first]").textContent = teamName(
      first.value,
    );
    chart.querySelector("[data-name-second]").textContent = teamName(
      second.value,
    );
    slider.setAttribute(
      "aria-valuetext",
      "Week " + week + ", " + label(first.value) + ", " + label(second.value),
    );
    if (mode === "scoring")
      panel.querySelector("[data-form]").textContent = teamForm(
        data,
        first.value,
        index,
      );
    if (shownWeek !== index) {
      table.innerHTML = roundTable(data, index, mode);
      shownWeek = index;
    }
  }
  function sync() {
    if (first.value === second.value) {
      second.value = [...second.options].find(
        (o) => o.value !== first.value,
      ).value;
    }
    for (const option of second.options)
      option.disabled = option.value === first.value;
    draw();
  }
  first.addEventListener("change", sync);
  second.addEventListener("change", draw);
  slider.addEventListener("input", draw);
  function inspect(event) {
    const rect = surface.getBoundingClientRect();
    const relative = (event.clientX - rect.left - 36) / (rect.width - 54);
    slider.value = Math.round(
      Math.max(0, Math.min(1, relative)) * (data.rounds.length - 1),
    );
    if (Number(slider.value) !== shownWeek) draw();
  }
  surface.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") inspect(e);
  });
  surface.addEventListener("click", inspect);
  new ResizeObserver(draw).observe(surface);
  sync();
}

function mountSeason(data) {
  const nav = document.querySelector(".analysis-tabs"),
    tabs = [...nav.querySelectorAll("a")];
  nav.setAttribute("role", "tablist");
  for (const tab of tabs) {
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", tab.hash.slice(1));
    const panel = document.getElementById(tab.hash.slice(1));
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tab.id);
    panel.tabIndex = 0;
  }
  function activate() {
    const current = tabs.find((t) => t.hash === location.hash) || tabs[0];
    for (const t of tabs) {
      const selected = t === current;
      t.tabIndex = selected ? 0 : -1;
      t.setAttribute("aria-selected", selected);
      document.getElementById(t.hash.slice(1)).hidden = !selected;
    }
  }
  function select(tab) {
    if (location.hash !== tab.hash) history.pushState(null, "", tab.hash);
    activate();
    tab.focus({ preventScroll: true });
  }
  nav.addEventListener("click", (e) => {
    const tab = e.target.closest("a");
    if (!tab || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    e.preventDefault();
    select(tab);
  });
  nav.addEventListener("keydown", (e) => {
    const index = tabs.indexOf(document.activeElement);
    const next = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[e.key];
    if (index === -1 || next === undefined) return;
    e.preventDefault();
    select(tabs[next]);
  });
  addEventListener("hashchange", activate);
  addEventListener("popstate", activate);
  activate();
  document
    .querySelectorAll("[data-trend]")
    .forEach((chart) => mountTrend(chart.closest("section"), data));
  const team = document.querySelector("#player-team"),
    position = document.querySelector("#player-position");
  function filterPlayers() {
    document.querySelector("#player-rows").innerHTML = playerRows(
      data,
      team.value,
      position.value,
    );
  }
  team.addEventListener("change", filterPlayers);
  position.addEventListener("change", filterPlayers);
  document.querySelector("#schedule-order").addEventListener("change", (e) => {
    document.querySelector("#schedule-rows").innerHTML = scheduleRows(
      data,
      e.target.value,
    );
  });
  document.querySelectorAll("[data-control]").forEach((el) => {
    el.hidden = false;
  });
}
const payload = document.querySelector("#season-data");
if (payload) mountSeason(JSON.parse(payload.textContent));
