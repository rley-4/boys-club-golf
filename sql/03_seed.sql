-- =============================================================================
-- BCO Golf — Seed Data
-- =============================================================================
-- Matches the built-in demo data already in the app, so testing with a live
-- Supabase project feels the same as the offline fallback did. Run this
-- after 01_schema.sql and 02_calculations.sql.
-- =============================================================================

-- players.joined_year references events(year), so every year anyone joined
-- needs an event row — these historical ones don't need real round data.
insert into events (year, rounds_played, is_current) values (2023, 4, false);
insert into events (year, rounds_played, is_current) values (2024, 4, false);
insert into events (year, rounds_played, is_current) values (2025, 4, false);
insert into events (year, rounds_played, is_current) values (2026, 4, true);

-- Players
insert into players (id, name, hometown, bio, joined_year) values (1, 'Tyler Jessel', 'Chicago, IL', 'Steady off the tee, dangerous with the putter under pressure.', 2023);
insert into players (id, name, hometown, bio, joined_year) values (2, 'James Bublitz', 'Madison, WI', 'Grinder — best score always seems to come on the back nine.', 2023);
insert into players (id, name, hometown, bio, joined_year) values (3, 'Collin Clark', 'Milwaukee, WI', 'Two-time podium finisher, hates 3-putts more than anyone alive.', 2024);
insert into players (id, name, hometown, bio, joined_year) values (4, 'Quaid DeLacluyse', 'Green Bay, WI', 'Rookie-turned-contender, low-index and climbing fast.', 2025);
insert into players (id, name, hometown, bio, joined_year) values (5, 'Mitchell Powers', 'Chicago, IL', 'Long off the tee, streaky with irons.', 2024);
insert into players (id, name, hometown, bio, joined_year) values (6, 'Sam Losinski', 'Minneapolis, MN', 'Course management over power, rarely beats himself.', 2024);
insert into players (id, name, hometown, bio, joined_year) values (7, 'Tommy Casey', 'Chicago, IL', 'Feast or famine — has the low round of the weekend most years.', 2024);
insert into players (id, name, hometown, bio, joined_year) values (8, 'Evan Powers', 'Naperville, IL', 'The scratch golfer of the group, defending solo champ.', 2023);
select setval('players_id_seq', (select max(id) from players));

-- Handicaps for the current event
insert into player_handicaps (player_id, event_id, final_index) values (1, (select id from events where is_current), 6.4);
insert into player_handicaps (player_id, event_id, final_index) values (2, (select id from events where is_current), 14.1);
insert into player_handicaps (player_id, event_id, final_index) values (3, (select id from events where is_current), 11);
insert into player_handicaps (player_id, event_id, final_index) values (4, (select id from events where is_current), 8.3);
insert into player_handicaps (player_id, event_id, final_index) values (5, (select id from events where is_current), 11.8);
insert into player_handicaps (player_id, event_id, final_index) values (6, (select id from events where is_current), 9.6);
insert into player_handicaps (player_id, event_id, final_index) values (7, (select id from events where is_current), 6.9);
insert into player_handicaps (player_id, event_id, final_index) values (8, (select id from events where is_current), 1.8);

-- Courses
insert into courses (id, name, tee, rating, slope) values (1, 'Stonehedge South', 'Blue', 72.9, 135);
insert into courses (id, name, tee, rating, slope) values (2, 'Stonehedge North', 'Blue', 71.4, 128);
insert into courses (id, name, tee, rating, slope) values (3, 'The Preserve', 'Championship', 73.5, 140);
select setval('courses_id_seq', (select max(id) from courses));

-- Course holes
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (1, 1, 4, 353, 13);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (1, 2, 4, 420, 1);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (1, 3, 3, 184, 15);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (1, 4, 5, 517, 3);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (1, 5, 4, 327, 17);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (1, 6, 3, 182, 5);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (1, 7, 5, 488, 7);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (1, 8, 4, 384, 11);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (1, 9, 4, 384, 9);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (1, 10, 5, 537, 6);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (1, 11, 4, 395, 4);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (1, 12, 4, 324, 18);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (1, 13, 3, 180, 8);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (1, 14, 4, 399, 10);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (1, 15, 4, 371, 12);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (1, 16, 3, 183, 16);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (1, 17, 5, 492, 14);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (1, 18, 4, 439, 2);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (2, 1, 4, 372, 7);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (2, 2, 3, 165, 15);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (2, 3, 4, 401, 3);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (2, 4, 5, 502, 11);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (2, 5, 4, 340, 9);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (2, 6, 4, 389, 1);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (2, 7, 3, 172, 17);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (2, 8, 5, 511, 5);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (2, 9, 4, 358, 13);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (2, 10, 4, 405, 4);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (2, 11, 4, 366, 12);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (2, 12, 3, 191, 16);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (2, 13, 5, 521, 8);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (2, 14, 4, 349, 14);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (2, 15, 4, 412, 2);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (2, 16, 3, 176, 18);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (2, 17, 5, 494, 6);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (2, 18, 4, 418, 10);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (3, 1, 4, 401, 5);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (3, 2, 5, 548, 9);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (3, 3, 3, 199, 17);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (3, 4, 4, 432, 1);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (3, 5, 4, 378, 11);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (3, 6, 5, 529, 7);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (3, 7, 3, 187, 15);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (3, 8, 4, 411, 3);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (3, 9, 4, 366, 13);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (3, 10, 4, 419, 2);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (3, 11, 3, 205, 18);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (3, 12, 5, 556, 8);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (3, 13, 4, 388, 10);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (3, 14, 4, 447, 4);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (3, 15, 3, 178, 16);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (3, 16, 5, 512, 6);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (3, 17, 4, 395, 12);
insert into course_holes (course_id, hole_number, par, yardage, handicap_rank) values (3, 18, 4, 429, 14);

-- Teams
insert into teams (event_id, name, player_a_id, player_b_id) values (
  (select id from events where is_current),
  'CDL',
  (select id from players where name = 'Collin Clark'),
  (select id from players where name = 'Quaid DeLacluyse')
);
insert into teams (event_id, name, player_a_id, player_b_id) values (
  (select id from events where is_current),
  'Boomers',
  (select id from players where name = 'Tyler Jessel'),
  (select id from players where name = 'James Bublitz')
);
insert into teams (event_id, name, player_a_id, player_b_id) values (
  (select id from events where is_current),
  'Torch''em',
  (select id from players where name = 'Tommy Casey'),
  (select id from players where name = 'Evan Powers')
);
insert into teams (event_id, name, player_a_id, player_b_id) values (
  (select id from events where is_current),
  'LFG',
  (select id from players where name = 'Mitchell Powers'),
  (select id from players where name = 'Sam Losinski')
);

-- Carroll Cup roster
insert into carroll_cup_rosters (event_id, player_id, side) values (
  (select id from events where is_current),
  (select id from players where name = 'Tyler Jessel'),
  'red'
);
insert into carroll_cup_rosters (event_id, player_id, side) values (
  (select id from events where is_current),
  (select id from players where name = 'James Bublitz'),
  'red'
);
insert into carroll_cup_rosters (event_id, player_id, side) values (
  (select id from events where is_current),
  (select id from players where name = 'Collin Clark'),
  'red'
);
insert into carroll_cup_rosters (event_id, player_id, side) values (
  (select id from events where is_current),
  (select id from players where name = 'Quaid DeLacluyse'),
  'red'
);
insert into carroll_cup_rosters (event_id, player_id, side) values (
  (select id from events where is_current),
  (select id from players where name = 'Mitchell Powers'),
  'blue'
);
insert into carroll_cup_rosters (event_id, player_id, side) values (
  (select id from events where is_current),
  (select id from players where name = 'Sam Losinski'),
  'blue'
);
insert into carroll_cup_rosters (event_id, player_id, side) values (
  (select id from events where is_current),
  (select id from players where name = 'Tommy Casey'),
  'blue'
);
insert into carroll_cup_rosters (event_id, player_id, side) values (
  (select id from events where is_current),
  (select id from players where name = 'Evan Powers'),
  'blue'
);

-- Rounds, tied to a course each
insert into rounds (event_id, label, course_id, round_order) values (
  (select id from events where is_current),
  'R1', 1, 1
);
insert into rounds (event_id, label, course_id, round_order) values (
  (select id from events where is_current),
  'R2', 2, 2
);
insert into rounds (event_id, label, course_id, round_order) values (
  (select id from events where is_current),
  'R3', 3, 3
);
insert into rounds (event_id, label, course_id, round_order) values (
  (select id from events where is_current),
  'R4', 1, 4
);

-- Round matchups (2 concurrent matches per round, rotating pairs)
insert into round_matchups (round_id, team_a_id, team_b_id) values (
  (select id from rounds where label = 'R1' and event_id = (select id from events where is_current)),
  (select id from teams where name = 'CDL'),
  (select id from teams where name = 'Boomers')
);
insert into round_matchups (round_id, team_a_id, team_b_id) values (
  (select id from rounds where label = 'R1' and event_id = (select id from events where is_current)),
  (select id from teams where name = 'Torch''em'),
  (select id from teams where name = 'LFG')
);
insert into round_matchups (round_id, team_a_id, team_b_id) values (
  (select id from rounds where label = 'R2' and event_id = (select id from events where is_current)),
  (select id from teams where name = 'CDL'),
  (select id from teams where name = 'Torch''em')
);
insert into round_matchups (round_id, team_a_id, team_b_id) values (
  (select id from rounds where label = 'R2' and event_id = (select id from events where is_current)),
  (select id from teams where name = 'Boomers'),
  (select id from teams where name = 'LFG')
);
insert into round_matchups (round_id, team_a_id, team_b_id) values (
  (select id from rounds where label = 'R3' and event_id = (select id from events where is_current)),
  (select id from teams where name = 'CDL'),
  (select id from teams where name = 'LFG')
);
insert into round_matchups (round_id, team_a_id, team_b_id) values (
  (select id from rounds where label = 'R3' and event_id = (select id from events where is_current)),
  (select id from teams where name = 'Boomers'),
  (select id from teams where name = 'Torch''em')
);
insert into round_matchups (round_id, team_a_id, team_b_id) values (
  (select id from rounds where label = 'R4' and event_id = (select id from events where is_current)),
  (select id from teams where name = 'Boomers'),
  (select id from teams where name = 'CDL')
);
insert into round_matchups (round_id, team_a_id, team_b_id) values (
  (select id from rounds where label = 'R4' and event_id = (select id from events where is_current)),
  (select id from teams where name = 'Torch''em'),
  (select id from teams where name = 'LFG')
);

-- Game settings (buy-ins)
insert into game_settings (event_id, skins_buy_in, poker_three_putt_buy_in, low_net_solo_buy_in, low_net_team_buy_in, ctp_prize)
values ((select id from events where is_current), 5, 1, 10, 10, 20);
