const BASE = "/api/applications";

// Every backend response is { success, message, data }. This returns that body, or throws
// an Error carrying the backend's message.
async function request(url, options) {
  let res;
  try {
    res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  } catch {
    throw new Error("Cannot reach the server. Check that the backend is running.");
  }
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON response */ }
  if (!res.ok || !body || !body.success) throw new Error((body && body.message) || "Request failed");
  return body;
}

// Reads return just the data
export const getApplications = ({ status, search } = {}) => {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  const qs = params.toString();
  return request(qs ? `${BASE}?${qs}` : BASE).then((b) => b.data);
};
export const getStats = () => request(`${BASE}/stats`).then((b) => b.data);
export const getApplication = (id) => request(`${BASE}/${id}`).then((b) => b.data);

// Writes return the whole body so the UI can show the backend's message
export const addApplication = (body) => request(BASE, { method: "POST", body: JSON.stringify(body) });
export const updateApplication = (id, body) => request(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteApplication = (id) => request(`${BASE}/${id}`, { method: "DELETE" });
