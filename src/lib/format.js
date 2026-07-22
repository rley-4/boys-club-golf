// Small formatting helpers used across score/leaderboard/record-book
// screens. Pure functions, no state — pulled out of AppShell.jsx so they
// can be imported without dragging in the rest of the shell.

export function scoreLabel(diff) {
  if (diff <= -3) return "Albatross";
  if (diff === -2) return "Eagle";
  if (diff === -1) return "Birdie";
  if (diff === 0) return "Par";
  if (diff === 1) return "Bogey";
  if (diff === 2) return "Double";
  return `+${diff}`;
}

export function scoreTone(diff) {
  if (diff <= -1) return { bg: "#DCEFE3", fg: "#1B4332", border: "#6FAE8C" };
  if (diff === 0) return { bg: "#EDEAE0", fg: "#3F3B32", border: "#B9B3A2" };
  if (diff === 1) return { bg: "#FBEAD9", fg: "#8A4B1E", border: "#D89A66" };
  return { bg: "#F7DCDA", fg: "#8C2F2A", border: "#D98884" };
}

export function fmtDiff(n) {
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `${n}`;
}

// Postgres numeric/bigint aggregates come back as strings through
// PostgREST — anything arithmetic done on them client-side (sums, averages)
// needs coercing first, or "+" silently concatenates instead of adding.
// This is the last line of defense: never let a bad/missing value crash
// the render, show "–" instead.
export function fmtStat(n, digits = 1) {
  const num = Number(n);
  return Number.isFinite(num) ? num.toFixed(digits) : "–";
}

export function diffTone(n) {
  if (n <= -1) return { bg: "#DCEFE3", fg: "#1B4332" };
  if (n === 0) return { bg: "#EDEAE0", fg: "#3F3B32" };
  if (n <= 2) return { bg: "#FBEAD9", fg: "#8A4B1E" };
  return { bg: "#F7DCDA", fg: "#8C2F2A" };
}

export function ordinal(n) {
  if (n == null) return "";
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
