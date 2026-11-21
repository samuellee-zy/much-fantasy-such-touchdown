const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const fragmentId = () => location.hash.match(/^#manager-(\d+)$/)?.[1];
export function mountProfiles(dialog, pause) {
  if (!dialog?.showModal) return;
  const find = (id) => document.getElementById("manager-" + id);
  const content = dialog.querySelector(".profile-content"),
    head = dialog.querySelector(".profile-identity");
  let current,
    opener,
    originScroll = 0,
    closing,
    ghost;
  function flight(source, reverse = false) {
    ghost?.remove();
    ghost = null;
    if (!source?.isConnected || reduce.matches || !head.animate) return null;
    const target = head.querySelector(".portrait");
    const origin =
      source.closest(".identity")?.querySelector(".portrait") || source;
    const a = origin.getBoundingClientRect(),
      b = target.getBoundingClientRect();
    if (a.bottom < 0 || a.top > innerHeight || !a.width || !b.width)
      return null;
    const node = target.cloneNode(true);
    ghost = node;
    node.classList.add("portrait-flight");
    node.style.visibility = "visible";
    Object.assign(node.style, {
      left: b.left + "px",
      top: b.top + "px",
      width: b.width + "px",
      height: b.height + "px",
    });
    dialog.append(node);
    const small = Math.min(a.height, 48) / b.height;
    const from = {
      transform: `translate(${a.left + a.width / 2 - b.left - b.width / 2}px,${a.top + a.height / 2 - b.top - b.height / 2}px) scale(${small})`,
    };
    const animation = node.animate(
      reverse ? [{ transform: "none" }, from] : [from, { transform: "none" }],
      {
        duration: reverse ? 180 : 330,
        easing: "cubic-bezier(.2,.75,.23,1)",
        fill: "both",
      },
    );
    target.style.visibility = "hidden";
    animation.finished
      .catch(() => {})
      .finally(() => {
        node.remove();
        target.style.visibility = "";
      });
    return animation;
  }
  function tab(key) {
    const fixture = document.querySelector(
      '.fixture[data-teams~="' + current.dataset.manager + '"]',
    );
    const copy = [];
    if (key === "week") {
      const opponent = current.dataset.opponent;
      if (opponent) {
        const line = document.createElement("h3");
        line.textContent = "Against " + opponent;
        copy.push(line);
      }
      copy.push(...current.querySelectorAll(":scope > p,:scope > .roast"));
    } else if (key === "lineup") {
      const body = current.querySelector(".analysis-body");
      if (body) copy.push(body);
    } else if (fixture) {
      copy.push(
        ...fixture.querySelectorAll(
          ":scope > h3,:scope > p,:scope > .scout-grid,:scope > .scout-report",
        ),
      );
    }
    content.replaceChildren(...copy.map((el) => el.cloneNode(true)));
    if (!copy.length)
      content.textContent =
        key === "lineup"
          ? "No scored lineup for this week."
          : document.querySelector("#next .eyebrow")?.textContent ===
              "Season finale"
            ? "The season is complete."
            : "Sleeper has yet to assign this matchup.";
    dialog
      .querySelectorAll("[data-profile-tab]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", b.dataset.profileTab === key),
      );
    content.scrollTop = 0;
  }
  function display(id, trigger) {
    const report = find(id);
    if (!report) return;
    pause();
    if (!dialog.open) {
      opener = trigger || report.querySelector(".identity");
      originScroll = scrollY;
    }
    current = report;
    dialog.querySelector(".profile-url").hidden = true;
    dialog.querySelector("[data-share]").textContent = "Copy link";
    const d = report.dataset;
    dialog.querySelector("#profile-title").textContent = d.name;
    dialog.querySelector("[data-profile-handle]").textContent = "@" + d.handle;
    dialog
      .querySelector("[data-port]")
      .replaceChildren(report.querySelector(".portrait").cloneNode(true));
    const stats = dialog.querySelector(".profile-stats");
    stats.replaceChildren();
    for (const [label, value] of [
      ["Points", d.points],
      ["League rank", d.rank],
      ["Record", d.record],
    ]) {
      const box = document.createElement("div"),
        small = document.createElement("small"),
        b = document.createElement("b");
      small.textContent = label;
      b.textContent = value;
      box.append(small, b);
      stats.append(box);
    }
    tab("week");
    if (!dialog.open) {
      dialog.showModal();
      document.documentElement.classList.add("profile-open");
    }
    dialog.querySelector("[data-dismiss]").focus({ preventScroll: true });
    flight(trigger);
  }
  function open(id, trigger) {
    if (!find(id)) return;
    if (!dialog.open) {
      history.pushState(
        { ...history.state, tdProfile: true },
        "",
        "#manager-" + id,
      );
    } else history.replaceState(history.state, "", "#manager-" + id);
    display(id, trigger);
  }
  function shut() {
    if (!dialog.open) return;
    dialog.close();
    document.documentElement.classList.remove("profile-open");
    content.replaceChildren();
    // A fragment traversal can move focus and scroll after popstate dispatch.
    const returningTo = opener,
      top = originScroll;
    requestAnimationFrame(() => {
      if (dialog.open) return;
      returningTo?.focus({ preventScroll: true });
      window.scrollTo({ top, behavior: "instant" });
    });
    current = null;
  }
  async function dismiss() {
    if (closing || !dialog.open) return;
    closing = true;
    const anim = flight(opener, true);
    if (anim) await anim.finished.catch(() => {});
    if (dialog.open) {
      if (history.state?.tdProfile) {
        history.back();
      } else {
        history.replaceState(
          history.state,
          "",
          location.pathname + location.search,
        );
        shut();
      }
    }
    closing = false;
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#manager-"]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const id = a.hash.slice(9);
    if (!find(id)) return;
    e.preventDefault();
    open(id, a);
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog || e.target.closest("[data-dismiss]")) dismiss();
    const b = e.target.closest("[data-profile-tab]");
    if (b) tab(b.dataset.profileTab);
  });
  dialog.querySelector("[data-share]").addEventListener("click", async (e) => {
    const button = e.currentTarget;
    const url = new URL(location.pathname, location.origin);
    url.hash = "manager-" + current.dataset.manager;
    try {
      await navigator.clipboard.writeText(url.href);
      if (location.hash === url.hash) button.textContent = "Link copied";
    } catch {
      const input = dialog.querySelector(".profile-url");
      input.value = url.href;
      input.hidden = false;
      input.select();
    }
  });
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    dismiss();
  });
  function sync() {
    const id = fragmentId();
    if (id && find(id)) {
      if (current?.dataset.manager !== id) display(id, null);
    } else shut();
  }
  window.addEventListener("popstate", sync);
  window.addEventListener("hashchange", sync);
  sync();
  return open;
}
