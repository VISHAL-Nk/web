"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ProductOption {
  _id: string;
  name: string;
  category: string;
}

interface SentimentPoint {
  date: string;
  positive: number;
  negative: number;
  neutral: number;
  total: number;
  avgRating: number;
}

interface TagItem {
  tag: string;
  count: number;
}

interface FeatureItem {
  feature: string;
  positive: number;
  negative: number;
  neutral: number;
  total: number;
}

export default function SellerProductsPage() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [sentimentData, setSentimentData] = useState<SentimentPoint[]>([]);
  const [tagCloud, setTagCloud] = useState<TagItem[]>([]);
  const [features, setFeatures] = useState<FeatureItem[]>([]);
  const [productName, setProductName] = useState("");
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedProduct) fetchTrends();
  }, [selectedProduct]);

  async function fetchProducts() {
    const res = await fetch("/api/seller/products");
    if (res.ok) {
      const data = await res.json();
      setProducts(data.products || []);
      if (data.products?.length > 0) {
        setSelectedProduct(data.products[0]._id);
      }
    }
    setLoading(false);
  }

  async function fetchTrends() {
    setTrendLoading(true);
    const res = await fetch(`/api/seller/trends?productId=${selectedProduct}`);
    if (res.ok) {
      const data = await res.json();
      setSentimentData(data.sentimentOverTime || []);
      setTagCloud(data.tagCloud || []);
      setFeatures(data.featureBreakdown || []);
      setProductName(data.product?.name || "");
      setTotalReviews(data.totalReviews || 0);
    }
    setTrendLoading(false);
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="h-96 bg-zinc-900/50 border border-zinc-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const maxTag = tagCloud.length > 0 ? tagCloud[0].count : 1;

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Product Analytics</h1>
          <p className="text-zinc-500 mt-1">Trend analysis & review insights</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/seller/products/new"
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-medium rounded-xl transition-all"
          >
            + Add Product
          </Link>
          <Link
            href="/seller/dashboard"
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      {/* Product Selector */}
      <div className="mb-8">
        <select
          value={selectedProduct}
          onChange={(e) => setSelectedProduct(e.target.value)}
          className="px-4 py-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors"
        >
          {products.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name} ({p.category})
            </option>
          ))}
        </select>
      </div>

      {trendLoading ? (
        <div className="h-96 bg-zinc-900/50 border border-zinc-800 rounded-2xl animate-pulse" />
      ) : totalReviews === 0 ? (
        <div className="text-center py-20 bg-zinc-900/30 border border-zinc-800 rounded-2xl">
          <p className="text-zinc-500">No reviews yet for {productName}.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-1">{productName}</h2>
            <p className="text-sm text-zinc-500">{totalReviews} total reviews analysed</p>
          </div>

          {/* Sentiment Timeline (CSS-based chart) */}
          {sentimentData.length > 0 && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
              <h3 className="text-md font-semibold text-white mb-4">📈 Sentiment Over Time</h3>
              <div className="flex items-end gap-1 h-40">
                {sentimentData.map((point, idx) => {
                  const maxTotal = Math.max(...sentimentData.map((d) => d.total));
                  const height = maxTotal > 0 ? (point.total / maxTotal) * 100 : 0;
                  const posRatio = point.total > 0 ? (point.positive / point.total) * 100 : 0;
                  const negRatio = point.total > 0 ? (point.negative / point.total) * 100 : 0;

                  return (
                    <div
                      key={idx}
                      className="flex-1 flex flex-col justify-end group relative min-w-[8px]"
                      style={{ height: "100%" }}
                    >
                      <div
                        className="rounded-t-sm overflow-hidden flex flex-col transition-all"
                        style={{ height: `${height}%` }}
                      >
                        <div className="bg-emerald-500" style={{ flex: posRatio }} />
                        <div className="bg-zinc-500" style={{ flex: 100 - posRatio - negRatio }} />
                        <div className="bg-red-500" style={{ flex: negRatio }} />
                      </div>

                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs hidden group-hover:block whitespace-nowrap z-10">
                        <p className="text-white font-medium">{point.date}</p>
                        <p className="text-emerald-400">+{point.positive}</p>
                        <p className="text-red-400">-{point.negative}</p>
                        <p className="text-zinc-400">Avg: {point.avgRating}★</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-xs text-zinc-600">
                <span>{sentimentData[0]?.date}</span>
                <span>{sentimentData[sentimentData.length - 1]?.date}</span>
              </div>
              <div className="flex gap-4 mt-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500 rounded-sm" /> Positive</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-zinc-500 rounded-sm" /> Neutral</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-sm" /> Negative</span>
              </div>
            </div>
          )}

          {/* Tag Cloud */}
          {tagCloud.length > 0 && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
              <h3 className="text-md font-semibold text-white mb-4">🏷️ Tag Cloud</h3>
              <div className="flex flex-wrap gap-2">
                {tagCloud.map((item) => {
                  const scale = 0.7 + (item.count / maxTag) * 0.6;
                  const opacity = 0.4 + (item.count / maxTag) * 0.6;
                  return (
                    <span
                      key={item.tag}
                      className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-xl transition-transform hover:scale-110"
                      style={{ fontSize: `${scale}rem`, opacity }}
                    >
                      {item.tag}
                      <span className="ml-1 text-indigo-500/50 text-xs">{item.count}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feature Breakdown */}
          {features.length > 0 && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
              <h3 className="text-md font-semibold text-white mb-4">🔍 Feature-Level Sentiment</h3>
              <div className="space-y-3">
                {features.map((f) => (
                  <div key={f.feature}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-zinc-300 capitalize">{f.feature}</span>
                      <span className="text-xs text-zinc-600">{f.total} mentions</span>
                    </div>
                    <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                      {f.positive > 0 && (
                        <div
                          className="bg-emerald-500 rounded-full"
                          style={{ width: `${(f.positive / f.total) * 100}%` }}
                        />
                      )}
                      {f.neutral > 0 && (
                        <div
                          className="bg-zinc-500 rounded-full"
                          style={{ width: `${(f.neutral / f.total) * 100}%` }}
                        />
                      )}
                      {f.negative > 0 && (
                        <div
                          className="bg-red-500 rounded-full"
                          style={{ width: `${(f.negative / f.total) * 100}%` }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
