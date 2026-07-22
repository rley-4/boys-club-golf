import { PLAYERS, TEAMS, MATCHES_BY_ROUND } from "../data/dummyData.js";

// ---------------------------------------------------------------------------
// USGA Course Handicap formula:
// Course Handicap = Handicap Index x (Slope / 113) + (Course Rating - Par)
// rounded to the nearest whole number.
// BCO rule: no upper cap — players get every stroke their index earns them.
// ---------------------------------------------------------------------------
export function calcCourseHandicap(handicapIndex, slope, rating, par) {
  const raw = handicapIndex * (slope / 113) + (rating - par);
  // No floor at 0 — a plus-handicap player (index below scratch, or a very
  // easy course relative to their index) genuinely has a negative course
  // handicap. Flooring it at 0 would make them indistinguishable from a
  // dead-scratch player, which understates how good they are relative to
  // the field. See strokesForHole for how a negative value is applied.
  return Math.round(raw);
}

// Distributes a handicap value across a course's holes. For a positive
// value: every hole gets a base number of strokes (floor(value /
// totalHoles)), and the hardest (value % totalHoles) holes get one
// additional stroke on top — this is what makes a course handicap above 18
// actually mean something.
//
// For a negative (plus-handicap) value, strokes are given back instead —
// same distribution logic, but starting from the EASIEST holes (the
// highest handicap rank number) rather than the hardest, per standard
// stroke-allocation convention. The return value is negative, so net =
// gross - strokeReceived correctly comes out HIGHER than gross on those
// holes (a plus player's net score is harder to beat than their gross).
export function strokesForHole(handicapValue, handicapRank, totalHoles) {
  if (handicapValue == null || handicapValue === 0 || !totalHoles) return 0;
  if (handicapValue > 0) {
    const base = Math.floor(handicapValue / totalHoles);
    const remainder = handicapValue % totalHoles;
    return base + (handicapRank <= remainder ? 1 : 0);
  }
  const absValue = Math.abs(handicapValue);
  const base = Math.floor(absValue / totalHoles);
  const remainder = absValue % totalHoles;
  const extra = handicapRank > totalHoles - remainder ? 1 : 0;
  return -(base + extra);
}

// Match-play "Pops" — only meaningful in the context of a specific foursome
// (this player's team vs. their round's opponent team). The lowest course
// handicap among all 4 players is set to 0; everyone else is reduced by
// that same amount. This mirrors v_matchup_player_handicap in
// calculations.sql exactly. This is the offline/fallback version, using the
// mock TEAMS/MATCHES_BY_ROUND roster — see computeMatchPopsLive below for
// the real one, used whenever Score entry has loaded live teams/matchups.
export function computeMatchPops(player, roundLabel, course, totalPar) {
  if (!player) return null;
  const team = TEAMS.find((t) => t.players.includes(player.name));
  if (!team) return null;
  const match = (MATCHES_BY_ROUND[roundLabel] || []).find((m) => m.teamA === team.name || m.teamB === team.name);
  if (!match) return null;
  const opponentName = match.teamA === team.name ? match.teamB : match.teamA;
  const opponent = TEAMS.find((t) => t.name === opponentName);
  if (!opponent) return null;

  const foursome = [...team.players, ...opponent.players]
    .map((name) => PLAYERS.find((p) => p.name === name))
    .filter(Boolean);
  if (foursome.length < 4) return null;

  const chs = foursome.map((p) => calcCourseHandicap(p.handicapIndex, course.slope, course.rating, totalPar));
  const minCH = Math.min(...chs);
  const playerCH = calcCourseHandicap(player.handicapIndex, course.slope, course.rating, totalPar);
  return playerCH - minCH;
}

// Same rule as computeMatchPops, but sourced from real teams/matchups
// (roundId is a real rounds.id, teams is [{id, name, players:[nameA,nameB]}]
// from fetchTeams, matchups is the fetchRoundMatchups() result).
export function computeMatchPopsLive(player, roundId, teams, matchups, course, totalPar) {
  if (!player || !roundId) return null;
  const team = teams.find((t) => t.players.includes(player.name));
  if (!team) return null;
  const matchup = matchups.find((m) => m.roundId === roundId && (m.teamAId === team.id || m.teamBId === team.id));
  if (!matchup) return null;
  const opponentId = matchup.teamAId === team.id ? matchup.teamBId : matchup.teamAId;
  const opponent = teams.find((t) => t.id === opponentId);
  if (!opponent) return null;

  const foursome = [...team.players, ...opponent.players]
    .map((name) => PLAYERS.find((p) => p.name === name))
    .filter(Boolean);
  if (foursome.length < 4) return null;

  const chs = foursome.map((p) => calcCourseHandicap(p.handicapIndex, course.slope, course.rating, totalPar));
  const minCH = Math.min(...chs);
  const playerCH = calcCourseHandicap(player.handicapIndex, course.slope, course.rating, totalPar);
  return playerCH - minCH;
}
