// Both story viewers keep their own clock. A visibility or motion change pauses it.
export function playback(count, render, duration) {
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let index = 0,
    running = false,
    finished = false,
    remaining = duration,
    started = 0,
    timer;
  const draw = () =>
    render({
      index,
      running,
      finished,
      remaining,
      duration,
      reduced: motion.matches,
    });
  function pause() {
    if (running)
      remaining = Math.max(20, remaining - (performance.now() - started));
    running = false;
    clearTimeout(timer);
    draw();
  }
  function reset() {
    clearTimeout(timer);
    index = 0;
    running = false;
    finished = false;
    remaining = duration;
    draw();
  }
  function step(by) {
    clearTimeout(timer);
    running = false;
    finished = false;
    remaining = duration;
    index = (index + by + count()) % count();
    draw();
  }
  function schedule() {
    running = true;
    started = performance.now();
    draw();
    timer = setTimeout(() => {
      if (index === count() - 1) {
        running = false;
        finished = true;
        remaining = duration;
        draw();
        return;
      }
      index++;
      remaining = duration;
      schedule();
    }, remaining);
  }
  function toggle() {
    if (!count()) return;
    if (running) {
      pause();
      return;
    }
    if (motion.matches) {
      step(1);
      return;
    }
    if (finished) reset();
    schedule();
  }
  motion.addEventListener("change", pause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
  });
  return { reset, step, toggle, pause };
}
