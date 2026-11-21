export const points = (cents) => (cents / 100).toFixed(2);
export const cents = (n) => Math.round(n * 100);
export const record = (t) =>
  [t.wins, t.losses, ...(t.ties ? [t.ties] : [])].join("–");
export function ordinal(n) {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th";
  return n + suffix;
}
