"use client";

import React, { useEffect, useState } from "react";
import { Bar, Line, Pie, Radar } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    LineElement,
    PointElement,
    ArcElement,
    RadialLinearScale,
} from "chart.js";
import { useRouter } from "next/navigation";

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    LineElement,
    PointElement,
    ArcElement,
    RadialLinearScale
);

interface DashboardData {
    totalInterviews: number;
    averageScores: {
        correctness: number;
        clarityStructure: number;
        completeness: number;
        relevance: number;
        confidenceTone: number;
        communicationSkills: number;
        overall: number;
    };
    trendsOverTime: {
        dates: string[];
        scores: number[];
    };
    roleDistribution: {
        [role: string]: number;
    };
    levelDistribution: {
        [level: string]: number;
    };
    companyDistribution: {
        [company: string]: number;
    };
}

export default function Dashboard() {
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Function to normalize and combine similar level entries
    const normalizeLevelDistribution = (levelDist: { [level: string]: number }) => {
        const normalized: { [level: string]: number } = {};

        Object.entries(levelDist).forEach(([level, count]) => {
            // Normalize the level string
            let normalizedLevel = level.toLowerCase()
                .replace(/^level\s+/, '') // Remove "level " prefix
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim();

            // Map common variations to standard names
            if (normalizedLevel === '1' || normalizedLevel === 'level 1') {
                normalizedLevel = 'Entry Level';
            } else if (normalizedLevel === 'junior' || normalizedLevel === 'jjunior') {
                normalizedLevel = 'Junior';
            } else if (normalizedLevel === 'mid' || normalizedLevel === 'mid-level' || normalizedLevel === 'middle') {
                normalizedLevel = 'Mid-Level';
            } else if (normalizedLevel === 'senior' || normalizedLevel === 'sr') {
                normalizedLevel = 'Senior';
            } else if (normalizedLevel === 'lead' || normalizedLevel === 'tech lead') {
                normalizedLevel = 'Lead';
            } else {
                // Capitalize first letter for other entries
                normalizedLevel = normalizedLevel.charAt(0).toUpperCase() + normalizedLevel.slice(1);
            }

            // Combine counts for the same normalized level
            normalized[normalizedLevel] = (normalized[normalizedLevel] || 0) + count;
        });

        return normalized;
    };

    // Function to normalize and combine similar company entries
    const normalizeCompanyDistribution = (companyDist: { [company: string]: number }) => {
        const normalized: { [company: string]: number } = {};

        Object.entries(companyDist).forEach(([company, count]) => {
            // Normalize the company string
            let normalizedCompany = company.toLowerCase()
                .replace(/\s+/g, ' ') // Normalize whitespace
                .replace(/[.,]/g, '') // Remove periods and commas
                .trim();

            // Map common variations to standard names
            if (normalizedCompany.includes('google') || normalizedCompany.includes('googl')) {
                normalizedCompany = 'Google';
            } else if (normalizedCompany.includes('microsoft') || normalizedCompany.includes('msft')) {
                normalizedCompany = 'Microsoft';
            } else if (normalizedCompany.includes('amazon') || normalizedCompany.includes('amzn')) {
                normalizedCompany = 'Amazon';
            } else if (normalizedCompany.includes('apple') || normalizedCompany.includes('appl')) {
                normalizedCompany = 'Apple';
            } else if (normalizedCompany.includes('meta') || normalizedCompany.includes('facebook') || normalizedCompany.includes('fb')) {
                normalizedCompany = 'Meta';
            } else if (normalizedCompany.includes('netflix') || normalizedCompany.includes('nflx')) {
                normalizedCompany = 'Netflix';
            } else if (normalizedCompany.includes('tesla') || normalizedCompany.includes('tsla')) {
                normalizedCompany = 'Tesla';
            } else if (normalizedCompany.includes('uber') || normalizedCompany.includes('ubr')) {
                normalizedCompany = 'Uber';
            } else if (normalizedCompany.includes('airbnb') || normalizedCompany.includes('abnb')) {
                normalizedCompany = 'Airbnb';
            } else if (normalizedCompany.includes('spotify') || normalizedCompany.includes('spot')) {
                normalizedCompany = 'Spotify';
            } else {
                // Capitalize first letter of each word
                normalizedCompany = normalizedCompany.split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
            }

            // Combine counts for the same normalized company
            normalized[normalizedCompany] = (normalized[normalizedCompany] || 0) + count;
        });

        return normalized;
    };

    // Function to normalize and combine similar role entries
    const normalizeRoleDistribution = (roleDist: { [role: string]: number }) => {
        const normalized: { [role: string]: number } = {};

        Object.entries(roleDist).forEach(([role, count]) => {
            // Normalize the role string
            let normalizedRole = role.toLowerCase()
                .replace(/\s+/g, ' ') // Normalize whitespace
                .replace(/[.,]/g, '') // Remove periods and commas
                .trim();

            // Map common variations to standard names
            if (normalizedRole.includes('software engineer') || normalizedRole.includes('swe') ||
                normalizedRole.includes('software developer') || normalizedRole.includes('dev')) {
                normalizedRole = 'Software Engineer';
            } else if (normalizedRole.includes('data scientist') || normalizedRole.includes('ds')) {
                normalizedRole = 'Data Scientist';
            } else if (normalizedRole.includes('data analyst') || normalizedRole.includes('analyst')) {
                normalizedRole = 'Data Analyst';
            } else if (normalizedRole.includes('product manager') || normalizedRole.includes('pm')) {
                normalizedRole = 'Product Manager';
            } else if (normalizedRole.includes('product data scientist') || normalizedRole.includes('pds')) {
                normalizedRole = 'Product Data Scientist';
            } else if (normalizedRole.includes('frontend') || normalizedRole.includes('front-end') ||
                normalizedRole.includes('front end')) {
                normalizedRole = 'Frontend Engineer';
            } else if (normalizedRole.includes('backend') || normalizedRole.includes('back-end') ||
                normalizedRole.includes('back end')) {
                normalizedRole = 'Backend Engineer';
            } else if (normalizedRole.includes('fullstack') || normalizedRole.includes('full-stack') ||
                normalizedRole.includes('full stack')) {
                normalizedRole = 'Full Stack Engineer';
            } else if (normalizedRole.includes('devops') || normalizedRole.includes('dev ops')) {
                normalizedRole = 'DevOps Engineer';
            } else if (normalizedRole.includes('machine learning') || normalizedRole.includes('ml engineer')) {
                normalizedRole = 'ML Engineer';
            } else if (normalizedRole.includes('ui/ux') || normalizedRole.includes('ux') ||
                normalizedRole.includes('user experience')) {
                normalizedRole = 'UX Designer';
            } else {
                // Capitalize first letter of each word
                normalizedRole = normalizedRole.split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
            }

            // Combine counts for the same normalized role
            normalized[normalizedRole] = (normalized[normalizedRole] || 0) + count;
        });

        return normalized;
    };

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const token = localStorage.getItem("token");
                const response = await fetch("http://localhost:5002/api/dashboard", {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (response.ok) {
                    const data = await response.json();
                    setDashboardData(data);
                } else {
                    console.error("Failed to fetch dashboard data");
                }
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    if (loading) {
        return (
            <div className="h-screen w-full bg-gradient-to-br from-gray-900 via-blue-900 to-black flex items-center justify-center">
                <div className="text-white text-xl">Loading Dashboard...</div>
            </div>
        );
    }

    if (!dashboardData) {
        return (
            <div className="h-screen w-full bg-gradient-to-br from-gray-900 via-blue-900 to-black flex items-center justify-center">
                <div className="text-white text-xl">No data available</div>
            </div>
        );
    }

    const averageScoresData = {
        labels: [
            "Correctness",
            "Clarity & Structure",
            "Completeness",
            "Relevance",
            "Confidence & Tone",
            "Communication Skills"
        ],
        datasets: [
            {
                label: "Average Scores",
                data: [
                    dashboardData.averageScores.correctness,
                    dashboardData.averageScores.clarityStructure,
                    dashboardData.averageScores.completeness,
                    dashboardData.averageScores.relevance,
                    dashboardData.averageScores.confidenceTone,
                    dashboardData.averageScores.communicationSkills,
                ],
                backgroundColor: "rgba(168, 85, 247, 0.6)",
                borderColor: "rgba(168, 85, 247, 1)",
                borderWidth: 2,
            },
        ],
    };

    const radarData = {
        labels: [
            "Correctness",
            "Clarity & Structure",
            "Completeness",
            "Relevance",
            "Confidence & Tone",
            "Communication Skills"
        ],
        datasets: [
            {
                label: "Performance Profile",
                data: [
                    dashboardData.averageScores.correctness,
                    dashboardData.averageScores.clarityStructure,
                    dashboardData.averageScores.completeness,
                    dashboardData.averageScores.relevance,
                    dashboardData.averageScores.confidenceTone,
                    dashboardData.averageScores.communicationSkills,
                ],
                backgroundColor: "rgba(168, 85, 247, 0.2)",
                borderColor: "rgba(168, 85, 247, 1)",
                borderWidth: 2,
            },
        ],
    };

    const trendsData = {
        labels: dashboardData.trendsOverTime.dates,
        datasets: [
            {
                label: "Performance Trend",
                data: dashboardData.trendsOverTime.scores,
                fill: false,
                borderColor: "rgba(168, 85, 247, 1)",
                backgroundColor: "rgba(168, 85, 247, 0.1)",
                tension: 0.3,
            },
        ],
    };

    const normalizedRoleData = normalizeRoleDistribution(dashboardData.roleDistribution);
    const roleDistributionData = {
        labels: Object.keys(normalizedRoleData),
        datasets: [
            {
                label: "Interviews by Role",
                data: Object.values(normalizedRoleData),
                backgroundColor: [
                    "rgba(168, 85, 247, 0.8)",
                    "rgba(139, 69, 19, 0.8)",
                    "rgba(255, 99, 132, 0.8)",
                    "rgba(54, 162, 235, 0.8)",
                    "rgba(255, 205, 86, 0.8)",
                    "rgba(75, 192, 192, 0.8)",
                ],
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
            padding: {
                bottom: 20,
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 10,
            },
            x: {
                ticks: {
                    maxRotation: 45,
                    minRotation: 0,
                    font: {
                        size: 11,
                    },
                },
            },
        },
        plugins: {
            legend: {
                display: true,
                position: 'top' as const,
            },
        },
    };

    const pieOptions = {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
            padding: 20,
        },
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    boxWidth: 12,
                    font: {
                        size: 11,
                    },
                    padding: 15,
                },
            },
        },
    };

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 via-blue-900 to-black p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-4xl font-bold text-white">Performance Dashboard</h1>
                <div className="flex gap-4">
                    <button
                        onClick={() => router.push("/auth/home")}
                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-cyan-600 text-white font-semibold shadow hover:brightness-110 transition"
                    >
                        🏠 Home
                    </button>
                    <button
                        onClick={() => router.push("/auth/interview-history")}
                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold shadow hover:brightness-110 transition"
                    >
                        View Interview History
                    </button>
                    <button
                        onClick={() => router.push("/auth/interview-form")}
                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-teal-600 text-white font-semibold shadow hover:brightness-110 transition"
                    >
                        Take New Interview
                    </button>
                    <button
                        onClick={() => {
                            localStorage.removeItem("token");
                            router.push("/auth/signin");
                        }}
                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-pink-600 text-white font-semibold shadow hover:brightness-110 transition"
                    >
                        Sign Out
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 shadow-lg">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Total Interviews</h3>
                    <p className="text-3xl font-bold text-indigo-600">{dashboardData.totalInterviews}</p>
                </div>
                <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 shadow-lg">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Overall Average</h3>
                    <p className="text-3xl font-bold text-purple-600">{dashboardData.averageScores.overall.toFixed(1)}/10</p>
                </div>
                <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 shadow-lg">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Strongest Area</h3>
                    <p className="text-lg font-bold text-green-600">
                        {Object.entries(dashboardData.averageScores)
                            .filter(([key]) => key !== 'overall')
                            .reduce((a, b) => a[1] > b[1] ? a : b)[0]
                            .replace(/([A-Z])/g, ' $1')
                            .replace(/^./, str => str.toUpperCase())}
                    </p>
                </div>
                <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 shadow-lg">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Improvement Area</h3>
                    <p className="text-lg font-bold text-orange-600">
                        {Object.entries(dashboardData.averageScores)
                            .filter(([key]) => key !== 'overall')
                            .reduce((a, b) => a[1] < b[1] ? a : b)[0]
                            .replace(/([A-Z])/g, ' $1')
                            .replace(/^./, str => str.toUpperCase())}
                    </p>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Average Scores Bar Chart */}
                <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 shadow-lg h-[450px]">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Average Scores by Category</h3>
                    <div className="h-[350px]">
                        <Bar data={averageScoresData} options={chartOptions} />
                    </div>
                </div>

                {/* Performance Radar Chart */}
                <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 shadow-lg h-[450px]">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Performance Profile</h3>
                    <div className="h-[350px]">
                        <Radar data={radarData} options={pieOptions} />
                    </div>
                </div>

                {/* Performance Trend */}
                <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 shadow-lg h-[450px]">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Performance Trend Over Time</h3>
                    <div className="h-[350px]">
                        <Line data={trendsData} options={chartOptions} />
                    </div>
                </div>

                {/* Role Distribution */}
                <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 shadow-lg h-[450px]">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Interviews by Role</h3>
                    <div className="h-[350px] flex items-center gap-6">
                        {/* Pie Chart */}
                        <div className="w-[320px] h-[320px] flex-shrink-0">
                            <Pie data={roleDistributionData} options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: {
                                        display: false, // Hide default legend
                                    },
                                },
                            }} />
                        </div>
                        {/* Custom Legend */}
                        <div className="flex-1 max-h-[300px] overflow-y-auto">
                            <div className="space-y-3">
                                {Object.entries(normalizedRoleData)
                                    .sort(([, a], [, b]) => b - a) // Sort by count descending
                                    .map(([role, count], index) => (
                                        <div key={role} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                                            <div
                                                className="w-4 h-4 rounded-full flex-shrink-0"
                                                style={{
                                                    backgroundColor: [
                                                        "rgba(168, 85, 247, 0.8)",
                                                        "rgba(139, 69, 19, 0.8)",
                                                        "rgba(255, 99, 132, 0.8)",
                                                        "rgba(54, 162, 235, 0.8)",
                                                        "rgba(255, 205, 86, 0.8)",
                                                        "rgba(75, 192, 192, 0.8)",
                                                    ][index % 6]
                                                }}
                                            ></div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-gray-800 truncate" title={role}>
                                                    {role}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {count} interview{count !== 1 ? 's' : ''}
                                                </div>
                                            </div>
                                            <div className="text-sm font-bold text-indigo-600 flex-shrink-0">
                                                {count}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 shadow-lg">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Role Distribution</h3>
                    <div className="space-y-2">
                        {Object.entries(normalizeRoleDistribution(dashboardData.roleDistribution))
                            .sort(([, a], [, b]) => b - a) // Sort by count descending
                            .map(([role, count]) => (
                                <div key={role} className="flex justify-between">
                                    <span className="text-gray-700">{role}</span>
                                    <span className="font-semibold text-indigo-600">{count}</span>
                                </div>
                            ))}
                    </div>
                </div>

                <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 shadow-lg">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Level Distribution</h3>
                    <div className="space-y-2">
                        {Object.entries(normalizeLevelDistribution(dashboardData.levelDistribution))
                            .sort(([, a], [, b]) => b - a) // Sort by count descending
                            .map(([level, count]) => (
                                <div key={level} className="flex justify-between">
                                    <span className="text-gray-700">{level}</span>
                                    <span className="font-semibold text-purple-600">{count}</span>
                                </div>
                            ))}
                    </div>
                </div>

                <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 shadow-lg">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Company Distribution</h3>
                    <div className="space-y-2">
                        {Object.entries(normalizeCompanyDistribution(dashboardData.companyDistribution))
                            .sort(([, a], [, b]) => b - a) // Sort by count descending
                            .map(([company, count]) => (
                                <div key={company} className="flex justify-between">
                                    <span className="text-gray-700">{company}</span>
                                    <span className="font-semibold text-green-600">{count}</span>
                                </div>
                            ))}
                    </div>
                </div>
            </div>
        </div>
    );
}