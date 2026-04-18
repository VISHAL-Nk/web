"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

interface AlertRelatedProduct {
  _id: string;
  name?: string;
  category?: string;
}

interface AlertItem {
  _id: string;
  title: string;
  message: string;
  createdAt: string;
  relatedProductId?: string | AlertRelatedProduct | null;
}

const ROLE_NAV: Record<string, { label: string; href: string }[]> = {
  customer: [
    { label: "Products", href: "/products" },
    { label: "My Reviews", href: "/my-reviews" },
  ],
  seller: [
    { label: "Dashboard", href: "/seller/dashboard" },
    { label: "My Products", href: "/seller/products" },
    { label: "Replies", href: "/seller/replies" },
  ],
  admin: [
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "Moderation", href: "/admin/moderation" },
  ],
};

const ROLE_COLORS: Record<string, string> = {
  customer: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  seller: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  admin: "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (user && (user.role === "admin" || user.role === "seller")) {
      fetchAlerts();
      const interval = setInterval(fetchAlerts, 60000); // 1 min poll
      return () => clearInterval(interval);
    }
  }, [user]);

  async function fetchAlerts() {
    const res = await fetch("/api/alerts?unreadOnly=true");
    if (res.ok) {
      const data = await res.json();
      setAlerts(data.alerts || []);
      setUnreadCount(data.unreadCount || 0);
    }
  }

  async function markAsRead(id: string) {
    const res = await fetch(`/api/alerts/${id}/read`, { method: "PATCH" });
    if (res.ok) {
      fetchAlerts();
    }
  }

  function getAlertTarget(alert: AlertItem): string {
    const relatedProductId =
      typeof alert?.relatedProductId === "string"
        ? alert.relatedProductId
        : alert?.relatedProductId?._id
          ? String(alert.relatedProductId._id)
          : "";

    if (user?.role === "seller" && relatedProductId) {
      return `/seller/products/${relatedProductId}/analytics`;
    }

    if (user?.role === "admin") {
      return relatedProductId
        ? `/admin/moderation?productId=${relatedProductId}`
        : "/admin/moderation";
    }

    return "/";
  }

  async function openAlert(alert: AlertItem) {
    await markAsRead(alert._id);
    setShowDropdown(false);
    router.push(getAlertTarget(alert));
  }

  if (loading) {
    return (
      <nav className="h-16 bg-zinc-950 border-b border-zinc-800 flex items-center px-6">
        <span className="text-zinc-500 text-sm animate-pulse">Loading…</span>
      </nav>
    );
  }

  if (!user) return null;

  const links = ROLE_NAV[user.role] || [];

  return (
    <nav className="h-16 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800 flex items-center px-6 sticky top-0 z-50">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 mr-8">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
          E
        </div>
        <span className="text-white font-semibold text-lg tracking-tight">EchoSight</span>
      </Link>

      {/* Nav links */}
      <div className="flex items-center gap-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-4 relative">
        {/* Alerts Bell (only for seller/admin) */}
        {(user.role === "admin" || user.role === "seller") && (
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="p-2 text-zinc-400 hover:text-white transition-colors relative"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-zinc-950">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* Alerts Dropdown */}
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
                  <span className="text-sm font-semibold text-white">Notifications</span>
                  <span className="text-xs text-zinc-500">{unreadCount} unread</span>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {alerts.length === 0 ? (
                    <div className="p-4 text-center text-zinc-500 text-sm">No new alerts</div>
                  ) : (
                    alerts.map((alert) => (
                      <button
                        key={alert._id}
                        type="button"
                        onClick={() => openAlert(alert)}
                        className="w-full text-left p-4 border-b border-zinc-800 hover:bg-zinc-800/50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <span className="text-xs font-semibold text-white">{alert.title}</span>
                          <span className="text-[10px] text-zinc-500">
                            {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 line-clamp-2">{alert.message}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Role badge */}
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full border ${ROLE_COLORS[user.role]}`}
        >
          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
        </span>

        {/* User name */}
        <span className="text-sm text-zinc-300">{user.name}</span>

        {/* Logout */}
        <button
          onClick={logout}
          className="text-sm text-zinc-500 hover:text-white px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
