"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import "./Employees.css";

interface Employee {
  _id: string;
  ownerEmail: string;
  employeeName: string;
  email: string;
  role: "OM" | "TL" | "Agent" | "Other";
  campaign: string;
  status: "active" | "on-leave" | "absent" | "inactive";
  birthdate: string;
  profilePic: string;
  notes: string;
  createdAt: string;
}

type User = { email: string; name: string; _id?: string; photoUrl?: string };

const ROLE_LABELS: Record<string, string> = { OM: "OM", TL: "TL", Agent: "Agent", Other: "Other" };
const STATUS_LABELS: Record<string, string> = {
  active: "Active", "on-leave": "On Leave", absent: "Absent", inactive: "Inactive",
};

function avatarUrl(name: string, pic?: string) {
  if (pic) return pic;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e4e2dd&color=7c7970&size=96`;
}

function calcAge(birthdate: string): string {
  if (!birthdate) return "—";
  const bd = new Date(birthdate);
  const now = new Date();
  let age = now.getFullYear() - bd.getFullYear();
  if (now.getMonth() - bd.getMonth() < 0 || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) age--;
  return `${age} yrs`;
}

function isBirthdayToday(birthdate: string): boolean {
  if (!birthdate) return false;
  const bd = new Date(birthdate);
  const now = new Date();
  return bd.getMonth() === now.getMonth() && bd.getDate() === now.getDate();
}

function formatBirthdate(birthdate: string): string {
  if (!birthdate) return "—";
  return new Date(birthdate + "T00:00:00").toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

const BLANK: Omit<Employee, "_id" | "ownerEmail" | "createdAt" | "profilePic"> = {
  employeeName: "", email: "", role: "Agent", campaign: "",
  status: "active", birthdate: "", notes: "",
};

const PAGE_SIZE = 20;

export default function Employees({ user: _user }: { user: User }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  // ── Modals ──────────────────────────────────────────────────────
  const [addEditOpen, setAddEditOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [viewTarget, setViewTarget] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const modalFileRef = useRef<HTMLInputElement>(null);

  // ── Fetch ──────────────────────────────────────────────────────
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/employees", { credentials: "include" });
      const data = await res.json();
      setEmployees(data.employees || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, roleFilter, statusFilter]);

  // ── Modal helpers ──────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setForm({ ...BLANK });
    setFormError("");
    setAddEditOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setForm({
      employeeName: emp.employeeName,
      email: emp.email,
      role: emp.role,
      campaign: emp.campaign,
      status: emp.status,
      birthdate: emp.birthdate,
      notes: emp.notes,
    });
    setFormError("");
    setViewTarget(null);
    setAddEditOpen(true);
  };

  const closeAddEdit = () => { setAddEditOpen(false); setEditing(null); setFormError(""); };

  // ── Save ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.employeeName.trim()) { setFormError("Full name is required."); return; }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setFormError("A valid email address is required."); return;
    }
    setSaving(true);
    setFormError("");
    try {
      const method = editing ? "PUT" : "POST";
      const body = editing ? { id: editing._id, ...form } : form;
      const res = await fetch("/api/employees", {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || "Save failed."); return; }
      closeAddEdit();
      fetchEmployees();
    } catch { setFormError("Network error. Please try again."); }
    finally { setSaving(false); }
  };

  // ── Delete ──────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const emp = deleteTarget;
    setDeleteTarget(null);
    setDeleting(emp._id);
    try {
      await fetch("/api/employees", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: emp._id }),
      });
      fetchEmployees();
    } catch { /* silent */ }
    finally { setDeleting(null); }
  };

  // ── Photo upload ────────────────────────────────────────────────
  const handlePhotoUpload = async (emp: Employee, file: File) => {
    setUploadingFor(emp._id);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("employeeId", emp._id);
      const res = await fetch("/api/employees/photo", { method: "POST", body: fd, credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setEmployees(prev => prev.map(e => e._id === emp._id ? { ...e, profilePic: data.profilePic } : e));
        if (editing?._id === emp._id) setEditing(prev => prev ? { ...prev, profilePic: data.profilePic } : prev);
        if (viewTarget?._id === emp._id) setViewTarget(prev => prev ? { ...prev, profilePic: data.profilePic } : prev);
      }
    } catch { /* silent */ }
    finally { setUploadingFor(null); }
  };

  // ── Derived ─────────────────────────────────────────────────────
  const filtered = employees.filter(emp => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      emp.employeeName.toLowerCase().includes(q) ||
      emp.email.toLowerCase().includes(q) ||
      emp.campaign.toLowerCase().includes(q);
    const matchRole = roleFilter === "all" || emp.role === roleFilter;
    const matchStatus = statusFilter === "all" || emp.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalActive = employees.filter(e => e.status === "active").length;
  const totalOnLeave = employees.filter(e => e.status === "on-leave" || e.status === "absent").length;
  const totalOM = employees.filter(e => e.role === "OM").length;
  const totalTL = employees.filter(e => e.role === "TL").length;
  const birthdays = employees.filter(e => isBirthdayToday(e.birthdate));

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="emp-wrap">

      {/* ── VIEW MODAL ── */}
      {viewTarget && (
        <div className="emp-modal-overlay" onClick={() => setViewTarget(null)}>
          <div className="emp-modal emp-view-modal" onClick={e => e.stopPropagation()}>
            <div className="emp-modal-header">
              <span className="emp-modal-title">Employee Profile</span>
              <button className="emp-modal-close" onClick={() => setViewTarget(null)}>✕</button>
            </div>
            <div className="emp-view-body">
              {/* Avatar + identity */}
              <div className="emp-view-top">
                <div className="emp-view-avatar-wrap">
                  <img
                    src={avatarUrl(viewTarget.employeeName, viewTarget.profilePic)}
                    alt={viewTarget.employeeName}
                    className="emp-view-avatar"
                  />
                  {isBirthdayToday(viewTarget.birthdate) && (
                    <span className="emp-view-bday-tag">🎂 Birthday!</span>
                  )}
                  <label className="emp-view-photo-btn" title="Change photo">
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      disabled={uploadingFor === viewTarget._id}
                      onChange={e => e.target.files?.[0] && handlePhotoUpload(viewTarget, e.target.files[0])}
                    />
                    {uploadingFor === viewTarget._id ? "⏳" : "📷"}
                  </label>
                </div>
                <div className="emp-view-identity">
                  <div className="emp-view-name">{viewTarget.employeeName}</div>
                  <div className="emp-view-email">{viewTarget.email}</div>
                  <div className="emp-view-badges">
                    <span className={`emp-role-badge emp-role-${viewTarget.role}`}>{ROLE_LABELS[viewTarget.role]}</span>
                    <span className={`emp-status-badge emp-status-${viewTarget.status}`}>{STATUS_LABELS[viewTarget.status]}</span>
                  </div>
                </div>
              </div>
              {/* Details grid */}
              <div className="emp-view-grid">
                <div className="emp-view-item">
                  <span className="emp-view-lbl">Campaign</span>
                  <span className="emp-view-val">{viewTarget.campaign || "—"}</span>
                </div>
                <div className="emp-view-item">
                  <span className="emp-view-lbl">Age</span>
                  <span className="emp-view-val">{calcAge(viewTarget.birthdate)}</span>
                </div>
                <div className="emp-view-item emp-view-full">
                  <span className="emp-view-lbl">Birthdate</span>
                  <span className="emp-view-val">{formatBirthdate(viewTarget.birthdate)}</span>
                </div>
                <div className="emp-view-item emp-view-full">
                  <span className="emp-view-lbl">Member Since</span>
                  <span className="emp-view-val">
                    {new Date(viewTarget.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </span>
                </div>
                {viewTarget.notes && (
                  <div className="emp-view-item emp-view-full">
                    <span className="emp-view-lbl">Notes</span>
                    <span className="emp-view-val" style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{viewTarget.notes}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="emp-modal-footer">
              <button className="btn-emp-cancel" onClick={() => setViewTarget(null)}>Close</button>
              <button className="btn-emp-save" onClick={() => openEdit(viewTarget)}>✏ Edit Employee</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE MODAL ── */}
      {deleteTarget && (
        <div className="del-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="del-modal" onClick={e => e.stopPropagation()}>
            <div className="del-modal-icon">🗑️</div>
            <div className="del-modal-title">Remove Employee?</div>
            <div className="del-modal-body">
              This removes the employee from your roster. Their time records are <strong>not</strong> deleted.
            </div>
            <div className="del-modal-name">
              <span>👤</span>
              <span>{deleteTarget.employeeName}</span>
              <span style={{ marginLeft: "auto", fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--text-light)", fontWeight: 400 }}>
                {deleteTarget.email}
              </span>
            </div>
            <div className="del-modal-actions">
              <button className="del-modal-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="del-modal-confirm" disabled={!!deleting} onClick={confirmDelete}>
                {deleting ? "Removing…" : "🗑 Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD / EDIT MODAL ── */}
      {addEditOpen && (
        <div className="emp-modal-overlay" onClick={closeAddEdit}>
          <div className="emp-modal" onClick={e => e.stopPropagation()}>
            <div className="emp-modal-header">
              <span className="emp-modal-title">{editing ? "Edit Employee" : "Add Employee"}</span>
              <button className="emp-modal-close" onClick={closeAddEdit}>✕</button>
            </div>
            <div className="emp-modal-avatar-section">
              <img
                src={avatarUrl(form.employeeName || "EMP", editing?.profilePic)}
                alt="Profile"
                className="emp-modal-avatar"
              />
              <div className="emp-modal-avatar-hint">
                {editing
                  ? uploadingFor === editing._id ? "⏳ Uploading…" : "Click below to change profile photo"
                  : "Save first to upload a profile photo"}
              </div>
              {editing && (
                <label className="btn-change-photo" style={{ cursor: "pointer" }}>
                  <input
                    ref={modalFileRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    disabled={uploadingFor === editing._id}
                    onChange={e => e.target.files?.[0] && handlePhotoUpload(editing, e.target.files[0])}
                  />
                  {uploadingFor === editing._id ? "⏳ Uploading…" : "📷 Change Photo"}
                </label>
              )}
            </div>
            <div className="emp-modal-body">
              {formError && <div className="emp-error-msg">⚠ {formError}</div>}
              <div className="emp-field full">
                <div className="emp-field-label">Full Name *</div>
                <input
                  className="emp-field-input"
                  placeholder="Juan dela Cruz"
                  value={form.employeeName}
                  onChange={e => setForm(f => ({ ...f, employeeName: e.target.value }))}
                />
              </div>
              <div className="emp-field full">
                <div className="emp-field-label">
                  Email *
                  {editing && <span className="emp-modal-verified-tag">✓ Locked after creation</span>}
                </div>
                <input
                  className="emp-field-input"
                  type="email"
                  placeholder="juan@company.com"
                  value={form.email}
                  disabled={!!editing}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="emp-field-row">
                <div className="emp-field">
                  <div className="emp-field-label">Role</div>
                  <select className="emp-field-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Employee["role"] }))}>
                    <option value="OM">OM — Operations Manager</option>
                    <option value="TL">TL — Team Lead</option>
                    <option value="Agent">Agent</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="emp-field">
                  <div className="emp-field-label">Campaign</div>
                  <input className="emp-field-input" placeholder="e.g. Nationgraph" value={form.campaign} onChange={e => setForm(f => ({ ...f, campaign: e.target.value }))} />
                </div>
              </div>
              <div className="emp-field-row">
                <div className="emp-field">
                  <div className="emp-field-label">Status</div>
                  <select className="emp-field-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Employee["status"] }))}>
                    <option value="active">Active</option>
                    <option value="on-leave">On Leave</option>
                    <option value="absent">Absent</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="emp-field">
                  <div className="emp-field-label">Birthdate</div>
                  <input className="emp-field-input" type="date" value={form.birthdate} onChange={e => setForm(f => ({ ...f, birthdate: e.target.value }))} />
                </div>
              </div>
              <div className="emp-field full">
                <div className="emp-field-label">Notes</div>
                <textarea className="emp-field-textarea" placeholder="Optional — e.g. skills, schedule notes…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="emp-modal-footer">
              <button className="btn-emp-cancel" onClick={closeAddEdit}>Cancel</button>
              <button className="btn-emp-save" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : editing ? "Save Changes" : "➕ Add Employee"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAGE HEADER ── */}
      <div className="emp-header">
        <div>
          <h1 className="emp-title">Employees</h1>
          <p className="emp-subtitle">Team Roster & Management</p>
        </div>
        <button className="btn-add-employee" onClick={openAdd}>+ Add Employee</button>
      </div>

      {/* ── STATS ── */}
      <div className="emp-stats">
        <div className="stat-card c-green">
          <div className="stat-label">Active</div>
          <div className="stat-value">{totalActive}</div>
        </div>
        <div className="stat-card c-default">
          <div className="stat-label">Total</div>
          <div className="stat-value">{employees.length}</div>
        </div>
        <div className="stat-card c-blue">
          <div className="stat-label">OM / TL</div>
          <div className="stat-value">{totalOM}/{totalTL}</div>
        </div>
        <div className="stat-card c-amber">
          <div className="stat-label">Leave / Absent</div>
          <div className="stat-value">{totalOnLeave}</div>
        </div>
      </div>

      {/* ── BIRTHDAY BANNER ── */}
      {birthdays.length > 0 && (
        <div className="emp-birthday-banner">
          🎂&nbsp;
          <span>Happy Birthday to&nbsp;<strong>{birthdays.map(e => e.employeeName).join(", ")}</strong>! 🎉</span>
        </div>
      )}

      {/* ── SEARCH & FILTERS ── */}
      <div className="emp-filter-bar">
        <input
          className="emp-search"
          placeholder="🔍  Search name, email, campaign…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="emp-filter-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="all">All Roles</option>
          <option value="OM">OM</option>
          <option value="TL">TL</option>
          <option value="Agent">Agent</option>
          <option value="Other">Other</option>
        </select>
        <select className="emp-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="on-leave">On Leave</option>
          <option value="absent">Absent</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* ── TABLE ── */}
      {loading ? (
        <div className="emp-loading">
          <div className="loading-dots"><span /><span /><span /></div>
          <div className="loading-label" style={{ marginTop: 10 }}>Loading employees</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="emp-empty">
          <div className="emp-empty-icon">👥</div>
          <div className="emp-empty-title">{employees.length === 0 ? "No employees yet" : "No results found"}</div>
          <div className="emp-empty-sub">
            {employees.length === 0 ? "Add your first team member to get started" : "Try adjusting your search or filters"}
          </div>
          {employees.length === 0 && <button className="btn-add-employee" onClick={openAdd}>+ Add First Employee</button>}
        </div>
      ) : (
        <div className="emp-table-card">
          <div className="emp-table-header-row">
            <span className="emp-table-count">{filtered.length} employee{filtered.length !== 1 ? "s" : ""}</span>
            <span className="emp-table-page-info">Page {page} of {totalPages}</span>
          </div>

          <div className="emp-table-scroll">
            <table className="emp-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Birthdate</th>
                  <th>Age</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((emp, i) => (
                  <tr
                    key={emp._id}
                    className="emp-table-row"
                    style={{ animationDelay: `${i * 0.03}s` }}
                  >
                    {/* Employee */}
                    <td>
                      <div className="emp-table-identity">
                        <div className="emp-table-avatar-wrap">
                          <img
                            src={avatarUrl(emp.employeeName, emp.profilePic)}
                            alt={emp.employeeName}
                            className="emp-table-avatar"
                          />
                          <div className={`emp-table-role-dot role-dot-${emp.role}`} />
                        </div>
                        <div>
                          <div className="emp-table-name">
                            {emp.employeeName}
                            {isBirthdayToday(emp.birthdate) && " 🎂"}
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Email */}
                    <td className="emp-table-email">{emp.email}</td>
                    {/* Role */}
                    <td>
                      <span className={`emp-role-badge emp-role-${emp.role}`}>{ROLE_LABELS[emp.role]}</span>
                    </td>
                    {/* Campaign */}
                    <td className="emp-table-campaign">{emp.campaign || <span style={{ color: "var(--text-light)" }}>—</span>}</td>
                    {/* Status */}
                    <td>
                      <span className={`emp-status-badge emp-status-${emp.status}`}>{STATUS_LABELS[emp.status]}</span>
                    </td>
                    {/* Birthdate */}
                    <td className="emp-table-bd">{formatBirthdate(emp.birthdate)}</td>
                    {/* Age */}
                    <td className="emp-table-age">{calcAge(emp.birthdate)}</td>
                    {/* Actions */}
                    <td>
                      <div className="emp-table-actions">
                        <button className="emp-tbl-btn emp-tbl-view" onClick={() => setViewTarget(emp)} title="View">
                          👁 View
                        </button>
                        <button className="emp-tbl-btn emp-tbl-edit" onClick={() => openEdit(emp)} title="Edit">
                          ✏ Edit
                        </button>
                        <button
                          className="emp-tbl-btn emp-tbl-del"
                          disabled={deleting === emp._id}
                          onClick={() => setDeleteTarget(emp)}
                          title="Remove"
                        >
                          {deleting === emp._id ? "…" : "🗑"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── PAGINATION ── */}
          <div className="emp-pagination">
            <span className="emp-pag-info">
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="emp-pag-controls">
              <button className="emp-pag-btn" disabled={page <= 1} onClick={() => setPage(1)} title="First">«</button>
              <button className="emp-pag-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span className="emp-pag-current">{page} / {totalPages}</span>
              <button className="emp-pag-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
              <button className="emp-pag-btn" disabled={page >= totalPages} onClick={() => setPage(totalPages)} title="Last">»</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}