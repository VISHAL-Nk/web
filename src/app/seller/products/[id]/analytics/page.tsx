"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

export default function ProductAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (productId) fetchAnalytics();
  }, [productId]);

  async function fetchAnalytics() {
    const res = await fetch(`/api/seller/products/${productId}/analytics`);
    if (res.ok) {
      const json = await res.json();
      setData(json);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-10 animate-pulse">
        <div className="h-40 bg-zinc-900 rounded-2xl mb-8 border border-zinc-800" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="h-80 bg-zinc-900 rounded-2xl border border-zinc-800" />
          <div className="h-80 bg-zinc-900 rounded-2xl border border-zinc-800" />
        </div>
      </div>
    );
  }

  if (!data?.product) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-10 text-center">
        <h2 className="text-xl text-white">Product not found</h2>
        <button onClick={() => router.back()} className="mt-4 text-violet-400 hover:underline">
          Go Back
        </button>
      </div>
    );
  }

  const { product, ratingDistribution, sentimentData, volumeTimeline, recentTrend, recentReviews } = data;

  const SENTIMENT_COLORS = ["#10b981", "#71717a", "#ef4444"]; // Emerald, Zinc, Red

  // Format feature timeline for LineChart
  const featureTimeline = recentTrend?.featureTimeline || {};
  const featureTimelineKeys = Object.keys(featureTimeline);

  const windowNumbers = Array.from(
    new Set(
      featureTimelineKeys.flatMap((feature) =>
        (featureTimeline[feature] || []).map(
          (point: { window?: number }, idx: number) => point.window ?? idx + 1
        )
      )
    )
  ).sort((a, b) => a - b);

  const trendDataFormatted = windowNumbers.map((windowNumber) => {
    const point: Record<string, number | null | string> = {
      name: `Window ${windowNumber}`,
    };

    for (const feature of featureTimelineKeys) {
      const featurePoints = featureTimeline[feature] || [];
      const featurePoint = featurePoints.find(
        (p: { window?: number }, idx: number) => (p.window ?? idx + 1) === windowNumber
      );

      // Missing windows for a feature are valid; render as gap.
      point[feature] = typeof featurePoint?.positive === "number"
        ? featurePoint.positive * 100
        : null;
    }

    return point;
  });

  const FEATURE_COLORS = ["#8b5cf6", "#ec4899", "#3b82f6", "#f59e0b", "#14b8a6"];

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <Link href={`/seller/products`} className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors border border-zinc-800 text-zinc-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">{product.name} Analytics</h1>
          <p className="text-zinc-500 capitalize">{product.category} • {product.reviewCount} Reviews</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Rating Distribution */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6">Rating Distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratingDistribution} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis type="number" stroke="#a1a1aa" />
                <YAxis dataKey="name" type="category" stroke="#a1a1aa" width={60} />
                <Tooltip cursor={{fill: '#27272a'}} contentStyle={{backgroundColor: '#18181b', borderColor: '#3f3f46', color: '#fff'}} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sentiment Distribution */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6">Overall Sentiment</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sentimentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {sentimentData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={SENTIMENT_COLORS[index % SENTIMENT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{backgroundColor: '#18181b', borderColor: '#3f3f46', color: '#fff'}} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Volume over time */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6">Review Volume (Last 30 Days)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="date" stroke="#a1a1aa" tickFormatter={(tick) => tick.substring(5)} />
                <YAxis stroke="#a1a1aa" allowDecimals={false} />
                <Tooltip cursor={{fill: '#27272a'}} contentStyle={{backgroundColor: '#18181b', borderColor: '#3f3f46', color: '#fff'}} />
                <Bar dataKey="reviews" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Feature Trends */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-6">Feature Sentiment Trends (% Positive)</h2>
            {trendDataFormatted.length > 0 ? (
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendDataFormatted}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                            <XAxis dataKey="name" stroke="#a1a1aa" />
                            <YAxis stroke="#a1a1aa" domain={[0, 100]} />
                            <Tooltip contentStyle={{backgroundColor: '#18181b', borderColor: '#3f3f46', color: '#fff'}} />
                            <Legend />
                            {featureTimelineKeys.map((feature, i) => (
                                <Line key={feature} type="monotone" dataKey={feature} stroke={FEATURE_COLORS[i % FEATURE_COLORS.length]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="flex items-center justify-center h-64 text-zinc-500 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/30">
                    Not enough verified reviews for trend analysis.
                </div>
            )}
        </div>
      </div>

      {/* AI Trend Alerts */}
      {recentTrend?.detectedTrends && recentTrend.detectedTrends.length > 0 && (
        <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">AI Trend Alerts</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recentTrend.detectedTrends.map((alert: any, i: number) => (
                    <div key={i} className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
                        <div className="flex items-start justify-between mb-2">
                            <h3 className="font-semibold text-red-400">{alert.direction === 'sudden_drop' ? '📉 Sudden Sentiment Drop' : '⚠️ Rising Complaint'}</h3>
                            <span className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded-full">{alert.severity}</span>
                        </div>
                        <p className="text-zinc-300 text-sm mb-3">
                            <span className="font-bold text-white">{alert.feature}</span> sentiment has changed by {alert.change_pct}% compared to the previous window.
                            Affected {alert.unique_reviewers} unique reviewers.
                        </p>
                    </div>
                ))}
            </div>
        </div>
      )}

      {/* Recent Reviews List */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">Recent Reviews</h2>
        {recentReviews?.length > 0 ? (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-sm text-zinc-500 border-b border-zinc-800">
                    <th className="px-6 py-3 text-left">Customer</th>
                    <th className="px-6 py-3 text-center">Rating</th>
                    <th className="px-6 py-3 text-left">Review Context</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReviews.map((r: any) => (
                    <tr key={r._id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-white">{r.customerId?.name || "Anonymous"}</p>
                        <p className="text-xs text-zinc-600">{new Date(r.createdAt).toLocaleDateString()}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm text-amber-400">{r.rating}★</span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-zinc-300 line-clamp-2">{r.text}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
            <p className="text-zinc-500">No approved reviews yet.</p>
          </div>
        )}
      </div>

    </div>
  );
}
