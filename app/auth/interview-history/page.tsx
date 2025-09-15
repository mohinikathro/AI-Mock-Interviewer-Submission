"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface EvaluationField {
  score: string;
  explanation: string;
}

interface EvaluationAnalysis {
  Correctness?: string | EvaluationField;
  "Clarity & Structure"?: string | EvaluationField;
  Completeness?: string | EvaluationField;
  Relevance?: string | EvaluationField;
  "Confidence & Tone"?: string | EvaluationField;
  "Communication Skills"?: string | EvaluationField;
  "Overall Feedback Summary"?: string;
  "Model Answer"?: string;
  "Improvement Suggestions"?: string;
  "Key Points"?: string;
  "Rating"?: string;
  "Suggestion"?: string;
  Scores?: string;
}

interface QuestionEvaluation {
  question: string;
  userResponse: string;
  evaluation: {
    rating: string;
    suggestion: string;
    correctness: string;
    clarityStructure: string;
    completeness: string;
    relevance: string;
    confidenceTone: string;
    communicationSkills: string;
    overallFeedback: string;
    modelAnswer: string;
    improvementSuggestions: string;
    keyPoints: string;
  };
}

interface Interview {
  _id: string;
  company: string;
  role: string;
  level: string;
  createdAt: string;
  analysis?: EvaluationAnalysis;
  questions?: QuestionEvaluation[];
}

export default function InterviewHistory() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [selected, setSelected] = useState<Interview | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch("http://localhost:5002/api/my-interviews", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setInterviews(data.interviews || []))
      .catch((err) => console.error("Failed to load interviews", err));
  }, []);

  const renderScore = (field?: string | EvaluationField) => {
    if (!field) return "N/A";
    if (typeof field === "string") return field;
    return (
      <span>
        <strong>{field.score}</strong> — {field.explanation}
      </span>
    );
  };

  const filterQuestions = (questions?: QuestionEvaluation[]) => {
    return (
      questions?.filter(
        (q) =>
          !q.question.toLowerCase().includes("welcome") &&
          !q.question.toLowerCase().includes("prepared for the interview")
      ) || []
    );
  };

  return (
    <div className="h-screen w-full bg-gradient-to-br from-gray-900 via-blue-900 to-black flex flex-col overflow-hidden">
      {/* Top Navigation */}
      <div className="flex justify-between items-center p-4 bg-white/10 backdrop-blur-md border-b border-white/20">
        <h1 className="text-2xl font-bold text-white">Interview History</h1>
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/auth/home")}
            className="px-3 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-cyan-600 text-white font-semibold shadow hover:brightness-110 transition text-sm"
          >
            🏠 Home
          </button>
          <button
            onClick={() => router.push("/auth/dashboard")}
            className="px-3 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold shadow hover:brightness-110 transition text-sm"
          >
            Dashboard
          </button>
          <button
            onClick={() => router.push("/auth/interview-form")}
            className="px-3 py-2 rounded-lg bg-gradient-to-r from-green-500 to-teal-600 text-white font-semibold shadow hover:brightness-110 transition text-sm"
          >
            Take Interview
          </button>
          <button
            onClick={() => {
              localStorage.removeItem("token");
              router.push("/auth/signin");
            }}
            className="px-3 py-2 rounded-lg bg-gradient-to-r from-red-500 to-pink-600 text-white font-semibold shadow hover:brightness-110 transition text-sm"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="w-1/3 bg-white/80 backdrop-blur-lg shadow-xl p-6 overflow-y-auto">
          <h2 className="text-xl font-bold text-gray-800 mb-4">My Interviews ({interviews.length})</h2>
          {interviews.map((item) => (
            <div
              key={item._id}
              onClick={() => setSelected(item)}
              className={`p-3 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors ${selected?._id === item._id ? 'bg-indigo-100 border-l-4 border-indigo-500' : ''
                }`}
            >
              <p className="font-semibold text-gray-800">{item.company}</p>
              <p className="text-sm text-gray-600">
                {item.role} — Level {item.level}
              </p>
              <p className="text-xs text-gray-500">
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* Right Panel */}
        <div className="w-2/3 p-8 overflow-y-auto text-white">
          {selected ? (
            <>
              <h2 className="text-3xl font-bold mb-2">
                {selected.company} — {selected.role} (Level {selected.level})
              </h2>
              <p className="mb-6 text-indigo-200">
                Interviewed on: {new Date(selected.createdAt).toLocaleString()}
              </p>

              {/* Per-Question Evaluations */}
              {filterQuestions(selected.questions).length > 0 ? (
                <div className="mb-8">
                  <h3 className="text-2xl font-bold mb-4 text-white">Interview Questions & Responses</h3>
                  <div className="space-y-6">
                    {filterQuestions(selected.questions).map((question, index) => (
                      <div key={index} className="bg-white/90 backdrop-blur-md rounded-xl p-6 shadow-md text-gray-800">
                        <div className="mb-4">
                          <h4 className="text-lg font-semibold text-indigo-800 mb-2">
                            ❓ Question {index + 1}: {question.question}
                          </h4>
                          <p className="text-gray-700 mb-4 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                            <strong>💬 Your response:</strong> {question.userResponse}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Suggestion */}
                          <div className="space-y-3">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <p className="font-semibold text-green-800">
                                💡 Suggestion: {question.evaluation.suggestion || question.evaluation.overallFeedback || question.evaluation.improvementSuggestions || question.evaluation.modelAnswer || "—"}
                              </p>
                            </div>
                          </div>

                          {/* Detailed Scores */}
                          <div className="space-y-2">
                            <p className="text-sm"><strong>Correctness:</strong> {question.evaluation.correctness}</p>
                            <p className="text-sm"><strong>Clarity:</strong> {question.evaluation.clarityStructure}</p>
                            <p className="text-sm"><strong>Completeness:</strong> {question.evaluation.completeness}</p>
                            <p className="text-sm"><strong>Relevance:</strong> {question.evaluation.relevance}</p>
                            <p className="text-sm"><strong>Confidence:</strong> {question.evaluation.confidenceTone}</p>
                            <p className="text-sm"><strong>Communication:</strong> {question.evaluation.communicationSkills}</p>
                          </div>
                        </div>

                        {/* Additional Feedback */}
                        {question.evaluation.modelAnswer && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                <h5 className="font-semibold text-green-800 mb-2">✅ Model Answer</h5>
                                <p className="text-green-700 text-sm">{question.evaluation.modelAnswer}</p>
                              </div>
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <h5 className="font-semibold text-blue-800 mb-2">💡 Improvements</h5>
                                <p className="text-blue-700 text-sm">{question.evaluation.improvementSuggestions}</p>
                              </div>
                            </div>
                            {question.evaluation.keyPoints && (
                              <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg p-3">
                                <h5 className="font-semibold text-purple-800 mb-2">🎯 Key Points</h5>
                                <p className="text-purple-700 text-sm">{question.evaluation.keyPoints}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mb-6 text-indigo-200">No question-wise evaluations saved for this interview yet.</div>
              )}

              {/* Overall Interview Feedback */}
              {selected.analysis ? (
                <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 shadow-md text-gray-800">
                  <h3 className="text-xl font-semibold mb-4 text-indigo-800">📋 Overall Interview Feedback</h3>
                  <div className="space-y-3 mb-6">
                    <p className="p-3 bg-indigo-50 rounded-lg border-l-4 border-indigo-400">
                      <strong>Overall Summary:</strong> {selected.analysis["Overall Feedback Summary"]}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <p><strong>Correctness:</strong> {renderScore(selected.analysis.Correctness)}</p>
                      <p><strong>Clarity & Structure:</strong> {renderScore(selected.analysis["Clarity & Structure"])}</p>
                      <p><strong>Completeness:</strong> {renderScore(selected.analysis.Completeness)}</p>
                      <p><strong>Relevance:</strong> {renderScore(selected.analysis.Relevance)}</p>
                      <p><strong>Confidence & Tone:</strong> {renderScore(selected.analysis["Confidence & Tone"])}</p>
                      <p><strong>Communication Skills:</strong> {renderScore(selected.analysis["Communication Skills"])}</p>
                    </div>
                  </div>

                  {/* Model Answer and Improvements Section */}
                  {(selected.analysis["Model Answer"] || selected.analysis["Improvement Suggestions"] || selected.analysis["Key Points"]) && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Model Answer */}
                      {selected.analysis["Model Answer"] && (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-sm">
                          <h4 className="text-md font-semibold mb-2 text-green-800 flex items-center">
                            <span className="mr-2">✅</span>
                            Model Answer
                          </h4>
                          <p className="text-green-700 text-sm leading-relaxed">
                            {selected.analysis["Model Answer"]}
                          </p>
                        </div>
                      )}

                      {/* Improvement Suggestions */}
                      {selected.analysis["Improvement Suggestions"] && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm">
                          <h4 className="text-md font-semibold mb-2 text-blue-800 flex items-center">
                            <span className="mr-2">💡</span>
                            Improvement Suggestions
                          </h4>
                          <p className="text-blue-700 text-sm leading-relaxed">
                            {selected.analysis["Improvement Suggestions"]}
                          </p>
                        </div>
                      )}

                      {/* Key Points */}
                      {selected.analysis["Key Points"] && (
                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 shadow-sm col-span-1 lg:col-span-2">
                          <h4 className="text-md font-semibold mb-2 text-purple-800 flex items-center">
                            <span className="mr-2">🎯</span>
                            Key Points to Remember
                          </h4>
                          <p className="text-purple-700 text-sm leading-relaxed">
                            {selected.analysis["Key Points"]}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-indigo-200 text-lg mt-6">
                  No overall feedback analysis available for this interview yet.
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-indigo-200 text-xl mb-4">📚 Select an interview to view details</p>
                <p className="text-indigo-300">Choose from your interview history on the left</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}