import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "echosight-dev-secret-change-in-prod"
);

// Routes that don't need auth
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/api/auth/login",
  "/api/auth/register",
  "/api/health",
  "/api/internal/review-maintenance",
];

// Role-based route mapping
const ROLE_ROUTES: Record<string, string[]> = {
  customer: ["/products", "/my-reviews", "/api/customer"],
  seller: ["/seller", "/api/seller"],
  admin: ["/admin", "/api/admin"],
};

// Where each role goes after login
const ROLE_HOMES: Record<string, string> = {
  customer: "/products",
  seller: "/seller/dashboard",
  admin: "/admin/dashboard",
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || pathname === "/") {
    return NextResponse.next();
  }

  // Allow API auth routes and health
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Get token
  const token = req.cookies.get("auth-token")?.value;

  if (!token) {
    // Not logged in → redirect to login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const role = payload.role as string;

    // If logged in and visiting login/register → redirect to home
    if (pathname === "/login" || pathname === "/register") {
      return NextResponse.redirect(new URL(ROLE_HOMES[role] || "/products", req.url));
    }

    // Check role-based access for protected route groups
    for (const [routeRole, paths] of Object.entries(ROLE_ROUTES)) {
      for (const path of paths) {
        if (pathname.startsWith(path) && role !== routeRole) {
          // Wrong role trying to access this route
          if (pathname.startsWith("/api/")) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
          }
          return NextResponse.redirect(new URL(ROLE_HOMES[role] || "/products", req.url));
        }
      }
    }

    return NextResponse.next();
  } catch {
    // Invalid token → clear and redirect
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL("/login", req.url));
    response.cookies.set("auth-token", "", { maxAge: 0, path: "/" });
    return response;
  }
}

export const config = {
  matcher: [
    // Match everything except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
