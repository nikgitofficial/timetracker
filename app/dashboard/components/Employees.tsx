"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import "./Employees.css";

/* ── TYPES ── */
interface Shift {
  label: string;
  startTime: string;   // "HH:MM" 24h
  endTime: string;     // "HH:MM" 24h
  graceMinutes: number;
  restDays: string[];
  effectiveFrom: string;
}

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
  shift?: Shift;
}

type User = { email: string; name: string; _id?: string; photoUrl?: string };

/* ── CONSTANTS ── */
const ROLE_LABELS: Record<string, string> = { OM: "OM", TL: "TL", Agent: "Agent", Other: "Other" };
const STATUS_LABELS: Record<string, string> = {
  active: "Active", "on-leave": "On Leave", absent: "Absent", inactive: "Inactive",
};
const ALL_DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_SHORT: Record<string, string> = {
  Sunday:"Sun", Monday:"Mon", Tuesday:"Tue", Wednesday:"Wed",
  Thursday:"Thu", Friday:"Fri", Saturday:"Sat",
};
const SHIFT_PRESETS = [
  { label:"Morning", startTime:"09:00", endTime:"18:00", graceMinutes:15, restDays:["Saturday","Sunday"] },
  { label:"Mid",     startTime:"12:00", endTime:"21:00", graceMinutes:15, restDays:["Saturday","Sunday"] },
  { label:"Night",   startTime:"21:00", endTime:"06:00", graceMinutes:15, restDays:["Saturday","Sunday"] },
  { label:"Early",   startTime:"06:00", endTime:"15:00", graceMinutes:15, restDays:["Saturday","Sunday"] },
];
const DEFAULT_SHIFT: Shift = {
  label:"Regular", startTime:"09:00", endTime:"18:00",
  graceMinutes:15, restDays:["Saturday","Sunday"], effectiveFrom:"",
};
const PAGE_SIZE = 20;

const BLANK: Omit<Employee,"_id"|"ownerEmail"|"createdAt"|"profilePic"> = {
  employeeName:"", email:"", role:"Agent", campaign:"",
  status:"active", birthdate:"", notes:"",
};

/* ── HELPERS ── */
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
    month:"long", day:"numeric", year:"numeric",
  });
}

function fmtTime12(time24: string): string {
  if (!time24) return "—";
  const [h, m] = time24.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2,"0")} ${ap}`;
}

function shiftSummary(shift?: Shift): string {
  if (!shift?.startTime) return "No schedule";
  return `${fmtTime12(shift.startTime)} – ${fmtTime12(shift.endTime)}`;
}

/* ── SHIFT FORM WIDGET (shared by single + bulk modals) ── */
function ShiftFormWidget({
  sf, setSf,
}: {
  sf: Shift;
  setSf: (s: Shift) => void;
}) {
  const toggleRestDay = (day: string) => {
    const next = sf.restDays.includes(day)
      ? sf.restDays.filter(d => d !== day)
      : [...sf.restDays, day];
    setSf({ ...sf, restDays: next });
  };

  return (
    <div className="shift-form">
      {/* Quick presets */}
      <div className="shift-section">
        <div className="shift-section-label">Quick Presets</div>
        <div className="shift-presets">
          {SHIFT_PRESETS.map(p => (
            <button key={p.label} type="button" className="shift-preset-btn"
              onClick={() => setSf({ ...sf, ...p })}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Shift name */}
      <div className="shift-section">
        <div className="shift-section-label">Shift Name</div>
        <input className="emp-field-input" placeholder="e.g. Morning, Night, Midshift"
          value={sf.label} onChange={e => setSf({ ...sf, label: e.target.value })} />
      </div>

      {/* Times + grace */}
      <div className="shift-time-row">
        <div className="emp-field">
          <div className="emp-field-label">Start Time</div>
          <input className="emp-field-input" type="time" value={sf.startTime}
            onChange={e => setSf({ ...sf, startTime: e.target.value })} />
          <div className="shift-time-hint">{fmtTime12(sf.startTime)}</div>
        </div>
        <div className="emp-field">
          <div className="emp-field-label">End Time</div>
          <input className="emp-field-input" type="time" value={sf.endTime}
            onChange={e => setSf({ ...sf, endTime: e.target.value })} />
          <div className="shift-time-hint">{fmtTime12(sf.endTime)}</div>
        </div>
        <div className="emp-field">
          <div className="emp-field-label">Grace Period</div>
          <select className="emp-field-select" value={sf.graceMinutes}
            onChange={e => setSf({ ...sf, graceMinutes: Number(e.target.value) })}>
            {[0,5,10,15,20,30].map(m => (
              <option key={m} value={m}>{m === 0 ? "No grace" : `${m} min`}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Rest days */}
      <div className="shift-section">
        <div className="shift-section-label">
          Rest Days 
          <span className="shift-restday-count">({sf.restDays.length} day{sf.restDays.length !== 1 ? "s" : ""} off)</span>
        </div>
        <div className="shift-days-row">
          {ALL_DAYS.map(day => {
            const isRest = sf.restDays.includes(day);
            return (
              <button key={day} type="button"
                className={`shift-day-btn${isRest ? " rest" : " work"}`}
                onClick={() => toggleRestDay(day)}>
                <span className="shift-day-abbr">{DAY_SHORT[day]}</span>
                <span className="shift-day-tag">{isRest ? "Off" : "Work"}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Effective from */}
      <div className="shift-section">
        <div className="shift-section-label">
          Effective From <span className="shift-optional">(optional)</span>
        </div>
        <input className="emp-field-input" type="date" value={sf.effectiveFrom}
          onChange={e => setSf({ ...sf, effectiveFrom: e.target.value })} />
        <div className="shift-eff-hint">Leave blank to apply this schedule to all records</div>
      </div>

      {/* Live preview */}
      <div className="shift-preview">
        <div className="shift-preview-label">Schedule Preview</div>
        <div className="shift-preview-body">
          <span className="shift-preview-time">⏰ {fmtTime12(sf.startTime)} → {fmtTime12(sf.endTime)}</span>
          <span className="shift-preview-grace">+{sf.graceMinutes}min grace</span>
          <span className="shift-preview-rest">
            🏖 Off: {sf.restDays.length === 0 ? "None" : sf.restDays.map(d => DAY_SHORT[d]).join(", ")}
          </span>
          <span className="shift-preview-work">
            💼 Work: {ALL_DAYS.filter(d => !sf.restDays.includes(d)).map(d => DAY_SHORT[d]).join(", ")}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function Employees({ user: _user }: { user: User }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  /* ── modals ── */
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

  /* ── shift modal (single employee) ── */
  const [shiftTarget, setShiftTarget] = useState<Employee | null>(null);
  const [shiftForm, setShiftForm] = useState<Shift>({ ...DEFAULT_SHIFT });
  const [savingShift, setSavingShift] = useState(false);
  const [shiftError, setShiftError] = useState("");

  /* ── bulk shift modal ── */
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [bulkShiftForm, setBulkShiftForm] = useState<Shift>({ ...DEFAULT_SHIFT });
  const [savingBulk, setSavingBulk] = useState(false);

  /* ── fetch ── */
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/employees", { credentials: "include" });
      const data = await res.json();
      setEmployees(data.employees || []);
    } catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  useEffect(() => { setPage(1); }, [search, roleFilter, statusFilter]);

  /* ── open shift modal ── */
  const openShift = (emp: Employee) => {
    setShiftTarget(emp);
    setShiftForm(emp.shift ? { ...emp.shift } : { ...DEFAULT_SHIFT });
    setShiftError("");
    setViewTarget(null);
  };

  /* ── save shift (single) ── */
  const handleSaveShift = async () => {
    if (!shiftTarget) return;
    if (!shiftForm.startTime || !shiftForm.endTime) { setShiftError("Start and end time are required."); return; }
    if (shiftForm.restDays.length >= 7) { setShiftError("Employee must work at least one day."); return; }
    setSavingShift(true);
    setShiftError("");
    try {
      const res = await fetch("/api/employees/shift", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ employeeId: shiftTarget._id, shift: shiftForm }),
      });
      const data = await res.json();
      if (!res.ok) { setShiftError(data.error || "Failed to save."); return; }
      setEmployees(prev => prev.map(e => e._id === shiftTarget._id ? { ...e, shift: data.shift } : e));
      setShiftTarget(null);
    } catch { setShiftError("Network error."); }
    finally { setSavingShift(false); }
  };

  /* ── save shift (bulk) ── */
  const handleSaveBulk = async () => {
    if (bulkSelected.length === 0) return;
    setSavingBulk(true);
    try {
      const res = await fetch("/api/employees/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ employeeIds: bulkSelected, shift: bulkShiftForm }),
      });
      if (res.ok) {
        setEmployees(prev => prev.map(e =>
          bulkSelected.includes(e._id) ? { ...e, shift: { ...bulkShiftForm } } : e
        ));
        setBulkOpen(false);
        setBulkSelected([]);
      }
    } catch { }
    finally { setSavingBulk(false); }
  };

  /* ── add / edit ── */
  const openAdd = () => { setEditing(null); setForm({ ...BLANK }); setFormError(""); setAddEditOpen(true); };
  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setForm({ employeeName:emp.employeeName, email:emp.email, role:emp.role, campaign:emp.campaign, status:emp.status, birthdate:emp.birthdate, notes:emp.notes });
    setFormError(""); setViewTarget(null); setAddEditOpen(true);
  };
  const closeAddEdit = () => { setAddEditOpen(false); setEditing(null); setFormError(""); };

  const handleSave = async () => {
    if (!form.employeeName.trim()) { setFormError("Full name is required."); return; }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setFormError("A valid email address is required."); return;
    }
    setSaving(true); setFormError("");
    try {
      const method = editing ? "PUT" : "POST";
      const body = editing ? { id: editing._id, ...form } : form;
      const res = await fetch("/api/employees", {
        method, headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || "Save failed."); return; }
      closeAddEdit(); fetchEmployees();
    } catch { setFormError("Network error."); }
    finally { setSaving(false); }
  };

  /* ── delete ── */
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const emp = deleteTarget;
    setDeleteTarget(null); setDeleting(emp._id);
    try {
      await fetch("/api/employees", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ id: emp._id }),
      });
      fetchEmployees();
    } catch { }
    finally { setDeleting(null); }
  };

  /* ── photo upload ── */
  const handlePhotoUpload = async (emp: Employee, file: File) => {
    setUploadingFor(emp._id);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("employeeId", emp._id);
      const res = await fetch("/api/employees/photo", { method: "POST", body: fd, credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setEmployees(prev => prev.map(e => e._id === emp._id ? { ...e, profilePic: data.profilePic } : e));
        if (editing?._id === emp._id) setEditing(prev => prev ? { ...prev, profilePic: data.profilePic } : prev);
        if (viewTarget?._id === emp._id) setViewTarget(prev => prev ? { ...prev, profilePic: data.profilePic } : prev);
      }
    } catch { }
    finally { setUploadingFor(null); }
  };

  /* ── derived ── */
  const filtered = employees.filter(emp => {
    const q = search.toLowerCase();
    const matchSearch = !q || emp.employeeName.toLowerCase().includes(q) ||
      emp.email.toLowerCase().includes(q) || emp.campaign.toLowerCase().includes(q);
    return matchSearch && (roleFilter === "all" || emp.role === roleFilter)
      && (statusFilter === "all" || emp.status === statusFilter);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalActive  = employees.filter(e => e.status === "active").length;
  const totalOnLeave = employees.filter(e => e.status === "on-leave" || e.status === "absent").length;
  const totalOM = employees.filter(e => e.role === "OM").length;
  const totalTL = employees.filter(e => e.role === "TL").length;
  const birthdays = employees.filter(e => isBirthdayToday(e.birthdate));
  const noShiftCount = employees.filter(e => e.status === "active" && !e.shift?.startTime).length;
  const activeEmps = employees.filter(e => e.status === "active");

  /* ── render ── */
  return (
    <div className="emp-wrap">

      {/* ══════════ SHIFT MODAL (single) ══════════ */}
      {shiftTarget && (
        <div className="emp-modal-overlay" onClick={() => setShiftTarget(null)}>
          <div className="emp-modal emp-shift-modal" onClick={e => e.stopPropagation()}>
            <div className="emp-modal-header">
              <div>
                <span className="emp-modal-title">Work Schedule</span>
                <div className="shift-modal-sub">{shiftTarget.employeeName}</div>
              </div>
              <button className="emp-modal-close" onClick={() => setShiftTarget(null)}>✕</button>
            </div>
            <div className="emp-modal-body">
              {shiftError && <div className="emp-error-msg">⚠ {shiftError}</div>}
              <ShiftFormWidget sf={shiftForm} setSf={setShiftForm} />
            </div>
            <div className="emp-modal-footer">
              <button className="btn-emp-cancel" onClick={() => setShiftTarget(null)}>Cancel</button>
              <button className="btn-emp-save" onClick={handleSaveShift} disabled={savingShift}>
                {savingShift ? "Saving…" : "💾 Save Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ BULK SHIFT MODAL ══════════ */}
      {bulkOpen && (
        <div className="emp-modal-overlay" onClick={() => setBulkOpen(false)}>
          <div className="emp-modal emp-shift-modal emp-bulk-modal" onClick={e => e.stopPropagation()}>
            <div className="emp-modal-header">
              <div>
                <span className="emp-modal-title">Bulk Schedule Update</span>
                <div className="shift-modal-sub">
                  {bulkSelected.length} employee{bulkSelected.length !== 1 ? "s" : ""} selected
                </div>
              </div>
              <button className="emp-modal-close" onClick={() => setBulkOpen(false)}>✕</button>
            </div>
            <div className="emp-modal-body">
              {/* Employee picker */}
              <div className="shift-section">
                <div className="shift-section-label">Select Employees</div>
                <div className="bulk-emp-list">
                  {activeEmps.map(emp => (
                    <label key={emp._id} className={`bulk-emp-row${bulkSelected.includes(emp._id) ? " selected" : ""}`}>
                      <input type="checkbox" checked={bulkSelected.includes(emp._id)}
                        onChange={e => setBulkSelected(prev =>
                          e.target.checked ? [...prev, emp._id] : prev.filter(id => id !== emp._id)
                        )} />
                      <img src={avatarUrl(emp.employeeName, emp.profilePic)} className="bulk-emp-avatar" />
                      <span className="bulk-emp-name">{emp.employeeName}</span>
                      <span className="bulk-emp-shift">{shiftSummary(emp.shift)}</span>
                    </label>
                  ))}
                </div>
                <button className="bulk-select-all" type="button"
                  onClick={() => setBulkSelected(
                    bulkSelected.length === activeEmps.length ? [] : activeEmps.map(e => e._id)
                  )}>
                  {bulkSelected.length === activeEmps.length ? "Deselect All" : "Select All Active"}
                </button>
              </div>

              <ShiftFormWidget sf={bulkShiftForm} setSf={setBulkShiftForm} />
            </div>
            <div className="emp-modal-footer">
              <button className="btn-emp-cancel" onClick={() => setBulkOpen(false)}>Cancel</button>
              <button className="btn-emp-save" onClick={handleSaveBulk}
                disabled={savingBulk || bulkSelected.length === 0}>
                {savingBulk ? "Saving…" : `💾 Apply to ${bulkSelected.length} Employee${bulkSelected.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ VIEW MODAL ══════════ */}
      {viewTarget && (
        <div className="emp-modal-overlay" onClick={() => setViewTarget(null)}>
          <div className="emp-modal emp-view-modal" onClick={e => e.stopPropagation()}>
            <div className="emp-modal-header">
              <span className="emp-modal-title">Employee Profile</span>
              <button className="emp-modal-close" onClick={() => setViewTarget(null)}>✕</button>
            </div>
            <div className="emp-view-body">
              <div className="emp-view-top">
                <div className="emp-view-avatar-wrap">
                  <img src={avatarUrl(viewTarget.employeeName, viewTarget.profilePic)} alt={viewTarget.employeeName} className="emp-view-avatar" />
                  {isBirthdayToday(viewTarget.birthdate) && <span className="emp-view-bday-tag">🎂 Birthday!</span>}
                  <label className="emp-view-photo-btn" title="Change photo">
                    <input type="file" accept="image/*" style={{ display:"none" }}
                      disabled={uploadingFor === viewTarget._id}
                      onChange={e => e.target.files?.[0] && handlePhotoUpload(viewTarget, e.target.files[0])} />
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
                {/* ── SHIFT INFO in view modal ── */}
                <div className="emp-view-item emp-view-full">
                  <span className="emp-view-lbl">Work Schedule</span>
                  {viewTarget.shift?.startTime ? (
                    <div className="emp-view-shift">
                      <div className="emp-view-shift-row">
                        <span className="emp-view-shift-badge">{viewTarget.shift.label || "Regular"}</span>
                        <span className="emp-view-shift-time">
                          ⏰ {fmtTime12(viewTarget.shift.startTime)} – {fmtTime12(viewTarget.shift.endTime)}
                        </span>
                        <span className="emp-view-shift-grace">+{viewTarget.shift.graceMinutes}m grace</span>
                      </div>
                      <div className="emp-view-shift-days">
                        {ALL_DAYS.map(day => (
                          <span key={day} className={`shift-day-chip${viewTarget.shift!.restDays.includes(day) ? " off" : " on"}`}>
                            {DAY_SHORT[day]}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <span className="emp-no-shift-val">No schedule set — <button className="emp-no-shift-link" onClick={() => openShift(viewTarget)}>Set now →</button></span>
                  )}
                </div>
                <div className="emp-view-item">
                  <span className="emp-view-lbl">Member Since</span>
                  <span className="emp-view-val">
                    {new Date(viewTarget.createdAt).toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" })}
                  </span>
                </div>
                {viewTarget.notes && (
                  <div className="emp-view-item emp-view-full">
                    <span className="emp-view-lbl">Notes</span>
                    <span className="emp-view-val" style={{ whiteSpace:"pre-wrap", lineHeight:1.5 }}>{viewTarget.notes}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="emp-modal-footer">
              <button className="btn-emp-cancel" onClick={() => setViewTarget(null)}>Close</button>
              <button className="btn-emp-secondary" onClick={() => openShift(viewTarget)}>🗓 Schedule</button>
              <button className="btn-emp-save" onClick={() => openEdit(viewTarget)}>✏ Edit</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ DELETE MODAL ══════════ */}
      {deleteTarget && (
        <div className="del-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="del-modal" onClick={e => e.stopPropagation()}>
            <div className="del-modal-icon">🗑️</div>
            <div className="del-modal-title">Remove Employee?</div>
            <div className="del-modal-body">This removes the employee from your roster. Their time records are <strong>not</strong> deleted.</div>
            <div className="del-modal-name">
              <span>👤</span><span>{deleteTarget.employeeName}</span>
              <span style={{ marginLeft:"auto", fontFamily:"'DM Mono',monospace", fontSize:10, color:"var(--text-light)", fontWeight:400 }}>{deleteTarget.email}</span>
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

      {/* ══════════ ADD / EDIT MODAL ══════════ */}
      {addEditOpen && (
        <div className="emp-modal-overlay" onClick={closeAddEdit}>
          <div className="emp-modal" onClick={e => e.stopPropagation()}>
            <div className="emp-modal-header">
              <span className="emp-modal-title">{editing ? "Edit Employee" : "Add Employee"}</span>
              <button className="emp-modal-close" onClick={closeAddEdit}>✕</button>
            </div>
            <div className="emp-modal-avatar-section">
              <img src={avatarUrl(form.employeeName || "EMP", editing?.profilePic)} alt="Profile" className="emp-modal-avatar" />
              <div className="emp-modal-avatar-hint">
                {editing ? uploadingFor === editing._id ? "⏳ Uploading…" : "Click below to change photo" : "Save first to upload a profile photo"}
              </div>
              {editing && (
                <label className="btn-change-photo" style={{ cursor:"pointer" }}>
                  <input ref={modalFileRef} type="file" accept="image/*" style={{ display:"none" }}
                    disabled={uploadingFor === editing._id}
                    onChange={e => e.target.files?.[0] && handlePhotoUpload(editing, e.target.files[0])} />
                  {uploadingFor === editing._id ? "⏳ Uploading…" : "📷 Change Photo"}
                </label>
              )}
            </div>
            <div className="emp-modal-body">
              {formError && <div className="emp-error-msg">⚠ {formError}</div>}
              <div className="emp-field full">
                <div className="emp-field-label">Full Name *</div>
                <input className="emp-field-input" placeholder="Juan dela Cruz" value={form.employeeName}
                  onChange={e => setForm(f => ({ ...f, employeeName: e.target.value }))} />
              </div>
              <div className="emp-field full">
                <div className="emp-field-label">Email *{editing && <span className="emp-modal-verified-tag">✓ Locked after creation</span>}</div>
                <input className="emp-field-input" type="email" placeholder="juan@company.com"
                  value={form.email} disabled={!!editing}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="emp-field-row">
                <div className="emp-field">
                  <div className="emp-field-label">Role</div>
                  <select className="emp-field-select" value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value as Employee["role"] }))}>
                    <option value="OM">OM — Operations Manager</option>
                    <option value="TL">TL — Team Lead</option>
                    <option value="Agent">Agent</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="emp-field">
                  <div className="emp-field-label">Campaign</div>
                  <input className="emp-field-input" placeholder="e.g. Nationgraph" value={form.campaign}
                    onChange={e => setForm(f => ({ ...f, campaign: e.target.value }))} />
                </div>
              </div>
              <div className="emp-field-row">
                <div className="emp-field">
                  <div className="emp-field-label">Status</div>
                  <select className="emp-field-select" value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as Employee["status"] }))}>
                    <option value="active">Active</option>
                    <option value="on-leave">On Leave</option>
                    <option value="absent">Absent</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="emp-field">
                  <div className="emp-field-label">Birthdate</div>
                  <input className="emp-field-input" type="date" value={form.birthdate}
                    onChange={e => setForm(f => ({ ...f, birthdate: e.target.value }))} />
                </div>
              </div>
              <div className="emp-field full">
                <div className="emp-field-label">Notes</div>
                <textarea className="emp-field-textarea" placeholder="Optional — e.g. skills, schedule notes…"
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
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

      {/* ══════════ PAGE HEADER ══════════ */}
      <div className="emp-header">
        <div>
          <h1 className="emp-title">Employees</h1>
          <p className="emp-subtitle">Team Roster & Schedule Management</p>
        </div>
        <div className="emp-header-actions">
          <button className="btn-bulk-schedule" onClick={() => { setBulkOpen(true); setBulkSelected([]); }}>
            🗓 Bulk Schedule
          </button>
          <button className="btn-add-employee" onClick={openAdd}>+ Add Employee</button>
        </div>
      </div>

      {/* ══════════ STATS ══════════ */}
      <div className="emp-stats">
        <div className="stat-card c-green"><div className="stat-label">Active</div><div className="stat-value">{totalActive}</div></div>
        <div className="stat-card c-default"><div className="stat-label">Total</div><div className="stat-value">{employees.length}</div></div>
        <div className="stat-card c-blue"><div className="stat-label">OM / TL</div><div className="stat-value">{totalOM}/{totalTL}</div></div>
        <div className="stat-card c-amber"><div className="stat-label">Leave / Absent</div><div className="stat-value">{totalOnLeave}</div></div>
      </div>

      {/* ── No-schedule alert ── */}
      {noShiftCount > 0 && (
        <div className="emp-no-shift-alert">
          ⚠️ <strong>{noShiftCount} active employee{noShiftCount !== 1 ? "s" : ""}</strong> {noShiftCount !== 1 ? "have" : "has"} no work schedule set.
          <button onClick={() => { setBulkOpen(true); setBulkSelected(employees.filter(e => e.status === "active" && !e.shift?.startTime).map(e => e._id)); }}>
            Set Schedules →
          </button>
        </div>
      )}

      {/* ── Birthday banner ── */}
      {birthdays.length > 0 && (
        <div className="emp-birthday-banner">
          🎂&nbsp;<span>Happy Birthday to&nbsp;<strong>{birthdays.map(e => e.employeeName).join(", ")}</strong>! 🎉</span>
        </div>
      )}

      {/* ══════════ SEARCH & FILTERS ══════════ */}
      <div className="emp-filter-bar">
        <input className="emp-search" placeholder="🔍  Search name, email, campaign…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="emp-filter-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="all">All Roles</option>
          <option value="OM">OM</option><option value="TL">TL</option>
          <option value="Agent">Agent</option><option value="Other">Other</option>
        </select>
        <select className="emp-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option><option value="on-leave">On Leave</option>
          <option value="absent">Absent</option><option value="inactive">Inactive</option>
        </select>
      </div>

      {/* ══════════ TABLE ══════════ */}
      {loading ? (
        <div className="emp-loading">
          <div className="loading-dots"><span /><span /><span /></div>
          <div className="loading-label" style={{ marginTop:10 }}>Loading employees</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="emp-empty">
          <div className="emp-empty-icon">👥</div>
          <div className="emp-empty-title">{employees.length === 0 ? "No employees yet" : "No results found"}</div>
          <div className="emp-empty-sub">{employees.length === 0 ? "Add your first team member to get started" : "Try adjusting your search or filters"}</div>
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
                  <th>Schedule</th>
                  <th>Rest Days (Gray) – Duty Schedule (Green)</th>
                  <th>Birthdate</th>
                  <th style={{ textAlign:"right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((emp, i) => (
                  <tr key={emp._id} className="emp-table-row" style={{ animationDelay:`${i * 0.03}s` }}>
                    <td>
                      <div className="emp-table-identity">
                        <div className="emp-table-avatar-wrap">
                          <img src={avatarUrl(emp.employeeName, emp.profilePic)} alt={emp.employeeName} className="emp-table-avatar" />
                          <div className={`emp-table-role-dot role-dot-${emp.role}`} />
                        </div>
                        <div>
                          <div className="emp-table-name">{emp.employeeName}{isBirthdayToday(emp.birthdate) && " 🎂"}</div>
                          <div className="emp-table-age-sub">{calcAge(emp.birthdate)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="emp-table-email">{emp.email}</td>
                    <td><span className={`emp-role-badge emp-role-${emp.role}`}>{ROLE_LABELS[emp.role]}</span></td>
                    <td className="emp-table-campaign">{emp.campaign || <span style={{ color:"var(--text-light)" }}>—</span>}</td>
                    <td><span className={`emp-status-badge emp-status-${emp.status}`}>{STATUS_LABELS[emp.status]}</span></td>
                    {/* ── Schedule column ── */}
                    <td>
                      {emp.shift?.startTime ? (
                        <div className="emp-table-schedule">
                          <span className="emp-table-schedule-time">{fmtTime12(emp.shift.startTime)} – {fmtTime12(emp.shift.endTime)}</span>
                          <span className="emp-table-schedule-label">{emp.shift.label}</span>
                          <span className="emp-table-schedule-grace">+{emp.shift.graceMinutes}m</span>
                        </div>
                      ) : (
                        <button className="emp-tbl-set-schedule" onClick={() => openShift(emp)}>+ Set</button>
                      )}
                    </td>
                    {/* ── Rest days column ── */}
                    <td>
                      {emp.shift?.restDays?.length ? (
                        <div className="emp-table-restdays">
                          {ALL_DAYS.map(day => (
                            <span key={day} className={`shift-day-chip-sm${emp.shift!.restDays.includes(day) ? " off" : " on"}`}>
                              {DAY_SHORT[day]}
                            </span>
                          ))}
                        </div>
                      ) : <span style={{ color:"var(--text-light)", fontSize:10 }}>—</span>}
                    </td>
                    <td className="emp-table-bd">{formatBirthdate(emp.birthdate)}</td>
                    <td>
                      <div className="emp-table-actions">
                        <button className="emp-tbl-btn emp-tbl-view" onClick={() => setViewTarget(emp)}>👁 View</button>
                        <button className="emp-tbl-btn emp-tbl-schedule" onClick={() => openShift(emp)} title="Set Schedule">🗓</button>
                        <button className="emp-tbl-btn emp-tbl-edit" onClick={() => openEdit(emp)}>✏ Edit</button>
                        <button className="emp-tbl-btn emp-tbl-del" disabled={deleting === emp._id} onClick={() => setDeleteTarget(emp)}>
                          {deleting === emp._id ? "…" : "🗑"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="emp-pagination">
            <span className="emp-pag-info">
              Showing {Math.min((page-1)*PAGE_SIZE+1, filtered.length)}–{Math.min(page*PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="emp-pag-controls">
              <button className="emp-pag-btn" disabled={page<=1} onClick={() => setPage(1)}>«</button>
              <button className="emp-pag-btn" disabled={page<=1} onClick={() => setPage(p => p-1)}>← Prev</button>
              <span className="emp-pag-current">{page} / {totalPages}</span>
              <button className="emp-pag-btn" disabled={page>=totalPages} onClick={() => setPage(p => p+1)}>Next →</button>
              <button className="emp-pag-btn" disabled={page>=totalPages} onClick={() => setPage(totalPages)}>»</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}