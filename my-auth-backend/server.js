// server.js

require("dotenv").config({ path: __dirname + "/.env" });
console.log("Loaded GROQ_API_KEY:", process.env.GROQ_API_KEY);

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const http = require("http");
const { Server } = require("socket.io");
const axios = require("axios");
const { TextToSpeechClient } = require("@google-cloud/text-to-speech");
const Groq = require("groq-sdk");


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] },
});
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const googleTTSClient = new TextToSpeechClient();
const assemblyAIKey = process.env.ASSEMBLYAI_API_KEY;

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error(err));

app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"],
  methods: ["GET", "POST", "OPTIONS", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// ─── Import Models ────────────────────────────────────────────────────────────────
const User = require("./models/User");
const Interview = require("./models/Interview");

const TranscriptSchema = new mongoose.Schema({
  interviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Interview" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  company: String,
  role: String,
  level: String,
  transcriptData: mongoose.Schema.Types.Mixed,
  analysis: mongoose.Schema.Types.Mixed,
  questions: [{
    question: String,
    userResponse: String,
    evaluation: {
      rating: String,
      suggestion: String,
      correctness: String,
      clarityStructure: String,
      completeness: String,
      relevance: String,
      confidenceTone: String,
      communicationSkills: String,
      overallFeedback: String,
      modelAnswer: String,
      improvementSuggestions: String,
      keyPoints: String
    }
  }],
  createdAt: { type: Date, default: Date.now },
});
const Transcript = mongoose.model("Transcript", TranscriptSchema);

// ─── Auth Middleware ───────────────────────────────────────────────────────
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ message: "Token is missing" });
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
};

// ─── Auth Routes ───────────────────────────────────────────────────────────
app.post("/api/signup", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    if (await User.findOne({ email })) {
      return res.status(400).json({ message: "User already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();
    const token = jwt.sign(
      { userId: newUser._id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );
    res.status(201).json({ message: "User created", token });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/signin", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );
    res.json({ message: "Login successful", token });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});


// ─── Import Interview Routes ───────────────────────────────────────────
const interviewRoutes = require("./routes/interviews");
app.use("/api/interviews", interviewRoutes);

// ─── Import Get-Suggestion Route ───────────────────────────────────────
const getSuggestionRoute = require("./routes/get-suggestion");
app.use("/api/get-suggestion", getSuggestionRoute);

// ─── Start Interview ────────────────────────────────────────────────────────
app.post("/api/interviews", authenticateToken, async (req, res) => {
  const { company, level, role } = req.body;
  const interview = new Interview({
    company,
    level,
    role,
    userId: req.user.userId,
    userEmail: req.user.email,
    transcript: [{
      role: "system",
      content: `This is a mock interview for a ${role} position at ${company}, level: ${level}.`
    }],
  });
  await interview.save();
  res.status(201).json({
    message: "Interview started successfully!",
    interviewId: interview._id,
  });
});

// ─── DASHBOARD ENDPOINT ─────────────────────────────────────────────────
app.get("/api/dashboard", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get all interviews for the user
    const interviews = await Interview.find({ userId }).sort({ date: -1 });
    
    // Get all transcripts with evaluations
    const transcripts = await Transcript.find({ userId }).populate('interviewId');
    
    if (interviews.length === 0) {
      return res.json({
        totalInterviews: 0,
        averageScores: {
          correctness: 0,
          clarityStructure: 0,
          completeness: 0,
          relevance: 0,
          confidenceTone: 0,
          communicationSkills: 0,
          overall: 0,
        },
        trendsOverTime: { dates: [], scores: [] },
        roleDistribution: {},
        levelDistribution: {},
        companyDistribution: {},
      });
    }

    // Helper function to extract score from string
    const extractScore = (scoreStr) => {
      if (!scoreStr) return 0;
      const match = scoreStr.match(/(\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[1]) : 0;
    };

    // Calculate average scores across all interviews
    let totalScores = {
      correctness: 0,
      clarityStructure: 0,
      completeness: 0,
      relevance: 0,
      confidenceTone: 0,
      communicationSkills: 0,
    };
    let scoreCount = 0;

    // Aggregate scores from questions
    transcripts.forEach(transcript => {
      if (transcript.questions && transcript.questions.length > 0) {
        transcript.questions.forEach(question => {
          if (question.evaluation) {
            totalScores.correctness += extractScore(question.evaluation.correctness);
            totalScores.clarityStructure += extractScore(question.evaluation.clarityStructure);
            totalScores.completeness += extractScore(question.evaluation.completeness);
            totalScores.relevance += extractScore(question.evaluation.relevance);
            totalScores.confidenceTone += extractScore(question.evaluation.confidenceTone);
            totalScores.communicationSkills += extractScore(question.evaluation.communicationSkills);
            scoreCount++;
          }
        });
      }
    });

    // Calculate averages
    const averageScores = {
      correctness: scoreCount > 0 ? totalScores.correctness / scoreCount : 0,
      clarityStructure: scoreCount > 0 ? totalScores.clarityStructure / scoreCount : 0,
      completeness: scoreCount > 0 ? totalScores.completeness / scoreCount : 0,
      relevance: scoreCount > 0 ? totalScores.relevance / scoreCount : 0,
      confidenceTone: scoreCount > 0 ? totalScores.confidenceTone / scoreCount : 0,
      communicationSkills: scoreCount > 0 ? totalScores.communicationSkills / scoreCount : 0,
    };

    averageScores.overall = Object.values(averageScores).reduce((a, b) => a + b, 0) / 6;

    // Calculate trends over time
    const trendsOverTime = {
      dates: [],
      scores: [],
    };

    interviews.forEach(interview => {
      const transcript = transcripts.find(t => t.interviewId && t.interviewId._id.toString() === interview._id.toString());
      if (transcript && transcript.questions && transcript.questions.length > 0) {
        const interviewAvg = transcript.questions.reduce((sum, q) => {
          if (q.evaluation) {
            const scores = [
              extractScore(q.evaluation.correctness),
              extractScore(q.evaluation.clarityStructure),
              extractScore(q.evaluation.completeness),
              extractScore(q.evaluation.relevance),
              extractScore(q.evaluation.confidenceTone),
              extractScore(q.evaluation.communicationSkills),
            ];
            return sum + (scores.reduce((a, b) => a + b, 0) / 6);
          }
          return sum;
        }, 0) / transcript.questions.length;

        trendsOverTime.dates.push(new Date(interview.date).toLocaleDateString());
        trendsOverTime.scores.push(interviewAvg);
      }
    });

    // Calculate distributions
    const roleDistribution = {};
    const levelDistribution = {};
    const companyDistribution = {};

    interviews.forEach(interview => {
      roleDistribution[interview.role] = (roleDistribution[interview.role] || 0) + 1;
      levelDistribution[interview.level] = (levelDistribution[interview.level] || 0) + 1;
      companyDistribution[interview.company] = (companyDistribution[interview.company] || 0) + 1;
    });

    res.json({
      totalInterviews: interviews.length,
      averageScores,
      trendsOverTime,
      roleDistribution,
      levelDistribution,
      companyDistribution,
    });

  } catch (error) {
    console.error("❌ Dashboard error:", error);
    res.status(500).json({ message: "Failed to fetch dashboard data" });
  }
});

// ─── OVERALL EVALUATION ENDPOINT ─────────────────────────────────────────────
app.post("/api/evaluate", authenticateToken, async (req, res) => {
  const { conversationHistory = [] } = req.body;
  if (!Array.isArray(conversationHistory)) {
    return res.status(400).json({ message: "Bad payload: conversationHistory array required" });
  }

  try {
    // Filter only the user messages
    const userMessages = conversationHistory
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join("\n\n---\n\n");

    const evaluationPrompt = `
Evaluate the candidate's overall performance across all answers.

Provide a score out of 10 and a short explanation for each of the following categories:
• Correctness
• Clarity & Structure
• Completeness
• Relevance
• Confidence & Tone
• Communication Skills

Use this exact format:
• Correctness: 6/10 – The answer is mostly accurate but lacks depth...
• Clarity & Structure: 5/10 – Response structure is unclear...
• Completeness: 4/10 – Missing key details...
• Relevance: 7/10 – Answers are relevant to the questions...
• Confidence & Tone: 6/10 – Shows moderate confidence...
• Communication Skills: 5/10 – Communication could be clearer...

Overall Feedback: (1-paragraph summary)
`;

    const evaluationResp = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: evaluationPrompt },
        { role: "user", content: `Candidate responses:\n\n${userMessages}` }
      ],
      temperature: 0.3,
    });

    const evaluation = evaluationResp.choices[0].message.content;
    res.json({ evaluation });
  } catch (err) {
    console.error("❌ Evaluation error:", err);
    res.status(500).json({ message: "Evaluation failed" });
  }
});

// ─── SAVE PER-QUESTION EVALUATION ─────────────────────────────────────────────
app.post("/api/save-question-evaluation", authenticateToken, async (req, res) => {
  try {
    const { interviewId: interviewIdFromBody, question, userResponse, evaluation } = req.body;
    const userId = req.user.userId;

    if (!question || !userResponse || !evaluation) {
      return res.status(400).json({ message: "question, userResponse, and evaluation are required" });
    }

    // Resolve interview
    let interview = null;
    if (interviewIdFromBody) {
      interview = await Interview.findOne({ _id: interviewIdFromBody, userId });
    }
    if (!interview) {
      interview = await Interview.findOne({ userId }).sort({ date: -1 });
    }
    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    // Find or create transcript
    let transcript = await Transcript.findOne({ interviewId: interview._id, userId });
    if (!transcript) {
      transcript = new Transcript({
        interviewId: interview._id,
        userId,
        company: interview.company,
        role: interview.role,
        level: interview.level,
        transcriptData: [],
        analysis: {},
        questions: [],
      });
    }

    transcript.questions.push({
      question,
      userResponse,
      evaluation: {
        rating: evaluation.Rating || "",
        suggestion: evaluation.Suggestion || evaluation["Overall Feedback Summary"] || "",
        correctness: evaluation.Correctness?.score || "",
        clarityStructure: evaluation["Clarity & Structure"]?.score || "",
        completeness: evaluation.Completeness?.score || "",
        relevance: evaluation.Relevance?.score || "",
        confidenceTone: evaluation["Confidence & Tone"]?.score || "",
        communicationSkills: evaluation["Communication Skills"]?.score || "",
        overallFeedback: evaluation["Overall Feedback Summary"] || "",
        modelAnswer: evaluation["Model Answer"] || "",
        improvementSuggestions: evaluation["Improvement Suggestions"] || "",
        keyPoints: evaluation["Key Points"] || "",
      },
    });

    await transcript.save();
    res.json({ message: "Question evaluation saved successfully", interviewId: interview._id });
  } catch (err) {
    console.error("❌ Save question evaluation failed:", err);
    res.status(500).json({ message: "Failed to save question evaluation" });
  }
});


// ─── SAVE TRANSCRIPT + ANALYSIS ─────────────────────────────────────────────
app.post(
  "/api/interviewTranscript",
  authenticateToken,
  async (req, res) => {
    const userId = req.user.userId;
    const { transcriptData, analysis, interviewId } = req.body;

    if (!transcriptData) {
      return res.status(400).json({ message: "transcriptData is required" });
    }
    if (!analysis) {
      return res.status(400).json({ message: "analysis is required" });
    }

    try {
      // Determine which interview to attach to
      let interview;
      if (interviewId) {
        interview = await Interview.findOne({ _id: interviewId, userId });
      }
      if (!interview) {
        interview = await Interview.findOne({ userId }).sort({ date: -1 });
      }
      if (!interview) {
        return res.status(404).json({ message: "No interview found for this user" });
      }

      // Upsert transcript for this interview
      let transcript = await Transcript.findOne({ interviewId: interview._id, userId });
      if (!transcript) {
        transcript = new Transcript({
          interviewId: interview._id,
          userId,
          company: interview.company,
          role: interview.role,
          level: interview.level,
          transcriptData,
          analysis,
          questions: [],
        });
      } else {
        transcript.transcriptData = transcriptData;
        transcript.analysis = analysis;
      }

      await transcript.save();

      res.status(201).json({
        message: "Transcript saved successfully",
        transcriptId: transcript._id,
        interviewDetails: {
          interviewId: interview._id,
          company: interview.company,
          role: interview.role,
          level: interview.level,
        },
      });
    } catch (error) {
      console.error("❌ Error saving transcript:", error);
      res.status(500).json({ message: "Failed to save transcript" });
    }
  }
);

// ─── Existing Interview Audio + TTS ────────────────────────────────────────
app.post("/api/interview/intro", authenticateToken, async (req, res) => {
  const { company, level, role } = req.body;
  console.log("👀 Intro Variables:", { company, level, role });



  if (!company || !level || !role) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const prompt = `
You are Rachel, a professional and friendly mock interviewer.

Candidate interview details:
- Company: ${company}
- Role: ${role}
- Level: ${level}

Begin the interview by greeting the candidate. Clearly state:
• The role: "${role}"
• The level: "${level}"
• The company: "${company}"

Say it as: "This is a ${level} level interview for the ${role} position at ${company}."

Ask how they are doing. Keep it under 3 sentences.

Do not introduce yourself as the candidate.
Do not make up extra information about the company.
Do not ask anything unrelated to the role, level, or company.
`;



    console.log("🧠 Final Prompt Sent to Groq:\n", prompt);


    const groqResponse = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: prompt,
        },
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
      presence_penalty: 1.0,
      frequency_penalty: 0.7,
    });

    const openingLine = groqResponse.choices[0].message.content;

    const [ttsResponse] = await googleTTSClient.synthesizeSpeech({
      input: { text: openingLine },
      voice: { languageCode: "en-US", name: "en-US-Neural2-F" },
      audioConfig: { audioEncoding: "MP3" },
    });

    const audioBase64 = Buffer.from(ttsResponse.audioContent).toString("base64");
    res.status(200).json({ text: openingLine, audio: audioBase64 });
  } catch (err) {
    console.error("❌ /intro error:", err.message);
    console.error("❌ Full error:", err);
    res.status(500).json({ message: "Failed to generate intro", error: err.message });
  }
});

function parseEvaluationText(raw) {
  const result = {};
  const lines = raw.split("\n");

  let capturingOverall = false;
  let overallText = "";
  let capturingModelAnswer = false;
  let capturingImprovements = false;
  let capturingKeyPoints = false;
  let capturingRating = false;
  let capturingSuggestion = false;
  let modelAnswerText = "";
  let improvementsText = "";
  let keyPointsText = "";
  let ratingText = "";
  let suggestionText = "";

  const normalizeKey = (key) => {
    const normalized = key.toLowerCase().replace(/&/g, "and").trim();
    if (normalized.includes("clarity")) return "Clarity & Structure";
    if (normalized.includes("confidence")) return "Confidence & Tone";
    if (normalized.includes("communication")) return "Communication Skills";
    if (normalized.includes("correctness")) return "Correctness";
    if (normalized.includes("completeness")) return "Completeness";
    if (normalized.includes("relevance")) return "Relevance";
    return key.trim();
  };

  for (const line of lines) {
    const match = line.match(/^•?\s*(.+?):\s*(\d+)\/10\s*[–-]?\s*(.*)$/i);
    if (match) {
      const key = normalizeKey(match[1]);
      const score = `${match[2]}/10`;
      const explanation = match[3]?.trim() || "";
      result[key] = { score, explanation };
      continue;
    }

    if (line.toLowerCase().startsWith("overall feedback")) {
      capturingOverall = true;
      capturingModelAnswer = false;
      capturingImprovements = false;
      capturingKeyPoints = false;
      overallText = line.split(":").slice(1).join(":").trim();
      continue;
    }

    if (line.toLowerCase().startsWith("model answer")) {
      capturingOverall = false;
      capturingModelAnswer = true;
      capturingImprovements = false;
      capturingKeyPoints = false;
      modelAnswerText = line.split(":").slice(1).join(":").trim();
      continue;
    }

    if (line.toLowerCase().startsWith("improvement suggestions")) {
      capturingOverall = false;
      capturingModelAnswer = false;
      capturingImprovements = true;
      capturingKeyPoints = false;
      improvementsText = line.split(":").slice(1).join(":").trim();
      continue;
    }

    if (line.toLowerCase().startsWith("key points")) {
      capturingOverall = false;
      capturingModelAnswer = false;
      capturingImprovements = false;
      capturingKeyPoints = true;
      capturingRating = false;
      capturingSuggestion = false;
      keyPointsText = line.split(":").slice(1).join(":").trim();
      continue;
    }

    if (line.toLowerCase().startsWith("rating")) {
      capturingOverall = false;
      capturingModelAnswer = false;
      capturingImprovements = false;
      capturingKeyPoints = false;
      capturingRating = true;
      capturingSuggestion = false;
      ratingText = line.split(":").slice(1).join(":").trim();
      continue;
    }

    if (line.toLowerCase().startsWith("suggestion")) {
      capturingOverall = false;
      capturingModelAnswer = false;
      capturingImprovements = false;
      capturingKeyPoints = false;
      capturingRating = false;
      capturingSuggestion = true;
      suggestionText = line.split(":").slice(1).join(":").trim();
      continue;
    }

    if (capturingOverall) {
      if (line.trim() === "") break;
      overallText += " " + line.trim();
    }

    if (capturingModelAnswer) {
      if (line.trim() === "") break;
      modelAnswerText += " " + line.trim();
    }

    if (capturingImprovements) {
      if (line.trim() === "") break;
      improvementsText += " " + line.trim();
    }

    if (capturingKeyPoints) {
      if (line.trim() === "") break;
      keyPointsText += " " + line.trim();
    }

    if (capturingRating) {
      if (line.trim() === "") break;
      ratingText += " " + line.trim();
    }

    if (capturingSuggestion) {
      if (line.trim() === "") break;
      suggestionText += " " + line.trim();
    }
  }

  if (overallText) {
    result["Overall Feedback Summary"] = overallText.trim();
  }

  if (modelAnswerText) {
    result["Model Answer"] = modelAnswerText.trim();
  }

  if (improvementsText) {
    result["Improvement Suggestions"] = improvementsText.trim();
  }

  if (keyPointsText) {
    result["Key Points"] = keyPointsText.trim();
  }

  if (ratingText) {
    result["Rating"] = ratingText.trim();
  }

  if (suggestionText) {
    result["Suggestion"] = suggestionText.trim();
  }

  return result;
}





app.post("/api/interview/audio", async (req, res) => {
  const { base64Audio, userTranscript, conversationHistory = [], role, company, level } = req.body;

  // Check if we have either audio or text input
  if (!base64Audio && !userTranscript) {
    return res.status(400).json({ message: "No audio data or text input provided" });
  }

  try {
    let transcript = "";

    // Handle text input or audio transcription
    if (userTranscript) {
      // Use provided text directly
      transcript = userTranscript;
      console.log("📝 Using text input:", transcript);
    } else if (base64Audio) {
      // Process audio with AssemblyAI
      console.log("🎤 Processing audio input");

      // 1. Upload to AssemblyAI
      const uploadResp = await axios.post(
        "https://api.assemblyai.com/v2/upload",
        Buffer.from(base64Audio, "base64"),
        {
          headers: {
            authorization: assemblyAIKey,
            "Content-Type": "application/octet-stream",
          },
        }
      );
      const audioUrl = uploadResp.data.upload_url;

      // 2. Request transcription
      const { id: transcriptId } = (
        await axios.post(
          "https://api.assemblyai.com/v2/transcript",
          {
            audio_url: audioUrl,
            punctuate: true,
            format_text: true,
            speaker_labels: false,
            language_code: "en_us",
            word_boost: ["you", "data", "science", "EDA", "model"],
            boost_param: "high",
            disfluencies: false,
          },
          { headers: { authorization: assemblyAIKey } }
        )
      ).data;

      // 3. Poll until complete
      while (true) {
        const status = (
          await axios.get(
            `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
            { headers: { authorization: assemblyAIKey } }
          )
        ).data;
        if (status.status === "completed") {
          transcript = status.text;
          break;
        }
        if (status.status === "failed") {
          return res.status(500).json({ message: "Transcription failed" });
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // User TTS removed - only AI interviewer will speak

    // 5. Append user transcript if new
    const messages = [...conversationHistory];
    if (transcript && !messages.some((m) => m.role === "user" && m.content === transcript)) {
      messages.push({ role: "user", content: transcript });
    }

    // 6. Ask the LLM for the next question
    const groqResponse = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `
You are a professional and friendly mock interviewer.

You are interviewing a candidate for the role of **${role}** at **${company}**, specifically for a **Level ${level}** position.

Your task:
- Ask one realistic, relevant, and technical interview question.
- Tailor the question to the domain or expected responsibilities of ${company}, if known (e.g., autonomous driving, robotics, etc.).
- Consider the candidate's last response and keep the conversation flowing naturally.
- DO NOT say phrases like “Here's your next question” or “Let’s begin with…”
- DO NOT give feedback or commentary. Only ask the question.
- Keep the question concise (1–2 sentences). It should sound like it’s from a real human interviewer.
`,
        },
        ...messages,
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
      presence_penalty: 1.0,
      frequency_penalty: 0.7,
    });
    const aiResponse = groqResponse.choices[0].message.content;

    // 7. Per-question evaluation with detailed feedback
    let evaluation = null;
    if (transcript) {
      const evalPrompt = `
Evaluate the following candidate response for a ${role} position at ${company} (Level: ${level}):

"${transcript}"

For each of the following categories:
• Correctness
• Clarity & Structure
• Completeness
• Relevance
• Confidence & Tone
• Communication Skills

Give a score out of 10 **and a one-sentence explanation** of that score.

Return your response in this exact format:

• Correctness: 6/10 — Explanation of the score
• Clarity & Structure: 5/10 — Explanation of the score
• Completeness: 4/10 — Explanation of the score
• Relevance: 5/10 — Explanation of the score
• Confidence & Tone: 7/10 — Explanation of the score
• Communication Skills: 6/10 — Explanation of the score

Overall Feedback: A short paragraph summarizing the strengths and areas for improvement.

IMPORTANT: Provide a concise rating and specific suggestion for this response:

Rating: [Choose from: Excellent, Good, Satisfactory, Needs Improvement, Poor]
Suggestion: [2-3 sentences with specific, actionable advice for improvement]

Model Answer: [Provide a comprehensive, well-structured response]
Improvement Suggestions: [List 2-3 specific ways to improve]
Key Points: [List 3-5 important concepts they should mention]
`;

      const evalResp = await groq.chat.completions.create({
        messages: [{ role: "system", content: evalPrompt }],
        model: "llama-3.1-8b-instant",
        temperature: 0.3,
      });
      evaluation = evalResp.choices[0].message.content;
    }

    // 8. TTS for AI question
    const [ttsResp] = await googleTTSClient.synthesizeSpeech({
      input: { text: aiResponse },
      voice: { languageCode: "en-US", name: "en-US-Neural2-F" },
      audioConfig: { audioEncoding: "MP3" },
    });
    const audioBase64 = Buffer.from(ttsResp.audioContent).toString("base64");

    // 9. Parse evaluation and return response
    const structuredEvaluation =
      typeof evaluation === "string" ? parseEvaluationText(evaluation) : evaluation;
    console.log("📝 Raw Evaluation Response:", evaluation);
    console.log("🧪 Parsed Evaluation:", structuredEvaluation);
    res.status(200).json({
      userTranscript: transcript,
      text: aiResponse,
      audio: audioBase64,
      evaluation: structuredEvaluation,
    });
  } catch (error) {
    console.error("❌ Audio processing error:", error);
    res.status(500).json({ message: "Audio processing failed" });
  }
}); // ✅ DO NOT FORGET THIS CLOSING LINE


//////Dashboard backend
// ─── BACKEND: GET All Transcripts for Logged-In User ───────────────────────────

app.get("/api/my-interviews", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const transcripts = await Transcript.find({ userId })
      .sort({ createdAt: -1 })
      .select("company role level createdAt analysis transcriptData questions");

    res.json({ interviews: transcripts });
  } catch (err) {
    console.error("❌ Fetch interviews failed:", err);
    res.status(500).json({ message: "Failed to fetch interview history" });
  }
});

// Save per-question evaluation
app.post("/api/save-question-evaluation", authenticateToken, async (req, res) => {
  try {
    const { interviewId: interviewIdFromBody, question, userResponse, evaluation } = req.body;
    const userId = req.user.userId;

    if (!question || !userResponse || !evaluation) {
      return res.status(400).json({ message: "question, userResponse, and evaluation are required" });
    }

    // Resolve interview to attach to (fallback to latest if id not provided)
    let interview;
    if (interviewIdFromBody) {
      interview = await Interview.findOne({ _id: interviewIdFromBody, userId });
    }
    if (!interview) {
      interview = await Interview.findOne({ userId }).sort({ date: -1 });
    }
    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    // Try to find existing transcript for this interview
    let transcript = await Transcript.findOne({ interviewId: interview._id, userId });

    // If not found, create one from Interview details (upsert behavior)
    if (!transcript) {
      transcript = new Transcript({
        interviewId: interview._id,
        userId,
        company: interview.company,
        role: interview.role,
        level: interview.level,
        transcriptData: [],
        analysis: {},
        questions: [],
      });
    }

    transcript.questions.push({
      question,
      userResponse,
      evaluation: {
        rating: evaluation.Rating || "",
        suggestion: suggestion,
        correctness: evaluation.Correctness?.score || "",
        clarityStructure: evaluation["Clarity & Structure"]?.score || "",
        completeness: evaluation.Completeness?.score || "",
        relevance: evaluation.Relevance?.score || "",
        confidenceTone: evaluation["Confidence & Tone"]?.score || "",
        communicationSkills: evaluation["Communication Skills"]?.score || "",
        overallFeedback: evaluation["Overall Feedback Summary"] || "",
        modelAnswer: evaluation["Model Answer"] || "",
        improvementSuggestions: evaluation["Improvement Suggestions"] || "",
        keyPoints: evaluation["Key Points"] || "",
      },
    });

    await transcript.save();
    res.json({ message: "Question evaluation saved successfully", interviewId: interview._id });
  } catch (err) {
    console.error("❌ Save question evaluation failed:", err);
    res.status(500).json({ message: "Failed to save question evaluation" });
  }
});




const PORT = process.env.PORT || 5002;
server.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
