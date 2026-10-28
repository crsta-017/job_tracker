import { useState } from "react";
import { fmtDate } from "./format";

// Today's date in the user's LOCAL timezone as YYYY-MM-DD (toISOString would give UTC)
const localToday = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const blank = () => ({
  companyName: "", jobRole: "", jobType: "Full-time",
  appliedDate: localToday(), expectedSalary: "", notes: "",
});

const fromApp = (a) => ({
  companyName: a.companyName, jobRole: a.jobRole, jobType: a.jobType,
  appliedDate: "", expectedSalary: a.expectedSalary ?? "", notes: a.notes ?? "",
});

export default function ApplicationForm({ onSubmit, editing, onCancel }) {
  const [form, setForm] = useState(editing ? fromApp(editing) : blank());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    let body;
    if (editing) {
      // Only editable fields are sent. Application ID and Applied Date are never included.
      body = {
        companyName: form.companyName, jobRole: form.jobRole, jobType: form.jobType,
        expectedSalary: form.expectedSalary === "" ? null : Number(form.expectedSalary),
        notes: form.notes,
      };
    } else {
      if (!form.appliedDate) return setError("Applied date is required");
      if (form.appliedDate > localToday()) return setError("Applied date cannot be in the future");
      body = { ...form };
      if (body.expectedSalary === "") delete body.expectedSalary;
    }
    setSaving(true);
    try {
      await onSubmit(body);
      if (!editing) setForm(blank());
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={`form ${editing ? "editing" : ""}`} onSubmit={submit}>
      <h2 className="wide">{editing ? "Edit application" : "New application"}</h2>

      {editing && (
        <>
          <label>Application ID
            <input value={editing.applicationId} disabled />
          </label>
          <label>Applied date
            <input value={fmtDate(editing.appliedDate)} disabled />
          </label>
        </>
      )}

      <label className="wide">Company
        <input name="companyName" value={form.companyName} onChange={set} required autoComplete="organization" />
      </label>
      <label className="wide">Job role
        <input name="jobRole" value={form.jobRole} onChange={set} required />
      </label>
      <label>Job type
        <select name="jobType" value={form.jobType} onChange={set}>
          <option>Full-time</option>
          <option>Internship</option>
          <option>Contract</option>
        </select>
      </label>
      {!editing && (
        <label>Applied date
          <input type="date" name="appliedDate" value={form.appliedDate} onChange={set} max={localToday()} required />
        </label>
      )}
      <label className={editing ? "" : "wide"}>Expected salary <span className="opt">optional</span>
        <input type="number" min="0" name="expectedSalary" value={form.expectedSalary} onChange={set} inputMode="numeric" />
      </label>
      <label className="wide">Notes <span className="opt">optional</span>
        <textarea name="notes" rows="3" value={form.notes} onChange={set} />
      </label>

      {error && <p className="error wide" role="alert">{error}</p>}

      <div className="wide buttons">
        <button className="btn primary" disabled={saving}>
          {saving ? "Saving…" : editing ? "Save changes" : "Add application"}
        </button>
        {editing && <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
