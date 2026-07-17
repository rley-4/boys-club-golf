import { supabase } from "./supabaseClient.js";

function requireClient() {
  if (!supabase) throw new Error("Supabase is not configured — check your .env file.");
  return supabase;
}

// -----------------------------------------------------------------------------
// Bootstrap — called once by App.jsx on load.
// -----------------------------------------------------------------------------

export async function fetchCurrentEvent() {
  const db = requireClient();
  const { data, error } = await db.from("events").select("id, year, rounds_played, is_current").eq("is_current", true).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No event is marked is_current — run sql/03_seed.sql or set one on Admin > Event settings.");
  return data;
}

// Used when Current Year changes on Admin > Event settings, so round/course
// mapping switches to whichever year is now active instead of staying
// pinned to whatever was current at page load.
export async function fetchEventByYear(year) {
  const db = requireClient();
  const { data, error } = await db.from("events").select("id, year, rounds_played, is_current").eq("year", year).maybeSingle();
  if (error) throw error;
  return data; // null if that year doesn't exist in the backend yet
}

// Every event on record — used by Team setup's own year selector, which is
// intentionally independent of the global Current Year (you might be
// setting up next year's teams while this year hasn't happened yet).
export async function fetchEvents() {
  const db = requireClient();
  const { data, error } = await db.from("events").select("id, year, rounds_played, is_current").order("year", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createEvent(year) {
  const db = requireClient();
  const { data, error } = await db.from("events").insert({ year, rounds_played: 0, is_current: false }).select().single();
  if (error) throw error;
  return data.id;
}

// One row per event — buy-ins and prizes that drive Games' pot math
// (v_skins_payout and v_poker_payout already join this table, so saving
// here immediately changes those payouts).
export async function fetchGameSettings(eventId) {
  const db = requireClient();
  const { data, error } = await db
    .from("game_settings")
    .select("skins_buy_in, poker_buy_in, poker_three_putt_buy_in, low_net_solo_buy_in, low_net_team_buy_in, ctp_prize")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) throw error;
  return data; // null if this event has no game_settings row yet
}

export async function upsertGameSettings(eventId, settings) {
  const db = requireClient();
  const { error } = await db.from("game_settings").upsert(
    {
      event_id: eventId,
      skins_buy_in: settings.skinsBuyIn,
      poker_buy_in: settings.pokerBuyIn,
      poker_three_putt_buy_in: settings.pokerThreePuttPenalty,
      low_net_solo_buy_in: settings.lowNetSoloBuyIn,
      low_net_team_buy_in: settings.lowNetTeamBuyIn,
      ctp_prize: settings.ctpPrize,
    },
    { onConflict: "event_id" }
  );
  if (error) throw error;
}

export async function updateEvent(id, { roundsPlayed, isCurrent }) {
  const db = requireClient();
  const updates = {};
  if (roundsPlayed !== undefined) updates.rounds_played = roundsPlayed;
  if (isCurrent !== undefined) updates.is_current = isCurrent;
  const { error } = await db.from("events").update(updates).eq("id", id);
  if (error) throw error;
}

// Only one event can be is_current at a time (enforced by a partial unique
// index) — clear whichever one is current now before setting the new one,
// since a single update to true would otherwise conflict with it.
export async function setCurrentEvent(id) {
  const db = requireClient();
  const { error: clearError } = await db.from("events").update({ is_current: false }).eq("is_current", true);
  if (clearError) throw clearError;
  const { error: setError } = await db.from("events").update({ is_current: true }).eq("id", id);
  if (setError) throw setError;
}

export async function fetchPlayers(eventId) {
  const db = requireClient();
  const { data: players, error: playersError } = await db.from("players").select("id, name, hometown, bio, joined_year").order("name");
  if (playersError) throw playersError;

  const { data: handicaps, error: handicapsError } = await db.from("player_handicaps").select("player_id, final_index").eq("event_id", eventId);
  if (handicapsError) throw handicapsError;
  const handicapByPlayer = Object.fromEntries((handicaps || []).map((h) => [h.player_id, Number(h.final_index)]));

  // "Competing this year" is now computed, not a manually-toggled flag —
  // true exactly when this player has a player_competed_years row for the
  // current event.
  const { data: competed, error: competedError } = await db.from("player_competed_years").select("player_id").eq("event_id", eventId);
  if (competedError) throw competedError;
  const competingSet = new Set((competed || []).map((c) => c.player_id));

  return (players || []).map((p) => ({
    id: p.id,
    name: p.name,
    hometown: p.hometown || "",
    bio: p.bio || "",
    joined: p.joined_year,
    handicapIndex: handicapByPlayer[p.id] ?? 0,
    competing: competingSet.has(p.id),
  }));
}

// Note: "competing" is now computed from player_competed_years (see
// fetchPlayers above) rather than a manually-toggled column — there's no
// updatePlayerCompeting anymore. Use setPlayerCompetedYear to change it.

export async function updatePlayer(playerId, { name, hometown, bio }) {
  const db = requireClient();
  const { error } = await db.from("players").update({ name, hometown: hometown || null, bio: bio || null }).eq("id", playerId);
  if (error) throw error;
}

export async function fetchCourses() {
  const db = requireClient();
  const { data: courses, error: coursesError } = await db.from("courses").select("id, name, tee, rating, slope, holes_count, played_event_id").order("name");
  if (coursesError) throw coursesError;

  const { data: holes, error: holesError } = await db.from("course_holes").select("course_id, hole_number, par, yardage, handicap_rank").order("hole_number");
  if (holesError) throw holesError;

  return (courses || []).map((c) => ({
    id: c.id,
    name: c.name,
    tee: c.tee,
    rating: Number(c.rating),
    slope: c.slope,
    holesCount: c.holes_count || 18,
    playedEventId: c.played_event_id,
    // isActiveThisYear is computed client-side (played_event_id === current
    // event), refreshed whenever Current Year changes — see AppShell.
    holes: (holes || [])
      .filter((h) => h.course_id === c.id)
      .map((h) => ({ number: h.hole_number, par: h.par, yardage: h.yardage, handicap: h.handicap_rank })),
  }));
}

// Note: "active this year" is now computed by comparing played_event_id to
// the current event (see AppShell's refreshRoundMap) rather than a
// manually-toggled column — there's no updateCourseActive anymore.

// A course-tee is only played once per year — single nullable value, not a
// set. Pass eventId = null to clear it.
export async function updateCoursePlayedYear(courseId, eventId) {
  const db = requireClient();
  const { error } = await db.from("courses").update({ played_event_id: eventId }).eq("id", courseId);
  if (error) throw error;
}

export async function fetchRounds(eventId) {
  const db = requireClient();
  const { data, error } = await db
    .from("rounds")
    .select("id, label, course_id, round_order, counts_for_solo, counts_for_team, counts_for_carroll_cup, play_format, match_type, applies_skins, applies_poker, applies_low_net, applies_ctp")
    .eq("event_id", eventId)
    .order("round_order");
  if (error) throw error;
  return data || [];
}

// -----------------------------------------------------------------------------
// Score entry — load, save, submit.
// -----------------------------------------------------------------------------

export async function fetchScoresForRound(roundId, playerId) {
  const db = requireClient();

  const { data: rows, error: scoresError } = await db
    .from("scores")
    .select("hole_number, strokes, putts")
    .eq("round_id", roundId)
    .eq("player_id", playerId);
  if (scoresError) throw scoresError;

  const entries = {};
  (rows || []).forEach((r) => {
    entries[r.hole_number] = { strokes: r.strokes, putts: r.putts };
  });

  const { data: sub, error: subError } = await db
    .from("round_submissions")
    .select("status")
    .eq("round_id", roundId)
    .eq("player_id", playerId)
    .maybeSingle();
  if (subError) throw subError;

  return {
    entries,
    status: sub ? (sub.status === "submitted" ? "submitted" : "in-progress") : null,
  };
}

export async function upsertScores(roundId, playerId, entries) {
  const db = requireClient();
  const rows = Object.entries(entries)
    .filter(([, v]) => v && (v.strokes != null || v.putts != null))
    .map(([holeNumber, v]) => ({
      round_id: roundId,
      player_id: playerId,
      hole_number: Number(holeNumber),
      strokes: v.strokes,
      putts: v.putts,
      updated_at: new Date().toISOString(),
    }));
  if (rows.length === 0) return;

  const { error } = await db.from("scores").upsert(rows, { onConflict: "round_id,player_id,hole_number" });
  if (error) throw error;
}

// status: "in_progress" | "submitted" (DB values — note underscore, not the
// UI's "in-progress").
export async function upsertSubmission(roundId, playerId, status) {
  const db = requireClient();
  const { error } = await db.from("round_submissions").upsert(
    {
      round_id: roundId,
      player_id: playerId,
      status,
      submitted_at: status === "submitted" ? new Date().toISOString() : null,
    },
    { onConflict: "round_id,player_id" }
  );
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Players — create + handicap upsert. (Read + competing-flag update already
// exist above.)
// -----------------------------------------------------------------------------

export async function createPlayer({ name, hometown, bio, joinedYear, handicapIndex, eventId }) {
  const db = requireClient();
  const { data: player, error: playerError } = await db
    .from("players")
    .insert({ name, hometown: hometown || null, bio: bio || null, joined_year: joinedYear, is_competing: true })
    .select()
    .single();
  if (playerError) throw playerError;

  const { error: handicapError } = await db
    .from("player_handicaps")
    .insert({ player_id: player.id, event_id: eventId, final_index: handicapIndex });
  if (handicapError) throw handicapError;

  return player.id;
}

export async function updatePlayerHandicap(playerId, eventId, finalIndex) {
  const db = requireClient();
  const { error } = await db
    .from("player_handicaps")
    .upsert({ player_id: playerId, event_id: eventId, final_index: finalIndex }, { onConflict: "player_id,event_id" });
  if (error) throw error;
}

// Every year this player has a recorded handicap for — { event_id, final_index }
// per row. Used by the Players screen's per-year handicap history.
export async function fetchPlayerHandicaps(playerId) {
  const db = requireClient();
  const { data, error } = await db.from("player_handicaps").select("event_id, final_index").eq("player_id", playerId);
  if (error) throw error;
  return data || [];
}

// Which years a player is considered to have competed — independent of
// whether we have a handicap on file for that year (see schema comment).
export async function fetchPlayerCompetedYears(playerId) {
  const db = requireClient();
  const { data, error } = await db.from("player_competed_years").select("event_id").eq("player_id", playerId);
  if (error) throw error;
  return (data || []).map((r) => r.event_id);
}

// Every player-year pairing at once, for the Players screen's top filter
// (same idea as Courses' filter — small table, cheap to fetch in full).
export async function fetchAllPlayerCompetedYears() {
  const db = requireClient();
  const { data, error } = await db.from("player_competed_years").select("player_id, event_id");
  if (error) throw error;
  return data || [];
}

export async function setPlayerCompetedYear(playerId, eventId, competed) {
  const db = requireClient();
  if (competed) {
    const { error } = await db.from("player_competed_years").upsert({ player_id: playerId, event_id: eventId }, { onConflict: "player_id,event_id" });
    if (error) throw error;
  } else {
    const { error } = await db.from("player_competed_years").delete().eq("player_id", playerId).eq("event_id", eventId);
    if (error) throw error;
  }
}

// -----------------------------------------------------------------------------
// Courses — create course-tee, then its 18 holes as a second step.
// -----------------------------------------------------------------------------

export async function createCourse({ name, tee, rating, slope, holesCount }) {
  const db = requireClient();
  const { data, error } = await db.from("courses").insert({ name, tee, rating, slope, holes_count: holesCount || 18 }).select().single();
  if (error) throw error;
  return data.id;
}

export async function createCourseHoles(courseId, holes) {
  const db = requireClient();
  const rows = holes.map((h) => ({
    course_id: courseId,
    hole_number: h.number,
    par: h.par,
    yardage: h.yardage,
    handicap_rank: h.handicap,
  }));
  const { error } = await db.from("course_holes").insert(rows);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Teams — full CRUD, scoped by event since pairs can change year to year.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Carroll Cup roster — Red/Blue assignment per player, per event.
// -----------------------------------------------------------------------------
export async function fetchCarrollCupRoster(eventId) {
  const db = requireClient();
  const { data, error } = await db.from("carroll_cup_rosters").select("player_id, side").eq("event_id", eventId);
  if (error) throw error;
  return data || [];
}

export async function upsertCarrollCupAssignment(eventId, playerId, side) {
  const db = requireClient();
  const { error } = await db
    .from("carroll_cup_rosters")
    .upsert({ event_id: eventId, player_id: playerId, side }, { onConflict: "event_id,player_id" });
  if (error) throw error;
}

export async function fetchTeams(eventId) {
  const db = requireClient();
  const { data, error } = await db.from("teams").select("id, name, player_a_id, player_b_id").eq("event_id", eventId).order("name");
  if (error) throw error;
  return data || [];
}

export async function createTeam({ eventId, name, playerAId, playerBId }) {
  const db = requireClient();
  const { data, error } = await db
    .from("teams")
    .insert({ event_id: eventId, name, player_a_id: playerAId, player_b_id: playerBId })
    .select()
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateTeam(id, { name, playerAId, playerBId }) {
  const db = requireClient();
  const { error } = await db.from("teams").update({ name, player_a_id: playerAId, player_b_id: playerBId }).eq("id", id);
  if (error) throw error;
}

export async function deleteTeam(id) {
  const db = requireClient();
  const { error } = await db.from("teams").delete().eq("id", id);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Rounds — full CRUD. A round IS a label + course assignment (course_id is a
// column on rounds itself), so this is also what "which course is R2 on"
// management uses — there's no separate table for that.
// -----------------------------------------------------------------------------

export async function createRound({
  eventId,
  label,
  courseId,
  roundOrder,
  countsForSolo = true,
  countsForTeam = true,
  countsForCarrollCup = false,
  playFormat = "stroke",
  matchType = "team",
  appliesSkins = true,
  appliesPoker = true,
  appliesLowNet = true,
  appliesCtp = true,
}) {
  const db = requireClient();
  const { data, error } = await db
    .from("rounds")
    .insert({
      event_id: eventId,
      label,
      course_id: courseId,
      round_order: roundOrder,
      counts_for_solo: countsForSolo,
      counts_for_team: countsForTeam,
      counts_for_carroll_cup: countsForCarrollCup,
      play_format: playFormat,
      match_type: matchType,
      applies_skins: appliesSkins,
      applies_poker: appliesPoker,
      applies_low_net: appliesLowNet,
      applies_ctp: appliesCtp,
    })
    .select()
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateRound(id, { label, courseId, countsForSolo, countsForTeam, countsForCarrollCup, playFormat, matchType, appliesSkins, appliesPoker, appliesLowNet, appliesCtp }) {
  const db = requireClient();
  const updates = { label, course_id: courseId };
  if (countsForSolo !== undefined) updates.counts_for_solo = countsForSolo;
  if (countsForTeam !== undefined) updates.counts_for_team = countsForTeam;
  if (countsForCarrollCup !== undefined) updates.counts_for_carroll_cup = countsForCarrollCup;
  if (playFormat !== undefined) updates.play_format = playFormat;
  if (matchType !== undefined) updates.match_type = matchType;
  if (appliesSkins !== undefined) updates.applies_skins = appliesSkins;
  if (appliesPoker !== undefined) updates.applies_poker = appliesPoker;
  if (appliesLowNet !== undefined) updates.applies_low_net = appliesLowNet;
  if (appliesCtp !== undefined) updates.applies_ctp = appliesCtp;
  const { error } = await db.from("rounds").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteRound(id) {
  const db = requireClient();
  const { error } = await db.from("rounds").delete().eq("id", id);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Round matchups — which teams play each other in a given round. Whether a
// round's matchups count toward Team/Carroll Cup lives on the round itself
// (see updateRound above) — every matchup in a round shares that setting.
// -----------------------------------------------------------------------------

export async function fetchRoundMatchups(eventId) {
  const db = requireClient();
  const { data, error } = await db
    .from("round_matchups")
    .select("id, round_id, match_type, team_a_id, team_b_id, player_a_id, player_b_id, rounds!inner(label, event_id)")
    .eq("rounds.event_id", eventId);
  if (error) throw error;
  return (data || []).map((m) => ({
    id: m.id,
    roundId: m.round_id,
    roundLabel: m.rounds.label,
    matchType: m.match_type || "team",
    teamAId: m.team_a_id,
    teamBId: m.team_b_id,
    playerAId: m.player_a_id,
    playerBId: m.player_b_id,
  }));
}

export async function createRoundMatchup({ roundId, matchType = "team", teamAId, teamBId, playerAId, playerBId }) {
  const db = requireClient();
  const row =
    matchType === "singles"
      ? { round_id: roundId, match_type: "singles", player_a_id: playerAId, player_b_id: playerBId }
      : { round_id: roundId, match_type: "team", team_a_id: teamAId, team_b_id: teamBId };
  const { data, error } = await db.from("round_matchups").insert(row).select().single();
  if (error) throw error;
  return data.id;
}

export async function updateRoundMatchup(id, { matchType = "team", teamAId, teamBId, playerAId, playerBId }) {
  const db = requireClient();
  const updates =
    matchType === "singles"
      ? { match_type: "singles", player_a_id: playerAId, player_b_id: playerBId, team_a_id: null, team_b_id: null }
      : { match_type: "team", team_a_id: teamAId, team_b_id: teamBId, player_a_id: null, player_b_id: null };
  const { error } = await db.from("round_matchups").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteRoundMatchup(id) {
  const db = requireClient();
  const { error } = await db.from("round_matchups").delete().eq("id", id);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Team hole results — manual entry for non-stroke-play rounds (scramble,
// alternate shot). Separate from `scores`/v_team_hole_points on purpose:
// those are computed from individual player strokes, which these formats
// don't have. One row per team per hole.
// -----------------------------------------------------------------------------
export async function fetchTeamHoleResults(roundId) {
  const db = requireClient();
  const { data, error } = await db.from("team_hole_results").select("team_id, hole_number, net_score, points").eq("round_id", roundId);
  if (error) throw error;
  return data || [];
}

export async function upsertTeamHoleResult(roundId, teamId, holeNumber, { netScore, points }) {
  const db = requireClient();
  const { error } = await db
    .from("team_hole_results")
    .upsert({ round_id: roundId, team_id: teamId, hole_number: holeNumber, net_score: netScore, points }, { onConflict: "round_id,team_id,hole_number" });
  if (error) throw error;
}
