import React, { useState, useMemo, useRef, useEffect } from "react";
import Papa from "papaparse";
import {
  fetchSoloStandings,
  fetchSoloRoundTotals,
  fetchSoloRoundGrossTotals,
  fetchSoloRecordBook,
  fetchSoloYearRanks,
  fetchAllSoloRoundTotals,
  fetchTeamRecordBook,
  fetchPlayerTeamYearRanks,
  fetchPlayerTeamMatchPoints,
  fetchPlayerTeamMatchRecord,
  fetchCarrollCupStandings,
  fetchCarrollCupRoundStandings,
  fetchCarrollCupMatchResults,
  fetchHoleNetScores,
  fetchTeamStandings,
  fetchTeamMatchTotals,
  fetchTeamHolePoints,
  fetchSkins,
  fetchSkinsPayout,
  fetchPokerCards,
  fetchPokerPayout,
  savePokerWinner,
  fetchLowNetSolo,
  fetchLowNetTeam,
  fetchCtpResults,
  saveCtpResult,
  deleteCtpResult,
} from "./lib/stats.js";
import {
  fetchScoresForRound,
  upsertScores,
  upsertSubmission,
  fetchEventByYear,
  fetchPlayers,
  fetchEvents,
  createEvent,
  updateEvent,
  setCurrentEvent,
  fetchGameSettings,
  upsertGameSettings,
  fetchRounds,
  updatePlayer,
  updatePlayerHandicap,
  fetchPlayerHandicaps,
  fetchPlayerCompetedYears,
  fetchAllPlayerCompetedYears,
  setPlayerCompetedYear,
  createPlayer,
  createCourse,
  updateCoursePlayedYear,
  createCourseHoles,
  fetchTeams,
  fetchTeamHoleResults,
  upsertTeamHoleResult,
  createTeam,
  updateTeam,
  deleteTeam,
  createRound,
  updateRound,
  deleteRound,
  fetchRoundMatchups,
  createRoundMatchup,
  updateRoundMatchup,
  deleteRoundMatchup,
  fetchCarrollCupRoster,
  upsertCarrollCupAssignment,
} from "./lib/api.js";
import { Flag, Trophy, Coins, MoreHorizontal, BookOpen, ChevronRight, ChevronLeft, Swords } from "lucide-react";

// ---------------------------------------------------------------------------
// Courses. In the real app this comes from a `courses` table (name, rating,
// slope) joined to a `holes` table (number, par, yardage, handicap).
// ---------------------------------------------------------------------------
export const COURSES = [
  {
    id: 1,
    name: "Stonehedge South",
    tee: "Blue",
    rating: 72.9,
    slope: 135,
    holes: [
      { number: 1, par: 4, yardage: 353, handicap: 13 },
      { number: 2, par: 4, yardage: 420, handicap: 1 },
      { number: 3, par: 3, yardage: 184, handicap: 15 },
      { number: 4, par: 5, yardage: 517, handicap: 3 },
      { number: 5, par: 4, yardage: 327, handicap: 17 },
      { number: 6, par: 3, yardage: 182, handicap: 5 },
      { number: 7, par: 5, yardage: 488, handicap: 7 },
      { number: 8, par: 4, yardage: 384, handicap: 11 },
      { number: 9, par: 4, yardage: 384, handicap: 9 },
      { number: 10, par: 5, yardage: 537, handicap: 6 },
      { number: 11, par: 4, yardage: 395, handicap: 4 },
      { number: 12, par: 4, yardage: 324, handicap: 18 },
      { number: 13, par: 3, yardage: 180, handicap: 8 },
      { number: 14, par: 4, yardage: 399, handicap: 10 },
      { number: 15, par: 4, yardage: 371, handicap: 12 },
      { number: 16, par: 3, yardage: 183, handicap: 16 },
      { number: 17, par: 5, yardage: 492, handicap: 14 },
      { number: 18, par: 4, yardage: 439, handicap: 2 },
    ],
  },
  {
    id: 2,
    name: "Stonehedge North",
    tee: "Blue",
    rating: 71.4,
    slope: 128,
    holes: [
      { number: 1, par: 4, yardage: 372, handicap: 7 },
      { number: 2, par: 3, yardage: 165, handicap: 15 },
      { number: 3, par: 4, yardage: 401, handicap: 3 },
      { number: 4, par: 5, yardage: 502, handicap: 11 },
      { number: 5, par: 4, yardage: 340, handicap: 9 },
      { number: 6, par: 4, yardage: 389, handicap: 1 },
      { number: 7, par: 3, yardage: 172, handicap: 17 },
      { number: 8, par: 5, yardage: 511, handicap: 5 },
      { number: 9, par: 4, yardage: 358, handicap: 13 },
      { number: 10, par: 4, yardage: 405, handicap: 4 },
      { number: 11, par: 4, yardage: 366, handicap: 12 },
      { number: 12, par: 3, yardage: 191, handicap: 16 },
      { number: 13, par: 5, yardage: 521, handicap: 8 },
      { number: 14, par: 4, yardage: 349, handicap: 14 },
      { number: 15, par: 4, yardage: 412, handicap: 2 },
      { number: 16, par: 3, yardage: 176, handicap: 18 },
      { number: 17, par: 5, yardage: 494, handicap: 6 },
      { number: 18, par: 4, yardage: 418, handicap: 10 },
    ],
  },
  {
    id: 3,
    name: "The Preserve",
    tee: "Championship",
    rating: 73.5,
    slope: 140,
    holes: [
      { number: 1, par: 4, yardage: 401, handicap: 5 },
      { number: 2, par: 5, yardage: 548, handicap: 9 },
      { number: 3, par: 3, yardage: 199, handicap: 17 },
      { number: 4, par: 4, yardage: 432, handicap: 1 },
      { number: 5, par: 4, yardage: 378, handicap: 11 },
      { number: 6, par: 5, yardage: 529, handicap: 7 },
      { number: 7, par: 3, yardage: 187, handicap: 15 },
      { number: 8, par: 4, yardage: 411, handicap: 3 },
      { number: 9, par: 4, yardage: 366, handicap: 13 },
      { number: 10, par: 4, yardage: 419, handicap: 2 },
      { number: 11, par: 3, yardage: 205, handicap: 18 },
      { number: 12, par: 5, yardage: 556, handicap: 8 },
      { number: 13, par: 4, yardage: 388, handicap: 10 },
      { number: 14, par: 4, yardage: 447, handicap: 4 },
      { number: 15, par: 3, yardage: 178, handicap: 16 },
      { number: 16, par: 5, yardage: 512, handicap: 6 },
      { number: 17, par: 4, yardage: 395, handicap: 12 },
      { number: 18, par: 4, yardage: 429, handicap: 14 },
    ],
  },
];
// Score/Games/Matches round selectors all read this. It's mutated in place
// (same pattern as PLAYERS/COURSES) whenever the backend's actual rounds for
// the current year are (re)loaded — see refreshRoundMap() in AppShell. Until
// then it's just the demo/offline default.
export const SCORE_ROUNDS = ["R1", "R2", "R3", "R4", "R5", "R6"];
// Populated by App.jsx after fetching `rounds` for the current event. Maps a
// round label ("R1") to its real rounds.id row, so Score entry knows what to
// write to. Empty map = not connected to Supabase yet, or that round doesn't
// exist in the backend — Save/Submit then behaves exactly as the mock did.
export const ROUND_ID_BY_LABEL = {};
// Populated alongside ROUND_ID_BY_LABEL — which competitions each round's
// results roll up into (the Solo/Team/Carroll Cup checkboxes on Round
// setup). Leaderboard uses this to omit a round's column entirely when its
// box is unchecked. Defaults (when a round isn't in this map — offline mode,
// or not yet loaded) match the DB defaults: Solo and Team default to
// included, Carroll Cup defaults to excluded.
export const ROUND_FLAGS = {};
// Play format per round ("stroke" | "scramble" | "alternate_shot") — set on
// Round setup, read by Score entry to swap in a wireframed team-only note
// for non-stroke-play rounds.
export const ROUND_FORMATS = {};
const LEADERBOARD_ROUNDS = ["R1", "R2", "R3", "R4"];

// ---------------------------------------------------------------------------
// Players. In the real app this comes from a `players` table where
// handicapIndex is the Final Index computed from the BCO rule book
// (Sub Index x (95% - Champ % Adj.)). Random placeholder list for now.
// ---------------------------------------------------------------------------
export const WIREFRAME_YEARS = [2022, 2023, 2024, 2025];

export const PLAYERS = [
  { id: 1, name: "Tyler Jessel", handicapIndex: 6.4, hometown: "Chicago, IL", bio: "Steady off the tee, dangerous with the putter under pressure.", competing: true, yearsCompeted: [2023, 2024, 2025] },
  { id: 2, name: "James Bublitz", handicapIndex: 14.1, hometown: "Madison, WI", bio: "Grinder — best score always seems to come on the back nine.", competing: true, yearsCompeted: [2023, 2024, 2025] },
  { id: 3, name: "Collin Clark", handicapIndex: 11.0, hometown: "Milwaukee, WI", bio: "Two-time podium finisher, hates 3-putts more than anyone alive.", competing: true, yearsCompeted: [2024, 2025] },
  { id: 4, name: "Quaid DeLacluyse", handicapIndex: 8.3, hometown: "Green Bay, WI", bio: "Rookie-turned-contender, low-index and climbing fast.", competing: true, yearsCompeted: [2025] },
  { id: 5, name: "Mitchell Powers", handicapIndex: 11.8, hometown: "Chicago, IL", bio: "Long off the tee, streaky with irons.", competing: true, yearsCompeted: [2024, 2025] },
  { id: 6, name: "Sam Losinski", handicapIndex: 9.6, hometown: "Minneapolis, MN", bio: "Course management over power, rarely beats himself.", competing: true, yearsCompeted: [2024, 2025] },
  { id: 7, name: "Tommy Casey", handicapIndex: 6.9, hometown: "Chicago, IL", bio: "Feast or famine — has the low round of the weekend most years.", competing: true, yearsCompeted: [2024, 2025] },
  { id: 8, name: "Evan Powers", handicapIndex: 1.8, hometown: "Naperville, IL", bio: "The scratch golfer of the group, defending solo champ.", competing: true, yearsCompeted: [2022, 2023, 2024, 2025] },
];

const SOLO_STANDINGS_BASE = [
  { name: "Evan Powers", rounds: [-2, -1, 0, -3] },
  { name: "Collin Clark", rounds: [0, 1, -2, 2] },
  { name: "Tyler Jessel", rounds: [1, -1, 3, 0] },
  { name: "Quaid DeLacluyse", rounds: [2, 0, 1, -1] },
  { name: "Tommy Casey", rounds: [-1, 0, 2, 3] },
  { name: "Sam Losinski", rounds: [3, 1, 2, 4] },
  { name: "James Bublitz", rounds: [4, 2, 1, 5] },
  { name: "Mitchell Powers", rounds: [5, 3, 4, 2] },
];
// "Handicap" view uses net-to-par (rounds, above) — that's the official
// competition number. "Gross" view adds each player's handicap back on,
// per round, so gross = net + handicap.
const SOLO_STANDINGS = SOLO_STANDINGS_BASE.map((p) => {
  const handicap = Math.round(PLAYERS.find((pl) => pl.name === p.name)?.handicapIndex ?? 0);
  return { ...p, handicap, roundsGross: p.rounds.map((n) => n + handicap) };
});

const TEAM_STANDINGS = [
  { name: "CDL", players: "Collin Clark / Quaid DeLacluyse", pointsByRound: [6, 5, 4.5, 5.5], matches: 4 },
  { name: "Boomers", players: "Tyler Jessel / James Bublitz", pointsByRound: [3.5, 5, 5.5, 5.5], matches: 4 },
  { name: "Torch'em", players: "Tommy Casey / Evan Powers", pointsByRound: [4, 3, 6.5, 4], matches: 4 },
  { name: "LFG", players: "Mitchell Powers / Sam Losinski", pointsByRound: [5, 4, 2.5, 2.5], matches: 4 },
].map((t) => ({ ...t, points: t.pointsByRound.reduce((s, p) => s + p, 0) }));

// New this year: Carroll Cup pits the whole group against each other as two
// squads (Red vs Blue). Rules/format TBD — placeholder points for now.
const CARROLL_CUP_STANDINGS = [
  { team: "red", points: 12.5 },
  { team: "blue", points: 9.5 },
];
const CARROLL_CUP_TOTAL_POINTS = CARROLL_CUP_STANDINGS.reduce((s, t) => s + t.points, 0);

// Per-round Carroll Cup singles matches (1 win / 0.5 tie / 0 loss).
const CARROLL_CUP_MATCHES_BY_ROUND = {
  R1: [
    { red: "Tyler Jessel", blue: "Mitchell Powers", redPoints: 1, bluePoints: 0 },
    { red: "James Bublitz", blue: "Sam Losinski", redPoints: 0, bluePoints: 1 },
    { red: "Collin Clark", blue: "Tommy Casey", redPoints: 0.5, bluePoints: 0.5 },
    { red: "Quaid DeLacluyse", blue: "Evan Powers", redPoints: 0, bluePoints: 1 },
  ],
  R2: [
    { red: "Tyler Jessel", blue: "Sam Losinski", redPoints: 1, bluePoints: 0 },
    { red: "James Bublitz", blue: "Tommy Casey", redPoints: 0.5, bluePoints: 0.5 },
    { red: "Collin Clark", blue: "Evan Powers", redPoints: 0, bluePoints: 1 },
    { red: "Quaid DeLacluyse", blue: "Mitchell Powers", redPoints: 1, bluePoints: 0 },
  ],
  R3: [
    { red: "Tyler Jessel", blue: "Tommy Casey", redPoints: 0, bluePoints: 1 },
    { red: "James Bublitz", blue: "Evan Powers", redPoints: 0, bluePoints: 1 },
    { red: "Collin Clark", blue: "Mitchell Powers", redPoints: 1, bluePoints: 0 },
    { red: "Quaid DeLacluyse", blue: "Sam Losinski", redPoints: 0.5, bluePoints: 0.5 },
  ],
  R4: [
    { red: "Tyler Jessel", blue: "Evan Powers", redPoints: 0, bluePoints: 1 },
    { red: "James Bublitz", blue: "Mitchell Powers", redPoints: 1, bluePoints: 0 },
    { red: "Collin Clark", blue: "Sam Losinski", redPoints: 0.5, bluePoints: 0.5 },
    { red: "Quaid DeLacluyse", blue: "Tommy Casey", redPoints: 1, bluePoints: 0 },
  ],
};

// Default Red/Blue roster split — configurable on Admin > Event settings.
const CARROLL_CUP_ROSTER_DEFAULT = {
  "Tyler Jessel": "red",
  "James Bublitz": "red",
  "Collin Clark": "red",
  "Quaid DeLacluyse": "red",
  "Mitchell Powers": "blue",
  "Sam Losinski": "blue",
  "Tommy Casey": "blue",
  "Evan Powers": "blue",
};

// ---------------------------------------------------------------------------
// Record Book. Team records pulled from the "Team records" tab of the BCO
// Record Book (all-time). Solo records are mocked to the same shape pending
// the "Solo records" tab — swap for real data once we wire up the sheet
// import. App = appearances (years attended).
// ---------------------------------------------------------------------------
const TEAM_RECORDS = [
  { name: "Brett Grulkowski", app: 4, posAvg: 4.0, posBest: 1, posWorst: 7, podium1: 1, podium2: 1, podium3: 0, ptsLow: 6.5, ptsAvg: 9.1, ptsHigh: 12.5, win: 10, loss: 10, tie: 1, winPct: 48 },
  { name: "Brock Ambrose", app: 3, posAvg: 5.0, posBest: 4, posWorst: 6, podium1: 0, podium2: 0, podium3: 0, ptsLow: 5.5, ptsAvg: 8.4, ptsHigh: 11.5, win: 4, loss: 11, tie: 2, winPct: 24 },
  { name: "Collin Clark", app: 3, posAvg: 3.0, posBest: 1, posWorst: 6, podium1: 1, podium2: 1, podium3: 0, ptsLow: 5.5, ptsAvg: 9.3, ptsHigh: 12.0, win: 10, loss: 5, tie: 1, winPct: 63 },
  { name: "Evan Powers", app: 4, posAvg: 4.5, posBest: 2, posWorst: 8, podium1: 0, podium2: 2, podium3: 0, ptsLow: 4.5, ptsAvg: 8.5, ptsHigh: 12.5, win: 6, loss: 12, tie: 3, winPct: 29 },
  { name: "James Bublitz", app: 4, posAvg: 3.8, posBest: 2, posWorst: 6, podium1: 0, podium2: 1, podium3: 1, ptsLow: 5.0, ptsAvg: 9.2, ptsHigh: 11.5, win: 11, loss: 7, tie: 3, winPct: 52 },
  { name: "Luke Carroll", app: 2, posAvg: 3.0, posBest: 3, posWorst: 3, podium1: 0, podium2: 0, podium3: 2, ptsLow: 8.0, ptsAvg: 9.4, ptsHigh: 10.5, win: 4, loss: 1, tie: 4, winPct: 44 },
  { name: "Mitch Hoffman", app: 1, posAvg: 5.0, posBest: 5, posWorst: 5, podium1: 0, podium2: 0, podium3: 0, ptsLow: 7.5, ptsAvg: 7.9, ptsHigh: 8.5, win: 0, loss: 4, tie: 0, winPct: 0 },
  { name: "Mitchell Powers", app: 3, posAvg: 3.7, posBest: 3, posWorst: 5, podium1: 0, podium2: 0, podium3: 2, ptsLow: 7.0, ptsAvg: 9.1, ptsHigh: 11.5, win: 8, loss: 7, tie: 2, winPct: 47 },
  { name: "Nate Oerhlein", app: 1, posAvg: 1.0, posBest: 1, posWorst: 1, podium1: 1, podium2: 0, podium3: 0, ptsLow: 8.5, ptsAvg: 10.4, ptsHigh: 13.5, win: 2, loss: 1, tie: 1, winPct: 50 },
  { name: "Quaid DeLacluyse", app: 2, posAvg: 2.0, posBest: 1, posWorst: 3, podium1: 1, podium2: 0, podium3: 1, ptsLow: 7.5, ptsAvg: 9.7, ptsHigh: 11.0, win: 7, loss: 2, tie: 3, winPct: 58 },
  { name: "Riley Ley", app: 4, posAvg: 4.0, posBest: 3, posWorst: 5, podium1: 0, podium2: 0, podium3: 1, ptsLow: 5.5, ptsAvg: 8.9, ptsHigh: 13.0, win: 7, loss: 9, tie: 5, winPct: 33 },
  { name: "Sam Kachelek", app: 1, posAvg: 2.0, posBest: 2, posWorst: 2, podium1: 0, podium2: 1, podium3: 0, ptsLow: 8.0, ptsAvg: 9.3, ptsHigh: 10.0, win: 3, loss: 1, tie: 1, winPct: 60 },
  { name: "Sam Losinski", app: 3, posAvg: 4.7, posBest: 4, posWorst: 5, podium1: 0, podium2: 0, podium3: 0, ptsLow: 5.0, ptsAvg: 8.8, ptsHigh: 10.5, win: 9, loss: 7, tie: 1, winPct: 53 },
  { name: "Tommy Casey", app: 3, posAvg: 4.7, posBest: 1, posWorst: 8, podium1: 1, podium2: 0, podium3: 0, ptsLow: 5.5, ptsAvg: 8.9, ptsHigh: 13.5, win: 5, loss: 9, tie: 2, winPct: 31 },
  { name: "Will Gerrietts", app: 4, posAvg: 3.3, posBest: 1, posWorst: 6, podium1: 1, podium2: 1, podium3: 0, ptsLow: 6.0, ptsAvg: 9.0, ptsHigh: 12.5, win: 7, loss: 8, tie: 6, winPct: 33 },
  { name: "Will Templeton", app: 4, posAvg: 3.8, posBest: 1, posWorst: 7, podium1: 2, podium2: 0, podium3: 0, ptsLow: 4.5, ptsAvg: 8.9, ptsHigh: 12.5, win: 9, loss: 10, tie: 2, winPct: 43 },
  { name: "Zach Beaugureau", app: 2, posAvg: 3.0, posBest: 3, posWorst: 3, podium1: 0, podium2: 0, podium3: 2, ptsLow: 7.5, ptsAvg: 9.3, ptsHigh: 11.5, win: 7, loss: 5, tie: 0, winPct: 58 },
  { name: "Zak Beeck", app: 1, posAvg: 5.0, posBest: 5, posWorst: 5, podium1: 0, podium2: 0, podium3: 0, ptsLow: 7.5, ptsAvg: 7.9, ptsHigh: 8.5, win: 0, loss: 4, tie: 0, winPct: 0 },
];

const SOLO_RECORDS = [
  { name: "Brett Grulkowski", app: 4, posAvg: 5.5, posBest: 2, posWorst: 9, podium1: 0, podium2: 1, podium3: 0, grossAvg: 89.5, netAvg: 74.0, grossToPar: 17.5, netToPar: 2.0 },
  { name: "Brock Ambrose", app: 3, posAvg: 8.0, posBest: 5, posWorst: 11, podium1: 0, podium2: 0, podium3: 0, grossAvg: 93.0, netAvg: 76.5, grossToPar: 21.0, netToPar: 4.5 },
  { name: "Collin Clark", app: 3, posAvg: 3.3, posBest: 1, posWorst: 6, podium1: 1, podium2: 1, podium3: 0, grossAvg: 85.0, netAvg: 72.0, grossToPar: 13.0, netToPar: 0.0 },
  { name: "Evan Powers", app: 4, posAvg: 2.0, posBest: 1, posWorst: 4, podium1: 2, podium2: 1, podium3: 0, grossAvg: 79.5, netAvg: 70.0, grossToPar: 7.5, netToPar: -2.0 },
  { name: "James Bublitz", app: 4, posAvg: 6.0, posBest: 2, posWorst: 10, podium1: 0, podium2: 1, podium3: 0, grossAvg: 90.0, netAvg: 75.0, grossToPar: 18.0, netToPar: 3.0 },
  { name: "Luke Carroll", app: 2, posAvg: 4.5, posBest: 3, posWorst: 6, podium1: 0, podium2: 0, podium3: 0, grossAvg: 87.5, netAvg: 73.5, grossToPar: 15.5, netToPar: 1.5 },
  { name: "Mitch Hoffman", app: 1, posAvg: 9.0, posBest: 9, posWorst: 9, podium1: 0, podium2: 0, podium3: 0, grossAvg: 95.0, netAvg: 78.0, grossToPar: 23.0, netToPar: 6.0 },
  { name: "Mitchell Powers", app: 3, posAvg: 5.0, posBest: 3, posWorst: 7, podium1: 0, podium2: 0, podium3: 0, grossAvg: 88.0, netAvg: 74.5, grossToPar: 16.0, netToPar: 2.5 },
  { name: "Nate Oerhlein", app: 1, posAvg: 2.0, posBest: 2, posWorst: 2, podium1: 0, podium2: 1, podium3: 0, grossAvg: 83.0, netAvg: 71.5, grossToPar: 11.0, netToPar: -0.5 },
  { name: "Quaid DeLacluyse", app: 2, posAvg: 2.5, posBest: 1, posWorst: 4, podium1: 1, podium2: 0, podium3: 0, grossAvg: 84.5, netAvg: 72.5, grossToPar: 12.5, netToPar: 0.5 },
  { name: "Riley Ley", app: 4, posAvg: 6.5, posBest: 3, posWorst: 11, podium1: 0, podium2: 0, podium3: 1, grossAvg: 91.0, netAvg: 75.5, grossToPar: 19.0, netToPar: 3.5 },
  { name: "Sam Kachelek", app: 1, posAvg: 4.0, posBest: 4, posWorst: 4, podium1: 0, podium2: 0, podium3: 0, grossAvg: 86.0, netAvg: 73.0, grossToPar: 14.0, netToPar: 1.0 },
  { name: "Sam Losinski", app: 3, posAvg: 7.0, posBest: 4, posWorst: 9, podium1: 0, podium2: 0, podium3: 0, grossAvg: 92.0, netAvg: 76.0, grossToPar: 20.0, netToPar: 4.0 },
  { name: "Tommy Casey", app: 3, posAvg: 5.7, posBest: 2, posWorst: 10, podium1: 0, podium2: 1, podium3: 0, grossAvg: 89.0, netAvg: 74.5, grossToPar: 17.0, netToPar: 2.5 },
  { name: "Will Gerrietts", app: 4, posAvg: 3.8, posBest: 1, posWorst: 8, podium1: 1, podium2: 0, podium3: 1, grossAvg: 86.5, netAvg: 73.0, grossToPar: 14.5, netToPar: 1.0 },
  { name: "Will Templeton", app: 4, posAvg: 4.3, posBest: 1, posWorst: 9, podium1: 1, podium2: 0, podium3: 0, grossAvg: 87.0, netAvg: 73.5, grossToPar: 15.0, netToPar: 1.5 },
  { name: "Zach Beaugureau", app: 2, posAvg: 6.0, posBest: 4, posWorst: 8, podium1: 0, podium2: 0, podium3: 0, grossAvg: 90.5, netAvg: 75.0, grossToPar: 18.5, netToPar: 3.0 },
  { name: "Zak Beeck", app: 1, posAvg: 8.0, posBest: 8, posWorst: 8, podium1: 0, podium2: 0, podium3: 0, grossAvg: 94.0, netAvg: 77.0, grossToPar: 22.0, netToPar: 5.0 },
];

const teamRecordsSorted = [...TEAM_RECORDS].sort((a, b) => a.posAvg - b.posAvg);
const soloRecordsSorted = [...SOLO_RECORDS].sort((a, b) => a.posAvg - b.posAvg);

// ---------------------------------------------------------------------------
// Year drill-down. Real data will eventually have one row per player per
// year; until that's wired up, single-year stats are derived deterministically
// from each player's all-time line (bounded by their best/worst) so the UI
// and interaction can be built now and swapped for real rows later.
// ---------------------------------------------------------------------------
const RECORD_YEARS = [2026, 2025, 2024, 2023];
const CURRENT_YEAR = RECORD_YEARS[0]; // Score entry always writes to the current event year.

function seededRand(seed) {
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
function attendedYears(app) {
  return RECORD_YEARS.slice(0, app);
}

function yearlySoloStat(p, year) {
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

function yearlyTeamStat(p, year) {
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

// ---------------------------------------------------------------------------
// USGA Course Handicap formula:
// Course Handicap = Handicap Index x (Slope / 113) + (Course Rating - Par)
// rounded to the nearest whole number.
// BCO rule: no upper cap — players get every stroke their index earns them.
// ---------------------------------------------------------------------------
function calcCourseHandicap(handicapIndex, slope, rating, par) {
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
function strokesForHole(handicapValue, handicapRank, totalHoles) {
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
function computeMatchPops(player, roundLabel, course, totalPar) {
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
function computeMatchPopsLive(player, roundId, teams, matchups, course, totalPar) {
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

function scoreLabel(diff) {
  if (diff <= -3) return "Albatross";
  if (diff === -2) return "Eagle";
  if (diff === -1) return "Birdie";
  if (diff === 0) return "Par";
  if (diff === 1) return "Bogey";
  if (diff === 2) return "Double";
  return `+${diff}`;
}

function scoreTone(diff) {
  if (diff <= -1) return { bg: "#DCEFE3", fg: "#1B4332", border: "#6FAE8C" };
  if (diff === 0) return { bg: "#EDEAE0", fg: "#3F3B32", border: "#B9B3A2" };
  if (diff === 1) return { bg: "#FBEAD9", fg: "#8A4B1E", border: "#D89A66" };
  return { bg: "#F7DCDA", fg: "#8C2F2A", border: "#D98884" };
}

function fmtDiff(n) {
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `${n}`;
}

const MEDAL_TONES = {
  gold: { bg: "#F5E1A4", fg: "#7A5C0A" },
  silver: { bg: "#E4E4E4", fg: "#5A5A5A" },
  bronze: { bg: "#EAD0B3", fg: "#8A5A2B" },
};

// Postgres numeric/bigint aggregates come back as strings through
// PostgREST — anything arithmetic done on them client-side (sums, averages)
// needs coercing first, or "+" silently concatenates instead of adding.
// This is the last line of defense: never let a bad/missing value crash
// the render, show "–" instead.
function fmtStat(n, digits = 1) {
  const num = Number(n);
  return Number.isFinite(num) ? num.toFixed(digits) : "–";
}

function diffTone(n) {
  if (n <= -1) return { bg: "#DCEFE3", fg: "#1B4332" };
  if (n === 0) return { bg: "#EDEAE0", fg: "#3F3B32" };
  if (n <= 2) return { bg: "#FBEAD9", fg: "#8A4B1E" };
  return { bg: "#F7DCDA", fg: "#8C2F2A" };
}

const NET_DOUBLE_BOGEY = 2; // cap: net score can be at most par + 2

const soloResults = SOLO_STANDINGS.map((p) => {
  const worst = Math.max(...p.rounds);
  const droppedIndex = p.rounds.indexOf(worst);
  const total = p.rounds.reduce((sum, v, i) => (i === droppedIndex ? sum : sum + v), 0);
  return { ...p, droppedIndex, total };
}).sort((a, b) => a.total - b.total);

const teamResults = [...TEAM_STANDINGS].sort((a, b) => b.points - a.points);

const TABS = [
  { key: "score", label: "Score", icon: Flag },
  { key: "leaderboard", label: "Leaderboard", icon: Trophy },
  { key: "matches", label: "Matches", icon: Swords },
  { key: "games", label: "Games", icon: Coins },
  { key: "more", label: "More", icon: MoreHorizontal },
];

const SHARED_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
  .bco-mono { font-family: 'IBM Plex Mono', monospace; }
  .bco-display { font-family: 'Fraunces', serif; }
  .bco-step-btn {
    width: 44px; height: 44px; border-radius: 999px;
    border: 1px solid #C9C2AC; background: #FFFFFF; color: #1B4332;
    font-size: 20px; font-weight: 600; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.06s ease, background 0.15s ease;
  }
  .bco-step-btn:active { transform: scale(0.94); background: #F0EBDD; }
  .bco-nav-btn {
    border: none; background: transparent; color: #6B6455;
    font-size: 13px; font-weight: 600; letter-spacing: 0.02em;
    cursor: pointer; padding: 6px 10px; border-radius: 8px;
  }
  .bco-nav-btn:hover { background: #F0EBDD; }
  .bco-nav-btn:disabled { opacity: 0.3; cursor: default; }
  .bco-nav-btn:disabled:hover { background: transparent; }
  .bco-hole-chip {
    width: 30px; height: 30px; border-radius: 7px; border: 1px solid transparent;
    font-size: 11px; font-weight: 600; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  .bco-select {
    width: 100%; box-sizing: border-box;
    background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.25);
    border-radius: 8px; padding: 8px 12px; color: #F3EFE2; font-size: 14px;
    font-family: 'Inter', sans-serif; appearance: none;
  }
  .bco-select option { color: #2C2A22; }
  .bco-select-course { font-family: 'Fraunces', serif; font-weight: 600; font-size: 17px; }
  .bco-save-btn {
    width: 100%; border: none; border-radius: 10px; padding: 13px;
    font-size: 14px; font-weight: 600; cursor: pointer;
    font-family: 'Inter', sans-serif; letter-spacing: 0.01em;
    background: #1B4332; color: #F3EFE2;
  }
  .bco-save-btn:active { transform: scale(0.99); }
  .bco-chip-missing { border: 1px dashed #C9564F !important; }
  .bco-tab-btn {
    flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
    padding: 9px 0 8px; background: none; border: none; cursor: pointer;
    color: #A39C89; font-size: 10.5px; font-weight: 600; font-family: 'Inter', sans-serif;
  }
  .bco-tab-btn.active { color: #1B4332; }
  .bco-seg { display: flex; background: #EDEAE0; border-radius: 9px; padding: 3px; gap: 3px; }
  .bco-seg-btn {
    flex: 1; border: none; background: none; padding: 7px 0; border-radius: 7px;
    font-size: 12.5px; font-weight: 600; font-family: 'Inter', sans-serif; cursor: pointer;
    color: #6B6455;
  }
  .bco-seg-btn.active { background: #FFFFFF; color: #1B4332; }
  table.bco-table { width: 100%; border-collapse: collapse; }
  table.bco-table th {
    text-align: left; font-size: 10.5px; font-weight: 600; color: #8A8371;
    letter-spacing: 0.02em; padding: 0 6px 8px; border-bottom: 1px solid #E4DFCE;
  }
  table.bco-table td { padding: 9px 6px; border-bottom: 1px solid #EFEBDE; vertical-align: middle; }
`;

export default function AppShell({ initialYear, isLive = false, loadError = null, initialViewMode = "mobile" } = {}) {
  const [activeTab, setActiveTab] = useState("score");
  // Mobile (phone-frame, bottom nav) or Desktop (taller frame, side nav).
  // Internal screens stay single-column either way — this switches the
  // app's chrome, not a per-screen responsive redesign. Chosen on the
  // login screen now, not a corner toggle inside the app.
  const [viewMode] = useState(initialViewMode);
  // Shared across Score and Matches so match progress reflects live saves.
  // Key: "year-round-playerId" -> { entries: { [hole]: {strokes, putts} }, status: "in-progress" | "submitted" }
  const [scoresStore, setScoresStore] = useState({});
  // The event year everything gets saved under — configurable on Admin > Event settings.
  const [currentYear, setCurrentYear] = useState(initialYear ?? CURRENT_YEAR);
  // The current event's real database id — Players/Courses/Teams/Rounds admin
  // screens need this to know which event to write against.
  const [currentEventId, setCurrentEventId] = useState(null);
  // Bumped after ROUND_ID_BY_LABEL/ROUND_COURSE are re-hydrated below, purely
  // to force a re-render (mutating those shared objects doesn't trigger one
  // on its own). Admin screens also bump this after they add/edit/remove a
  // round or round-course assignment, so Score/Matches pick up the change
  // immediately instead of waiting for a year switch.
  const [roundMapVersion, setRoundMapVersion] = useState(0);
  const forceRoundMapRefresh = () => setRoundMapVersion((v) => v + 1);

  const refreshRoundMap = async () => {
    if (!isLive) return;
    try {
      const event = await fetchEventByYear(currentYear);
      Object.keys(ROUND_ID_BY_LABEL).forEach((k) => delete ROUND_ID_BY_LABEL[k]);
      Object.keys(ROUND_COURSE).forEach((k) => delete ROUND_COURSE[k]);
      Object.keys(ROUND_FLAGS).forEach((k) => delete ROUND_FLAGS[k]);
      Object.keys(ROUND_FORMATS).forEach((k) => delete ROUND_FORMATS[k]);
      setCurrentEventId(event ? event.id : null);
      if (event) {
        const rounds = await fetchRounds(event.id);
        const sorted = [...rounds].sort((a, b) => (a.round_order ?? 0) - (b.round_order ?? 0));
        SCORE_ROUNDS.length = 0;
        sorted.forEach((r) => {
          SCORE_ROUNDS.push(r.label);
          ROUND_ID_BY_LABEL[r.label] = r.id;
          const course = COURSES.find((c) => c.id === r.course_id);
          if (course) ROUND_COURSE[r.label] = course;
          ROUND_FLAGS[r.label] = {
            countsForSolo: r.counts_for_solo !== false,
            countsForTeam: r.counts_for_team !== false,
            countsForCarrollCup: r.counts_for_carroll_cup === true,
            appliesSkins: r.applies_skins !== false,
            appliesPoker: r.applies_poker !== false,
            appliesLowNet: r.applies_low_net !== false,
            appliesCtp: r.applies_ctp !== false,
          };
          ROUND_FORMATS[r.label] = r.play_format || "stroke";
        });

        // The "HI" badge, and who shows up as an available player in Score
        // entry, should always reflect whichever year is currently selected
        // on Year settings — both are recomputed here, not just at boot.
        try {
          const freshPlayers = await fetchPlayers(event.id);
          freshPlayers.forEach((fp) => {
            const existing = PLAYERS.find((p) => p.id === fp.id);
            if (existing) {
              existing.handicapIndex = fp.handicapIndex;
              existing.competing = fp.competing;
            }
          });
        } catch (err) {
          console.error("Failed to refresh player handicaps for", currentYear, err);
        }

        // A course is "active this year" exactly when it's the course
        // played in the currently-selected year — computed here rather
        // than stored, so it can never drift out of sync with
        // played_event_id.
        COURSES.forEach((c) => {
          c.isActiveThisYear = c.playedEventId === event.id;
        });
      } else {
        // No event for this year at all — nothing is "this year's" course,
        // and nobody's marked competing.
        COURSES.forEach((c) => {
          c.isActiveThisYear = false;
        });
        PLAYERS.forEach((p) => {
          p.competing = false;
        });
      }
      forceRoundMapRefresh();
    } catch (err) {
      console.error("Failed to load rounds for", currentYear, err);
    }
  };

  // Re-fetch which rounds belong to Current Year, and which course each maps
  // to, every time Current Year changes — not just once at boot. Without
  // this, saving after switching years would still write against whichever
  // year's round_id happened to be cached, defeating the point of scoping
  // saves by Round-Player-Year.
  useEffect(() => {
    if (!isLive) return;
    refreshRoundMap();
  }, [currentYear, isLive]);

  const isDesktop = viewMode === "desktop";

  const screenContent = (
    <>
      {activeTab === "score" && (
        <ScoreEntry
          scoresStore={scoresStore}
          setScoresStore={setScoresStore}
          currentYear={currentYear}
          isLive={isLive}
          loadError={loadError}
          currentEventId={currentEventId}
        />
      )}
      {activeTab === "leaderboard" && <Leaderboard isLive={isLive} currentEventId={currentEventId} currentYear={currentYear} />}
      {activeTab === "matches" && <MatchResultsTab scoresStore={scoresStore} currentYear={currentYear} isLive={isLive} currentEventId={currentEventId} />}
      {activeTab === "games" && <GamesTab currentYear={currentYear} isLive={isLive} currentEventId={currentEventId} />}
      {activeTab === "more" && (
        <More currentYear={currentYear} setCurrentYear={setCurrentYear} isLive={isLive} currentEventId={currentEventId} refreshRoundMap={refreshRoundMap} />
      )}
    </>
  );

  if (isDesktop) {
    return (
      <div>
        <style>{SHARED_STYLES}</style>
        <div
          style={{
            maxWidth: 840,
            margin: "0 auto",
            height: "85vh",
            minHeight: 600,
            display: "flex",
            fontFamily: "'Inter', system-ui, sans-serif",
            background: "#FBF8F1",
            border: "1px solid #DCD6C4",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <div style={{ width: 190, flexShrink: 0, borderRight: "1px solid #E4DFCE", background: "#F3EFE2", display: "flex", flexDirection: "column", padding: "18px 10px" }}>
            <div className="bco-display" style={{ fontSize: 17, fontWeight: 600, color: "#1B4332", padding: "0 10px", marginBottom: 18 }}>
              BCO Golf
            </div>
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    border: "none",
                    background: active ? "#DCEFE3" : "transparent",
                    color: active ? "#1B4332" : "#6B6455",
                    borderRadius: 8,
                    padding: "9px 10px",
                    fontSize: 13,
                    fontWeight: active ? 600 : 500,
                    cursor: "pointer",
                    fontFamily: "'Inter', sans-serif",
                    textAlign: "left",
                    marginBottom: 2,
                  }}
                >
                  <Icon size={17} strokeWidth={active ? 2.3 : 1.8} />
                  {t.label}
                </button>
              );
            })}
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <div style={{ maxWidth: 520, margin: "0 auto" }}>{screenContent}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          maxWidth: 460,
          margin: "0 auto",
          height: 760,
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Inter', system-ui, sans-serif",
          background: "#FBF8F1",
          border: "1px solid #DCD6C4",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <style>{SHARED_STYLES}</style>

        <div style={{ flex: 1, overflowY: "auto" }}>{screenContent}</div>

        <div style={{ display: "flex", borderTop: "1px solid #E4DFCE", background: "#F3EFE2" }}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button key={t.key} className={`bco-tab-btn${active ? " active" : ""}`} onClick={() => setActiveTab(t.key)}>
                <Icon size={19} strokeWidth={active ? 2.3 : 1.8} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score entry tab
// ---------------------------------------------------------------------------
function ScoreEntry({ scoresStore, setScoresStore, currentYear, isLive, loadError, currentEventId }) {
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [teamOptionsList, setTeamOptionsList] = useState([]);
  const [teamHoleResults, setTeamHoleResults] = useState({}); // "teamId-hole" -> {netScore, points}
  const [teamSaveStatus, setTeamSaveStatus] = useState(null); // null | "saving" | "saved" | "error"
  const [selectedRound, setSelectedRound] = useState("R1");
  const [holeIndex, setHoleIndex] = useState(0);
  const [saveStatus, setSaveStatus] = useState(null); // null | "saved" | "no-player" | "missing" | "submitted"
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // null | "syncing" | "synced" | "sync-error"
  const [liveTeams, setLiveTeams] = useState(null); // null = use mock TEAMS
  const [liveMatchups, setLiveMatchups] = useState(null); // null = use mock MATCHES_BY_ROUND
  const [liveCarrollRoster, setLiveCarrollRoster] = useState(null); // null = use mock CARROLL_CUP_ROSTER_DEFAULT

  // Real teams, that round's matchups, and the Carroll Cup roster — this is
  // what makes the Team badge, Carroll Cup badge, and Pops reflect whatever
  // is actually set up on Admin, instead of the placeholder roster.
  useEffect(() => {
    if (!isLive || !currentEventId) {
      setLiveTeams(null);
      setLiveMatchups(null);
      setLiveCarrollRoster(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [dbTeams, dbMatchups, dbRoster] = await Promise.all([
          fetchTeams(currentEventId),
          fetchRoundMatchups(currentEventId),
          fetchCarrollCupRoster(currentEventId),
        ]);
        if (cancelled) return;
        setLiveTeams(
          dbTeams.map((t) => ({
            id: t.id,
            name: t.name,
            players: [PLAYERS.find((p) => p.id === t.player_a_id)?.name, PLAYERS.find((p) => p.id === t.player_b_id)?.name].filter(Boolean),
          }))
        );
        setLiveMatchups(dbMatchups);
        const rosterMap = {};
        dbRoster.forEach((r) => {
          rosterMap[r.player_id] = r.side;
        });
        setLiveCarrollRoster(rosterMap);
      } catch (err) {
        console.error("Failed to load live teams/matchups/roster:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, currentEventId]);

  // The round drives the course now — no separate course picker. Falls back
  // to the first course if this round isn't mapped yet (e.g. not set up on
  // Admin > Event settings, or not synced from the backend).
  const course = ROUND_COURSE[selectedRound] || COURSES[0];
  const playFormat = ROUND_FORMATS[selectedRound] || "stroke";
  const isNonStrokePlay = playFormat !== "stroke";
  const teamRoundId = ROUND_ID_BY_LABEL[selectedRound] || null;

  useEffect(() => {
    if (!isNonStrokePlay || !isLive || !currentEventId || !teamRoundId) return;
    let cancelled = false;
    (async () => {
      try {
        const [teams, results] = await Promise.all([fetchTeams(currentEventId), fetchTeamHoleResults(teamRoundId)]);
        if (cancelled) return;
        setTeamOptionsList(teams.map((t) => ({ value: t.id, label: t.name })));
        const map = {};
        results.forEach((r) => {
          map[`${r.team_id}-${r.hole_number}`] = { netScore: r.net_score, points: r.points };
        });
        setTeamHoleResults(map);
      } catch (err) {
        console.error("Failed to load team hole results:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNonStrokePlay, isLive, currentEventId, teamRoundId]);

  const saveTeamHoleResult = async (holeNumber, field, value) => {
    if (!selectedTeamId) return;
    const key = `${selectedTeamId}-${holeNumber}`;
    const current = teamHoleResults[key] || { netScore: null, points: null };
    const next = { ...current, [field]: value === "" ? null : field === "netScore" ? Number(value) : Number(value) };
    setTeamHoleResults((prev) => ({ ...prev, [key]: next }));
    if (!isLive || !teamRoundId) return;
    setTeamSaveStatus("saving");
    try {
      await upsertTeamHoleResult(teamRoundId, Number(selectedTeamId), holeNumber, next);
      setTeamSaveStatus("saved");
    } catch (err) {
      console.error("Failed to save team hole result:", err);
      setTeamSaveStatus("error");
    }
  };

  const totalPar = useMemo(() => course.holes.reduce((s, h) => s + h.par, 0), [course]);

  const activePlayers = useMemo(() => PLAYERS.filter((p) => p.competing !== false), []);
  const player = PLAYERS.find((p) => p.id === Number(selectedPlayerId)) || null;
  const storeKey = player ? `${currentYear}-${selectedRound}-${player.id}` : null;
  const record = storeKey ? scoresStore[storeKey] : null;
  const entries = record?.entries || {};
  const status = record?.status || null; // null | "in-progress" | "submitted"

  const courseHandicap = player ? calcCourseHandicap(player.handicapIndex, course.slope, course.rating, totalPar) : null;
  const roundId = ROUND_ID_BY_LABEL[selectedRound] || null;
  const matchPops = player
    ? liveTeams && liveMatchups
      ? computeMatchPopsLive(player, roundId, liveTeams, liveMatchups, course, totalPar)
      : computeMatchPops(player, selectedRound, course, totalPar)
    : null;

  // When live and the round exists in the backend, load whatever's already
  // saved for this player/round on selection — this is what makes "reload
  // the page and your progress is still there" actually testable.
  useEffect(() => {
    if (!isLive || !roundId || !player || !storeKey) return;
    let cancelled = false;
    (async () => {
      try {
        const loaded = await fetchScoresForRound(roundId, player.id);
        if (cancelled) return;
        setScoresStore((prev) => ({ ...prev, [storeKey]: loaded }));
      } catch (err) {
        console.error("Failed to load scores from Supabase:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, roundId, player?.id]);

  const hole = course.holes[holeIndex];
  const entry = entries[hole.number] || { strokes: null, putts: null };
  const strokeReceived = strokesForHole(courseHandicap, hole.handicap, course.holes.length);
  const matchStrokeReceived = strokesForHole(matchPops, hole.handicap, course.holes.length);

  const rawNet = entry.strokes != null ? entry.strokes - strokeReceived : null;
  const netCapValue = hole.par + NET_DOUBLE_BOGEY;
  const capApplied = rawNet != null && rawNet > netCapValue;

  const setEntry = (holeNumber, patch) => {
    if (!storeKey) return;
    setScoresStore((prev) => {
      const prevRecord = prev[storeKey] || { entries: {}, status: null };
      return {
        ...prev,
        [storeKey]: {
          status: prevRecord.status === "submitted" ? "in-progress" : prevRecord.status || "in-progress",
          entries: {
            ...prevRecord.entries,
            [holeNumber]: {
              strokes: prevRecord.entries[holeNumber]?.strokes ?? null,
              putts: prevRecord.entries[holeNumber]?.putts ?? null,
              ...patch,
            },
          },
        },
      };
    });
    setSaveStatus(null);
  };

  const adjustStrokes = (delta) => {
    const base = entry.strokes ?? hole.par;
    setEntry(hole.number, { strokes: Math.max(1, base + delta) });
  };
  const adjustPutts = (delta) => {
    const base = entry.putts ?? 0;
    setEntry(hole.number, { putts: Math.max(0, base + delta) });
  };

  const goTo = (i) => setHoleIndex(Math.min(course.holes.length - 1, Math.max(0, i)));

  const handleRoundChange = (round) => {
    setSelectedRound(round);
    setHoleIndex(0);
    setSaveStatus(null);
    setAttemptedSubmit(false);
  };

  const missingStrokes = useMemo(
    () => course.holes.filter((h) => entries[h.number]?.strokes == null).map((h) => h.number),
    [entries, course]
  );
  const missingPutts = useMemo(
    () => course.holes.filter((h) => entries[h.number]?.putts == null).map((h) => h.number),
    [entries, course]
  );
  const missingAny = useMemo(() => new Set([...missingStrokes, ...missingPutts]), [missingStrokes, missingPutts]);

  const totals = useMemo(() => {
    const sumRange = (holes) =>
      holes.reduce((sum, h) => {
        const s = entries[h.number]?.strokes;
        return s != null ? sum + s : sum;
      }, 0);
    const out = course.holes.slice(0, 9);
    const inn = course.holes.slice(9, 18);
    return {
      out: sumRange(out),
      inn: sumRange(inn),
      tot: sumRange(course.holes),
      parOut: out.reduce((s, h) => s + h.par, 0),
      parIn: inn.reduce((s, h) => s + h.par, 0),
      scoredOut: out.filter((h) => entries[h.number]?.strokes != null).length,
      scoredIn: inn.filter((h) => entries[h.number]?.strokes != null).length,
    };
  }, [entries, course]);

  const diff = entry.strokes != null ? entry.strokes - hole.par : null;
  const tone = diff != null ? scoreTone(diff) : null;

  const handleSaveProgress = async () => {
    if (!player) {
      setSaveStatus("no-player");
      return;
    }
    setScoresStore((prev) => {
      const prevRecord = prev[storeKey] || { entries: {}, status: null };
      return { ...prev, [storeKey]: { ...prevRecord, status: prevRecord.status === "submitted" ? "submitted" : "in-progress" } };
    });
    setSaveStatus("saved");

    if (isLive && roundId) {
      setSyncStatus("syncing");
      try {
        await upsertScores(roundId, player.id, entries);
        await upsertSubmission(roundId, player.id, status === "submitted" ? "submitted" : "in_progress");
        setSyncStatus("synced");
      } catch (err) {
        console.error("Failed to save to Supabase:", err);
        setSyncStatus("sync-error");
      }
    }
  };

  const handleSubmit = async () => {
    setAttemptedSubmit(true);
    if (!player) {
      setSaveStatus("no-player");
      return;
    }
    if (missingStrokes.length > 0 || missingPutts.length > 0) {
      setSaveStatus("missing");
      return;
    }
    setScoresStore((prev) => ({ ...prev, [storeKey]: { ...prev[storeKey], status: "submitted" } }));
    setSaveStatus("submitted");

    if (isLive && roundId) {
      setSyncStatus("syncing");
      try {
        await upsertScores(roundId, player.id, entries);
        await upsertSubmission(roundId, player.id, "submitted");
        setSyncStatus("synced");
      } catch (err) {
        console.error("Failed to submit to Supabase:", err);
        setSyncStatus("sync-error");
      }
    }
  };

  const playerTeam = player ? (liveTeams || TEAMS).find((t) => t.players.includes(player.name)) : null;
  const carrollSide = player ? (liveCarrollRoster ? liveCarrollRoster[player.id] : CARROLL_CUP_ROSTER_DEFAULT[player.name]) : null;

  return (
    <div>
      {loadError && (
        <div style={{ margin: "12px 20px 0" }}>
          <Banner tone="error">Couldn't load live data from Supabase ({loadError}) — showing local demo data instead.</Banner>
        </div>
      )}
      <div style={{ background: "#1B4332", color: "#F3EFE2", padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="bco-mono" style={{ fontSize: 11, fontWeight: 600, background: "rgba(255,255,255,0.14)", padding: "4px 8px", borderRadius: 6 }}>
            {currentYear}
          </span>
          <select
            className="bco-select"
            value={selectedRound}
            onChange={(e) => handleRoundChange(e.target.value)}
            style={{ width: 66, padding: "5px 6px", fontSize: 13, fontWeight: 600, flexShrink: 0 }}
          >
            {SCORE_ROUNDS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.3 }}>
            {course.name} — {course.tee} · <span className="bco-mono">{course.rating}/{course.slope}</span>
          </span>
        </div>

        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <select
            className="bco-select"
            value={selectedPlayerId}
            onChange={(e) => {
              setSelectedPlayerId(e.target.value);
              setSaveStatus(null);
            }}
            style={{ flex: 1, minWidth: 120 }}
          >
            <option value="" style={{ color: "#8A8371" }}>
              Select player…
            </option>
            {activePlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {player && (
            <>
              <span style={{ fontSize: 10.5, fontWeight: 600, background: "rgba(255,255,255,0.14)", padding: "4px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>
                {playerTeam?.name || "No team"}
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  padding: "4px 8px",
                  borderRadius: 6,
                  whiteSpace: "nowrap",
                  background: carrollSide === "red" ? "#F7DCDA" : carrollSide === "blue" ? "#DCE7F2" : "rgba(255,255,255,0.14)",
                  color: carrollSide === "red" ? "#8C2F2A" : carrollSide === "blue" ? "#26456B" : "#F3EFE2",
                }}
              >
                {carrollSide === "red" ? "Red" : carrollSide === "blue" ? "Blue" : "—"}
              </span>
            </>
          )}
        </div>

        {player && (
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            <HcpBubble label="HI" value={player.handicapIndex.toFixed(1)} />
            <HcpBubble label="CH" value={courseHandicap} />
            <HcpBubble label="Pops" value={matchPops ?? "–"} />
          </div>
        )}
      </div>

      {isNonStrokePlay ? (
        <div style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 11.5, color: "#8A8371", marginBottom: 10 }}>
            {selectedRound} is a {playFormat === "scramble" ? "scramble" : "alternate shot"} round — team net score
            and hole points, entered manually.
          </div>
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", border: "1px solid #DCD6C4", borderRadius: 8, padding: "9px 10px", fontSize: 13, fontFamily: "'Inter', sans-serif", marginBottom: 14 }}
          >
            <option value="">Select team…</option>
            {teamOptionsList.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          {selectedTeamId && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <button className="bco-nav-btn" onClick={() => goTo(holeIndex - 1)} disabled={holeIndex === 0}>
                  ← Prev
                </button>
                <span style={{ fontSize: 12, color: "#8A8371", fontWeight: 600 }}>
                  Hole {hole.number} of {course.holes.length}
                </span>
                <button className="bco-nav-btn" onClick={() => goTo(holeIndex + 1)} disabled={holeIndex === course.holes.length - 1}>
                  Next →
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6455", marginBottom: 6 }}>NET SCORE</div>
                  <input
                    type="number"
                    value={teamHoleResults[`${selectedTeamId}-${hole.number}`]?.netScore ?? ""}
                    onChange={(e) => saveTeamHoleResult(hole.number, "netScore", e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", border: "1px solid #DCD6C4", borderRadius: 8, padding: "10px", fontSize: 16, fontFamily: "'IBM Plex Mono', monospace", textAlign: "center" }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6455", marginBottom: 6 }}>HOLE POINTS</div>
                  <select
                    value={teamHoleResults[`${selectedTeamId}-${hole.number}`]?.points ?? ""}
                    onChange={(e) => saveTeamHoleResult(hole.number, "points", e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", border: "1px solid #DCD6C4", borderRadius: 8, padding: "10px", fontSize: 14, fontFamily: "'Inter', sans-serif" }}
                  >
                    <option value="">—</option>
                    <option value="1">1</option>
                    <option value="0.5">1/2</option>
                    <option value="0">0</option>
                  </select>
                </div>
              </div>

              {teamSaveStatus === "saving" && <div style={{ fontSize: 11, color: "#8A8371", marginTop: 10 }}>Saving…</div>}
              {teamSaveStatus === "error" && <div style={{ marginTop: 10 }}><Banner tone="error">Couldn't save — check console.</Banner></div>}
              {!isLive && <div style={{ fontSize: 11, color: "#B4AE9E", marginTop: 10 }}>Not connected — entries won't be saved.</div>}
            </>
          )}
        </div>
      ) : (
        <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px 0" }}>
        <button className="bco-nav-btn" onClick={() => goTo(holeIndex - 1)} disabled={holeIndex === 0}>
          ← Prev
        </button>
        <span style={{ fontSize: 12, color: "#8A8371", fontWeight: 600 }}>
          {selectedRound} · Hole {hole.number} of {course.holes.length}
        </span>
        <button className="bco-nav-btn" onClick={() => goTo(holeIndex + 1)} disabled={holeIndex === course.holes.length - 1}>
          Next →
        </button>
      </div>

      <div style={{ padding: "16px 20px 4px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto auto 1fr 1fr",
            alignItems: "center",
            gap: 10,
            padding: "14px 14px",
            background: capApplied ? "#FBEAEA" : "#FFFFFF",
            border: `1px solid ${capApplied ? "#EFC9C6" : "#E4DFCE"}`,
            borderRadius: 12,
          }}
        >
          <div className="bco-display" style={{ fontSize: 34, fontWeight: 600, color: "#1B4332", lineHeight: 1 }}>
            {hole.number}
          </div>

          <div style={{ fontSize: 11, color: "#8A8371", lineHeight: 1.6 }}>
            <div>
              Par <span className="bco-mono" style={{ fontWeight: 600, color: "#2C2A22" }}>{hole.par}</span>
            </div>
            <div>
              Yds <span className="bco-mono" style={{ fontWeight: 600, color: "#2C2A22" }}>{hole.yardage}</span>
            </div>
            <div>
              Hcp <span className="bco-mono" style={{ fontWeight: 600, color: "#2C2A22" }}>{hole.handicap}</span>
            </div>
          </div>

          {player ? (
            <>
              <StrokeBubble label="Solo" value={strokeReceived} />
              <StrokeBubble label="Match" value={matchStrokeReceived} unavailable={matchPops == null} />
            </>
          ) : (
            <div style={{ gridColumn: "span 2", fontSize: 11, color: "#B4AE9E", textAlign: "center" }}>Select a player to see strokes</div>
          )}
        </div>

        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6455", marginBottom: 6, letterSpacing: "0.02em", textAlign: "center" }}>STROKES</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <button className="bco-step-btn" style={{ width: 36, height: 36, fontSize: 17 }} onClick={() => adjustStrokes(-1)} aria-label="Decrease strokes">
                −
              </button>
              <div style={{ minWidth: 46, textAlign: "center" }}>
                <div className="bco-mono" style={{ fontSize: 26, fontWeight: 600, color: "#2C2A22" }}>
                  {entry.strokes ?? "–"}
                </div>
                <div style={{ marginTop: 3, minHeight: 18 }}>
                  <span
                    style={{
                      display: "inline-block",
                      visibility: tone ? "visible" : "hidden",
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "1px 7px",
                      borderRadius: 999,
                      background: tone?.bg,
                      color: tone?.fg,
                      border: `1px solid ${tone?.border || "transparent"}`,
                    }}
                  >
                    {tone ? scoreLabel(diff) : "Par"}
                  </span>
                </div>
              </div>
              <button className="bco-step-btn" style={{ width: 36, height: 36, fontSize: 17 }} onClick={() => adjustStrokes(1)} aria-label="Increase strokes">
                +
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6455", marginBottom: 6, letterSpacing: "0.02em", textAlign: "center" }}>PUTTS</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <button className="bco-step-btn" style={{ width: 36, height: 36, fontSize: 17 }} onClick={() => adjustPutts(-1)} aria-label="Decrease putts">
                −
              </button>
              <div style={{ minWidth: 46, textAlign: "center" }}>
                <div className="bco-mono" style={{ fontSize: 26, fontWeight: 600, color: "#2C2A22" }}>
                  {entry.putts ?? "–"}
                </div>
                <div style={{ marginTop: 3, minHeight: 18 }} />
              </div>
              <button className="bco-step-btn" style={{ width: 36, height: 36, fontSize: 17 }} onClick={() => adjustPutts(1)} aria-label="Increase putts">
                +
              </button>
            </div>
          </div>
        </div>
      </div>


      <div style={{ padding: "20px 20px 8px" }}>
        {[course.holes.slice(0, 9), course.holes.slice(9, 18)].filter((row) => row.length > 0).map((row, rowI) => (
          <div key={rowI} style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 4, marginBottom: rowI === 0 ? 4 : 0 }}>
            {row.map((h) => {
              const idx = h.number - 1;
              const s = entries[h.number]?.strokes;
              const d = s != null ? s - h.par : null;
              const t = d != null ? scoreTone(d) : null;
              const active = idx === holeIndex;
              const isMissing = attemptedSubmit && missingAny.has(h.number);
              return (
                <button
                  key={h.number}
                  className={`bco-hole-chip${isMissing ? " bco-chip-missing" : ""}`}
                  onClick={() => goTo(idx)}
                  style={{
                    background: t ? t.bg : "#FFFFFF",
                    color: t ? t.fg : "#8A8371",
                    borderColor: active ? "#1B4332" : t ? t.border : "#E4DFCE",
                    borderWidth: active ? 2 : 1,
                  }}
                >
                  {h.number}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-around", borderTop: "1px solid #E4DFCE", padding: "14px 20px", background: "#F3EFE2" }}>
        <TotalStat label="OUT" value={totals.scoredOut ? totals.out : "–"} sub={`par ${totals.parOut}`} />
        {course.holes.length > 9 && <TotalStat label="IN" value={totals.scoredIn ? totals.inn : "–"} sub={`par ${totals.parIn}`} />}
        <TotalStat label="TOTAL" value={totals.scoredOut + totals.scoredIn ? totals.tot : "–"} sub={`par ${totals.parOut + totals.parIn}`} emphasize />
      </div>

      <div style={{ padding: "4px 20px 20px" }}>
        {saveStatus === "no-player" && <Banner tone="error">Select a player before saving.</Banner>}
        {saveStatus === "missing" && (
          <Banner tone="error">
            {missingStrokes.length > 0 && (
              <div>
                Missing strokes on hole{missingStrokes.length > 1 ? "s" : ""} {missingStrokes.join(", ")}.
              </div>
            )}
            {missingPutts.length > 0 && (
              <div style={{ marginTop: missingStrokes.length > 0 ? 4 : 0 }}>
                Missing putts on hole{missingPutts.length > 1 ? "s" : ""} {missingPutts.join(", ")}.
              </div>
            )}
          </Banner>
        )}
        {saveStatus === "saved" && (
          <Banner tone="success">
            Progress saved for {player?.name} — {selectedRound}. Still shows as in-progress on Matches until submitted.
          </Banner>
        )}
        {saveStatus === "submitted" && (
          <Banner tone="success">
            {selectedRound} submitted as final for {player?.name} at {course.name}.
          </Banner>
        )}
        {syncStatus === "sync-error" && (
          <div style={{ marginTop: saveStatus ? 6 : 0 }}>
            <Banner tone="error">Saved locally, but sync to Supabase failed — check console.</Banner>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: saveStatus || syncStatus === "sync-error" ? 10 : 0 }}>
          {player && <StatusBadge status={status} />}
          <button
            onClick={handleSaveProgress}
            style={{
              flex: 1,
              border: "1px solid #1B4332",
              borderRadius: 10,
              padding: "13px",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "'Inter', sans-serif",
              background: "#FFFFFF",
              color: "#1B4332",
              cursor: "pointer",
            }}
          >
            Save
          </button>
          <button className="bco-save-btn" style={{ flex: 1 }} onClick={handleSubmit}>
            Submit
          </button>
        </div>
      </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Games tab — daily cash games. Poker and Skins are computed automatically
// from score entry (strokes/putts) once that pipeline exists; CTP and Low
// Net settle-up are manual/derived views.
// ---------------------------------------------------------------------------
const GAME_MODES = [
  { key: "poker", label: "Poker" },
  { key: "skins", label: "Skins" },
  { key: "ctp", label: "CTP" },
  { key: "lownet", label: "Low Net" },
];

const CTP_COURSE = COURSES[0]; // TODO: derive from the course actually assigned to the selected round
const CTP_HOLES = CTP_COURSE.holes.filter((h) => h.par === 3);

// Buy-in and pot settings will live on the Admin page once that's built —
// hardcoded here so Skins can show a real rollup in the meantime.
const SKINS_SETTINGS = { buyInPerPlayer: 5, players: 8 };
const SKINS_TOTAL_POT = SKINS_SETTINGS.buyInPerPlayer * SKINS_SETTINGS.players;

// Only holes with an actual winner are shown — carried/tied holes are omitted.
const SKINS_PREVIEW = [
  { hole: 3, winner: "Evan Powers", net: 2 },
  { hole: 4, winner: "Collin Clark", net: 3 },
  { hole: 6, winner: "Quaid DeLacluyse", net: 2 },
  { hole: 9, winner: "Tyler Jessel", net: 3 },
  { hole: 14, winner: "Evan Powers", net: 3 },
];

const POKER_PREVIEW = [
  { name: "Evan Powers", zeroPutts: 2, onePutts: 6, threePuttBuyins: 0 },
  { name: "Collin Clark", zeroPutts: 1, onePutts: 5, threePuttBuyins: 1 },
  { name: "Tyler Jessel", zeroPutts: 0, onePutts: 4, threePuttBuyins: 2 },
];

const LOW_NET_SOLO_PREVIEW = [
  { name: "Evan Powers", gross: 79, net: 68 },
  { name: "Quaid DeLacluyse", gross: 82, net: 70 },
  { name: "Collin Clark", gross: 84, net: 71 },
  { name: "Tyler Jessel", gross: 85, net: 72 },
  { name: "James Bublitz", gross: 90, net: 76 },
];

function GameNotApplicable({ round, game }) {
  return (
    <div style={{ padding: "24px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#6B6455" }}>{game} isn't played in {round}</div>
      <div style={{ fontSize: 11.5, color: "#B4AE9E", marginTop: 4 }}>Set on Admin → Round setup, per round.</div>
    </div>
  );
}

function GamesTab({ currentYear, isLive, currentEventId }) {
  const yr = useYearRoundData(isLive, currentYear);
  const [round, setRound] = useState(SCORE_ROUNDS[0]);
  const [mode, setMode] = useState("poker");

  // Keep the selected round valid whenever the selected year's rounds load
  // or the year changes.
  useEffect(() => {
    if (!isLive) return;
    if (yr.rounds.length === 0) return;
    if (!yr.rounds.some((r) => r.label === round)) setRound(yr.rounds[0].label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, yr.rounds]);

  const liveRound = isLive ? yr.rounds.find((r) => r.label === round) : null;
  const roundId = isLive ? liveRound?.id || null : ROUND_ID_BY_LABEL[round] || null;
  const flags = isLive
    ? liveRound || { appliesPoker: true, appliesSkins: true, appliesCtp: true, appliesLowNet: true }
    : ROUND_FLAGS[round] || {};

  return (
    <div>
      <div style={{ padding: "18px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <div className="bco-display" style={{ fontSize: 20, fontWeight: 600, color: "#1B4332" }}>
            Games
          </div>
          <span style={{ fontSize: 11, color: "#8A8371" }}>{yr.selectedYear}</span>
        </div>

        <YearRoundPicker years={yr.years} selectedYear={yr.selectedYear} setSelectedYear={yr.setSelectedYear} />

        <div style={{ marginBottom: 14 }}>
          <LightSelect
            value={round}
            onChange={setRound}
            options={(isLive && yr.rounds.length > 0 ? yr.rounds.map((r) => r.label) : SCORE_ROUNDS).map((r) => ({ value: r, label: r }))}
          />
        </div>

        <div className="bco-seg" style={{ marginBottom: 16 }}>
          {GAME_MODES.map((g) => (
            <button key={g.key} className={`bco-seg-btn${mode === g.key ? " active" : ""}`} onClick={() => setMode(g.key)}>
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 20px 24px" }}>
        {mode === "poker" &&
          (flags.appliesPoker === false ? (
            <GameNotApplicable round={round} game="Poker" />
          ) : (
            <PokerPanel round={round} year={yr.selectedYear} isLive={isLive} roundId={roundId} />
          ))}
        {mode === "skins" &&
          (flags.appliesSkins === false ? (
            <GameNotApplicable round={round} game="Skins" />
          ) : (
            <SkinsPanel round={round} year={yr.selectedYear} isLive={isLive} roundId={roundId} />
          ))}
        {mode === "ctp" &&
          (flags.appliesCtp === false ? (
            <GameNotApplicable round={round} game="CTP" />
          ) : (
            <CtpPanel round={round} year={yr.selectedYear} isLive={isLive} roundId={roundId} currentEventId={yr.selectedEventId} />
          ))}
        {mode === "lownet" &&
          (flags.appliesLowNet === false ? (
            <GameNotApplicable round={round} game="Low Net" />
          ) : (
            <LowNetPanel round={round} year={yr.selectedYear} isLive={isLive} roundId={roundId} currentEventId={yr.selectedEventId} />
          ))}
      </div>
    </div>
  );
}

function AutoComputedNote({ children }) {
  return (
    <div
      style={{
        fontSize: 11.5,
        color: "#6B6455",
        background: "#F3EFE2",
        border: "1px solid #E4DFCE",
        borderRadius: 10,
        padding: "10px 12px",
        lineHeight: 1.5,
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

function PokerPanel({ round, year, isLive, roundId }) {
  const [liveCards, setLiveCards] = useState(null); // null = use mock POKER_PREVIEW
  const [livePayout, setLivePayout] = useState(null); // null = no winner recorded yet
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);
  const [winnerChoice, setWinnerChoice] = useState("");
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "error"

  const loadLive = async () => {
    if (!isLive || !roundId) {
      setLiveLoading(false);
      return;
    }
    try {
      const [cardsData, payoutData] = await Promise.all([fetchPokerCards(roundId), fetchPokerPayout(roundId)]);
      setLiveCards(cardsData);
      setLivePayout(payoutData);
    } catch (err) {
      console.error("Failed to load live poker data:", err);
      setLiveError(err.message || String(err));
    } finally {
      setLiveLoading(false);
    }
  };

  useEffect(() => {
    setLiveLoading(isLive);
    setLiveCards(null);
    setLivePayout(null);
    setWinnerChoice("");
    setSaveStatus(null);
    loadLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, roundId]);

  const isRealData = isLive && liveCards != null;
  const rows = isRealData
    ? liveCards.map((c) => ({
        name: PLAYERS.find((p) => p.id === c.player_id)?.name || `Player ${c.player_id}`,
        playerId: c.player_id,
        zeroPutts: c.zero_putts,
        onePutts: c.one_putts,
        cards: c.cards_earned,
        threePutts: c.three_putts,
      }))
    : POKER_PREVIEW.map((p) => ({ name: p.name, playerId: null, zeroPutts: p.zeroPutts, onePutts: p.onePutts, cards: p.zeroPutts * 2 + p.onePutts, threePutts: p.threePuttBuyins }));

  const winnerName = livePayout ? PLAYERS.find((p) => p.id === livePayout.winner_player_id)?.name : null;

  const handleSaveWinner = async () => {
    if (!winnerChoice || !roundId) return;
    setSaveStatus("saving");
    try {
      await savePokerWinner(roundId, Number(winnerChoice));
      await loadLive();
      setWinnerChoice("");
      setSaveStatus(null);
    } catch (err) {
      console.error("Failed to save poker winner:", err);
      setSaveStatus("error");
    }
  };

  return (
    <div>
      {isLive && liveError && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't load live poker data ({liveError}) — showing local demo data instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 10 }}>Loading poker…</div>}

      {!liveLoading && (
        <>
          <AutoComputedNote>
            Putting Poker hands are built automatically from 0- and 1-putt holes logged in Score, with $1 buy-ins from
            3-putts.{" "}
            {isRealData ? `Real results for ${round} · ${year}. The hand itself is resolved with a real deck — record the winner below.` : `Preview below for ${round} · ${year} — not live yet.`}
          </AutoComputedNote>

          {rows.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "20px 12px" }}>
              No putts logged yet for {round}.
            </div>
          ) : (
            <table className="bco-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th style={{ textAlign: "center" }}>0-putts</th>
                  <th style={{ textAlign: "center" }}>1-putts</th>
                  <th style={{ textAlign: "center" }}>Cards</th>
                  <th style={{ textAlign: "right" }}>3-putt buy-ins</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.name}>
                    <td style={{ fontSize: 13, fontWeight: 500, color: "#2C2A22" }}>{p.name}</td>
                    <td className="bco-mono" style={{ textAlign: "center", fontSize: 13 }}>
                      {p.zeroPutts}
                    </td>
                    <td className="bco-mono" style={{ textAlign: "center", fontSize: 13 }}>
                      {p.onePutts}
                    </td>
                    <td className="bco-mono" style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#1B4332" }}>
                      {p.cards}
                    </td>
                    <td className="bco-mono" style={{ textAlign: "right", fontSize: 13 }}>
                      {p.threePutts > 0 ? `$${p.threePutts}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ fontSize: 10.5, color: "#A39C89", marginTop: 10, lineHeight: 1.5 }}>
            Cards = (0-putts × 2) + (1-putts × 1). Best poker hand from those cards wins the pot.
          </div>

          {isRealData && (
            <div style={{ marginTop: 14, background: "#FFFFFF", border: "1px solid #E4DFCE", borderRadius: 10, padding: 14 }}>
              {winnerName ? (
                <div>
                  <div style={{ fontSize: 10.5, color: "#8A8371" }}>Winner</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#1B4332" }}>{winnerName}</div>
                  <div className="bco-mono" style={{ fontSize: 13, color: "#6B6455", marginTop: 2 }}>
                    ${Number(livePayout.pot).toFixed(2)} pot ({livePayout.total_three_putts} three-putts)
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#6B6455", marginBottom: 8 }}>Record the winner</div>
                  {saveStatus === "error" && (
                    <div style={{ marginBottom: 8 }}>
                      <Banner tone="error">Couldn't save — try again.</Banner>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <select
                      value={winnerChoice}
                      onChange={(e) => setWinnerChoice(e.target.value)}
                      style={{ flex: 1, border: "1px solid #DCD6C4", borderRadius: 8, padding: "9px 10px", fontSize: 13, fontFamily: "'Inter', sans-serif" }}
                    >
                      <option value="">Select player…</option>
                      {rows.map((p) => (
                        <option key={p.playerId} value={p.playerId}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleSaveWinner}
                      disabled={!winnerChoice || saveStatus === "saving"}
                      style={{
                        border: "none",
                        borderRadius: 8,
                        padding: "9px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: "'Inter', sans-serif",
                        background: winnerChoice ? "#1B4332" : "#DCD6C4",
                        color: "#F3EFE2",
                        cursor: winnerChoice ? "pointer" : "default",
                      }}
                    >
                      {saveStatus === "saving" ? "Saving…" : "Save"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SkinsPanel({ round, year, isLive, roundId }) {
  const [liveSkins, setLiveSkins] = useState(null); // null = use mock SKINS_PREVIEW
  const [livePayout, setLivePayout] = useState(null);
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);

  useEffect(() => {
    if (!isLive || !roundId) {
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [skinsData, payoutData] = await Promise.all([fetchSkins(roundId), fetchSkinsPayout(roundId)]);
        if (cancelled) return;
        setLiveSkins(skinsData);
        setLivePayout(payoutData);
      } catch (err) {
        console.error("Failed to load live skins:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, roundId]);

  const isRealData = isLive && liveSkins != null;
  const skinsList = isRealData
    ? liveSkins.map((s) => ({ hole: s.hole_number, winner: PLAYERS.find((p) => p.id === s.winner_player_id)?.name || `Player ${s.winner_player_id}` }))
    : SKINS_PREVIEW;
  const skinsWon = skinsList.length;
  const totalPot = isRealData ? livePayout?.total_pot ?? 0 : SKINS_TOTAL_POT;
  const skinValue = isRealData ? livePayout?.value_per_skin ?? 0 : skinsWon ? SKINS_TOTAL_POT / skinsWon : 0;
  const buyIn = isRealData ? livePayout?.skins_buy_in ?? SKINS_SETTINGS.buyInPerPlayer : SKINS_SETTINGS.buyInPerPlayer;
  const participants = isRealData ? livePayout?.participants ?? 0 : SKINS_SETTINGS.players;

  const byPlayer = useMemo(() => {
    const map = {};
    skinsList.forEach((s) => {
      if (!map[s.winner]) map[s.winner] = [];
      map[s.winner].push(s.hole);
    });
    return Object.entries(map)
      .map(([name, holes]) => {
        const sortedHoles = [...holes].sort((a, b) => a - b);
        return { name, holes: sortedHoles, count: sortedHoles.length, total: sortedHoles.length * skinValue };
      })
      .sort((a, b) => b.count - a.count);
  }, [skinsList, skinValue]);

  return (
    <div>
      {isLive && liveError && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't load live skins ({liveError}) — showing local demo data instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 10 }}>Loading skins…</div>}

      {!liveLoading && (
        <>
          <AutoComputedNote>
            Skins are awarded from the lowest net score on each hole (ties carry, one-tie-all-tie).{" "}
            {isRealData ? `Real results for ${round} · ${year}.` : `Preview below for ${round} · ${year} — not live yet.`}
          </AutoComputedNote>

          {byPlayer.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "20px 12px" }}>
              No skins won yet for {round}.
            </div>
          ) : (
            <table className="bco-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Holes</th>
                  <th style={{ textAlign: "center" }}>Skins</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {byPlayer.map((p) => (
                  <tr key={p.name}>
                    <td style={{ fontSize: 13, fontWeight: 500, color: "#2C2A22" }}>{p.name}</td>
                    <td className="bco-mono" style={{ fontSize: 12, color: "#8A8371" }}>
                      {p.holes.join(", ")}
                    </td>
                    <td className="bco-mono" style={{ textAlign: "center", fontSize: 13 }}>
                      {p.count}
                    </td>
                    <td className="bco-mono" style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: "#1B4332" }}>
                      ${p.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div
            style={{
              marginTop: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#FFFFFF",
              border: "1px solid #E4DFCE",
              borderRadius: 10,
              padding: "12px 14px",
            }}
          >
            <div>
              <div style={{ fontSize: 10.5, color: "#8A8371" }}>
                {skinsWon} skin{skinsWon !== 1 ? "s" : ""} won · ${totalPot} pot
              </div>
              <div style={{ fontSize: 9.5, color: "#B4AE9E", marginTop: 2 }}>
                ${buyIn}/player × {participants} — set on Admin
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10.5, color: "#8A8371" }}>Per skin</div>
              <div className="bco-mono" style={{ fontSize: 18, fontWeight: 600, color: "#1B4332" }}>
                ${skinValue.toFixed(2)}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CtpPanel({ round, year, isLive, roundId, currentEventId }) {
  const [winners, setWinners] = useState({}); // live: { holeNumber: playerId } scoped to roundId. offline: { "year-round-hole": playerId }
  const [draft, setDraft] = useState({}); // { hole: playerId } — pending edits before Save all
  const [saved, setSaved] = useState(false);
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const [ctpPrize, setCtpPrize] = useState(null);

  useEffect(() => {
    setDraft({});
    setSaved(false);
    setSaveError(false);
    if (!isLive || !roundId) {
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    setLiveLoading(true);
    (async () => {
      try {
        const [results, gs] = await Promise.all([fetchCtpResults(roundId), currentEventId ? fetchGameSettings(currentEventId) : null]);
        if (cancelled) return;
        const map = {};
        results.forEach((r) => {
          map[r.hole_number] = r.player_id;
        });
        setWinners(map);
        if (gs) setCtpPrize(Number(gs.ctp_prize));
      } catch (err) {
        console.error("Failed to load CTP results:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, roundId, currentEventId]);

  const winnerFor = (holeNumber) => {
    if (holeNumber in draft) return draft[holeNumber];
    if (isLive && roundId) return winners[holeNumber] ?? "";
    const key = `${year}-${round}-${holeNumber}`;
    return winners[key] ?? "";
  };

  const setDraftFor = (holeNumber, playerId) => {
    setDraft((prev) => ({ ...prev, [holeNumber]: playerId ? Number(playerId) : "" }));
    setSaved(false);
  };

  const handleSaveAll = async () => {
    if (isLive && roundId) {
      setSaveError(false);
      try {
        await Promise.all(
          Object.entries(draft).map(([holeNumber, playerId]) =>
            playerId ? saveCtpResult(roundId, Number(holeNumber), playerId) : deleteCtpResult(roundId, Number(holeNumber))
          )
        );
        setWinners((prev) => {
          const next = { ...prev };
          Object.entries(draft).forEach(([holeNumber, playerId]) => {
            if (playerId) next[holeNumber] = playerId;
            else delete next[holeNumber];
          });
          return next;
        });
        setDraft({});
        setSaved(true);
      } catch (err) {
        console.error("Failed to save CTP winners:", err);
        setSaveError(true);
      }
      return;
    }

    setWinners((prev) => {
      const next = { ...prev };
      Object.entries(draft).forEach(([holeNumber, playerId]) => {
        const key = `${year}-${round}-${holeNumber}`;
        if (playerId) next[key] = playerId;
        else delete next[key];
      });
      return next;
    });
    setDraft({});
    setSaved(true);
  };

  const hasPendingChanges = Object.keys(draft).length > 0;

  return (
    <div>
      {isLive && liveError && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't load live CTP results ({liveError}) — showing local demo data instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 10 }}>Loading CTP…</div>}

      {!liveLoading && (
        <>
          <div style={{ fontSize: 11.5, color: "#8A8371", marginBottom: 10 }}>
            Par 3s on {CTP_COURSE.name}. Set every winner, then save once.
            {ctpPrize != null && ` $${ctpPrize}/hole.`}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {CTP_HOLES.map((h) => (
              <div
                key={h.number}
                style={{
                  display: "grid",
                  gridTemplateColumns: "56px 1fr",
                  gap: 10,
                  alignItems: "center",
                  background: "#FFFFFF",
                  border: "1px solid #E4DFCE",
                  borderRadius: 10,
                  padding: "10px 12px",
                }}
              >
                <div>
                  <div className="bco-mono" style={{ fontSize: 15, fontWeight: 600, color: "#1B4332" }}>
                    {h.number}
                  </div>
                  <div style={{ fontSize: 9.5, color: "#8A8371" }}>{h.yardage}y</div>
                </div>
                <select
                  value={winnerFor(h.number)}
                  onChange={(e) => setDraftFor(h.number, e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    border: "1px solid #DCD6C4",
                    borderRadius: 8,
                    padding: "8px 10px",
                    fontSize: 13,
                    fontFamily: "'Inter', sans-serif",
                    background: "#FFFFFF",
                    color: "#2C2A22",
                  }}
                >
                  <option value="">No winner</option>
                  {PLAYERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {saveError && (
            <div style={{ marginTop: 12 }}>
              <Banner tone="error">Couldn't save — try again.</Banner>
            </div>
          )}
          {saved && (
            <div style={{ marginTop: 12 }}>
              <Banner tone="success">CTP winners saved for {round} · {year}.</Banner>
            </div>
          )}

          <button
            onClick={handleSaveAll}
            disabled={!hasPendingChanges}
            style={{
              width: "100%",
              marginTop: 12,
              border: "none",
              borderRadius: 10,
              padding: "12px",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "'Inter', sans-serif",
              background: hasPendingChanges ? "#1B4332" : "#DCD6C4",
              color: "#F3EFE2",
              cursor: hasPendingChanges ? "pointer" : "default",
            }}
          >
            Save all
          </button>
        </>
      )}
    </div>
  );
}

function LowNetPanel({ round, year, isLive, roundId, currentEventId }) {
  const [mode, setMode] = useState("solo");
  const [liveSolo, setLiveSolo] = useState(null); // null = use mock LOW_NET_SOLO_PREVIEW
  const [liveTeam, setLiveTeam] = useState(null); // null = use mock/placeholder
  const [gameSettings, setGameSettings] = useState(null);
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);

  useEffect(() => {
    if (!isLive || !roundId || !currentEventId) {
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [lowNetSolo, grossTotals, lowNetTeam, dbTeams, gs] = await Promise.all([
          fetchLowNetSolo(roundId),
          fetchSoloRoundGrossTotals(currentEventId),
          fetchLowNetTeam(roundId),
          fetchTeams(currentEventId),
          fetchGameSettings(currentEventId),
        ]);
        if (cancelled) return;

        const soloRows = lowNetSolo
          .map((s) => ({
            name: PLAYERS.find((p) => p.id === s.player_id)?.name || `Player ${s.player_id}`,
            net: s.net_total,
            gross: grossTotals.find((g) => g.round_id === roundId && g.player_id === s.player_id)?.gross_total ?? null,
          }))
          .sort((a, b) => a.net - b.net);
        setLiveSolo(soloRows);

        const teamRows = lowNetTeam
          .map((t) => {
            const teamMeta = dbTeams.find((dt) => dt.id === t.team_id);
            return { name: teamMeta?.name || `Team ${t.team_id}`, net: t.net_total };
          })
          .sort((a, b) => a.net - b.net);
        setLiveTeam(teamRows);
        setGameSettings(gs);
      } catch (err) {
        console.error("Failed to load live low net:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, roundId, currentEventId]);

  const isRealData = isLive && (liveSolo != null || liveTeam != null);
  const soloRows = liveSolo || [...LOW_NET_SOLO_PREVIEW].sort((a, b) => a.net - b.net);
  const teamRows = liveTeam;

  const soloBuyIn = gameSettings ? Number(gameSettings.low_net_solo_buy_in) : null;
  const teamBuyIn = gameSettings ? Number(gameSettings.low_net_team_buy_in) : null;
  const soloPot = soloBuyIn != null ? soloBuyIn * soloRows.length : null;
  const teamPot = teamBuyIn != null && teamRows ? teamBuyIn * 2 * teamRows.length : null;

  return (
    <div>
      {isLive && liveError && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't load live Low Net data ({liveError}) — showing local demo data instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 10 }}>Loading Low Net…</div>}

      {!liveLoading && (
        <>
          <AutoComputedNote>
            Low Net is best ball with full handicap applied — solo individual, team 2-man net best ball.{" "}
            {isRealData ? `Real results for ${round} · ${year}.` : `Preview below for ${round} · ${year} — not live yet.`}
          </AutoComputedNote>

          <div className="bco-seg" style={{ marginBottom: 14 }}>
            <button className={`bco-seg-btn${mode === "solo" ? " active" : ""}`} onClick={() => setMode("solo")}>
              Solo
            </button>
            <button className={`bco-seg-btn${mode === "team" ? " active" : ""}`} onClick={() => setMode("team")}>
              Team
            </button>
          </div>

          {mode === "solo" ? (
            soloRows.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "24px 12px" }}>
                No completed solo rounds yet for {round}.
              </div>
            ) : (
              <table className="bco-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th style={{ textAlign: "center" }}>Gross</th>
                    <th style={{ textAlign: "right" }}>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {soloRows.map((p, i) => (
                    <tr key={p.name}>
                      <td style={{ fontSize: 13, fontWeight: 500, color: i === 0 ? "#1B4332" : "#2C2A22" }}>
                        {p.name}
                        {i === 0 && <span style={{ fontSize: 10, color: "#6FAE8C", marginLeft: 6 }}>● low</span>}
                      </td>
                      <td className="bco-mono" style={{ textAlign: "center", fontSize: 13, color: "#8A8371" }}>
                        {p.gross ?? "–"}
                      </td>
                      <td className="bco-mono" style={{ textAlign: "right", fontSize: 14, fontWeight: 600, color: "#1B4332" }}>
                        {p.net}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : teamRows == null ? (
            <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "24px 12px" }}>
              Team low net (2-man net best ball) coming next — same layout, paired by team instead of by player.
            </div>
          ) : teamRows.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "24px 12px" }}>
              No completed team rounds yet for {round}.
            </div>
          ) : (
            <table className="bco-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th style={{ textAlign: "right" }}>Net</th>
                </tr>
              </thead>
              <tbody>
                {teamRows.map((t, i) => (
                  <tr key={t.name}>
                    <td style={{ fontSize: 13, fontWeight: 500, color: i === 0 ? "#1B4332" : "#2C2A22" }}>
                      {t.name}
                      {i === 0 && <span style={{ fontSize: 10, color: "#6FAE8C", marginLeft: 6 }}>● low</span>}
                    </td>
                    <td className="bco-mono" style={{ textAlign: "right", fontSize: 14, fontWeight: 600, color: "#1B4332" }}>
                      {t.net}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {gameSettings && (
            <div
              style={{
                marginTop: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#FFFFFF",
                border: "1px solid #E4DFCE",
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <div style={{ fontSize: 10.5, color: "#8A8371" }}>
                {mode === "solo" ? `$${soloBuyIn}/player × ${soloRows.length}` : `$${teamBuyIn}/player × 2 × ${teamRows?.length ?? 0} teams`}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10.5, color: "#8A8371" }}>Pot</div>
                <div className="bco-mono" style={{ fontSize: 18, fontWeight: 600, color: "#1B4332" }}>
                  ${(mode === "solo" ? soloPot : teamPot)?.toFixed(2) ?? "0.00"}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LightSelect({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        border: "1px solid #DCD6C4",
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "'Inter', sans-serif",
        background: "#FFFFFF",
        color: "#2C2A22",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// More tab — settings hub. Currently houses Record Book and Admin; other
// management screens will get added here as their own menu rows.
// ---------------------------------------------------------------------------
function More({ currentYear, setCurrentYear, isLive, currentEventId, refreshRoundMap }) {
  const [view, setView] = useState("menu");

  if (view === "recordbook") {
    return <RecordBook onBack={() => setView("menu")} isLive={isLive} />;
  }
  if (view === "players") {
    return <PlayersScreen onBack={() => setView("menu")} isLive={isLive} currentEventId={currentEventId} currentYear={currentYear} />;
  }
  if (view === "courses") {
    return <CoursesScreen onBack={() => setView("menu")} isLive={isLive} />;
  }
  if (view === "admin") {
    return <AdminMenu onBack={() => setView("menu")} onNavigate={setView} />;
  }
  if (view === "admin-import") {
    return <ImportResults onBack={() => setView("admin")} isLive={isLive} />;
  }
  if (view === "admin-export") {
    return <ExportResults onBack={() => setView("admin")} isLive={isLive} currentEventId={currentEventId} />;
  }
  if (view === "admin-general") {
    return <YearSettings onBack={() => setView("admin")} currentYear={currentYear} setCurrentYear={setCurrentYear} isLive={isLive} />;
  }
  if (view === "admin-teams") {
    return <TeamSetupSettings onBack={() => setView("admin")} isLive={isLive} currentYear={currentYear} />;
  }
  if (view === "admin-rounds") {
    return <RoundSetupSettings onBack={() => setView("admin")} isLive={isLive} currentYear={currentYear} refreshRoundMap={refreshRoundMap} />;
  }
  if (view === "admin-matchups") {
    return <MatchupSetupSettings onBack={() => setView("admin")} isLive={isLive} currentYear={currentYear} />;
  }
  if (view === "admin-games") {
    return <GameSettings onBack={() => setView("admin")} isLive={isLive} currentYear={currentYear} />;
  }

  const MENU_ITEMS = [
    { key: "recordbook", label: "Record Book", note: "All-time solo and team stats", icon: BookOpen, enabled: true },
    { key: "players", label: "Players", note: "Roster, bios, and handicap indexes", icon: Flag, enabled: true },
    { key: "courses", label: "Courses", note: "Course-tees and hole-by-hole data", icon: Trophy, enabled: true },
    { key: "admin", label: "Admin", note: "Imports, exports, and event settings", icon: MoreHorizontal, enabled: true },
  ];

  return (
    <div style={{ padding: "18px 20px 24px" }}>
      <div className="bco-display" style={{ fontSize: 20, fontWeight: 600, color: "#1B4332", marginBottom: 14 }}>
        More
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => item.enabled && setView(item.key)}
              disabled={!item.enabled}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                textAlign: "left",
                background: "#FFFFFF",
                border: "1px solid #E4DFCE",
                borderRadius: 12,
                padding: "13px 14px",
                cursor: item.enabled ? "pointer" : "default",
                opacity: item.enabled ? 1 : 0.45,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              <Icon size={18} strokeWidth={1.8} color="#1B4332" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#2C2A22" }}>{item.label}</div>
                <div style={{ fontSize: 11, color: "#8A8371", marginTop: 1 }}>
                  {item.enabled ? item.note : `${item.note} — coming soon`}
                </div>
              </div>
              {item.enabled && <ChevronRight size={16} color="#B9B3A2" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin menu — Import/Export, Event settings, and Game settings are real.
// ---------------------------------------------------------------------------
function AdminMenu({ onBack, onNavigate }) {
  const ADMIN_ITEMS = [
    { key: "admin-import", label: "Import results", note: "Upload a CSV of historical scores", icon: BookOpen, enabled: true },
    { key: "admin-export", label: "Export results", note: "Download scores and payouts as CSV", icon: BookOpen, enabled: true },
    { key: "admin-general", label: "Year settings", note: "Every year on record and rounds played", icon: Trophy, enabled: true },
    { key: "admin-teams", label: "Team setup", note: "Team pairs and Carroll Cup assignments", icon: Flag, enabled: true },
    { key: "admin-rounds", label: "Round setup", note: "Course, and what each round counts toward", icon: Trophy, enabled: true },
    { key: "admin-matchups", label: "Matchup setup", note: "Team pairings per round, per competition", icon: Swords, enabled: true },
    { key: "admin-games", label: "Game settings", note: "Buy-ins for Skins, Poker, Low Net, CTP", icon: Coins, enabled: true },
  ];

  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 14 }}>
        <button onClick={onBack} style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", color: "#6B6455" }} aria-label="Back to More">
          <ChevronLeft size={18} />
        </button>
        <span className="bco-display" style={{ fontSize: 19, fontWeight: 600, color: "#1B4332" }}>
          Admin
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ADMIN_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => item.enabled && onNavigate(item.key)}
              disabled={!item.enabled}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                textAlign: "left",
                background: "#FFFFFF",
                border: "1px solid #E4DFCE",
                borderRadius: 12,
                padding: "13px 14px",
                cursor: item.enabled ? "pointer" : "default",
                opacity: item.enabled ? 1 : 0.45,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              <Icon size={18} strokeWidth={1.8} color="#1B4332" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#2C2A22" }}>{item.label}</div>
                <div style={{ fontSize: 11, color: "#8A8371", marginTop: 1 }}>
                  {item.enabled ? item.note : `${item.note} — coming soon`}
                </div>
              </div>
              {item.enabled && <ChevronRight size={16} color="#B9B3A2" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FormSelect({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        boxSizing: "border-box",
        border: "1px solid #DCD6C4",
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 13,
        fontFamily: "'Inter', sans-serif",
        background: "#FFFFFF",
        color: "#2C2A22",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function SettingsSection({ title, description, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#1B4332", marginBottom: 4 }}>{title}</div>
      {description && <div style={{ fontSize: 11, color: "#8A8371", marginBottom: 10, lineHeight: 1.5 }}>{description}</div>}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event settings — current year, team pairs, Carroll Cup roster, round
// matchups, and round-to-course assignment. Local to this session for now,
// same as Players/Courses — becomes the real config source once backend-
// connected.
// ---------------------------------------------------------------------------
function YearSettings({ onBack, currentYear, setCurrentYear, isLive }) {
  const [years, setYears] = useState(() => RECORD_YEARS.map((y) => ({ id: null, year: y, roundsPlayed: LEADERBOARD_ROUNDS.length, isCurrent: y === currentYear })));
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);
  const [showAddYear, setShowAddYear] = useState(false);
  const [newYearInput, setNewYearInput] = useState(String(Math.max(...RECORD_YEARS) + 1));
  const [addYearError, setAddYearError] = useState(false);

  const load = async () => {
    if (!isLive) {
      setLiveLoading(false);
      return;
    }
    try {
      const events = await fetchEvents();
      setYears(events.map((e) => ({ id: e.id, year: e.year, roundsPlayed: e.rounds_played, isCurrent: e.is_current })));
    } catch (err) {
      console.error("Failed to load events:", err);
      setLiveError(err.message || String(err));
    } finally {
      setLiveLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]);

  const updateRoundsPlayed = (row, value) => {
    const roundsPlayed = Math.max(0, Number(value) || 0);
    setYears((prev) => prev.map((y) => (y.year === row.year ? { ...y, roundsPlayed } : y)));
    if (isLive && row.id) {
      updateEvent(row.id, { roundsPlayed }).catch((err) => console.error("Failed to update rounds played:", err));
    }
  };

  const handleSetCurrent = async (row) => {
    setYears((prev) => prev.map((y) => ({ ...y, isCurrent: y.year === row.year })));
    setCurrentYear(row.year);
    if (isLive && row.id) {
      try {
        await setCurrentEvent(row.id);
      } catch (err) {
        console.error("Failed to set current year:", err);
      }
    }
  };

  const handleAddYear = async () => {
    const y = Number(newYearInput);
    if (!y || years.some((row) => row.year === y)) return;
    setAddYearError(false);
    if (isLive) {
      try {
        await createEvent(y);
        await load();
      } catch (err) {
        console.error("Failed to create year:", err);
        setAddYearError(true);
        return;
      }
    } else {
      setYears((prev) => [...prev, { id: null, year: y, roundsPlayed: 0, isCurrent: false }].sort((a, b) => b.year - a.year));
    }
    setNewYearInput(String(y + 1));
    setShowAddYear(false);
  };

  const sortedYears = [...years].sort((a, b) => b.year - a.year);

  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 14 }}>
        <button onClick={onBack} style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", color: "#6B6455" }} aria-label="Back to Admin">
          <ChevronLeft size={18} />
        </button>
        <span className="bco-display" style={{ fontSize: 19, fontWeight: 600, color: "#1B4332" }}>
          Year settings
        </span>
      </div>

      {isLive && liveError && (
        <div style={{ marginBottom: 14 }}>
          <Banner tone="error">Couldn't load live years ({liveError}) — showing local data instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 14 }}>Loading years…</div>}

      {!liveLoading && (
        <SettingsSection title="Years" description="Every year on record, and how many rounds were played. The current year is what Score and Matches save under.">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sortedYears.map((row) => (
              <div
                key={row.year}
                style={{
                  display: "grid",
                  gridTemplateColumns: "56px 1fr auto",
                  gap: 10,
                  alignItems: "center",
                  background: "#FFFFFF",
                  border: `1px solid ${row.isCurrent ? "#1B4332" : "#E4DFCE"}`,
                  borderRadius: 10,
                  padding: "10px 12px",
                }}
              >
                <span className="bco-mono" style={{ fontSize: 14, fontWeight: 600, color: "#2C2A22" }}>
                  {row.year}
                </span>
                <FormField label="Rounds played">
                  <FormInput type="number" value={row.roundsPlayed} onChange={(v) => updateRoundsPlayed(row, v)} />
                </FormField>
                {row.isCurrent ? (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: "#1B4332",
                      background: "#DCEFE3",
                      borderRadius: 999,
                      padding: "4px 10px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Current
                  </span>
                ) : (
                  <button
                    onClick={() => handleSetCurrent(row)}
                    style={{
                      border: "1px solid #DCD6C4",
                      background: "#FFFFFF",
                      color: "#6B6455",
                      borderRadius: 999,
                      padding: "4px 10px",
                      fontSize: 10.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "'Inter', sans-serif",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Set current
                  </button>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10 }}>
            {showAddYear ? (
              <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <FormField label="New year">
                    <FormInput type="number" value={newYearInput} onChange={setNewYearInput} />
                  </FormField>
                </div>
                <button className="bco-save-btn" style={{ padding: "8px 14px", width: "auto" }} onClick={handleAddYear}>
                  Add
                </button>
                <button
                  onClick={() => setShowAddYear(false)}
                  style={{ border: "1px solid #DCD6C4", background: "#FFFFFF", color: "#6B6455", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "'Inter', sans-serif", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddYear(true)}
                style={{ border: "1px solid #1B4332", color: "#1B4332", background: "#FFFFFF", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
              >
                + Add year
              </button>
            )}
            {addYearError && (
              <div style={{ marginTop: 8 }}>
                <Banner tone="error">Couldn't create that year — try again.</Banner>
              </div>
            )}
            {!isLive && <div style={{ fontSize: 10, color: "#B4AE9E", marginTop: 8 }}>Not connected to Supabase — local to this session.</div>}
          </div>
        </SettingsSection>
      )}
    </div>
  );
}

function TeamSetupSettings({ onBack, isLive, currentYear }) {
  const idRef = useRef(1000);
  const nextId = () => ++idRef.current;

  // Team setup manages its own year, separate from the global Current
  // Year — you might be setting up next year's teams before this year's
  // event has even happened. Each year is its own real event_id, so last
  // year's teams are never affected by changing this year's pairs. New
  // years are added on Admin → Year settings, not here.
  const [years, setYears] = useState([currentYear]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedEventId, setSelectedEventId] = useState(null);

  const [teams, setTeams] = useState(TEAMS.map((t, i) => ({ id: i + 1, name: t.name, playerA: t.players[0], playerB: t.players[1] })));
  const [carrollRoster, setCarrollRoster] = useState(CARROLL_CUP_ROSTER_DEFAULT);
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);

  // Which players are actually competing in whichever year this screen is
  // configuring (not necessarily the global Current Year) — so the
  // Player A/B pickers only offer active players for that specific year.
  const [competedByPlayer, setCompetedByPlayer] = useState({}); // playerId -> [eventId, ...]

  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchAllPlayerCompetedYears();
        if (cancelled) return;
        const map = {};
        rows.forEach((r) => {
          if (!map[r.player_id]) map[r.player_id] = [];
          map[r.player_id].push(r.event_id);
        });
        setCompetedByPlayer(map);
      } catch (err) {
        console.error("Failed to load players' competed years:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive]);

  const playerNameToId = (name) => PLAYERS.find((p) => p.name === name)?.id;

  // Load the real list of years on record, so the dropdown reflects actual
  // events rather than just the current one.
  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    (async () => {
      try {
        const events = await fetchEvents();
        if (cancelled || events.length === 0) return;
        setYears(events.map((e) => e.year).sort((a, b) => b - a));
      } catch (err) {
        console.error("Failed to load events:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive]);

  // Resolve the real event_id for whichever year is selected, then load
  // that year's teams and Carroll Cup roster.
  useEffect(() => {
    if (!isLive) {
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    setLiveLoading(true);
    setLiveError(null);
    (async () => {
      try {
        const event = await fetchEventByYear(selectedYear);
        if (cancelled) return;
        if (!event) {
          setSelectedEventId(null);
          setTeams([]);
          setCarrollRoster({});
          return;
        }
        setSelectedEventId(event.id);
        const [dbTeams, dbRoster] = await Promise.all([fetchTeams(event.id), fetchCarrollCupRoster(event.id)]);
        if (cancelled) return;
        setTeams(
          dbTeams.map((t) => ({
            id: t.id,
            name: t.name,
            playerA: PLAYERS.find((p) => p.id === t.player_a_id)?.name || "",
            playerB: PLAYERS.find((p) => p.id === t.player_b_id)?.name || "",
          }))
        );
        const rosterMap = {};
        dbRoster.forEach((r) => {
          const name = PLAYERS.find((p) => p.id === r.player_id)?.name;
          if (name) rosterMap[name] = r.side;
        });
        setCarrollRoster(rosterMap);
      } catch (err) {
        console.error("Failed to load teams:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, selectedYear]);

  const updateTeamField = (id, field, value) => {
    setTeams((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, [field]: value } : t));
      if (isLive && selectedEventId) {
        const t = next.find((x) => x.id === id);
        updateTeam(id, { name: t.name, playerAId: playerNameToId(t.playerA), playerBId: playerNameToId(t.playerB) }).catch((err) =>
          console.error("Failed to update team:", err)
        );
      }
      return next;
    });
  };
  const addTeam = async () => {
    const name = `Team ${teams.length + 1}`;
    const playerA = PLAYERS[0]?.name || "";
    const playerB = PLAYERS[1]?.name || "";
    if (isLive && selectedEventId) {
      try {
        const id = await createTeam({ eventId: selectedEventId, name, playerAId: playerNameToId(playerA), playerBId: playerNameToId(playerB) });
        setTeams((prev) => [...prev, { id, name, playerA, playerB }]);
      } catch (err) {
        console.error("Failed to add team:", err);
      }
    } else {
      setTeams((prev) => [...prev, { id: nextId(), name, playerA, playerB }]);
    }
  };
  const removeTeam = (id) => {
    setTeams((prev) => prev.filter((t) => t.id !== id));
    if (isLive && selectedEventId) deleteTeam(id).catch((err) => console.error("Failed to remove team:", err));
  };

  const toggleCarroll = (playerName, side) => {
    setCarrollRoster((prev) => ({ ...prev, [playerName]: side }));
    if (isLive && selectedEventId) {
      const playerId = PLAYERS.find((p) => p.name === playerName)?.id;
      if (playerId) {
        upsertCarrollCupAssignment(selectedEventId, playerId, side).catch((err) => console.error("Failed to save Carroll Cup assignment:", err));
      }
    }
  };

  // Active for the year being configured — falls back to showing everyone
  // when offline or the data hasn't loaded yet, so the picker never goes
  // empty. A currently-assigned player stays visible even if they're not
  // active, so an existing pairing never silently disappears.
  const activePlayerNames = new Set(
    isLive && selectedEventId
      ? PLAYERS.filter((p) => (competedByPlayer[p.id] || []).includes(selectedEventId)).map((p) => p.name)
      : PLAYERS.map((p) => p.name)
  );
  const playerOptionsFor = (currentValue) => {
    const names = new Set(activePlayerNames);
    if (currentValue) names.add(currentValue);
    return PLAYERS.filter((p) => names.has(p.name)).map((p) => ({ value: p.name, label: p.name }));
  };
  const yearOptions = years.map((y) => ({ value: y, label: String(y) }));

  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 14 }}>
        <button onClick={onBack} style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", color: "#6B6455" }} aria-label="Back to Admin">
          <ChevronLeft size={18} />
        </button>
        <span className="bco-display" style={{ fontSize: 19, fontWeight: 600, color: "#1B4332" }}>
          Team setup
        </span>
      </div>

      <SettingsSection title="Year" description="Teams and Carroll Cup roster are saved per year — editing one year never touches another's history. Add new years on Admin → Year settings.">
        <FormField label="Year">
          <FormSelect value={selectedYear} onChange={(v) => setSelectedYear(Number(v))} options={yearOptions} />
        </FormField>
      </SettingsSection>

      {isLive && liveError && (
        <div style={{ marginBottom: 14 }}>
          <Banner tone="error">Couldn't load live teams ({liveError}) — showing local data instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 14 }}>Loading teams…</div>}
      {isLive && !liveLoading && !liveError && !selectedEventId && (
        <div style={{ fontSize: 12.5, color: "#B4AE9E", padding: "12px 0", marginBottom: 10 }}>
          No event found for {selectedYear} yet — add it above to start setting up teams.
        </div>
      )}

      {(!isLive || selectedEventId) && (
        <>
          <SettingsSection title="Team pairs" description="Who's paired together for Team leaderboard and match play.">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {teams.map((t) => (
                <div key={t.id} style={{ background: "#FFFFFF", border: "1px solid #E4DFCE", borderRadius: 10, padding: 12, position: "relative" }}>
                  <RemoveButton onClick={() => removeTeam(t.id)} />
                  <FormField label="Team name">
                    <FormInput value={t.name} onChange={(v) => updateTeamField(t.id, "name", v)} />
                  </FormField>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <FormField label="Player A">
                      <FormSelect value={t.playerA} onChange={(v) => updateTeamField(t.id, "playerA", v)} options={playerOptionsFor(t.playerA)} />
                    </FormField>
                    <FormField label="Player B">
                      <FormSelect value={t.playerB} onChange={(v) => updateTeamField(t.id, "playerB", v)} options={playerOptionsFor(t.playerB)} />
                    </FormField>
                  </div>
                </div>
              ))}
              <AddRowButton label="+ Add team" onClick={addTeam} />
            </div>
          </SettingsSection>

          <SettingsSection title="Carroll Cup teams" description="Assign every player to Red or Blue.">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {PLAYERS.filter((p) => activePlayerNames.has(p.name) || carrollRoster[p.name]).map((p) => {
                const side = carrollRoster[p.name];
                return (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "#FFFFFF",
                      border: "1px solid #E4DFCE",
                      borderRadius: 10,
                      padding: "8px 10px",
                    }}
                  >
                    <span style={{ fontSize: 13, color: "#2C2A22" }}>{p.name}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => toggleCarroll(p.name, "red")}
                        style={{
                          border: `1px solid ${side === "red" ? "#8C2F2A" : "#E4DFCE"}`,
                          background: side === "red" ? "#F7DCDA" : "#FFFFFF",
                          color: side === "red" ? "#8C2F2A" : "#8A8371",
                          borderRadius: 7,
                          padding: "4px 10px",
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "'Inter', sans-serif",
                        }}
                      >
                        Red
                      </button>
                      <button
                        onClick={() => toggleCarroll(p.name, "blue")}
                        style={{
                          border: `1px solid ${side === "blue" ? "#26456B" : "#E4DFCE"}`,
                          background: side === "blue" ? "#DCE7F2" : "#FFFFFF",
                          color: side === "blue" ? "#26456B" : "#8A8371",
                          borderRadius: 7,
                          padding: "4px 10px",
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "'Inter', sans-serif",
                        }}
                      >
                        Blue
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </SettingsSection>
        </>
      )}
    </div>
  );
}

function RoundSetupSettings({ onBack, isLive, currentYear, refreshRoundMap }) {
  const idRef = useRef(1000);
  const nextId = () => ++idRef.current;

  const [years, setYears] = useState([currentYear]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedEventId, setSelectedEventId] = useState(null);

  const [rounds, setRounds] = useState(() =>
    SCORE_ROUNDS.map((r) => ({
      id: nextId(),
      label: r,
      courseId: (ROUND_COURSE[r] || COURSES[0]).id,
      countsForSolo: true,
      countsForTeam: true,
      countsForCarrollCup: false,
      playFormat: "stroke",
      appliesSkins: true,
      appliesPoker: true,
      appliesLowNet: true,
      appliesCtp: true,
    }))
  );
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);

  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    (async () => {
      try {
        const events = await fetchEvents();
        if (cancelled || events.length === 0) return;
        setYears(events.map((e) => e.year).sort((a, b) => b - a));
      } catch (err) {
        console.error("Failed to load events:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive]);

  useEffect(() => {
    if (!isLive) {
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    setLiveLoading(true);
    setLiveError(null);
    (async () => {
      try {
        const event = await fetchEventByYear(selectedYear);
        if (cancelled) return;
        if (!event) {
          setSelectedEventId(null);
          setRounds([]);
          return;
        }
        setSelectedEventId(event.id);
        const dbRounds = await fetchRounds(event.id);
        if (cancelled) return;
        setRounds(
          dbRounds.map((r) => ({
            id: r.id,
            label: r.label,
            courseId: r.course_id,
            countsForSolo: r.counts_for_solo !== false,
            countsForTeam: r.counts_for_team !== false,
            countsForCarrollCup: r.counts_for_carroll_cup === true,
            playFormat: r.play_format || "stroke",
            appliesSkins: r.applies_skins !== false,
            appliesPoker: r.applies_poker !== false,
            appliesLowNet: r.applies_low_net !== false,
            appliesCtp: r.applies_ctp !== false,
          }))
        );
      } catch (err) {
        console.error("Failed to load rounds:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, selectedYear]);

  // Score/Matches only ever look at the globally active Current Year, so
  // there's no need to force a refresh if we're editing some other year's
  // rounds here — they wouldn't be reading from it anyway.
  const maybeRefresh = () => {
    if (selectedYear === currentYear) refreshRoundMap();
  };

  const addRound = async () => {
    const label = `R${rounds.length + 1}`;
    const courseId = (COURSES.find((c) => c.isActiveThisYear !== false) || COURSES[0]).id;
    if (isLive && selectedEventId) {
      try {
        const id = await createRound({ eventId: selectedEventId, label, courseId, roundOrder: rounds.length + 1 });
        setRounds((prev) => [...prev, { id, label, courseId, countsForSolo: true, countsForTeam: true, countsForCarrollCup: false, playFormat: "stroke", appliesSkins: true, appliesPoker: true, appliesLowNet: true, appliesCtp: true }]);
        maybeRefresh();
      } catch (err) {
        console.error("Failed to add round:", err);
      }
    } else {
      setRounds((prev) => [...prev, { id: nextId(), label, courseId, countsForSolo: true, countsForTeam: true, countsForCarrollCup: false, playFormat: "stroke", appliesSkins: true, appliesPoker: true, appliesLowNet: true, appliesCtp: true }]);
    }
  };
  const removeRound = (id) => {
    setRounds((prev) => prev.filter((r) => r.id !== id));
    if (isLive && selectedEventId) {
      deleteRound(id)
        .then(maybeRefresh)
        .catch((err) => console.error("Failed to remove round:", err));
    }
  };
  const updateRoundField = (id, field, value) => {
    setRounds((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, [field]: value } : r));
      if (isLive && selectedEventId) {
        const r = next.find((x) => x.id === id);
        updateRound(id, {
          label: r.label,
          courseId: r.courseId,
          countsForSolo: r.countsForSolo,
          countsForTeam: r.countsForTeam,
          countsForCarrollCup: r.countsForCarrollCup,
          playFormat: r.playFormat,
          appliesSkins: r.appliesSkins,
          appliesPoker: r.appliesPoker,
          appliesLowNet: r.appliesLowNet,
          appliesCtp: r.appliesCtp,
        })
          .then(maybeRefresh)
          .catch((err) => console.error("Failed to update round:", err));
      }
      return next;
    });
  };

  const activeCourseOptions = COURSES.filter((c) => c.isActiveThisYear !== false).map((c) => ({
    value: c.id,
    label: `${c.name} — ${c.tee} (${c.holesCount || c.holes.length || 18}h)`,
  }));

  const courseOptionsFor = (currentCourseId) => {
    if (activeCourseOptions.some((o) => o.value === currentCourseId)) return activeCourseOptions;
    // The round's current course isn't active this year — keep it visible in
    // its own row (labeled as such) rather than silently showing the wrong
    // course, but don't offer it for newly-assigned rounds.
    const inactive = COURSES.find((c) => c.id === currentCourseId);
    if (!inactive) return activeCourseOptions;
    return [{ value: inactive.id, label: `${inactive.name} — ${inactive.tee} (inactive this year)` }, ...activeCourseOptions];
  };

  const yearOptions = years.map((y) => ({ value: y, label: String(y) }));

  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 14 }}>
        <button onClick={onBack} style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", color: "#6B6455" }} aria-label="Back to Admin">
          <ChevronLeft size={18} />
        </button>
        <span className="bco-display" style={{ fontSize: 19, fontWeight: 600, color: "#1B4332" }}>
          Round setup
        </span>
      </div>

      <SettingsSection title="Year" description="Which year's rounds you're configuring. Add new years on Admin → Year settings.">
        <FormField label="Year">
          <FormSelect value={selectedYear} onChange={(v) => setSelectedYear(Number(v))} options={yearOptions} />
        </FormField>
      </SettingsSection>

      {isLive && liveError && (
        <div style={{ marginBottom: 14 }}>
          <Banner tone="error">Couldn't load live rounds ({liveError}) — showing local data instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 14 }}>Loading rounds…</div>}
      {isLive && !liveLoading && !liveError && !selectedEventId && (
        <div style={{ fontSize: 12.5, color: "#B4AE9E", padding: "12px 0", marginBottom: 10 }}>
          No event found for {selectedYear} yet — add it on Admin → Year settings first.
        </div>
      )}

      {(!isLive || selectedEventId) && (
        <SettingsSection
          title="Rounds"
          description="Almost all rounds are Solo and Team stroke/match play — the checkboxes below handle the edge cases where a round shouldn't roll up into one of those (or should also count toward Carroll Cup)."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rounds.map((r) => (
              <div key={r.id} style={{ background: "#FFFFFF", border: "1px solid #E4DFCE", borderRadius: 10, padding: 12, position: "relative" }}>
                <RemoveButton onClick={() => removeRound(r.id)} />
                <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 8, marginBottom: 10 }}>
                  <FormInput value={r.label} onChange={(v) => updateRoundField(r.id, "label", v)} />
                  <FormSelect value={r.courseId} onChange={(v) => updateRoundField(r.id, "courseId", Number(v))} options={courseOptionsFor(r.courseId)} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <FormField label="Play format">
                    <FormSelect
                      value={r.playFormat || "stroke"}
                      onChange={(v) => updateRoundField(r.id, "playFormat", v)}
                      options={[
                        { value: "stroke", label: "Stroke play" },
                        { value: "scramble", label: "Scramble" },
                        { value: "alternate_shot", label: "Alternate shot" },
                      ]}
                    />
                  </FormField>
                </div>
                <div style={{ fontSize: 9.5, fontWeight: 600, color: "#8A8371", letterSpacing: "0.03em", marginBottom: 6 }}>COUNTS TOWARD</div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2C2A22", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={r.countsForSolo}
                      onChange={(e) => updateRoundField(r.id, "countsForSolo", e.target.checked)}
                      style={{ accentColor: "#1B4332", width: 15, height: 15 }}
                    />
                    Solo
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2C2A22", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={r.countsForTeam}
                      onChange={(e) => updateRoundField(r.id, "countsForTeam", e.target.checked)}
                      style={{ accentColor: "#1B4332", width: 15, height: 15 }}
                    />
                    Team
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2C2A22", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={r.countsForCarrollCup}
                      onChange={(e) => updateRoundField(r.id, "countsForCarrollCup", e.target.checked)}
                      style={{ accentColor: "#1B4332", width: 15, height: 15 }}
                    />
                    Carroll Cup
                  </label>
                </div>

                <div style={{ fontSize: 9.5, fontWeight: 600, color: "#8A8371", letterSpacing: "0.03em", marginTop: 12, marginBottom: 6 }}>GAMES PLAYED THIS ROUND</div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2C2A22", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={r.appliesSkins}
                      onChange={(e) => updateRoundField(r.id, "appliesSkins", e.target.checked)}
                      style={{ accentColor: "#1B4332", width: 15, height: 15 }}
                    />
                    Skins
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2C2A22", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={r.appliesPoker}
                      onChange={(e) => updateRoundField(r.id, "appliesPoker", e.target.checked)}
                      style={{ accentColor: "#1B4332", width: 15, height: 15 }}
                    />
                    Poker
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2C2A22", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={r.appliesLowNet}
                      onChange={(e) => updateRoundField(r.id, "appliesLowNet", e.target.checked)}
                      style={{ accentColor: "#1B4332", width: 15, height: 15 }}
                    />
                    Low Net
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2C2A22", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={r.appliesCtp}
                      onChange={(e) => updateRoundField(r.id, "appliesCtp", e.target.checked)}
                      style={{ accentColor: "#1B4332", width: 15, height: 15 }}
                    />
                    CTP
                  </label>
                </div>
              </div>
            ))}
            <AddRowButton label="+ Add round" onClick={addRound} />
          </div>
        </SettingsSection>
      )}
    </div>
  );
}

function MatchupSetupSettings({ onBack, isLive, currentYear }) {
  const idRef = useRef(1000);
  const nextId = () => ++idRef.current;

  const [years, setYears] = useState([currentYear]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedEventId, setSelectedEventId] = useState(null);

  const [rounds, setRounds] = useState(() => SCORE_ROUNDS.map((r) => ({ id: nextId(), label: r, matchType: "team" })));
  const [teams, setTeams] = useState(TEAMS.map((t, i) => ({ id: i + 1, name: t.name })));
  const [matchups, setMatchups] = useState([]);
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);

  // Which players are active for the selected year — same idea as Team
  // setup's Player A/B pickers, so singles matchups only offer players
  // actually competing that year.
  const [competedByPlayer, setCompetedByPlayer] = useState({});

  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchAllPlayerCompetedYears();
        if (cancelled) return;
        const map = {};
        rows.forEach((r) => {
          if (!map[r.player_id]) map[r.player_id] = [];
          map[r.player_id].push(r.event_id);
        });
        setCompetedByPlayer(map);
      } catch (err) {
        console.error("Failed to load players' competed years:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive]);

  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    (async () => {
      try {
        const events = await fetchEvents();
        if (cancelled || events.length === 0) return;
        setYears(events.map((e) => e.year).sort((a, b) => b - a));
      } catch (err) {
        console.error("Failed to load events:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive]);

  useEffect(() => {
    if (!isLive) {
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    setLiveLoading(true);
    setLiveError(null);
    (async () => {
      try {
        const event = await fetchEventByYear(selectedYear);
        if (cancelled) return;
        if (!event) {
          setSelectedEventId(null);
          setRounds([]);
          setTeams([]);
          setMatchups([]);
          return;
        }
        setSelectedEventId(event.id);
        const [dbRounds, dbTeams, dbMatchups] = await Promise.all([fetchRounds(event.id), fetchTeams(event.id), fetchRoundMatchups(event.id)]);
        if (cancelled) return;
        setRounds(dbRounds.map((r) => ({ id: r.id, label: r.label, matchType: r.match_type || "team" })));
        setTeams(dbTeams.map((t) => ({ id: t.id, name: t.name })));
        setMatchups(
          dbMatchups.map((m) => ({
            id: m.id,
            roundId: m.roundId,
            matchType: m.matchType || "team",
            teamAId: m.teamAId,
            teamBId: m.teamBId,
            playerAId: m.playerAId,
            playerBId: m.playerBId,
          }))
        );
      } catch (err) {
        console.error("Failed to load matchups:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, selectedYear]);

  const addMatchup = async (round) => {
    const matchType = round.matchType || "team";
    const base =
      matchType === "singles"
        ? { matchType, playerAId: playersActive[0]?.id ?? null, playerBId: playersActive[1]?.id ?? null, teamAId: null, teamBId: null }
        : { matchType, teamAId: teams[0]?.id ?? null, teamBId: teams[1]?.id ?? null, playerAId: null, playerBId: null };
    if (matchType === "team" && teams.length < 2) return;
    if (matchType === "singles" && playersActive.length < 2) return;
    if (isLive) {
      try {
        const id = await createRoundMatchup({ roundId: round.id, ...base });
        setMatchups((prev) => [...prev, { id, roundId: round.id, ...base }]);
      } catch (err) {
        console.error("Failed to add matchup:", err);
      }
    } else {
      setMatchups((prev) => [...prev, { id: nextId(), roundId: round.id, ...base }]);
    }
  };
  const removeMatchup = (id) => {
    setMatchups((prev) => prev.filter((m) => m.id !== id));
    if (isLive) deleteRoundMatchup(id).catch((err) => console.error("Failed to remove matchup:", err));
  };
  const updateMatchupField = (id, field, value) => {
    setMatchups((prev) => {
      const next = prev.map((m) => (m.id === id ? { ...m, [field]: value } : m));
      if (isLive) {
        const m = next.find((x) => x.id === id);
        updateRoundMatchup(id, { matchType: m.matchType, teamAId: m.teamAId, teamBId: m.teamBId, playerAId: m.playerAId, playerBId: m.playerBId }).catch(
          (err) => console.error("Failed to update matchup:", err)
        );
      }
      return next;
    });
  };

  // Team/Single is set once per round and cascades to every matchup in it —
  // switching resets each matchup's picks to sensible defaults for the new
  // type, both locally and persisted.
  const updateRoundMatchType = (roundId, matchType) => {
    setRounds((prev) => prev.map((r) => (r.id === roundId ? { ...r, matchType } : r)));
    if (isLive) updateRound(roundId, { matchType }).catch((err) => console.error("Failed to update round match type:", err));

    setMatchups((prev) => {
      const next = prev.map((m) => {
        if (m.roundId !== roundId) return m;
        return matchType === "singles"
          ? { ...m, matchType, teamAId: null, teamBId: null, playerAId: playersActive[0]?.id ?? null, playerBId: playersActive[1]?.id ?? null }
          : { ...m, matchType, playerAId: null, playerBId: null, teamAId: teams[0]?.id ?? null, teamBId: teams[1]?.id ?? null };
      });
      if (isLive) {
        next
          .filter((m) => m.roundId === roundId)
          .forEach((m) => {
            updateRoundMatchup(m.id, { matchType: m.matchType, teamAId: m.teamAId, teamBId: m.teamBId, playerAId: m.playerAId, playerBId: m.playerBId }).catch(
              (err) => console.error("Failed to cascade match type to matchup:", err)
            );
          });
      }
      return next;
    });
  };

  const teamOptions = teams.map((t) => ({ value: t.id, label: t.name }));
  const playersActive =
    isLive && selectedEventId ? PLAYERS.filter((p) => (competedByPlayer[p.id] || []).includes(selectedEventId)) : PLAYERS;
  const playerOptionsFor = (currentValue) => {
    const ids = new Set(playersActive.map((p) => p.id));
    if (currentValue) ids.add(currentValue);
    return PLAYERS.filter((p) => ids.has(p.id)).map((p) => ({ value: p.id, label: p.name }));
  };
  const yearOptions = years.map((y) => ({ value: y, label: String(y) }));

  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 14 }}>
        <button onClick={onBack} style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", color: "#6B6455" }} aria-label="Back to Admin">
          <ChevronLeft size={18} />
        </button>
        <span className="bco-display" style={{ fontSize: 19, fontWeight: 600, color: "#1B4332" }}>
          Matchup setup
        </span>
      </div>

      <SettingsSection title="Year" description="Which year's matchups you're configuring. Add new years on Admin → Year settings.">
        <FormField label="Year">
          <FormSelect value={selectedYear} onChange={(v) => setSelectedYear(Number(v))} options={yearOptions} />
        </FormField>
      </SettingsSection>

      {isLive && liveError && (
        <div style={{ marginBottom: 14 }}>
          <Banner tone="error">Couldn't load live matchups ({liveError}) — showing local data instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 14 }}>Loading matchups…</div>}
      {isLive && !liveLoading && !liveError && !selectedEventId && (
        <div style={{ fontSize: 12.5, color: "#B4AE9E", padding: "12px 0", marginBottom: 10 }}>
          No event found for {selectedYear} yet — add it on Admin → Year settings first.
        </div>
      )}

      {!liveLoading && (!isLive || selectedEventId) && rounds.length === 0 && (
        <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "24px 12px" }}>
          No rounds set up yet for {selectedYear} — add rounds on Admin → Round setup first.
        </div>
      )}

      {!liveLoading && rounds.length > 0 && (
        <SettingsSection title="Matchups by round" description="Team or Single is set once per round and applies to every matchup in it — Single is for when the same two-player pairs aren't playing together. Which competitions a round counts toward is set on Round setup.">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {rounds.map((r) => {
              const roundMatchups = matchups.filter((m) => m.roundId === r.id);
              const isSingles = r.matchType === "singles";
              return (
                <div key={r.id} style={{ background: "#FFFFFF", border: "1px solid #E4DFCE", borderRadius: 10, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1B4332" }}>{r.label}</div>
                    <div className="bco-seg" style={{ maxWidth: 160 }}>
                      <button className={`bco-seg-btn${!isSingles ? " active" : ""}`} onClick={() => updateRoundMatchType(r.id, "team")}>
                        Team
                      </button>
                      <button className={`bco-seg-btn${isSingles ? " active" : ""}`} onClick={() => updateRoundMatchType(r.id, "singles")}>
                        Single
                      </button>
                    </div>
                  </div>

                  {roundMatchups.map((m) => (
                    <div key={m.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #F0ECDF" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 4 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 600, color: "#8A8371", letterSpacing: "0.03em" }}>HOME {isSingles ? "PLAYER" : "TEAM"}</div>
                        <div style={{ fontSize: 9.5, fontWeight: 600, color: "#8A8371", letterSpacing: "0.03em" }}>AWAY {isSingles ? "PLAYER" : "TEAM"}</div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6, alignItems: "center" }}>
                        {isSingles ? (
                          <>
                            <FormSelect value={m.playerAId} onChange={(v) => updateMatchupField(m.id, "playerAId", Number(v))} options={playerOptionsFor(m.playerAId)} />
                            <FormSelect value={m.playerBId} onChange={(v) => updateMatchupField(m.id, "playerBId", Number(v))} options={playerOptionsFor(m.playerBId)} />
                          </>
                        ) : (
                          <>
                            <FormSelect value={m.teamAId} onChange={(v) => updateMatchupField(m.id, "teamAId", Number(v))} options={teamOptions} />
                            <FormSelect value={m.teamBId} onChange={(v) => updateMatchupField(m.id, "teamBId", Number(v))} options={teamOptions} />
                          </>
                        )}
                        <button
                          onClick={() => removeMatchup(m.id)}
                          style={{ border: "none", background: "none", color: "#B4AE9E", cursor: "pointer", fontSize: 14, padding: 2 }}
                          aria-label="Remove matchup"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => addMatchup(r)}
                    disabled={isSingles ? playersActive.length < 2 : teams.length < 2}
                    style={{ border: "none", background: "none", color: "#1B4332", fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: "4px 0", fontFamily: "'Inter', sans-serif" }}
                  >
                    + Add matchup
                  </button>
                </div>
              );
            })}
          </div>
          {teams.length < 2 && <div style={{ fontSize: 10.5, color: "#B4AE9E", marginTop: 8 }}>Set up at least two teams on Team setup for Team matchups, or players for Single matchups.</div>}
        </SettingsSection>
      )}
    </div>
  );
}

function RemoveButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Remove"
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        border: "none",
        background: "none",
        color: "#B4AE9E",
        cursor: "pointer",
        fontSize: 16,
        lineHeight: 1,
        padding: 4,
      }}
    >
      ×
    </button>
  );
}

function AddRowButton({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "1px dashed #C9C2AC",
        background: "#FFFFFF",
        color: "#1B4332",
        borderRadius: 10,
        padding: "9px 0",
        fontSize: 12.5,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Game settings — buy-ins and pots for the daily cash games.
// ---------------------------------------------------------------------------
function GameSettings({ onBack, isLive, currentYear }) {
  const DEFAULTS = {
    skinsBuyIn: SKINS_SETTINGS.buyInPerPlayer,
    pokerBuyIn: 5,
    pokerThreePuttPenalty: 1,
    lowNetSoloBuyIn: 10,
    lowNetTeamBuyIn: 5,
    ctpPrize: 20,
  };
  const [years, setYears] = useState([currentYear]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [settings, setSettings] = useState(DEFAULTS);
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "saved" | "error"

  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    (async () => {
      try {
        const events = await fetchEvents();
        if (cancelled || events.length === 0) return;
        setYears(events.map((e) => e.year).sort((a, b) => b - a));
      } catch (err) {
        console.error("Failed to load events:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive]);

  useEffect(() => {
    if (!isLive) {
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    setLiveLoading(true);
    setLiveError(null);
    setSaveStatus(null);
    (async () => {
      try {
        const event = await fetchEventByYear(selectedYear);
        if (cancelled) return;
        if (!event) {
          setSelectedEventId(null);
          setSettings(DEFAULTS);
          return;
        }
        setSelectedEventId(event.id);
        const gs = await fetchGameSettings(event.id);
        if (cancelled) return;
        setSettings(
          gs
            ? {
                skinsBuyIn: Number(gs.skins_buy_in),
                pokerBuyIn: Number(gs.poker_buy_in),
                pokerThreePuttPenalty: Number(gs.poker_three_putt_buy_in),
                lowNetSoloBuyIn: Number(gs.low_net_solo_buy_in),
                lowNetTeamBuyIn: Number(gs.low_net_team_buy_in),
                ctpPrize: Number(gs.ctp_prize),
              }
            : DEFAULTS
        );
      } catch (err) {
        console.error("Failed to load game settings:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, selectedYear]);

  const update = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSaveStatus(null);
  };

  const handleSave = async () => {
    if (!isLive || !selectedEventId) return;
    setSaveStatus("saving");
    try {
      await upsertGameSettings(selectedEventId, settings);
      setSaveStatus("saved");
    } catch (err) {
      console.error("Failed to save game settings:", err);
      setSaveStatus("error");
    }
  };

  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 14 }}>
        <button onClick={onBack} style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", color: "#6B6455" }} aria-label="Back to Admin">
          <ChevronLeft size={18} />
        </button>
        <span className="bco-display" style={{ fontSize: 19, fontWeight: 600, color: "#1B4332" }}>
          Game settings
        </span>
      </div>

      <SettingsSection title="Year" description="Buy-ins and prizes are saved per year. Add new years on Admin → Year settings.">
        <FormField label="Year">
          <FormSelect value={selectedYear} onChange={(v) => setSelectedYear(Number(v))} options={years.map((y) => ({ value: y, label: String(y) }))} />
        </FormField>
      </SettingsSection>

      <AutoComputedNote>
        These drive the pot math shown on Games for {selectedYear} (Skins and Poker payouts read this directly; Low
        Net and CTP show it as context).
      </AutoComputedNote>

      {isLive && liveError && (
        <div style={{ marginBottom: 14 }}>
          <Banner tone="error">Couldn't load live game settings ({liveError}) — showing defaults instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 14 }}>Loading…</div>}
      {isLive && !liveLoading && !liveError && !selectedEventId && (
        <div style={{ fontSize: 12.5, color: "#B4AE9E", padding: "12px 0", marginBottom: 10 }}>
          No event found for {selectedYear} yet — add it on Admin → Year settings first.
        </div>
      )}
      {!isLive && (
        <div style={{ marginBottom: 14 }}>
          <Banner tone="error">Not connected to Supabase — changes here won't be saved.</Banner>
        </div>
      )}

      <SettingsSection title="Skins">
        <FormField label="Buy-in per player ($)">
          <FormInput type="number" value={settings.skinsBuyIn} onChange={(v) => update("skinsBuyIn", v)} />
        </FormField>
      </SettingsSection>

      <SettingsSection title="Putting Poker">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <FormField label="Buy-in ($)">
            <FormInput type="number" value={settings.pokerBuyIn} onChange={(v) => update("pokerBuyIn", v)} />
          </FormField>
          <FormField label="3-putt penalty ($)">
            <FormInput type="number" value={settings.pokerThreePuttPenalty} onChange={(v) => update("pokerThreePuttPenalty", v)} />
          </FormField>
        </div>
      </SettingsSection>

      <SettingsSection title="Low Net" description="Both are per-player buy-ins — a team's pot is the team buy-in × 2, since it's paid in by each player individually.">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <FormField label="Solo buy-in ($/player)">
            <FormInput type="number" value={settings.lowNetSoloBuyIn} onChange={(v) => update("lowNetSoloBuyIn", v)} />
          </FormField>
          <FormField label="Team buy-in ($/player)">
            <FormInput type="number" value={settings.lowNetTeamBuyIn} onChange={(v) => update("lowNetTeamBuyIn", v)} />
          </FormField>
        </div>
      </SettingsSection>

      <SettingsSection title="Closest to Pin">
        <FormField label="Prize per hole ($)">
          <FormInput type="number" value={settings.ctpPrize} onChange={(v) => update("ctpPrize", v)} />
        </FormField>
      </SettingsSection>

      {saveStatus === "saved" && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="success">Game settings saved for {currentYear}.</Banner>
        </div>
      )}
      {saveStatus === "error" && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't save — try again.</Banner>
        </div>
      )}
      <button className="bco-save-btn" onClick={handleSave} disabled={!isLive || !selectedEventId || saveStatus === "saving"}>
        {saveStatus === "saving" ? "Saving…" : "Save game settings"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import Results — CSV upload for historical scoring data. File structure
// still TBD; this wires up the interaction (pick file -> queue import) so
// the real parsing/mapping step can be dropped in later.
// ---------------------------------------------------------------------------
const IMPORT_HOLE_COUNT = 18;

function buildScoreImportTemplate() {
  const headers = ["Player", "Round", "Year"];
  for (let h = 1; h <= IMPORT_HOLE_COUNT; h++) headers.push(`H${h}_Strokes`, `H${h}_Putts`);
  const exampleA = ["Tyler Jessel", "R1", String(CURRENT_YEAR), ...Array(IMPORT_HOLE_COUNT * 2).fill("")];
  const exampleB = ["James Bublitz", "R1", String(CURRENT_YEAR), ...Array(IMPORT_HOLE_COUNT * 2).fill("")];
  return [headers, exampleA, exampleB].map((row) => row.join(",")).join("\n");
}

function buildPlayerImportTemplate() {
  const headers = ["Name", "Hometown", "Bio", "Year", "Handicap Index", "Competing"];
  const example = ["Jordan Smith", "Chicago, IL", "", String(CURRENT_YEAR), "12.5", "yes"];
  return [headers, example].map((row) => row.join(",")).join("\n");
}

function buildCourseImportTemplate() {
  const headers = ["Name", "Tee", "Rating", "Slope", "Holes"];
  for (let h = 1; h <= IMPORT_HOLE_COUNT; h++) headers.push(`H${h}_Par`, `H${h}_Yardage`, `H${h}_Hcp`);
  const example = ["Stonehedge East", "White", "70.2", "128", "18", ...Array(IMPORT_HOLE_COUNT * 3).fill("")];
  return [headers, example].map((row) => row.join(",")).join("\n");
}

function buildMatchupImportTemplate() {
  const headers = ["Year", "Round", "Home Team", "Away Team"];
  const exampleA = [String(CURRENT_YEAR), "R1", "CDL", "Boomers"];
  const exampleB = [String(CURRENT_YEAR), "R1", "Torch'em", "LFG"];
  return [headers, exampleA, exampleB].map((row) => row.join(",")).join("\n");
}

function buildTeamHoleImportTemplate() {
  const headers = ["Year", "Round", "Team"];
  for (let h = 1; h <= IMPORT_HOLE_COUNT; h++) headers.push(`H${h}_NetScore`, `H${h}_Points`);
  const exampleA = [String(CURRENT_YEAR), "R2", "CDL", ...Array(IMPORT_HOLE_COUNT * 2).fill("")];
  const exampleB = [String(CURRENT_YEAR), "R2", "Boomers", ...Array(IMPORT_HOLE_COUNT * 2).fill("")];
  return [headers, exampleA, exampleB].map((row) => row.join(",")).join("\n");
}

const IMPORT_TYPES = [
  { key: "scores", label: "Scores" },
  { key: "players", label: "Players" },
  { key: "courses", label: "Courses" },
  { key: "matchups", label: "Matchups" },
  { key: "teamHoles", label: "Team (Non-Stroke)" },
];

function ImportResults({ onBack, isLive }) {
  const [importType, setImportType] = useState("scores");
  const [fileName, setFileName] = useState(null);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(null); // null | "parsing" | "done" | "parse-error"
  const [result, setResult] = useState(null); // { totalRows, successCount, errors: [{row, message}] }

  const switchType = (type) => {
    setImportType(type);
    setFile(null);
    setFileName(null);
    setStatus(null);
    setResult(null);
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setFileName(f ? f.name : null);
    setStatus(null);
    setResult(null);
  };

  const handleDownloadTemplate = () => {
    const builders = {
      scores: buildScoreImportTemplate,
      players: buildPlayerImportTemplate,
      courses: buildCourseImportTemplate,
      matchups: buildMatchupImportTemplate,
      teamHoles: buildTeamHoleImportTemplate,
    };
    const csv = builders[importType]();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bco-${importType}-import-template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportScores = () => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        const rows = parsed.data;
        const errors = [];
        let successCount = 0;
        const eventCache = {}; // year -> event | null
        const roundCache = {}; // "eventId-label" -> roundId | null

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 2; // header is row 1
          const playerName = (row.Player || "").trim();
          const roundLabel = (row.Round || "").trim();
          const yearStr = (row.Year || "").trim();

          if (!playerName || !roundLabel || !yearStr) {
            errors.push({ row: rowNum, message: "Missing Player, Round, or Year." });
            continue;
          }

          const player = PLAYERS.find((p) => p.name.toLowerCase() === playerName.toLowerCase());
          if (!player) {
            errors.push({ row: rowNum, message: `Unknown player "${playerName}".` });
            continue;
          }

          const year = Number(yearStr);
          if (!(year in eventCache)) {
            try {
              eventCache[year] = await fetchEventByYear(year);
            } catch (err) {
              eventCache[year] = null;
            }
          }
          const event = eventCache[year];
          if (!event) {
            errors.push({ row: rowNum, message: `No event found for year ${year}.` });
            continue;
          }

          const roundCacheKey = `${event.id}-${roundLabel.toLowerCase()}`;
          if (!(roundCacheKey in roundCache)) {
            try {
              const rounds = await fetchRounds(event.id);
              const match = rounds.find((r) => r.label.toLowerCase() === roundLabel.toLowerCase());
              roundCache[roundCacheKey] = match ? match.id : null;
            } catch (err) {
              roundCache[roundCacheKey] = null;
            }
          }
          const roundId = roundCache[roundCacheKey];
          if (!roundId) {
            errors.push({ row: rowNum, message: `Round "${roundLabel}" not found for ${year}.` });
            continue;
          }

          const entries = {};
          let holeCount = 0;
          let badHole = null;
          for (let h = 1; h <= IMPORT_HOLE_COUNT; h++) {
            const strokesRaw = row[`H${h}_Strokes`];
            const puttsRaw = row[`H${h}_Putts`];
            if (strokesRaw != null && String(strokesRaw).trim() !== "") {
              const strokes = Number(strokesRaw);
              if (!Number.isFinite(strokes) || strokes <= 0) {
                badHole = h;
                break;
              }
              entries[h] = { strokes, putts: puttsRaw != null && String(puttsRaw).trim() !== "" ? Number(puttsRaw) : null };
              holeCount++;
            }
          }

          if (badHole) {
            errors.push({ row: rowNum, message: `Hole ${badHole} strokes must be a positive number.` });
            continue;
          }
          if (holeCount === 0) {
            errors.push({ row: rowNum, message: "No hole scores found in this row." });
            continue;
          }

          try {
            await upsertScores(roundId, player.id, entries);
            await upsertSubmission(roundId, player.id, "submitted");
            successCount++;
          } catch (err) {
            errors.push({ row: rowNum, message: `Save failed: ${err.message || err}` });
          }
        }

        setResult({ totalRows: rows.length, successCount, errors });
        setStatus("done");
      },
      error: (err) => {
        console.error("CSV parse error:", err);
        setStatus("parse-error");
      },
    });
  };

  const handleImportPlayers = () => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        const rows = parsed.data;
        const errors = [];
        let successCount = 0;
        const eventCache = {};

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 2;
          const name = (row.Name || "").trim();
          const yearStr = (row.Year || "").trim();
          const hiStr = (row["Handicap Index"] || "").trim();

          if (!name || !yearStr || !hiStr) {
            errors.push({ row: rowNum, message: "Missing Name, Year, or Handicap Index." });
            continue;
          }
          const handicapIndex = Number(hiStr);
          if (!Number.isFinite(handicapIndex)) {
            errors.push({ row: rowNum, message: "Handicap Index must be a number." });
            continue;
          }

          const year = Number(yearStr);
          if (!(year in eventCache)) {
            try {
              eventCache[year] = await fetchEventByYear(year);
            } catch (err) {
              eventCache[year] = null;
            }
          }
          const event = eventCache[year];
          if (!event) {
            errors.push({ row: rowNum, message: `No event found for year ${year}.` });
            continue;
          }

          const hometown = (row.Hometown || "").trim();
          const bio = (row.Bio || "").trim();
          const competingRaw = (row.Competing || "").trim().toLowerCase();
          const competing = competingRaw === "" ? true : competingRaw === "yes" || competingRaw === "true" || competingRaw === "1";

          try {
            const existing = PLAYERS.find((p) => p.name.toLowerCase() === name.toLowerCase());
            if (existing) {
              await updatePlayer(existing.id, { name: existing.name, hometown, bio });
              await updatePlayerHandicap(existing.id, event.id, handicapIndex);
              await setPlayerCompetedYear(existing.id, event.id, competing);
              Object.assign(existing, { hometown, bio, handicapIndex });
            } else {
              const id = await createPlayer({ name, handicapIndex, hometown, bio, eventId: event.id });
              await setPlayerCompetedYear(id, event.id, competing);
              PLAYERS.push({ id, name, handicapIndex, hometown, bio, competing: false, yearsCompeted: [] });
            }
            successCount++;
          } catch (err) {
            errors.push({ row: rowNum, message: `Save failed: ${err.message || err}` });
          }
        }

        setResult({ totalRows: rows.length, successCount, errors });
        setStatus("done");
      },
      error: (err) => {
        console.error("CSV parse error:", err);
        setStatus("parse-error");
      },
    });
  };

  const handleImportCourses = () => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        const rows = parsed.data;
        const errors = [];
        let successCount = 0;

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 2;
          const name = (row.Name || "").trim();
          const tee = (row.Tee || "").trim();
          const ratingStr = (row.Rating || "").trim();
          const slopeStr = (row.Slope || "").trim();
          const holesCount = Number((row.Holes || "18").trim()) === 9 ? 9 : 18;

          if (!name || !tee || !ratingStr || !slopeStr) {
            errors.push({ row: rowNum, message: "Missing Name, Tee, Rating, or Slope." });
            continue;
          }
          const rating = Number(ratingStr);
          const slope = Number(slopeStr);
          if (!Number.isFinite(rating) || !Number.isFinite(slope)) {
            errors.push({ row: rowNum, message: "Rating and Slope must be numbers." });
            continue;
          }

          const existing = COURSES.find((c) => c.name.toLowerCase() === name.toLowerCase() && c.tee.toLowerCase() === tee.toLowerCase());
          if (existing) {
            errors.push({ row: rowNum, message: `"${name} — ${tee}" already exists — skipped (import never overwrites existing hole data).` });
            continue;
          }

          const holes = [];
          let badHole = null;
          for (let h = 1; h <= holesCount; h++) {
            const par = Number(row[`H${h}_Par`]);
            const yardage = Number(row[`H${h}_Yardage`]);
            const handicap = Number(row[`H${h}_Hcp`]);
            if (![3, 4, 5].includes(par) || !Number.isFinite(yardage) || yardage <= 0 || !Number.isFinite(handicap) || handicap < 1 || handicap > holesCount) {
              badHole = h;
              break;
            }
            holes.push({ number: h, par, yardage, handicap });
          }
          if (badHole) {
            errors.push({ row: rowNum, message: `Hole ${badHole} data is missing or invalid (par 3/4/5, positive yardage, handicap 1–${holesCount}).` });
            continue;
          }
          if (new Set(holes.map((h) => h.handicap)).size !== holesCount) {
            errors.push({ row: rowNum, message: `Handicap ranks must be ${holesCount} unique values from 1–${holesCount}.` });
            continue;
          }

          try {
            const courseId = await createCourse({ name, tee, rating, slope, holesCount });
            await createCourseHoles(courseId, holes);
            COURSES.push({ id: courseId, name, tee, rating, slope, holesCount, playedEventId: null, holes });
            successCount++;
          } catch (err) {
            errors.push({ row: rowNum, message: `Save failed: ${err.message || err}` });
          }
        }

        setResult({ totalRows: rows.length, successCount, errors });
        setStatus("done");
      },
      error: (err) => {
        console.error("CSV parse error:", err);
        setStatus("parse-error");
      },
    });
  };

  const handleImportMatchups = () => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        const rows = parsed.data;
        const errors = [];
        let successCount = 0;
        const eventCache = {}; // year -> event | null
        const roundCache = {}; // "eventId-label" -> roundId | null
        const teamsCache = {}; // eventId -> [{id, name}]
        const matchupsCache = {}; // eventId -> live matchups, kept in sync as rows are imported

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 2;
          const yearStr = (row.Year || "").trim();
          const roundLabel = (row.Round || "").trim();
          const homeName = (row["Home Team"] || "").trim();
          const awayName = (row["Away Team"] || "").trim();

          if (!yearStr || !roundLabel || !homeName || !awayName) {
            errors.push({ row: rowNum, message: "Missing Year, Round, Home Team, or Away Team." });
            continue;
          }
          if (homeName.toLowerCase() === awayName.toLowerCase()) {
            errors.push({ row: rowNum, message: "Home Team and Away Team can't be the same." });
            continue;
          }

          const year = Number(yearStr);
          if (!(year in eventCache)) {
            try {
              eventCache[year] = await fetchEventByYear(year);
            } catch (err) {
              eventCache[year] = null;
            }
          }
          const event = eventCache[year];
          if (!event) {
            errors.push({ row: rowNum, message: `No event found for year ${year}.` });
            continue;
          }

          const roundKey = `${event.id}-${roundLabel.toLowerCase()}`;
          if (!(roundKey in roundCache)) {
            try {
              const rounds = await fetchRounds(event.id);
              const match = rounds.find((r) => r.label.toLowerCase() === roundLabel.toLowerCase());
              roundCache[roundKey] = match ? match.id : null;
            } catch (err) {
              roundCache[roundKey] = null;
            }
          }
          const roundId = roundCache[roundKey];
          if (!roundId) {
            errors.push({ row: rowNum, message: `Round "${roundLabel}" not found for ${year}.` });
            continue;
          }

          if (!(event.id in teamsCache)) {
            try {
              teamsCache[event.id] = await fetchTeams(event.id);
            } catch (err) {
              teamsCache[event.id] = [];
            }
          }
          const teams = teamsCache[event.id];
          const homeTeam = teams.find((t) => t.name.toLowerCase() === homeName.toLowerCase());
          const awayTeam = teams.find((t) => t.name.toLowerCase() === awayName.toLowerCase());
          if (!homeTeam) {
            errors.push({ row: rowNum, message: `Unknown team "${homeName}" for ${year}.` });
            continue;
          }
          if (!awayTeam) {
            errors.push({ row: rowNum, message: `Unknown team "${awayName}" for ${year}.` });
            continue;
          }

          if (!(event.id in matchupsCache)) {
            try {
              matchupsCache[event.id] = await fetchRoundMatchups(event.id);
            } catch (err) {
              matchupsCache[event.id] = [];
            }
          }
          const alreadyExists = matchupsCache[event.id].some(
            (m) =>
              m.roundId === roundId &&
              ((m.teamAId === homeTeam.id && m.teamBId === awayTeam.id) || (m.teamAId === awayTeam.id && m.teamBId === homeTeam.id))
          );
          if (alreadyExists) {
            errors.push({ row: rowNum, message: `Matchup already exists for ${roundLabel} (${homeName} vs ${awayName}) — skipped.` });
            continue;
          }

          try {
            const id = await createRoundMatchup({ roundId, teamAId: homeTeam.id, teamBId: awayTeam.id });
            matchupsCache[event.id].push({ id, roundId, roundLabel, teamAId: homeTeam.id, teamBId: awayTeam.id });
            successCount++;
          } catch (err) {
            errors.push({ row: rowNum, message: `Save failed: ${err.message || err}` });
          }
        }

        setResult({ totalRows: rows.length, successCount, errors });
        setStatus("done");
      },
      error: (err) => {
        console.error("CSV parse error:", err);
        setStatus("parse-error");
      },
    });
  };

  const handleImportTeamHoles = () => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        const rows = parsed.data;
        const errors = [];
        let successCount = 0;
        const eventCache = {};
        const roundCache = {};
        const teamsCache = {};

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 2;
          const yearStr = (row.Year || "").trim();
          const roundLabel = (row.Round || "").trim();
          const teamName = (row.Team || "").trim();

          if (!yearStr || !roundLabel || !teamName) {
            errors.push({ row: rowNum, message: "Missing Year, Round, or Team." });
            continue;
          }

          const year = Number(yearStr);
          if (!(year in eventCache)) {
            try {
              eventCache[year] = await fetchEventByYear(year);
            } catch (err) {
              eventCache[year] = null;
            }
          }
          const event = eventCache[year];
          if (!event) {
            errors.push({ row: rowNum, message: `No event found for year ${year}.` });
            continue;
          }

          const roundKey = `${event.id}-${roundLabel.toLowerCase()}`;
          if (!(roundKey in roundCache)) {
            try {
              const rounds = await fetchRounds(event.id);
              const match = rounds.find((r) => r.label.toLowerCase() === roundLabel.toLowerCase());
              roundCache[roundKey] = match ? match.id : null;
            } catch (err) {
              roundCache[roundKey] = null;
            }
          }
          const roundId = roundCache[roundKey];
          if (!roundId) {
            errors.push({ row: rowNum, message: `Round "${roundLabel}" not found for ${year}.` });
            continue;
          }

          if (!(event.id in teamsCache)) {
            try {
              teamsCache[event.id] = await fetchTeams(event.id);
            } catch (err) {
              teamsCache[event.id] = [];
            }
          }
          const team = teamsCache[event.id].find((t) => t.name.toLowerCase() === teamName.toLowerCase());
          if (!team) {
            errors.push({ row: rowNum, message: `Unknown team "${teamName}" for ${year}.` });
            continue;
          }

          let holeCount = 0;
          let badHole = null;
          const holeUpdates = [];
          for (let h = 1; h <= IMPORT_HOLE_COUNT; h++) {
            const netRaw = row[`H${h}_NetScore`];
            const ptsRaw = row[`H${h}_Points`];
            if (netRaw == null || String(netRaw).trim() === "") continue;
            const netScore = Number(netRaw);
            const points = ptsRaw != null && String(ptsRaw).trim() !== "" ? Number(ptsRaw) : null;
            if (!Number.isFinite(netScore) || (points != null && ![0, 0.5, 1].includes(points))) {
              badHole = h;
              break;
            }
            holeUpdates.push({ hole: h, netScore, points });
            holeCount++;
          }

          if (badHole) {
            errors.push({ row: rowNum, message: `Hole ${badHole}: Net Score must be a number, Points must be 0, 0.5, or 1.` });
            continue;
          }
          if (holeCount === 0) {
            errors.push({ row: rowNum, message: "No hole data found in this row." });
            continue;
          }

          try {
            for (const hu of holeUpdates) {
              await upsertTeamHoleResult(roundId, team.id, hu.hole, { netScore: hu.netScore, points: hu.points });
            }
            successCount++;
          } catch (err) {
            errors.push({ row: rowNum, message: `Save failed: ${err.message || err}` });
          }
        }

        setResult({ totalRows: rows.length, successCount, errors });
        setStatus("done");
      },
      error: (err) => {
        console.error("CSV parse error:", err);
        setStatus("parse-error");
      },
    });
  };

  const handleImport = () => {
    if (!file || !isLive) return;
    setStatus("parsing");
    setResult(null);
    if (importType === "scores") handleImportScores();
    else if (importType === "players") handleImportPlayers();
    else if (importType === "courses") handleImportCourses();
    else if (importType === "matchups") handleImportMatchups();
    else handleImportTeamHoles();
  };

  const DESCRIPTIONS = {
    scores: (
      <>
        One row per player, per round: name, round label, year, then strokes and putts for holes 1–18 (leave extra
        holes blank for a 9-hole round). Each row is upserted into <code>scores</code> and marked{" "}
        <code>submitted</code> — this is for backfilling finished rounds, not partial in-progress ones.
      </>
    ),
    players: (
      <>
        One row per player: name, hometown, bio, the year this handicap applies to, handicap index, and whether
        they're competing (yes/no, defaults to yes). Matches existing players by name — if found, updates their info
        and that year's handicap; if not, creates a new player.
      </>
    ),
    courses: (
      <>
        One row per course-tee: name, tee, rating, slope, hole count (9 or 18), then par/yardage/handicap for holes
        1–18 (leave extra holes blank for a 9-hole course). Only creates <em>new</em> course-tees — if a course with
        the same name and tee already exists, that row is skipped rather than overwriting its hole data.
      </>
    ),
    matchups: (
      <>
        One row per matchup: year, round label, Home Team, Away Team — both team names must already exist for that
        year (set them up on Team setup first). Skips a row if that exact matchup (either team as home or away)
        already exists for the round, so re-running the same file is safe.
      </>
    ),
    teamHoles: (
      <>
        For scramble/alternate-shot rounds: one row per team, per round — year, round label, team name, then Net
        Score and Points (0, 0.5, or 1) for holes 1–18 (leave holes blank as needed). The round must already be set
        to a non-stroke Play format on Round setup. Re-running overwrites that team's saved values for the round.
      </>
    ),
  };

  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 14 }}>
        <button onClick={onBack} style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", color: "#6B6455" }} aria-label="Back to Admin">
          <ChevronLeft size={18} />
        </button>
        <span className="bco-display" style={{ fontSize: 19, fontWeight: 600, color: "#1B4332" }}>
          Import results
        </span>
      </div>

      <div className="bco-seg" style={{ marginBottom: 14 }}>
        {IMPORT_TYPES.map((t) => (
          <button key={t.key} className={`bco-seg-btn${importType === t.key ? " active" : ""}`} onClick={() => switchType(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <AutoComputedNote>{DESCRIPTIONS[importType]}</AutoComputedNote>

      <button
        onClick={handleDownloadTemplate}
        style={{
          width: "100%",
          border: "1px solid #1B4332",
          color: "#1B4332",
          background: "#FFFFFF",
          borderRadius: 10,
          padding: "11px",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "'Inter', sans-serif",
          marginBottom: 14,
        }}
      >
        Download {importType} import template (.csv)
      </button>

      {!isLive && (
        <div style={{ marginBottom: 14 }}>
          <Banner tone="error">Not connected to Supabase — importing needs a live connection. See the README for setup.</Banner>
        </div>
      )}

      <div style={{ background: "#FFFFFF", border: "1px dashed #C9C2AC", borderRadius: 12, padding: 20, textAlign: "center" }}>
        <input type="file" id="csv-upload" accept=".csv" style={{ display: "none" }} onChange={handleFileChange} />
        <label
          htmlFor="csv-upload"
          style={{
            display: "inline-block",
            border: "1px solid #1B4332",
            color: "#1B4332",
            borderRadius: 8,
            padding: "9px 16px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Choose CSV file
        </label>
        <div style={{ fontSize: 12, color: fileName ? "#2C2A22" : "#B4AE9E", marginTop: 10 }}>
          {fileName || "No file selected"}
        </div>
      </div>

      {status === "parse-error" && (
        <div style={{ marginTop: 12 }}>
          <Banner tone="error">Couldn't parse that file — make sure it's a valid CSV.</Banner>
        </div>
      )}

      {status === "done" && result && (
        <div style={{ marginTop: 12 }}>
          <Banner tone={result.errors.length === 0 ? "success" : "error"}>
            Imported {result.successCount} of {result.totalRows} row{result.totalRows !== 1 ? "s" : ""}.
            {result.errors.length > 0 && ` ${result.errors.length} row${result.errors.length !== 1 ? "s" : ""} skipped.`}
          </Banner>
          {result.errors.length > 0 && (
            <div style={{ marginTop: 8, maxHeight: 200, overflowY: "auto", border: "1px solid #E4DFCE", borderRadius: 10, background: "#FFFFFF" }}>
              {result.errors.map((e, i) => (
                <div
                  key={i}
                  style={{ fontSize: 11.5, color: "#6B6455", padding: "7px 10px", borderBottom: i < result.errors.length - 1 ? "1px solid #EFEBDE" : "none" }}
                >
                  <span className="bco-mono" style={{ fontWeight: 600, color: "#8C2F2A" }}>
                    Row {e.row}:
                  </span>{" "}
                  {e.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button className="bco-save-btn" style={{ marginTop: 14 }} onClick={handleImport} disabled={!fileName || !isLive || status === "parsing"}>
        {status === "parsing" ? "Importing…" : "Import CSV"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Players — roster with bios and handicap index. This screen edits a local
// copy of PLAYERS for now; once the players table is real, handicapIndex set
// here becomes the single source of truth Score/Matches read from.
// ---------------------------------------------------------------------------
function PlayersScreen({ onBack, isLive, currentEventId, currentYear }) {
  const [players, setPlayers] = useState(PLAYERS);
  const [expanded, setExpanded] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", handicapIndex: "", hometown: "", bio: "" });
  const [addStatus, setAddStatus] = useState(null); // null | "saving" | "error"
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editStatus, setEditStatus] = useState(null); // null | "saving" | "error"
  const [editError, setEditError] = useState(null);

  // Handicap-by-year — years come from real events (like Year settings);
  // each player's history is lazy-loaded the first time their card opens.
  const [years, setYears] = useState([]);
  const [handicapsByPlayer, setHandicapsByPlayer] = useState({}); // playerId -> { eventId: finalIndex }
  const [handicapLoading, setHandicapLoading] = useState({}); // playerId -> bool
  const [handicapSaving, setHandicapSaving] = useState({}); // "playerId-eventId" -> "saving" | "error"
  const [competedYearsByPlayer, setCompetedYearsByPlayer] = useState({}); // playerId -> [eventId, ...]
  const [competedSaving, setCompetedSaving] = useState({}); // "playerId-eventId" -> "saving" | "error"
  const [filterYears, setFilterYears] = useState([]); // selected event ids — multi-select, empty = show all

  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchAllPlayerCompetedYears();
        if (cancelled) return;
        const map = {};
        rows.forEach((r) => {
          if (!map[r.player_id]) map[r.player_id] = [];
          map[r.player_id].push(r.event_id);
        });
        setCompetedYearsByPlayer((prev) => ({ ...map, ...prev }));
      } catch (err) {
        console.error("Failed to load players' competed years:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive]);

  const toggleFilterYear = (eventId) => {
    setFilterYears((prev) => (prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]));
  };

  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    (async () => {
      try {
        const events = await fetchEvents();
        if (cancelled) return;
        setYears(events.map((e) => ({ id: e.id, year: e.year })).sort((a, b) => b.year - a.year));
      } catch (err) {
        console.error("Failed to load events:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive]);

  const loadPlayerHandicaps = async (playerId) => {
    if (!isLive || handicapsByPlayer[playerId]) return;
    setHandicapLoading((prev) => ({ ...prev, [playerId]: true }));
    try {
      const [rows, competedYears] = await Promise.all([fetchPlayerHandicaps(playerId), fetchPlayerCompetedYears(playerId)]);
      const map = {};
      rows.forEach((r) => {
        map[r.event_id] = r.final_index;
      });
      setHandicapsByPlayer((prev) => ({ ...prev, [playerId]: map }));
      setCompetedYearsByPlayer((prev) => ({ ...prev, [playerId]: competedYears }));
    } catch (err) {
      console.error("Failed to load handicap history:", err);
    } finally {
      setHandicapLoading((prev) => ({ ...prev, [playerId]: false }));
    }
  };

  const toggleYearCompetedLive = async (player, yearRow) => {
    const current = competedYearsByPlayer[player.id] || [];
    const next = current.includes(yearRow.id) ? current.filter((id) => id !== yearRow.id) : [...current, yearRow.id];
    setCompetedYearsByPlayer((prev) => ({ ...prev, [player.id]: next }));
    const key = `${player.id}-${yearRow.id}`;
    setCompetedSaving((prev) => ({ ...prev, [key]: "saving" }));
    try {
      await setPlayerCompetedYear(player.id, yearRow.id, !current.includes(yearRow.id));
      setCompetedSaving((prev) => ({ ...prev, [key]: null }));
    } catch (err) {
      console.error("Failed to save competed year:", err);
      setCompetedSaving((prev) => ({ ...prev, [key]: "error" }));
      // Revert the optimistic update since the save failed.
      setCompetedYearsByPlayer((prev) => ({ ...prev, [player.id]: current }));
    }
  };

  const saveHandicapForYear = async (player, yearRow, value) => {
    const finalIndex = value === "" ? null : Number(value);
    if (finalIndex != null && !Number.isFinite(finalIndex)) return;
    const key = `${player.id}-${yearRow.id}`;
    setHandicapsByPlayer((prev) => ({ ...prev, [player.id]: { ...prev[player.id], [yearRow.id]: finalIndex } }));
    if (!isLive || finalIndex == null) return;
    setHandicapSaving((prev) => ({ ...prev, [key]: "saving" }));
    try {
      await updatePlayerHandicap(player.id, yearRow.id, finalIndex);
      setHandicapSaving((prev) => ({ ...prev, [key]: null }));
      // Keep the flat handicapIndex (used everywhere else in the app — Score
      // entry, leaderboards, etc.) in sync when editing the currently active
      // year specifically. Editing other years' history doesn't touch it.
      if (yearRow.year === currentYear) {
        player.handicapIndex = finalIndex;
        setPlayers((prev) => [...prev]);
      }
    } catch (err) {
      console.error("Failed to save handicap:", err);
      setHandicapSaving((prev) => ({ ...prev, [key]: "error" }));
    }
  };

  const sorted = [...players]
    .filter((p) => filterYears.length === 0 || filterYears.some((fy) => (competedYearsByPlayer[p.id] || []).includes(fy)))
    .sort((a, b) => a.name.localeCompare(b.name));

  const updateForm = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const startEdit = (player) => {
    setEditingId(player.id);
    setEditForm({
      name: player.name,
      hometown: player.hometown || "",
      bio: player.bio || "",
    });
    setEditStatus(null);
    setEditError(null);
  };
  const updateEditForm = (field, value) => setEditForm((prev) => ({ ...prev, [field]: value }));

  const saveEdit = async (player) => {
    if (!editForm.name.trim()) return;
    const updates = {
      name: editForm.name.trim(),
      hometown: editForm.hometown.trim(),
      bio: editForm.bio.trim(),
    };

    if (isLive && currentEventId) {
      setEditStatus("saving");
      setEditError(null);
      try {
        await updatePlayer(player.id, updates);
      } catch (err) {
        console.error("Failed to update player:", err);
        setEditStatus("error");
        setEditError(err?.message || err?.error_description || err?.hint || String(err));
        return;
      }
    }

    // Mutate the shared player object in place — same pattern as the
    // competing toggle — so Score entry and everywhere else picks this up.
    Object.assign(player, updates);
    setPlayers((prev) => [...prev]);
    setEditingId(null);
    setEditForm(null);
    setEditStatus(null);
  };

  const handleAdd = async () => {
    if (!form.name.trim() || !form.handicapIndex) return;

    const base = {
      name: form.name.trim(),
      handicapIndex: Number(form.handicapIndex),
      hometown: form.hometown.trim(),
      bio: form.bio.trim(),
      competing: true,
      yearsCompeted: [], // wireframe only for now — toggle after adding
    };

    if (isLive && currentEventId) {
      setAddStatus("saving");
      try {
        const id = await createPlayer({ ...base, eventId: currentEventId });
        const newPlayer = { id, ...base };
        PLAYERS.push(newPlayer); // so Score entry's dropdown sees it immediately
        setPlayers((prev) => [...prev, newPlayer]);
        setAddStatus(null);
      } catch (err) {
        console.error("Failed to add player:", err);
        setAddStatus("error");
        return; // leave the form open so nothing's lost
      }
    } else {
      const nextId = Math.max(0, ...players.map((p) => p.id)) + 1;
      const newPlayer = { id: nextId, ...base };
      PLAYERS.push(newPlayer);
      setPlayers((prev) => [...prev, newPlayer]);
    }

    setForm({ name: "", handicapIndex: "", hometown: "", bio: "" });
    setShowForm(false);
  };

  // Offline fallback (no Supabase connection) — local-only, keyed by plain
  // year number rather than a real event id.
  const toggleYearCompetedOffline = (targetPlayer, year) => {
    const current = targetPlayer.yearsCompeted || [];
    targetPlayer.yearsCompeted = current.includes(year) ? current.filter((y) => y !== year) : [...current, year].sort((a, b) => a - b);
    setPlayers((prev) => [...prev]);
  };

  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 14 }}>
        <button onClick={onBack} style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", color: "#6B6455" }} aria-label="Back to More">
          <ChevronLeft size={18} />
        </button>
        <span className="bco-display" style={{ fontSize: 19, fontWeight: 600, color: "#1B4332", flex: 1 }}>
          Players
        </span>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            border: "1px solid #1B4332",
            color: "#1B4332",
            background: showForm ? "#1B4332" : "#FFFFFF",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {showForm ? "Cancel" : "+ Add player"}
        </button>
      </div>

      {!showForm && isLive && years.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: "#8A8371", letterSpacing: "0.03em", marginBottom: 6 }}>FILTER BY YEARS COMPETED</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {years.map((yearRow) => {
              const active = filterYears.includes(yearRow.id);
              return (
                <button
                  key={yearRow.id}
                  onClick={() => toggleFilterYear(yearRow.id)}
                  className="bco-mono"
                  style={{
                    border: `1px solid ${active ? "#1B4332" : "#E4DFCE"}`,
                    background: active ? "#1B4332" : "#FFFFFF",
                    color: active ? "#F3EFE2" : "#6B6455",
                    borderRadius: 999,
                    padding: "5px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {yearRow.year}
                </button>
              );
            })}
            {filterYears.length > 0 && (
              <button
                onClick={() => setFilterYears([])}
                style={{ border: "none", background: "none", color: "#8A8371", fontSize: 11.5, cursor: "pointer", fontFamily: "'Inter', sans-serif", padding: "5px 6px" }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <div style={{ background: "#FFFFFF", border: "1px solid #E4DFCE", borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <FormField label="Name">
            <FormInput value={form.name} onChange={(v) => updateForm("name", v)} placeholder="Full name" />
          </FormField>
          <FormField label={`Handicap index (${currentYear})`}>
            <FormInput value={form.handicapIndex} onChange={(v) => updateForm("handicapIndex", v)} placeholder="e.g. 9.6" type="number" />
          </FormField>
          <FormField label="Hometown">
            <FormInput value={form.hometown} onChange={(v) => updateForm("hometown", v)} placeholder="City, State" />
          </FormField>
          <FormField label="Bio">
            <textarea
              value={form.bio}
              onChange={(e) => updateForm("bio", e.target.value)}
              placeholder="One line about their game"
              rows={2}
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid #DCD6C4",
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 13,
                fontFamily: "'Inter', sans-serif",
                resize: "none",
              }}
            />
          </FormField>
          {addStatus === "error" && (
            <div style={{ marginBottom: 8 }}>
              <Banner tone="error">Couldn't save to Supabase — check the console. Nothing was lost, try again.</Banner>
            </div>
          )}
          <button
            className="bco-save-btn"
            style={{ marginTop: 4 }}
            onClick={handleAdd}
            disabled={!form.name.trim() || !form.handicapIndex || addStatus === "saving"}
          >
            {addStatus === "saving" ? "Saving…" : "Add player"}
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sorted.map((p) => {
          const isOpen = expanded === p.id;
          const initials = p.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
          return (
            <div key={p.id} style={{ background: "#FFFFFF", border: "1px solid #E4DFCE", borderRadius: 12, overflow: "hidden" }}>
              <button
                onClick={() => {
                  setExpanded((prev) => (prev === p.id ? null : p.id));
                  loadPlayerHandicaps(p.id);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 14px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    background: p.competing === false ? "#B9B3A2" : "#1B4332",
                    color: "#F3EFE2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#2C2A22" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "#8A8371", marginTop: 1 }}>
                    {p.hometown}
                    {p.competing === false && (
                      <span style={{ color: "#A3492E", fontWeight: 600 }}>{p.hometown ? " · " : ""}Not competing</span>
                    )}
                  </div>
                </div>
                <span
                  className="bco-mono"
                  style={{ fontSize: 12, fontWeight: 600, color: "#1B4332", background: "#DCEFE3", borderRadius: 999, padding: "3px 9px" }}
                >
                  HI {p.handicapIndex.toFixed(1)}
                </span>
                <ChevronRight size={15} color="#B9B3A2" style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s ease" }} />
              </button>

              {isOpen && (
                <div style={{ padding: "0 14px 14px", borderTop: "1px solid #EFEBDE" }}>
                  {editingId === p.id ? (
                    <div style={{ marginTop: 10 }}>
                      <FormField label="Name">
                        <FormInput value={editForm.name} onChange={(v) => updateEditForm("name", v)} />
                      </FormField>
                      <FormField label="Hometown">
                        <FormInput value={editForm.hometown} onChange={(v) => updateEditForm("hometown", v)} />
                      </FormField>
                      <FormField label="Bio">
                        <textarea
                          value={editForm.bio}
                          onChange={(e) => updateEditForm("bio", e.target.value)}
                          rows={2}
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            border: "1px solid #DCD6C4",
                            borderRadius: 8,
                            padding: "8px 10px",
                            fontSize: 13,
                            fontFamily: "'Inter', sans-serif",
                            resize: "none",
                          }}
                        />
                      </FormField>
                      {editStatus === "error" && (
                        <div style={{ marginBottom: 8 }}>
                          <Banner tone="error">Couldn't save: {editError || "unknown error — check the console"}</Banner>
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditForm(null);
                          }}
                          style={{ border: "1px solid #DCD6C4", background: "#FFFFFF", color: "#6B6455", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontFamily: "'Inter', sans-serif", cursor: "pointer" }}
                        >
                          Cancel
                        </button>
                        <button
                          className="bco-save-btn"
                          style={{ flex: 1 }}
                          onClick={() => saveEdit(p)}
                          disabled={!editForm.name.trim() || editStatus === "saving"}
                        >
                          {editStatus === "saving" ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {p.bio && <div style={{ fontSize: 12.5, color: "#3F3B32", marginTop: 10, lineHeight: 1.5 }}>{p.bio}</div>}

                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 12, color: "#6B6455", marginBottom: 6 }}>Handicap by year</div>
                        {!isLive ? (
                          <div style={{ fontSize: 10.5, color: "#B4AE9E" }}>Connect to Supabase to see and edit handicap history per year.</div>
                        ) : handicapLoading[p.id] ? (
                          <div style={{ fontSize: 11, color: "#8A8371" }}>Loading…</div>
                        ) : years.length === 0 ? (
                          <div style={{ fontSize: 10.5, color: "#B4AE9E" }}>No years on record yet — add one on Admin → Year settings.</div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {years.map((yearRow) => {
                              const value = handicapsByPlayer[p.id]?.[yearRow.id];
                              const saveKey = `${p.id}-${yearRow.id}`;
                              const saving = handicapSaving[saveKey];
                              return (
                                <div
                                  key={yearRow.id}
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "56px 1fr auto",
                                    gap: 8,
                                    alignItems: "center",
                                    background: yearRow.year === currentYear ? "#F3EFE2" : "transparent",
                                    borderRadius: 8,
                                    padding: "4px 6px",
                                  }}
                                >
                                  <span className="bco-mono" style={{ fontSize: 12.5, fontWeight: 600, color: "#2C2A22" }}>
                                    {yearRow.year}
                                  </span>
                                  <input
                                    type="number"
                                    value={value ?? ""}
                                    placeholder="—"
                                    onChange={(e) => saveHandicapForYear(p, yearRow, e.target.value)}
                                    style={{
                                      width: "100%",
                                      boxSizing: "border-box",
                                      border: "1px solid #DCD6C4",
                                      borderRadius: 6,
                                      padding: "5px 8px",
                                      fontSize: 12.5,
                                      fontFamily: "'IBM Plex Mono', monospace",
                                    }}
                                  />
                                  <span style={{ fontSize: 9.5, color: saving === "error" ? "#A3492E" : "#B4AE9E", whiteSpace: "nowrap", minWidth: 40 }}>
                                    {saving === "saving" ? "Saving…" : saving === "error" ? "Failed" : ""}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 12, color: "#6B6455", marginBottom: 6 }}>Years competed</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {(isLive ? years : WIREFRAME_YEARS.map((y) => ({ id: y, year: y }))).map((yearRow) => {
                            const active = isLive
                              ? (competedYearsByPlayer[p.id] || []).includes(yearRow.id)
                              : (p.yearsCompeted || []).includes(yearRow.year);
                            const saving = isLive ? competedSaving[`${p.id}-${yearRow.id}`] : null;
                            return (
                              <button
                                key={yearRow.id}
                                onClick={() => (isLive ? toggleYearCompetedLive(p, yearRow) : toggleYearCompetedOffline(p, yearRow.year))}
                                className="bco-mono"
                                style={{
                                  border: `${yearRow.year === currentYear ? 2 : 1}px solid ${saving === "error" ? "#A3492E" : active ? "#1B4332" : "#E4DFCE"}`,
                                  background: active ? "#DCEFE3" : "#FFFFFF",
                                  color: active ? "#1B4332" : "#8A8371",
                                  borderRadius: 999,
                                  padding: yearRow.year === currentYear ? "4px 11px" : "5px 12px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  opacity: saving === "saving" ? 0.6 : 1,
                                }}
                              >
                                {yearRow.year}
                              </button>
                            );
                          })}
                        </div>
                        {!isLive && <div style={{ fontSize: 9.5, color: "#B4AE9E", marginTop: 4 }}>Connect to Supabase to save this.</div>}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                        <span style={{ fontSize: 12, color: "#6B6455" }}>Competing this year</span>
                        <span
                          style={{
                            border: `1px solid ${p.competing === false ? "#E4DFCE" : "#1B4332"}`,
                            background: p.competing === false ? "#FFFFFF" : "#DCEFE3",
                            color: p.competing === false ? "#8A8371" : "#1B4332",
                            borderRadius: 999,
                            padding: "4px 12px",
                            fontSize: 11.5,
                            fontWeight: 600,
                          }}
                        >
                          {p.competing === false ? "No" : "Yes"}
                        </span>
                      </div>
                      <div style={{ fontSize: 9.5, color: "#B4AE9E", marginTop: 4 }}>Set by toggling the current year under "Years competed" above.</div>

                      <button
                        onClick={() => startEdit(p)}
                        style={{
                          width: "100%",
                          marginTop: 10,
                          border: "1px solid #DCD6C4",
                          background: "#FFFFFF",
                          color: "#1B4332",
                          borderRadius: 8,
                          padding: "8px 0",
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "'Inter', sans-serif",
                        }}
                      >
                        Edit
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Courses — course-tee metadata plus hole-by-hole reference data.
// ---------------------------------------------------------------------------
function defaultHoles(count = 18) {
  // A plausible starting scorecard (sequential handicap ranks) so the admin
  // is editing realistic values rather than starting from blank.
  const pars18 = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4];
  const pars9 = [4, 4, 3, 5, 4, 4, 3, 5, 4];
  const pars = count === 9 ? pars9 : pars18;
  return Array.from({ length: count }, (_, i) => ({ number: i + 1, par: pars[i], yardage: 380, handicap: i + 1 }));
}

function validateHoles(holes, count = 18) {
  const errors = [];
  const handicaps = holes.map((h) => Number(h.handicap));
  if (new Set(handicaps).size !== count || handicaps.some((h) => h < 1 || h > count)) {
    errors.push(`Hole handicaps must be ${count} unique values from 1–${count} (no repeats).`);
  }
  if (holes.some((h) => ![3, 4, 5].includes(Number(h.par)))) {
    errors.push("Par must be 3, 4, or 5 for every hole.");
  }
  if (holes.some((h) => !h.yardage || Number(h.yardage) <= 0)) {
    errors.push("Yardage must be greater than 0 for every hole.");
  }
  return errors;
}

function CoursesScreen({ onBack, isLive }) {
  const [courses, setCourses] = useState(COURSES);
  const [expanded, setExpanded] = useState(null);
  const [step, setStep] = useState("closed"); // "closed" | "meta" | "holes"
  const [form, setForm] = useState({ name: "", tee: "", rating: "", slope: "", holesCount: 18 });
  const [holes, setHoles] = useState(defaultHoles(18));
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "error"
  const [holeErrors, setHoleErrors] = useState([]);

  // Years, for the per-course "played" dropdown and the top filter. A
  // course-tee is only played once per year, so this is a single value per
  // course (courses.played_event_id), not a set.
  const [years, setYears] = useState([]);
  const [playedSaving, setPlayedSaving] = useState({}); // courseId -> "saving" | "error"
  const [filterYears, setFilterYears] = useState([]); // selected event ids — multi-select, empty = show all

  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    (async () => {
      try {
        const events = await fetchEvents();
        if (cancelled) return;
        setYears(events.map((e) => ({ id: e.id, year: e.year })).sort((a, b) => b.year - a.year));
      } catch (err) {
        console.error("Failed to load events:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive]);

  const updateForm = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const updateHole = (number, field, value) => {
    setHoles((prev) => prev.map((h) => (h.number === number ? { ...h, [field]: Number(value) } : h)));
    setHoleErrors([]);
  };

  const setPlayedYear = async (course, eventId) => {
    const previous = course.playedEventId;
    course.playedEventId = eventId;
    setCourses((prev) => [...prev]);
    if (!isLive) return;
    setPlayedSaving((prev) => ({ ...prev, [course.id]: "saving" }));
    try {
      await updateCoursePlayedYear(course.id, eventId);
      setPlayedSaving((prev) => ({ ...prev, [course.id]: null }));
    } catch (err) {
      console.error("Failed to save played year:", err);
      setPlayedSaving((prev) => ({ ...prev, [course.id]: "error" }));
      course.playedEventId = previous;
      setCourses((prev) => [...prev]);
    }
  };

  const toggleFilterYear = (eventId) => {
    setFilterYears((prev) => (prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]));
  };

  const visibleCourses = filterYears.length === 0 ? courses : courses.filter((c) => filterYears.includes(c.playedEventId));

  const startAdd = () => {
    setForm({ name: "", tee: "", rating: "", slope: "", holesCount: 18 });
    setHoles(defaultHoles(18));
    setHoleErrors([]);
    setStep("meta");
  };

  const setHolesCount = (count) => {
    updateForm("holesCount", count);
    setHoles(defaultHoles(count));
  };

  const goToHoles = () => {
    if (!form.name.trim() || !form.rating || !form.slope) return;
    setStep("holes");
  };

  const handleSaveCourse = async () => {
    const errors = validateHoles(holes, form.holesCount);
    if (errors.length) {
      setHoleErrors(errors);
      return;
    }

    const meta = { name: form.name.trim(), tee: form.tee.trim() || "White", rating: Number(form.rating), slope: Number(form.slope), holesCount: form.holesCount, playedEventId: null };

    if (isLive) {
      setSaveStatus("saving");
      try {
        const courseId = await createCourse(meta);
        await createCourseHoles(courseId, holes);
        const newCourse = { id: courseId, ...meta, holes };
        COURSES.push(newCourse);
        setCourses((prev) => [...prev, newCourse]);
        setSaveStatus(null);
      } catch (err) {
        console.error("Failed to save course:", err);
        setSaveStatus("error");
        return;
      }
    } else {
      const nextId = Math.max(0, ...courses.map((c) => c.id)) + 1;
      const newCourse = { id: nextId, ...meta, holes };
      COURSES.push(newCourse);
      setCourses((prev) => [...prev, newCourse]);
    }

    setStep("closed");
  };

  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 14 }}>
        <button onClick={onBack} style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", color: "#6B6455" }} aria-label="Back to More">
          <ChevronLeft size={18} />
        </button>
        <span className="bco-display" style={{ fontSize: 19, fontWeight: 600, color: "#1B4332", flex: 1 }}>
          Courses
        </span>
        {step === "closed" && (
          <button
            onClick={startAdd}
            style={{
              border: "1px solid #1B4332",
              color: "#1B4332",
              background: "#FFFFFF",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            + Add course-tee
          </button>
        )}
      </div>

      {step === "closed" && isLive && years.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: "#8A8371", letterSpacing: "0.03em", marginBottom: 6 }}>FILTER BY YEAR PLAYED</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {years.map((yearRow) => {
              const active = filterYears.includes(yearRow.id);
              return (
                <button
                  key={yearRow.id}
                  onClick={() => toggleFilterYear(yearRow.id)}
                  className="bco-mono"
                  style={{
                    border: `1px solid ${active ? "#1B4332" : "#E4DFCE"}`,
                    background: active ? "#1B4332" : "#FFFFFF",
                    color: active ? "#F3EFE2" : "#6B6455",
                    borderRadius: 999,
                    padding: "5px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {yearRow.year}
                </button>
              );
            })}
            {filterYears.length > 0 && (
              <button
                onClick={() => setFilterYears([])}
                style={{ border: "none", background: "none", color: "#8A8371", fontSize: 11.5, cursor: "pointer", fontFamily: "'Inter', sans-serif", padding: "5px 6px" }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {step === "meta" && (
        <div style={{ background: "#FFFFFF", border: "1px solid #E4DFCE", borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <FormField label="Course name">
            <FormInput value={form.name} onChange={(v) => updateForm("name", v)} placeholder="e.g. Stonehedge South" />
          </FormField>
          <FormField label="Tee">
            <FormInput value={form.tee} onChange={(v) => updateForm("tee", v)} placeholder="e.g. Blue" />
          </FormField>
          <FormField label="Rating">
            <FormInput value={form.rating} onChange={(v) => updateForm("rating", v)} type="number" placeholder="e.g. 72.9" />
          </FormField>
          <FormField label="Slope">
            <FormInput value={form.slope} onChange={(v) => updateForm("slope", v)} type="number" placeholder="e.g. 135" />
          </FormField>
          <FormField label="Holes">
            <div style={{ display: "flex", gap: 6 }}>
              {[9, 18].map((n) => (
                <button
                  key={n}
                  onClick={() => setHolesCount(n)}
                  style={{
                    flex: 1,
                    border: `1px solid ${form.holesCount === n ? "#1B4332" : "#E4DFCE"}`,
                    background: form.holesCount === n ? "#1B4332" : "#FFFFFF",
                    color: form.holesCount === n ? "#F3EFE2" : "#6B6455",
                    borderRadius: 8,
                    padding: "8px 0",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {n} holes
                </button>
              ))}
            </div>
          </FormField>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setStep("closed")}
              style={{ border: "1px solid #DCD6C4", background: "#FFFFFF", color: "#6B6455", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontFamily: "'Inter', sans-serif", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button className="bco-save-btn" style={{ flex: 1 }} onClick={goToHoles} disabled={!form.name.trim() || !form.rating || !form.slope}>
              Next: enter holes
            </button>
          </div>
        </div>
      )}

      {step === "holes" && (
        <div style={{ background: "#FFFFFF", border: "1px solid #E4DFCE", borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1B4332", marginBottom: 2 }}>
            {form.name} — {form.tee || "White"}
          </div>
          <div style={{ fontSize: 10.5, color: "#8A8371", marginBottom: 10 }}>
            Each hole needs a par, yardage, and a handicap rank — every hole's handicap rank must be unique, 1 through {form.holesCount}.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr 1fr", gap: 6, fontSize: 10, fontWeight: 600, color: "#8A8371", marginBottom: 4 }}>
            <span></span>
            <span>Par</span>
            <span>Yardage</span>
            <span>Hcp</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto" }}>
            {holes.map((h) => (
              <div key={h.number} style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr 1fr", gap: 6, alignItems: "center" }}>
                <span className="bco-mono" style={{ fontSize: 11, color: "#8A8371" }}>
                  {h.number}
                </span>
                <input
                  type="number"
                  value={h.par}
                  onChange={(e) => updateHole(h.number, "par", e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", border: "1px solid #DCD6C4", borderRadius: 6, padding: "5px 6px", fontSize: 12 }}
                />
                <input
                  type="number"
                  value={h.yardage}
                  onChange={(e) => updateHole(h.number, "yardage", e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", border: "1px solid #DCD6C4", borderRadius: 6, padding: "5px 6px", fontSize: 12 }}
                />
                <input
                  type="number"
                  value={h.handicap}
                  onChange={(e) => updateHole(h.number, "handicap", e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", border: "1px solid #DCD6C4", borderRadius: 6, padding: "5px 6px", fontSize: 12 }}
                />
              </div>
            ))}
          </div>

          {holeErrors.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <Banner tone="error">
                {holeErrors.map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
              </Banner>
            </div>
          )}
          {saveStatus === "error" && (
            <div style={{ marginTop: 10 }}>
              <Banner tone="error">Couldn't save to Supabase — check the console. Nothing was lost, try again.</Banner>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={() => setStep("meta")}
              style={{ border: "1px solid #DCD6C4", background: "#FFFFFF", color: "#6B6455", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontFamily: "'Inter', sans-serif", cursor: "pointer" }}
            >
              Back
            </button>
            <button className="bco-save-btn" style={{ flex: 1 }} onClick={handleSaveCourse} disabled={saveStatus === "saving"}>
              {saveStatus === "saving" ? "Saving…" : "Save course"}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {visibleCourses.map((c) => {
          const isOpen = expanded === c.id;
          const totalPar = c.holes.reduce((s, h) => s + h.par, 0);
          return (
            <div key={c.id} style={{ background: "#FFFFFF", border: "1px solid #E4DFCE", borderRadius: 12, overflow: "hidden" }}>
              <button
                onClick={() => setExpanded((prev) => (prev === c.id ? null : c.id))}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#2C2A22" }}>
                    {c.name} {c.tee && <span style={{ color: "#8A8371", fontWeight: 500 }}>— {c.tee}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "#8A8371", marginTop: 1 }}>
                    {c.holes.length ? `${c.holes.length} holes · Par ${totalPar} · ` : ""}Rating {c.rating} · Slope {c.slope}
                    {c.playedEventId != null && ` · Played ${years.find((y) => y.id === c.playedEventId)?.year ?? ""}`}
                    {c.isActiveThisYear === false && <span style={{ color: "#A3492E", fontWeight: 600 }}> · Not active this year</span>}
                  </div>
                </div>
                <ChevronRight size={15} color="#B9B3A2" style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s ease" }} />
              </button>

              {isOpen && (
                <div style={{ padding: "0 14px 14px", borderTop: "1px solid #EFEBDE" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "#6B6455" }}>Active this year</span>
                    <span
                      style={{
                        border: `1px solid ${c.isActiveThisYear === false ? "#E4DFCE" : "#1B4332"}`,
                        background: c.isActiveThisYear === false ? "#FFFFFF" : "#DCEFE3",
                        color: c.isActiveThisYear === false ? "#8A8371" : "#1B4332",
                        borderRadius: 999,
                        padding: "4px 12px",
                        fontSize: 11.5,
                        fontWeight: 600,
                      }}
                    >
                      {c.isActiveThisYear === false ? "No" : "Yes"}
                    </span>
                  </div>
                  <div style={{ fontSize: 9.5, color: "#B4AE9E", marginBottom: c.holes.length === 0 ? 0 : 4 }}>Set by "Year played" below matching the current year.</div>

                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: "#6B6455", marginBottom: 6 }}>Year played</div>
                    {isLive ? (
                      <select
                        value={c.playedEventId ?? ""}
                        onChange={(e) => setPlayedYear(c, e.target.value ? Number(e.target.value) : null)}
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          border: `1px solid ${playedSaving[c.id] === "error" ? "#A3492E" : "#DCD6C4"}`,
                          borderRadius: 8,
                          padding: "8px 10px",
                          fontSize: 13,
                          fontFamily: "'Inter', sans-serif",
                          background: "#FFFFFF",
                          color: "#2C2A22",
                          opacity: playedSaving[c.id] === "saving" ? 0.6 : 1,
                        }}
                      >
                        <option value="">— none —</option>
                        {years.map((yearRow) => (
                          <option key={yearRow.id} value={yearRow.id}>
                            {yearRow.year}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div style={{ fontSize: 10.5, color: "#B4AE9E" }}>Connect to Supabase to set this.</div>
                    )}
                  </div>
                  {c.holes.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#B4AE9E", padding: "12px 0" }}>No hole data yet.</div>
                  ) : (
                    <table className="bco-table" style={{ marginTop: 8 }}>
                      <thead>
                        <tr>
                          <th>Hole</th>
                          <th style={{ textAlign: "center" }}>Par</th>
                          <th style={{ textAlign: "center" }}>Yardage</th>
                          <th style={{ textAlign: "right" }}>Hcp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.holes.map((h) => (
                          <tr key={h.number}>
                            <td className="bco-mono" style={{ fontSize: 12.5, color: "#8A8371" }}>
                              {h.number}
                            </td>
                            <td className="bco-mono" style={{ textAlign: "center", fontSize: 12.5 }}>
                              {h.par}
                            </td>
                            <td className="bco-mono" style={{ textAlign: "center", fontSize: 12.5 }}>
                              {h.yardage}
                            </td>
                            <td className="bco-mono" style={{ textAlign: "right", fontSize: 12.5 }}>
                              {h.handicap}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6455", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

function FormInput({ value, onChange, type = "text", placeholder }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        boxSizing: "border-box",
        border: "1px solid #DCD6C4",
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 13,
        fontFamily: "'Inter', sans-serif",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Export results — CSV download of current mock data. Real app: same picker,
// but pulling from live tables instead of the in-memory demo data.
// ---------------------------------------------------------------------------
const EXPORT_TYPES = [
  { key: "soloLeaderboard", label: "Solo leaderboard (current standings)" },
  { key: "teamLeaderboard", label: "Team leaderboard (current standings)" },
  { key: "skins", label: "Skins results (all rounds)" },
  { key: "poker", label: "Poker results (all rounds)" },
  { key: "soloRecords", label: "Solo record book (all-time — still mock, Record Book isn't live yet)" },
  { key: "teamRecords", label: "Team record book (all-time — still mock, Record Book isn't live yet)" },
];

function csvRow(values) {
  return values
    .map((v) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(",");
}

async function buildExportCsv(selected, isLive, currentEventId) {
  const lines = [];
  const live = isLive && currentEventId;

  if (selected.soloLeaderboard) {
    lines.push("Solo Leaderboard", csvRow(["Rank", "Player", "Total"]));
    if (live) {
      const standings = await fetchSoloStandings(currentEventId);
      const rows = standings
        .map((s) => ({ name: PLAYERS.find((p) => p.id === s.player_id)?.name || `Player ${s.player_id}`, total: s.total_net_to_par, totalAllRounds: s.total_net_to_par_all_rounds }))
        .sort((a, b) => a.total - b.total || a.totalAllRounds - b.totalAllRounds);
      rows.forEach((r, i) => lines.push(csvRow([i + 1, r.name, fmtDiff(r.total)])));
    } else {
      soloResults.forEach((p, i) => lines.push(csvRow([i + 1, p.name, fmtDiff(p.total)])));
    }
    lines.push("");
  }

  if (selected.teamLeaderboard) {
    lines.push("Team Leaderboard", csvRow(["Rank", "Team", "Points"]));
    if (live) {
      const dbTeams = await fetchTeams(currentEventId);
      const standings = await fetchTeamStandings(currentEventId);
      const rows = standings
        .map((s) => ({ name: dbTeams.find((t) => t.id === s.team_id)?.name || s.name, points: s.total_points }))
        .sort((a, b) => b.points - a.points);
      rows.forEach((t, i) => lines.push(csvRow([i + 1, t.name, t.points])));
    } else {
      teamResults.forEach((t, i) => lines.push(csvRow([i + 1, t.name, t.points])));
    }
    lines.push("");
  }

  if (selected.skins) {
    lines.push("Skins", csvRow(["Round", "Hole", "Winner", "Net"]));
    if (live) {
      for (const label of SCORE_ROUNDS) {
        const roundId = ROUND_ID_BY_LABEL[label];
        if (!roundId) continue;
        const skins = await fetchSkins(roundId);
        skins.forEach((s) =>
          lines.push(csvRow([label, s.hole_number, PLAYERS.find((p) => p.id === s.winner_player_id)?.name || s.winner_player_id, s.net_strokes]))
        );
      }
    } else {
      SKINS_PREVIEW.forEach((s) => lines.push(csvRow([SCORE_ROUNDS[0], s.hole, s.winner, s.net])));
    }
    lines.push("");
  }

  if (selected.poker) {
    lines.push("Poker", csvRow(["Round", "Player", "0-putts", "1-putts", "Cards", "3-putts"]));
    if (live) {
      for (const label of SCORE_ROUNDS) {
        const roundId = ROUND_ID_BY_LABEL[label];
        if (!roundId) continue;
        const cards = await fetchPokerCards(roundId);
        cards.forEach((c) =>
          lines.push(
            csvRow([label, PLAYERS.find((p) => p.id === c.player_id)?.name || c.player_id, c.zero_putts, c.one_putts, c.cards_earned, c.three_putts])
          )
        );
      }
    } else {
      POKER_PREVIEW.forEach((p) => lines.push(csvRow([SCORE_ROUNDS[0], p.name, p.zeroPutts, p.onePutts, p.zeroPutts * 2 + p.onePutts, p.threePuttBuyins])));
    }
    lines.push("");
  }

  if (selected.soloRecords) {
    lines.push("Solo Record Book (All-time)", csvRow(["Player", "App", "Avg", "Best", "Worst", "Podiums", "Gross Avg", "Net Avg"]));
    soloRecordsSorted.forEach((p) =>
      lines.push(csvRow([p.name, p.app, p.posAvg, p.posBest, p.posWorst, p.podium1 + p.podium2 + p.podium3, p.grossAvg, p.netAvg]))
    );
    lines.push("");
  }
  if (selected.teamRecords) {
    lines.push("Team Record Book (All-time)", csvRow(["Player", "App", "Avg", "Best", "Worst", "Podiums", "Win", "Loss", "Tie", "Win %"]));
    teamRecordsSorted.forEach((p) =>
      lines.push(csvRow([p.name, p.app, p.posAvg, p.posBest, p.posWorst, p.podium1 + p.podium2 + p.podium3, p.win, p.loss, p.tie, p.winPct]))
    );
    lines.push("");
  }
  return lines.join("\n");
}

function ExportResults({ onBack, isLive, currentEventId }) {
  const [selected, setSelected] = useState({ soloLeaderboard: true, teamLeaderboard: true, skins: false, poker: false, soloRecords: false, teamRecords: false });
  const [status, setStatus] = useState(null); // null | "exporting" | "exported" | "error"

  const toggle = (key) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
    setStatus(null);
  };

  const anySelected = Object.values(selected).some(Boolean);

  const handleExport = async () => {
    if (!anySelected) return;
    setStatus("exporting");
    try {
      const csv = await buildExportCsv(selected, isLive, currentEventId);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bco-export-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus("exported");
    } catch (err) {
      console.error("Export failed:", err);
      setStatus("error");
    }
  };

  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 14 }}>
        <button onClick={onBack} style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", color: "#6B6455" }} aria-label="Back to Admin">
          <ChevronLeft size={18} />
        </button>
        <span className="bco-display" style={{ fontSize: 19, fontWeight: 600, color: "#1B4332" }}>
          Export results
        </span>
      </div>

      <AutoComputedNote>
        {isLive
          ? "Leaderboards, Skins, and Poker pull real data for the current year. Record Book entries are still mock — that screen isn't live yet."
          : "Not connected to Supabase — exports will use local demo data."}
      </AutoComputedNote>

      <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6455", marginBottom: 8 }}>WHAT TO EXPORT</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        {EXPORT_TYPES.map((t) => (
          <label
            key={t.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#FFFFFF",
              border: "1px solid #E4DFCE",
              borderRadius: 10,
              padding: "10px 12px",
              cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            <input type="checkbox" checked={!!selected[t.key]} onChange={() => toggle(t.key)} style={{ accentColor: "#1B4332", width: 15, height: 15 }} />
            <span style={{ fontSize: 13, color: "#2C2A22" }}>{t.label}</span>
          </label>
        ))}
      </div>

      {status === "exported" && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="success">CSV downloaded.</Banner>
        </div>
      )}
      {status === "error" && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Export failed — check the console and try again.</Banner>
        </div>
      )}

      <button className="bco-save-btn" onClick={handleExport} disabled={!anySelected || status === "exporting"}>
        {status === "exporting" ? "Exporting…" : "Export CSV"}
      </button>
    </div>
  );
}
function RecordBook({ onBack, isLive }) {
  const [mode, setMode] = useState("solo");
  const [year, setYear] = useState("all");
  const [expanded, setExpanded] = useState(null);

  // Live Solo data — fetched once, aggregated client-side both all-time and
  // per-year, so the year filter is just re-filtering the same fetch.
  const [liveYears, setLiveYears] = useState([]); // [{id, year}]
  const [liveAllTime, setLiveAllTime] = useState(null); // v_solo_record_book rows
  const [liveRanks, setLiveRanks] = useState(null); // v_solo_year_rank rows
  const [liveRoundTotals, setLiveRoundTotals] = useState(null); // fetchAllSoloRoundTotals rows
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);

  // Live Team data — same "fetch once, filter client-side" approach.
  const [liveTeamYears, setLiveTeamYears] = useState([]); // [{id, year}]
  const [liveTeamAllTime, setLiveTeamAllTime] = useState(null); // v_team_record_book rows
  const [liveTeamRanks, setLiveTeamRanks] = useState(null); // v_player_team_year_rank rows
  const [liveTeamMatchPoints, setLiveTeamMatchPoints] = useState(null); // v_player_team_match_points rows
  const [liveTeamMatchRecord, setLiveTeamMatchRecord] = useState(null); // v_player_team_match_record rows
  const [liveTeamLoading, setLiveTeamLoading] = useState(isLive);
  const [liveTeamError, setLiveTeamError] = useState(null);

  useEffect(() => {
    if (!isLive || mode !== "solo") {
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    setLiveLoading(true);
    (async () => {
      try {
        const [events, allTime, ranks, roundTotals] = await Promise.all([
          fetchEvents(),
          fetchSoloRecordBook(),
          fetchSoloYearRanks(),
          fetchAllSoloRoundTotals(),
        ]);
        if (cancelled) return;
        setLiveYears(events.map((e) => ({ id: e.id, year: e.year })).sort((a, b) => b.year - a.year));
        setLiveAllTime(allTime);
        setLiveRanks(ranks);
        setLiveRoundTotals(roundTotals);
      } catch (err) {
        console.error("Failed to load Solo record book:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, mode]);

  useEffect(() => {
    if (!isLive || mode !== "team") {
      setLiveTeamLoading(false);
      return;
    }
    let cancelled = false;
    setLiveTeamLoading(true);
    (async () => {
      try {
        const [events, allTime, ranks, matchPoints, matchRecord] = await Promise.all([
          fetchEvents(),
          fetchTeamRecordBook(),
          fetchPlayerTeamYearRanks(),
          fetchPlayerTeamMatchPoints(),
          fetchPlayerTeamMatchRecord(),
        ]);
        if (cancelled) return;
        setLiveTeamYears(events.map((e) => ({ id: e.id, year: e.year })).sort((a, b) => b.year - a.year));
        setLiveTeamAllTime(allTime);
        setLiveTeamRanks(ranks);
        setLiveTeamMatchPoints(matchPoints);
        setLiveTeamMatchRecord(matchRecord);
      } catch (err) {
        console.error("Failed to load Team record book:", err);
        setLiveTeamError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveTeamLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, mode]);

  const isLiveSolo = mode === "solo" && isLive && liveAllTime != null;

  // Shaped to match the mock SOLO_RECORDS fields, so the existing render
  // logic below doesn't need to branch on live vs mock.
  const liveSoloRecords = useMemo(() => {
    if (!isLiveSolo) return null;
    return liveAllTime
      .map((r) => {
        const myRanks = (liveRanks || []).filter((rk) => rk.player_id === r.player_id);
        const posAvg = myRanks.length ? myRanks.reduce((s, rk) => s + rk.year_rank, 0) / myRanks.length : r.best_finish;
        const podium1 = myRanks.filter((rk) => rk.year_rank === 1).length;
        const podium2 = myRanks.filter((rk) => rk.year_rank === 2).length;
        const podium3 = myRanks.filter((rk) => rk.year_rank === 3).length;
        const attendedEventIds = myRanks.map((rk) => rk.event_id);
        return {
          playerId: r.player_id,
          name: r.name,
          app: r.appearances,
          posAvg,
          posBest: r.best_finish,
          posWorst: r.worst_finish,
          podium1,
          podium2,
          podium3,
          grossAvg: Number(r.gross_avg_strokes),
          grossToPar: Number(r.gross_avg_to_par),
          netAvg: Number(r.net_avg_strokes),
          netToPar: Number(r.net_avg_to_par),
          attendedEventIds,
        };
      })
      .sort((a, b) => a.posAvg - b.posAvg);
  }, [isLiveSolo, liveAllTime, liveRanks]);

  const liveYearStat = (playerId, eventId) => {
    const rankRow = (liveRanks || []).find((rk) => rk.player_id === playerId && rk.event_id === eventId);
    const rounds = (liveRoundTotals || []).filter((rt) => rt.playerId === playerId && rt.eventId === eventId);
    if (!rankRow || rounds.length === 0) return null;
    const avg = (key) => rounds.reduce((s, r) => s + r[key], 0) / rounds.length;
    return {
      pos: rankRow.year_rank,
      podium: rankRow.year_rank <= 3,
      gross: avg("grossTotal"),
      grossToPar: avg("grossToPar"),
      net: avg("netTotal"),
      netToPar: avg("netToPar"),
    };
  };

  const isLiveTeam = mode === "team" && isLive && liveTeamAllTime != null;

  const liveTeamRecords = useMemo(() => {
    if (!isLiveTeam) return null;
    return liveTeamAllTime
      .map((r) => {
        const myRanks = (liveTeamRanks || []).filter((rk) => rk.player_id === r.player_id);
        const posAvg = myRanks.length ? myRanks.reduce((s, rk) => s + rk.year_rank, 0) / myRanks.length : r.best_finish;
        const podium1 = myRanks.filter((rk) => rk.year_rank === 1).length;
        const podium2 = myRanks.filter((rk) => rk.year_rank === 2).length;
        const podium3 = myRanks.filter((rk) => rk.year_rank === 3).length;
        const attendedEventIds = myRanks.map((rk) => rk.event_id);
        return {
          playerId: r.player_id,
          name: r.name,
          app: r.appearances,
          posAvg,
          posBest: r.best_finish,
          posWorst: r.worst_finish,
          podium1,
          podium2,
          podium3,
          ptsLow: Number(r.pts_low),
          ptsAvg: Number(r.pts_avg),
          ptsHigh: Number(r.pts_high),
          win: r.win,
          loss: r.loss,
          tie: r.tie,
          winPct: Number(r.win_pct),
          attendedEventIds,
        };
      })
      .sort((a, b) => a.posAvg - b.posAvg);
  }, [isLiveTeam, liveTeamAllTime, liveTeamRanks]);

  const liveTeamYearStat = (playerId, eventId) => {
    const rankRow = (liveTeamRanks || []).find((rk) => rk.player_id === playerId && rk.event_id === eventId);
    if (!rankRow) return null;
    // team_id is unique per year (a fresh teams row each event), so it's
    // the correct key to scope this player's matches to just this year.
    const matches = (liveTeamMatchPoints || []).filter((mp) => mp.player_id === playerId && mp.team_id === rankRow.team_id);
    const results = (liveTeamMatchRecord || []).filter((mr) => mr.player_id === playerId && mr.team_id === rankRow.team_id);
    const win = results.filter((r) => r.result === "win").length;
    const loss = results.filter((r) => r.result === "loss").length;
    const tie = results.filter((r) => r.result === "tie").length;
    const ptsAvg = matches.length ? matches.reduce((s, m) => s + m.historical_points, 0) / matches.length : 0;
    return { pos: rankRow.year_rank, podium: rankRow.year_rank <= 3, win, loss, tie, ptsAvg };
  };

  const toggleExpanded = (name) => setExpanded((prev) => (prev === name ? null : name));

  const baseRecords = mode === "solo" ? (liveSoloRecords || soloRecordsSorted) : (liveTeamRecords || teamRecordsSorted);
  const yearOptions =
    mode === "solo" && isLiveSolo ? liveYears.map((y) => y.year) : mode === "team" && isLiveTeam ? liveTeamYears.map((y) => y.year) : RECORD_YEARS;

  const displayRows = useMemo(() => {
    if (year === "all") return baseRecords.map((p) => ({ p, yearStat: null }));
    if (isLiveSolo) {
      const yearRow = liveYears.find((y) => y.year === year);
      if (!yearRow) return [];
      return baseRecords
        .filter((p) => (p.attendedEventIds || []).includes(yearRow.id))
        .map((p) => ({ p, yearStat: liveYearStat(p.playerId, yearRow.id) }))
        .filter((row) => row.yearStat)
        .sort((a, b) => a.yearStat.pos - b.yearStat.pos);
    }
    if (isLiveTeam) {
      const yearRow = liveTeamYears.find((y) => y.year === year);
      if (!yearRow) return [];
      return baseRecords
        .filter((p) => (p.attendedEventIds || []).includes(yearRow.id))
        .map((p) => ({ p, yearStat: liveTeamYearStat(p.playerId, yearRow.id) }))
        .filter((row) => row.yearStat)
        .sort((a, b) => a.yearStat.pos - b.yearStat.pos);
    }
    return baseRecords
      .filter((p) => attendedYears(p.app).includes(year))
      .map((p) => ({ p, yearStat: mode === "solo" ? yearlySoloStat(p, year) : yearlyTeamStat(p, year) }))
      .sort((a, b) => a.yearStat.pos - b.yearStat.pos);
  }, [baseRecords, year, mode, isLiveSolo, liveYears, liveRanks, liveRoundTotals, isLiveTeam, liveTeamYears, liveTeamRanks, liveTeamMatchPoints, liveTeamMatchRecord]);

  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
        <button
          onClick={onBack}
          style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", color: "#6B6455" }}
          aria-label="Back to More"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="bco-display" style={{ fontSize: 19, fontWeight: 600, color: "#1B4332" }}>
          Record Book
        </span>
      </div>

      <div className="bco-seg" style={{ marginBottom: 10 }}>
        <button
          className={`bco-seg-btn${mode === "solo" ? " active" : ""}`}
          onClick={() => {
            setMode("solo");
            setYear("all");
          }}
        >
          Solo
        </button>
        <button
          className={`bco-seg-btn${mode === "team" ? " active" : ""}`}
          onClick={() => {
            setMode("team");
            setYear("all");
          }}
        >
          Team
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 10 }}>
        <YearPill label="All-time" active={year === "all"} onClick={() => setYear("all")} />
        {yearOptions.map((y) => (
          <YearPill key={y} label={String(y)} active={year === y} onClick={() => setYear(y)} />
        ))}
      </div>

      {mode === "solo" && isLive && liveError && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't load live record book ({liveError}) — showing local demo data instead.</Banner>
        </div>
      )}
      {mode === "solo" && isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 10 }}>Loading…</div>}
      {mode === "team" && isLive && liveTeamError && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't load live record book ({liveTeamError}) — showing local demo data instead.</Banner>
        </div>
      )}
      {mode === "team" && isLive && liveTeamLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 10 }}>Loading…</div>}

      <div style={{ fontSize: 10.5, color: "#A39C89", marginBottom: 10, lineHeight: 1.5 }}>
        {year === "all"
          ? "Sorted by average finish. Tap a player for full stats."
          : `${displayRows.length} player${displayRows.length !== 1 ? "s" : ""} competed in ${year}. Sorted by finish.`}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {displayRows.map(({ p, yearStat }) => {
          const isOpen = expanded === p.name;
          const podiumTotal = p.podium1 + p.podium2 + p.podium3;
          return (
            <div key={p.name} style={{ background: "#FFFFFF", border: "1px solid #E4DFCE", borderRadius: 12, overflow: "hidden" }}>
              <button
                onClick={() => toggleExpanded(p.name)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "11px 14px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#2C2A22" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "#8A8371", marginTop: 1 }}>
                    {year === "all"
                      ? `${p.app} appearance${p.app !== 1 ? "s" : ""} · ${podiumTotal} podium${podiumTotal !== 1 ? "s" : ""}`
                      : yearStat.podium
                      ? "Podium finish"
                      : "No podium"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 9.5, fontWeight: 600, color: "#8A8371", letterSpacing: "0.03em" }}>
                      {year === "all" ? "AVG" : "FINISH"}
                    </div>
                    <div className="bco-mono" style={{ fontSize: 16, fontWeight: 600, color: "#1B4332" }}>
                      {year === "all" ? fmtStat(p.posAvg) : `#${yearStat.pos}`}
                    </div>
                  </div>
                  <ChevronRight
                    size={15}
                    color="#B9B3A2"
                    style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s ease" }}
                  />
                </div>
              </button>

              {isOpen && (
                <div style={{ padding: "2px 14px 14px", borderTop: "1px solid #EFEBDE" }}>
                  {year === "all" ? (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 10 }}>
                        <StatBlock label="Best" value={`#${p.posBest}`} />
                        <StatBlock label="Worst" value={`#${p.posWorst}`} />
                        <StatBlock label="Podiums" value={`${podiumTotal}`} sub={`${p.podium1}-${p.podium2}-${p.podium3}`} />
                      </div>
                      {mode === "solo" ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 8 }}>
                          <StatBlock label="Gross avg" value={fmtStat(p.grossAvg)} sub={`+${fmtStat(p.grossToPar)} to par`} />
                          <StatBlock label="Net avg" value={fmtStat(p.netAvg)} sub={`${Number(p.netToPar) >= 0 ? "+" : ""}${fmtStat(p.netToPar)} to par`} />
                        </div>
                      ) : (
                        <>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 8 }}>
                            <StatBlock label="Pts / match low" value={fmtStat(p.ptsLow)} />
                            <StatBlock label="Pts / match avg" value={fmtStat(p.ptsAvg)} />
                            <StatBlock label="Pts / match high" value={fmtStat(p.ptsHigh)} />
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 8 }}>
                            <StatBlock label="Record" value={`${p.win}-${p.loss}-${p.tie}`} sub="W-L-T" />
                            <StatBlock label="Win %" value={`${p.winPct}%`} />
                          </div>
                        </>
                      )}
                    </>
                  ) : mode === "solo" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 10 }}>
                      <StatBlock label="Gross" value={fmtStat(yearStat.gross)} sub={`+${fmtStat(yearStat.grossToPar)} to par`} />
                      <StatBlock label="Net" value={fmtStat(yearStat.net)} sub={`${Number(yearStat.netToPar) >= 0 ? "+" : ""}${fmtStat(yearStat.netToPar)} to par`} />
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 10 }}>
                      <StatBlock label="Record" value={`${yearStat.win}-${yearStat.loss}-${yearStat.tie}`} sub="W-L-T" />
                      <StatBlock label="Pts / match" value={fmtStat(yearStat.ptsAvg)} />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YearPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        border: `1px solid ${active ? "#1B4332" : "#E4DFCE"}`,
        background: active ? "#1B4332" : "#FFFFFF",
        color: active ? "#F3EFE2" : "#6B6455",
        borderRadius: 999,
        padding: "6px 13px",
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "'Inter', sans-serif",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function StatBlock({ label, value, sub }) {
  return (
    <div style={{ background: "#F3EFE2", borderRadius: 8, padding: "7px 9px" }}>
      <div style={{ fontSize: 9.5, fontWeight: 600, color: "#8A8371", letterSpacing: "0.02em" }}>{label.toUpperCase()}</div>
      <div className="bco-mono" style={{ fontSize: 14, fontWeight: 600, color: "#2C2A22", marginTop: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 9.5, color: "#A39C89" }}>{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match Results tab — per-round team matchups. Course handicaps are computed
// live from each player's handicapIndex against the course assigned to that
// round (mocked here since round -> course assignment isn't persisted yet).
// ---------------------------------------------------------------------------
const TEAMS = [
  { name: "CDL", players: ["Collin Clark", "Quaid DeLacluyse"] },
  { name: "Boomers", players: ["Tyler Jessel", "James Bublitz"] },
  { name: "Torch'em", players: ["Tommy Casey", "Evan Powers"] },
  { name: "LFG", players: ["Mitchell Powers", "Sam Losinski"] },
];

export const ROUND_COURSE = { R1: COURSES[0], R2: COURSES[1], R3: COURSES[2], R4: COURSES[0] };

const MATCHES_BY_ROUND = {
  R1: [
    { teamA: "CDL", teamB: "Boomers", pointsA: 5.5, pointsB: 3.5 },
    { teamA: "Torch'em", teamB: "LFG", pointsA: 4, pointsB: 5 },
  ],
  R2: [
    { teamA: "CDL", teamB: "Torch'em", pointsA: 6, pointsB: 3 },
    { teamA: "Boomers", teamB: "LFG", pointsA: 5, pointsB: 4 },
  ],
  R3: [
    { teamA: "CDL", teamB: "LFG", pointsA: 4.5, pointsB: 4.5 },
    { teamA: "Boomers", teamB: "Torch'em", pointsA: 5.5, pointsB: 3.5 },
  ],
  R4: [
    { teamA: "Boomers", teamB: "CDL", pointsA: 4, pointsB: 5 },
    { teamA: "Torch'em", teamB: "LFG", pointsA: 6.5, pointsB: 2.5 },
  ],
};

function computeMatchProgress(match, round, scoresStore, year, teamsSource) {
  let allNames;
  if (match.matchType === "singles") {
    // For singles, teamA/teamB already hold the two players' own names.
    allNames = [match.teamA, match.teamB].filter(Boolean);
  } else {
    const teamAObj = teamsSource.find((t) => t.name === match.teamA);
    const teamBObj = teamsSource.find((t) => t.name === match.teamB);
    allNames = [...(teamAObj?.players || []), ...(teamBObj?.players || [])];
  }
  const playerIds = allNames.map((name) => PLAYERS.find((p) => p.name === name)?.id).filter((id) => id != null);

  if (playerIds.length < 2) return { marker: 0, final: false };

  const records = playerIds.map((id) => scoresStore[`${year}-${round}-${id}`]);
  const allSubmitted = records.every((r) => r?.status === "submitted");
  if (allSubmitted) return { marker: 18, final: true };

  let marker = 0;
  for (let holeNum = 1; holeNum <= 18; holeNum++) {
    const allIn = records.every((r) => r?.entries?.[holeNum]?.strokes != null && r?.entries?.[holeNum]?.putts != null);
    if (allIn) marker = holeNum;
  }
  return { marker, final: false };
}

function MatchResultsTab({ scoresStore, currentYear, isLive, currentEventId }) {
  const yr = useYearRoundData(isLive, currentYear);
  const [round, setRound] = useState(SCORE_ROUNDS[0]);
  const [liveTeams, setLiveTeams] = useState(null); // null = use mock TEAMS
  const [liveMatchups, setLiveMatchups] = useState(null); // null = use mock MATCHES_BY_ROUND
  const [liveMatchTotals, setLiveMatchTotals] = useState(null); // null = points not available live
  const [carrollRoster, setCarrollRoster] = useState({}); // playerId -> "red" | "blue"
  const [drilldown, setDrilldown] = useState(null); // { roundId, roundLabel, teamAId, teamBId, teamAName, teamBName } | null

  // Whenever the selected year's rounds load (or the year changes), make
  // sure the selected round label is actually one that exists for that
  // year — otherwise default to the first one.
  useEffect(() => {
    if (!isLive) return;
    if (yr.rounds.length === 0) return;
    if (!yr.rounds.some((r) => r.label === round)) setRound(yr.rounds[0].label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, yr.rounds]);

  // Pulls whatever's actually configured on Admin > Matchup setup, instead
  // of the frozen mock schedule — this is what makes a newly-added round's
  // matchups actually show up here. Match totals are the real points, once
  // both teams have submitted scores for that round (v_team_match_totals
  // only has rows for holes that are actually scored). Scoped to whichever
  // year is selected here, independent of the global Current Year.
  useEffect(() => {
    if (!isLive || !yr.selectedEventId) {
      setLiveTeams(null);
      setLiveMatchups(null);
      setLiveMatchTotals(null);
      setCarrollRoster({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [teamsData, matchupsData, matchTotalsData, rosterData] = await Promise.all([
          fetchTeams(yr.selectedEventId),
          fetchRoundMatchups(yr.selectedEventId),
          fetchTeamMatchTotals(yr.selectedEventId),
          fetchCarrollCupRoster(yr.selectedEventId),
        ]);
        if (cancelled) return;
        setLiveTeams(
          teamsData.map((t) => ({
            id: t.id,
            name: t.name,
            playerAId: t.player_a_id,
            players: [PLAYERS.find((p) => p.id === t.player_a_id)?.name, PLAYERS.find((p) => p.id === t.player_b_id)?.name].filter(Boolean),
          }))
        );
        setLiveMatchups(matchupsData);
        setLiveMatchTotals(matchTotalsData);
        setCarrollRoster(Object.fromEntries(rosterData.map((r) => [r.player_id, r.side])));
      } catch (err) {
        console.error("Failed to load live matches:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, yr.selectedEventId]);

  const teamsSource = liveTeams || TEAMS;
  const liveRound = isLive ? yr.rounds.find((r) => r.label === round) : null;
  const course = isLive ? (liveRound ? COURSES.find((c) => c.id === liveRound.courseId) : null) || COURSES[0] : ROUND_COURSE[round] || COURSES[0];
  const totalPar = useMemo(() => course.holes.reduce((s, h) => s + h.par, 0), [course]);

  const getHandicap = (playerName) => {
    const player = PLAYERS.find((p) => p.name === playerName);
    if (!player) return null;
    return calcCourseHandicap(player.handicapIndex, course.slope, course.rating, totalPar);
  };

  // Live matchups reference teams by id, not name — resolve against whichever
  // team list is currently loaded (live or mock) before scoring/rendering.
  // Points come from v_team_match_totals when available; a matchup with no
  // scored holes yet just won't have a matching row, so it stays "–".
  const matches = useMemo(() => {
    const list = liveMatchups
      ? liveMatchups
          .filter((m) => m.roundLabel === round)
          .map((m) => {
            const totals = (liveMatchTotals || []).find((t) => t.matchup_id === m.id);
            const isSingles = m.matchType === "singles";
            const teamAObj = isSingles ? null : (liveTeams || []).find((t) => t.id === m.teamAId);
            const teamBObj = isSingles ? null : (liveTeams || []).find((t) => t.id === m.teamBId);
            // Which player represents each side for Carroll Cup color — the
            // player themself for singles, or the team's first player (same
            // convention the Carroll Cup scoring itself uses).
            const carrollAId = isSingles ? m.playerAId : teamAObj?.playerAId;
            const carrollBId = isSingles ? m.playerBId : teamBObj?.playerAId;
            return {
              matchType: m.matchType,
              teamA: isSingles ? PLAYERS.find((p) => p.id === m.playerAId)?.name : teamAObj?.name,
              teamB: isSingles ? PLAYERS.find((p) => p.id === m.playerBId)?.name : teamBObj?.name,
              colorA: carrollRoster[carrollAId] || null,
              colorB: carrollRoster[carrollBId] || null,
              pointsA: totals ? totals.team_a_points : null,
              pointsB: totals ? totals.team_b_points : null,
              roundId: m.roundId,
              matchupId: m.id,
              teamAId: m.teamAId,
              teamBId: m.teamBId,
            };
          })
      : MATCHES_BY_ROUND[round] || [];
    const withProgress = list.map((m) => ({ ...m, progress: computeMatchProgress(m, round, scoresStore, yr.selectedYear, teamsSource) }));
    return withProgress.sort((a, b) => {
      const av = a.progress.final ? 19 : a.progress.marker;
      const bv = b.progress.final ? 19 : b.progress.marker;
      return bv - av;
    });
  }, [liveMatchups, liveTeams, liveMatchTotals, carrollRoster, round, scoresStore, yr.selectedYear, teamsSource]);

  if (drilldown) {
    return (
      <div style={{ padding: "18px 20px 24px" }}>
        <MatchScorecard
          isLive={isLive}
          roundId={drilldown.roundId}
          roundLabel={drilldown.roundLabel}
          matchupId={drilldown.matchupId}
          teamAName={drilldown.teamAName}
          teamBName={drilldown.teamBName}
          onBack={() => setDrilldown(null)}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: "18px 20px 24px" }}>
      <div className="bco-display" style={{ fontSize: 20, fontWeight: 600, color: "#1B4332", marginBottom: 12 }}>
        Match Results
      </div>

      <YearRoundPicker years={yr.years} selectedYear={yr.selectedYear} setSelectedYear={yr.setSelectedYear} />

      <div style={{ marginBottom: 10 }}>
        <LightSelect
          value={round}
          onChange={setRound}
          options={(isLive && yr.rounds.length > 0 ? yr.rounds.map((r) => r.label) : SCORE_ROUNDS).map((r) => ({ value: r, label: r }))}
        />
      </div>

      <div style={{ fontSize: 10.5, color: "#A39C89", marginBottom: 14 }}>
        {yr.selectedYear} · {course.name} · course handicaps shown are for {round} · sorted by progress
      </div>

      {matches.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "32px 12px" }}>
          No matches recorded for {round} yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {matches.map((m, i) => {
            const teamAWon = m.pointsA != null && m.pointsA > m.pointsB;
            const teamBWon = m.pointsB != null && m.pointsB > m.pointsA;
            const teamAObj = teamsSource.find((t) => t.name === m.teamA);
            const teamBObj = teamsSource.find((t) => t.name === m.teamB);
            return (
              <div key={i} style={{ background: "#FFFFFF", border: "1px solid #E4DFCE", borderRadius: 12, overflow: "hidden" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 12px",
                    background: "#F7F4EA",
                    borderBottom: "1px solid #EFEBDE",
                  }}
                >
                  <span style={{ fontSize: 10, color: "#8A8371", fontWeight: 600 }}>
                    {m.teamA} vs {m.teamB}
                  </span>
                  <ProgressBadge progress={m.progress} />
                </div>

                <button
                  onClick={() =>
                    setDrilldown({
                      roundId: m.roundId,
                      roundLabel: round,
                      matchupId: m.matchupId,
                      teamAName: m.teamA,
                      teamBName: m.teamB,
                    })
                  }
                  style={{ display: "flex", width: "100%", borderBottom: "1px solid #EFEBDE", border: "none", borderBottomWidth: 1, padding: 0, background: "none", cursor: "pointer" }}
                >
                  <MatchTeamSide name={m.teamA} points={m.pointsA ?? "–"} won={teamAWon} color={m.colorA} />
                  <div style={{ width: 1, background: "#EFEBDE" }} />
                  <MatchTeamSide name={m.teamB} points={m.pointsB ?? "–"} won={teamBWon} color={m.colorB} />
                </button>
                <div style={{ display: "flex" }}>
                  <div style={{ flex: 1, padding: "10px 14px" }}>
                    {(teamAObj?.players || []).map((pl) => (
                      <PlayerRow key={pl} name={pl} handicap={getHandicap(pl)} />
                    ))}
                  </div>
                  <div style={{ width: 1, background: "#EFEBDE" }} />
                  <div style={{ flex: 1, padding: "10px 14px" }}>
                    {(teamBObj?.players || []).map((pl) => (
                      <PlayerRow key={pl} name={pl} handicap={getHandicap(pl)} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProgressBadge({ progress }) {
  if (progress.final) {
    return (
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          padding: "2px 8px",
          borderRadius: 999,
          background: "#1B4332",
          color: "#F3EFE2",
        }}
      >
        F
      </span>
    );
  }
  if (progress.marker === 0) {
    return <span style={{ fontSize: 10, color: "#B4AE9E" }}>Not started</span>;
  }
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 999,
        background: "#EDEAE0",
        color: "#3F3B32",
      }}
    >
      Thru {progress.marker}
    </span>
  );
}

const CARROLL_TAG_COLORS = {
  red: { bg: "#F7DCDA", fg: "#8C2F2A" },
  blue: { bg: "#DCE7F2", fg: "#26456B" },
};

function MatchTeamSide({ name, points, won, color }) {
  const tag = color ? CARROLL_TAG_COLORS[color] : null;
  return (
    <div style={{ flex: 1, padding: "12px 14px", textAlign: "center", background: won ? "#DCEFE3" : "transparent" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: won ? "#1B4332" : "#2C2A22" }}>{name}</span>
        {tag && (
          <span
            className="bco-mono"
            style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.02em", background: tag.bg, color: tag.fg, borderRadius: 999, padding: "2px 6px" }}
          >
            {color.toUpperCase()}
          </span>
        )}
      </div>
      <div className="bco-mono" style={{ fontSize: 20, fontWeight: 600, color: won ? "#1B4332" : "#6B6455", marginTop: 2 }}>
        {points}
      </div>
    </div>
  );
}

function PlayerRow({ name, handicap }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
      <span style={{ fontSize: 12.5, color: "#2C2A22" }}>{name}</span>
      <span className="bco-mono" style={{ fontSize: 12, fontWeight: 600, color: "#8A8371" }}>
        {handicap != null ? `CH ${handicap}` : "—"}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leaderboard tab
// ---------------------------------------------------------------------------
// Shared by Leaderboard, Matches, and Games — lets those (read-only)
// screens browse any year, completely independent of the global "Current
// Year" that Score entry writes against. Deliberately does NOT touch
// SCORE_ROUNDS/ROUND_ID_BY_LABEL/ROUND_COURSE/ROUND_FLAGS (those drive
// Score entry) — mutating those from a browsing screen would silently
// redirect where a score gets saved if someone switched tabs mid-browse.
function useYearRoundData(isLive, defaultYear) {
  const [years, setYears] = useState([defaultYear]);
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [rounds, setRounds] = useState([]); // [{label, id, courseId, countsForSolo, countsForTeam, countsForCarrollCup, appliesSkins, appliesPoker, appliesLowNet, appliesCtp}]
  const [loading, setLoading] = useState(isLive);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    (async () => {
      try {
        const events = await fetchEvents();
        if (cancelled || events.length === 0) return;
        setYears(events.map((e) => e.year).sort((a, b) => b - a));
      } catch (err) {
        console.error("Failed to load events:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive]);

  useEffect(() => {
    if (!isLive) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const event = await fetchEventByYear(selectedYear);
        if (cancelled) return;
        if (!event) {
          setSelectedEventId(null);
          setRounds([]);
          return;
        }
        setSelectedEventId(event.id);
        const dbRounds = await fetchRounds(event.id);
        if (cancelled) return;
        const sorted = [...dbRounds].sort((a, b) => (a.round_order ?? 0) - (b.round_order ?? 0));
        setRounds(
          sorted.map((r) => ({
            label: r.label,
            id: r.id,
            courseId: r.course_id,
            countsForSolo: r.counts_for_solo !== false,
            countsForTeam: r.counts_for_team !== false,
            countsForCarrollCup: r.counts_for_carroll_cup === true,
            appliesSkins: r.applies_skins !== false,
            appliesPoker: r.applies_poker !== false,
            appliesLowNet: r.applies_low_net !== false,
            appliesCtp: r.applies_ctp !== false,
          }))
        );
      } catch (err) {
        console.error("Failed to load rounds for year:", err);
        setError(err.message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, selectedYear]);

  return { years, selectedYear, setSelectedYear, selectedEventId, rounds, loading, error };
}

function YearRoundPicker({ years, selectedYear, setSelectedYear }) {
  if (years.length <= 1) return null;
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 12 }}>
      {years.map((y) => (
        <YearPill key={y} label={String(y)} active={selectedYear === y} onClick={() => setSelectedYear(y)} />
      ))}
    </div>
  );
}

function Leaderboard({ isLive, currentEventId, currentYear }) {
  const [mode, setMode] = useState("solo");
  const [scoreView, setScoreView] = useState("net"); // "net" | "gross" — Solo only
  const [displayUnit, setDisplayUnit] = useState("toPar"); // "toPar" | "strokes" — Solo only
  const yr = useYearRoundData(isLive, currentYear);
  const lastRoundLabel = yr.rounds.length > 0 ? yr.rounds[yr.rounds.length - 1].label : SCORE_ROUNDS[SCORE_ROUNDS.length - 1];

  return (
    <div style={{ padding: "18px 20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <span className="bco-display" style={{ fontSize: 20, fontWeight: 600, color: "#1B4332" }}>
          Leaderboard
        </span>
        <span style={{ fontSize: 11, color: "#8A8371" }}>through {lastRoundLabel}</span>
      </div>

      <YearRoundPicker years={yr.years} selectedYear={yr.selectedYear} setSelectedYear={yr.setSelectedYear} />

      <div className="bco-seg" style={{ marginBottom: 12 }}>
        <button className={`bco-seg-btn${mode === "solo" ? " active" : ""}`} onClick={() => setMode("solo")}>
          Solo
        </button>
        <button className={`bco-seg-btn${mode === "team" ? " active" : ""}`} onClick={() => setMode("team")}>
          Team
        </button>
        <button className={`bco-seg-btn${mode === "carroll" ? " active" : ""}`} onClick={() => setMode("carroll")}>
          Carroll Cup
        </button>
      </div>

      {mode === "solo" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <div className="bco-seg" style={{ flex: 1 }}>
            <button className={`bco-seg-btn${scoreView === "net" ? " active" : ""}`} onClick={() => setScoreView("net")}>
              Net
            </button>
            <button className={`bco-seg-btn${scoreView === "gross" ? " active" : ""}`} onClick={() => setScoreView("gross")}>
              Gross
            </button>
          </div>
          <div className="bco-seg" style={{ flex: 1 }}>
            <button className={`bco-seg-btn${displayUnit === "strokes" ? " active" : ""}`} onClick={() => setDisplayUnit("strokes")}>
              Strokes
            </button>
            <button className={`bco-seg-btn${displayUnit === "toPar" ? " active" : ""}`} onClick={() => setDisplayUnit("toPar")}>
              To Par
            </button>
          </div>
        </div>
      )}

      {isLive && yr.error && (
        <div style={{ marginBottom: 12 }}>
          <Banner tone="error">Couldn't load {yr.selectedYear} ({yr.error}) — showing local demo data instead.</Banner>
        </div>
      )}
      {isLive && yr.loading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 12 }}>Loading {yr.selectedYear}…</div>}

      {!yr.loading && mode === "solo" && (
        <SoloTable scoreView={scoreView} displayUnit={displayUnit} isLive={isLive} currentEventId={yr.selectedEventId} currentYear={yr.selectedYear} roundsData={yr.rounds} />
      )}
      {!yr.loading && mode === "team" && (
        <TeamTable isLive={isLive} currentEventId={yr.selectedEventId} currentYear={yr.selectedYear} roundsData={yr.rounds} />
      )}
      {!yr.loading && mode === "carroll" && <CarrollCupTable isLive={isLive} currentEventId={yr.selectedEventId} roundsData={yr.rounds} />}

      <div style={{ marginTop: 14, fontSize: 10.5, color: "#A39C89", lineHeight: 1.5 }}>
        {mode === "solo" &&
          (scoreView === "net"
            ? "Place is always by Net-to-par across counted rounds, regardless of which toggle is shown. Struck-through round is the dropped high score."
            : "Gross is raw score, no handicap applied. Shown for reference — place is always by Net-to-par.")}
        {mode === "team" && "Points are 1 per hole win, 1/2 per tie, summed across matches."}
        {mode === "carroll" && "Points are 1 per match win, 1/2 per tie, 0 per loss — decided by total net score, not per hole."}
      </div>
    </div>
  );
}

function SoloTable({ scoreView, displayUnit, isLive, currentEventId, currentYear, roundsData }) {
  // Omit a round's column entirely if its "Solo" checkbox is unchecked on
  // Round setup. Uses roundsData (this year's real rounds, resolved by
  // Leaderboard's own year picker) rather than the global SCORE_ROUNDS —
  // that global reflects whatever year Score entry is currently writing
  // to, which may not be the year being browsed here. Offline/mock mode
  // falls back to the mock shape.
  const rounds = isLive
    ? roundsData.filter((r) => r.countsForSolo).map((r) => r.label)
    : SCORE_ROUNDS.filter((label) => ROUND_FLAGS[label]?.countsForSolo !== false);
  const [drilldown, setDrilldown] = useState(null); // { playerName, roundLabel } | null
  const [liveRows, setLiveRows] = useState(null); // null = use mock soloResults
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);

  useEffect(() => {
    if (!isLive || !currentEventId) {
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [standings, netTotals, grossTotals] = await Promise.all([
          fetchSoloStandings(currentEventId),
          fetchSoloRoundTotals(currentEventId),
          fetchSoloRoundGrossTotals(currentEventId),
        ]);
        if (cancelled) return;

        const localRoundIdByLabel = Object.fromEntries((roundsData || []).map((r) => [r.label, r.id]));
        const roundIdToLabel = {};
        rounds.forEach((label) => {
          const id = localRoundIdByLabel[label];
          if (id) roundIdToLabel[id] = label;
        });

        const rows = standings
          .map((s) => {
            const player = PLAYERS.find((p) => p.id === s.player_id);
            const myNet = netTotals.filter((r) => r.player_id === s.player_id);
            const myGross = grossTotals.filter((r) => r.player_id === s.player_id);

            const roundsNet = rounds.map((label) => {
              const roundId = localRoundIdByLabel[label];
              const match = myNet.find((r) => r.round_id === roundId);
              return match ? match.net_to_par_total : null;
            });
            const roundsGross = rounds.map((label) => {
              const roundId = localRoundIdByLabel[label];
              const match = myGross.find((r) => r.round_id === roundId);
              return match ? match.gross_to_par_total : null;
            });

            // Which round got dropped — the highest counted value. Matches
            // the sum-max trick in v_solo_standings; if there's a tie for
            // highest, this picks the first occurrence, same as the mock
            // did.
            let droppedIndex = -1;
            if (s.rounds_played > 1) {
              let maxVal = -Infinity;
              roundsNet.forEach((v, i) => {
                if (v != null && v > maxVal) {
                  maxVal = v;
                  droppedIndex = i;
                }
              });
            }

            return {
              name: player?.name || `Player ${s.player_id}`,
              rounds: roundsNet,
              roundsGross,
              total: s.total_net_to_par,
              totalAllRounds: s.total_net_to_par_all_rounds,
              droppedIndex,
            };
          })
          .sort((a, b) => a.total - b.total || a.totalAllRounds - b.totalAllRounds);

        setLiveRows(rows);
      } catch (err) {
        console.error("Failed to load live solo standings:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, currentEventId]);

  if (drilldown) {
    return (
      <SoloRoundScorecard
        playerName={drilldown.playerName}
        roundLabel={drilldown.roundLabel}
        onBack={() => setDrilldown(null)}
        isLive={isLive}
        roundsData={roundsData}
      />
    );
  }

  const rows = liveRows || soloResults.map((p) => ({ name: p.name, rounds: p.rounds, roundsGross: p.roundsGross, total: p.total, totalAllRounds: p.total, droppedIndex: p.droppedIndex }));

  const showEmptyState = isLive && !liveLoading && !liveError && liveRows && liveRows.length === 0;
  const showTable = !liveLoading && !showEmptyState;

  return (
    <div>
      {isLive && liveError && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't load live standings ({liveError}) — showing local demo data instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 10 }}>Loading standings…</div>}
      {showEmptyState && (
        <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "24px 12px" }}>
          No submitted solo rounds yet for {currentYear}.
        </div>
      )}
      {showTable && (
        <table className="bco-table">
          <thead>
            <tr>
              <th style={{ width: 22 }}>#</th>
              <th>Player</th>
              {rounds.map((r) => (
                <th key={r} style={{ textAlign: "center" }}>
                  {r}
                </th>
              ))}
              <th style={{ textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Place is always by Net-to-par (p.total), regardless of the
              // Net/Gross or Strokes/To Par toggles — standard competition
              // ranking, with ties broken by totalAllRounds (the rule
              // book's tiebreaker) before anyone actually shares a rank.
              let currentRank = 0;
              let prevKey = null;
              const ranks = rows.map((p, i) => {
                const key = `${p.total}-${p.totalAllRounds ?? 0}`;
                if (prevKey === null || key !== prevKey) {
                  currentRank = i + 1;
                  prevKey = key;
                }
                return currentRank;
              });
              const parForRound = (label) => {
                if (isLive) {
                  const r = (roundsData || []).find((rd) => rd.label === label);
                  const course = r ? COURSES.find((c) => c.id === r.courseId) : null;
                  return course ? course.holes.reduce((s, h) => s + h.par, 0) : 0;
                }
                const course = ROUND_COURSE[label];
                return course ? course.holes.reduce((s, h) => s + h.par, 0) : 0;
              };

              return rows.map((p, i) => {
                const rank = ranks[i];
                const isTie = rows.filter((r) => r.total === p.total && (r.totalAllRounds ?? 0) === (p.totalAllRounds ?? 0)).length > 1;
                const medal = rank === 1 ? MEDAL_TONES.gold : rank === 2 ? MEDAL_TONES.silver : rank === 3 ? MEDAL_TONES.bronze : null;
                const displayRounds = scoreView === "gross" ? p.roundsGross : p.rounds;
                const effectiveDropIdx = scoreView === "net" ? p.droppedIndex : -1;
                const displayTotalToPar = scoreView === "gross" ? displayRounds.reduce((s, v) => s + (v ?? 0), 0) : p.total;
                const countedPar = rounds.reduce((sum, label, idx) => {
                  if (idx === effectiveDropIdx || displayRounds[idx] == null) return sum;
                  return sum + parForRound(label);
                }, 0);
                const displayTotal = displayUnit === "strokes" ? displayTotalToPar + countedPar : displayTotalToPar;
                const totalTone = diffTone(displayTotalToPar);
                return (
                  <tr key={p.name}>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className="bco-mono"
                        style={{
                          fontSize: 12.5,
                          fontWeight: medal ? 700 : 400,
                          color: medal ? medal.fg : "#8A8371",
                          background: medal ? medal.bg : "transparent",
                          borderRadius: 999,
                          padding: medal ? "2px 7px" : 0,
                        }}
                      >
                        {isTie ? `T${rank}` : rank}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 500, color: "#2C2A22" }}>{p.name}</td>
                    {rounds.map((r, ri) => {
                      const v = displayRounds[ri];
                      const dropped = ri === effectiveDropIdx;
                      if (v == null) {
                        return (
                          <td key={ri} style={{ textAlign: "center", fontSize: 12, color: "#D8D2C2" }}>
                            –
                          </td>
                        );
                      }
                      const tone = diffTone(v);
                      const shown = displayUnit === "strokes" ? v + parForRound(r) : fmtDiff(v);
                      return (
                        <td key={ri} style={{ textAlign: "center" }}>
                          <button
                            onClick={() => setDrilldown({ playerName: p.name, roundLabel: r })}
                            className="bco-mono"
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              padding: "2px 7px",
                              borderRadius: 999,
                              background: dropped ? "transparent" : tone.bg,
                              color: dropped ? "#B4AE9E" : tone.fg,
                              textDecoration: dropped ? "line-through" : "none",
                              border: "none",
                              cursor: "pointer",
                              fontFamily: "'IBM Plex Mono', monospace",
                            }}
                          >
                            {shown}
                          </button>
                        </td>
                      );
                    })}
                    <td style={{ textAlign: "right" }}>
                      <span
                        className="bco-mono"
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          padding: "3px 9px",
                          borderRadius: 999,
                          background: totalTone.bg,
                          color: totalTone.fg,
                        }}
                      >
                        {displayUnit === "strokes" ? displayTotal : fmtDiff(displayTotal)}
                      </span>
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Solo round scorecard drill-down — broadcast-style markers (circle =
// birdie, double circle = eagle or better, plain = par, box = bogey,
// double box = double bogey or worse). Reads real hole-by-hole data from
// Supabase when live; falls back to a deterministic mock generator
// otherwise (seeded by player+round+hole, same as before).
// ---------------------------------------------------------------------------
function generateSoloRoundHoles(course, player, roundLabel) {
  const totalPar = course.holes.reduce((s, h) => s + h.par, 0);
  const courseHandicap = player ? calcCourseHandicap(player.handicapIndex, course.slope, course.rating, totalPar) : 0;

  return course.holes.map((h) => {
    const rand = seededRand(`${player?.name || "player"}-${roundLabel}-${h.number}-solo`);
    const roll = rand();
    let diff;
    if (roll < 0.05) diff = -2;
    else if (roll < 0.25) diff = -1;
    else if (roll < 0.72) diff = 0;
    else if (roll < 0.93) diff = 1;
    else diff = 2;

    const strokes = Math.max(1, h.par + diff);
    const puttsRoll = rand();
    const putts = puttsRoll < 0.15 ? 1 : puttsRoll < 0.8 ? 2 : puttsRoll < 0.95 ? 3 : 2;

    const strokeReceived = strokesForHole(courseHandicap, h.handicap, course.holes.length);
    const netStrokes = Math.min(strokes - strokeReceived, h.par + NET_DOUBLE_BOGEY);

    return { ...h, strokes, netStrokes, putts };
  });
}

function ScoreMark({ value, par }) {
  const diff = value - par;
  const num = (
    <span className="bco-mono" style={{ fontSize: 13.5, fontWeight: 600, color: "#2C2A22" }}>
      {value}
    </span>
  );
  if (!diff) return num;
  const isCircle = diff < 0;
  const isDouble = Math.abs(diff) >= 2;
  const ring = (size, inset) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: size,
    height: size,
    border: "1.5px solid #1B4332",
    borderRadius: isCircle ? "50%" : "4px",
    boxSizing: "border-box",
  });
  if (!isDouble) return <span style={ring(23)}>{num}</span>;
  return (
    <span style={ring(29)}>
      <span style={ring(21)}>{num}</span>
    </span>
  );
}

function ScorecardNine({ title, holes, totalLabel }) {
  const parOut = holes.reduce((s, h) => s + h.par, 0);
  const grossOut = holes.reduce((s, h) => s + h.strokes, 0);
  const netOut = holes.reduce((s, h) => s + h.netStrokes, 0);
  const puttsOut = holes.reduce((s, h) => s + h.putts, 0);

  const cellStyle = { padding: "8px 4px", textAlign: "center", borderBottom: "1px solid #E4DFCE" };
  const labelStyle = { padding: "8px 8px", fontSize: 11, fontWeight: 600, color: "#3F3B32", borderBottom: "1px solid #E4DFCE", background: "#F3EFE2" };

  return (
    <div style={{ border: "1px solid #E4DFCE", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...labelStyle, background: "#1B4332", color: "#F3EFE2", textAlign: "left" }}>Hole</th>
            {holes.map((h) => (
              <th key={h.number} className="bco-mono" style={{ ...cellStyle, background: "#1B4332", color: "#F3EFE2", fontWeight: 600, borderBottom: "none" }}>
                {h.number}
              </th>
            ))}
            <th className="bco-mono" style={{ ...cellStyle, background: "#1B4332", color: "#F3EFE2", fontWeight: 600, borderBottom: "none" }}>
              {title}
            </th>
            <th className="bco-mono" style={{ ...cellStyle, background: "#1B4332", color: "#F3EFE2", fontWeight: 600, borderBottom: "none" }}>
              {totalLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={labelStyle}>Par</td>
            {holes.map((h) => (
              <td key={h.number} className="bco-mono" style={cellStyle}>
                {h.par}
              </td>
            ))}
            <td className="bco-mono" style={{ ...cellStyle, fontWeight: 600 }}>
              {parOut}
            </td>
            <td className="bco-mono" style={{ ...cellStyle, fontWeight: 600 }}>
              {parOut}
            </td>
          </tr>
          <tr style={{ background: "#F9F7F0" }}>
            <td style={{ ...labelStyle, background: "#F9F7F0" }}>Stroke Index</td>
            {holes.map((h) => (
              <td key={h.number} className="bco-mono" style={{ ...cellStyle, color: "#8A8371" }}>
                {h.handicap}
              </td>
            ))}
            <td style={cellStyle}></td>
            <td style={cellStyle}></td>
          </tr>
          <tr>
            <td style={labelStyle}>Gross</td>
            {holes.map((h) => (
              <td key={h.number} style={cellStyle}>
                <ScoreMark value={h.strokes} par={h.par} />
              </td>
            ))}
            <td className="bco-mono" style={{ ...cellStyle, fontWeight: 600 }}>
              {grossOut}
            </td>
            <td className="bco-mono" style={{ ...cellStyle, fontWeight: 600 }}>
              {grossOut}
            </td>
          </tr>
          <tr style={{ background: "#F9F7F0" }}>
            <td style={{ ...labelStyle, background: "#F9F7F0" }}>Net</td>
            {holes.map((h) => (
              <td key={h.number} style={cellStyle}>
                <ScoreMark value={h.netStrokes} par={h.par} />
              </td>
            ))}
            <td className="bco-mono" style={{ ...cellStyle, fontWeight: 600 }}>
              {netOut}
            </td>
            <td className="bco-mono" style={{ ...cellStyle, fontWeight: 600 }}>
              {netOut}
            </td>
          </tr>
          <tr>
            <td style={labelStyle}>Putts</td>
            {holes.map((h) => (
              <td key={h.number} className="bco-mono" style={cellStyle}>
                {h.putts}
              </td>
            ))}
            <td className="bco-mono" style={{ ...cellStyle, fontWeight: 600 }}>
              {puttsOut}
            </td>
            <td className="bco-mono" style={{ ...cellStyle, fontWeight: 600 }}>
              {puttsOut}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SoloRoundScorecard({ playerName, roundLabel, onBack, isLive, roundsData }) {
  const player = PLAYERS.find((p) => p.name === playerName);
  const liveRound = isLive ? (roundsData || []).find((r) => r.label === roundLabel) : null;
  const course = isLive ? (liveRound ? COURSES.find((c) => c.id === liveRound.courseId) : null) || COURSES[0] : ROUND_COURSE[roundLabel] || COURSES[0];
  const roundId = isLive ? liveRound?.id || null : ROUND_ID_BY_LABEL[roundLabel] || null;

  const [liveHoles, setLiveHoles] = useState(null); // null = use mock generator
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);

  useEffect(() => {
    if (!isLive || !roundId || !player) {
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [netScores, rawScores] = await Promise.all([fetchHoleNetScores(roundId, player.id), fetchScoresForRound(roundId, player.id)]);
        if (cancelled) return;
        if (netScores.length === 0) {
          // Round not submitted / not scored yet — nothing real to show.
          setLiveHoles([]);
        } else {
          const merged = netScores
            .map((h) => ({
              number: h.hole_number,
              par: h.par,
              handicap: h.handicap_rank,
              strokes: h.strokes,
              netStrokes: h.net_strokes,
              putts: rawScores.entries?.[h.hole_number]?.putts ?? null,
            }))
            .sort((a, b) => a.number - b.number);
          setLiveHoles(merged);
        }
      } catch (err) {
        console.error("Failed to load real scorecard:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, roundId, player?.id]);

  const holes = useMemo(() => {
    if (liveHoles && liveHoles.length > 0) return liveHoles;
    if (isLive && liveHoles && liveHoles.length === 0) return []; // real: genuinely nothing scored yet
    return generateSoloRoundHoles(course, player, roundLabel);
  }, [liveHoles, isLive, course, player, roundLabel]);

  const isRealData = isLive && liveHoles != null;
  const front = holes.slice(0, 9);
  const back = holes.slice(9, 18);
  const totalScore = holes.reduce((s, h) => s + h.strokes, 0);
  const totalPar = holes.reduce((s, h) => s + h.par, 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
        <button onClick={onBack} style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", color: "#6B6455" }} aria-label="Back to standings">
          <ChevronLeft size={18} />
        </button>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1B4332" }}>
            {playerName} · {roundLabel}
          </div>
          <div style={{ fontSize: 10.5, color: "#8A8371" }}>
            {course.name} {holes.length > 0 && `· ${totalScore} (${fmtDiff(totalScore - totalPar)})`}
          </div>
        </div>
      </div>

      {liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 10 }}>Loading scorecard…</div>}
      {liveError && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't load the real scorecard ({liveError}) — showing illustrative data instead.</Banner>
        </div>
      )}

      {!liveLoading && holes.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "24px 12px" }}>
          No scores saved for {playerName} in {roundLabel} yet.
        </div>
      ) : (
        !liveLoading && (
          <>
            <div style={{ fontSize: 10, color: "#A39C89", marginBottom: 10, lineHeight: 1.5 }}>
              ○ birdie · ◎ eagle+ · plain par · ▢ bogey · ▣ double bogey+.{" "}
              {isRealData ? "Real scores from Score entry." : "Hole-by-hole data is illustrative until real scores feed the leaderboard."}
            </div>
            <ScorecardNine title="Out" holes={front} totalLabel="Total" />
            {back.length > 0 && <ScorecardNine title="In" holes={back} totalLabel="Total" />}
          </>
        )
      )}
    </div>
  );
}

function TeamTable({ isLive, currentEventId, currentYear, roundsData }) {
  // Omit a round's column entirely if its "Team" checkbox is unchecked on
  // Round setup. Uses roundsData (resolved by Leaderboard's own year
  // picker), not the global SCORE_ROUNDS/ROUND_FLAGS.
  const rounds = isLive
    ? roundsData.filter((r) => r.countsForTeam).map((r) => r.label)
    : SCORE_ROUNDS.filter((label) => ROUND_FLAGS[label]?.countsForTeam !== false);
  const [drilldown, setDrilldown] = useState(null); // { roundId, roundLabel, teamAId, teamBId, teamAName, teamBName } | null
  const [liveRows, setLiveRows] = useState(null); // null = use mock teamResults
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);

  useEffect(() => {
    if (!isLive || !currentEventId) {
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [dbTeams, standings, matchTotals] = await Promise.all([
          fetchTeams(currentEventId),
          fetchTeamStandings(currentEventId),
          fetchTeamMatchTotals(currentEventId),
        ]);
        if (cancelled) return;

        const teamIdToName = (id) => dbTeams.find((t) => t.id === id)?.name || standings.find((s) => s.team_id === id)?.name || `Team ${id}`;

        const rows = standings
          .map((s) => {
            const teamMeta = dbTeams.find((t) => t.id === s.team_id);
            const playerAName = PLAYERS.find((p) => p.id === teamMeta?.player_a_id)?.name || "?";
            const playerBName = PLAYERS.find((p) => p.id === teamMeta?.player_b_id)?.name || "?";
            const teamMatches = matchTotals.filter((m) => m.team_a_id === s.team_id || m.team_b_id === s.team_id);

            const roundsDetail = rounds.map((label) => {
              const match = teamMatches.find((m) => m.roundLabel === label);
              if (!match) return null;
              const myPoints = match.team_a_id === s.team_id ? match.team_a_points : match.team_b_points;
              const opponentId = match.team_a_id === s.team_id ? match.team_b_id : match.team_a_id;
              return {
                points: myPoints,
                roundId: match.round_id,
                matchupId: match.matchup_id,
                teamAId: match.team_a_id,
                teamBId: match.team_b_id,
                teamAName: teamIdToName(match.team_a_id),
                teamBName: teamIdToName(match.team_b_id),
                opponentName: teamIdToName(opponentId),
              };
            });

            return {
              id: s.team_id,
              name: s.name,
              playerA: playerAName,
              playerB: playerBName,
              roundsDetail,
              points: s.total_points,
            };
          })
          .sort((a, b) => b.points - a.points);

        setLiveRows(rows);
      } catch (err) {
        console.error("Failed to load live team standings:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, currentEventId]);

  if (drilldown) {
    return (
      <MatchScorecard
        isLive={isLive}
        roundId={drilldown.roundId}
        roundLabel={drilldown.roundLabel}
        matchupId={drilldown.matchupId}
        teamAName={drilldown.teamAName}
        teamBName={drilldown.teamBName}
        onBack={() => setDrilldown(null)}
      />
    );
  }

  const rows =
    liveRows ||
    teamResults.map((t) => {
      const [playerA, playerB] = t.players.split(" / ");
      return {
        id: t.name,
        name: t.name,
        playerA,
        playerB,
        roundsDetail: t.pointsByRound.map((v) => (v == null ? null : { points: v, roundId: null, teamAId: null, teamBId: null })),
        points: t.points,
      };
    });

  const showEmptyState = isLive && !liveLoading && !liveError && liveRows && liveRows.length === 0;
  const showTable = !liveLoading && !showEmptyState;

  return (
    <div>
      {isLive && liveError && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't load live standings ({liveError}) — showing local demo data instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 10 }}>Loading standings…</div>}
      {showEmptyState && (
        <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "24px 12px" }}>
          No team matches recorded yet for {currentYear}.
        </div>
      )}
      {showTable && (
        <table className="bco-table">
          <thead>
            <tr>
              <th style={{ width: 22 }}>#</th>
              <th>Team</th>
              {rounds.map((r) => (
                <th key={r} style={{ textAlign: "center" }}>
                  {r}
                </th>
              ))}
              <th style={{ textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let currentRank = 0;
              let prevPoints = null;
              const ranks = rows.map((t, i) => {
                if (prevPoints === null || t.points !== prevPoints) {
                  currentRank = i + 1;
                  prevPoints = t.points;
                }
                return currentRank;
              });
              return rows.map((t, i) => {
                const rank = ranks[i];
                const medal = rank === 1 ? MEDAL_TONES.gold : rank === 2 ? MEDAL_TONES.silver : rank === 3 ? MEDAL_TONES.bronze : null;
                return (
                  <tr key={t.id}>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className="bco-mono"
                        style={{
                          fontSize: 12.5,
                          fontWeight: medal ? 700 : 400,
                          color: medal ? medal.fg : "#8A8371",
                          background: medal ? medal.bg : "transparent",
                          borderRadius: 999,
                          padding: medal ? "2px 7px" : 0,
                        }}
                      >
                        {rank}
                      </span>
                    </td>
                <td>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#2C2A22" }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "#8A8371", marginTop: 1 }}>{t.playerA}</div>
                  <div style={{ fontSize: 11, color: "#8A8371" }}>{t.playerB}</div>
                </td>
                {rounds.map((r, ri) => {
                  const detail = t.roundsDetail[ri];
                  if (detail == null) {
                    return (
                      <td key={ri} style={{ textAlign: "center", fontSize: 12.5, color: "#D8D2C2" }}>
                        –
                      </td>
                    );
                  }
                  return (
                    <td key={ri} style={{ textAlign: "center" }}>
                      <button
                        onClick={() => setDrilldown({ roundId: detail.roundId, roundLabel: r, matchupId: detail.matchupId, teamAName: detail.teamAName, teamBName: detail.teamBName })}
                        className="bco-mono"
                        style={{ fontSize: 12.5, color: "#2C2A22", border: "none", background: "none", cursor: "pointer", padding: "2px 4px" }}
                      >
                        {detail.points}
                      </button>
                    </td>
                  );
                })}
                <td style={{ textAlign: "right" }}>
                  <span className="bco-mono" style={{ fontSize: 16, fontWeight: 600, color: "#1B4332" }}>
                    {t.points}
                  </span>
                </td>
              </tr>
                );
              });
            })()}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match scorecard — the one shared hole-by-hole view for a team matchup,
// used from both Matches and the Team leaderboard drill-down. Deliberately
// simple: Team A net best ball, Team B net best ball, and points for each,
// per hole. Reads real data from v_team_hole_points — no mock fallback,
// since the whole point is that this is the real computation, and both
// call sites already know whether they have real team/round ids to pass in.
// ---------------------------------------------------------------------------
function PointsBadge({ points }) {
  const tone = points === 1 ? { bg: "#DCEFE3", fg: "#1B4332" } : points === 0 ? { bg: "#F7DCDA", fg: "#8C2F2A" } : { bg: "#EDEAE0", fg: "#3F3B32" };
  return (
    <span
      className="bco-mono"
      style={{ display: "inline-block", minWidth: 26, padding: "2px 0", borderRadius: 999, fontSize: 12, fontWeight: 600, background: tone.bg, color: tone.fg }}
    >
      {points}
    </span>
  );
}

function MatchScorecard({ isLive, roundId, roundLabel, matchupId, teamAName, teamBName, onBack }) {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const hasRealRefs = isLive && matchupId != null;

  useEffect(() => {
    if (!hasRealRefs) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await fetchTeamHolePoints(matchupId);
        if (cancelled) return;
        setRows(data);
      } catch (err) {
        console.error("Failed to load match scorecard:", err);
        setError(err.message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRealRefs, matchupId]);

  const totalA = (rows || []).reduce((s, r) => s + r.team_a_points, 0);
  const totalB = (rows || []).reduce((s, r) => s + r.team_b_points, 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
        <button onClick={onBack} style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", color: "#6B6455" }} aria-label="Back">
          <ChevronLeft size={18} />
        </button>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1B4332" }}>
            {teamAName} vs {teamBName} · {roundLabel}
          </div>
          {rows && rows.length > 0 && (
            <div style={{ fontSize: 10.5, color: "#8A8371" }}>
              {totalA} – {totalB}
            </div>
          )}
        </div>
      </div>

      {loading && <div style={{ fontSize: 12, color: "#8A8371" }}>Loading scorecard…</div>}
      {!loading && error && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't load the scorecard ({error}).</Banner>
        </div>
      )}
      {!loading && !error && !hasRealRefs && (
        <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "24px 12px" }}>
          Connect to Supabase to see the hole-by-hole scorecard for this match.
        </div>
      )}
      {!loading && !error && hasRealRefs && rows && rows.length === 0 && (
        <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "24px 12px" }}>
          No scores recorded yet for this match.
        </div>
      )}
      {!loading && rows && rows.length > 0 && (
        <table className="bco-table">
          <thead>
            <tr>
              <th style={{ width: 30 }}>Hole</th>
              <th style={{ textAlign: "center" }}>{teamAName}</th>
              <th style={{ textAlign: "center" }}>{teamBName}</th>
              <th style={{ textAlign: "center" }}>Pts A</th>
              <th style={{ textAlign: "center" }}>Pts B</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.hole_number}>
                <td className="bco-mono" style={{ fontSize: 12.5, color: "#8A8371" }}>
                  {r.hole_number}
                </td>
                <td
                  className="bco-mono"
                  style={{ textAlign: "center", fontSize: 13, fontWeight: r.team_a_points > r.team_b_points ? 600 : 400, color: r.team_a_points > r.team_b_points ? "#1B4332" : "#2C2A22" }}
                >
                  {r.team_a_net}
                </td>
                <td
                  className="bco-mono"
                  style={{ textAlign: "center", fontSize: 13, fontWeight: r.team_b_points > r.team_a_points ? 600 : 400, color: r.team_b_points > r.team_a_points ? "#1B4332" : "#2C2A22" }}
                >
                  {r.team_b_net}
                </td>
                <td style={{ textAlign: "center" }}>
                  <PointsBadge points={r.team_a_points} />
                </td>
                <td style={{ textAlign: "center" }}>
                  <PointsBadge points={r.team_b_points} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="bco-mono" style={{ fontSize: 12, fontWeight: 600, color: "#3F3B32" }}>
                Total
              </td>
              <td></td>
              <td></td>
              <td className="bco-mono" style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#1B4332" }}>
                {totalA}
              </td>
              <td className="bco-mono" style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#1B4332" }}>
                {totalB}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}

function CarrollCupTable({ isLive, currentEventId, roundsData }) {
  const [drilldown, setDrilldown] = useState(null); // round label | null
  const [drilldownMatches, setDrilldownMatches] = useState(null); // null = loading/mock
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [liveStandings, setLiveStandings] = useState(null); // { red_points, blue_points } | null
  const [liveRoundStandings, setLiveRoundStandings] = useState(null); // [{round_id, red_points, blue_points}] | null
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);

  const TEAM_COLORS = {
    red: { bg: "#F7DCDA", fg: "#8C2F2A", bar: "#C1554E", label: "Team Red" },
    blue: { bg: "#DCE7F2", fg: "#26456B", bar: "#4D7BAA", label: "Team Blue" },
  };

  useEffect(() => {
    if (!isLive || !currentEventId) {
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    setLiveLoading(true);
    (async () => {
      try {
        const [standings, roundStandings] = await Promise.all([fetchCarrollCupStandings(currentEventId), fetchCarrollCupRoundStandings(currentEventId)]);
        if (cancelled) return;
        setLiveStandings(standings);
        setLiveRoundStandings(roundStandings);
      } catch (err) {
        console.error("Failed to load Carroll Cup standings:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, currentEventId]);

  const isRealData = isLive && liveStandings != null;

  const standingsRows = isRealData
    ? [
        { team: "red", points: Number(liveStandings.red_points) },
        { team: "blue", points: Number(liveStandings.blue_points) },
      ]
    : CARROLL_CUP_STANDINGS;
  const totalPoints = standingsRows.reduce((s, t) => s + t.points, 0);
  const leader = standingsRows.reduce((a, b) => (b.points > a.points ? b : a));

  // Carroll Cup defaults to EXCLUDED unless a round is explicitly flagged
  // (unlike Solo/Team, which default to included).
  const roundRows = isLive
    ? roundsData
        .filter((r) => r.countsForCarrollCup)
        .map((r) => {
          const row = (liveRoundStandings || []).find((rs) => rs.round_id === r.id);
          return { label: r.label, id: r.id, red: row ? Number(row.red_points) : 0, blue: row ? Number(row.blue_points) : 0, hasMatches: !!row };
        })
    : SCORE_ROUNDS.filter((label) => ROUND_FLAGS[label]?.countsForCarrollCup === true || Object.keys(ROUND_FLAGS).length === 0).map((label) => {
        const matches = CARROLL_CUP_MATCHES_BY_ROUND[label] || [];
        return {
          label,
          id: null,
          red: matches.reduce((s, m) => s + m.redPoints, 0),
          blue: matches.reduce((s, m) => s + m.bluePoints, 0),
          hasMatches: matches.length > 0,
        };
      });

  const openDrilldown = async (roundRow) => {
    setDrilldown(roundRow.label);
    if (!isRealData) return;
    const roundId = roundRow.id;
    if (!roundId) {
      setDrilldownMatches([]);
      return;
    }
    setDrilldownLoading(true);
    try {
      const results = await fetchCarrollCupMatchResults(roundId);
      setDrilldownMatches(
        results.map((r) => ({
          red: r.a_color === "red" ? r.a_name : r.b_name,
          blue: r.a_color === "red" ? r.b_name : r.a_name,
          redPoints: r.a_color === "red" ? r.a_points : r.b_points,
          bluePoints: r.a_color === "red" ? r.b_points : r.a_points,
        }))
      );
    } catch (err) {
      console.error("Failed to load Carroll Cup matchup detail:", err);
      setDrilldownMatches([]);
    } finally {
      setDrilldownLoading(false);
    }
  };

  if (drilldown) {
    const matches = isRealData ? drilldownMatches : CARROLL_CUP_MATCHES_BY_ROUND[drilldown] || [];
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
          <button
            onClick={() => {
              setDrilldown(null);
              setDrilldownMatches(null);
            }}
            style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", color: "#6B6455" }}
            aria-label="Back"
          >
            <ChevronLeft size={18} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#1B4332" }}>Carroll Cup · {drilldown}</span>
        </div>

        {!isRealData && (
          <div style={{ fontSize: 10, color: "#A39C89", marginBottom: 10, lineHeight: 1.5 }}>Not connected to Supabase — showing local demo data.</div>
        )}

        {drilldownLoading ? (
          <div style={{ fontSize: 12, color: "#8A8371", textAlign: "center", padding: "20px 12px" }}>Loading…</div>
        ) : !matches || matches.length === 0 ? (
          <div style={{ fontSize: 12, color: "#B4AE9E", textAlign: "center", padding: "20px 12px" }}>
            No Carroll Cup matches recorded for {drilldown} yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {matches.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto 1fr",
                  alignItems: "center",
                  gap: 8,
                  background: "#FFFFFF",
                  border: "1px solid #E4DFCE",
                  borderRadius: 10,
                  padding: "9px 12px",
                }}
              >
                <div style={{ textAlign: "right", fontSize: 12.5, color: "#2C2A22" }}>{m.red}</div>
                <div className="bco-mono" style={{ fontSize: 13, fontWeight: 600, color: "#6B6455", whiteSpace: "nowrap" }}>
                  {m.redPoints} – {m.bluePoints}
                </div>
                <div style={{ fontSize: 12.5, color: "#2C2A22" }}>{m.blue}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {isLive && liveError && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't load live Carroll Cup data ({liveError}) — showing local demo data instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 10 }}>Loading…</div>}

      <div style={{ display: "flex", gap: 10 }}>
        {standingsRows.map((t) => {
          const c = TEAM_COLORS[t.team];
          const isLeader = t.team === leader.team;
          return (
            <div
              key={t.team}
              style={{
                flex: 1,
                background: c.bg,
                borderRadius: 12,
                padding: "16px 14px",
                textAlign: "center",
                border: isLeader ? `1.5px solid ${c.bar}` : "1px solid transparent",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: c.fg, letterSpacing: "0.02em" }}>
                {c.label.toUpperCase()}
                {isLeader && " ▲"}
              </div>
              <div className="bco-mono" style={{ fontSize: 30, fontWeight: 600, color: c.fg, marginTop: 4 }}>
                {t.points}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", marginTop: 12 }}>
        {standingsRows.map((t) => {
          const c = TEAM_COLORS[t.team];
          const pct = totalPoints ? (t.points / totalPoints) * 100 : 50;
          return <div key={t.team} style={{ width: `${pct}%`, background: c.bar }} />;
        })}
      </div>

      <div style={{ fontSize: 10, color: "#A39C89", margin: "14px 0 8px", lineHeight: 1.5 }}>
        Tap a round for that round's individual matchups.
      </div>

      <table className="bco-table">
        <thead>
          <tr>
            <th>Round</th>
            <th style={{ textAlign: "center", color: "#8C2F2A" }}>Red</th>
            <th style={{ textAlign: "center", color: "#26456B" }}>Blue</th>
          </tr>
        </thead>
        <tbody>
          {roundRows.map((r) => (
            <tr key={r.label}>
              <td>
                <button
                  onClick={() => openDrilldown(r)}
                  className="bco-mono"
                  style={{ fontSize: 13, fontWeight: 600, color: "#2C2A22", border: "none", background: "none", cursor: "pointer", padding: "4px 0" }}
                >
                  {r.label}
                </button>
              </td>
              <td className="bco-mono" style={{ textAlign: "center", fontSize: 13, color: r.hasMatches ? "#8C2F2A" : "#D8D2C2" }}>
                {r.hasMatches ? r.red : "–"}
              </td>
              <td className="bco-mono" style={{ textAlign: "center", fontSize: 13, color: r.hasMatches ? "#26456B" : "#D8D2C2" }}>
                {r.hasMatches ? r.blue : "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------
function StatusBadge({ status }) {
  const map = {
    submitted: { label: "Submitted", bg: "#DCEFE3", fg: "#1B4332" },
    "in-progress": { label: "In progress", bg: "#FBEAD9", fg: "#8A4B1E" },
  };
  const s = map[status] || { label: "Not started", bg: "#EDEAE0", fg: "#6B6455" };
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: 999,
        background: s.bg,
        color: s.fg,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

function Banner({ tone, children }) {
  const styles = tone === "error" ? { bg: "#F7DCDA", fg: "#8C2F2A", border: "#D98884" } : { bg: "#DCEFE3", fg: "#1B4332", border: "#6FAE8C" };
  return (
    <div style={{ fontSize: 13, padding: "9px 12px", borderRadius: 8, background: styles.bg, color: styles.fg, border: `1px solid ${styles.border}` }}>
      {children}
    </div>
  );
}

function StrokeBubble({ label, value, unavailable }) {
  const getsStroke = value === 1;
  return (
    <div
      style={{
        background: getsStroke ? "#DCEFE3" : "#F3EFE2",
        border: `1px solid ${getsStroke ? "#B7DCC6" : "#E4DFCE"}`,
        borderRadius: 8,
        padding: "7px 8px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 9.5, fontWeight: 600, color: "#8A8371", letterSpacing: "0.03em" }}>{label.toUpperCase()}</div>
      <div className="bco-mono" style={{ fontSize: 14, fontWeight: 600, color: getsStroke ? "#1B4332" : "#6B6455", marginTop: 1 }}>
        {unavailable ? "–" : value}
      </div>
    </div>
  );
}

function HcpBubble({ label, value }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.10)", borderRadius: 8, padding: "6px 4px", textAlign: "center" }}>
      <div style={{ fontSize: 9.5, fontWeight: 600, opacity: 0.75, letterSpacing: "0.03em" }}>{label}</div>
      <div className="bco-mono" style={{ fontSize: 15, fontWeight: 600, marginTop: 1 }}>
        {value}
      </div>
    </div>
  );
}

function TotalStat({ label, value, sub, emphasize }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#8A8371", letterSpacing: "0.03em" }}>{label}</div>
      <div className="bco-mono" style={{ fontSize: emphasize ? 24 : 20, fontWeight: 600, color: "#1B4332", marginTop: 2 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: "#A39C89" }}>{sub}</div>
    </div>
  );
}

function StubScreen({ icon: Icon, title, note }) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "40px 32px", color: "#8A8371" }}>
      <Icon size={26} strokeWidth={1.6} style={{ marginBottom: 10, color: "#B9B3A2" }} />
      <div className="bco-display" style={{ fontSize: 16, fontWeight: 600, color: "#3F3B32", marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 12.5, lineHeight: 1.5, maxWidth: 260 }}>{note}</div>
    </div>
  );
}
