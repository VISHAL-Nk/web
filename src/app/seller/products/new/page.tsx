"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const CATEGORIES = ["electronics", "food", "clothing", "home", "sports", "beauty", "books"];

export default function NewProductPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("electronics");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/seller/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        category,
        price: parseFloat(price),
        imageUrl: imageUrl || undefined,
      }),
    });

    if (res.ok) {
      toast.success("Product created successfully!");
      router.push("/seller/dashboard");
    } else {
      const data = await res.json();
      const errorMessage = data.error || "Failed to create product";
      toast.error(errorMessage);
      setError(errorMessage);
    }
    setLoading(false);
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-white mb-2">Add New Product</h1>
      <p className="text-zinc-500 mb-8">List a new product for customer reviews</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">Product Name *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
            placeholder="e.g. UltraPhone X300"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">Description *</label>
          <textarea
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 resize-none"
            placeholder="Describe your product…"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Category *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Price (₹) *</label>
            <input
              type="number"
              required
              min={1}
              step={0.01}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              placeholder="999"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">Image URL (optional)</label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
            placeholder="https://example.com/image.jpg"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium rounded-xl transition-all disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create Product"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
