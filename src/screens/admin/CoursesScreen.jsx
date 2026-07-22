import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { fetchEvents, updateCoursePlayedYear, createCourse, createCourseHoles } from "../../lib/api.js";
import { COURSES } from "../../data/dummyData.js";
import { ScreenHeader } from "../../components/ScreenHeader.jsx";
import { FormField } from "../../components/FormField.jsx";
import { FormInput } from "../../components/FormInput.jsx";
import { Banner } from "../../components/Banner.jsx";
import { Button } from "../../components/Button.jsx";

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

export function CoursesScreen({ onBack, isLive }) {
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
      <ScreenHeader
        title="Courses"
        onBack={onBack}
        backLabel="Back to More"
        right={
          step === "closed" && (
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
          )
        }
      />

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
            <Button style={{ flex: 1 }} onClick={goToHoles} disabled={!form.name.trim() || !form.rating || !form.slope}>
              Next: enter holes
            </Button>
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
            <Button style={{ flex: 1 }} onClick={handleSaveCourse} disabled={saveStatus === "saving"}>
              {saveStatus === "saving" ? "Saving…" : "Save course"}
            </Button>
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

export default CoursesScreen;
