const express = require("express");
const Groq = require("groq-sdk");
const router = express.Router();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Function to generate suggestions
async function generateSuggestion(question, answer) {
  const prompt = `
You are an interview coach. 
The user was asked the following interview question:

Question: ${question}
Answer: ${answer}

Please provide a clear, constructive improvement suggestion for the user's answer. 
Make it concise, actionable, and in plain English. 
Do NOT give a rating, just feedback on how they can improve.
`;

  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content || "No suggestion generated.";
}

// API endpoint
router.post("/", async (req, res) => {
  try {
    const { question, answer } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ message: "Question and answer are required" });
    }

    const suggestion = await generateSuggestion(question, answer);
    res.json({ suggestion });
  } catch (err) {
    console.error("❌ Suggestion error:", err);
    res.status(500).json({ message: "Failed to generate suggestion" });
  }
});

module.exports = router;
