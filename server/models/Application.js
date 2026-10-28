const mongoose = require("mongoose");

// Single source of truth for the status workflow. An empty list means the status is final.
const STATUS_TRANSITIONS = {
  Applied: ["Interview", "Rejected"],
  Interview: ["Offer", "Rejected"],
  Offer: ["Accepted", "Declined"],
  Rejected: [],
  Accepted: [],
  Declined: [],
};
// "Active" = not in a final status
const ACTIVE_STATUSES = Object.keys(STATUS_TRANSITIONS).filter((s) => STATUS_TRANSITIONS[s].length > 0);

// Delete rule: only Applied or a final status can be deleted (Interview and Offer cannot)
const DELETABLE_STATUSES = Object.keys(STATUS_TRANSITIONS).filter(
  (s) => s === "Applied" || STATUS_TRANSITIONS[s].length === 0
);

const FOLLOW_UP_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (date, n) => new Date(new Date(date).getTime() + n * DAY_MS);

// A date is "not in the future" if it is today anywhere on Earth (latest timezone is UTC+14).
const MAX_TZ_AHEAD_MS = 14 * 60 * 60 * 1000;

const applicationSchema = new mongoose.Schema(
  {
    applicationId: { type: String, unique: true, immutable: true },
    companyName: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
      validate: {
        validator: (v) => /[A-Za-z]/.test(v),
        message: "Company name must contain at least one letter",
      },
    },
    jobRole: { type: String, required: [true, "Job role is required"], trim: true },
    jobType: {
      type: String,
      required: [true, "Job type is required"],
      enum: { values: ["Full-time", "Internship", "Contract"], message: "Job type must be Full-time, Internship or Contract" },
    },
    appliedDate: {
      type: Date,
      required: [true, "Applied date is required"],
      immutable: true, // cannot be changed after creation
      validate: {
        validator: (v) => v.getTime() <= Date.now() + MAX_TZ_AHEAD_MS,
        message: "Applied date cannot be in the future",
      },
    },
    followUpDate: Date, // set by the server: appliedDate + 7 days
    expectedSalary: { type: Number, min: [0, "Expected salary cannot be negative"] },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: Object.keys(STATUS_TRANSITIONS),
      default: "Applied",
    },
    // Every status the application has had, oldest first
    statusHistory: [
      {
        _id: false,
        status: { type: String, required: true },
        changedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true, toJSON: { virtuals: true, id: false } }
);

// On creation: set the follow-up date and the first history entry (Applied)
applicationSchema.pre("validate", function () {
  if (!this.isNew) return;
  if (this.appliedDate && !this.followUpDate) this.followUpDate = addDays(this.appliedDate, FOLLOW_UP_DAYS);
  if (this.statusHistory.length === 0) this.statusHistory.push({ status: this.status, changedAt: new Date() });
});

// Overdue once the follow-up day has fully passed and it is still "Applied"
applicationSchema.virtual("isOverdue").get(function () {
  if (this.status !== "Applied") return false;
  const due = this.followUpDate || (this.appliedDate && addDays(this.appliedDate, FOLLOW_UP_DAYS));
  return !!due && Date.now() > new Date(due).getTime() + DAY_MS;
});

applicationSchema.virtual("nextStatuses").get(function () {
  return STATUS_TRANSITIONS[this.status] || [];
});

applicationSchema.virtual("canDelete").get(function () {
  return DELETABLE_STATUSES.includes(this.status);
});

// Database-level guard for the duplicate rule (case-insensitive, active applications only).
// The route checks first to give a friendly message; this index stops simultaneous requests.
applicationSchema.index(
  { companyName: 1, jobRole: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
    partialFilterExpression: { status: { $in: ACTIVE_STATUSES } },
  }
);

module.exports = mongoose.model("Application", applicationSchema);
Object.assign(module.exports, { STATUS_TRANSITIONS, ACTIVE_STATUSES, DELETABLE_STATUSES, FOLLOW_UP_DAYS, addDays });
