import { useCallback, useEffect, useState } from "react";
import { getApplications, getStats, addApplication, updateApplication, deleteApplication } from "./api";
import ApplicationForm from "./ApplicationForm.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import Details from "./Details.jsx";
import { fmtDate } from "./format";

const STAGES = ["Applied", "Interview", "Offer", "Accepted", "Declined", "Rejected"];
const st = (status) => `st-${status.toLowerCase()}`;

export default function App() {
  const [apps, setApps] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false); // only matters on small screens
  const [toast, setToast] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Filters are sent to the backend as query parameters
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  const notify = useCallback((type, text) => setToast({ type, text }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Tiny hash router: #/applications/<id> opens the details page
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const detailsId = (hash.match(/^#\/applications\/([a-f0-9]{24})$/) || [])[1];

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false; // ignore out-of-order responses
    Promise.all([getApplications({ status: statusFilter, search }), getStats()])
      .then(([list, s]) => {
        if (cancelled) return;
        setApps(list);
        setStats(s);
      })
      .catch((e) => !cancelled && notify("error", e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [statusFilter, search, version, notify]);

  const handleAdd = async (data) => {
    const res = await addApplication(data); // errors (400/409) are thrown to the form
    setFormOpen(false);
    notify("success", res.message);
    reload();
  };

  const handleEdit = async (data) => {
    const res = await updateApplication(editing._id, data);
    setEditing(null);
    setFormOpen(false);
    notify("success", res.message);
    reload();
  };

  const startEdit = (a) => {
    setEditing(a);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const stopEdit = () => { setEditing(null); setFormOpen(false); };

  const handleStatus = async (id, status) => {
    try {
      const res = await updateApplication(id, { status });
      notify("success", res.message);
    } catch (e) {
      notify("error", e.message);
    }
    reload();
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const res = await deleteApplication(toDelete._id);
      if (editing?._id === toDelete._id) stopEdit();
      notify("success", res.message);
    } catch (e) {
      notify("error", e.message); // e.g. 409 if the status changed since the page loaded
    } finally {
      setDeleting(false);
      setToDelete(null);
      reload();
    }
  };

  if (detailsId) return <Details id={detailsId} />;

  const filtering = statusFilter || search;
  const count = (s) => (stats ? stats.counts[s] : "–");

  return (
    <div className="shell">
      <header className="top">
        <h1>Job applications</h1>
        <p className="sub">Track every application from first submit to final answer.</p>
      </header>

      <div className="tiles" role="group" aria-label="Applications per status. Select one to filter.">
        <button className={`tile ${statusFilter === "" ? "on" : ""}`} aria-pressed={statusFilter === ""} onClick={() => setStatusFilter("")}>
          <b>{stats ? stats.total : "–"}</b><span>All</span>
        </button>
        {STAGES.map((s) => (
          <button key={s} className={`tile ${st(s)} ${statusFilter === s ? "on" : ""}`}
            aria-pressed={statusFilter === s} onClick={() => setStatusFilter(statusFilter === s ? "" : s)}>
            <b>{count(s)}</b><span>{s}</span>
          </button>
        ))}
      </div>

      <div className="layout">
        <aside className={`side ${formOpen ? "open" : ""}`}>
          <ApplicationForm
            key={editing ? editing._id : "new"}
            editing={editing}
            onSubmit={editing ? handleEdit : handleAdd}
            onCancel={stopEdit}
          />
        </aside>

        <section className="results" aria-label="Applications">
          <div className="toolbar">
            <input type="search" placeholder="Search by company" value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)} aria-label="Search by company" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
              <option value="">All statuses</option>
              {STAGES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          {loading && <p className="empty">Loading…</p>}
          {!loading && apps.length === 0 && (
            <div className="empty-card">
              <strong>{filtering ? "No applications match your filters" : "No applications yet"}</strong>
              <span>{filtering ? "Try a different company name or status." : "Add your first application using the form."}</span>
            </div>
          )}

          <ul className="list">
            {apps.map((a) => (
              <li key={a._id} className={`card ${st(a.status)}`}>
                <div className="card-head">
                  <div>
                    <h3><a href={`#/applications/${a._id}`}>{a.jobRole}</a></h3>
                    <p className="company">{a.companyName}</p>
                  </div>
                  <span className={`badge ${st(a.status)}`}>{a.status}</span>
                </div>

                <p className="meta">
                  <span className="appid">{a.applicationId}</span>
                  <span>{a.jobType}</span>
                  <span>Applied {fmtDate(a.appliedDate)}</span>
                  {a.expectedSalary != null && <span>Expected {a.expectedSalary.toLocaleString()}</span>}
                </p>
                {a.status === "Applied" && a.followUpDate && <p className="meta">Follow up by {fmtDate(a.followUpDate)}</p>}
                {a.isOverdue && <span className="overdue">Follow-up Overdue</span>}
                {a.notes && <p className="notes">{a.notes}</p>}

                <div className="card-foot">
                  {a.nextStatuses.length > 0 ? (
                    <select className="move" value="" onChange={(e) => e.target.value && handleStatus(a._id, e.target.value)}
                      aria-label={`Move ${a.jobRole} at ${a.companyName} to next status`}>
                      <option value="">Move to…</option>
                      {a.nextStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <span className="final">Final status</span>
                  )}
                  <span className="spacer" />
                  <button className="btn ghost small" onClick={() => startEdit(a)}>Edit</button>
                  <button className="btn danger-ghost small" disabled={!a.canDelete} onClick={() => setToDelete(a)}
                    title={a.canDelete ? "Delete this application" : `Applications in ${a.status} status can't be deleted`}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <button className="fab" onClick={() => { editing ? stopEdit() : setFormOpen((o) => !o); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
        {formOpen ? "Close form" : "+ Add application"}
      </button>

      <ConfirmDialog open={!!toDelete} title="Delete this application?" confirmLabel="Delete"
        busy={deleting} onConfirm={confirmDelete} onCancel={() => !deleting && setToDelete(null)}>
        {toDelete && (
          <p><strong>{toDelete.jobRole}</strong> at <strong>{toDelete.companyName}</strong> ({toDelete.applicationId}) and its
            status history will be permanently removed.</p>
        )}
      </ConfirmDialog>

      {toast && <div className={`toast ${toast.type}`} role={toast.type === "error" ? "alert" : "status"}>{toast.text}</div>}
    </div>
  );
}
