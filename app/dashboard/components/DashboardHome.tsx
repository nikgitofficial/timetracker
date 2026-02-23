"use client";

import { useState,useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import "./DashboardHome.css";

interface BreakSession {
  _id: string;
  breakIn: string;
  breakOut: string | null;
  duration: number;
}

// ── ADDED: selfie interface ──
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
  breakIn: string | null;
  breakOut: string | null;
  checkOut: string | null;
  breaks: BreakSession[];
  bioBreaks: BreakSession[];
  totalWorked: number;
  totalBreak: number;
  totalBioBreak: number;
  status: "checked-in" | "on-break" | "on-bio-break" | "returned" | "checked-out";
  createdAt: string;
  selfies?: SelfieEntry[]; // ── ADDED
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
  "on-bio-break": "status-bio",
  returned: "status-returned",
  "checked-out": "status-out",
};

const STATUS_LABEL: Record<string, string> = {
  "checked-in": "Working",
  "on-break": "On Break",
  "on-bio-break": "Bio Break",
  returned: "Working",
  "checked-out": "Done",
};

// ── ADDED: action labels + colors for selfie badges ──
const ACTION_LABEL: Record<string, string> = {
  "check-in":      "Check-In",
  "break-in":      "Break",
  "break-out":     "Return",
  "bio-break-in":  "Bio Break",
  "bio-break-out": "End Bio",
  "check-out":     "Check-Out",
};

const ACTION_COLOR: Record<string, string> = {
  "check-in":      "#16a34a",
  "break-in":      "#d97706",
  "break-out":     "#2563eb",
  "bio-break-in":  "#0d9488",
  "bio-break-out": "#7c3aed",
  "check-out":     "#dc2626",
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
    "Bio Break Sessions": r.bioBreaks?.length
      ? r.bioBreaks
          .map((b, i) => `#${i + 1}: ${fmt(b.breakIn)} → ${b.breakOut ? fmt(b.breakOut) : "active"}${b.duration ? ` (${fmtMins(b.duration)})` : ""}`)
          .join(" | ")
      : "—",
    "Total Bio Break": fmtMins(r.totalBioBreak),
    "Total Worked": fmtMins(r.totalWorked),
    "Status": STATUS_LABEL[r.status] || r.status,
  }));
}

async function exportToExcel(records: TimeEntry[], filename = "time-records") {
  const XLSX = await import("xlsx");
  const rows = buildExportRows(records);
  const ws = XLSX.utils.json_to_sheet(rows);

  ws["!cols"] = [
    { wch: 22 }, { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
    { wch: 52 }, { wch: 12 }, { wch: 52 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Time Records");
  XLSX.writeFile(wb, `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

async function exportToPDF(records: TimeEntry[], filename = "time-records") {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

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
    alternateRowStyles: { fillColor: [250, 249, 246] },
    columnStyles: {
      0: { fontStyle: "bold", textColor: [26, 25, 22] },
      6: { textColor: [217, 119, 6] },
      8: { textColor: [15, 118, 110] },
      9: { textColor: [22, 163, 74], fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });

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
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  // ── DELETE MODAL STATE (only addition) ──
  const [deleteModal, setDeleteModal] = useState<{ id: string; name: string; date: string } | null>(null);

  // ── ADDED: lightbox state ──
  const [lightbox, setLightbox] = useState<{ selfies: SelfieEntry[]; index: number; employeeName: string } | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
  const el = tableScrollRef.current;
  if (!el) return;
  e.preventDefault(); // ← ADD THIS LINE
  isDragging.current = true;
  dragStart.current = {
    x: e.clientX,
    y: e.clientY,
    scrollLeft: el.scrollLeft,
    scrollTop: el.scrollTop,
  };
  el.style.cursor = "grabbing";
  el.style.userSelect = "none";
};
  

const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
  if (!isDragging.current) return;
  e.preventDefault();
  const el = tableScrollRef.current;
  if (!el) return;
  const dx = e.clientX - dragStart.current.x;
  const dy = e.clientY - dragStart.current.y;
  el.scrollLeft = dragStart.current.scrollLeft - dx;
  el.scrollTop = dragStart.current.scrollTop - dy;
};

const handleMouseUp = () => {
  isDragging.current = false;
  const el = tableScrollRef.current;
  if (!el) return;
  el.style.cursor = "grab";
  el.style.removeProperty("user-select");
};

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setUser(d.user);
        else router.push("/login");
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const tableScrollRef = useRef<HTMLDivElement>(null);
const [scrollState, setScrollState] = useState({ canLeft: false, canRight: true, pct: 0 });

const handleTableScroll = () => {
  const el = tableScrollRef.current;
  if (!el) return;
  const { scrollLeft, scrollWidth, clientWidth } = el;
  const maxScroll = scrollWidth - clientWidth;
  setScrollState({
    canLeft: scrollLeft > 4,
    canRight: scrollLeft < maxScroll - 4,
    pct: maxScroll > 0 ? (scrollLeft / maxScroll) * 100 : 0,
  });
};

useEffect(() => {
  const el = tableScrollRef.current;
  if (!el) return;
  handleTableScroll(); // init
  el.addEventListener("scroll", handleTableScroll);
  return () => el.removeEventListener("scroll", handleTableScroll);
}, [records]);

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

  // ── UPDATED: opens modal instead of confirm() ──
  const handleDelete = (id: string, name: string, date: string) => {
    setDeleteModal({ id, name, date });
  };

  // ── NEW: called when user confirms inside modal ──
  const confirmDelete = async () => {
    if (!deleteModal) return;
    const { id } = deleteModal;
    setDeleteModal(null);
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

  // ── ADDED: lightbox helpers ──
  const openLightbox = (selfies: SelfieEntry[], index: number, employeeName: string) =>
    setLightbox({ selfies, index, employeeName });
  const closeLightbox = () => setLightbox(null);
  const lbPrev = () => lightbox && setLightbox({ ...lightbox, index: (lightbox.index - 1 + lightbox.selfies.length) % lightbox.selfies.length });
  const lbNext = () => lightbox && setLightbox({ ...lightbox, index: (lightbox.index + 1) % lightbox.selfies.length });

  // ── ADDED: keyboard nav for lightbox ──
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  lbPrev();
      if (e.key === "ArrowRight") lbNext();
      if (e.key === "Escape")     closeLightbox();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox]);

  return (
    <>
     

      <div className="dh-wrap">

        {/* ── ADDED: LIGHTBOX ── */}
        {lightbox && (
          <div className="lb-overlay" onClick={closeLightbox}>
            <div className="lb-container" onClick={(e) => e.stopPropagation()}>
              <button className="lb-close" onClick={closeLightbox}>✕</button>
              <div className="lb-img-wrap">
                <img src={lightbox.selfies[lightbox.index].url} alt="Selfie" className="lb-img" />
              </div>
              <div className="lb-footer">
                <button className="lb-nav" onClick={lbPrev} disabled={lightbox.selfies.length <= 1}>‹</button>
                <div className="lb-info">
                  <div className="lb-name">{lightbox.employeeName}</div>
                  <div className="lb-action-pill" style={{ color: ACTION_COLOR[lightbox.selfies[lightbox.index].action] || "#e2e8f0" }}>
                    {ACTION_LABEL[lightbox.selfies[lightbox.index].action] ?? lightbox.selfies[lightbox.index].action}
                  </div>
                  <div className="lb-time">
                    {new Date(lightbox.selfies[lightbox.index].takenAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
                    &nbsp;·&nbsp;{lightbox.index + 1} / {lightbox.selfies.length}
                  </div>
                </div>
                <button className="lb-nav" onClick={lbNext} disabled={lightbox.selfies.length <= 1}>›</button>
              </div>
              {lightbox.selfies.length > 1 && (
                <div className="lb-dots">
                  {lightbox.selfies.map((_, i) => (
                    <button key={i} className={`lb-dot${i === lightbox.index ? " active" : ""}`} onClick={() => setLightbox({ ...lightbox, index: i })} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── DELETE CONFIRMATION MODAL ── */}
        {deleteModal && (
          <div className="del-modal-overlay" onClick={() => setDeleteModal(null)}>
            <div className="del-modal" onClick={(e) => e.stopPropagation()}>
              <div className="del-modal-icon">🗑️</div>
              <div className="del-modal-title">Delete Record?</div>
              <div className="del-modal-body">
                This will permanently remove the time record from the database. This action cannot be undone.
              </div>
              <div className="del-modal-name">
                <span>👤</span>
                <span>{deleteModal.name}</span>
                <span style={{ marginLeft: "auto", fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text-light)", fontWeight: 400 }}>
                  {deleteModal.date}
                </span>
              </div>
              <div className="del-modal-actions">
                <button className="del-modal-cancel" onClick={() => setDeleteModal(null)}>
                  Cancel
                </button>
                <button className="del-modal-confirm" onClick={confirmDelete}>
                  🗑 Delete
                </button>
              </div>
            </div>
          </div>
        )}

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
            <a href="/dashboard/analytics" className="btn-analytics">📊 Analytics</a>
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
                  <button
  className="btn-refresh"
  onClick={() => fetchRecords()}
  disabled={loading}
  title="Refresh records"
>
  <span className={loading ? "refresh-spin" : ""}>↻</span> Refresh Records
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
  <div className="table-scroll-wrap">
    <div className={`scroll-arrow left${!scrollState.canLeft ? " hidden" : ""}`}>
      <span className="scroll-arrow-icon">‹</span>
    </div>
    <div className={`scroll-arrow right${!scrollState.canRight ? " hidden" : ""}`}>
      <span className="scroll-arrow-icon">›</span>
    </div>
    <div className="table-scroll-bar-wrap">
      <div className="table-scroll-bar-fill" style={{ width: `${scrollState.pct}%` }} />
    </div>
 <div 
 className="table-scroll" 
 ref={tableScrollRef}
  onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: "grab" }}
 >
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
                        <th>Bio Breaks</th>
                        <th>Bio Total</th>
                        <th>Worked</th>
                        <th>Status</th>
                        {/* ── ADDED: selfies column header ── */}
                        <th>📸 Selfies</th>
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
                          <td>
                            {r.bioBreaks?.length > 0 ? (
                              <div className="breaks-list">
                                {r.bioBreaks.map((b, i) => (
                                  <div key={b._id || i} className="bio-pill">
                                    <span className="break-num">#{i + 1}</span>
                                    <span>{fmt(b.breakIn)}</span>
                                    <span className="break-arrow">→</span>
                                    <span>{b.breakOut ? fmt(b.breakOut) : <span className="live-dot">●</span>}</span>
                                    {b.duration > 0 && <span className="bio-dur">{fmtMins(b.duration)}</span>}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="time-cell">—</span>
                            )}
                          </td>
                          <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#0d9488" }}>
                            {fmtMins(r.totalBioBreak)}
                          </td>
                          <td className="worked-cell">{fmtMins(r.totalWorked)}</td>
                          <td>
                            <span className={`status-badge ${STATUS_STYLE[r.status] || ""}`}>
                              {STATUS_LABEL[r.status] || r.status}
                            </span>
                          </td>
                          {/* ── ADDED: selfies cell ── */}
                          <td style={{ whiteSpace: "normal", minWidth: 120 }}>
                            {r.selfies && r.selfies.length > 0 ? (
                              <div className="selfie-thumbs">
                                {r.selfies.slice(0, 3).map((s, i) => (
                                  <div
                                    key={s._id || i}
                                    className="selfie-thumb-wrap"
                                    onClick={() => openLightbox(r.selfies!, i, r.employeeName)}
                                    title={`${ACTION_LABEL[s.action] ?? s.action} — click to view`}
                                  >
                                    <img src={s.url} alt={s.action} className="selfie-thumb" />
                                    <div className="selfie-thumb-badge" style={{ color: ACTION_COLOR[s.action] || "#a5b4fc" }}>
                                      {(ACTION_LABEL[s.action] ?? s.action).split("-")[0]}
                                    </div>
                                  </div>
                                ))}
                                {r.selfies.length > 3 && (
                                  <span className="selfie-count-badge" onClick={() => openLightbox(r.selfies!, 3, r.employeeName)}>
                                    +{r.selfies.length - 3}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="no-selfie">—</span>
                            )}
                          </td>
                          <td>
                            {/* ── UPDATED: passes name + date to modal ── */}
                            <button
                              className="del-btn"
                              disabled={deleting === r._id}
                              onClick={() => handleDelete(r._id, r.employeeName, r.date)}
                            >
                              {deleting === r._id ? "…" : "Delete"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
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
                              {/* ── ADDED: selfie count pill on mobile card header ── */}
                              {r.selfies && r.selfies.length > 0 && (
                                <span
                                  className="selfie-count-badge"
                                  onClick={(e) => { e.stopPropagation(); openLightbox(r.selfies!, 0, r.employeeName); }}
                                >
                                  📸 {r.selfies.length}
                                </span>
                              )}
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
                              <span className="detail-lbl">Bio Break</span>
                              <span className="detail-val" style={{ color: "#0d9488" }}>{fmtMins(r.totalBioBreak)}</span>
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
                            {r.bioBreaks?.length > 0 && (
                              <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
                                <span className="detail-lbl">Bio Break Sessions</span>
                                <div className="breaks-list" style={{ marginTop: "4px" }}>
                                  {r.bioBreaks.map((b, i) => (
                                    <div key={b._id || i} className="bio-pill">
                                      <span className="break-num">#{i + 1}</span>
                                      <span>{fmt(b.breakIn)}</span>
                                      <span className="break-arrow">→</span>
                                      <span>{b.breakOut ? fmt(b.breakOut) : <span className="live-dot">●</span>}</span>
                                      {b.duration > 0 && <span className="bio-dur">{fmtMins(b.duration)}</span>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {/* ── ADDED: selfies in mobile expanded detail ── */}
                            {r.selfies && r.selfies.length > 0 && (
                              <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
                                <span className="detail-lbl">📸 Selfies</span>
                                <div className="mobile-selfies-row">
                                  {r.selfies.map((s, i) => (
                                    <div
                                      key={s._id || i}
                                      className="mobile-selfie-wrap"
                                      onClick={() => openLightbox(r.selfies!, i, r.employeeName)}
                                    >
                                      <img src={s.url} alt={s.action} className="mobile-selfie-img" />
                                      <div className="mobile-selfie-badge" style={{ color: ACTION_COLOR[s.action] || "#a5b4fc" }}>
                                        {ACTION_LABEL[s.action] ?? s.action}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="detail-actions">
                              {/* ── UPDATED: mobile also uses modal ── */}
                              <button
                                className="del-btn"
                                disabled={deleting === r._id}
                                onClick={() => handleDelete(r._id, r.employeeName, r.date)}
                              >
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
  <span className="pag-info">
    Showing {((page - 1) * 25) + 1}–{Math.min(page * 25, total)} of {total} records
  </span>
  <div className="pag-controls">
    <button className="pag-btn" disabled={page <= 1} onClick={() => setPage(1)} title="First page">«</button>
    <button className="pag-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
    <span className="pag-page">{page} / {totalPages}</span>
    <button className="pag-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
    <button className="pag-btn" disabled={page >= totalPages} onClick={() => setPage(totalPages)} title="Last page">»</button>
  </div>
</div>
            </>
          )}
        </div>

      </div>
    </>
  );
}