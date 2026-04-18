"use client";

import { useState, useEffect } from "react";

interface SellerStats {
  totalProducts: number;
  totalReviews: number;
  avgRating: number;
  sentiment: Record<string, number>;
}

interface ProductStat {
  _id: string;
  name: string;
  category: string;
  price: number;
  imageUrl: string;
  totalReviews: number;
  avgRating: number;
  avgTrust: number;
  flaggedCount: number;
}

interface Alert {
  _id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
}

export default function SellerDashboard() {
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [products, setProducts] = useState<ProductStat[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const res = await fetch("/api/seller/stats");
    if (res.ok) {
      const data = await res.json();
      setStats(data.stats);
      setProducts(data.products);
      setAlerts(data.alerts);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-zinc-900/50 border border-zinc-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const totalSentiment = Object.values(stats?.sentiment || {}).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-white mb-2">Seller Dashboard</h1>
      <p className="text-zinc-500 mb-8">Product analytics and review insights</p>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
          <p className="text-sm text-zinc-500">Products</p>
          <p className="text-3xl font-bold text-white mt-1">{stats?.totalProducts || 0}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
          <p className="text-sm text-zinc-500">Total Reviews</p>
          <p className="text-3xl font-bold text-white mt-1">{stats?.totalReviews || 0}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
          <p className="text-sm text-zinc-500">Avg Rating</p>
          <p className="text-3xl font-bold text-amber-400 mt-1">
            {stats?.avgRating ? `${stats.avgRating}★` : "—"}
          </p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
          <p className="text-sm text-zinc-500 mb-2">Sentiment</p>
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
            {stats?.sentiment?.positive ? (
              <div
                className="bg-emerald-500 rounded-full"
                style={{ width: `${(stats.sentiment.positive / totalSentiment) * 100}%` }}
              />
            ) : null}
            {stats?.sentiment?.neutral ? (
              <div
                className="bg-zinc-500 rounded-full"
                style={{ width: `${(stats.sentiment.neutral / totalSentiment) * 100}%` }}
              />
            ) : null}
            {stats?.sentiment?.negative ? (
              <div
                className="bg-red-500 rounded-full"
                style={{ width: `${(stats.sentiment.negative / totalSentiment) * 100}%` }}
              />
            ) : null}
          </div>
          <div className="flex justify-between text-xs text-zinc-600 mt-1">
            <span>Positive: {stats?.sentiment?.positive || 0}</span>
            <span>Negative: {stats?.sentiment?.negative || 0}</span>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-white">Product Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-sm text-zinc-500 border-b border-zinc-800">
                <th className="px-6 py-3 text-left">Product</th>
                <th className="px-6 py-3 text-center">Reviews</th>
                <th className="px-6 py-3 text-center">Avg Rating</th>
                <th className="px-6 py-3 text-center">Trust Avg</th>
                <th className="px-6 py-3 text-center">Flagged</th>
                <th className="px-6 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p._id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {p.imageUrl && (
                        <img src={p.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-white">{p.name}</p>
                        <p className="text-xs text-zinc-600 capitalize">{p.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-zinc-300">{p.totalReviews}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm text-amber-400">{p.avgRating > 0 ? `${p.avgRating}★` : "—"}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-sm font-mono ${
                      p.avgTrust >= 70 ? "text-emerald-400" : p.avgTrust >= 40 ? "text-amber-400" : "text-red-400"
                    }`}>
                      {p.avgTrust > 0 ? `${p.avgTrust}%` : "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {p.flaggedCount > 0 ? (
                      <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
                        {p.flaggedCount}
                      </span>
                    ) : (
                      <span className="text-sm text-zinc-600">0</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <a href={`/seller/products/${p._id}/analytics`} className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline">
                      View Analytics
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">🔔 Alerts</h2>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert._id} className="bg-zinc-800/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    alert.type === "review_bomb"
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  }`}>
                    {alert.type.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-zinc-600">
                    {new Date(alert.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-white">{alert.title}</p>
                <p className="text-xs text-zinc-500 mt-1">{alert.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
