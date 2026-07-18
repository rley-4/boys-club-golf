import { supabase } from "./supabaseClient.js";

function requireClient() {
  if (!supabase) throw new Error("Supabase is not configured — check your .env file.");
  return supabase;
}

// =============================================================================
// This module is deliberately thin. Every hard rule (drop-worst-round, net
// double bogey cap, matchup-netted handicap for Pops, skins ties, poker pot
// math, etc.) is already implemented once, in sql/02_calculations.sql, as a
// Postgres view. Supabase exposes views through the same REST interface as
// tables, so querying them here is the same shape as any other fetch in
// api.js — there's no second copy of the scoring logic to drift out of sync.
// =============================================================================

// -----------------------------------------------------------------------------
// Solo
// -----------------------------------------------------------------------------

// One row per player: { player_id, rounds_played, total_net_to_par,
// total_net_to_par_all_rounds }. Sort ascending by total_net_to_par for the
// leaderboard (lower = better); tiebreak with total_net_to_par_all_rounds.
export async function fetchSoloStandings(eventId) {
  const db = requireClient();
  const { data, error } = await db
    .from("v_solo_standings")
    .select("player_id, rounds_played, total_net_to_par, total_net_to_par_all_rounds")
    .eq("event_id", eventId);
  if (error) throw error;
  return data || [];
}

// Per-round net-to-par for one player (or every player, if playerId is
// omitted) — this is what drives the Solo leaderboard's round columns and
// which round gets struck through as the dropped high score.
export async function fetchSoloRoundTotals(eventId, playerId) {
  const db = requireClient();
  let query = db.from("v_round_net_totals").select("round_id, player_id, net_to_par_total, holes_scored").eq("event_id", eventId);
  if (playerId) query = query.eq("player_id", playerId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Same shape, but gross (raw strokes) instead of net — feeds the Solo
// leaderboard's Gross toggle.
export async function fetchSoloRoundGrossTotals(eventId, playerId) {
  const db = requireClient();
  let query = db.from("v_round_gross_totals").select("round_id, player_id, gross_total, gross_to_par_total, holes_scored").eq("event_id", eventId);
  if (playerId) query = query.eq("player_id", playerId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// -----------------------------------------------------------------------------
// Solo Record Book
// -----------------------------------------------------------------------------

// All-time: appearances, best/worst finish, podium count, gross/net
// averages (strokes and to-par) — one row per player who has ever appeared
// in a Solo standings year.
export async function fetchSoloRecordBook() {
  const db = requireClient();
  const { data, error } = await db
    .from("v_solo_record_book")
    .select("player_id, name, appearances, best_finish, worst_finish, podium_count, gross_avg_strokes, gross_avg_to_par, net_avg_strokes, net_avg_to_par")
    .order("best_finish");
  if (error) throw error;
  return data || [];
}

// Every player's rank, every year — used for the year filter (best/worst
// finish and podium count within just that year), fetched once and
// filtered client-side by event_id rather than querying per year.
export async function fetchSoloYearRanks() {
  const db = requireClient();
  const { data, error } = await db.from("v_solo_year_rank").select("event_id, player_id, total_net_to_par, year_rank");
  if (error) throw error;
  return data || [];
}

// Every round's gross/net totals, across all years — same "fetch once,
// filter client-side" approach, used for the year filter's gross/net
// averages.
export async function fetchAllSoloRoundTotals() {
  const db = requireClient();
  const [{ data: gross, error: grossError }, { data: net, error: netError }] = await Promise.all([
    db.from("v_round_gross_totals").select("event_id, round_id, player_id, gross_total, gross_to_par_total"),
    db.from("v_round_net_totals").select("event_id, round_id, player_id, net_total, net_to_par_total"),
  ]);
  if (grossError) throw grossError;
  if (netError) throw netError;
  const netByKey = Object.fromEntries((net || []).map((n) => [`${n.round_id}-${n.player_id}`, n]));
  return (gross || [])
    .map((g) => {
      const n = netByKey[`${g.round_id}-${g.player_id}`];
      return n
        ? {
            eventId: g.event_id,
            roundId: g.round_id,
            playerId: g.player_id,
            grossTotal: Number(g.gross_total),
            grossToPar: Number(g.gross_to_par_total),
            netTotal: Number(n.net_total),
            netToPar: Number(n.net_to_par_total),
          }
        : null;
    })
    .filter(Boolean);
}

// -----------------------------------------------------------------------------
// Team Record Book — tracks players across whichever team they were on each
// year (teams are re-formed every year, so there's no persistent team
// entity to build a record for). Pts/Match low/avg/high already have the
// 9-hole-doubling applied server-side (v_team_match_points).
// -----------------------------------------------------------------------------

export async function fetchTeamRecordBook() {
  const db = requireClient();
  const { data, error } = await db
    .from("v_team_record_book")
    .select("player_id, name, appearances, best_finish, worst_finish, podium_count, pts_low, pts_avg, pts_high, win, loss, tie, win_pct")
    .order("best_finish");
  if (error) throw error;
  return data || [];
}

// Every player's team finish, every year — for the year filter.
export async function fetchPlayerTeamYearRanks() {
  const db = requireClient();
  const { data, error } = await db.from("v_player_team_year_rank").select("player_id, event_id, team_id, total_points, year_rank");
  if (error) throw error;
  return data || [];
}

// Every player's match points, every year — historical_points already has
// the 9-hole doubling applied.
export async function fetchPlayerTeamMatchPoints() {
  const db = requireClient();
  const { data, error } = await db.from("v_player_team_match_points").select("player_id, round_id, matchup_id, team_id, points, holes_played, historical_points");
  if (error) throw error;
  return (data || []).map((r) => ({ ...r, points: Number(r.points), historical_points: Number(r.historical_points) }));
}

// Every player's match results, every year.
export async function fetchPlayerTeamMatchRecord() {
  const db = requireClient();
  const { data, error } = await db.from("v_player_team_match_record").select("player_id, round_id, matchup_id, result, team_id");
  if (error) throw error;
  return data || [];
}

// -----------------------------------------------------------------------------
// Carroll Cup — real computation. Reuses the same round_matchups as the
// regular Team competition; a round only produces results here if it's
// flagged counts_for_carroll_cup. Points are 1/0.5/0 for the whole match
// (total net score comparison), not per hole.
// -----------------------------------------------------------------------------

export async function fetchCarrollCupStandings(eventId) {
  const db = requireClient();
  const { data, error } = await db.from("v_carroll_cup_standings").select("red_points, blue_points").eq("event_id", eventId).maybeSingle();
  if (error) throw error;
  return data || { red_points: 0, blue_points: 0 };
}

export async function fetchCarrollCupRoundStandings(eventId) {
  const db = requireClient();
  const { data, error } = await db.from("v_carroll_cup_round_standings").select("round_id, red_points, blue_points").eq("event_id", eventId);
  if (error) throw error;
  return data || [];
}

export async function fetchCarrollCupMatchResults(roundId) {
  const db = requireClient();
  const { data, error } = await db
    .from("v_carroll_cup_results")
    .select("matchup_id, a_name, b_name, a_color, b_color, a_points, b_points")
    .eq("round_id", roundId);
  if (error) throw error;
  return data || [];
}

// -----------------------------------------------------------------------------
// Team
// -----------------------------------------------------------------------------

export async function fetchTeamStandings(eventId) {
  const db = requireClient();
  const { data, error } = await db.from("v_team_standings").select("team_id, name, total_points, matches_played").eq("event_id", eventId);
  if (error) throw error;
  return data || [];
}

// Per-round points per team, with the round's label attached — for the Team
// leaderboard's round columns.
export async function fetchTeamMatchTotals(eventId) {
  const db = requireClient();
  // Views don't reliably expose foreign-key relationships to PostgREST for
  // embedded joins (rounds!inner(...)), so fetch rounds separately and join
  // client-side instead — more verbose, but doesn't break when the view
  // definition changes.
  const [{ data: totals, error: totalsError }, { data: rounds, error: roundsError }] = await Promise.all([
    db.from("v_team_match_totals").select("matchup_id, round_id, team_a_id, team_a_points, team_b_id, team_b_points, holes_played"),
    db.from("rounds").select("id, event_id, label").eq("event_id", eventId),
  ]);
  if (totalsError) throw totalsError;
  if (roundsError) throw roundsError;

  const roundById = Object.fromEntries((rounds || []).map((r) => [r.id, r]));
  return (totals || [])
    .filter((t) => roundById[t.round_id])
    .map((t) => ({ ...t, roundLabel: roundById[t.round_id].label }));
}

// Which team beat which, per round — used to resolve a Team standings tie
// (two teams level on points: whoever won when they played each other wins
// the tiebreak).
export async function fetchTeamHeadToHead(eventId) {
  const db = requireClient();
  const { data, error } = await db
    .from("v_team_head_to_head")
    .select("round_id, team_a_id, team_b_id, team_a_points, team_b_points, match_winner_team_id")
    .eq("event_id", eventId);
  if (error) throw error;
  return data || [];
}

// -----------------------------------------------------------------------------
// Hole-by-hole (Solo and Team scorecard drill-downs)
// -----------------------------------------------------------------------------

// Real per-hole strokes/net for one player's round — replaces the
// deterministic mock generator behind the Solo leaderboard's drill-down.
export async function fetchHoleNetScores(roundId, playerId) {
  const db = requireClient();
  const { data, error } = await db
    .from("v_hole_net_scores")
    .select("hole_number, strokes, par, handicap_rank, stroke_received, net_strokes, net_to_par")
    .eq("round_id", roundId)
    .eq("player_id", playerId)
    .order("hole_number");
  if (error) throw error;
  return data || [];
}

// Real per-hole best-ball + points for one team matchup — replaces the mock
// generator behind the Team leaderboard's drill-down, and is what Matches'
// point totals need to stop showing "–".
export async function fetchTeamHolePoints(matchupId) {
  const db = requireClient();
  const { data, error } = await db
    .from("v_team_hole_points")
    .select("hole_number, team_a_id, team_b_id, team_a_net, team_b_net, team_a_points, team_b_points")
    .eq("matchup_id", matchupId)
    .order("hole_number");
  if (error) throw error;
  return data || [];
}

// -----------------------------------------------------------------------------
// Skins
// -----------------------------------------------------------------------------

// Only holes with an outright winner (ties void the skin) — { hole_number,
// winner_player_id, net_strokes }.
export async function fetchSkins(roundId) {
  const db = requireClient();
  const { data, error } = await db.from("v_skins").select("hole_number, winner_player_id, net_strokes").eq("round_id", roundId).order("hole_number");
  if (error) throw error;
  return data || [];
}

// Pot math for the round: buy-in, participants, skins won, total pot, value
// per skin.
export async function fetchSkinsPayout(roundId) {
  const db = requireClient();
  const { data, error } = await db.from("v_skins_payout").select("*").eq("round_id", roundId).maybeSingle();
  if (error) throw error;
  return data;
}

// -----------------------------------------------------------------------------
// Putting Poker
// -----------------------------------------------------------------------------

// Cards earned per player (0-putt = 2, 1-putt = 1) plus 3-putt count — the
// hand itself is still resolved outside the app.
export async function fetchPokerCards(roundId) {
  const db = requireClient();
  const { data, error } = await db.from("v_poker_cards").select("player_id, zero_putts, one_putts, cards_earned, three_putts").eq("round_id", roundId);
  if (error) throw error;
  return data || [];
}

// null until a winner has been recorded for the round (no poker_results row
// yet) — { round_id, winner_player_id, total_three_putts, pot }.
export async function fetchPokerPayout(roundId) {
  const db = requireClient();
  const { data, error } = await db.from("v_poker_payout").select("*").eq("round_id", roundId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function savePokerWinner(roundId, winnerPlayerId) {
  const db = requireClient();
  const { error } = await db.from("poker_results").upsert({ round_id: roundId, winner_player_id: winnerPlayerId }, { onConflict: "round_id" });
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Low Net
// -----------------------------------------------------------------------------

// Sorted ascending by net_total — the lowest is the winner(s); more than one
// row at the minimum means a tie (pot splits).
export async function fetchLowNetSolo(roundId) {
  const db = requireClient();
  const { data, error } = await db.from("v_low_net_solo").select("player_id, net_total").eq("round_id", roundId).order("net_total");
  if (error) throw error;
  return data || [];
}

export async function fetchLowNetTeam(roundId) {
  const db = requireClient();
  const { data, error } = await db.from("v_low_net_team").select("team_id, net_total, holes").eq("round_id", roundId).order("net_total");
  if (error) throw error;
  return data || [];
}

// Split evenly across everyone tied for lowest net — already resolved
// server-side, so no tie-breaking logic needs duplicating client-side.
export async function fetchLowNetSoloPayout(roundId) {
  const db = requireClient();
  const { data, error } = await db.from("v_low_net_solo_payout").select("player_id, amount").eq("round_id", roundId);
  if (error) throw error;
  return data || [];
}

// One row per player on a tied winning team — already split across every
// player on every tied team, not just per-team.
export async function fetchLowNetTeamPayout(roundId) {
  const db = requireClient();
  const { data, error } = await db.from("v_low_net_team_payout").select("player_id, amount").eq("round_id", roundId);
  if (error) throw error;
  return data || [];
}

// -----------------------------------------------------------------------------
// Closest to Pin — manual entry, no view needed, just the raw table.
// -----------------------------------------------------------------------------

export async function fetchCtpResults(roundId) {
  const db = requireClient();
  const { data, error } = await db.from("ctp_results").select("hole_number, player_id").eq("round_id", roundId);
  if (error) throw error;
  return data || [];
}

export async function saveCtpResult(roundId, holeNumber, playerId) {
  const db = requireClient();
  const { error } = await db
    .from("ctp_results")
    .upsert({ round_id: roundId, hole_number: holeNumber, player_id: playerId }, { onConflict: "round_id,hole_number" });
  if (error) throw error;
}

export async function deleteCtpResult(roundId, holeNumber) {
  const db = requireClient();
  const { error } = await db.from("ctp_results").delete().eq("round_id", roundId).eq("hole_number", holeNumber);
  if (error) throw error;
}
