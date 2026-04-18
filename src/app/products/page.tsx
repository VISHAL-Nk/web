"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Product {
  _id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  imageUrl: string;
  reviewCount: number;
  avgRating: number;
}

const CATEGORIES = ["all", "electronics", "food", "clothing"];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-4 h-4 ${star <= Math.round(rating) ? "text-amber-400" : "text-zinc-700"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1.5 text-sm text-zinc-400">{rating > 0 ? rating.toFixed(1) : "—"}</span>
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, [category]);

  async function fetchProducts() {
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (search) params.set("search", search);

    const res = await fetch(`/api/customer/products?${params}`);
    const data = await res.json();
    setProducts(data.products || []);
    setLoading(false);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchProducts();
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-white mb-2">Products</h1>
      <p className="text-zinc-500 mb-8">Browse products and leave reviews</p>

      {/* Search & Category Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="flex-1 px-4 py-2.5 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors text-sm font-medium"
          >
            Search
          </button>
        </form>

        <div className="flex gap-1 bg-zinc-900/50 border border-zinc-800 rounded-xl p-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors capitalize ${
                category === cat
                  ? "bg-indigo-600 text-white"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 animate-pulse">
              <div className="w-full h-48 bg-zinc-800 rounded-xl mb-4" />
              <div className="h-4 bg-zinc-800 rounded w-3/4 mb-2" />
              <div className="h-3 bg-zinc-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <p className="text-lg">No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <Link
              key={product._id}
              href={`/products/${product._id}`}
              className="group bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden hover:border-indigo-500/50 transition-all hover:shadow-lg hover:shadow-indigo-500/5"
            >
              <div className="aspect-video bg-zinc-800 relative overflow-hidden">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600">
                    No Image
                  </div>
                )}
                <span className="absolute top-3 left-3 bg-zinc-900/80 backdrop-blur-sm text-xs text-zinc-300 px-2.5 py-1 rounded-lg capitalize">
                  {product.category}
                </span>
              </div>

              <div className="p-5">
                <h3 className="text-lg font-semibold text-white group-hover:text-indigo-400 transition-colors mb-1">
                  {product.name}
                </h3>
                <p className="text-sm text-zinc-500 line-clamp-2 mb-3">
                  {product.description}
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-white">
                    ₹{product.price.toLocaleString("en-IN")}
                  </span>
                  <div className="text-right">
                    <StarRating rating={product.avgRating} />
                    <p className="text-xs text-zinc-600 mt-0.5">
                      {product.reviewCount} review{product.reviewCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
