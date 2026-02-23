"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import "./Employees.css";

// ── reuse del-modal + stat-card styles from DashboardHome.css ──

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

export default function Employees({ user: _user }: { user: User }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);

  const [uploadingFor, setUploadingFor] = useState<string | null>(null); // employee _id

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

  // ── Modal helpers ──────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setForm({ ...BLANK });
    setFormError("");
    setModalOpen(true);
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
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditing(null); setFormError(""); };

  // ── Save (add or update) ───────────────────────────────────────
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
      closeModal();
      fetchEmployees();
    } catch { setFormError("Network error. Please try again."); }
    finally { setSaving(false); }
  };

  // ── Delete ─────────────────────────────────────────────────────
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

  // ── Photo upload ───────────────────────────────────────────────
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
        // Update editing state if modal is open for this employee
        if (editing?._id === emp._id) setEditing(prev => prev ? { ...prev, profilePic: data.profilePic } : prev);
      }
    } catch { /* silent */ }
    finally { setUploadingFor(null); }
  };

  // ── Derived data ───────────────────────────────────────────────
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

  const totalActive = employees.filter(e => e.status === "active").length;
  const totalOnLeave = employees.filter(e => e.status === "on-leave" || e.status === "absent").length;
  const totalOM = employees.filter(e => e.role === "OM").length;
  const totalTL = employees.filter(e => e.role === "TL").length;
  const birthdays = employees.filter(e => isBirthdayToday(e.birthdate));

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="emp-wrap">

      {/* ── DELETE CONFIRM ── */}
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
              <button
                className="del-modal-confirm"
                disabled={!!deleting}
                onClick={confirmDelete}
              >
                {deleting ? "Removing…" : "🗑 Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD / EDIT MODAL ── */}
      {modalOpen && (
        <div className="emp-modal-overlay" onClick={closeModal}>
          <div className="emp-modal" onClick={e => e.stopPropagation()}>
            <div className="emp-modal-header">
              <span className="emp-modal-title">{editing ? "Edit Employee" : "Add Employee"}</span>
              <button className="emp-modal-close" onClick={closeModal}>✕</button>
            </div>

            {/* Avatar preview */}
            <div className="emp-modal-avatar-section">
              <img
                src={avatarUrl(form.employeeName || "EMP", editing?.profilePic)}
                alt="Profile"
                className="emp-modal-avatar"
              />
              <div className="emp-modal-avatar-hint">
                {editing
                  ? uploadingFor === editing._id
                    ? "⏳ Uploading…"
                    : "Click below to change profile photo"
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

              {/* Full Name */}
              <div className="emp-field full">
                <div className="emp-field-label">Full Name *</div>
                <input
                  className="emp-field-input"
                  placeholder="Juan dela Cruz"
                  value={form.employeeName}
                  onChange={e => setForm(f => ({ ...f, employeeName: e.target.value }))}
                />
              </div>

              {/* Email */}
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

              {/* Role + Campaign */}
              <div className="emp-field-row">
                <div className="emp-field">
                  <div className="emp-field-label">Role</div>
                  <select
                    className="emp-field-select"
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value as Employee["role"] }))}
                  >
                    <option value="OM">OM — Operations Manager</option>
                    <option value="TL">TL — Team Lead</option>
                    <option value="Agent">Agent</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="emp-field">
                  <div className="emp-field-label">Campaign</div>
                  <input
                    className="emp-field-input"
                    placeholder="e.g. Nationgraph"
                    value={form.campaign}
                    onChange={e => setForm(f => ({ ...f, campaign: e.target.value }))}
                  />
                </div>
              </div>

              {/* Status + Birthdate */}
              <div className="emp-field-row">
                <div className="emp-field">
                  <div className="emp-field-label">Status</div>
                  <select
                    className="emp-field-select"
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as Employee["status"] }))}
                  >
                    <option value="active">Active</option>
                    <option value="on-leave">On Leave</option>
                    <option value="absent">Absent</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="emp-field">
                  <div className="emp-field-label">Birthdate</div>
                  <input
                    className="emp-field-input"
                    type="date"
                    value={form.birthdate}
                    onChange={e => setForm(f => ({ ...f, birthdate: e.target.value }))}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="emp-field full">
                <div className="emp-field-label">Notes</div>
                <textarea
                  className="emp-field-textarea"
                  placeholder="Optional — e.g. skills, schedule notes…"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="emp-modal-footer">
              <button className="btn-emp-cancel" onClick={closeModal}>Cancel</button>
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
          <span>
            Happy Birthday to&nbsp;
            <strong>{birthdays.map(e => e.employeeName).join(", ")}</strong>! 🎉
          </span>
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

      {/* ── CONTENT ── */}
      {loading ? (
        <div className="emp-loading">
          <div className="loading-dots"><span /><span /><span /></div>
          <div className="loading-label" style={{ marginTop: 10 }}>Loading employees</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="emp-empty">
          <div className="emp-empty-icon">👥</div>
          <div className="emp-empty-title">
            {employees.length === 0 ? "No employees yet" : "No results found"}
          </div>
          <div className="emp-empty-sub">
            {employees.length === 0
              ? "Add your first team member to get started"
              : "Try adjusting your search or filters"}
          </div>
          {employees.length === 0 && (
            <button className="btn-add-employee" onClick={openAdd}>+ Add First Employee</button>
          )}
        </div>
      ) : (
        <div className="emp-grid">
          {filtered.map(emp => (
            <div key={emp._id} className={`emp-card role-${emp.role}`}>

              {/* ── CARD TOP ── */}
              <div className="emp-card-top">
                <div className="emp-avatar-wrap">
                  <img
                    src={avatarUrl(emp.employeeName, emp.profilePic)}
                    alt={emp.employeeName}
                    className="emp-avatar"
                  />
                  <label className="emp-avatar-upload-label" title="Upload photo">
                    📷
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingFor === emp._id}
                      onChange={e => e.target.files?.[0] && handlePhotoUpload(emp, e.target.files[0])}
                    />
                  </label>
                </div>

                <div className="emp-card-info">
                  <div className="emp-card-name">
                    {emp.employeeName}
                    {isBirthdayToday(emp.birthdate) && "  🎂"}
                  </div>
                  <div className="emp-card-email">{emp.email}</div>
                  <div className="emp-card-badges">
                    <span className={`emp-role-badge emp-role-${emp.role}`}>
                      {ROLE_LABELS[emp.role]}
                    </span>
                    <span className={`emp-status-badge emp-status-${emp.status}`}>
                      {STATUS_LABELS[emp.status]}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── CARD DETAILS ── */}
              <div className="emp-card-details">
                <div className="emp-detail-item">
                  <span className="emp-detail-lbl">Campaign</span>
                  <span className="emp-detail-val">{emp.campaign || "—"}</span>
                </div>
                <div className="emp-detail-item">
                  <span className="emp-detail-lbl">Age</span>
                  <span className="emp-detail-val">{calcAge(emp.birthdate)}</span>
                </div>
                <div className="emp-detail-item emp-detail-full">
                  <span className="emp-detail-lbl">Birthdate</span>
                  <span className="emp-detail-val">{formatBirthdate(emp.birthdate)}</span>
                </div>
                {emp.notes && (
                  <div className="emp-detail-item emp-detail-full">
                    <span className="emp-detail-lbl">Notes</span>
                    <span className="emp-detail-val-wrap">{emp.notes}</span>
                  </div>
                )}
                {uploadingFor === emp._id && (
                  <div className="emp-detail-item emp-detail-full" style={{ color: "var(--text-light)", fontFamily: "'DM Mono',monospace", fontSize: 10 }}>
                    ⏳ Uploading photo…
                  </div>
                )}
              </div>

              {/* ── CARD ACTIONS ── */}
              <div className="emp-card-actions">
                <button className="btn-emp-edit" onClick={() => openEdit(emp)}>✏ Edit</button>
                <button
                  className="btn-emp-del"
                  disabled={deleting === emp._id}
                  onClick={() => setDeleteTarget(emp)}
                >
                  {deleting === emp._id ? "…" : "🗑 Remove"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}