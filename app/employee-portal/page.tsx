"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import "./employee-portal.css"

/* ── TYPES ── */
interface BreakSession {
  _id: string;
  breakIn: string;
  breakOut: string | null;
  duration: number;
}
interface SelfieEntry {
  _id: string;
  action: string;
  url: string;
  takenAt: string;
}
interface TimeEntry {
  _id: string;
  employeeName: string;
  email: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  breaks: BreakSession[];
  bioBreaks: BreakSession[];
  totalWorked: number;
  totalBreak: number;
  totalBioBreak: number;
  status: "checked-in" | "on-break" | "on-bio-break" | "returned" | "checked-out";
  selfies?: SelfieEntry[];
}
interface Shift {
  label: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  restDays: string[];
}
interface Employee {
  _id: string;
  employeeName: string;
  email: string;
  role: string;
  campaign: string;
  status: string;
  profilePic: string;
  shift?: Shift;
  birthdate?: string;
  notes?: string;
}

/* ── HELPERS ── */
function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function fmtMins(mins: number) {
  if (!mins) return "—";
  const h = Math.floor(mins / 60); const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtTime12(t: string) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h > 12 ? h - 12 : h || 12}:${String(m).padStart(2, "0")} ${ap}`;
}
function toLocalStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isLate(checkIn: string | null, shift?: Shift) {
  if (!checkIn) return false;
  const d = new Date(checkIn);
  if (shift?.startTime) {
    const [sh, sm] = shift.startTime.split(":").map(Number);
    return d.getHours() * 60 + d.getMinutes() > sh * 60 + sm + (shift.graceMinutes ?? 15);
  }
  return d.getHours() > 9;
}
function avatarUrl(name: string, pic?: string) {
  if (pic) return pic;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e4e2dd&color=7c7970&size=128`;
}

const ROLE_COLOR: Record<string, string> = {
  OM: "#7c3aed", TL: "#2563eb", Agent: "#16a34a", Other: "#6b7280",
};
const DAYS   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function isRestDay(dateStr: string, shift?: Shift) {
  if (!shift?.restDays?.length) return false;
  const dow = new Date(dateStr + "T12:00:00").getDay();
  return shift.restDays.includes(DOW_NAMES[dow]);
}

/* ── Month helpers ── */
function monthStart(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function monthEnd(d: Date) {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${last}`;
}

/* ── Build all date strings in a range ── */
function buildDateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cur = new Date(from + "T12:00:00");
  const end = new Date(to   + "T12:00:00");
  while (cur <= end) {
    dates.push(toLocalStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

type Tab = "home" | "calendar" | "profile";

/* ══════════════════════════════════════════════════════════════════
   SHARED DATE FILTER CARD COMPONENT
══════════════════════════════════════════════════════════════════ */
interface DateFilterCardProps {
  filterFrom: string;
  filterTo: string;
  todayStr: string;
  totalDays: number;
  filterLabel: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onQuickRange: (key: string) => void;
  monthStart: (d: Date) => string;
  monthEnd: (d: Date) => string;
  toLocalStr: (d: Date) => string;
  extraRight?: React.ReactNode;
}

function DateFilterCard({
  filterFrom, filterTo, todayStr, totalDays, filterLabel,
  onFromChange, onToChange, onQuickRange,
  extraRight,
}: DateFilterCardProps) {
  const now = new Date();

  const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lmStart = `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, "0")}-01`;
  const lmEnd = (() => { const last = new Date(lm.getFullYear(), lm.getMonth() + 1, 0).getDate(); return `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, "0")}-${last}`; })();
  const d7 = new Date(now); d7.setDate(d7.getDate() - 6);
  const d30 = new Date(now); d30.setDate(d30.getDate() - 29);
  const msNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const meNow = (() => { const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${last}`; })();
  const d7Str = `${d7.getFullYear()}-${String(d7.getMonth() + 1).padStart(2, "0")}-${String(d7.getDate()).padStart(2, "0")}`;
  const d30Str = `${d30.getFullYear()}-${String(d30.getMonth() + 1).padStart(2, "0")}-${String(d30.getDate()).padStart(2, "0")}`;

  const quickRanges = [
    { key: "last_7",     label: "Last 7 days",  isActive: filterFrom === d7Str && filterTo === todayStr },
    { key: "last_30",    label: "Last 30 days", isActive: filterFrom === d30Str && filterTo === todayStr },
    { key: "this_month", label: "This month",   isActive: filterFrom === msNow && filterTo === meNow },
    { key: "last_month", label: "Last month",   isActive: filterFrom === lmStart && filterTo === lmEnd },
    { key: "all",        label: "All time",     isActive: filterFrom === "2020-01-01" && filterTo === todayStr },
  ];

  return (
    <div className="filter-card">
      <div className="filter-top">
        <div>
          <div className="filter-title">📅 Date Range Filter</div>
          <div className="filter-label" style={{ marginTop: 3 }}>{filterLabel} · {totalDays} record{totalDays !== 1 ? "s" : ""}</div>
        </div>
        {extraRight}
      </div>

      <div className="filter-row" style={{ marginBottom: 10 }}>
        <div className="filter-date-wrap">
          <span className="filter-date-label">FROM</span>
          <input type="date" className="filter-date-input"
            value={filterFrom} max={filterTo}
            onChange={e => onFromChange(e.target.value)} />
        </div>
        <span className="filter-sep">—</span>
        <div className="filter-date-wrap">
          <span className="filter-date-label">TO</span>
          <input type="date" className="filter-date-input"
            value={filterTo} min={filterFrom} max={todayStr}
            onChange={e => onToChange(e.target.value)} />
        </div>
      </div>

      <div className="filter-quick-btns">
        {quickRanges.map(({ key, label, isActive }) => (
          <button key={key} className={`quick-btn${isActive ? " active" : ""}`}
            onClick={() => onQuickRange(key)}>{label}</button>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PROFILE EDITOR COMPONENT
══════════════════════════════════════════════════════════════════ */
function ProfileEditor({ employee, onUpdate }: {
  employee: Employee;
  onUpdate: (updated: Employee) => void;
}) {
  const [editing, setEditing]               = useState(false);
  const [birthdate, setBirthdate]           = useState(employee.birthdate || "");
  const [notes, setNotes]                   = useState(employee.notes || "");
  const [saving, setSaving]                 = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [success, setSuccess]               = useState<string | null>(null);
  const fileInputRef                        = useRef<HTMLInputElement>(null);

  // Keep local state in sync if employee prop changes
  useEffect(() => {
    setBirthdate(employee.birthdate || "");
    setNotes(employee.notes || "");
  }, [employee]);

  const sessionHeader = JSON.stringify({ email: employee.email, employeeName: employee.employeeName });

  const handleSave = async () => {
    setSaving(true); setError(null); setSuccess(null);
    try {
      const res = await fetch("/api/employees/self", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-employee-session": sessionHeader },
        body: JSON.stringify({ birthdate, notes }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save"); return; }
      onUpdate({ ...employee, birthdate, notes });
      setSuccess("Profile updated!"); setEditing(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Image must be under 5MB"); return; }

    setPhotoUploading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/employees/self", {
        method: "POST",
        headers: { "x-employee-session": sessionHeader },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Upload failed"); return; }
      onUpdate({ ...employee, profilePic: data.profilePic });
      setSuccess("Photo updated!"); setTimeout(() => setSuccess(null), 3000);
    } catch { setError("Upload failed"); }
    finally { setPhotoUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  return (
    <div className="profile-card">
      {/* Hero */}
      <div className="profile-hero">
        <div style={{ position: "relative", flexShrink: 0 }}>
          <img src={avatarUrl(employee.employeeName, employee.profilePic)} alt="Avatar" className="profile-avatar" />
          <button
            title="Change photo"
            onClick={() => fileInputRef.current?.click()}
            disabled={photoUploading}
            style={{
              position: "absolute", bottom: 0, right: 0,
              width: 24, height: 24, borderRadius: "50%",
              background: photoUploading ? "#6b7280" : "#22c55e",
              border: "2px solid #1a1916",
              color: "#fff", fontSize: 12, display: "flex",
              alignItems: "center", justifyContent: "center",
              cursor: photoUploading ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {photoUploading
              ? <span className="export-spinner" style={{ borderColor: "#fff", borderTopColor: "transparent" }} />
              : "📷"}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="profile-name">{employee.employeeName}</div>
          <div className="profile-email">{employee.email}</div>
          <div className="profile-badges">
            <span className="profile-badge" style={{ color: ROLE_COLOR[employee.role] || "#6b7280", borderColor: ROLE_COLOR[employee.role] || "#6b7280", background: "rgba(255,255,255,0.1)" }}>{employee.role}</span>
            <span className="profile-badge" style={{ color: employee.status === "active" ? "#22c55e" : "#9ca3af", borderColor: employee.status === "active" ? "#22c55e" : "#9ca3af", background: "rgba(255,255,255,0.1)" }}>{employee.status}</span>
            {employee.campaign && <span className="profile-badge" style={{ color: "#a5b4fc", borderColor: "#a5b4fc", background: "rgba(255,255,255,0.1)" }}>{employee.campaign}</span>}
          </div>
        </div>
        <button
          onClick={() => { setEditing(e => !e); setError(null); }}
          style={{
            alignSelf: "flex-start",
            background: editing ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)",
            border: "1.5px solid rgba(255,255,255,0.2)", color: "#fff",
            padding: "6px 14px", borderRadius: 6,
            fontFamily: "'DM Mono', monospace", fontSize: 10,
            letterSpacing: 1, cursor: "pointer", transition: "all 0.15s",
          }}
        >
          {editing ? "✕ Cancel" : "✏ Edit"}
        </button>
      </div>

      {/* Feedback banner */}
      {(error || success) && (
        <div style={{
          margin: "12px 20px 0", padding: "8px 14px", borderRadius: 6,
          background: error ? "#fee2e2" : "#dcfce7",
          border: `1.5px solid ${error ? "#fca5a5" : "#86efac"}`,
          color: error ? "#b91c1c" : "#15803d",
          fontFamily: "'DM Mono', monospace", fontSize: 11,
        }}>
          {error || success}
        </div>
      )}

      <div className="profile-body">
        {/* Read-only owner-controlled fields */}
        <div className="profile-row">
          <span className="profile-lbl">Email</span>
          <span className="profile-val" style={{ fontSize: 12 }}>{employee.email}</span>
        </div>
        <div className="profile-row">
          <span className="profile-lbl">Role</span>
          <span className="profile-val" style={{ color: ROLE_COLOR[employee.role] || "var(--text)" }}>{employee.role}</span>
        </div>
        {employee.campaign && (
          <div className="profile-row">
            <span className="profile-lbl">Campaign</span>
            <span className="profile-val">{employee.campaign}</span>
          </div>
        )}

        {/* Editable: Birthday */}
        <div className="profile-row" style={{ alignItems: editing ? "center" : "flex-start" }}>
          <span className="profile-lbl">Birthday</span>
          {editing ? (
            <input
              type="date"
              className="filter-date-input"
              value={birthdate}
              max={toLocalStr(new Date())}
              onChange={e => setBirthdate(e.target.value)}
              style={{ fontSize: 12 }}
            />
          ) : (
            <span className="profile-val">
              {employee.birthdate || <span style={{ color: "var(--text-light)" }}>—</span>}
            </span>
          )}
        </div>

        {/* Editable: Notes / Bio */}
        <div className="profile-row" style={{ flexDirection: "column", gap: editing ? 8 : 6 }}>
          <span className="profile-lbl">Notes / Bio</span>
          {editing ? (
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Add a short bio or notes about yourself…"
              style={{
                width: "100%", background: "var(--surface-alt)",
                border: "1.5px solid var(--border)", borderRadius: 6,
                padding: "8px 12px", fontFamily: "'DM Mono', monospace",
                fontSize: 12, color: "var(--text)", resize: "vertical",
                outline: "none", transition: "border-color 0.15s",
              }}
              onFocus={e => (e.target.style.borderColor = "var(--border-strong)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")}
            />
          ) : (
            <span className="profile-val" style={{
              fontSize: 12, textAlign: "left",
              fontStyle: employee.notes ? "italic" : "normal",
              color: employee.notes ? "var(--text-muted)" : "var(--text-light)",
            }}>
              {employee.notes || "—"}
            </span>
          )}
        </div>

        {/* Save button */}
        {editing && (
          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: saving ? "#6b7280" : "#1a1916",
                border: "none", color: "#fff", padding: "9px 24px",
                borderRadius: 6, fontFamily: "'DM Mono', monospace",
                fontSize: 11, letterSpacing: 1,
                cursor: saving ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 6,
                transition: "background 0.15s",
              }}
            >
              {saving && <span className="export-spinner" style={{ borderColor: "#fff", borderTopColor: "transparent" }} />}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        )}

        {/* Shift info (read-only) */}
        {employee.shift?.startTime && (
          <div className="profile-row" style={{ flexDirection: "column", gap: 10 }}>
            <span className="profile-lbl">My Schedule</span>
            <div className="shift-card">
              <div className="shift-title">⏰ {employee.shift.label || "Regular Shift"}</div>
              <div className="shift-row"><span className="shift-lbl">Start Time</span><span>{fmtTime12(employee.shift.startTime)}</span></div>
              <div className="shift-row"><span className="shift-lbl">End Time</span><span>{fmtTime12(employee.shift.endTime)}</span></div>
              <div className="shift-row"><span className="shift-lbl">Grace Period</span><span>+{employee.shift.graceMinutes} minutes</span></div>
              <div className="shift-row"><span className="shift-lbl">Rest Days</span><span>{employee.shift.restDays.map(d => d.slice(0, 3)).join(", ")}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function EmployeePortal() {
  const router = useRouter();
  const [employee,    setEmployee]    = useState<Employee | null>(null);
  const [records,     setRecords]     = useState<TimeEntry[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState<Tab>("home");
  const [calDate,     setCalDate]     = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<TimeEntry | null>(null);
  const [lightbox,    setLightbox]    = useState<{ selfies: SelfieEntry[]; index: number } | null>(null);

  /* ── Date-range filter (shared across all tabs) ── */
  const todayStr = toLocalStr(new Date());
  const [filterFrom, setFilterFrom] = useState(monthStart(new Date()));
  const [filterTo,   setFilterTo]   = useState(monthEnd(new Date()));
  const [exporting,  setExporting]  = useState<"excel" | "pdf" | null>(null);

  /* ── Calendar custom range mode ── */
  const [useCalCustomRange, setUseCalCustomRange] = useState(false);

  /* ── Pagination ── */
  const PAGE_SIZE = 20;
  const [currentPage, setCurrentPage] = useState(1);

  /* ── Auth check ── */
  useEffect(() => {
    const stored = sessionStorage.getItem("employeeSession");
    if (!stored) { router.push("/employee-login"); return; }
    try { setEmployee(JSON.parse(stored)); }
    catch { router.push("/employee-login"); }
    setLoading(false);
  }, [router]);

  /* ── Lightbox keyboard nav ── */
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  setLightbox(lb => lb ? { ...lb, index: (lb.index - 1 + lb.selfies.length) % lb.selfies.length } : lb);
      if (e.key === "ArrowRight") setLightbox(lb => lb ? { ...lb, index: (lb.index + 1) % lb.selfies.length } : lb);
      if (e.key === "Escape")     setLightbox(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox]);

  /* ── Fetch employee records ── */
  const fetchRecords = useCallback(async () => {
    if (!employee) return;
    try {
      const calFrom = monthStart(calDate);
      const calTo   = monthEnd(calDate);
      const from = filterFrom < calFrom ? filterFrom : calFrom;
      const to   = filterTo   > calTo   ? filterTo   : calTo;

      const res = await fetch(
        `/api/time/records?from=${from}&to=${to}&limit=500&name=${encodeURIComponent(employee.employeeName)}`
      );
      const data = await res.json();
      const mine = (data.records || []).filter(
        (r: TimeEntry) => r.email === employee.email && r.employeeName === employee.employeeName
      );
      setRecords(mine);
    } catch { /* silent */ }
  }, [employee, calDate, filterFrom, filterTo]);

  useEffect(() => { if (employee) fetchRecords(); }, [employee, fetchRecords]);

  const handleLogout = () => {
    sessionStorage.removeItem("employeeSession");
    router.push("/employee-login");
  };

  /* ── Quick-range helpers ── */
  const applyQuickRange = (key: string) => {
    setCurrentPage(1);
    const now = new Date();
    if (key === "this_month") {
      setFilterFrom(monthStart(now));
      setFilterTo(monthEnd(now));
    } else if (key === "last_month") {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      setFilterFrom(monthStart(lm));
      setFilterTo(monthEnd(lm));
    } else if (key === "last_7") {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      setFilterFrom(toLocalStr(d));
      setFilterTo(todayStr);
    } else if (key === "last_30") {
      const d = new Date(now); d.setDate(d.getDate() - 29);
      setFilterFrom(toLocalStr(d));
      setFilterTo(todayStr);
    } else if (key === "all") {
      setFilterFrom("2020-01-01");
      setFilterTo(todayStr);
    }
  };

  /* ── Calendar quick range ── */
  const applyCalQuickRange = (key: string) => {
    applyQuickRange(key);
    setUseCalCustomRange(true);
  };

  if (loading || !employee) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f6f3" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#1a1916", opacity: 0.2, animation: `bounce 0.8s ${i * 0.15}s infinite` }} />
          ))}
        </div>
        <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0.6);opacity:0.2}40%{transform:scale(1);opacity:0.8}}`}</style>
      </div>
    );
  }

  /* ── Filtered records ── */
  const filteredRecords = records.filter(r => r.date >= filterFrom && r.date <= filterTo);

  /* ── Stats ── */
  const today           = toLocalStr(new Date());
  const todayRecord     = records.find(r => r.date === today);
  const totalDays       = filteredRecords.length;
  const lateDays        = filteredRecords.filter(r => isLate(r.checkIn, employee.shift)).length;
  const totalWorkedMins = filteredRecords.reduce((s, r) => s + (r.totalWorked || 0), 0);
  const avgWorked       = totalDays > 0
    ? Math.round(filteredRecords.filter(r => r.totalWorked > 0).reduce((s, r) => s + r.totalWorked, 0) / Math.max(1, filteredRecords.filter(r => r.totalWorked > 0).length))
    : 0;

  /* ── Sorted + paginated records ── */
  const sortedRecords = [...filteredRecords].sort((a, b) => b.date.localeCompare(a.date));
  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedRecords = sortedRecords.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  /* ── Calendar grid ── */
  const y = calDate.getFullYear(); const mo = calDate.getMonth();
  const firstDay = new Date(y, mo, 1).getDay();
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  const calDays: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) calDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calDays.push(`${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  const byDate = new Map(records.map(r => [r.date, r]));

  /* ── Calendar custom range days ── */
  const customRangeDays = useCalCustomRange ? buildDateRange(filterFrom, filterTo) : [];

  /* ── Filter label ── */
  const filterLabel = (() => {
    const from = new Date(filterFrom + "T12:00:00");
    const to   = new Date(filterTo   + "T12:00:00");
    return `${from.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${to.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  })();

  /* ── Shared DateFilterCard props ── */
  const sharedFilterProps = {
    filterFrom, filterTo, todayStr, totalDays, filterLabel,
    onFromChange: (v: string) => { setFilterFrom(v); setCurrentPage(1); },
    onToChange:   (v: string) => { setFilterTo(v);   setCurrentPage(1); },
    onQuickRange: applyQuickRange,
    monthStart, monthEnd, toLocalStr,
  };

  /* ── EXPORT HELPERS ── */
  const buildExportRows = () => {
    const DOW_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const tStr = toLocalStr(new Date());
    const dateRange = buildDateRange(filterFrom, filterTo);
    const recordMap = new Map(records.map(r => [r.date, r]));

    return dateRange.map(dateStr => {
      const r = recordMap.get(dateStr);
      const dowIdx = new Date(dateStr + "T12:00:00").getDay();
      const dow = DOW_SHORT[dowIdx];
      const rest = isRestDay(dateStr, employee.shift);
      const weekend = !employee.shift && (dowIdx === 0 || dowIdx === 6);
      const late = r ? isLate(r.checkIn, employee.shift) : false;

      let dayType: string;
      if (rest) dayType = "Rest Day";
      else if (weekend) dayType = "Weekend";
      else if (r) dayType = late ? "Present (Late)" : "Present (On Time)";
      else if (dateStr > tStr) dayType = "Future";
      else if (dateStr === tStr) dayType = "Today";
      else dayType = "Absent";

      return {
        "Date": dateStr,
        "Day": dow,
        "Day Type": dayType,
        "Check In": r ? fmt(r.checkIn) : "—",
        "Check Out": r ? fmt(r.checkOut) : "—",
        "On Time?": r ? (late ? "Late" : "On Time") : "—",
        "Break Sessions": r?.breaks?.length
          ? r.breaks.map((b, i) => `#${i+1}: ${fmt(b.breakIn)} → ${b.breakOut ? fmt(b.breakOut) : "active"}${b.duration ? ` (${fmtMins(b.duration)})` : ""}`).join(" | ")
          : "—",
        "Total Break": r ? fmtMins(r.totalBreak) : "—",
        "Bio Break Sessions": r?.bioBreaks?.length
          ? r.bioBreaks.map((b, i) => `#${i+1}: ${fmt(b.breakIn)} → ${b.breakOut ? fmt(b.breakOut) : "active"}${b.duration ? ` (${fmtMins(b.duration)})` : ""}`).join(" | ")
          : "—",
        "Total Bio Break": r ? fmtMins(r.totalBioBreak) : "—",
        "Total Worked": r ? fmtMins(r.totalWorked) : "—",
        "Status": r ? r.status.replace(/-/g, " ") : dayType,
        "Selfies": r ? `${r.selfies?.length ?? 0}` : "0",
      };
    });
  };

  const exportExcel = async () => {
    setExporting("excel");
    try {
      const XLSX = await import("xlsx");
      const rows = buildExportRows();
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 12 }, { wch: 5 }, { wch: 18 },
        { wch: 12 }, { wch: 12 }, { wch: 10 },
        { wch: 50 }, { wch: 14 },
        { wch: 50 }, { wch: 16 },
        { wch: 14 }, { wch: 16 }, { wch: 8 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attendance");

      const sumRows = [
        { "Metric": "Employee",          "Value": employee.employeeName },
        { "Metric": "Email",             "Value": employee.email },
        { "Metric": "Role",              "Value": employee.role },
        { "Metric": "Campaign",          "Value": employee.campaign || "—" },
        { "Metric": "Period",            "Value": filterLabel },
        { "Metric": "Days Present",      "Value": totalDays },
        { "Metric": "Late Days",         "Value": lateDays },
        { "Metric": "Total Hours Worked","Value": (totalWorkedMins / 60).toFixed(2) + "h" },
        { "Metric": "Avg Day Length",    "Value": avgWorked > 0 ? fmtMins(avgWorked) : "—" },
        { "Metric": "Shift",             "Value": employee.shift?.startTime ? `${fmtTime12(employee.shift.startTime)} – ${fmtTime12(employee.shift.endTime)}` : "—" },
        { "Metric": "Grace Period",      "Value": employee.shift?.graceMinutes != null ? `+${employee.shift.graceMinutes}m` : "—" },
        { "Metric": "Rest Days",         "Value": employee.shift?.restDays?.join(", ") || "—" },
      ];
      const ws2 = XLSX.utils.json_to_sheet(sumRows);
      ws2["!cols"] = [{ wch: 22 }, { wch: 32 }];
      XLSX.utils.book_append_sheet(wb, ws2, "Summary");

      XLSX.writeFile(wb, `attendance-${employee.employeeName.replace(/\s+/g, "-")}-${filterFrom}-to-${filterTo}.xlsx`);
    } finally { setExporting(null); }
  };

  const exportPDF = async () => {
    setExporting("pdf");
    try {
      const { default: jsPDF }     = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      doc.setFillColor(26, 25, 22);
      doc.rect(0, 0, 297, 20, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("CRISTIMETRACK — Attendance Report", 14, 13);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(180, 180, 170);
      doc.text(`Employee: ${employee.employeeName}  |  Period: ${filterLabel}  |  Generated: ${new Date().toLocaleString()}`, 14, 19);

      doc.setFillColor(242, 241, 238);
      doc.roundedRect(10, 24, 130, 28, 2, 2, "F");
      doc.setTextColor(120, 116, 110);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("EMPLOYEE DETAILS", 14, 30);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 28, 26);
      doc.text(`Name: ${employee.employeeName}`, 14, 36);
      doc.text(`Email: ${employee.email}`, 14, 41);
      doc.text(`Role: ${employee.role}${employee.campaign ? "  ·  Campaign: " + employee.campaign : ""}`, 14, 46);
      if (employee.shift?.startTime) {
        doc.text(`Shift: ${fmtTime12(employee.shift.startTime)} – ${fmtTime12(employee.shift.endTime)}  (+${employee.shift.graceMinutes}m grace)`, 14, 51);
      }

      doc.setFillColor(242, 241, 238);
      doc.roundedRect(145, 24, 142, 28, 2, 2, "F");
      doc.setTextColor(120, 116, 110);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text("PERIOD SUMMARY", 149, 30);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 28, 26);
      doc.text(`Days Present: ${totalDays}`, 149, 36);
      doc.text(`Late Days: ${lateDays}`, 149, 41);
      doc.text(`Total Hours: ${(totalWorkedMins / 60).toFixed(1)}h`, 149, 46);
      doc.text(`Avg Day: ${avgWorked > 0 ? fmtMins(avgWorked) : "—"}`, 149, 51);
      doc.text(`Attendance Rate: ${totalDays > 0 ? Math.round((totalDays / Math.max(totalDays, 1)) * 100) : 0}%`, 215, 36);

      const rows = buildExportRows();
      const headers = Object.keys(rows[0] || {});
      const body = rows.map(r => headers.map(h => (r as Record<string, string>)[h]));

      autoTable(doc, {
        head: [headers],
        body,
        startY: 58,
        styles: { font: "helvetica", fontSize: 7, cellPadding: 2.5, textColor: [30,28,26], lineColor: [228,226,221], lineWidth: 0.3 },
        headStyles: { fillColor: [242,241,238], textColor: [120,116,110], fontStyle: "bold", fontSize: 6.5, cellPadding: { top:4, bottom:4, left:2.5, right:2.5 } },
        alternateRowStyles: { fillColor: [250,249,246] },
        columnStyles: {
          4: { textColor: [217,119,6] },
          10: { textColor: [22,163,74], fontStyle: "bold" },
        },
        margin: { left: 10, right: 10 },
      });

      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(160,160,150);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 5, { align: "center" });
      }

      doc.save(`attendance-${employee.employeeName.replace(/\s+/g, "-")}-${filterFrom}-to-${filterTo}.pdf`);
    } finally { setExporting(null); }
  };

  /* ── Render ── */
  return (
    <>
      <div className="portal">

        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-logo">
              <span style={{ color: "#22c55e" }}>CRIS</span> TIME<span style={{ color: "#22c55e" }}>TRACK</span>
            </span>
            <div className="topbar-divider" />
            <span className="topbar-name">Employee Portal</span>
          </div>
          <div className="topbar-right">
            <img src={avatarUrl(employee.employeeName, employee.profilePic)} alt="Avatar" className="topbar-avatar" />
            <button className="logout-btn" onClick={handleLogout}>Sign Out</button>
          </div>
        </header>

        {/* Desktop Tabs */}
        <div className="tabs">
          {(["home", "calendar", "profile"] as Tab[]).map(t => (
            <button key={t} className={`tab-btn${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
              {t === "home" ? "🏠 Home" : t === "calendar" ? "📅 Calendar" : "👤 Profile"}
            </button>
          ))}
        </div>

        {/* Content */}
        <main className="content">

          {/* ── HOME TAB ── */}
          {tab === "home" && (
            <>
              <DateFilterCard
                {...sharedFilterProps}
                onQuickRange={applyQuickRange}
                extraRight={
                  <div className="export-row">
                    <button className="btn-export btn-export-excel"
                      disabled={exporting !== null || filteredRecords.length === 0}
                      onClick={exportExcel}>
                      {exporting === "excel" ? <><span className="export-spinner" /> Exporting…</> : <>↓ Excel</>}
                    </button>
                    <button className="btn-export btn-export-pdf"
                      disabled={exporting !== null || filteredRecords.length === 0}
                      onClick={exportPDF}>
                      {exporting === "pdf" ? <><span className="export-spinner" /> Exporting…</> : <>↓ PDF</>}
                    </button>
                  </div>
                }
              />

              {/* Stats */}
              <div className="stats">
                <div className="stat-card stat-blue"><div className="stat-lbl">Days Present</div><div className="stat-val">{totalDays}</div></div>
                <div className="stat-card stat-green"><div className="stat-lbl">Avg Day</div><div className="stat-val">{avgWorked > 0 ? fmtMins(avgWorked) : "—"}</div></div>
                <div className="stat-card stat-amber"><div className="stat-lbl">Late Days</div><div className="stat-val">{lateDays}</div></div>
                <div className="stat-card stat-rose"><div className="stat-lbl">Total Hours</div><div className="stat-val">{(totalWorkedMins / 60).toFixed(1)}h</div></div>
              </div>

              {/* Today snapshot */}
              <div className="today-card">
                <div className="today-title">
                  📅 Today — {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </div>
                {!todayRecord ? (
                  <div className="today-empty">No time record for today yet</div>
                ) : (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span className={`status-badge s-${todayRecord.status}`}>{todayRecord.status.replace(/-/g, " ")}</span>
                      {isLate(todayRecord.checkIn, employee.shift) && (
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, background: "#fef3c7", color: "#92400e", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>⏰ Late</span>
                      )}
                    </div>
                    <div className="time-grid">
                      <div className="time-item">
                        <span className="time-lbl">Check In</span>
                        <span className={`time-val${isLate(todayRecord.checkIn, employee.shift) ? " amber" : ""}`}>{fmt(todayRecord.checkIn)}</span>
                      </div>
                      <div className="time-item">
                        <span className="time-lbl">Check Out</span>
                        <span className="time-val">{fmt(todayRecord.checkOut)}</span>
                      </div>
                      <div className="time-item">
                        <span className="time-lbl">Break</span>
                        <span className="time-val">{fmtMins(todayRecord.totalBreak)}</span>
                      </div>
                      <div className="time-item">
                        <span className="time-lbl">Worked</span>
                        <span className="time-val green">{fmtMins(todayRecord.totalWorked)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Records table */}
              <div className="table-card" style={{ marginTop: 20 }}>
                <div className="table-card-header">
                  <span className="table-card-title">Records · {filterLabel}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text-light)" }}>{filteredRecords.length} entries</span>
                </div>
                {filteredRecords.length === 0 ? (
                  <div className="empty">No records for this period</div>
                ) : (
                  <>
                    <div className="tc-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th><th>Check In</th><th>Check Out</th>
                            <th>Break</th><th>Worked</th><th>Status</th><th>Selfies</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedRecords.map(r => {
                            const late = isLate(r.checkIn, employee.shift);
                            return (
                              <tr key={r._id} onClick={() => setSelectedDay(r)}>
                                <td className="date-cell">
                                  {new Date(r.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" })}
                                  {late && <span className="late-badge">Late</span>}
                                </td>
                                <td className="time-cell" style={late ? { color: "#d97706" } : {}}>{fmt(r.checkIn)}</td>
                                <td className="time-cell">{fmt(r.checkOut)}</td>
                                <td className="time-cell">{fmtMins(r.totalBreak)}</td>
                                <td className="worked-cell">{fmtMins(r.totalWorked)}</td>
                                <td><span className={`status-badge s-${r.status}`}>{r.status.replace(/-/g, " ")}</span></td>
                                <td>
                                  {r.selfies && r.selfies.length > 0 ? (
                                    <div className="row-selfies">
                                      {r.selfies.slice(0, 3).map((s, i) => (
                                        <img key={s._id || i} src={s.url} alt={s.action}
                                          className="row-selfie-thumb"
                                          title={s.action.replace(/-/g, " ")}
                                          onClick={e => { e.stopPropagation(); setLightbox({ selfies: r.selfies!, index: i }); }}
                                        />
                                      ))}
                                      {r.selfies.length > 3 && <span className="row-selfie-more">+{r.selfies.length - 3}</span>}
                                    </div>
                                  ) : <span style={{ color: "var(--text-light)", fontFamily: "'DM Mono',monospace", fontSize: 10 }}>—</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {totalPages > 1 && (
                      <div className="pagination">
                        <span className="pg-info">
                          {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sortedRecords.length)} of {sortedRecords.length}
                        </span>
                        <div className="pg-controls">
                          <button className="pg-btn" disabled={safePage === 1} onClick={() => setCurrentPage(p => p - 1)}>‹</button>
                          {(() => {
                            const pages: (number | "…")[] = [];
                            if (totalPages <= 7) {
                              for (let i = 1; i <= totalPages; i++) pages.push(i);
                            } else {
                              pages.push(1);
                              if (safePage > 3) pages.push("…");
                              for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i);
                              if (safePage < totalPages - 2) pages.push("…");
                              pages.push(totalPages);
                            }
                            return pages.map((p, i) =>
                              p === "…"
                                ? <span key={`ellipsis-${i}`} className="pg-ellipsis">…</span>
                                : <button key={p} className={`pg-btn${p === safePage ? " active" : ""}`} onClick={() => setCurrentPage(p as number)}>{p}</button>
                            );
                          })()}
                          <button className="pg-btn" disabled={safePage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>›</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {/* ── CALENDAR TAB ── */}
          {tab === "calendar" && (
            <>
              <DateFilterCard
                {...sharedFilterProps}
                onQuickRange={applyCalQuickRange}
                onFromChange={v => { setFilterFrom(v); setUseCalCustomRange(true); setCurrentPage(1); }}
                onToChange={v => { setFilterTo(v); setUseCalCustomRange(true); setCurrentPage(1); }}
                extraRight={
                  useCalCustomRange ? (
                    <button
                      className="quick-btn"
                      style={{ background: "#1a1916", borderColor: "#1a1916", color: "#fff", fontSize: 9 }}
                      onClick={() => {
                        setUseCalCustomRange(false);
                        setCalDate(new Date());
                        setFilterFrom(monthStart(new Date()));
                        setFilterTo(monthEnd(new Date()));
                      }}
                    >
                      ✕ Reset to Monthly
                    </button>
                  ) : null
                }
              />

              <div className="cal-card">
                {!useCalCustomRange ? (
                  <div className="cal-nav">
                    <button className="cal-nav-btn" onClick={() => { const d = new Date(calDate); d.setMonth(d.getMonth() - 1); setCalDate(d); }}>‹</button>
                    <span className="cal-title">{MONTHS[calDate.getMonth()]} {calDate.getFullYear()}</span>
                    <button className="cal-nav-btn" onClick={() => { const d = new Date(calDate); d.setMonth(d.getMonth() + 1); setCalDate(d); }}>›</button>
                    <button className="cal-today-btn" onClick={() => setCalDate(new Date())}>Today</button>
                  </div>
                ) : (
                  <div className="cal-nav">
                    <span className="cal-title" style={{ fontSize: 14 }}>
                      Custom Range
                      <span style={{ marginLeft: 10, fontFamily: "'DM Mono', monospace", fontSize: 10, background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: 20, padding: "2px 10px", fontWeight: 600 }}>
                        {filterLabel} · {customRangeDays.length} days
                      </span>
                    </span>
                  </div>
                )}

                <div className="legend">
                  <span className="legend-item"><span className="legend-dot" style={{ background: "#16a34a" }} />Present</span>
                  <span className="legend-item"><span className="legend-dot" style={{ background: "#d97706" }} />Late</span>
                  <span className="legend-item"><span className="legend-dot" style={{ background: "#fca5a5" }} />Absent</span>
                  <span className="legend-item"><span className="legend-dot" style={{ background: "#2563eb" }} />Today</span>
                  {employee.shift && <span className="legend-item"><span className="legend-dot" style={{ background: "#d1cfc9" }} />Rest Day</span>}
                </div>

                {/* Monthly grid */}
                {!useCalCustomRange && (
                  <>
                    <div className="cal-day-headers">{DAYS.map(d => <div key={d} className="cal-dh">{d}</div>)}</div>
                    <div className="cal-grid">
                      {calDays.map((dateStr, idx) => {
                        if (!dateStr) return <div key={`empty-${idx}`} className="cal-cell cal-cell--empty" />;
                        const rec     = byDate.get(dateStr);
                        const isToday = dateStr === today;
                        const isPast  = dateStr < today;
                        const rest    = isRestDay(dateStr, employee.shift);
                        const late    = rec ? isLate(rec.checkIn, employee.shift) : false;
                        const dayNum  = parseInt(dateStr.split("-")[2]);
                        let cellClass = "cal-cell";
                        if (isToday) cellClass += " cal-cell--today";
                        else if (rest) cellClass += " cal-cell--rest";
                        else if (rec && late) cellClass += " cal-cell--late";
                        else if (rec) cellClass += " cal-cell--present";
                        else if (isPast && !rest) cellClass += " cal-cell--absent";
                        return (
                          <div key={dateStr} className={cellClass} onClick={() => rec && setSelectedDay(rec)}>
                            <div className="cal-num">{dayNum}</div>
                            {isToday && !rec && <span className="cal-badge cal-badge-today">Today</span>}
                            {rest && !isToday && <span className="cal-badge cal-badge-rest">Rest</span>}
                            {!rest && !rec && isPast && !isToday && <span className="cal-badge cal-badge-red">—</span>}
                            {rec && late  && <span className="cal-badge cal-badge-amber">Late</span>}
                            {rec && !late && <span className="cal-badge cal-badge-green">✓</span>}
                            {rec && rec.totalWorked > 0 && <div className="cal-worked">{fmtMins(rec.totalWorked)}</div>}
                            {rec && rec.selfies && rec.selfies.length > 0 && (
                              <div className="cal-selfie-strip">
                                {rec.selfies.slice(0, 4).map((s, i) => (
                                  <img key={s._id || i} src={s.url} alt={s.action} className="cal-selfie-avatar"
                                    title={s.action.replace(/-/g, " ")}
                                    onClick={e => { e.stopPropagation(); setLightbox({ selfies: rec.selfies!, index: i }); }} />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Custom range grid */}
                {useCalCustomRange && (
                  <>
                    <div className="cal-day-headers">{DAYS.map(d => <div key={d} className="cal-dh">{d}</div>)}</div>
                    <div className="cal-grid">
                      {customRangeDays.length > 0 && (() => {
                        const firstDow = new Date(customRangeDays[0] + "T12:00:00").getDay();
                        return Array.from({ length: firstDow }).map((_, i) => <div key={`pre-${i}`} className="cal-cell cal-cell--empty" />);
                      })()}
                      {customRangeDays.map(dateStr => {
                        const rec       = byDate.get(dateStr);
                        const isToday   = dateStr === today;
                        const isPast    = dateStr <= today;
                        const rest      = isRestDay(dateStr, employee.shift);
                        const late      = rec ? isLate(rec.checkIn, employee.shift) : false;
                        const dayNum    = parseInt(dateStr.split("-")[2]);
                        const monthAbbr = new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short" });
                        let cellClass = "cal-cell";
                        if (isToday) cellClass += " cal-cell--today";
                        else if (rest) cellClass += " cal-cell--rest";
                        else if (rec && late) cellClass += " cal-cell--late";
                        else if (rec) cellClass += " cal-cell--present";
                        else if (isPast && !rest) cellClass += " cal-cell--absent";
                        return (
                          <div key={dateStr} className={cellClass} onClick={() => rec && setSelectedDay(rec)}>
                            <div className="cal-num">
                              {dayNum === 1 || dateStr === customRangeDays[0]
                                ? <><span style={{ fontSize: 8, opacity: 0.6 }}>{monthAbbr} </span>{dayNum}</>
                                : dayNum}
                            </div>
                            {isToday && !rec && <span className="cal-badge cal-badge-today">Today</span>}
                            {rest && !isToday && <span className="cal-badge cal-badge-rest">Rest</span>}
                            {!rest && !rec && isPast && !isToday && <span className="cal-badge cal-badge-red">—</span>}
                            {rec && late  && <span className="cal-badge cal-badge-amber">Late</span>}
                            {rec && !late && <span className="cal-badge cal-badge-green">✓</span>}
                            {rec && rec.totalWorked > 0 && <div className="cal-worked">{fmtMins(rec.totalWorked)}</div>}
                            {rec && rec.selfies && rec.selfies.length > 0 && (
                              <div className="cal-selfie-strip">
                                {rec.selfies.slice(0, 4).map((s, i) => (
                                  <img key={s._id || i} src={s.url} alt={s.action} className="cal-selfie-avatar"
                                    title={s.action.replace(/-/g, " ")}
                                    onClick={e => { e.stopPropagation(); setLightbox({ selfies: rec.selfies!, index: i }); }} />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* ── PROFILE TAB ── */}
          {tab === "profile" && (
            <>
              <DateFilterCard {...sharedFilterProps} onQuickRange={applyQuickRange} />
              <ProfileEditor
                employee={employee}
                onUpdate={updated => {
                  setEmployee(updated);
                  sessionStorage.setItem("employeeSession", JSON.stringify(updated));
                }}
              />
            </>
          )}

        </main>

        {/* Mobile footer nav */}
        <footer className="mobile-footer">
          {(["home", "calendar", "profile"] as Tab[]).map(t => (
            <button key={t} className={`footer-btn${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
              <span style={{ fontSize: 18 }}>{t === "home" ? "🏠" : t === "calendar" ? "📅" : "👤"}</span>
              <span>{t === "home" ? "Home" : t === "calendar" ? "Calendar" : "Profile"}</span>
            </button>
          ))}
        </footer>
      </div>

      {/* Day detail modal */}
      {selectedDay && (
        <div className="modal-overlay" onClick={() => setSelectedDay(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">{new Date(selectedDay.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
                <div className="modal-sub"><span className={`status-badge s-${selectedDay.status}`} style={{ fontSize: 9 }}>{selectedDay.status.replace(/-/g, " ")}</span></div>
              </div>
              <button className="modal-close" onClick={() => setSelectedDay(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-row">
                <span className="modal-row-lbl">Check In</span>
                <span className="modal-row-val" style={isLate(selectedDay.checkIn, employee.shift) ? { color: "#d97706" } : {}}>
                  {fmt(selectedDay.checkIn)}
                  {isLate(selectedDay.checkIn, employee.shift) && (
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, background: "#fef3c7", color: "#92400e", padding: "1px 5px", borderRadius: 3, marginLeft: 6 }}>Late</span>
                  )}
                </span>
              </div>
              <div className="modal-row"><span className="modal-row-lbl">Check Out</span><span className="modal-row-val">{fmt(selectedDay.checkOut)}</span></div>
              <div className="modal-divider" />
              <div className="modal-row"><span className="modal-row-lbl">Break Time</span><span className="modal-row-val" style={{ color: "#d97706" }}>{fmtMins(selectedDay.totalBreak)}</span></div>
              <div className="modal-row"><span className="modal-row-lbl">Bio Breaks</span><span className="modal-row-val" style={{ color: "#0d9488" }}>{fmtMins(selectedDay.totalBioBreak)}</span></div>
              <div className="modal-row"><span className="modal-row-lbl">Total Worked</span><span className="modal-row-val" style={{ color: "#16a34a", fontSize: 15 }}>{fmtMins(selectedDay.totalWorked)}</span></div>
              {employee.shift?.startTime && (
                <>
                  <div className="modal-divider" />
                  <div className="modal-row"><span className="modal-row-lbl">Expected In</span><span className="modal-row-val">{fmtTime12(employee.shift.startTime)}</span></div>
                  <div className="modal-row"><span className="modal-row-lbl">Expected Out</span><span className="modal-row-val">{fmtTime12(employee.shift.endTime)}</span></div>
                </>
              )}
              {selectedDay.breaks?.length > 0 && (
                <>
                  <div className="modal-divider" />
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--text-light)", marginBottom: 4 }}>Break Sessions</div>
                  {selectedDay.breaks.map((b, i) => (
                    <div key={b._id || i} className="modal-row">
                      <span className="modal-row-lbl">#{i + 1}</span>
                      <span className="modal-row-val" style={{ fontSize: 11 }}>{fmt(b.breakIn)} → {b.breakOut ? fmt(b.breakOut) : "active"}{b.duration > 0 ? ` (${fmtMins(b.duration)})` : ""}</span>
                    </div>
                  ))}
                </>
              )}
              {selectedDay.selfies && selectedDay.selfies.length > 0 && (
                <>
                  <div className="modal-divider" />
                  <div className="modal-selfies-label">📸 Selfies ({selectedDay.selfies.length})</div>
                  <div className="modal-selfies-row">
                    {selectedDay.selfies.map((s, i) => (
                      <div key={s._id || i} className="modal-selfie-wrap"
                        onClick={() => setLightbox({ selfies: selectedDay.selfies!, index: i })}>
                        <img src={s.url} alt={s.action} className="modal-selfie-thumb" />
                        <div className="modal-selfie-badge">{s.action.replace(/-/g, " ")}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="lb-overlay" onClick={() => setLightbox(null)}>
          <div className="lb-box" onClick={e => e.stopPropagation()}>
            <button className="lb-close" onClick={() => setLightbox(null)}>✕</button>
            <div className="lb-img-wrap">
              <img src={lightbox.selfies[lightbox.index].url} alt="selfie" className="lb-img" />
            </div>
            <div className="lb-footer">
              <button className="lb-nav" disabled={lightbox.selfies.length <= 1}
                onClick={() => setLightbox(lb => lb ? { ...lb, index: (lb.index - 1 + lb.selfies.length) % lb.selfies.length } : lb)}>‹</button>
              <div className="lb-info">
                <div className="lb-action">{lightbox.selfies[lightbox.index].action.replace(/-/g, " ").toUpperCase()}</div>
                <div className="lb-time">
                  {new Date(lightbox.selfies[lightbox.index].takenAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
                  {" · "}{lightbox.index + 1} / {lightbox.selfies.length}
                </div>
              </div>
              <button className="lb-nav" disabled={lightbox.selfies.length <= 1}
                onClick={() => setLightbox(lb => lb ? { ...lb, index: (lb.index + 1) % lb.selfies.length } : lb)}>›</button>
            </div>
            {lightbox.selfies.length > 1 && (
              <div className="lb-dots">
                {lightbox.selfies.map((_, i) => (
                  <button key={i} className={`lb-dot${i === lightbox.index ? " active" : ""}`}
                    onClick={() => setLightbox(lb => lb ? { ...lb, index: i } : lb)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}