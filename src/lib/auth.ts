import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "echosight-dev-secret-change-in-prod";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TokenPayload {
  userId: string;
  role: "customer" | "seller" | "admin";
  email: string;
}

// ── Token helpers ────────────────────────────────────────────────────────────

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

// ── Extract token from request ───────────────────────────────────────────────

export function getTokenFromRequest(req: NextRequest): TokenPayload | null {
  // Try cookie first
  const cookieToken = req.cookies.get("auth-token")?.value;
  if (cookieToken) {
    return verifyToken(cookieToken);
  }

  // Fallback to Authorization header
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return verifyToken(authHeader.slice(7));
  }

  return null;
}

// ── RBAC middleware factory ──────────────────────────────────────────────────

/**
 * Creates a higher-order function that wraps an API route handler
 * with role-based access control.
 *
 * Usage:
 * ```ts
 * export const POST = withRole(["seller"], async (req, { user }) => {
 *   // user is guaranteed to have role "seller"
 *   return NextResponse.json({ message: "Hello seller" });
 * });
 * ```
 */
export function withRole<T extends unknown[]>(
  allowedRoles: string[],
  handler: (
    req: NextRequest,
    context: { user: TokenPayload; params?: Record<string, string> },
    ...args: T
  ) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    const user = getTokenFromRequest(req);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized — please log in" },
        { status: 401 }
      );
    }

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: "Forbidden — insufficient permissions" },
        { status: 403 }
      );
    }

    // Extract route params from the second argument if it's an object with params
    let params: Record<string, string> | undefined;
    if (args.length > 0 && typeof args[0] === "object" && args[0] !== null) {
      const maybeCtx = args[0] as Record<string, unknown>;
      if (maybeCtx.params) {
        params = (await maybeCtx.params) as Record<string, string>;
      }
    }

    return handler(req, { user, params }, ...args);
  };
}
