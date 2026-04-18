"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      // Fetch user to determine role-based redirect
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      const role = data.user?.role;

      if (role === "seller") router.push("/seller/dashboard");
      else if (role === "admin") router.push("/admin/dashboard");
      else router.push("/products");
    } else {
      setError(result.error || "Login failed");
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/40 via-zinc-950 to-violet-950/30" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 mb-4">
            <span className="text-white font-bold text-2xl">E</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-zinc-500 mt-1">Sign in to EchoSight</p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-2xl p-8 space-y-5"
        >
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Signing in…
              </span>
            ) : (
              "Sign In"
            )}
          </button>

          <p className="text-center text-sm text-zinc-500">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              Register
            </Link>
          </p>
        </form>

        {/* Demo credentials */}
        <div className="mt-6 bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-4">
          <p className="text-xs font-medium text-zinc-500 mb-2">Demo Credentials</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-zinc-600">
            <span>Admin: admin@echosight.com</span>
            <span>Pass: admin123</span>
            <span>Seller: seller@echosight.com</span>
            <span>Pass: seller123</span>
          </div>
        </div>
      </div>
    </div>
  );
}
