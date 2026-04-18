"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      if (user.role === "seller") router.replace("/seller/dashboard");
      else if (user.role === "admin") router.replace("/admin/dashboard");
      else router.replace("/products");
    } else if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="animate-pulse text-zinc-500">Redirecting…</div>
    </div>
  );
}
