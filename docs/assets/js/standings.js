export function mountStandings(panel) {
  if (!panel?.querySelector(".week-switch")) return;
  const table = panel.querySelector("table"),
    body = table.tBodies[0],
    rows = [...body.querySelectorAll("[data-rank-now]")];
  const cut = body.querySelector(".cut"),
    note = panel.querySelector(".cut-note"),
    original = note.textContent;
  panel.querySelector(".week-switch").addEventListener("click", (e) => {
    const button = e.target.closest("[data-period]");
    if (!button || button.getAttribute("aria-pressed") === "true") return;
    const before = new Map(rows.map((r) => [r, r.getBoundingClientRect().top]));
    const prior = button.dataset.period === "prior",
      rank = (r) => Number(prior ? r.dataset.rankPrior : r.dataset.rankNow);
    const sorted = [...rows].sort((a, b) => rank(a) - rank(b));
    sorted.forEach((row, i) => {
      row.cells[0].textContent = rank(row);
      row.cells[2].textContent = prior
        ? row.dataset.recordPrior
        : row.dataset.recordNow;
      body.append(row);
      if (cut && i + 1 === Number(table.dataset.cut)) body.append(cut);
    });
    const week = Number(table.dataset.week) - Number(prior);
    table.caption.textContent = "Standings after Week " + week;
    note.textContent = prior
      ? "Standings entering Week " + table.dataset.week + "."
      : original;
    panel
      .querySelectorAll("[data-period]")
      .forEach((b) => b.setAttribute("aria-pressed", b === button));
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (const row of rows) {
        const distance = before.get(row) - row.getBoundingClientRect().top;
        row.getAnimations().forEach((a) => a.cancel());
        if (distance)
          row.animate(
            [
              { transform: `translateY(${distance}px)`, background: "#d9edaa" },
              { transform: "none", background: "transparent" },
            ],
            { duration: 400, easing: "cubic-bezier(.2,.8,.2,1)" },
          );
      }
    }
  });
}
