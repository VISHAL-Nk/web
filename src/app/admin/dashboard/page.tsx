"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Stats {
  pendingCount: number;
  flaggedCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalReviews: number;
  totalProducts: number;
  totalCustomers: number;
}

interface FlaggedReview {
  _id: string;
  text: string;
  rating: number;
  trustScore: number;
  flagReasons: string[];
  productName: string;
  customerName: string;
  createdAt: string;
}

interface Alert {
  _id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
}

const STAT_CARDS = [
  { key: "pendingCount", label: "Pending Review", color: "from-amber-500 to-orange-600", icon: "⏳" },
  { key: "flaggedCount", label: "Flagged", color: "from-red-500 to-rose-600", icon: "🚩" },
  { key: "approvedCount", label: "Approved", color: "from-emerald-500 to-green-600", icon: "✅" },
  { key: "rejectedCount", label: "Rejected", color: "from-zinc-500 to-zinc-600", icon: "❌" },
];

const TRUST_COLOR = (score: number) => {
  if (score >= 0.7) return "text-emerald-400";
  if (score >= 0.4) return "text-amber-400";
  return "text-red-400";
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentFlagged, setRecentFlagged] = useState<FlaggedReview[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    const res = await fetch("/api/admin/stats");
    if (res.ok) {
      const data = await res.json();
      setStats(data.stats);
      setRecentFlagged(data.recentFlagged);
      setAlerts(data.recentAlerts);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-zinc-900/50 border border-zinc-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-zinc-500 mt-1">Review moderation & system overview</p>
        </div>
        <Link
          href="/admin/moderation"
          className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-medium rounded-xl transition-all"
        >
          Open Moderation Queue
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {STAT_CARDS.map((card) => (
          <div
            key={card.key}
            className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-zinc-500">{card.label}</span>
              <span className="text-lg">{card.icon}</span>
            </div>
            <p className="text-3xl font-bold text-white">
              {stats ? (stats as Record<string, number>)[card.key] : 0}
            </p>
          </div>
        ))}
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent flagged reviews */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">🚩 Recent Flagged Reviews</h2>
          {recentFlagged.length === 0 ? (
            <p className="text-zinc-600 text-sm">No flagged reviews. All clear!</p>
          ) : (
            <div className="space-y-3">
              {recentFlagged.map((r) => (
                <Link
                  key={r._id}
                  href="/admin/moderation"
                  className="block bg-zinc-800/50 rounded-xl p-4 hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">{r.productName}</span>
                    <span className={`text-sm font-mono ${TRUST_COLOR(r.trustScore)}`}>
                      Trust: {(r.trustScore * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400 line-clamp-2 mb-2">{r.text}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.flagReasons.map((reason) => (
                      <span
                        key={reason}
                        className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full"
                      >
                        {reason.replace(/_/g, " ")}
                      </span>
                    ))}
                    <span className="text-xs text-zinc-600 ml-auto">
                      by {r.customerName} • {r.rating}★
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent alerts */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">🔔 Unread Alerts</h2>
          {alerts.length === 0 ? (
            <p className="text-zinc-600 text-sm">No unread alerts.</p>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert._id}
                  className="bg-zinc-800/50 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                      {alert.type.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-zinc-600">
                      {new Date(alert.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white">{alert.title}</p>
                  <p className="text-xs text-zinc-500 line-clamp-2 mt-1">{alert.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System overview */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-white mb-4">📊 System Overview</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{stats?.totalReviews || 0}</p>
              <p className="text-sm text-zinc-500">Total Reviews</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{stats?.totalProducts || 0}</p>
              <p className="text-sm text-zinc-500">Active Products</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{stats?.totalCustomers || 0}</p>
              <p className="text-sm text-zinc-500">Customers</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
