import { useEffect, useState } from "react";
import { getApplication } from "./api";
import { fmtDate, fmtDateTime } from "./format";

export default function Details({ id }) {
  const [app, setApp] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getApplication(id).then(setApp).catch((e) => setError(e.message));
  }, [id]);

  return (
    <div className="shell narrow">
      <a className="back" href="#/">← Back to applications</a>
      {error && <p className="error" role="alert">{error}</p>}
      {!app && !error && <p className="empty">Loading…</p>}
      {app && (
        <article className={`panel ${"st-" + app.status.toLowerCase()}`}>
          <div className="card-head">
            <div>
              <h1>{app.jobRole}</h1>
              <p className="company">{app.companyName}</p>
            </div>
            <span className={`badge ${"st-" + app.status.toLowerCase()}`}>{app.status}</span>
          </div>
          {app.isOverdue && <span className="overdue">Follow-up Overdue</span>}

          <dl className="facts">
            <dt>Application ID</dt><dd>{app.applicationId}</dd>
            <dt>Job type</dt><dd>{app.jobType}</dd>
            <dt>Applied</dt><dd>{fmtDate(app.appliedDate)}</dd>
            <dt>Follow up by</dt><dd>{fmtDate(app.followUpDate)}</dd>
            {app.expectedSalary != null && (<><dt>Expected salary</dt><dd>{app.expectedSalary.toLocaleString()}</dd></>)}
            {app.notes && (<><dt>Notes</dt><dd>{app.notes}</dd></>)}
          </dl>

          <h2>Status history</h2>
          <ol className="timeline">
            {(app.statusHistory || []).map((h, i) => (
              <li key={i} className={`st-${h.status.toLowerCase()}`}>
                <strong>{h.status}</strong>
                <time dateTime={h.changedAt}>{fmtDateTime(h.changedAt)}</time>
              </li>
            ))}
          </ol>
        </article>
      )}
    </div>
  );
}
