"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function MockInterviewPage() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcripts, setTranscripts] = useState<{ role: string; text: string }[]>([]);
  const [conversationHistory, setConversationHistory] = useState<{ role: string; content: string }[]>([]);
  const [textAnswer, setTextAnswer] = useState("");
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const introAttempted = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);


  const stopCurrentAudio = () => {
    const a = currentAudioRef.current;
    if (a) {
      try { a.pause(); } catch { }
      try { a.src = ""; a.load(); } catch { }
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
  };

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      try { stopCurrentAudio(); } catch { }
    };
  }, []);

  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [level, setLevel] = useState("");
  const [interviewId, setInterviewId] = useState<string | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    setRole(decodeURIComponent(searchParams.get("role") || "").trim());
    setCompany(decodeURIComponent(searchParams.get("company") || "").trim());
    setLevel(decodeURIComponent(searchParams.get("level") || "").trim());
    const id = searchParams.get("interviewId");
    setInterviewId(id);
  }, []);


  useEffect(() => {
    if (!role || !company || !level) return;
    if (role === "" || company === "" || level === "") {
      alert("Missing required interview details. Please start from the form.");
      router.push("/auth/interview-form");
    }
  }, [role, company, level]);


  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcripts]);

  useEffect(() => {
    if (!introAttempted.current && role && company && level) {
      introAttempted.current = true;
      fetchIntro();
    }
  }, [role, company, level]);

  async function fetchIntro() {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5002/api/interview/intro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ company, role, level })
      });
      const data = await res.json();
      if (data.text) {
        setTranscripts([{ role: "Interviewer", text: data.text }]);
        setConversationHistory([{ role: "assistant", content: data.text }]);
      }
      if (data.audio) {
        stopCurrentAudio();
        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
        currentAudioRef.current = audio;
        audio.onplay = () => setIsSpeaking(true);
        audio.onended = () => { setIsSpeaking(false); currentAudioRef.current = null; };
        try {
          await audio.play();
        } catch (err) {
          console.log("Audio autoplay blocked - user interaction required");
          // Audio will be available but won't autoplay due to browser policy
        }
      }
      setHasStarted(true);
    } catch (err) {
      console.error("Intro fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      let audioChunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size) audioChunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunks, { type: recorder.mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64 = reader.result!.toString().split(",")[1];
          setTranscripts((t) => [...t, { role: "System", text: "🤖 Processing your response..." }]);

          try {
            const filteredHistory = conversationHistory.filter((m) => m.content?.trim());

            const res = await fetch("http://localhost:5002/api/interview/audio", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                base64Audio: base64,
                conversationHistory: filteredHistory,
                role,
                company,
                level,
              }),
            });

            const data = await res.json();

            // Debug: Log the response data
            console.log("🎤 API Response:", {
              userTranscript: data.userTranscript,
              text: data.text,
              audio: data.audio ? "Available" : "Not available"
            });

            // Add user response immediately
            setTranscripts((t) =>
              t.filter((m) => m.text !== "🤖 Processing your response...").concat(
                { role: "User", text: data.userTranscript }
              )
            );

            // Add thinking indicator
            setTranscripts((t) => [...t, { role: "System", text: "🤔 Interviewer is thinking..." }]);

            // Add AI response with delay to sync with voice
            setTimeout(() => {
              setTranscripts((t) =>
                t.filter((m) => m.text !== "🤔 Interviewer is thinking...").concat([
                  { role: "Interviewer", text: data.text }
                ])
              );
            }, 300); // Same delay as voice transition

            // Determine the question the user answered (last assistant message before this answer)
            const lastAssistant = filteredHistory.slice().reverse().find((m) => m.role === "assistant")?.content || "";

            setConversationHistory((h) => [
              ...h,
              { role: "user", content: data.userTranscript },
              { role: "assistant", content: data.text },
            ]);

            // Save per-question evaluation (audio input)
            if (data.evaluation && data.userTranscript) {
              try {
                const token = localStorage.getItem("token");
                await fetch("http://localhost:5002/api/save-question-evaluation", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    interviewId: interviewId || undefined,
                    question: lastAssistant || "",
                    userResponse: data.userTranscript,
                    evaluation: data.evaluation,
                  }),
                });
              } catch (err) {
                console.error("Failed to save question evaluation:", err);
              }
            }

            // Play AI interviewer's response (user TTS removed)
            if (data.audio) {
              stopCurrentAudio();
              const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
              currentAudioRef.current = audio;
              audio.onplay = () => setIsSpeaking(true);
              audio.onended = () => { setIsSpeaking(false); currentAudioRef.current = null; };
              try {
                await audio.play();
              } catch (err) {
                console.log("Audio autoplay blocked - user interaction required");
              }
            }
          } catch (err) {
            console.error("Audio processing error:", err);
            setTranscripts((t) =>
              t.filter((m) => m.text !== "🤖 Processing your response...").concat({
                role: "System",
                text: "⚠️ Failed to process audio.",
              })
            );
          }
        };
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      // Optional: Auto-stop after 15 seconds
  //   setTimeout(() => {
      // if (recorder.state === "recording") {
      //  recorder.stop();
      //  setIsRecording(false);
      //}
    // }, 15000);
    } catch {
      alert("⚠️ Please allow microphone access and try again.");
    }
  };

  const handleStop = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state === "recording") {
      rec.stop(); // ⬅️ This will trigger recorder.onstop() from handleRecord
      setIsRecording(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!textAnswer.trim()) {
      alert("Please enter your answer before submitting.");
      return;
    }

    setIsSubmitting(true);
    setTranscripts((t) => [...t, { role: "System", text: "🤖 Processing your response..." }]);

    try {
      const filteredHistory = conversationHistory.filter((m) => m.content?.trim());

      const res = await fetch("http://localhost:5002/api/interview/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64Audio: null, // No audio for text input
          userTranscript: textAnswer.trim(), // Send the typed text directly
          conversationHistory: filteredHistory,
          role,
          company,
          level,
        }),
      });

      const data = await res.json();

      // Debug: Log the response data
      console.log("🎤 API Response:", {
        userTranscript: data.userTranscript,
        text: data.text,
        audio: data.audio ? "Available" : "Not available"
      });

      // Clear the text input first
      setTextAnswer("");

      // Add user response immediately
      setTranscripts((t) =>
        t.filter((m) => m.text !== "🤖 Processing your response...").concat(
          { role: "User", text: textAnswer.trim() }
        )
      );

      // Add thinking indicator
      setTranscripts((t) => [...t, { role: "System", text: "🤔 Interviewer is thinking..." }]);

      // Add AI response with delay to sync with voice
      setTimeout(() => {
        setTranscripts((t) =>
          t.filter((m) => m.text !== "🤔 Interviewer is thinking...").concat([
            { role: "Interviewer", text: data.text }
          ])
        );
      }, 300); // Same delay as voice transition

      // Determine the question the user answered (last assistant message before this answer)
      const lastAssistant = filteredHistory.slice().reverse().find((m) => m.role === "assistant")?.content || "";

      setConversationHistory((h) => [
        ...h,
        { role: "user", content: textAnswer.trim() },
        { role: "assistant", content: data.text },
      ]);

      // Save per-question evaluation (text input)
      if (data.evaluation && textAnswer.trim()) {
        try {
          const token = localStorage.getItem("token");
          await fetch("http://localhost:5002/api/save-question-evaluation", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              interviewId: interviewId || undefined,
              question: lastAssistant || "",
              userResponse: textAnswer.trim(),
              evaluation: data.evaluation
            }),
          });
        } catch (err) {
          console.error("Failed to save question evaluation:", err);
        }
      }

      // Play AI interviewer's response (user TTS removed)
      if (data.audio) {
        stopCurrentAudio();
        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
        currentAudioRef.current = audio;
        audio.onplay = () => setIsSpeaking(true);
        audio.onended = () => { setIsSpeaking(false); currentAudioRef.current = null; };
        try {
          await audio.play();
        } catch (err) {
          console.log("Audio autoplay blocked - user interaction required");
        }
      }
    } catch (err) {
      console.error("Text processing error:", err);
      setTranscripts((t) =>
        t.filter((m) => m.text !== "🤖 Processing your response...").concat({
          role: "System",
          text: "⚠️ Failed to process text response.",
        })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearTranscript = () => {
    stopCurrentAudio();
    setTranscripts([]);
    setConversationHistory([]);
    introAttempted.current = false;
    fetchIntro();
  };

  const handleEndInterview = async () => {
    // Stop any ongoing audio immediately
    stopCurrentAudio();
    const token = localStorage.getItem("token");

    try {
      const evalRes = await fetch("http://localhost:5002/api/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ conversationHistory }),
      });

      if (!evalRes.ok) throw new Error("Evaluation failed");
      const { evaluation } = await evalRes.json();

      const parseEvaluation = (text: string) => {
        const result: Record<string, any> = {};
        const lines = text.split("\n");

        const metricMap: Record<string, string> = {
          correctness: "Correctness",
          "clarity & structure": "Clarity & Structure",
          completeness: "Completeness",
          relevance: "Relevance",
          "confidence & tone": "Confidence & Tone",
          "communication skills": "Communication Skills"
        };

        for (const line of lines) {
          const scoreMatch = line.match(/^•?\s*(.+?):\s*(\d+)\/10\s*[-–]\s*(.+)/i);
          if (scoreMatch) {
            const rawKey = scoreMatch[1].trim().toLowerCase();
            const score = `${scoreMatch[2]}/10`;
            const explanation = scoreMatch[3].trim();
            const normalized = metricMap[rawKey];
            if (normalized) result[normalized] = { score, explanation };
          }

          if (line.toLowerCase().startsWith("overall feedback")) {
            result["Overall Feedback Summary"] = line.split(":").slice(1).join(":").trim();
          }
        }

        return result;
      };


      const structuredEvaluation =
        typeof evaluation === "string" ? parseEvaluation(evaluation) : evaluation;

      // ✅ Add Scores field dynamically
      const categories = [
        "Correctness",
        "Clarity & Structure",
        "Completeness",
        "Relevance",
        "Confidence & Tone",
        "Communication Skills",
      ];

      const scoreLines = categories
        .map((key) => {
          const val = structuredEvaluation[key];
          let scoreStr = typeof val === "string" ? val : val?.score;
          const match = scoreStr?.match(/(\d+(?:\.\d+)?)\/10/);
          return match ? `${key}: ${match[1]}/10` : `${key}: 0/10`;
        })
        .join("\n");

      structuredEvaluation["Scores"] = scoreLines;

      const saveRes = await fetch("http://localhost:5002/api/interviewTranscript", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          transcriptData: conversationHistory,
          analysis: structuredEvaluation,
          interviewId: interviewId || undefined,
        }),
      });

      if (!saveRes.ok) throw new Error("Save failed");

      console.log("✅ Transcript and evaluation saved!");
      // Ensure audio is stopped before navigating
      stopCurrentAudio();
      router.push("/auth/thankyou");
    } catch (err) {
      console.error("❌ End Interview error:", err);
      alert("Something went wrong while ending the interview.");
    }
  };


  return (
    <div className="h-screen w-full bg-gradient-to-br from-gray-900 via-blue-900 to-black flex">
      <div className="relative w-3/4 flex items-center justify-center p-6 overflow-hidden">
        {isSpeaking && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none w-full h-full">
            <div className="relative w-64 h-64 flex items-center justify-center">
              <div className="absolute w-96 h-96 bg-gradient-radial from-white/20 via-indigo-400/10 to-transparent rounded-full blur-3xl opacity-30 animate-spin-slow z-0"></div>
              <div className="absolute w-24 h-24 bg-gradient-to-br from-fuchsia-600 via-indigo-500 to-cyan-400 rounded-full shadow-2xl animate-glowPulse"></div>
              <div className="absolute w-36 h-36 bg-purple-500 blur-2xl opacity-40 rounded-full animate-pulseFast"></div>
              <div className="absolute w-48 h-48 border border-cyan-300/30 rounded-full animate-wavePing1"></div>
              <div className="absolute w-64 h-64 border border-fuchsia-400/20 rounded-full animate-wavePing2">
                <div className="absolute w-64 h-64 flex items-center justify-center animate-spin-slow">
                  <div className="w-2 h-2 bg-white rounded-full absolute top-0 left-1/2 transform -translate-x-1/2 blur-sm opacity-80"></div>
                  <div className="w-1.5 h-1.5 bg-cyan-300 rounded-full absolute bottom-0 left-1/2 transform -translate-x-1/2 blur-sm opacity-70"></div>
                </div>
              </div>
              <div className="absolute w-80 h-80 bg-gradient-radial from-purple-500/10 to-transparent rounded-full blur-2xl opacity-60"></div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="absolute bottom-20 w-full px-12">
          {/* Input Mode Toggle */}
          <div className="flex justify-center mb-4">
            <div className="bg-white/20 backdrop-blur-md rounded-xl p-1 flex">
              <button
                onClick={() => setInputMode("voice")}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${inputMode === "voice"
                    ? "bg-white text-gray-800 shadow-md"
                    : "text-white hover:bg-white/10"
                  }`}
              >
                🎙️ Voice
              </button>
              <button
                onClick={() => setInputMode("text")}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${inputMode === "text"
                    ? "bg-white text-gray-800 shadow-md"
                    : "text-white hover:bg-white/10"
                  }`}
              >
                ⌨️ Type
              </button>
            </div>
          </div>

          {/* Voice Controls */}
          {inputMode === "voice" && (
            <div className="flex justify-center gap-6">
              <button
                onClick={handleRecord}
                disabled={isRecording || isLoading}
                className={`px-6 py-3 rounded-xl text-white font-semibold ${isRecording || isLoading ? "bg-red-300" : "bg-red-600 hover:bg-red-700"
                  }`}
              >
                🎙 {isRecording ? "Recording..." : "Start Recording"}
              </button>
              <button
                onClick={handleStop}
                disabled={!isRecording}
                className={`px-6 py-3 rounded-xl text-white font-semibold ${!isRecording ? "bg-gray-400" : "bg-gray-600 hover:bg-gray-700"
                  }`}
              >
                ⏹ Stop
              </button>
            </div>
          )}

          {/* Text Input Controls */}
          {inputMode === "text" && (
            <div className="flex flex-col items-center gap-4">
              <textarea
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                placeholder="Type your answer here..."
                className="w-full max-w-2xl h-32 p-4 rounded-xl bg-white/90 backdrop-blur-md text-gray-800 placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                disabled={isSubmitting}
              />
              <button
                onClick={handleTextSubmit}
                disabled={isSubmitting || !textAnswer.trim()}
                className={`px-6 py-3 rounded-xl text-white font-semibold ${isSubmitting || !textAnswer.trim()
                    ? "bg-gray-400"
                    : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
              >
                {isSubmitting ? "📤 Submitting..." : "📤 Submit Answer"}
              </button>
            </div>
          )}

          {hasStarted && (
            <div className="absolute right-12 bottom-0">
              <button
                onClick={handleEndInterview}
                className="px-6 py-3 bg-red-700 hover:bg-red-800 text-white rounded-xl font-semibold"
              >
                🚪 End Interview
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Transcript panel */}
      <div className="w-1/4 bg-white/90 backdrop-blur-sm shadow-2xl p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Transcript</h2>
          <button onClick={handleClearTranscript} className="text-sm text-blue-600 hover:underline">
            Restart Interview
          </button>
        </div>
        <div ref={transcriptRef} className="space-y-3 max-h-[calc(100vh-8rem)] overflow-y-auto">
          {transcripts.map((t, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg shadow-sm ${t.role === "User"
                  ? "bg-teal-100 text-teal-800"
                  : t.role === "Interviewer"
                    ? "bg-gray-200 text-gray-800"
                    : "bg-gray-100 text-gray-800"
                }`}
            >
              <strong>{t.role === "Interviewer" ? "Interviewer" : t.role}:</strong> {t.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
