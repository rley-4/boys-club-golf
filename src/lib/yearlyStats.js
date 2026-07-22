import { TEAM_RECORDS, SOLO_RECORDS, RECORD_YEARS, SOLO_STANDINGS, TEAM_STANDINGS } from "../data/dummyData.js";

export const teamRecordsSorted = [...TEAM_RECORDS].sort((a, b) => a.posAvg - b.posAvg);
export const soloRecordsSorted = [...SOLO_RECORDS].sort((a, b) => a.posAvg - b.posAvg);

// Mock Solo/Team current-year standings — used as the offline fallback by
// both Leaderboard and Export when there's no live Supabase connection.
export const soloResults = SOLO_STANDINGS.map((p) => {
  const worst = Math.max(...p.rounds);
  const droppedIndex = p.rounds.indexOf(worst);
  const total = p.rounds.reduce((sum, v, i) => (i === droppedIndex ? sum : sum + v), 0);
  return { ...p, droppedIndex, total };
}).sort((a, b) => a.total - b.total);

export const teamResults = [...TEAM_STANDINGS].sort((a, b) => b.points - a.points);

// ---------------------------------------------------------------------------
// Year drill-down. Real data will eventually have one row per player per
// year; until that's wired up, single-year stats are derived deterministically
// from each player's all-time line (bounded by their best/worst) so the UI
// and interaction can be built now and swapped for real rows later.
// ---------------------------------------------------------------------------
export function seededRand(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
}

// Most recent `app` years a player attended, e.g. app=2 -> [2026, 2025].
export function attendedYears(app) {
  return RECORD_YEARS.slice(0, app);
}

export function yearlySoloStat(p, year) {
  const rand = seededRand(p.name + year + "solo");
  const span = Math.max(1, p.posWorst - p.posBest);
  const pos = Math.round(p.posBest + rand() * span);
  const jitter = (rand() - 0.5) * 6;
  return {
    pos,
    podium: pos <= 3,
    gross: Math.round((p.grossAvg + jitter) * 10) / 10,
    net: Math.round((p.netAvg + jitter * 0.6) * 10) / 10,
    grossToPar: Math.round((p.grossToPar + jitter) * 10) / 10,
    netToPar: Math.round((p.netToPar + jitter * 0.6) * 10) / 10,
  };
}

export function yearlyTeamStat(p, year) {
  const rand = seededRand(p.name + year + "team");
  const span = Math.max(1, p.posWorst - p.posBest);
  const pos = Math.round(p.posBest + rand() * span);
  const totalMatches = p.win + p.loss + p.tie;
  const matchesThisYear = Math.max(1, Math.round(totalMatches / Math.max(1, p.app)));
  const win = Math.round(matchesThisYear * (p.winPct / 100));
  const tie = Math.round(matchesThisYear * (p.tie / Math.max(1, totalMatches)));
  const loss = Math.max(0, matchesThisYear - win - tie);
  const ptsAvg = Math.round(((p.ptsLow + p.ptsHigh) / 2 + (rand() - 0.5) * 2) * 10) / 10;
  return { pos, podium: pos <= 3, win, loss, tie, ptsAvg };
}
