// Generates sql/03_seed.sql from the same data already used as the app's
// built-in demo/fallback data, so the two stay consistent.
import fs from "node:fs";

const COURSES = [
  {
    id: 1, name: "Stonehedge South", tee: "Blue", rating: 72.9, slope: 135,
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
    id: 2, name: "Stonehedge North", tee: "Blue", rating: 71.4, slope: 128,
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
    id: 3, name: "The Preserve", tee: "Championship", rating: 73.5, slope: 140,
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

const PLAYERS = [
  { id: 1, name: "Tyler Jessel", handicapIndex: 6.4, hometown: "Chicago, IL", joined: 2023, bio: "Steady off the tee, dangerous with the putter under pressure." },
  { id: 2, name: "James Bublitz", handicapIndex: 14.1, hometown: "Madison, WI", joined: 2023, bio: "Grinder \u2014 best score always seems to come on the back nine." },
  { id: 3, name: "Collin Clark", handicapIndex: 11.0, hometown: "Milwaukee, WI", joined: 2024, bio: "Two-time podium finisher, hates 3-putts more than anyone alive." },
  { id: 4, name: "Quaid DeLacluyse", handicapIndex: 8.3, hometown: "Green Bay, WI", joined: 2025, bio: "Rookie-turned-contender, low-index and climbing fast." },
  { id: 5, name: "Mitchell Powers", handicapIndex: 11.8, hometown: "Chicago, IL", joined: 2024, bio: "Long off the tee, streaky with irons." },
  { id: 6, name: "Sam Losinski", handicapIndex: 9.6, hometown: "Minneapolis, MN", joined: 2024, bio: "Course management over power, rarely beats himself." },
  { id: 7, name: "Tommy Casey", handicapIndex: 6.9, hometown: "Chicago, IL", joined: 2024, bio: "Feast or famine \u2014 has the low round of the weekend most years." },
  { id: 8, name: "Evan Powers", handicapIndex: 1.8, hometown: "Naperville, IL", joined: 2023, bio: "The scratch golfer of the group, defending solo champ." },
];

const TEAMS = [
  { name: "CDL", playerA: "Collin Clark", playerB: "Quaid DeLacluyse" },
  { name: "Boomers", playerA: "Tyler Jessel", playerB: "James Bublitz" },
  { name: "Torch'em", playerA: "Tommy Casey", playerB: "Evan Powers" },
  { name: "LFG", playerA: "Mitchell Powers", playerB: "Sam Losinski" },
];

const CARROLL_CUP = {
  "Tyler Jessel": "red", "James Bublitz": "red", "Collin Clark": "red", "Quaid DeLacluyse": "red",
  "Mitchell Powers": "blue", "Sam Losinski": "blue", "Tommy Casey": "blue", "Evan Powers": "blue",
};

const ROUNDS = [
  { label: "R1", courseId: 1 },
  { label: "R2", courseId: 2 },
  { label: "R3", courseId: 3 },
  { label: "R4", courseId: 1 },
];

const esc = (s) => String(s).replace(/'/g, "''");

const joinedYears = [...new Set(PLAYERS.map((p) => p.joined))].sort();

let sql = `-- =============================================================================
-- BCO Golf — Seed Data
-- =============================================================================
-- Matches the built-in demo data already in the app, so testing with a live
-- Supabase project feels the same as the offline fallback did. Run this
-- after 01_schema.sql and 02_calculations.sql.
-- =============================================================================

-- players.joined_year references events(year), so every year anyone joined
-- needs an event row — these historical ones don't need real round data.
`;
for (const y of joinedYears) {
  if (y === 2026) continue;
  sql += `insert into events (year, rounds_played, is_current) values (${y}, 4, false);\n`;
}
sql += `insert into events (year, rounds_played, is_current) values (2026, 4, true);\n\n`;


sql += `-- Players\n`;
for (const p of PLAYERS) {
  sql += `insert into players (id, name, hometown, bio, joined_year) values (${p.id}, '${esc(p.name)}', '${esc(p.hometown)}', '${esc(p.bio)}', ${p.joined});\n`;
}
sql += `select setval('players_id_seq', (select max(id) from players));\n\n`;

sql += `-- Handicaps for the current event\n`;
for (const p of PLAYERS) {
  sql += `insert into player_handicaps (player_id, event_id, final_index) values (${p.id}, (select id from events where is_current), ${p.handicapIndex});\n`;
}
sql += `\n`;

sql += `-- Courses\n`;
for (const c of COURSES) {
  sql += `insert into courses (id, name, tee, rating, slope) values (${c.id}, '${esc(c.name)}', '${esc(c.tee)}', ${c.rating}, ${c.slope});\n`;
}
sql += `select setval('courses_id_seq', (select max(id) from courses));\n\n`;

sql += `-- Course holes\n`;
for (const c of COURSES) {
  for (const h of c.holes) {
    sql += `insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (${c.id}, ${h.number}, ${h.par}, ${h.yardage}, ${h.handicap});\n`;
  }
}
sql += `\n`;

sql += `-- Teams\n`;
for (const t of TEAMS) {
  sql += `insert into teams (event_id, name, player_a_id, player_b_id) values (\n  (select id from events where is_current),\n  '${esc(t.name)}',\n  (select id from players where name = '${esc(t.playerA)}'),\n  (select id from players where name = '${esc(t.playerB)}')\n);\n`;
}
sql += `\n`;

sql += `-- Carroll Cup roster\n`;
for (const [name, side] of Object.entries(CARROLL_CUP)) {
  sql += `insert into carroll_cup_rosters (event_id, player_id, side) values (\n  (select id from events where is_current),\n  (select id from players where name = '${esc(name)}'),\n  '${side}'\n);\n`;
}
sql += `\n`;

sql += `-- Rounds, tied to a course each\n`;
ROUNDS.forEach((r, i) => {
  sql += `insert into rounds (event_id, label, course_id, round_order) values (\n  (select id from events where is_current),\n  '${r.label}', ${r.courseId}, ${i + 1}\n);\n`;
});
sql += `\n`;

sql += `-- Round matchups (2 concurrent matches per round, rotating pairs)\n`;
const matchupSchedule = [
  ["CDL", "Boomers", "Torch'em", "LFG"],
  ["CDL", "Torch'em", "Boomers", "LFG"],
  ["CDL", "LFG", "Boomers", "Torch'em"],
  ["Boomers", "CDL", "Torch'em", "LFG"],
];
ROUNDS.forEach((r, i) => {
  const [a1, b1, a2, b2] = matchupSchedule[i];
  sql += `insert into round_matchups (round_id, team_a_id, team_b_id) values (\n  (select id from rounds where label = '${r.label}' and event_id = (select id from events where is_current)),\n  (select id from teams where name = '${esc(a1)}'),\n  (select id from teams where name = '${esc(b1)}')\n);\n`;
  sql += `insert into round_matchups (round_id, team_a_id, team_b_id) values (\n  (select id from rounds where label = '${r.label}' and event_id = (select id from events where is_current)),\n  (select id from teams where name = '${esc(a2)}'),\n  (select id from teams where name = '${esc(b2)}')\n);\n`;
});
sql += `\n`;

sql += `-- Game settings (buy-ins)\n`;
sql += `insert into game_settings (event_id, skins_buy_in, poker_three_putt_buy_in, low_net_solo_buy_in, low_net_team_buy_in, ctp_prize)\nvalues ((select id from events where is_current), 5, 1, 10, 10, 20);\n`;

fs.writeFileSync(new URL("../sql/03_seed.sql", import.meta.url), sql);
console.log("Wrote sql/03_seed.sql");
