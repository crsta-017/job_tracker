const express = require("express");
const Application = require("../models/Application");
const Counter = require("../models/Counter");
const { send, ApiError, asyncHandler } = require("../utils/http");
const { STATUS_TRANSITIONS, ACTIVE_STATUSES, DELETABLE_STATUSES } = Application;

const router = express.Router();
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A malformed id can never match a record, so it is a 404
router.param("id", (_req, _res, next, id) =>
  /^[a-f0-9]{24}$/i.test(id) ? next() : next(new ApiError(404, "Application not found"))
);

const companyPrefix = (name = "") => (name.replace(/[^A-Za-z]/g, "").toUpperCase() + "XXX").slice(0, 3);

// Atomic per-prefix counter: concurrent requests never get the same number
async function generateApplicationId(companyName) {
  const prefix = companyPrefix(companyName);
  const counter = await Counter.findOneAndUpdate({ _id: prefix }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return `JA-${prefix}-${String(counter.seq).padStart(3, "0")}`;
}

// Fields the client must never control
const sanitize = (body) => {
  const { applicationId, _id, createdAt, updatedAt, nextStatuses, canDelete, isOverdue, followUpDate, statusHistory, ...safe } = body;
  return safe;
};

const findActiveDuplicate = (companyName, jobRole, excludeId) => {
  const query = { companyName: String(companyName).trim(), jobRole: String(jobRole).trim(), status: { $in: ACTIVE_STATUSES } };
  if (excludeId) query._id = { $ne: excludeId };
  return Application.findOne(query).collation({ locale: "en", strength: 2 });
};
const duplicateMessage = (d) =>
  `An active application for "${d.companyName}" as "${d.jobRole}" already exists (${d.applicationId}, status: ${d.status}).`;

// POST /api/applications  ->  201
router.post("/", asyncHandler(async (req, res) => {
  const data = sanitize(req.body);
  data.status = "Applied";
  const app = new Application(data);
  await app.validate(); // validate BEFORE the duplicate check and before using a sequence number

  const dup = await findActiveDuplicate(app.companyName, app.jobRole);
  if (dup) throw new ApiError(409, duplicateMessage(dup));

  app.applicationId = await generateApplicationId(app.companyName);
  await app.save();
  send(res, 201, "Application added", app);
}));

// GET /api/applications?status=Applied&search=acme  ->  200
router.get("/", asyncHandler(async (req, res) => {
  const { status, search } = req.query;
  const filter = {};
  if (status) {
    if (!Object.prototype.hasOwnProperty.call(STATUS_TRANSITIONS, status)) {
      throw new ApiError(400, `"${status}" is not a valid status`);
    }
    filter.status = status;
  }
  if (typeof search === "string" && search.trim()) {
    filter.companyName = { $regex: escapeRegex(search.trim()), $options: "i" };
  }
  const apps = await Application.find(filter).sort({ appliedDate: -1, createdAt: -1 });
  send(res, 200, "Applications retrieved", apps);
}));

// GET /api/applications/stats  ->  200 (must be declared before /:id)
router.get("/stats", asyncHandler(async (_req, res) => {
  const rows = await Application.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  const counts = Object.fromEntries(Object.keys(STATUS_TRANSITIONS).map((s) => [s, 0]));
  rows.forEach((r) => { if (r._id in counts) counts[r._id] = r.count; });
  send(res, 200, "Status counts retrieved", {
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    counts,
  });
}));

// GET /api/applications/:id  ->  200 / 404
router.get("/:id", asyncHandler(async (req, res) => {
  const app = await Application.findById(req.params.id);
  if (!app) throw new ApiError(404, "Application not found");
  send(res, 200, "Application retrieved", app);
}));

// PUT /api/applications/:id  ->  200 / 400 / 404 / 409
router.put("/:id", asyncHandler(async (req, res) => {
  const current = await Application.findById(req.params.id);
  if (!current) throw new ApiError(404, "Application not found");

  // Application ID and Applied Date are locked after creation
  const body = req.body;
  if (body.applicationId !== undefined && body.applicationId !== current.applicationId) {
    throw new ApiError(400, "Application ID cannot be edited");
  }
  if (body.appliedDate !== undefined && new Date(body.appliedDate).getTime() !== current.appliedDate.getTime()) {
    throw new ApiError(400, "Applied date cannot be edited");
  }
  const data = sanitize(body);
  delete data.appliedDate;

  // Status workflow
  const statusChanged = data.status !== undefined && data.status !== current.status;
  if (statusChanged) {
    if (!Object.prototype.hasOwnProperty.call(STATUS_TRANSITIONS, data.status)) {
      throw new ApiError(400, `"${data.status}" is not a valid status`);
    }
    const allowed = STATUS_TRANSITIONS[current.status];
    if (allowed.length === 0) throw new ApiError(400, `Status "${current.status}" is final and cannot be changed`);
    if (!allowed.includes(data.status)) {
      throw new ApiError(400, `Invalid transition: ${current.status} → ${data.status}. Allowed: ${allowed.join(", ")}`);
    }
  }

  // Duplicate rule also applies when company/role is edited on an active application
  if ((data.companyName !== undefined || data.jobRole !== undefined) && ACTIVE_STATUSES.includes(current.status)) {
    const dup = await findActiveDuplicate(data.companyName ?? current.companyName, data.jobRole ?? current.jobRole, current._id);
    if (dup) throw new ApiError(409, duplicateMessage(dup));
  }

  const update = { $set: data };
  if (statusChanged) update.$push = { statusHistory: { status: data.status, changedAt: new Date() } };

  // Filter on the status we checked, so two simultaneous updates can't both pass
  const updated = await Application.findOneAndUpdate(
    { _id: req.params.id, status: current.status },
    update,
    { new: true, runValidators: true }
  );
  if (!updated) throw new ApiError(409, "This application was changed by another request. Refresh and try again.");
  send(res, 200, statusChanged ? `Status changed to ${data.status}` : "Application updated", updated);
}));

// DELETE /api/applications/:id  ->  200 / 404 / 409
router.delete("/:id", asyncHandler(async (req, res) => {
  // The status condition is part of the delete itself, so a status change in between can't slip past the rule
  const deleted = await Application.findOneAndDelete({ _id: req.params.id, status: { $in: DELETABLE_STATUSES } });
  if (deleted) return send(res, 200, "Application deleted", deleted);

  const existing = await Application.findById(req.params.id);
  if (!existing) throw new ApiError(404, "Application not found");
  throw new ApiError(
    409,
    `An application in "${existing.status}" status cannot be deleted. Only ${DELETABLE_STATUSES.join(", ")} can be deleted.`
  );
}));

module.exports = router;
