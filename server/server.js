require("node:dns").setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { notFound, errorHandler } = require("./middleware/errors");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/applications", require("./routes/applications"));
app.use(notFound);      // unknown routes -> 404 in the standard format
app.use(errorHandler);  // everything that was thrown -> proper status + standard format

const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("Connected to MongoDB Atlas");
    // Older records (saved before these features) get a follow-up date and a first history entry
    const Application = require("./models/Application");
    await Application.updateMany({ followUpDate: { $exists: false } }, [
      { $set: { followUpDate: { $dateAdd: { startDate: "$appliedDate", unit: "day", amount: 7 } } } },
    ]);
    await Application.updateMany({ statusHistory: { $exists: false } }, [
      { $set: { statusHistory: [{ status: "$status", changedAt: "$createdAt" }] } },
    ]);
    app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
