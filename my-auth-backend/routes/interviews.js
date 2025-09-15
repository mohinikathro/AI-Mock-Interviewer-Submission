const express = require("express");
const router = express.Router();
const Interview = require("../models/Interview");

// ✅ Get all interviews for a user
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query; // frontend should send ?userId=
    const interviews = await Interview.find({ userId });
    res.json(interviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Note: Interview creation is handled in server.js at /api/interviews
// This route is kept for other interview operations like GET and DELETE

// ✅ Delete interview by ID
router.delete("/:id", async (req, res) => {
  try {
    const deletedInterview = await Interview.findByIdAndDelete(req.params.id);
    if (!deletedInterview) {
      return res.status(404).json({ message: "Interview not found" });
    }
    res.status(200).json({ message: "Interview deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
