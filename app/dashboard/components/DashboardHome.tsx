"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

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
  breakIn: string | null;
  breakOut: string | null;
  checkOut: string | null;
  breaks: BreakSession[];
  totalWorked: number;
  totalBreak: number;
  status: "checked-in" | "on-break" | "returned" | "checked-out";
  createdAt: string;
}

type User = {
  email: string;
  name: string;
  _id?: string;
  photoUrl?: string;
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtMins(mins: number) {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const STATUS_STYLE: Record<string, string> = {
  "checked-in": "status-in",
  "on-break": "status-break",
  returned: "status-returned",
  "checked-out": "status-out",
};

const STATUS_LABEL: Record<string, string> = {
  "checked-in": "Working",
  "on-break": "On Break",
  returned: "Returned",
  "checked-out": "Done",
};

// ── EXPORT HELPERS ──────────────────────────────────────────────

function buildExportRows(records: TimeEntry[]) {
  return records.map((r) => ({
    "Employee Name": r.employeeName,
    "Email": r.email,
    "Date": r.date,
    "Check In": fmt(r.checkIn),
    "Check Out": fmt(r.checkOut),
    "Break Sessions": r.breaks?.length
      ? r.breaks
          .map((b, i) => `#${i + 1}: ${fmt(b.breakIn)} → ${b.breakOut ? fmt(b.breakOut) : "active"}${b.duration ? ` (${fmtMins(b.duration)})` : ""}`)
          .join(" | ")
      : "—",
    "Total Break": fmtMins(r.totalBreak),
    "Total Worked": fmtMins(r.totalWorked),
    "Status": STATUS_LABEL[r.status] || r.status,
  }));
}

async function exportToExcel(records: TimeEntry[], filename = "time-records") {
  const XLSX = await import("xlsx");
  const rows = buildExportRows(records);
  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 22 }, { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
    { wch: 52 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Time Records");
  XLSX.writeFile(wb, `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

async function exportToPDF(records: TimeEntry[], filename = "time-records") {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Header
  doc.setFillColor(26, 25, 22);
  doc.rect(0, 0, 297, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TIMETRACK — Time Records Export", 14, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 150);
  doc.text(`Generated: ${new Date().toLocaleString()}  |  Records: ${records.length}`, 220, 12);

  const rows = buildExportRows(records);
  const headers = Object.keys(rows[0] || {});
  const body = rows.map((r) => headers.map((h) => r[h as keyof typeof r]));

  autoTable(doc, {
    head: [headers],
    body,
    startY: 22,
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 3,
      textColor: [30, 28, 26],
      lineColor: [228, 226, 221],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [242, 241, 238],
      textColor: [120, 116, 110],
      fontStyle: "bold",
      fontSize: 7,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
    },
    alternateRowStyles: {
      fillColor: [250, 249, 246],
    },
    columnStyles: {
      0: { fontStyle: "bold", textColor: [26, 25, 22] },
      7: { textColor: [22, 163, 74], fontStyle: "bold" },
      6: { textColor: [217, 119, 6] },
    },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 150);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 5,
      { align: "center" }
    );
  }

  doc.save(`${filename}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ────────────────────────────────────────────────────────────────

export default function DashboardHome({ user: _userProp }: { user: User }) {
  const router = useRouter();
  const [records, setRecords] = useState<TimeEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [nameFilter, setNameFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setUser(d.user);
        else router.push("/login");
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const fetchRecords = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "25");
    params.set("email", user.email);
    if (nameFilter.trim()) params.set("name", nameFilter.trim());
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    try {
      const res = await fetch(`/api/time/records?${params}`, { credentials: "include" });
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setRecords(data.records || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch { /* handle */ }
    finally { setLoading(false); }
  }, [page, nameFilter, dateFrom, dateTo, router, user?.email]);

  useEffect(() => { if (user) fetchRecords(); }, [user, fetchRecords]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this record?")) return;
    setDeleting(id);
    await fetch("/api/time/records", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
    setDeleting(null);
    fetchRecords();
  };

  const handleExportExcel = async () => {
    setExporting("excel");
    try { await exportToExcel(records); }
    finally { setExporting(null); }
  };

  const handleExportPDF = async () => {
    setExporting("pdf");
    try { await exportToPDF(records); }
    finally { setExporting(null); }
  };

  const todayRecords = records.filter((r) => r.date === today);
  const activeNow = records.filter((r) => r.date === today && r.status !== "checked-out").length;
  const totalHoursToday = todayRecords.reduce((sum, r) => sum + (r.totalWorked || 0), 0);
  const hasActiveFilters = nameFilter || dateFrom || dateTo;

  return (
    <>
      <style>{`
        .dh-wrap {
          padding: 24px 20px 80px;
          min-height: 100%;
        }

        @media (min-width: 768px) {
          .dh-wrap { padding: 28px 28px 40px; }
        }

        /* ── HEADER ── */
        .dh-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

        .dh-title {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: clamp(20px, 4vw, 26px);
          font-weight: 900;
          letter-spacing: -0.75px;
          color: var(--text);
          line-height: 1.1;
        }

        .dh-subtitle {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: var(--text-light);
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-top: 3px;
        }

        .dh-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .btn-timeclock {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--surface);
          border: 1.5px solid var(--border);
          color: var(--text-muted);
          padding: 7px 14px;
          border-radius: var(--radius-sm);
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 1px;
          text-transform: uppercase;
          text-decoration: none;
          font-weight: 500;
          transition: all 0.15s;
          box-shadow: var(--shadow);
          flex-shrink: 0;
        }
        .btn-timeclock:hover { border-color: var(--border-strong); color: var(--text); }

        /* ── EXPORT BUTTONS ── */
        .btn-export {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: var(--radius-sm);
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 1px;
          text-transform: uppercase;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          box-shadow: var(--shadow);
          flex-shrink: 0;
          border: 1.5px solid;
        }

        .btn-export:disabled {
          opacity: 0.5;
          cursor: wait;
        }

        .btn-export-excel {
          background: #f0fdf4;
          border-color: #86efac;
          color: #15803d;
        }
        .btn-export-excel:hover:not(:disabled) {
          background: #dcfce7;
          border-color: #4ade80;
        }

        .btn-export-pdf {
          background: #fff1f2;
          border-color: #fca5a5;
          color: #b91c1c;
        }
        .btn-export-pdf:hover:not(:disabled) {
          background: #fee2e2;
          border-color: #f87171;
        }

        .export-spinner {
          width: 10px;
          height: 10px;
          border: 1.5px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          flex-shrink: 0;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── STATS ── */
        .dh-stats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        }

        @media (min-width: 640px) {
          .dh-stats { grid-template-columns: repeat(4, 1fr); }
        }

        .stat-card {
          background: var(--surface);
          border: 1.5px solid var(--border);
          border-radius: var(--radius);
          padding: 16px 18px 18px;
          box-shadow: var(--shadow);
          position: relative;
          overflow: hidden;
          transition: transform 0.15s;
        }

        .stat-card:hover { transform: translateY(-1px); }

        .stat-card::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 2.5px;
        }

        .stat-card.c-default::after { background: var(--border-strong); }
        .stat-card.c-green::after   { background: #16a34a; }
        .stat-card.c-amber::after   { background: #d97706; }
        .stat-card.c-blue::after    { background: #2563eb; }

        .stat-label {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--text-light);
          margin-bottom: 8px;
        }

        .stat-value {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: clamp(26px, 4vw, 32px);
          font-weight: 900;
          letter-spacing: -1.5px;
          color: var(--text);
          line-height: 1;
        }

        .stat-card.c-green .stat-value { color: #16a34a; }
        .stat-card.c-amber .stat-value { color: #d97706; }
        .stat-card.c-blue  .stat-value { color: #2563eb; }

        /* ── FILTERS ── */
        .filter-section {
          background: var(--surface);
          border: 1.5px solid var(--border);
          border-radius: var(--radius);
          margin-bottom: 16px;
          box-shadow: var(--shadow);
          overflow: hidden;
        }

        .filter-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 18px;
          cursor: pointer;
          user-select: none;
          transition: background 0.12s;
        }

        .filter-header:hover { background: var(--surface-alt); }

        .filter-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .filter-active-badge {
          background: var(--text);
          color: #fff;
          padding: 1px 7px;
          border-radius: 20px;
          font-size: 9px;
          font-weight: 600;
        }

        .filter-chevron {
          color: var(--text-light);
          font-size: 16px;
          line-height: 1;
          transition: transform 0.2s;
          font-style: normal;
        }
        .filter-chevron.open { transform: rotate(180deg); }

        .filter-body {
          border-top: 1.5px solid var(--border);
          padding: 18px;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: flex-end;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          min-width: 150px;
        }

        .filter-label {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--text-light);
        }

        .filter-input {
          background: var(--surface-alt);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 8px 11px;
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          color: var(--text);
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          width: 100%;
        }

        .filter-input:focus {
          border-color: var(--text);
          box-shadow: 0 0 0 3px rgba(26,25,22,0.06);
        }

        .filter-actions { display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0; }

        .btn-apply {
          background: var(--text);
          color: #fff;
          border: 1.5px solid var(--text);
          border-radius: var(--radius-sm);
          padding: 8px 18px;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 1px;
          text-transform: uppercase;
          cursor: pointer;
          transition: opacity 0.15s;
          white-space: nowrap;
        }
        .btn-apply:hover { opacity: 0.82; }

        .btn-reset {
          background: transparent;
          color: var(--text-muted);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 8px 14px;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 1px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .btn-reset:hover { border-color: var(--border-strong); color: var(--text); }

        /* ── TABLE CARD ── */
        .table-card {
          background: var(--surface);
          border: 1.5px solid var(--border);
          border-radius: var(--radius);
          overflow: hidden;
          box-shadow: var(--shadow);
        }

        .table-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 13px 18px;
          border-bottom: 1.5px solid var(--border);
          flex-wrap: wrap;
          gap: 8px;
        }

        .table-card-title {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .table-card-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .record-count {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: var(--text-light);
        }

        /* ── INLINE EXPORT BTNS (inside table header) ── */
        .btn-export-sm {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border-radius: var(--radius-sm);
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          border: 1.5px solid;
        }

        .btn-export-sm:disabled { opacity: 0.5; cursor: wait; }

        .btn-export-sm-excel {
          background: #f0fdf4;
          border-color: #86efac;
          color: #15803d;
        }
        .btn-export-sm-excel:hover:not(:disabled) { background: #dcfce7; border-color: #4ade80; }

        .btn-export-sm-pdf {
          background: #fff1f2;
          border-color: #fca5a5;
          color: #b91c1c;
        }
        .btn-export-sm-pdf:hover:not(:disabled) { background: #fee2e2; border-color: #f87171; }

        /* ── DESKTOP TABLE ── */
        .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }

        table { width: 100%; border-collapse: collapse; min-width: 680px; }

        thead { background: var(--surface-alt); }

        th {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--text-light);
          padding: 10px 16px;
          text-align: left;
          white-space: nowrap;
          font-weight: 500;
          border-bottom: 1.5px solid var(--border);
        }

        td {
          padding: 12px 16px;
          border-bottom: 1px solid var(--surface-alt);
          font-size: 13px;
          white-space: nowrap;
          vertical-align: middle;
        }

        tbody tr { transition: background 0.1s; }
        tbody tr:last-child td { border-bottom: none; }
        tbody tr:hover td { background: #faf9f6; }

        .name-cell {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-weight: 700;
          font-size: 14px;
          color: var(--text);
          letter-spacing: -0.3px;
        }

        .email-cell {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          color: var(--text-muted);
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .date-cell, .time-cell {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          color: var(--text-muted);
        }

        .worked-cell {
          font-family: 'DM Mono', monospace;
          font-weight: 600;
          font-size: 12px;
          color: #16a34a;
        }

        .break-cell {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          color: #d97706;
        }

        /* ── STATUS BADGES ── */
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 9px;
          border-radius: 20px;
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
        }

        .status-badge::before {
          content: '';
          width: 5px; height: 5px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .status-in       { background: #dcfce7; color: #15803d; }
        .status-in::before { background: #16a34a; }
        .status-break    { background: #fef3c7; color: #92400e; }
        .status-break::before { background: #d97706; animation: pulse-dot 1.5s infinite; }
        .status-returned { background: #dbeafe; color: #1d4ed8; }
        .status-returned::before { background: #2563eb; }
        .status-out      { background: var(--surface-alt); color: var(--text-muted); border: 1px solid var(--border); }
        .status-out::before { background: var(--border-strong); }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.4); }
        }

        /* ── BREAKS ── */
        .breaks-list { display: flex; flex-direction: column; gap: 3px; }

        .break-pill {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: 4px;
          padding: 2px 6px;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: #92400e;
          white-space: nowrap;
        }

        .break-num   { font-weight: 700; opacity: 0.6; margin-right: 2px; }
        .break-arrow { opacity: 0.35; }
        .break-dur   { margin-left: 3px; background: #fde68a; border-radius: 3px; padding: 0 4px; font-size: 9px; font-weight: 700; }

        .live-dot { color: #f59e0b; animation: blink 1s infinite; font-size: 8px; }

        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.15; } }

        /* ── DELETE BTN ── */
        .del-btn {
          background: transparent;
          border: 1.5px solid transparent;
          color: var(--text-light);
          padding: 4px 9px;
          border-radius: var(--radius-sm);
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          cursor: pointer;
          transition: all 0.15s;
          text-transform: uppercase;
          font-weight: 500;
        }
        .del-btn:hover { background: #fee2e2; border-color: #fca5a5; color: #b91c1c; }
        .del-btn:disabled { opacity: 0.3; cursor: wait; }

        /* ── MOBILE CARDS ── */
        .mobile-cards { display: flex; flex-direction: column; }

        .mobile-card { border-bottom: 1px solid var(--surface-alt); }
        .mobile-card:last-child { border-bottom: none; }

        .mobile-card-main {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 13px 16px;
          cursor: pointer;
          gap: 10px;
          transition: background 0.1s;
        }
        .mobile-card:hover .mobile-card-main { background: #faf9f6; }

        .mobile-card-left { flex: 1; min-width: 0; }

        .mobile-name {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-weight: 700;
          font-size: 14px;
          color: var(--text);
          letter-spacing: -0.3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mobile-meta {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-top: 3px;
          flex-wrap: wrap;
        }

        .mobile-date {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: var(--text-light);
        }

        .mobile-card-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

        .mobile-worked {
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          font-weight: 600;
          color: #16a34a;
        }

        .expand-icon {
          color: var(--text-light);
          font-size: 14px;
          transition: transform 0.2s;
          line-height: 1;
          font-style: normal;
        }
        .expand-icon.open { transform: rotate(180deg); }

        .mobile-card-detail {
          padding: 12px 16px 14px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          background: var(--surface-alt);
          border-top: 1px solid var(--border);
        }

        .detail-item { display: flex; flex-direction: column; gap: 2px; }

        .detail-lbl {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--text-light);
        }

        .detail-val {
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          color: var(--text);
          font-weight: 500;
        }

        .detail-actions {
          grid-column: 1 / -1;
          display: flex;
          justify-content: flex-end;
          padding-top: 8px;
          border-top: 1px solid var(--border);
          margin-top: 2px;
        }

        /* ── RESPONSIVE VISIBILITY ── */
        .desktop-only { display: none; }
        .mobile-only  { display: block; }

        @media (min-width: 768px) {
          .desktop-only { display: block; }
          .mobile-only  { display: none; }
        }

        /* ── PAGINATION ── */
        .pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 13px 18px;
          border-top: 1.5px solid var(--border);
          flex-wrap: wrap;
          gap: 8px;
        }

        .pag-info {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: var(--text-light);
        }

        .pag-controls { display: flex; align-items: center; gap: 6px; }

        .pag-btn {
          background: var(--surface);
          border: 1.5px solid var(--border);
          color: var(--text);
          padding: 6px 13px;
          border-radius: var(--radius-sm);
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          cursor: pointer;
          transition: all 0.15s;
          font-weight: 500;
        }
        .pag-btn:hover:not(:disabled) { border-color: var(--border-strong); background: var(--surface-alt); }
        .pag-btn:disabled { opacity: 0.3; cursor: default; }

        .pag-page {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: var(--text-muted);
          padding: 0 6px;
          white-space: nowrap;
        }

        /* ── EMPTY / LOADING ── */
        .empty-state { padding: 60px 24px; text-align: center; }
        .empty-icon  { font-size: 36px; opacity: 0.25; margin-bottom: 10px; }
        .empty-text  { font-family: 'DM Mono', monospace; font-size: 12px; color: var(--text-light); letter-spacing: 1px; }

        .loading-state { padding: 48px 24px; text-align: center; }

        .loading-dots { display: inline-flex; gap: 5px; align-items: center; }

        .loading-dots span {
          width: 6px; height: 6px;
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

        .loading-label {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: var(--text-light);
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-top: 10px;
        }
      `}</style>

      <div className="dh-wrap">

        {/* Header */}
        <div className="dh-header">
          <div>
            <h1 className="dh-title">Time Records</h1>
            <p className="dh-subtitle">Employee Attendance Overview</p>
          </div>
          <div className="dh-header-actions">
            <button
              className="btn-export btn-export-excel"
              onClick={handleExportExcel}
              disabled={exporting !== null || records.length === 0}
              title="Export current page to Excel"
            >
              {exporting === "excel"
                ? <><span className="export-spinner" /> Exporting…</>
                : <>↓ Excel</>}
            </button>
            <button
              className="btn-export btn-export-pdf"
              onClick={handleExportPDF}
              disabled={exporting !== null || records.length === 0}
              title="Export current page to PDF"
            >
              {exporting === "pdf"
                ? <><span className="export-spinner" /> Exporting…</>
                : <>↓ PDF</>}
            </button>
            <a href="/" className="btn-timeclock">⏱ Time Clock</a>
          </div>
        </div>

        {/* Stats */}
        <div className="dh-stats">
          <div className="stat-card c-default">
            <div className="stat-label">Total Records</div>
            <div className="stat-value">{total}</div>
          </div>
          <div className="stat-card c-green">
            <div className="stat-label">Today&apos;s Entries</div>
            <div className="stat-value">{todayRecords.length}</div>
          </div>
          <div className="stat-card c-amber">
            <div className="stat-label">Active Now</div>
            <div className="stat-value">{activeNow}</div>
          </div>
          <div className="stat-card c-blue">
            <div className="stat-label">Today&apos;s Hours</div>
            <div className="stat-value">{fmtMins(totalHoursToday)}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="filter-section">
          <div className="filter-header" onClick={() => setFiltersOpen(!filtersOpen)}>
            <div className="filter-header-left">
              <span>Filters</span>
              {hasActiveFilters && <span className="filter-active-badge">Active</span>}
            </div>
            <em className={`filter-chevron${filtersOpen ? " open" : ""}`}>⌄</em>
          </div>

          {filtersOpen && (
            <div className="filter-body">
              <div className="filter-group">
                <div className="filter-label">Employee Name</div>
                <input
                  className="filter-input"
                  placeholder="Search name..."
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchRecords()}
                />
              </div>
              <div className="filter-group">
                <div className="filter-label">From Date</div>
                <input className="filter-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="filter-group">
                <div className="filter-label">To Date</div>
                <input className="filter-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <div className="filter-actions">
                <button className="btn-apply" onClick={() => { setPage(1); fetchRecords(); }}>Apply</button>
                <button className="btn-reset" onClick={() => { setNameFilter(""); setDateFrom(""); setDateTo(""); setPage(1); }}>Reset</button>
              </div>
            </div>
          )}
        </div>

        {/* Table Card */}
        <div className="table-card">
          <div className="table-card-header">
            <span className="table-card-title">All Records</span>
            <div className="table-card-right">
              {!loading && records.length > 0 && (
                <>
                  <button
                    className="btn-export-sm btn-export-sm-excel"
                    onClick={handleExportExcel}
                    disabled={exporting !== null}
                    title="Export to Excel"
                  >
                    {exporting === "excel" ? <span className="export-spinner" /> : "⬇"} .xlsx
                  </button>
                  <button
                    className="btn-export-sm btn-export-sm-pdf"
                    onClick={handleExportPDF}
                    disabled={exporting !== null}
                    title="Export to PDF"
                  >
                    {exporting === "pdf" ? <span className="export-spinner" /> : "⬇"} .pdf
                  </button>
                </>
              )}
              {!loading && <span className="record-count">{records.length} of {total}</span>}
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="loading-dots"><span /><span /><span /></div>
              <div className="loading-label">Loading records</div>
            </div>
          ) : records.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <div className="empty-text">No records found</div>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="desktop-only">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Email</th>
                        <th>Date</th>
                        <th>Check In</th>
                        <th>Check Out</th>
                        <th>Breaks</th>
                        <th>Break Total</th>
                        <th>Worked</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => (
                        <tr key={r._id}>
                          <td className="name-cell">{r.employeeName}</td>
                          <td className="email-cell">{r.email}</td>
                          <td className="date-cell">{r.date}</td>
                          <td className="time-cell">{fmt(r.checkIn)}</td>
                          <td className="time-cell">{fmt(r.checkOut)}</td>
                          <td>
                            {r.breaks?.length > 0 ? (
                              <div className="breaks-list">
                                {r.breaks.map((b, i) => (
                                  <div key={b._id || i} className="break-pill">
                                    <span className="break-num">#{i + 1}</span>
                                    <span>{fmt(b.breakIn)}</span>
                                    <span className="break-arrow">→</span>
                                    <span>{b.breakOut ? fmt(b.breakOut) : <span className="live-dot">●</span>}</span>
                                    {b.duration > 0 && <span className="break-dur">{fmtMins(b.duration)}</span>}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="time-cell">—</span>
                            )}
                          </td>
                          <td className="break-cell">{fmtMins(r.totalBreak)}</td>
                          <td className="worked-cell">{fmtMins(r.totalWorked)}</td>
                          <td>
                            <span className={`status-badge ${STATUS_STYLE[r.status] || ""}`}>
                              {STATUS_LABEL[r.status] || r.status}
                            </span>
                          </td>
                          <td>
                            <button className="del-btn" disabled={deleting === r._id} onClick={() => handleDelete(r._id)}>
                              {deleting === r._id ? "…" : "Delete"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="mobile-only">
                <div className="mobile-cards">
                  {records.map((r) => {
                    const isOpen = expandedRow === r._id;
                    return (
                      <div key={r._id} className="mobile-card">
                        <div className="mobile-card-main" onClick={() => setExpandedRow(isOpen ? null : r._id)}>
                          <div className="mobile-card-left">
                            <div className="mobile-name">{r.employeeName}</div>
                            <div className="mobile-meta">
                              <span className="mobile-date">{r.date}</span>
                              <span className={`status-badge ${STATUS_STYLE[r.status] || ""}`}>{STATUS_LABEL[r.status] || r.status}</span>
                            </div>
                          </div>
                          <div className="mobile-card-right">
                            {r.totalWorked ? <span className="mobile-worked">{fmtMins(r.totalWorked)}</span> : null}
                            <em className={`expand-icon${isOpen ? " open" : ""}`}>⌄</em>
                          </div>
                        </div>

                        {isOpen && (
                          <div className="mobile-card-detail">
                            <div className="detail-item">
                              <span className="detail-lbl">Check In</span>
                              <span className="detail-val">{fmt(r.checkIn)}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-lbl">Check Out</span>
                              <span className="detail-val">{fmt(r.checkOut)}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-lbl">Break Total</span>
                              <span className="detail-val" style={{ color: "#d97706" }}>{fmtMins(r.totalBreak)}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-lbl">Worked</span>
                              <span className="detail-val" style={{ color: "#16a34a" }}>{fmtMins(r.totalWorked)}</span>
                            </div>
                            <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
                              <span className="detail-lbl">Email</span>
                              <span className="detail-val" style={{ fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis" }}>{r.email}</span>
                            </div>
                            {r.breaks?.length > 0 && (
                              <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
                                <span className="detail-lbl">Break Sessions</span>
                                <div className="breaks-list" style={{ marginTop: "4px" }}>
                                  {r.breaks.map((b, i) => (
                                    <div key={b._id || i} className="break-pill">
                                      <span className="break-num">#{i + 1}</span>
                                      <span>{fmt(b.breakIn)}</span>
                                      <span className="break-arrow">→</span>
                                      <span>{b.breakOut ? fmt(b.breakOut) : <span className="live-dot">●</span>}</span>
                                      {b.duration > 0 && <span className="break-dur">{fmtMins(b.duration)}</span>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="detail-actions">
                              <button className="del-btn" disabled={deleting === r._id} onClick={() => handleDelete(r._id)}>
                                {deleting === r._id ? "Deleting…" : "Delete Record"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pagination */}
              <div className="pagination">
                <span className="pag-info">{records.length} of {total} records</span>
                <div className="pag-controls">
                  <button className="pag-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                  <span className="pag-page">{page} / {totalPages}</span>
                  <button className="pag-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </>
  );
}