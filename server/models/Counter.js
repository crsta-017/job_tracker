const mongoose = require("mongoose");

// One document per company prefix (e.g. "INF"), holding the last sequence used.
const counterSchema = new mongoose.Schema({
  _id: { type: String },
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model("Counter", counterSchema);
