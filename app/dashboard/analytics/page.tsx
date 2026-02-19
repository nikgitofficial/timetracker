"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

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
  totalWorked: number;
  totalBreak: number;
  status: "checked-in" | "on-break" | "returned" | "checked-out";
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

function dayLabel(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function checkInHour(iso: string | null): number | null {
  if (!iso) return null;
  return new Date(iso).getHours() + new Date(iso).getMinutes() / 60;
}

// ── TINY SVG CHART COMPONENTS ────────────────────────────────────

/** Responsive bar chart drawn with SVG */
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
        {/* Y grid */}
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
        {/* Bars */}
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

/** Donut chart */
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

/** Mini sparkline */
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

/** Horizontal bar for employee comparison */
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

  // Auth
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setUser(d.user);
        else router.push("/login");
      })
      .catch(() => router.push("/login"));
  }, [router]);

  // Fetch ALL records for analytics (higher limit)
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

  useEffect(() => { if (user) fetchAll(); }, [user, fetchAll]);

  // ── DERIVED ANALYTICS ──────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  const last7 = getLast7Days();

  // Daily totals (hours worked per day for last 7)
  const dailyWorked = last7.map((d) => {
    const dayRecs = records.filter((r) => r.date === d);
    const total = dayRecs.reduce((s, r) => s + (r.totalWorked || 0), 0);
    return { x: new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }), y: toHours(total) };
  });

  // Daily headcount (unique employees per day)
  const dailyHeadcount = last7.map((d) => {
    const names = new Set(records.filter((r) => r.date === d).map((r) => r.email));
    return { x: new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }), y: names.size };
  });

  // Daily avg break (minutes)
  const dailyBreak = last7.map((d) => {
    const dayRecs = records.filter((r) => r.date === d && r.totalBreak > 0);
    const avg = dayRecs.length ? dayRecs.reduce((s, r) => s + r.totalBreak, 0) / dayRecs.length : 0;
    return { x: new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }), y: +(avg / 60).toFixed(2) };
  });

  // Status distribution
  const todayRecs = records.filter((r) => r.date === today);
  const statusCounts = {
    "checked-in": todayRecs.filter((r) => r.status === "checked-in").length,
    "on-break": todayRecs.filter((r) => r.status === "on-break").length,
    "returned": todayRecs.filter((r) => r.status === "returned").length,
    "checked-out": todayRecs.filter((r) => r.status === "checked-out").length,
  };
  const todayTotal = todayRecs.length;

  // Employee leaderboard (total hours worked in range)
  const empMap: Record<string, { name: string; email: string; worked: number; days: Set<string>; breaks: number }> = {};
  records.forEach((r) => {
    if (!empMap[r.email]) empMap[r.email] = { name: r.employeeName, email: r.email, worked: 0, days: new Set(), breaks: 0 };
    empMap[r.email].worked += r.totalWorked || 0;
    empMap[r.email].days.add(r.date);
    empMap[r.email].breaks += r.breaks?.length || 0;
  });
  const employees = Object.values(empMap).sort((a, b) => b.worked - a.worked);
  const maxWorked = employees[0]?.worked || 1;

  // Check-in time distribution (hour buckets)
  const hourBuckets: number[] = Array(24).fill(0);
  records.forEach((r) => {
    const h = checkInHour(r.checkIn);
    if (h !== null) hourBuckets[Math.floor(h)]++;
  });
  const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets));

  // Avg hours/day per employee
  const avgHoursPerEmployee = employees.length
    ? employees.reduce((s, e) => s + (e.days.size > 0 ? e.worked / e.days.size : 0), 0) / employees.length
    : 0;

  // Total worked this range
  const totalWorkedMins = records.reduce((s, r) => s + (r.totalWorked || 0), 0);
  const totalBreakMins = records.reduce((s, r) => s + (r.totalBreak || 0), 0);

  // Sparkline for each employee (worked hours per day last 7)
  function empSparkline(email: string) {
    return last7.map((d) => {
      const r = records.find((r) => r.date === d && r.email === email);
      return r ? toHours(r.totalWorked) : 0;
    });
  }

  // Check-in time bars (6am–8pm)
  const checkInBars = Array.from({ length: 15 }, (_, i) => ({
    x: `${i + 6}:00`,
    y: hourBuckets[i + 6],
  }));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cabinet+Grotesk:wght@400;500;700;900&family=DM+Mono:wght@400;500&display=swap');

        :root {
          --text: #1a1916;
          --text-muted: #57534e;
          --text-light: #a8a29e;
          --surface: #ffffff;
          --surface-alt: #f7f5f2;
          --border: #e8e6e1;
          --border-strong: #c7c3bc;
          --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
          --radius: 10px;
          --radius-sm: 6px;
          --green: #16a34a;
          --amber: #d97706;
          --blue: #2563eb;
          --red: #dc2626;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #f7f5f2;
          color: var(--text);
          font-family: 'DM Mono', monospace;
        }

        /* ── LAYOUT ── */
        .an-wrap {
          max-width: 1200px;
          margin: 0 auto;
          padding: 28px 20px 80px;
          min-height: 100vh;
        }

        @media (min-width: 768px) { .an-wrap { padding: 32px 32px 60px; } }

        /* ── TOP NAV ── */
        .an-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 28px;
        }

        .an-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .an-back {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          text-decoration: none;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--text-light);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 6px 12px;
          background: var(--surface);
          transition: all 0.15s;
          box-shadow: var(--shadow);
        }
        .an-back:hover { color: var(--text); border-color: var(--border-strong); }

        .an-title {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: clamp(22px, 4vw, 30px);
          font-weight: 900;
          letter-spacing: -0.8px;
          color: var(--text);
          line-height: 1;
        }

        .an-title span { color: var(--green); }

        .an-subtitle {
          font-size: 10px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--text-light);
          margin-top: 3px;
        }

        .an-topbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* ── DATE RANGE TOGGLE ── */
        .range-toggle {
          display: inline-flex;
          border: 1.5px solid var(--border);
          border-radius: var(--radius-sm);
          overflow: hidden;
          background: var(--surface);
          box-shadow: var(--shadow);
        }

        .range-btn {
          padding: 6px 14px;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 1px;
          text-transform: uppercase;
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--text-light);
          transition: all 0.15s;
          border-right: 1.5px solid var(--border);
        }
        .range-btn:last-child { border-right: none; }
        .range-btn.active {
          background: var(--text);
          color: #fff;
        }
        .range-btn:hover:not(.active) { background: var(--surface-alt); color: var(--text); }

        /* ── TABS ── */
        .an-tabs {
          display: flex;
          gap: 2px;
          border-bottom: 2px solid var(--border);
          margin-bottom: 24px;
        }

        .an-tab {
          padding: 10px 20px;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 1px;
          text-transform: uppercase;
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--text-light);
          border-bottom: 2px solid transparent;
          margin-bottom: -2px;
          transition: all 0.15s;
        }
        .an-tab.active {
          color: var(--text);
          border-bottom-color: var(--text);
        }
        .an-tab:hover:not(.active) { color: var(--text-muted); }

        /* ── KPI STRIP ── */
        .kpi-strip {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        }
        @media (min-width: 640px) { .kpi-strip { grid-template-columns: repeat(4, 1fr); } }

        .kpi-card {
          background: var(--surface);
          border: 1.5px solid var(--border);
          border-radius: var(--radius);
          padding: 18px 18px 20px;
          box-shadow: var(--shadow);
          position: relative;
          overflow: hidden;
          transition: transform 0.15s;
        }
        .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }

        .kpi-card::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 3px;
        }
        .kpi-card.k-green::after { background: var(--green); }
        .kpi-card.k-amber::after { background: var(--amber); }
        .kpi-card.k-blue::after  { background: var(--blue); }
        .kpi-card.k-red::after   { background: var(--red); }

        .kpi-icon { font-size: 20px; margin-bottom: 8px; }

        .kpi-label {
          font-size: 9px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--text-light);
          margin-bottom: 6px;
        }

        .kpi-value {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: clamp(24px, 3.5vw, 32px);
          font-weight: 900;
          letter-spacing: -1.5px;
          color: var(--text);
          line-height: 1;
        }

        .kpi-card.k-green .kpi-value { color: var(--green); }
        .kpi-card.k-amber .kpi-value { color: var(--amber); }
        .kpi-card.k-blue  .kpi-value { color: var(--blue); }

        .kpi-sub {
          font-size: 10px;
          color: var(--text-light);
          margin-top: 4px;
          letter-spacing: 0.5px;
        }

        /* ── GRID LAYOUTS ── */
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }
        @media (min-width: 768px) { .grid-2 { grid-template-columns: 1fr 1fr; } }

        .grid-3 {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }
        @media (min-width: 900px) { .grid-3 { grid-template-columns: 2fr 1fr; } }

        /* ── CHART CARDS ── */
        .chart-card {
          background: var(--surface);
          border: 1.5px solid var(--border);
          border-radius: var(--radius);
          padding: 20px 20px 16px;
          box-shadow: var(--shadow);
        }

        .chart-card-title {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .chart-card-title-icon { font-size: 14px; }

        .chart-wrap { width: 100%; }
        .chart-label {
          font-size: 9px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--text-light);
          margin-bottom: 6px;
        }

        /* ── DONUT SECTION ── */
        .donut-section {
          display: flex;
          align-items: center;
          gap: 24px;
          flex-wrap: wrap;
        }

        .donut-legend { flex: 1; min-width: 140px; display: flex; flex-direction: column; gap: 10px; }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .legend-dot {
          width: 10px; height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .legend-label {
          font-size: 11px;
          color: var(--text-muted);
          flex: 1;
        }

        .legend-count {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: 16px;
          font-weight: 900;
          color: var(--text);
          letter-spacing: -0.5px;
        }

        .legend-pct {
          font-size: 10px;
          color: var(--text-light);
        }

        /* ── EMPLOYEE LEADERBOARD ── */
        .emp-list { display: flex; flex-direction: column; gap: 14px; }

        .emp-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .emp-rank {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: 16px;
          font-weight: 900;
          color: var(--border-strong);
          width: 24px;
          text-align: center;
          flex-shrink: 0;
        }
        .emp-row:first-child .emp-rank { color: #d97706; }
        .emp-row:nth-child(2) .emp-rank { color: #78716c; }
        .emp-row:nth-child(3) .emp-rank { color: #92400e; }

        .emp-info { flex: 1; min-width: 0; }

        .emp-name {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: var(--text);
          letter-spacing: -0.3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .emp-meta {
          font-size: 10px;
          color: var(--text-light);
          letter-spacing: 0.5px;
          margin-top: 2px;
        }

        .emp-bar-wrap { flex: 1; }

        .emp-hours {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: 15px;
          font-weight: 900;
          color: var(--green);
          letter-spacing: -0.5px;
          flex-shrink: 0;
          width: 54px;
          text-align: right;
        }

        .emp-spark { flex-shrink: 0; }

        /* ── PEAK HOUR HEATMAP ── */
        .hour-grid {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 4px;
        }

        .hour-cell {
          border-radius: 4px;
          padding: 6px 2px;
          text-align: center;
          font-size: 8.5px;
          color: var(--text-light);
          transition: all 0.2s;
          position: relative;
        }

        .hour-cell-label {
          font-size: 7.5px;
          color: var(--text-light);
          margin-bottom: 2px;
          font-family: 'DM Mono', monospace;
        }

        .hour-cell-count {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: 13px;
          font-weight: 900;
          color: var(--text);
        }

        /* ── INSIGHT PILLS ── */
        .insights-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 16px;
        }

        .insight-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--surface);
          border: 1.5px solid var(--border);
          border-radius: 8px;
          padding: 10px 14px;
          box-shadow: var(--shadow);
          flex: 1;
          min-width: 180px;
        }

        .insight-icon { font-size: 18px; }

        .insight-text { flex: 1; }

        .insight-title {
          font-size: 9px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--text-light);
        }

        .insight-val {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: 16px;
          font-weight: 900;
          color: var(--text);
          letter-spacing: -0.5px;
        }

        /* ── LOADING / EMPTY ── */
        .an-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 24px;
          gap: 14px;
        }

        .loading-dots { display: inline-flex; gap: 6px; }
        .loading-dots span {
          width: 8px; height: 8px;
          background: var(--border-strong);
          border-radius: 50%;
          animation: ld 0.8s infinite;
        }
        .loading-dots span:nth-child(2) { animation-delay: 0.15s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.30s; }
        @keyframes ld {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40%            { transform: scale(1);   opacity: 1;   }
        }

        .loading-text {
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: var(--text-light);
        }

        /* ── DIVIDER ── */
        .section-divider {
          height: 1.5px;
          background: var(--border);
          border-radius: 2px;
          margin: 6px 0 16px;
        }

        /* ── RESPONSIVE TWEAKS ── */
        @media (max-width: 500px) {
          .range-btn { padding: 6px 10px; font-size: 9px; }
          .an-tab { padding: 8px 12px; font-size: 10px; }
          .hour-grid { grid-template-columns: repeat(4, 1fr); }
        }
      `}</style>

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
                {/* KPI Strip */}
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
                    <div className="kpi-sub">{records.reduce((s, r) => s + (r.breaks?.length || 0), 0)} sessions</div>
                  </div>
                  <div className="kpi-card k-blue">
                    <div className="kpi-icon">👥</div>
                    <div className="kpi-label">Unique Employees</div>
                    <div className="kpi-value">{employees.length}</div>
                    <div className="kpi-sub">tracked in range</div>
                  </div>
                  <div className="kpi-card k-red">
                    <div className="kpi-icon">🕐</div>
                    <div className="kpi-label">Peak Check-in Hour</div>
                    <div className="kpi-value">{peakHour > 0 ? `${peakHour}:00` : "—"}</div>
                    <div className="kpi-sub">{hourBuckets[peakHour]} check-ins</div>
                  </div>
                </div>

                {/* AI Insights Row */}
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
                    <span className="insight-icon">📅</span>
                    <div className="insight-text">
                      <div className="insight-title">Avg Daily Headcount</div>
                      <div className="insight-val">
                        {dailyHeadcount.filter((d) => d.y > 0).length > 0
                          ? (dailyHeadcount.reduce((s, d) => s + d.y, 0) / (dailyHeadcount.filter((d) => d.y > 0).length || 1)).toFixed(1)
                          : "—"}
                      </div>
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

                {/* Donut + Peak Hour */}
                <div className="grid-3">
                  <div className="chart-card">
                    <div className="chart-card-title">
                      <span className="chart-card-title-icon">🕐</span>
                      Check-in Time Heatmap (Today's Range)
                    </div>
                    <div className="hour-grid">
                      {checkInBars.map((b, i) => {
                        const max = Math.max(...checkInBars.map((x) => x.y), 1);
                        const intensity = b.y / max;
                        const bg = intensity === 0
                          ? "#f5f4f1"
                          : `rgba(22,163,74,${0.1 + intensity * 0.85})`;
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
                            { label: "Working", value: statusCounts["checked-in"], color: "#16a34a" },
                            { label: "On Break", value: statusCounts["on-break"], color: "#d97706" },
                            { label: "Returned", value: statusCounts["returned"], color: "#2563eb" },
                            { label: "Done", value: statusCounts["checked-out"], color: "#e8e6e1" },
                          ]}
                          total={todayTotal || 1}
                          centerLabel={String(todayTotal)}
                        />
                      </div>
                      <div className="donut-legend">
                        {[
                          { label: "Working", value: statusCounts["checked-in"], color: "#16a34a" },
                          { label: "On Break", value: statusCounts["on-break"], color: "#d97706" },
                          { label: "Returned", value: statusCounts["returned"], color: "#2563eb" },
                          { label: "Done", value: statusCounts["checked-out"], color: "#a8a29e" },
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
                    <div className="kpi-icon">🔢</div>
                    <div className="kpi-label">Most Active Day</div>
                    <div className="kpi-value" style={{ fontSize: "clamp(16px, 3vw, 22px)" }}>
                      {dailyHeadcount.reduce((best, d) => d.y > best.y ? d : best, { x: "—", y: 0 }).x}
                    </div>
                    <div className="kpi-sub">{Math.max(...dailyHeadcount.map(d => d.y))} employees</div>
                  </div>
                  <div className="kpi-card k-red">
                    <div className="kpi-icon">☕</div>
                    <div className="kpi-label">Most Break Sessions</div>
                    <div className="kpi-value" style={{ fontSize: "clamp(16px, 3vw, 22px)", letterSpacing: "-0.5px" }}>
                      {employees.sort((a, b) => b.breaks - a.breaks)[0]?.name.split(" ")[0] || "—"}
                    </div>
                    <div className="kpi-sub">{employees[0]?.breaks || 0} sessions</div>
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
                      {employees.slice(0, 10).map((e, i) => (
                        <div key={e.email} className="emp-row">
                          <span className="emp-rank">#{i + 1}</span>
                          <div className="emp-info">
                            <div className="emp-name">{e.name}</div>
                            <div className="emp-meta">{e.days.size} day{e.days.size !== 1 ? "s" : ""} · {e.breaks} break{e.breaks !== 1 ? "s" : ""}</div>
                            <div style={{ marginTop: 6 }}>
                              <HBar value={e.worked} max={maxWorked} color={i === 0 ? "#d97706" : "#16a34a"} />
                            </div>
                          </div>
                          <span className="emp-spark">
                            <Sparkline data={empSparkline(e.email)} color={i === 0 ? "#d97706" : "#16a34a"} />
                          </span>
                          <span className="emp-hours">{fmtMins(e.worked)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Individual employee daily breakdown */}
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
                  <div className="kpi-card k-blue">
                    <div className="kpi-icon">🏁</div>
                    <div className="kpi-label">Completion Rate</div>
                    <div className="kpi-value">
                      {records.length
                        ? `${Math.round((records.filter(r => r.status === "checked-out").length / records.length) * 100)}%`
                        : "—"}
                    </div>
                    <div className="kpi-sub">fully checked out</div>
                  </div>
                  <div className="kpi-card k-red">
                    <div className="kpi-icon">⚡</div>
                    <div className="kpi-label">Productivity Index</div>
                    <div className="kpi-value">
                      {totalWorkedMins + totalBreakMins > 0
                        ? `${Math.round((totalWorkedMins / (totalWorkedMins + totalBreakMins)) * 100)}%`
                        : "—"}
                    </div>
                    <div className="kpi-sub">work vs break ratio</div>
                  </div>
                </div>

                <div className="grid-2">
                  <div className="chart-card">
                    <div className="chart-card-title">
                      <span className="chart-card-title-icon">📊</span>
                      Daily Avg Break Duration (hrs)
                    </div>
                    <BarChart data={dailyBreak} color="#d97706" unit="h" />
                  </div>
                  <div className="chart-card">
                    <div className="chart-card-title">
                      <span className="chart-card-title-icon">👥</span>
                      Daily Headcount Trend
                    </div>
                    <BarChart data={dailyHeadcount} color="#7c3aed" unit="" />
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

                {/* Work vs Break stacked comparison */}
                <div className="chart-card">
                  <div className="chart-card-title">
                    <span className="chart-card-title-icon">⚖️</span>
                    Work vs Break — Daily Comparison (Last 7 Days)
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <svg viewBox="0 0 600 200" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", minWidth: 320, height: "auto" }}>
                      {last7.map((d, i) => {
                        const dayRecs = records.filter((r) => r.date === d);
                        const worked = dayRecs.reduce((s, r) => s + (r.totalWorked || 0), 0);
                        const brk = dayRecs.reduce((s, r) => s + (r.totalBreak || 0), 0);
                        const total = worked + brk;
                        const maxTotal = Math.max(...last7.map((dd) => {
                          const dr = records.filter((r) => r.date === dd);
                          return dr.reduce((s, r) => s + (r.totalWorked || 0) + (r.totalBreak || 0), 0);
                        }), 60);
                        const W = 600; const H = 200;
                        const pad = { top: 16, right: 8, bottom: 44, left: 8 };
                        const chartH = H - pad.top - pad.bottom;
                        const colW = (W - pad.left - pad.right) / last7.length;
                        const barW = colW * 0.55;
                        const x = pad.left + i * colW + (colW - barW) / 2;
                        const workedH = total > 0 ? (worked / maxTotal) * chartH : 0;
                        const brkH = total > 0 ? (brk / maxTotal) * chartH : 0;
                        const label = new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
                        return (
                          <g key={d}>
                            {/* Break bar (top) */}
                            <rect x={x} y={pad.top + chartH - workedH - brkH} width={barW} height={brkH} fill="#fbbf24" rx="2" opacity="0.85" />
                            {/* Worked bar (bottom) */}
                            <rect x={x} y={pad.top + chartH - workedH} width={barW} height={workedH} fill="#16a34a" rx="2" opacity="0.9" />
                            <text x={x + barW / 2} y={H - 26} textAnchor="middle" fontSize="9" fill="#78716c" fontFamily="DM Mono, monospace">
                              {label}
                            </text>
                          </g>
                        );
                      })}
                      {/* Legend */}
                      <rect x={16} y={176} width={10} height={10} fill="#16a34a" rx="2" />
                      <text x={30} y={185} fontSize="9" fill="#78716c" fontFamily="DM Mono, monospace">Work</text>
                      <rect x={72} y={176} width={10} height={10} fill="#fbbf24" rx="2" />
                      <text x={86} y={185} fontSize="9" fill="#78716c" fontFamily="DM Mono, monospace">Break</text>
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