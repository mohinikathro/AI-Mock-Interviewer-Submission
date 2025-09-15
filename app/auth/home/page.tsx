"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  BarChart3, 
  FileText, 
  Play, 
  History, 
  LogOut, 
  TrendingUp,
  Users,
  Award,
  Clock
} from "lucide-react";

interface QuickStats {
  totalInterviews: number;
  averageScore: number;
  lastInterviewDate: string;
  strongestArea: string;
}

export default function HomePage() {
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchQuickStats = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          router.push("/auth/signin");
          return;
        }

        const response = await fetch("http://localhost:5002/api/dashboard", {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (response.ok) {
          const data = await response.json();
          const strongestArea = Object.entries(data.averageScores)
            .filter(([key]) => key !== 'overall')
            .reduce((a, b) => a[1] > b[1] ? a : b)[0]
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase());

          setQuickStats({
            totalInterviews: data.totalInterviews,
            averageScore: data.averageScores.overall,
            lastInterviewDate: data.trendsOverTime.dates[data.trendsOverTime.dates.length - 1] || 'N/A',
            strongestArea: strongestArea,
          });
        }
      } catch (error) {
        console.error("Error fetching quick stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuickStats();
  }, [router]);

  const handleSignOut = () => {
    localStorage.removeItem("token");
    router.push("/auth/signin");
  };

  const navigationCards = [
    {
      title: "Take New Interview",
      description: "Start a new mock interview session",
      icon: Play,
      color: "from-green-500 to-emerald-600",
      hoverColor: "hover:from-green-600 hover:to-emerald-700",
      path: "/auth/interview-form",
    },
    {
      title: "Performance Dashboard",
      description: "View analytics and performance metrics",
      icon: BarChart3,
      color: "from-blue-500 to-indigo-600",
      hoverColor: "hover:from-blue-600 hover:to-indigo-700",
      path: "/auth/dashboard",
    },
    {
      title: "Interview History",
      description: "Review past interviews and detailed feedback",
      icon: History,
      color: "from-purple-500 to-violet-600",
      hoverColor: "hover:from-purple-600 hover:to-violet-700",
      path: "/auth/interview-history",
    },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 via-blue-900 to-black">
      {/* Header */}
      <div className="flex justify-between items-center p-6">
        <h1 className="text-4xl font-bold text-white">AI Interview Platform</h1>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-pink-600 text-white font-semibold shadow hover:brightness-110 transition"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>

      <div className="px-6 pb-6">
        {/* Welcome Section */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">
            Welcome back! Ready to ace your next interview?
          </h2>
          <p className="text-xl text-indigo-200">
            Practice with AI-powered mock interviews and track your progress
          </p>
        </div>

        {/* Quick Stats */}
        {!loading && quickStats && quickStats.totalInterviews > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 shadow-lg text-center">
              <div className="flex items-center justify-center mb-3">
                <FileText className="text-indigo-600" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-gray-800">{quickStats.totalInterviews}</h3>
              <p className="text-gray-600">Total Interviews</p>
            </div>
            
            <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 shadow-lg text-center">
              <div className="flex items-center justify-center mb-3">
                <TrendingUp className="text-green-600" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-gray-800">{quickStats.averageScore.toFixed(1)}/10</h3>
              <p className="text-gray-600">Average Score</p>
            </div>
            
            <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 shadow-lg text-center">
              <div className="flex items-center justify-center mb-3">
                <Award className="text-purple-600" size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-800">{quickStats.strongestArea}</h3>
              <p className="text-gray-600">Strongest Area</p>
            </div>
            
            <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 shadow-lg text-center">
              <div className="flex items-center justify-center mb-3">
                <Clock className="text-orange-600" size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-800">{quickStats.lastInterviewDate}</h3>
              <p className="text-gray-600">Last Interview</p>
            </div>
          </div>
        )}

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {navigationCards.map((card, index) => {
            const IconComponent = card.icon;
            return (
              <div
                key={index}
                onClick={() => router.push(card.path)}
                className={`bg-gradient-to-br ${card.color} ${card.hoverColor} rounded-2xl p-8 shadow-2xl cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-3xl`}
              >
                <div className="text-center text-white">
                  <div className="flex justify-center mb-6">
                    <div className="bg-white/20 backdrop-blur-md rounded-full p-4">
                      <IconComponent size={48} />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-4">{card.title}</h3>
                  <p className="text-lg opacity-90 leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Getting Started Section for New Users */}
        {!loading && (!quickStats || quickStats.totalInterviews === 0) && (
          <div className="mt-16 text-center">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 max-w-2xl mx-auto">
              <h3 className="text-2xl font-bold text-white mb-4">
                🚀 Ready to get started?
              </h3>
              <p className="text-indigo-200 mb-6 text-lg">
                Take your first mock interview and start improving your interview skills with AI-powered feedback!
              </p>
              <button
                onClick={() => router.push("/auth/interview-form")}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 px-8 rounded-xl text-lg transition-all duration-300 transform hover:scale-105"
              >
                Take Your First Interview
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}