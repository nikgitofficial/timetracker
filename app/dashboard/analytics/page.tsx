"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import "./Analytics.css"

// ── TYPES ────────────────────────────────────────────────────────
interface BreakSession {
  _id: string;
  breakIn: string;
  breakOut: string | null;
  duration: number;
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
}

// ── ADDED: Employee roster type ──────────────────────────────────
interface Employee {
  _id: string;
  employeeName: string;
  email: string;
  role: "OM" | "TL" | "Agent" | "Other";
  status: "active" | "on-leave" | "absent" | "inactive";
  campaign: string;
}

// ── HELPERS ──────────────────────────────────────────────────────
function fmtMins(mins: number) {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function toHours(mins: number) {
  return +(mins / 60).toFixed(2);
}

function getLast7Days() {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

function checkInHour(iso: string | null): number | null {
  if (!iso) return null;
  return new Date(iso).getHours() + new Date(iso).getMinutes() / 60;
}

// ── SVG CHART COMPONENTS ─────────────────────────────────────────

function BarChart({
  data,
  color = "#16a34a",
  label,
  unit = "h",
}: {
  data: { x: string; y: number }[];
  color?: string;
  label?: string;
  unit?: string;
}) {
  const max = Math.max(...data.map((d) => d.y), 0.1);
  const W = 600;
  const H = 180;
  const pad = { top: 12, right: 8, bottom: 48, left: 36 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const barW = Math.max(8, chartW / data.length - 8);

  return (
    <div className="chart-wrap">
      {label && <div className="chart-label">{label}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "auto" }}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = pad.top + chartH * (1 - t);
          return (
            <g key={t}>
              <line x1={pad.left} x2={W - pad.right} y1={y} y2={y} stroke="#e8e6e1" strokeWidth="1" />
              <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#a8a29e" fontFamily="DM Mono, monospace">
                {+(max * t).toFixed(1)}{unit}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = pad.left + (i / data.length) * chartW + (chartW / data.length - barW) / 2;
          const barH = (d.y / max) * chartH;
          const y = pad.top + chartH - barH;
          return (
            <g key={i}>
              <rect x={x} y={pad.top + chartH} width={barW} height={0} fill={color} rx="3" opacity="0.9">
                <animate attributeName="height" from="0" to={barH} dur="0.6s" fill="freeze" begin={`${i * 0.04}s`} />
                <animate attributeName="y" from={pad.top + chartH} to={y} dur="0.6s" fill="freeze" begin={`${i * 0.04}s`} />
              </rect>
              <text x={x + barW / 2} y={H - 30} textAnchor="middle" fontSize="8.5" fill="#78716c" fontFamily="DM Mono, monospace" transform={`rotate(-35 ${x + barW / 2} ${H - 30})`}>
                {d.x}
              </text>
              {d.y > 0 && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="9" fill={color} fontFamily="DM Mono, monospace" fontWeight="600">
                  {d.y.toFixed(1)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DonutChart({
  segments,
  total,
  centerLabel,
}: {
  segments: { label: string; value: number; color: string }[];
  total: number;
  centerLabel: string;
}) {
  const R = 70;
  const cx = 100;
  const cy = 100;
  const strokeW = 26;
  const circumference = 2 * Math.PI * R;
  let offset = 0;

  const slices = segments.map((s) => {
    const fraction = total > 0 ? s.value / total : 0;
    const dash = fraction * circumference;
    const gap = circumference - dash;
    const slice = { ...s, dash, gap, offset };
    offset += dash;
    return slice;
  });

  return (
    <svg viewBox="0 0 200 200" style={{ width: "100%", maxWidth: 200 }}>
      {slices.map((s, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={R}
          fill="none"
          stroke={s.color}
          strokeWidth={strokeW}
          strokeDasharray={`${s.dash} ${s.gap}`}
          strokeDashoffset={-s.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          opacity="0.9"
        />
      ))}
      <circle cx={cx} cy={cy} r={R - strokeW / 2 - 2} fill="#faf9f7" />
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize="22" fontWeight="800" fill="#1a1916" fontFamily="Cabinet Grotesk, sans-serif">{centerLabel}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#a8a29e" fontFamily="DM Mono, monospace" letterSpacing="1">RECORDS</text>
    </svg>
  );
}

function Sparkline({ data, color = "#16a34a" }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 0.01);
  const min = Math.min(...data);
  const W = 120;
  const H = 36;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / (max - min || 1)) * H * 0.85 - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: 80, height: 24 }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ background: "#f0ede8", borderRadius: 4, height: 6, width: "100%", overflow: "hidden" }}>
      <div
        style={{
          background: color,
          height: "100%",
          width: `${pct}%`,
          borderRadius: 4,
          transition: "width 0.8s cubic-bezier(.22,1,.36,1)",
        }}
      />
    </div>
  );
}

// ── MAIN ANALYTICS PAGE ──────────────────────────────────────────
export default function AnalyticsPage() {
  const router = useRouter();
  const [records, setRecords] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "employees" | "trends">("overview");
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "all">("7d");

  // ── ADDED: employee roster state ─────────────────────────────
  const [roster, setRoster] = useState<Employee[]>([]);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setUser(d.user);
        else router.push("/login");
      })
      .catch(() => router.push("/login"));
  }, [router]);

  // ── ADDED: fetch roster alongside records ────────────────────
  const fetchRoster = useCallback(async () => {
    try {
      const res = await fetch("/api/employees", { credentials: "include" });
      const data = await res.json();
      setRoster(data.employees || []);
    } catch { /* silent */ }
  }, []);

  const fetchAll = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("limit", "500");
    params.set("email", user.email);
    if (dateRange === "7d") {
      const from = new Date();
      from.setDate(from.getDate() - 6);
      params.set("from", from.toISOString().split("T")[0]);
    } else if (dateRange === "30d") {
      const from = new Date();
      from.setDate(from.getDate() - 29);
      params.set("from", from.toISOString().split("T")[0]);
    }
    try {
      const res = await fetch(`/api/time/records?${params}`, { credentials: "include" });
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setRecords(data.records || []);
    } catch {}
    finally { setLoading(false); }
  }, [user?.email, dateRange, router]);

  useEffect(() => {
    if (user) {
      fetchAll();
      fetchRoster(); // ── ADDED
    }
  }, [user, fetchAll, fetchRoster]);

  // ── DERIVED ANALYTICS ──────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  const last7 = getLast7Days();

  const dailyWorked = last7.map((d) => {
    const dayRecs = records.filter((r) => r.date === d);
    const total = dayRecs.reduce((s, r) => s + (r.totalWorked || 0), 0);
    return { x: new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }), y: toHours(total) };
  });

  const dailyHeadcount = last7.map((d) => {
    const names = new Set(records.filter((r) => r.date === d).map((r) => r.email));
    return { x: new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }), y: names.size };
  });

  const dailyBreak = last7.map((d) => {
    const dayRecs = records.filter((r) => r.date === d && r.totalBreak > 0);
    const avg = dayRecs.length ? dayRecs.reduce((s, r) => s + r.totalBreak, 0) / dayRecs.length : 0;
    return { x: new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }), y: +(avg / 60).toFixed(2) };
  });

  const dailyBioBreak = last7.map((d) => {
    const dayRecs = records.filter((r) => r.date === d && (r.totalBioBreak || 0) > 0);
    const avg = dayRecs.length ? dayRecs.reduce((s, r) => s + (r.totalBioBreak || 0), 0) / dayRecs.length : 0;
    return { x: new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }), y: +(avg / 60).toFixed(2) };
  });

  const todayRecs = records.filter((r) => r.date === today);
  const statusCounts = {
    "checked-in": todayRecs.filter((r) => r.status === "checked-in").length,
    "on-break": todayRecs.filter((r) => r.status === "on-break").length,
    "on-bio-break": todayRecs.filter((r) => r.status === "on-bio-break").length,
    "returned": todayRecs.filter((r) => r.status === "returned").length,
    "checked-out": todayRecs.filter((r) => r.status === "checked-out").length,
  };
  const todayTotal = todayRecs.length;

  const empMap: Record<string, {
    name: string;
    email: string;
    worked: number;
    days: Set<string>;
    breaks: number;
    bioBreaks: number;
    totalBioBreak: number;
  }> = {};

  records.forEach((r) => {
    if (!empMap[r.email]) {
      empMap[r.email] = { name: r.employeeName, email: r.email, worked: 0, days: new Set(), breaks: 0, bioBreaks: 0, totalBioBreak: 0 };
    }
    empMap[r.email].worked += r.totalWorked || 0;
    empMap[r.email].days.add(r.date);
    empMap[r.email].breaks += r.breaks?.length || 0;
    empMap[r.email].bioBreaks += r.bioBreaks?.length || 0;
    empMap[r.email].totalBioBreak += r.totalBioBreak || 0;
  });

  const employees = Object.values(empMap).sort((a, b) => b.worked - a.worked);
  const maxWorked = employees[0]?.worked || 1;

  const hourBuckets: number[] = Array(24).fill(0);
  records.forEach((r) => {
    const h = checkInHour(r.checkIn);
    if (h !== null) hourBuckets[Math.floor(h)]++;
  });
  const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets));

  const avgHoursPerEmployee = employees.length
    ? employees.reduce((s, e) => s + (e.days.size > 0 ? e.worked / e.days.size : 0), 0) / employees.length
    : 0;

  const totalWorkedMins = records.reduce((s, r) => s + (r.totalWorked || 0), 0);
  const totalBreakMins = records.reduce((s, r) => s + (r.totalBreak || 0), 0);
  const totalBioBreakMins = records.reduce((s, r) => s + (r.totalBioBreak || 0), 0);
  const totalBreakSessions = records.reduce((s, r) => s + (r.breaks?.length || 0), 0);
  const totalBioBreakSessions = records.reduce((s, r) => s + (r.bioBreaks?.length || 0), 0);

  // ── ADDED: roster-derived stats ──────────────────────────────
  const rosterTotal    = roster.length;
  const rosterActive   = roster.filter(e => e.status === "active").length;
  const rosterOnLeave  = roster.filter(e => e.status === "on-leave" || e.status === "absent").length;
  const rosterInactive = roster.filter(e => e.status === "inactive").length;
  const rosterByRole   = {
    OM:    roster.filter(e => e.role === "OM").length,
    TL:    roster.filter(e => e.role === "TL").length,
    Agent: roster.filter(e => e.role === "Agent").length,
    Other: roster.filter(e => e.role === "Other").length,
  };
  // Employees on roster who clocked in today
  const rosterEmailSet = new Set(roster.map(e => e.email));
  const todayPresentFromRoster = todayRecs.filter(r => rosterEmailSet.has(r.email));
  const attendanceRate = rosterActive > 0
    ? Math.round((new Set(todayPresentFromRoster.map(r => r.email)).size / rosterActive) * 100)
    : 0;

  function empSparkline(email: string) {
    return last7.map((d) => {
      const r = records.find((r) => r.date === d && r.email === email);
      return r ? toHours(r.totalWorked) : 0;
    });
  }

  const checkInBars = Array.from({ length: 15 }, (_, i) => ({
    x: `${i + 6}:00`,
    y: hourBuckets[i + 6],
  }));

  const mostBioBreaksEmp = [...employees].sort((a, b) => b.bioBreaks - a.bioBreaks)[0];

  return (
    <>
     

      <div className="an-wrap">
        {/* Top Bar */}
        <div className="an-topbar">
          <div className="an-brand">
            <a href="/dashboard" className="an-back">← Records</a>
            <div>
              <h1 className="an-title">Analytics <span>&</span> Insights</h1>
              <p className="an-subtitle">TimeTrack — Workforce Intelligence</p>
            </div>
          </div>
          <div className="an-topbar-right">
            <div className="range-toggle">
              {(["7d", "30d", "all"] as const).map((r) => (
                <button key={r} className={`range-btn${dateRange === r ? " active" : ""}`} onClick={() => setDateRange(r)}>
                  {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "All Time"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="an-tabs">
          {(["overview", "employees", "trends"] as const).map((t) => (
            <button key={t} className={`an-tab${activeTab === t ? " active" : ""}`} onClick={() => setActiveTab(t)}>
              {t === "overview" ? "📊 Overview" : t === "employees" ? "👥 Employees" : "📈 Trends"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="an-loading">
            <div className="loading-dots"><span /><span /><span /></div>
            <div className="loading-text">Crunching numbers…</div>
          </div>
        ) : (
          <>
            {/* ── OVERVIEW TAB ── */}
            {activeTab === "overview" && (
              <>
                {/* ── ADDED: Roster KPI strip ── */}
                <div className="kpi-strip-5">
                  <div className="kpi-card k-blue">
                    <div className="kpi-icon">👥</div>
                    <div className="kpi-label">Total Roster</div>
                    <div className="kpi-value">{rosterTotal}</div>
                    <div className="kpi-sub">registered employees</div>
                  </div>
                  <div className="kpi-card k-green">
                    <div className="kpi-icon">✅</div>
                    <div className="kpi-label">Active</div>
                    <div className="kpi-value">{rosterActive}</div>
                    <div className="kpi-sub">{rosterTotal > 0 ? Math.round((rosterActive / rosterTotal) * 100) : 0}% of roster</div>
                  </div>
                  <div className="kpi-card k-amber">
                    <div className="kpi-icon">🌴</div>
                    <div className="kpi-label">On Leave / Absent</div>
                    <div className="kpi-value">{rosterOnLeave}</div>
                    <div className="kpi-sub">{rosterTotal > 0 ? Math.round((rosterOnLeave / rosterTotal) * 100) : 0}% of roster</div>
                  </div>
                  <div className="kpi-card k-gray">
                    <div className="kpi-icon">💤</div>
                    <div className="kpi-label">Inactive</div>
                    <div className="kpi-value" style={{ color: "var(--text-muted)" }}>{rosterInactive}</div>
                    <div className="kpi-sub">not clocking in</div>
                  </div>
                  <div className="kpi-card k-teal">
                    <div className="kpi-icon">📅</div>
                    <div className="kpi-label">Today's Attendance</div>
                    <div className="kpi-value">{attendanceRate}%</div>
                    <div className="kpi-sub">{new Set(todayPresentFromRoster.map(r => r.email)).size} of {rosterActive} active</div>
                  </div>
                </div>

                <div className="kpi-strip">
                  <div className="kpi-card k-green">
                    <div className="kpi-icon">⏱</div>
                    <div className="kpi-label">Total Hours Worked</div>
                    <div className="kpi-value">{fmtMins(totalWorkedMins)}</div>
                    <div className="kpi-sub">{records.length} shifts</div>
                  </div>
                  <div className="kpi-card k-amber">
                    <div className="kpi-icon">☕</div>
                    <div className="kpi-label">Total Break Time</div>
                    <div className="kpi-value">{fmtMins(totalBreakMins)}</div>
                    <div className="kpi-sub">{totalBreakSessions} sessions</div>
                  </div>
                  <div className="kpi-card k-teal">
                    <div className="kpi-icon">🚻</div>
                    <div className="kpi-label">Total Bio Break</div>
                    <div className="kpi-value">{fmtMins(totalBioBreakMins)}</div>
                    <div className="kpi-sub">{totalBioBreakSessions} sessions</div>
                  </div>
                  <div className="kpi-card k-red">
                    <div className="kpi-icon">🕐</div>
                    <div className="kpi-label">Peak Check-in Hour</div>
                    <div className="kpi-value">{peakHour > 0 ? `${peakHour}:00` : "—"}</div>
                    <div className="kpi-sub">{hourBuckets[peakHour]} check-ins</div>
                  </div>
                </div>

                {/* ── ADDED: Today's attendance bar ── */}
                <div className="attendance-card">
                  <div className="attendance-title">
                    <span>📋</span> Today's Attendance Rate
                  </div>
                  <div className="attendance-bar-wrap">
                    <div className="attendance-bar-fill" style={{
                      width: `${attendanceRate}%`,
                      background: attendanceRate >= 80 ? "#16a34a" : attendanceRate >= 50 ? "#d97706" : "#dc2626",
                    }} />
                  </div>
                  <div className="attendance-meta">
                    <span>{new Set(todayPresentFromRoster.map(r => r.email)).size} clocked in today</span>
                    <span>{attendanceRate}% of {rosterActive} active employees</span>
                  </div>
                </div>

                {/* Insights */}
                <div className="insights-row">
                  <div className="insight-pill">
                    <span className="insight-icon">📐</span>
                    <div className="insight-text">
                      <div className="insight-title">Avg Hours / Shift</div>
                      <div className="insight-val">{records.length ? fmtMins(Math.round(totalWorkedMins / records.length)) : "—"}</div>
                    </div>
                  </div>
                  <div className="insight-pill">
                    <span className="insight-icon">☕</span>
                    <div className="insight-text">
                      <div className="insight-title">Avg Break / Shift</div>
                      <div className="insight-val">{records.length ? fmtMins(Math.round(totalBreakMins / records.length)) : "—"}</div>
                    </div>
                  </div>
                  <div className="insight-pill">
                    <span className="insight-icon">🚻</span>
                    <div className="insight-text">
                      <div className="insight-title">Avg Bio Break / Shift</div>
                      <div className="insight-val">{records.length ? fmtMins(Math.round(totalBioBreakMins / records.length)) : "—"}</div>
                    </div>
                  </div>
                  <div className="insight-pill">
                    <span className="insight-icon">👥</span>
                    <div className="insight-text">
                      <div className="insight-title">Unique Employees</div>
                      <div className="insight-val">{employees.length}</div>
                    </div>
                  </div>
                  <div className="insight-pill">
                    <span className="insight-icon">💡</span>
                    <div className="insight-text">
                      <div className="insight-title">Avg Hrs / Employee</div>
                      <div className="insight-val">{employees.length ? fmtMins(Math.round(totalWorkedMins / employees.length)) : "—"}</div>
                    </div>
                  </div>
                </div>

                {/* Charts Row */}
                <div className="grid-2">
                  <div className="chart-card">
                    <div className="chart-card-title">
                      <span className="chart-card-title-icon">📊</span>
                      Daily Hours Worked (Last 7 Days)
                    </div>
                    <BarChart data={dailyWorked} color="#16a34a" unit="h" />
                  </div>
                  <div className="chart-card">
                    <div className="chart-card-title">
                      <span className="chart-card-title-icon">👥</span>
                      Daily Active Employees
                    </div>
                    <BarChart data={dailyHeadcount} color="#2563eb" unit="" />
                  </div>
                </div>

                {/* Donut + Heatmap */}
                <div className="grid-3">
                  <div className="chart-card">
                    <div className="chart-card-title">
                      <span className="chart-card-title-icon">🕐</span>
                      Check-in Time Heatmap
                    </div>
                    <div className="hour-grid">
                      {checkInBars.map((b, i) => {
                        const max = Math.max(...checkInBars.map((x) => x.y), 1);
                        const intensity = b.y / max;
                        const bg = intensity === 0 ? "#f5f4f1" : `rgba(22,163,74,${0.1 + intensity * 0.85})`;
                        return (
                          <div key={i} className="hour-cell" style={{ background: bg }}>
                            <div className="hour-cell-label">{b.x}</div>
                            <div className="hour-cell-count" style={{ color: intensity > 0.5 ? "#fff" : "#1a1916" }}>
                              {b.y || ""}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="chart-card">
                    <div className="chart-card-title">
                      <span className="chart-card-title-icon">🟢</span>
                      Today's Status
                    </div>
                    <div className="donut-section">
                      <div style={{ width: 130, flexShrink: 0 }}>
                        <DonutChart
                          segments={[
                            { label: "Working",   value: statusCounts["checked-in"],   color: "#16a34a" },
                            { label: "On Break",  value: statusCounts["on-break"],     color: "#d97706" },
                            { label: "Bio Break", value: statusCounts["on-bio-break"], color: "#0d9488" },
                            { label: "Returned",  value: statusCounts["returned"],     color: "#2563eb" },
                            { label: "Done",      value: statusCounts["checked-out"],  color: "#e8e6e1" },
                          ]}
                          total={todayTotal || 1}
                          centerLabel={String(todayTotal)}
                        />
                      </div>
                      <div className="donut-legend">
                        {[
                          { label: "Working",   value: statusCounts["checked-in"],   color: "#16a34a" },
                          { label: "On Break",  value: statusCounts["on-break"],     color: "#d97706" },
                          { label: "Bio Break", value: statusCounts["on-bio-break"], color: "#0d9488" },
                          { label: "Returned",  value: statusCounts["returned"],     color: "#2563eb" },
                          { label: "Done",      value: statusCounts["checked-out"],  color: "#a8a29e" },
                        ].map((s) => (
                          <div key={s.label} className="legend-item">
                            <div className="legend-dot" style={{ background: s.color }} />
                            <span className="legend-label">{s.label}</span>
                            <span className="legend-count">{s.value}</span>
                            <span className="legend-pct">
                              {todayTotal > 0 ? `${Math.round((s.value / todayTotal) * 100)}%` : "0%"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── EMPLOYEES TAB ── */}
            {activeTab === "employees" && (
              <>
                <div className="kpi-strip">
                  <div className="kpi-card k-green">
                    <div className="kpi-icon">🏆</div>
                    <div className="kpi-label">Top Employee</div>
                    <div className="kpi-value" style={{ fontSize: "clamp(16px, 3vw, 22px)", letterSpacing: "-0.5px" }}>
                      {employees[0]?.name.split(" ")[0] || "—"}
                    </div>
                    <div className="kpi-sub">{employees[0] ? fmtMins(employees[0].worked) : "No data"}</div>
                  </div>
                  <div className="kpi-card k-blue">
                    <div className="kpi-icon">📊</div>
                    <div className="kpi-label">Avg Hours / Employee</div>
                    <div className="kpi-value">{fmtMins(Math.round(avgHoursPerEmployee))}</div>
                    <div className="kpi-sub">per day average</div>
                  </div>
                  <div className="kpi-card k-amber">
                    <div className="kpi-icon">☕</div>
                    <div className="kpi-label">Most Breaks</div>
                    <div className="kpi-value" style={{ fontSize: "clamp(16px, 3vw, 22px)", letterSpacing: "-0.5px" }}>
                      {[...employees].sort((a, b) => b.breaks - a.breaks)[0]?.name.split(" ")[0] || "—"}
                    </div>
                    <div className="kpi-sub">{[...employees].sort((a, b) => b.breaks - a.breaks)[0]?.breaks || 0} sessions</div>
                  </div>
                  <div className="kpi-card k-teal">
                    <div className="kpi-icon">🚻</div>
                    <div className="kpi-label">Most Bio Breaks</div>
                    <div className="kpi-value" style={{ fontSize: "clamp(16px, 3vw, 22px)", letterSpacing: "-0.5px" }}>
                      {mostBioBreaksEmp?.name.split(" ")[0] || "—"}
                    </div>
                    <div className="kpi-sub">{mostBioBreaksEmp?.bioBreaks || 0} sessions</div>
                  </div>
                </div>

                {/* ── ADDED: Roster breakdown card ── */}
                <div className="chart-card" style={{ marginBottom: 16 }}>
                  <div className="chart-card-title">
                    <span className="chart-card-title-icon">🗂️</span>
                    Roster Breakdown — {rosterTotal} Total Employees
                  </div>
                  <div className="role-breakdown">
                    <div className="role-tile">
                      <div className="role-tile-val" style={{ color: "#7c3aed" }}>{rosterByRole.OM}</div>
                      <div className="role-tile-lbl">Operations Manager</div>
                    </div>
                    <div className="role-tile">
                      <div className="role-tile-val" style={{ color: "#1d4ed8" }}>{rosterByRole.TL}</div>
                      <div className="role-tile-lbl">Team Lead</div>
                    </div>
                    <div className="role-tile">
                      <div className="role-tile-val" style={{ color: "#15803d" }}>{rosterByRole.Agent}</div>
                      <div className="role-tile-lbl">Agent</div>
                    </div>
                    <div className="role-tile">
                      <div className="role-tile-val" style={{ color: "var(--text-muted)" }}>{rosterByRole.Other}</div>
                      <div className="role-tile-lbl">Other</div>
                    </div>
                  </div>
                  {/* ── ADDED: Status breakdown bar ── */}
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--text-light)", marginBottom: 8 }}>Status Distribution</div>
                    <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", gap: 1 }}>
                      {rosterTotal > 0 && [
                        { val: rosterActive,   color: "#16a34a", label: "Active" },
                        { val: rosterOnLeave,  color: "#d97706", label: "On Leave/Absent" },
                        { val: rosterInactive, color: "#e8e6e1", label: "Inactive" },
                      ].map((s, i) => (
                        <div key={i} style={{ width: `${(s.val / rosterTotal) * 100}%`, background: s.color, transition: "width 0.8s" }} title={`${s.label}: ${s.val}`} />
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
                      {[
                        { val: rosterActive,   color: "#16a34a", label: "Active" },
                        { val: rosterOnLeave,  color: "#d97706", label: "Leave/Absent" },
                        { val: rosterInactive, color: "#a8a29e", label: "Inactive" },
                      ].map((s, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--text-muted)" }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                          {s.label}: <strong style={{ color: "var(--text)" }}>{s.val}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="chart-card" style={{ marginBottom: 16 }}>
                  <div className="chart-card-title">
                    <span className="chart-card-title-icon">🏅</span>
                    Employee Hours Leaderboard
                  </div>
                  {employees.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px", color: "var(--text-light)", fontSize: 12 }}>No employee data in this range</div>
                  ) : (
                    <div className="emp-list">
                      {employees.slice(0, 10).map((e, i) => {
                        // ── ADDED: enrich with roster role if available ──
                        const rosterEmp = roster.find(r => r.email === e.email);
                        return (
                          <div key={e.email} className="emp-row">
                            <span className="emp-rank">#{i + 1}</span>
                            <div className="emp-info">
                              <div className="emp-name">{e.name}</div>
                              <div className="emp-meta">
                                {rosterEmp && (
                                  <span style={{
                                    background: rosterEmp.role === "OM" ? "#ede9fe" : rosterEmp.role === "TL" ? "#eff6ff" : rosterEmp.role === "Agent" ? "#f0fdf4" : "#f5f4f1",
                                    color: rosterEmp.role === "OM" ? "#6d28d9" : rosterEmp.role === "TL" ? "#1d4ed8" : rosterEmp.role === "Agent" ? "#15803d" : "#6b7280",
                                    border: `1px solid ${rosterEmp.role === "OM" ? "#c4b5fd" : rosterEmp.role === "TL" ? "#93c5fd" : rosterEmp.role === "Agent" ? "#86efac" : "#e5e7eb"}`,
                                    borderRadius: 20, padding: "1px 6px",
                                    fontSize: 9, fontWeight: 700, letterSpacing: 0.3,
                                  }}>{rosterEmp.role}</span>
                                )}
                                {rosterEmp?.campaign && <span>· {rosterEmp.campaign}</span>}
                                <span>{e.days.size} day{e.days.size !== 1 ? "s" : ""}</span>
                                <span>·</span>
                                <span>{e.breaks} break{e.breaks !== 1 ? "s" : ""}</span>
                                {e.bioBreaks > 0 && (
                                  <>
                                    <span>·</span>
                                    <span className="bio-tag">🚻 {e.bioBreaks} bio</span>
                                  </>
                                )}
                              </div>
                              <div style={{ marginTop: 6 }}>
                                <HBar value={e.worked} max={maxWorked} color={i === 0 ? "#d97706" : "#16a34a"} />
                              </div>
                            </div>
                            <span className="emp-spark">
                              <Sparkline data={empSparkline(e.email)} color={i === 0 ? "#d97706" : "#16a34a"} />
                            </span>
                            <span className="emp-hours">{fmtMins(e.worked)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {employees.length > 0 && (
                  <div className="chart-card">
                    <div className="chart-card-title">
                      <span className="chart-card-title-icon">📅</span>
                      Top 5 Employees — Daily Hours (Last 7 Days)
                    </div>
                    <BarChart
                      data={last7.map((d) => {
                        const total = employees.slice(0, 5).reduce((s, e) => {
                          const r = records.find((r) => r.date === d && r.email === e.email);
                          return s + (r ? toHours(r.totalWorked) : 0);
                        }, 0);
                        return {
                          x: new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }),
                          y: +total.toFixed(2),
                        };
                      })}
                      color="#2563eb"
                      unit="h"
                    />
                  </div>
                )}
              </>
            )}

            {/* ── TRENDS TAB ── */}
            {activeTab === "trends" && (
              <>
                <div className="kpi-strip">
                  <div className="kpi-card k-green">
                    <div className="kpi-icon">📈</div>
                    <div className="kpi-label">Busiest Day This Week</div>
                    <div className="kpi-value" style={{ fontSize: "clamp(16px, 3vw, 22px)" }}>
                      {dailyWorked.reduce((b, d) => d.y > b.y ? d : b, { x: "—", y: 0 }).x}
                    </div>
                    <div className="kpi-sub">{Math.max(...dailyWorked.map(d => d.y)).toFixed(1)}h logged</div>
                  </div>
                  <div className="kpi-card k-amber">
                    <div className="kpi-icon">☕</div>
                    <div className="kpi-label">Avg Daily Break</div>
                    <div className="kpi-value">{fmtMins(Math.round(totalBreakMins / Math.max(last7.filter((d) => records.some((r) => r.date === d)).length, 1)))}</div>
                    <div className="kpi-sub">across active days</div>
                  </div>
                  <div className="kpi-card k-teal">
                    <div className="kpi-icon">🚻</div>
                    <div className="kpi-label">Avg Daily Bio Break</div>
                    <div className="kpi-value">{fmtMins(Math.round(totalBioBreakMins / Math.max(last7.filter((d) => records.some((r) => r.date === d)).length, 1)))}</div>
                    <div className="kpi-sub">across active days</div>
                  </div>
                  <div className="kpi-card k-red">
                    <div className="kpi-icon">⚡</div>
                    <div className="kpi-label">Productivity Index</div>
                    <div className="kpi-value">
                      {totalWorkedMins + totalBreakMins + totalBioBreakMins > 0
                        ? `${Math.round((totalWorkedMins / (totalWorkedMins + totalBreakMins + totalBioBreakMins)) * 100)}%`
                        : "—"}
                    </div>
                    <div className="kpi-sub">work vs all breaks</div>
                  </div>
                </div>

                <div className="grid-2">
                  <div className="chart-card">
                    <div className="chart-card-title">
                      <span className="chart-card-title-icon">☕</span>
                      Daily Avg Break Duration (hrs)
                    </div>
                    <BarChart data={dailyBreak} color="#d97706" unit="h" />
                  </div>
                  <div className="chart-card">
                    <div className="chart-card-title">
                      <span className="chart-card-title-icon">🚻</span>
                      Daily Avg Bio Break Duration (hrs)
                    </div>
                    <BarChart data={dailyBioBreak} color="#0d9488" unit="h" />
                  </div>
                </div>

                <div className="grid-2" style={{ marginBottom: 16 }}>
                  <div className="chart-card">
                    <div className="chart-card-title">
                      <span className="chart-card-title-icon">👥</span>
                      Daily Headcount Trend
                    </div>
                    <BarChart data={dailyHeadcount} color="#7c3aed" unit="" />
                  </div>
                  <div className="chart-card">
                    <div className="chart-card-title">
                      <span className="chart-card-title-icon">🏁</span>
                      Completion Rate
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: 140, gap: 8 }}>
                      <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 52, fontWeight: 900, letterSpacing: -2, color: "var(--green)", lineHeight: 1 }}>
                        {records.length
                          ? `${Math.round((records.filter(r => r.status === "checked-out").length / records.length) * 100)}%`
                          : "—"}
                      </div>
                      <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--text-light)" }}>
                        {records.filter(r => r.status === "checked-out").length} of {records.length} fully checked out
                      </div>
                    </div>
                  </div>
                </div>

                <div className="chart-card" style={{ marginBottom: 16 }}>
                  <div className="chart-card-title">
                    <span className="chart-card-title-icon">⏰</span>
                    Check-in Time Distribution (All Records)
                  </div>
                  <BarChart
                    data={Array.from({ length: 16 }, (_, i) => ({
                      x: `${i + 5}:00`,
                      y: hourBuckets[i + 5],
                    }))}
                    color="#0891b2"
                    unit=""
                  />
                  <div style={{ marginTop: 8, fontSize: 10, color: "var(--text-light)", letterSpacing: 0.5 }}>
                    Peak check-in time: {peakHour > 0 ? `${peakHour}:00 — ${peakHour + 1}:00` : "Not enough data"}
                  </div>
                </div>

                <div className="chart-card">
                  <div className="chart-card-title">
                    <span className="chart-card-title-icon">⚖️</span>
                    Work vs Break vs Bio Break — Daily (Last 7 Days)
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <svg viewBox="0 0 600 200" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", minWidth: 320, height: "auto" }}>
                      {last7.map((d, i) => {
                        const dayRecs = records.filter((r) => r.date === d);
                        const worked = dayRecs.reduce((s, r) => s + (r.totalWorked || 0), 0);
                        const brk = dayRecs.reduce((s, r) => s + (r.totalBreak || 0), 0);
                        const bio = dayRecs.reduce((s, r) => s + (r.totalBioBreak || 0), 0);
                        const maxTotal = Math.max(...last7.map((dd) => {
                          const dr = records.filter((r) => r.date === dd);
                          return dr.reduce((s, r) => s + (r.totalWorked || 0) + (r.totalBreak || 0) + (r.totalBioBreak || 0), 0);
                        }), 60);
                        const W = 600; const H = 200;
                        const pad = { top: 16, right: 8, bottom: 44, left: 8 };
                        const chartH = H - pad.top - pad.bottom;
                        const colW = (W - pad.left - pad.right) / last7.length;
                        const barW = colW * 0.55;
                        const x = pad.left + i * colW + (colW - barW) / 2;
                        const workedH = (worked / maxTotal) * chartH;
                        const brkH = (brk / maxTotal) * chartH;
                        const bioH = (bio / maxTotal) * chartH;
                        const label = new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
                        const totalH = workedH + brkH + bioH;
                        return (
                          <g key={d}>
                            <rect x={x} y={pad.top + chartH - totalH} width={barW} height={bioH} fill="#0d9488" rx="2" opacity="0.85" />
                            <rect x={x} y={pad.top + chartH - workedH - brkH} width={barW} height={brkH} fill="#fbbf24" rx="0" opacity="0.85" />
                            <rect x={x} y={pad.top + chartH - workedH} width={barW} height={workedH} fill="#16a34a" rx="2" opacity="0.9" />
                            <text x={x + barW / 2} y={H - 26} textAnchor="middle" fontSize="9" fill="#78716c" fontFamily="DM Mono, monospace">{label}</text>
                          </g>
                        );
                      })}
                      <rect x={16} y={176} width={10} height={10} fill="#16a34a" rx="2" />
                      <text x={30} y={185} fontSize="9" fill="#78716c" fontFamily="DM Mono, monospace">Work</text>
                      <rect x={72} y={176} width={10} height={10} fill="#fbbf24" rx="2" />
                      <text x={86} y={185} fontSize="9" fill="#78716c" fontFamily="DM Mono, monospace">Break</text>
                      <rect x={128} y={176} width={10} height={10} fill="#0d9488" rx="2" />
                      <text x={142} y={185} fontSize="9" fill="#78716c" fontFamily="DM Mono, monospace">Bio Break</text>
                    </svg>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}