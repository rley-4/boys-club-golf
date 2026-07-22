// ---------------------------------------------------------------------------
// Dummy/wireframe data for the app. Every export here is placeholder
// content standing in for a real Supabase table until that screen is wired
// up to live data (see lib/api.js and lib/stats.js for the real fetchers).
// AppShell.jsx (and App.jsx, for the couple of arrays it hydrates in place
// once live data loads) import only the pieces they actually render.
// ---------------------------------------------------------------------------

// Courses. In the real app this comes from a `courses` table (name, rating,
// slope) joined to a `holes` table (number, par, yardage, handicap).
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
export const ROUND_COURSE = { R1: COURSES[0], R2: COURSES[1], R3: COURSES[2], R4: COURSES[0] };

export const WIREFRAME_YEARS = [2022, 2023, 2024, 2025];

// Players. In the real app this comes from a `players` table where
// handicapIndex is the Final Index computed from the BCO rule book
// (Sub Index x (95% - Champ % Adj.)). Random placeholder list for now.
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
export const SOLO_STANDINGS = SOLO_STANDINGS_BASE.map((p) => {
  const handicap = Math.round(PLAYERS.find((pl) => pl.name === p.name)?.handicapIndex ?? 0);
  return { ...p, handicap, roundsGross: p.rounds.map((n) => n + handicap) };
});

export const TEAM_STANDINGS = [
  { name: "CDL", players: "Collin Clark / Quaid DeLacluyse", pointsByRound: [6, 5, 4.5, 5.5], matches: 4 },
  { name: "Boomers", players: "Tyler Jessel / James Bublitz", pointsByRound: [3.5, 5, 5.5, 5.5], matches: 4 },
  { name: "Torch'em", players: "Tommy Casey / Evan Powers", pointsByRound: [4, 3, 6.5, 4], matches: 4 },
  { name: "LFG", players: "Mitchell Powers / Sam Losinski", pointsByRound: [5, 4, 2.5, 2.5], matches: 4 },
].map((t) => ({ ...t, points: t.pointsByRound.reduce((s, p) => s + p, 0) }));

// New this year: Carroll Cup pits the whole group against each other as two
// squads (Red vs Blue). Rules/format TBD — placeholder points for now.
export const CARROLL_CUP_STANDINGS = [
  { team: "red", points: 12.5 },
  { team: "blue", points: 9.5 },
];
export const CARROLL_CUP_TOTAL_POINTS = CARROLL_CUP_STANDINGS.reduce((s, t) => s + t.points, 0);

// Per-round Carroll Cup singles matches (1 win / 0.5 tie / 0 loss).
export const CARROLL_CUP_MATCHES_BY_ROUND = {
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
export const CARROLL_CUP_ROSTER_DEFAULT = {
  "Tyler Jessel": "red",
  "James Bublitz": "red",
  "Collin Clark": "red",
  "Quaid DeLacluyse": "red",
  "Mitchell Powers": "blue",
  "Sam Losinski": "blue",
  "Tommy Casey": "blue",
  "Evan Powers": "blue",
};

// Record Book. Team records pulled from the "Team records" tab of the BCO
// Record Book (all-time). Solo records are mocked to the same shape pending
// the "Solo records" tab — swap for real data once we wire up the sheet
// import. App = appearances (years attended).
export const TEAM_RECORDS = [
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

export const SOLO_RECORDS = [
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

export const RECORD_YEARS = [2026, 2025, 2024, 2023];

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

// Match Results tab — per-round team matchups. Course handicaps are computed
// live from each player's handicapIndex against the course assigned to that
// round (mocked here since round -> course assignment isn't persisted yet).
export const TEAMS = [
  { name: "CDL", players: ["Collin Clark", "Quaid DeLacluyse"] },
  { name: "Boomers", players: ["Tyler Jessel", "James Bublitz"] },
  { name: "Torch'em", players: ["Tommy Casey", "Evan Powers"] },
  { name: "LFG", players: ["Mitchell Powers", "Sam Losinski"] },
];

export const MATCHES_BY_ROUND = {
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

// Games tab — daily cash games. Poker and Skins are computed automatically
// from score entry (strokes/putts) once that pipeline exists; CTP and Low
// Net settle-up are manual/derived views.

// Buy-in and pot settings will live on the Admin page once that's built —
// hardcoded here so Skins can show a real rollup in the meantime.
export const SKINS_SETTINGS = { buyInPerPlayer: 5, players: 8 };
export const SKINS_TOTAL_POT = SKINS_SETTINGS.buyInPerPlayer * SKINS_SETTINGS.players;

// Only holes with an actual winner are shown — carried/tied holes are omitted.
export const SKINS_PREVIEW = [
  { hole: 3, winner: "Evan Powers", net: 2 },
  { hole: 4, winner: "Collin Clark", net: 3 },
  { hole: 6, winner: "Quaid DeLacluyse", net: 2 },
  { hole: 9, winner: "Tyler Jessel", net: 3 },
  { hole: 14, winner: "Evan Powers", net: 3 },
];

export const POKER_PREVIEW = [
  { name: "Evan Powers", zeroPutts: 2, onePutts: 6, threePuttBuyins: 0 },
  { name: "Collin Clark", zeroPutts: 1, onePutts: 5, threePuttBuyins: 1 },
  { name: "Tyler Jessel", zeroPutts: 0, onePutts: 4, threePuttBuyins: 2 },
];

export const LOW_NET_SOLO_PREVIEW = [
  { name: "Evan Powers", gross: 79, net: 68 },
  { name: "Quaid DeLacluyse", gross: 82, net: 70 },
  { name: "Collin Clark", gross: 84, net: 71 },
  { name: "Tyler Jessel", gross: 85, net: 72 },
  { name: "James Bublitz", gross: 90, net: 76 },
];
