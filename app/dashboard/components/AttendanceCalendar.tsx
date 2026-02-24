"use client";

import { useState, useEffect, useCallback } from "react";
import "./AttendanceCalendar.css";

/* ── TYPES ─────────────────────────────────────────────────────── */
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
  effectiveFrom: string;
}

interface Employee {
  _id: string;
  employeeName: string;
  email: string;
  role: "OM" | "TL" | "Agent" | "Other";
  campaign: string;
  status: string;
  profilePic: string;
  shift?: Shift;
}

type ViewMode = "monthly" | "weekly";
type ActiveTab = "calendar" | "analytics" | "leaderboard";

/* ── HELPERS ────────────────────────────────────────────────────── */
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const CHECK_IN_CUTOFF_HOUR = 9;

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", hour12:true });
}
function fmtMins(mins: number) {
  if (!mins) return "—";
  const h = Math.floor(mins / 60); const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtHrs(mins: number) { return (mins / 60).toFixed(1) + "h"; }
function toLocalStr(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,"0");
  const d = String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
function fmtTime12(time24: string): string {
  if (!time24) return "—";
  const [h, m] = time24.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2,"0")} ${ap}`;
}

function avatarUrl(name: string, pic?: string) {
  if (pic) return pic;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e4e2dd&color=7c7970&size=64`;
}

const ROLE_COLOR: Record<string,string> = {
  OM:"#7c3aed", TL:"#2563eb", Agent:"#16a34a", Other:"#6b7280",
};

/* Campaign palette — cycles through colours for each unique campaign */
const CAMPAIGN_COLORS = [
  { bg:"#eff6ff", border:"#bfdbfe", text:"#1d4ed8", dot:"#3b82f6" },
  { bg:"#f0fdf4", border:"#bbf7d0", text:"#15803d", dot:"#22c55e" },
  { bg:"#faf5ff", border:"#e9d5ff", text:"#6d28d9", dot:"#a855f7" },
  { bg:"#fff7ed", border:"#fed7aa", text:"#c2410c", dot:"#f97316" },
  { bg:"#fdf2f8", border:"#f5d0fe", text:"#a21caf", dot:"#d946ef" },
  { bg:"#f0fdfa", border:"#99f6e4", text:"#0f766e", dot:"#14b8a6" },
];
function campaignColor(campaign: string, allCampaigns: string[]) {
  const idx = allCampaigns.indexOf(campaign);
  return CAMPAIGN_COLORS[idx % CAMPAIGN_COLORS.length];
}

function isRestDay(dateStr: string, shift?: Shift | null): boolean {
  if (!shift?.restDays?.length) return false;
  const dow = new Date(dateStr + "T12:00:00").getDay();
  return shift.restDays.includes(DOW_NAMES[dow]);
}

function isLate(checkIn: string | null, shift?: Shift | null): boolean {
  if (!checkIn) return false;
  const d = new Date(checkIn);
  if (shift?.startTime) {
    const [sh, sm] = shift.startTime.split(":").map(Number);
    const grace = shift.graceMinutes ?? 15;
    return d.getHours() * 60 + d.getMinutes() > sh * 60 + sm + grace;
  }
  return d.getHours() > CHECK_IN_CUTOFF_HOUR || (d.getHours() === CHECK_IN_CUTOFF_HOUR && d.getMinutes() > 0);
}

function countWorkingDays(from: string, to: string, shift?: Shift | null): number {
  let count = 0;
  const d = new Date(from + "T12:00:00");
  const end = new Date(to + "T12:00:00");
  while (d <= end) {
    const dateStr = toLocalStr(d);
    if (shift?.restDays?.length) {
      if (!isRestDay(dateStr, shift)) count++;
    } else {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    d.setDate(d.getDate() + 1);
  }
  return count;
}

interface EmpStats {
  employee: Employee;
  records: TimeEntry[];
  daysPresent: number;
  daysLate: number;
  totalWorkedMins: number;
  totalBreakMins: number;
  totalBioBreakMins: number;
  avgCheckInTime: string;
  avgCheckOutTime: string;
  avgDailyWorked: number;
  attendanceRate: number;
  punctualityRate: number;
  longestDay: number;
  shortestDay: number;
  totalSelfies: number;
  breakSessions: number;
  streak: number;
  overtimeDays: number;
  undertimeDays: number;
  workingDays: number;
}

function computeEmpStats(emp: Employee, records: TimeEntry[], totalWorkingDays: number): EmpStats {
  const empRecords = records.filter(r => r.email === emp.email && r.employeeName === emp.employeeName);
  const daysPresent = empRecords.length;
  const daysLate = empRecords.filter(r => isLate(r.checkIn, emp.shift)).length;
  const totalWorkedMins = empRecords.reduce((s,r) => s + (r.totalWorked||0), 0);
  const totalBreakMins = empRecords.reduce((s,r) => s + (r.totalBreak||0), 0);
  const totalBioBreakMins = empRecords.reduce((s,r) => s + (r.totalBioBreak||0), 0);

  const checkIns = empRecords.filter(r => r.checkIn).map(r => new Date(r.checkIn!));
  const avgCIMins = checkIns.length > 0
    ? checkIns.reduce((s,d) => s + d.getHours()*60 + d.getMinutes(), 0) / checkIns.length : 0;
  const avgCheckInTime = checkIns.length > 0
    ? (() => { const h=Math.floor(avgCIMins/60); const m=Math.round(avgCIMins%60); const ap=h>=12?"PM":"AM"; return `${h>12?h-12:h||12}:${String(m).padStart(2,"0")} ${ap}`; })() : "—";

  const checkOuts = empRecords.filter(r => r.checkOut).map(r => new Date(r.checkOut!));
  const avgCOMins = checkOuts.length > 0
    ? checkOuts.reduce((s,d) => s + d.getHours()*60 + d.getMinutes(), 0) / checkOuts.length : 0;
  const avgCheckOutTime = checkOuts.length > 0
    ? (() => { const h=Math.floor(avgCOMins/60); const m=Math.round(avgCOMins%60); const ap=h>=12?"PM":"AM"; return `${h>12?h-12:h||12}:${String(m).padStart(2,"0")} ${ap}`; })() : "—";

  const workedDays = empRecords.filter(r => r.totalWorked > 0);
  const avgDailyWorked = workedDays.length > 0 ? Math.round(totalWorkedMins / workedDays.length) : 0;
  const attendanceRate = totalWorkingDays > 0 ? Math.round((daysPresent / totalWorkingDays) * 100) : 0;
  const punctualityRate = daysPresent > 0 ? Math.round(((daysPresent - daysLate) / daysPresent) * 100) : 100;
  const longestDay = workedDays.length > 0 ? Math.max(...workedDays.map(r => r.totalWorked)) : 0;
  const shortestDay = workedDays.length > 0 ? Math.min(...workedDays.map(r => r.totalWorked)) : 0;
  const totalSelfies = empRecords.reduce((s,r) => s + (r.selfies?.length ?? 0), 0);
  const breakSessions = empRecords.reduce((s,r) => s + (r.breaks?.length ?? 0) + (r.bioBreaks?.length ?? 0), 0);
  const overtimeDays = empRecords.filter(r => r.totalWorked >= 480).length;
  const undertimeDays = empRecords.filter(r => r.totalWorked > 0 && r.totalWorked < 420).length;

  const today = toLocalStr(new Date());
  const dateSet = new Set(empRecords.map(r => r.date));
  let streak = 0;
  const d = new Date(today + "T12:00:00");
  while (true) {
    const ds = toLocalStr(d);
    if (isRestDay(ds, emp.shift)) { d.setDate(d.getDate()-1); continue; }
    const dow = d.getDay();
    if (!emp.shift && (dow===0 || dow===6)) { d.setDate(d.getDate()-1); continue; }
    if (dateSet.has(ds)) { streak++; d.setDate(d.getDate()-1); }
    else break;
  }

  return { employee:emp, records:empRecords, daysPresent, daysLate, totalWorkedMins, totalBreakMins, totalBioBreakMins, avgCheckInTime, avgCheckOutTime, avgDailyWorked, attendanceRate, punctualityRate, longestDay, shortestDay, totalSelfies, breakSessions, streak, overtimeDays, undertimeDays, workingDays: totalWorkingDays };
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="score-bar-wrap">
      <div className="score-bar-bg"><div className="score-bar-fill" style={{ width:`${Math.min(value,100)}%`, background:color }} /></div>
      <span className="score-bar-val" style={{ color }}>{value}%</span>
    </div>
  );
}

function Sparkline({ records, days }: { records: TimeEntry[]; days: string[] }) {
  const byDate = new Map(records.map(r => [r.date, r.totalWorked]));
  const vals = days.filter(d => d).map(d => byDate.get(d!) || 0);
  if (vals.every(v => v === 0)) return <span className="spark-empty">no data</span>;
  const max = Math.max(...vals, 1);
  const W = 80, H = 28;
  const pts = vals.map((v,i) => `${(i/(vals.length-1))*W},${H-(v/max)*H}`).join(" ");
  return (
    <svg width={W} height={H} className="sparkline">
      <polyline points={pts} fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {vals.map((v,i) => <circle key={i} cx={(i/(vals.length-1))*W} cy={H-(v/max)*H} r="2" fill={v>0?"#2563eb":"#e5e7eb"} />)}
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function AttendanceCalendar() {
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const [activeTab, setActiveTab] = useState<ActiveTab>("calendar");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [records, setRecords] = useState<TimeEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<{ date: string; entries: TimeEntry[] } | null>(null);
  const [lightbox, setLightbox] = useState<{ selfies: SelfieEntry[]; index: number; name: string } | null>(null);
  const [analyticsEmp, setAnalyticsEmp] = useState<Employee | null>(null);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials:"include" })
      .then(r => r.json())
      .then(d => { if (d.user) setUser(d.user); })
      .catch(() => {});
  }, []);

  const getDateRange = useCallback(() => {
    if (viewMode === "monthly") {
      const y = currentDate.getFullYear(); const m = currentDate.getMonth();
      const from = `${y}-${String(m+1).padStart(2,"0")}-01`;
      const lastDay = new Date(y, m+1, 0).getDate();
      const to = `${y}-${String(m+1).padStart(2,"0")}-${lastDay}`;
      return { from, to };
    } else {
      const day = currentDate.getDay();
      const sun = new Date(currentDate); sun.setDate(currentDate.getDate()-day);
      const sat = new Date(sun); sat.setDate(sun.getDate()+6);
      return { from:toLocalStr(sun), to:toLocalStr(sat) };
    }
  }, [currentDate, viewMode]);

  const fetchRecords = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true);
    try {
      const { from, to } = getDateRange();
      const params = new URLSearchParams({ from, to, limit:"500" });
      params.set("email", user.email);
      const res = await fetch(`/api/time/records?${params}`, { credentials:"include" });
      if (!res.ok) return;
      const data = await res.json();
      setRecords(data.records || []);
    } catch { }
    finally { setLoading(false); }
  }, [getDateRange, user?.email]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/employees", { credentials:"include" });
      const data = await res.json();
      setEmployees(data.employees || []);
    } catch { }
  }, []);

  useEffect(() => { if (user) fetchRecords(); }, [user, fetchRecords]);
  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  setLightbox(lb => lb ? { ...lb, index:(lb.index-1+lb.selfies.length)%lb.selfies.length } : lb);
      if (e.key === "ArrowRight") setLightbox(lb => lb ? { ...lb, index:(lb.index+1)%lb.selfies.length } : lb);
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox]);

  /* When campaign filter changes, clear employee filter if that employee isn't in the new campaign */
  useEffect(() => {
    if (selectedCampaign && selectedEmployee && selectedEmployee.campaign !== selectedCampaign) {
      setSelectedEmployee(null);
    }
  }, [selectedCampaign, selectedEmployee]);

  const navigate = (dir: -1|1) => {
    const d = new Date(currentDate);
    if (viewMode === "monthly") d.setMonth(d.getMonth()+dir);
    else d.setDate(d.getDate()+dir*7);
    setCurrentDate(d);
  };
  const goToday = () => setCurrentDate(new Date());

  const getEmpShift = useCallback((email: string, name: string): Shift | undefined => {
    return employees.find(e => e.email === email && e.employeeName === name)?.shift;
  }, [employees]);

  const { from, to } = getDateRange();

  /* ── All unique campaigns from active employees ── */
  const activeEmpKeys = new Set(records.map(r => `${r.email}::${r.employeeName}`));
  const activeEmps = employees.filter(e => activeEmpKeys.has(`${e.email}::${e.employeeName}`));
  const allCampaigns = [...new Set(activeEmps.map(e => e.campaign).filter(Boolean))].sort();

  /* ── Employees filtered by campaign ── */
  const campaignFilteredEmps = selectedCampaign
    ? activeEmps.filter(e => e.campaign === selectedCampaign)
    : activeEmps;

  const selectedShift = selectedEmployee
    ? employees.find(e => e._id === selectedEmployee._id)?.shift
    : undefined;

  const totalWorkingDays = countWorkingDays(from, to, selectedShift ?? null);

  /* ── Records filtered by campaign + employee ── */
  const campaignFilteredEmpKeys = new Set(campaignFilteredEmps.map(e => `${e.email}::${e.employeeName}`));
  const filteredRecords = (() => {
    let recs = selectedCampaign
      ? records.filter(r => campaignFilteredEmpKeys.has(`${r.email}::${r.employeeName}`))
      : records;
    if (selectedEmployee) {
      recs = recs.filter(r => r.email === selectedEmployee.email && r.employeeName === selectedEmployee.employeeName);
    }
    return recs;
  })();

  const buildMonthDays = () => {
    const y = currentDate.getFullYear(); const m = currentDate.getMonth();
    const firstDay = new Date(y,m,1).getDay();
    const daysInMonth = new Date(y,m+1,0).getDate();
    const days: (string|null)[] = [];
    for (let i=0; i<firstDay; i++) days.push(null);
    for (let d=1; d<=daysInMonth; d++) days.push(`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
    return days;
  };
  const buildWeekDays = () => {
    const day = currentDate.getDay();
    const sun = new Date(currentDate); sun.setDate(currentDate.getDate()-day);
    return Array.from({ length:7 }, (_,i) => { const d=new Date(sun); d.setDate(sun.getDate()+i); return toLocalStr(d); });
  };

  const calDays = viewMode === "monthly" ? buildMonthDays() : buildWeekDays();
  const today = toLocalStr(new Date());

  const recordsByDate = filteredRecords.reduce<Record<string,TimeEntry[]>>((acc,r) => {
    if (!acc[r.date]) acc[r.date] = [];
    acc[r.date].push(r);
    return acc;
  }, {});

  const totalPresent = new Set(filteredRecords.map(r => r.date)).size;
  const totalLate = filteredRecords.filter(r => isLate(r.checkIn, getEmpShift(r.email, r.employeeName))).length;
  const avgWorked = filteredRecords.length > 0
    ? Math.round(filteredRecords.filter(r => r.totalWorked>0).reduce((s,r) => s+r.totalWorked,0) / Math.max(1, filteredRecords.filter(r => r.totalWorked>0).length))
    : 0;
  const totalWorkedHrs = filteredRecords.reduce((s,r) => s+r.totalWorked, 0);
  const attendanceRate = totalWorkingDays > 0
    ? Math.round((new Set(filteredRecords.map(r => r.date)).size / totalWorkingDays)*100) : 0;

  /* ── Stats use campaign-filtered employees ── */
  const allStats = campaignFilteredEmps.map(e => {
    const empWorkDays = countWorkingDays(from, to, e.shift ?? null);
    return computeEmpStats(e, filteredRecords, empWorkDays);
  });

  const focusStats = analyticsEmp ? allStats.find(s => s.employee._id === analyticsEmp._id) || null : null;

  const headerTitle = viewMode === "monthly"
    ? `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    : (() => {
        const day = currentDate.getDay();
        const sun = new Date(currentDate); sun.setDate(currentDate.getDate()-day);
        const sat = new Date(sun); sat.setDate(sun.getDate()+6);
        return `${sun.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${sat.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;
      })();

  const activeEmployeeKeys = new Set(filteredRecords.map(r => `${r.email}::${r.employeeName}`));

  /* ── DAY CELL ── */
  const renderDayCell = (dateStr: string|null, isWeekly = false) => {
    if (!dateStr) return <div key={`empty-${Math.random()}`} className="cal-day cal-day--empty" />;
    const entries = recordsByDate[dateStr] || [];
    const isToday = dateStr === today;
    const isPast = dateStr < today;
    const hasPresent = entries.length > 0;

    const isRest = selectedEmployee ? isRestDay(dateStr, selectedShift ?? null) : false;

    const lateEntries = entries.filter(e => isLate(e.checkIn, getEmpShift(e.email, e.employeeName)));
    const allSelfies = entries.flatMap(e => e.selfies || []);
    const dayNum = parseInt(dateStr.split("-")[2]);

    const dayClass = [
      "cal-day",
      isToday && "cal-day--today",
      isRest && !isToday && "cal-day--restday",
      !isRest && !hasPresent && isPast && !isToday && "cal-day--absent",
      hasPresent && lateEntries.length > 0 && "cal-day--late",
      hasPresent && lateEntries.length === 0 && "cal-day--present",
      isWeekly && "cal-day--weekly",
    ].filter(Boolean).join(" ");

    return (
      <div key={dateStr} className={dayClass}
        onClick={() => entries.length > 0 && setSelectedDay({ date:dateStr, entries })}
        style={{ cursor: entries.length > 0 ? "pointer" : "default" }}>
        <div className="cal-day-header">
          <span className="cal-day-num">{isWeekly ? `${DAYS[new Date(dateStr+"T12:00:00").getDay()]} ${dayNum}` : dayNum}</span>
          {isToday && <span className="cal-today-badge">Today</span>}
          {isRest && !isToday && <span className="cal-restday-badge">Rest</span>}
          {!isRest && !hasPresent && isPast && !isToday && <span className="cal-absent-badge">Absent</span>}
          {hasPresent && lateEntries.length > 0 && <span className="cal-late-badge">Late</span>}
        </div>
        {hasPresent && (
          <div className="cal-day-entries">
            {entries.slice(0, isWeekly ? 6 : 3).map((entry, i) => {
              const emp = employees.find(e => e.email===entry.email && e.employeeName===entry.employeeName);
              const selfie = entry.selfies?.find(s => s.action==="check-in");
              const entryLate = isLate(entry.checkIn, getEmpShift(entry.email, entry.employeeName));
              return (
                <div key={entry._id} className="cal-entry-avatar" title={`${entry.employeeName} — ${fmt(entry.checkIn)}`} style={{ zIndex:entries.length-i }}>
                  <img src={selfie?.url || avatarUrl(entry.employeeName, emp?.profilePic)} alt={entry.employeeName}
                    className={`cal-avatar-img${entryLate ? " cal-avatar-late" : ""}`} />
                  {entryLate && <span className="cal-avatar-late-dot" />}
                </div>
              );
            })}
            {entries.length > (isWeekly?6:3) && <div className="cal-entry-more">+{entries.length-(isWeekly?6:3)}</div>}
          </div>
        )}
        {hasPresent && (
          <div className="cal-day-stats">
            <span className="cal-stat cal-stat--green">✓ {entries.length}</span>
            {lateEntries.length > 0 && <span className="cal-stat cal-stat--amber">⏰ {lateEntries.length}</span>}
            {allSelfies.length > 0 && <span className="cal-stat cal-stat--purple">📸 {allSelfies.length}</span>}
          </div>
        )}
        {isToday && selectedShift?.startTime && (
          <div className="cal-shift-today">⏰ {fmtTime12(selectedShift.startTime)}</div>
        )}
      </div>
    );
  };

  /* ── ANALYTICS ── */
  const renderAnalytics = () => {
    if (focusStats) {
      const s = focusStats;
      const sparkDays = calDays.filter(d => d !== null) as string[];
      const empShift = s.employee.shift;
      return (
        <div className="analytics-detail">
          <div className="ad-header">
            <button className="ad-back" onClick={() => setAnalyticsEmp(null)}>← Back</button>
            <img src={avatarUrl(s.employee.employeeName, s.employee.profilePic)} className="ad-avatar" />
            <div>
              <div className="ad-name">{s.employee.employeeName}</div>
              <div className="ad-role" style={{ color:ROLE_COLOR[s.employee.role] }}>{s.employee.role}{s.employee.campaign && ` · ${s.employee.campaign}`}</div>
              {empShift?.startTime && (
                <div className="ad-shift-badge">
                  ⏰ {empShift.label || "Regular"} · {fmtTime12(empShift.startTime)} – {fmtTime12(empShift.endTime)}
                  <span className="ad-shift-grace">+{empShift.graceMinutes}m grace</span>
                  <span className="ad-shift-offdays">🏖 Off: {empShift.restDays.map(d=>d.slice(0,3)).join(", ")}</span>
                </div>
              )}
            </div>
            <div className="ad-streak">🔥 {s.streak}d streak</div>
          </div>
          <div className="ad-kpi-grid">
            <div className="ad-kpi ad-kpi--blue">
              <div className="ad-kpi-icon">📅</div>
              <div className="ad-kpi-val">{s.daysPresent}<span className="ad-kpi-sub">/{s.workingDays}</span></div>
              <div className="ad-kpi-lbl">Working Days</div>
              <ScoreBar value={s.attendanceRate} color="#2563eb" />
            </div>
            <div className="ad-kpi ad-kpi--green">
              <div className="ad-kpi-icon">⏱</div>
              <div className="ad-kpi-val">{fmtHrs(s.totalWorkedMins)}</div>
              <div className="ad-kpi-lbl">Total Hours Worked</div>
              <div className="ad-kpi-note">avg {fmtMins(s.avgDailyWorked)}/day</div>
            </div>
            <div className="ad-kpi ad-kpi--amber">
              <div className="ad-kpi-icon">⏰</div>
              <div className="ad-kpi-val">{s.punctualityRate}<span className="ad-kpi-sub">%</span></div>
              <div className="ad-kpi-lbl">Punctuality Rate</div>
              <ScoreBar value={s.punctualityRate} color={s.punctualityRate>=80?"#16a34a":"#d97706"} />
            </div>
            <div className="ad-kpi ad-kpi--purple">
              <div className="ad-kpi-icon">☕</div>
              <div className="ad-kpi-val">{s.breakSessions}</div>
              <div className="ad-kpi-lbl">Break Sessions</div>
              <div className="ad-kpi-note">{fmtMins(s.totalBreakMins)} total break</div>
            </div>
          </div>
          <div className="ad-section">
            <div className="ad-section-title">Daily Hours — {headerTitle}</div>
            <div className="ad-spark-wrap">
              <Sparkline records={s.records} days={sparkDays} />
              <div className="ad-spark-legend">
                <span>🟢 Longest: {fmtMins(s.longestDay)}</span>
                <span>🔴 Shortest: {fmtMins(s.shortestDay)}</span>
              </div>
            </div>
          </div>
          <div className="ad-section">
            <div className="ad-section-title">Time Summary</div>
            <div className="ad-time-summary">
              {empShift?.startTime && (
                <>
                  <div className="ad-ts-row ad-ts-row--shift">
                    <span className="ad-ts-lbl">Expected Check-in</span>
                    <span className="ad-ts-val ad-ts-shift">{fmtTime12(empShift.startTime)} (+{empShift.graceMinutes}m grace)</span>
                  </div>
                  <div className="ad-ts-row ad-ts-row--shift">
                    <span className="ad-ts-lbl">Expected Check-out</span>
                    <span className="ad-ts-val ad-ts-shift">{fmtTime12(empShift.endTime)}</span>
                  </div>
                </>
              )}
              <div className="ad-ts-row"><span className="ad-ts-lbl">Avg Check-in</span><span className="ad-ts-val">{s.avgCheckInTime}</span></div>
              <div className="ad-ts-row"><span className="ad-ts-lbl">Avg Check-out</span><span className="ad-ts-val">{s.avgCheckOutTime}</span></div>
              <div className="ad-ts-row"><span className="ad-ts-lbl">Avg Daily Worked</span><span className="ad-ts-val ad-ts-green">{fmtMins(s.avgDailyWorked)}</span></div>
              <div className="ad-ts-row"><span className="ad-ts-lbl">Total Break Time</span><span className="ad-ts-val ad-ts-amber">{fmtMins(s.totalBreakMins)}</span></div>
              <div className="ad-ts-row"><span className="ad-ts-lbl">Total Bio Break</span><span className="ad-ts-val ad-ts-teal">{fmtMins(s.totalBioBreakMins)}</span></div>
              <div className="ad-ts-row"><span className="ad-ts-lbl">Late Check-ins</span><span className="ad-ts-val ad-ts-red">{s.daysLate} days</span></div>
            </div>
          </div>
          <div className="ad-section">
            <div className="ad-section-title">Performance Breakdown</div>
            <div className="ad-perf-row">
              <div className="ad-perf-item ad-perf-green"><div className="ad-perf-num">{s.overtimeDays}</div><div className="ad-perf-lbl">Full Days (8h+)</div></div>
              <div className="ad-perf-item ad-perf-blue"><div className="ad-perf-num">{s.daysPresent-s.overtimeDays-s.undertimeDays}</div><div className="ad-perf-lbl">Normal Days (7–8h)</div></div>
              <div className="ad-perf-item ad-perf-red"><div className="ad-perf-num">{s.undertimeDays}</div><div className="ad-perf-lbl">Short Days (&lt;7h)</div></div>
              <div className="ad-perf-item ad-perf-gray"><div className="ad-perf-num">{s.workingDays-s.daysPresent}</div><div className="ad-perf-lbl">Absent Days</div></div>
            </div>
          </div>
          <div className="ad-section">
            <div className="ad-section-title">Day-by-Day Log</div>
            <div className="ad-log">
              {s.records.sort((a,b) => b.date.localeCompare(a.date)).map(r => {
                const late = isLate(r.checkIn, empShift);
                const worked = r.totalWorked;
                const band = worked>=480?"full":worked>=420?"normal":worked>0?"short":"absent";
                return (
                  <div key={r._id} className={`ad-log-row ad-log-${band}`}>
                    <div className="ad-log-date">
                      <div className="ad-log-day">{new Date(r.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"})}</div>
                      <div className="ad-log-num">{new Date(r.date+"T12:00:00").getDate()}</div>
                      <div className="ad-log-mon">{new Date(r.date+"T12:00:00").toLocaleDateString("en-US",{month:"short"})}</div>
                    </div>
                    <div className="ad-log-times">
                      <span className={`ad-log-in${late?" late":""}`}>{fmt(r.checkIn)}</span>
                      <span className="ad-log-arrow">→</span>
                      <span className="ad-log-out">{fmt(r.checkOut)}</span>
                      {empShift?.startTime && <span className="ad-log-expected">exp {fmtTime12(empShift.startTime)}</span>}
                    </div>
                    <div className="ad-log-worked">{worked>0?fmtMins(worked):"—"}</div>
                    <div className="ad-log-bar-wrap">
                      <div className="ad-log-bar-bg">
                        <div className="ad-log-bar-fill" style={{ width:`${Math.min((worked/480)*100,100)}%`, background:band==="full"?"#16a34a":band==="normal"?"#2563eb":band==="short"?"#f59e0b":"#e5e7eb" }} />
                      </div>
                    </div>
                    <div className="ad-log-badges">
                      {late && <span className="ad-log-badge ad-log-badge--late">Late</span>}
                      {r.breaks?.length>0 && <span className="ad-log-badge ad-log-badge--break">☕{r.breaks.length}</span>}
                      {r.selfies && r.selfies.length>0 && <span className="ad-log-badge ad-log-badge--cam">📸{r.selfies.length}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="analytics-overview">
        <div className="ao-header">
          <div className="ao-title">Team Analytics{selectedCampaign && <span className="ao-campaign-badge" style={{ background: campaignColor(selectedCampaign, allCampaigns).bg, color: campaignColor(selectedCampaign, allCampaigns).text, borderColor: campaignColor(selectedCampaign, allCampaigns).border }}>{selectedCampaign}</span>}</div>
          <div className="ao-subtitle">{headerTitle} · {totalWorkingDays} working days</div>
        </div>
        <div className="ao-team-kpis">
          <div className="ao-kpi"><div className="ao-kpi-val">{fmtHrs(totalWorkedHrs)}</div><div className="ao-kpi-lbl">Total Team Hours</div></div>
          <div className="ao-kpi"><div className="ao-kpi-val">{attendanceRate}%</div><div className="ao-kpi-lbl">Avg Attendance</div></div>
          <div className="ao-kpi"><div className="ao-kpi-val">{avgWorked>0?fmtMins(avgWorked):"—"}</div><div className="ao-kpi-lbl">Avg Day Length</div></div>
          <div className="ao-kpi"><div className="ao-kpi-val">{campaignFilteredEmps.length}</div><div className="ao-kpi-lbl">Active Employees</div></div>
        </div>
        <div className="ao-emp-list">
          {allStats.sort((a,b) => b.totalWorkedMins-a.totalWorkedMins).map(s => (
            <div key={s.employee._id} className="ao-emp-card" onClick={() => setAnalyticsEmp(s.employee)}>
              <div className="ao-ec-left">
                <img src={avatarUrl(s.employee.employeeName, s.employee.profilePic)} className="ao-ec-avatar" />
                <div>
                  <div className="ao-ec-name">{s.employee.employeeName}</div>
                  <div className="ao-ec-role" style={{ color:ROLE_COLOR[s.employee.role] }}>{s.employee.role}</div>
                  {s.employee.campaign && <div className="ao-ec-campaign" style={{ color: campaignColor(s.employee.campaign, allCampaigns).text, background: campaignColor(s.employee.campaign, allCampaigns).bg }}>{s.employee.campaign}</div>}
                  {s.employee.shift?.startTime && (
                    <div className="ao-ec-shift">{fmtTime12(s.employee.shift.startTime)} – {fmtTime12(s.employee.shift.endTime)}</div>
                  )}
                </div>
              </div>
              <div className="ao-ec-stats">
                <div className="ao-ec-stat"><div className="ao-ec-stat-val ao-ec-blue">{s.daysPresent}<span className="ao-ec-stat-sub">/{s.workingDays}</span></div><div className="ao-ec-stat-lbl">Days</div></div>
                <div className="ao-ec-stat"><div className="ao-ec-stat-val ao-ec-green">{fmtHrs(s.totalWorkedMins)}</div><div className="ao-ec-stat-lbl">Hours</div></div>
                <div className="ao-ec-stat"><div className={`ao-ec-stat-val ${s.punctualityRate>=80?"ao-ec-green":"ao-ec-amber"}`}>{s.punctualityRate}%</div><div className="ao-ec-stat-lbl">Punctual</div></div>
                <div className="ao-ec-stat"><div className="ao-ec-stat-val ao-ec-muted">{fmtMins(s.avgDailyWorked)}</div><div className="ao-ec-stat-lbl">Avg/Day</div></div>
              </div>
              <div className="ao-ec-bar"><ScoreBar value={s.attendanceRate} color="#2563eb" /></div>
              <span className="ao-ec-arrow">›</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ── LEADERBOARD ── */
  const renderLeaderboard = () => {
    const sorted = [...allStats].sort((a,b) => b.attendanceRate-a.attendanceRate);
    return (
      <div className="leaderboard">
        <div className="lb-header">
          <div className="lb-title">🏆 Team Leaderboard{selectedCampaign && <span className="lb-campaign-badge" style={{ background: campaignColor(selectedCampaign, allCampaigns).bg, color: campaignColor(selectedCampaign, allCampaigns).text, borderColor: campaignColor(selectedCampaign, allCampaigns).border }}>{selectedCampaign}</span>}</div>
          <div className="lb-sub">{headerTitle}</div>
        </div>
        <div className="lb-categories">
          {[
            { title:"Most Hours Worked",  icon:"⏱", sorted:[...allStats].sort((a,b)=>b.totalWorkedMins-a.totalWorkedMins), val:(s:EmpStats)=>fmtHrs(s.totalWorkedMins) },
            { title:"Best Attendance",    icon:"📅", sorted:[...allStats].sort((a,b)=>b.attendanceRate-a.attendanceRate),   val:(s:EmpStats)=>`${s.attendanceRate}%` },
            { title:"Most Punctual",      icon:"⏰", sorted:[...allStats].sort((a,b)=>b.punctualityRate-a.punctualityRate), val:(s:EmpStats)=>`${s.punctualityRate}%` },
            { title:"Longest Streak",     icon:"🔥", sorted:[...allStats].sort((a,b)=>b.streak-a.streak),                  val:(s:EmpStats)=>`${s.streak}d` },
          ].map(cat => (
            <div key={cat.title} className="lb-cat">
              <div className="lb-cat-title">{cat.icon} {cat.title}</div>
              {cat.sorted.slice(0,3).map((s,rank) => (
                <div key={s.employee._id} className={`lb-row lb-rank-${rank+1}`}>
                  <div className="lb-medal">{["🥇","🥈","🥉"][rank]}</div>
                  <img src={avatarUrl(s.employee.employeeName, s.employee.profilePic)} className="lb-avatar" />
                  <div className="lb-name">{s.employee.employeeName}</div>
                  <div className="lb-val">{cat.val(s)}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="lb-table-wrap">
          <div className="lb-table-title">Full Rankings</div>
          <table className="lb-table">
            <thead>
              <tr><th>#</th><th>Employee</th><th>Campaign</th><th>Schedule</th><th>Days</th><th>Hours</th><th>Avg/Day</th><th>Punctual</th><th>Late</th><th>Absent</th></tr>
            </thead>
            <tbody>
              {sorted.map((s,i) => {
                const cc = s.employee.campaign ? campaignColor(s.employee.campaign, allCampaigns) : null;
                return (
                  <tr key={s.employee._id} className="lb-table-row" onClick={() => { setAnalyticsEmp(s.employee); setActiveTab("analytics"); }}>
                    <td className="lb-table-rank">{i+1}</td>
                    <td className="lb-table-emp">
                      <img src={avatarUrl(s.employee.employeeName, s.employee.profilePic)} className="lb-table-avatar" />
                      <div>
                        <div className="lb-table-name">{s.employee.employeeName}</div>
                        <div className="lb-table-role" style={{ color:ROLE_COLOR[s.employee.role] }}>{s.employee.role}</div>
                      </div>
                    </td>
                    <td>
                      {s.employee.campaign && cc
                        ? <span className="lb-campaign-tag" style={{ background:cc.bg, color:cc.text, borderColor:cc.border }}>{s.employee.campaign}</span>
                        : <span className="lb-muted">—</span>}
                    </td>
                    <td className="lb-table-schedule">
                      {s.employee.shift?.startTime
                        ? <span className="lb-schedule-badge">{fmtTime12(s.employee.shift.startTime)}–{fmtTime12(s.employee.shift.endTime)}</span>
                        : <span className="lb-no-schedule">—</span>}
                    </td>
                    <td><span className="lb-cell lb-cell--blue">{s.daysPresent}/{s.workingDays}</span></td>
                    <td><span className="lb-cell lb-cell--green">{fmtHrs(s.totalWorkedMins)}</span></td>
                    <td className="lb-muted">{fmtMins(s.avgDailyWorked)}</td>
                    <td><span className={`lb-cell ${s.punctualityRate>=80?"lb-cell--green":"lb-cell--amber"}`}>{s.punctualityRate}%</span></td>
                    <td className={s.daysLate>0?"lb-cell lb-cell--red":"lb-muted"}>{s.daysLate}</td>
                    <td className={s.workingDays-s.daysPresent>0?"lb-cell lb-cell--red":"lb-muted"}>{s.workingDays-s.daysPresent}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  /* ── RENDER ── */
  return (
    <div className="ac-wrap">

      {/* LIGHTBOX */}
      {lightbox && (
        <div className="ac-lb-overlay" onClick={() => setLightbox(null)}>
          <div className="ac-lb-box" onClick={e => e.stopPropagation()}>
            <button className="ac-lb-close" onClick={() => setLightbox(null)}>✕</button>
            <div className="ac-lb-img-wrap"><img src={lightbox.selfies[lightbox.index].url} alt="selfie" className="ac-lb-img" /></div>
            <div className="ac-lb-footer">
              <button className="ac-lb-nav" onClick={() => setLightbox(lb => lb?{...lb,index:(lb.index-1+lb.selfies.length)%lb.selfies.length}:lb)} disabled={lightbox.selfies.length<=1}>‹</button>
              <div className="ac-lb-info">
                <div className="ac-lb-name">{lightbox.name}</div>
                <div className="ac-lb-action">{lightbox.selfies[lightbox.index].action.replace(/-/g," ").toUpperCase()}</div>
                <div className="ac-lb-time">{fmt(lightbox.selfies[lightbox.index].takenAt)} · {lightbox.index+1}/{lightbox.selfies.length}</div>
              </div>
              <button className="ac-lb-nav" onClick={() => setLightbox(lb => lb?{...lb,index:(lb.index+1)%lb.selfies.length}:lb)} disabled={lightbox.selfies.length<=1}>›</button>
            </div>
            {lightbox.selfies.length>1 && (
              <div className="ac-lb-dots">
                {lightbox.selfies.map((_,i) => <button key={i} className={`ac-lb-dot${i===lightbox.index?" active":""}`} onClick={() => setLightbox(lb => lb?{...lb,index:i}:lb)} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* DAY DETAIL MODAL */}
      {selectedDay && (
        <div className="ac-modal-overlay" onClick={() => setSelectedDay(null)}>
          <div className="ac-modal" onClick={e => e.stopPropagation()}>
            <div className="ac-modal-header">
              <div>
                <div className="ac-modal-title">{new Date(selectedDay.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</div>
                <div className="ac-modal-subtitle">{selectedDay.entries.length} employee{selectedDay.entries.length!==1?"s":""} logged</div>
              </div>
              <button className="ac-modal-close" onClick={() => setSelectedDay(null)}>✕</button>
            </div>
            <div className="ac-modal-body">
              {selectedDay.entries.map(entry => {
                const emp = employees.find(e => e.email===entry.email && e.employeeName===entry.employeeName);
                const empShift = emp?.shift;
                const checkInSelfie = entry.selfies?.find(s => s.action==="check-in");
                const late = isLate(entry.checkIn, empShift);
                return (
                  <div key={entry._id} className={`ac-emp-card${late?" ac-emp-card--late":""}`}>
                    <div className="ac-emp-card-top">
                      <div className="ac-emp-identity">
                        <div className="ac-emp-avatar-wrap">
                          <img src={checkInSelfie?.url || avatarUrl(entry.employeeName, emp?.profilePic)} alt={entry.employeeName} className="ac-emp-avatar" />
                          {late && <span className="ac-emp-late-dot" />}
                        </div>
                        <div>
                          <div className="ac-emp-name">{entry.employeeName}</div>
                          <div className="ac-emp-email">{entry.email}</div>
                          <div className="ac-emp-badges">
                            {emp && <span className="ac-role-badge" style={{ color:ROLE_COLOR[emp.role], borderColor:ROLE_COLOR[emp.role] }}>{emp.role}</span>}
                            {emp?.campaign && (() => { const cc = campaignColor(emp.campaign, allCampaigns); return <span className="ac-campaign-badge" style={{ color:cc.text, background:cc.bg, borderColor:cc.border }}>{emp.campaign}</span>; })()}
                            {late && <span className="ac-late-badge">⏰ Late</span>}
                            <span className={`ac-status-badge ac-status-${entry.status}`}>{entry.status.replace(/-/g," ")}</span>
                          </div>
                        </div>
                      </div>
                      <div className="ac-emp-worked">
                        <div className="ac-emp-worked-val">{entry.totalWorked>0?fmtMins(entry.totalWorked):"—"}</div>
                        <div className="ac-emp-worked-lbl">worked</div>
                      </div>
                    </div>
                    {empShift?.startTime && (
                      <div className="ac-shift-bar">
                        <span className="ac-shift-bar-label">⏰ {empShift.label || "Regular"}</span>
                        <span className="ac-shift-bar-time">{fmtTime12(empShift.startTime)} – {fmtTime12(empShift.endTime)}</span>
                        <span className="ac-shift-bar-grace">+{empShift.graceMinutes}m grace</span>
                        <span className={`ac-shift-bar-status${late?" late":" ontime"}`}>{late ? "⏰ Late" : "✓ On Time"}</span>
                      </div>
                    )}
                    <div className="ac-time-grid">
                      <div className="ac-time-item">
                        <span className="ac-time-lbl">Check In{empShift?.startTime && <span className="ac-time-exp"> (exp {fmtTime12(empShift.startTime)})</span>}</span>
                        <span className={`ac-time-val${late?" ac-time-val--late":""}`}>{fmt(entry.checkIn)}</span>
                      </div>
                      <div className="ac-time-item">
                        <span className="ac-time-lbl">Check Out{empShift?.endTime && <span className="ac-time-exp"> (exp {fmtTime12(empShift.endTime)})</span>}</span>
                        <span className="ac-time-val">{fmt(entry.checkOut)}</span>
                      </div>
                      <div className="ac-time-item"><span className="ac-time-lbl">Break Total</span><span className="ac-time-val ac-time-val--amber">{fmtMins(entry.totalBreak)}</span></div>
                      <div className="ac-time-item"><span className="ac-time-lbl">Bio Break</span><span className="ac-time-val ac-time-val--teal">{fmtMins(entry.totalBioBreak)}</span></div>
                    </div>
                    {entry.breaks?.length>0 && (
                      <div className="ac-sessions">
                        <div className="ac-sessions-label">☕ Break Sessions</div>
                        {entry.breaks.map((b,i) => (
                          <div key={b._id||i} className="ac-session-row">
                            <span className="ac-session-num">#{i+1}</span><span>{fmt(b.breakIn)}</span>
                            <span className="ac-session-arrow">→</span>
                            <span>{b.breakOut?fmt(b.breakOut):<span className="ac-session-live">ACTIVE</span>}</span>
                            {b.duration>0 && <span className="ac-session-dur">{fmtMins(b.duration)}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {entry.bioBreaks?.length>0 && (
                      <div className="ac-sessions ac-sessions--bio">
                        <div className="ac-sessions-label">🚻 Bio Break Sessions</div>
                        {entry.bioBreaks.map((b,i) => (
                          <div key={b._id||i} className="ac-session-row">
                            <span className="ac-session-num">#{i+1}</span><span>{fmt(b.breakIn)}</span>
                            <span className="ac-session-arrow">→</span>
                            <span>{b.breakOut?fmt(b.breakOut):<span className="ac-session-live ac-session-live--teal">ACTIVE</span>}</span>
                            {b.duration>0 && <span className="ac-session-dur ac-session-dur--teal">{fmtMins(b.duration)}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {entry.selfies && entry.selfies.length>0 && (
                      <div className="ac-selfies">
                        <div className="ac-selfies-label">📸 Selfies</div>
                        <div className="ac-selfies-row">
                          {entry.selfies.map((s,i) => (
                            <div key={s._id||i} className="ac-selfie-thumb-wrap" onClick={() => setLightbox({ selfies:entry.selfies!, index:i, name:entry.employeeName })}>
                              <img src={s.url} alt={s.action} className="ac-selfie-thumb" />
                              <div className="ac-selfie-badge">{s.action.replace(/-/g," ")}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="ac-header">
        <div>
          <h1 className="ac-title">Attendance Calendar</h1>
          <p className="ac-subtitle">Visual Attendance Overview</p>
        </div>
        <div className="ac-header-actions">
          {activeTab==="calendar" && (
            <div className="ac-view-toggle">
              <button className={`ac-toggle-btn${viewMode==="monthly"?" active":""}`} onClick={() => setViewMode("monthly")}>Monthly</button>
              <button className={`ac-toggle-btn${viewMode==="weekly"?" active":""}`} onClick={() => setViewMode("weekly")}>Weekly</button>
            </div>
          )}
          {activeTab==="calendar" && <button className="ac-today-btn" onClick={goToday}>Today</button>}
        </div>
      </div>

      {/* TABS */}
      <div className="ac-tabs">
        <button className={`ac-tab${activeTab==="calendar"?" active":""}`} onClick={() => setActiveTab("calendar")}>📅 Calendar</button>
        <button className={`ac-tab${activeTab==="analytics"?" active":""}`} onClick={() => setActiveTab("analytics")}>📊 Analytics</button>
        <button className={`ac-tab${activeTab==="leaderboard"?" active":""}`} onClick={() => setActiveTab("leaderboard")}>🏆 Leaderboard</button>
      </div>

      {/* ── CAMPAIGN + EMPLOYEE FILTERS ── */}
      <div className="ac-filter-bar">
        {/* Campaign row */}
        {allCampaigns.length > 0 && (
          <div className="ac-campaign-filter-row">
            <span className="ac-filter-label-inline">📁 Campaign</span>
            <div className="ac-campaign-pills">
              <button
                className={`ac-campaign-pill${!selectedCampaign ? " active" : ""}`}
                onClick={() => { setSelectedCampaign(""); setSelectedEmployee(null); }}
              >
                All
              </button>
              {allCampaigns.map(c => {
                const cc = campaignColor(c, allCampaigns);
                const isActive = selectedCampaign === c;
                return (
                  <button
                    key={c}
                    className={`ac-campaign-pill${isActive ? " active" : ""}`}
                    style={isActive
                      ? { background: cc.text, borderColor: cc.text, color: "#fff" }
                      : { background: cc.bg, borderColor: cc.border, color: cc.text }}
                    onClick={() => { setSelectedCampaign(isActive ? "" : c); setSelectedEmployee(null); }}
                  >
                    <span className="ac-campaign-dot" style={{ background: isActive ? "rgba(255,255,255,0.7)" : cc.dot }} />
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Employee dropdown (filtered by campaign) */}
        <div className="ac-employee-filter-row">
          <span className="ac-filter-label-inline">👤 Employee</span>
          <div className="ac-emp-dropdown-wrap">
            <div className="ac-emp-dropdown-avatar-slot">
              {selectedEmployee
                ? <img src={avatarUrl(selectedEmployee.employeeName, selectedEmployee.profilePic)} alt={selectedEmployee.employeeName} className="ac-emp-dd-avatar" />
                : <span className="ac-emp-dd-avatar ac-emp-dd-avatar--all">ALL</span>}
            </div>
            <select
              className="ac-emp-dropdown"
              value={selectedEmployee?._id ?? ""}
              onChange={e => {
                const found = employees.find(emp => emp._id === e.target.value) ?? null;
                setSelectedEmployee(found);
              }}
            >
              <option value="">{selectedCampaign ? `All in ${selectedCampaign}` : "All Employees"}</option>
              {campaignFilteredEmps
                .filter(emp => activeEmployeeKeys.has(`${emp.email}::${emp.employeeName}`) || !selectedCampaign)
                .map(emp => (
                  <option key={emp._id} value={emp._id}>
                    {emp.employeeName} · {emp.role}{emp.campaign ? ` · ${emp.campaign}` : ""}{emp.shift?.startTime ? ` · ${fmtTime12(emp.shift.startTime)}` : ""}
                  </option>
                ))}
            </select>
            {selectedEmployee && (
              <button className="ac-emp-dd-clear" onClick={() => setSelectedEmployee(null)} title="Clear filter">✕</button>
            )}
          </div>
        </div>
      </div>

      {/* SUMMARY STATS */}
      <div className="ac-stats">
        <div className="ac-stat-card ac-stat-green"><div className="ac-stat-label">Present Days</div><div className="ac-stat-val">{totalPresent}</div></div>
        <div className="ac-stat-card ac-stat-amber"><div className="ac-stat-label">Late Check-ins</div><div className="ac-stat-val">{totalLate}</div></div>
        <div className="ac-stat-card ac-stat-blue"><div className="ac-stat-label">Avg Worked</div><div className="ac-stat-val">{avgWorked>0?fmtMins(avgWorked):"—"}</div></div>
        <div className="ac-stat-card ac-stat-purple"><div className="ac-stat-label">Total Hours</div><div className="ac-stat-val">{fmtHrs(totalWorkedHrs)}</div></div>
        <div className="ac-stat-card ac-stat-teal"><div className="ac-stat-label">Working Days</div><div className="ac-stat-val">{totalWorkingDays}</div></div>
        <div className="ac-stat-card ac-stat-rose"><div className="ac-stat-label">Attendance Rate</div><div className="ac-stat-val">{attendanceRate}%</div></div>
      </div>

      {/* CALENDAR TAB */}
      {activeTab==="calendar" && (
        <>
          <div className="ac-calendar-card">
            <div className="ac-cal-nav">
              <button className="ac-nav-btn" onClick={() => navigate(-1)}>‹</button>
              <div className="ac-cal-title">{headerTitle}</div>
              <button className="ac-nav-btn" onClick={() => navigate(1)}>›</button>
              {loading && <span className="ac-loading-dot" />}
            </div>
            <div className="ac-legend">
              <span className="ac-legend-item"><span className="ac-legend-dot ac-legend-present" />Present</span>
              <span className="ac-legend-item"><span className="ac-legend-dot ac-legend-late" />Late</span>
              <span className="ac-legend-item"><span className="ac-legend-dot ac-legend-absent" />Absent</span>
              <span className="ac-legend-item"><span className="ac-legend-dot ac-legend-today" />Today</span>
              <span className="ac-legend-item"><span className="ac-legend-dot ac-legend-restday" />Rest Day</span>
            </div>
            {viewMode==="monthly" && (
              <div className="ac-day-headers">{DAYS.map(d => <div key={d} className="ac-day-header-cell">{d}</div>)}</div>
            )}
            {viewMode==="monthly"
              ? <div className="ac-month-grid">{calDays.map((d) => renderDayCell(d, false))}</div>
              : <div className="ac-week-grid">{(calDays as string[]).map(d => renderDayCell(d, true))}</div>}
          </div>

          {selectedEmployee && (() => {
            const stats = allStats.find(s => s.employee._id===selectedEmployee._id);
            const empShift = selectedEmployee.shift;
            const cc = selectedEmployee.campaign ? campaignColor(selectedEmployee.campaign, allCampaigns) : null;
            return (
              <div className="ac-drill-card">
                <div className="ac-drill-header">
                  <img src={avatarUrl(selectedEmployee.employeeName, selectedEmployee.profilePic)} alt={selectedEmployee.employeeName} className="ac-drill-avatar" />
                  <div>
                    <div className="ac-drill-name">{selectedEmployee.employeeName}</div>
                    <div className="ac-drill-email">{selectedEmployee.email}</div>
                    <div className="ac-drill-meta">
                      <span style={{ color:ROLE_COLOR[selectedEmployee.role] }}>{selectedEmployee.role}</span>
                      {selectedEmployee.campaign && cc && <span className="ac-drill-campaign-tag" style={{ background:cc.bg, color:cc.text, borderColor:cc.border }}>{selectedEmployee.campaign}</span>}
                    </div>
                    {empShift?.startTime && (
                      <div className="drill-shift-info">
                        <span className="dqs dqs--shift">⏰ {empShift.label || "Regular"}: {fmtTime12(empShift.startTime)} – {fmtTime12(empShift.endTime)}</span>
                        <span className="dqs dqs--restday">🏖 Off: {empShift.restDays.map(d=>d.slice(0,3)).join(", ")}</span>
                      </div>
                    )}
                    {stats && (
                      <div className="drill-quick-stats">
                        <span className="dqs dqs--blue">📅 {stats.daysPresent}/{stats.workingDays} days</span>
                        <span className="dqs dqs--green">⏱ {fmtHrs(stats.totalWorkedMins)}</span>
                        <span className="dqs dqs--amber">{stats.attendanceRate}% attendance</span>
                        <span className="dqs dqs--purple">{stats.punctualityRate}% on-time</span>
                        {stats.streak>0 && <span className="dqs dqs--fire">🔥 {stats.streak}d streak</span>}
                      </div>
                    )}
                  </div>
                  <button className="ac-drill-close" onClick={() => setSelectedEmployee(null)}>✕ Clear Filter</button>
                </div>
                <div className="ac-drill-records">
                  {filteredRecords.length===0 ? (
                    <div className="ac-drill-empty">No records in this period</div>
                  ) : (
                    filteredRecords.sort((a,b) => b.date.localeCompare(a.date)).map(entry => {
                      const entryLate = isLate(entry.checkIn, empShift);
                      return (
                        <div key={entry._id} className={`ac-drill-row${entryLate?" ac-drill-row--late":""}`}>
                          <div className="ac-drill-date">
                            <div className="ac-drill-date-day">{new Date(entry.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"})}</div>
                            <div className="ac-drill-date-num">{new Date(entry.date+"T12:00:00").getDate()}</div>
                            <div className="ac-drill-date-month">{new Date(entry.date+"T12:00:00").toLocaleDateString("en-US",{month:"short"})}</div>
                          </div>
                          <div className="ac-drill-times">
                            <div className="ac-drill-time-row">
                              <span className="ac-drill-lbl">In</span>
                              <span className={`ac-drill-time${entryLate?" late":""}`}>{fmt(entry.checkIn)}</span>
                              {entryLate && <span className="ac-drill-late-tag">Late</span>}
                              {empShift?.startTime && <span className="ac-drill-expected">exp {fmtTime12(empShift.startTime)}</span>}
                            </div>
                            <div className="ac-drill-time-row">
                              <span className="ac-drill-lbl">Out</span>
                              <span className="ac-drill-time">{fmt(entry.checkOut)}</span>
                              {empShift?.endTime && <span className="ac-drill-expected">exp {fmtTime12(empShift.endTime)}</span>}
                            </div>
                          </div>
                          <div className="ac-drill-summary">
                            <span className="ac-drill-worked">{entry.totalWorked>0?fmtMins(entry.totalWorked):"—"}</span>
                            <span className="ac-drill-breaks">{entry.breaks?.length>0?`${entry.breaks.length}× break`:""}</span>
                          </div>
                          <div className="drill-hours-bar">
                            <div className="drill-hours-fill" style={{ width:`${Math.min((entry.totalWorked/480)*100,100)}%`, background:entry.totalWorked>=480?"#16a34a":entry.totalWorked>=420?"#2563eb":"#f59e0b" }} />
                          </div>
                          {entry.selfies && entry.selfies.length>0 && (
                            <div className="ac-drill-selfies">
                              {entry.selfies.slice(0,3).map((s,i) => (
                                <img key={i} src={s.url} alt={s.action} className="ac-drill-selfie-thumb" onClick={() => setLightbox({ selfies:entry.selfies!, index:i, name:entry.employeeName })} />
                              ))}
                              {entry.selfies.length>3 && <span className="ac-drill-selfie-more">+{entry.selfies.length-3}</span>}
                            </div>
                          )}
                          <div className={`ac-drill-status ac-drill-status--${entry.status}`}>{entry.status.replace(/-/g," ")}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}
        </>
      )}

      {activeTab==="analytics" && <div className="ac-calendar-card" style={{ padding:0 }}>{renderAnalytics()}</div>}
      {activeTab==="leaderboard" && <div className="ac-calendar-card" style={{ padding:0 }}>{renderLeaderboard()}</div>}
    </div>
  );
}