import React, { useState } from "react";
import Papa from "papaparse";
import {
  fetchEventByYear,
  fetchRounds,
  upsertScores,
  upsertSubmission,
  updatePlayer,
  updatePlayerHandicap,
  setPlayerCompetedYear,
  createPlayer,
  createCourse,
  createCourseHoles,
  fetchTeams,
  fetchRoundMatchups,
  createRoundMatchup,
  upsertTeamHoleResult,
} from "../../lib/api.js";
import { ScreenHeader } from "../../components/ScreenHeader.jsx";
import { Banner } from "../../components/Banner.jsx";
import { AutoComputedNote } from "../../components/AutoComputedNote.jsx";
import { Button } from "../../components/Button.jsx";
import { PLAYERS, COURSES, RECORD_YEARS } from "../../data/dummyData.js";

// Score entry always writes to the current event year.
const CURRENT_YEAR = RECORD_YEARS[0];

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

export function ImportResults({ onBack, isLive }) {
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
      <ScreenHeader title="Import results" onBack={onBack} backLabel="Back to Admin" />

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

      <Button style={{ marginTop: 14 }} onClick={handleImport} disabled={!fileName || !isLive || status === "parsing"}>
        {status === "parsing" ? "Importing…" : "Import CSV"}
      </Button>
    </div>
  );
}
