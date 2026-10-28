// Applied/follow-up dates are stored as UTC midnight, so show them in UTC to avoid a day shift
export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" }) : "";
export const fmtDateTime = (d) => new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
