const mongoose = require("mongoose");

const interviewSchema = new mongoose.Schema({
  company: {
    type: String,
    required: true,
  },
  level: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  userEmail: {
    type: String,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  transcript: [{
    role: String,
    content: String
  }]
});

module.exports = mongoose.model("Interview", interviewSchema);
