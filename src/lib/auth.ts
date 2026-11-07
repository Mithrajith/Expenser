import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { getDb } from "./mongodb";
import { ObjectId } from "mongodb";

const SECRET_KEY = new TextEncoder().encode(
  process.env.AUTH_SECRET || "moneytrack_super_secret_local_dev_key_32bytes_long!!"
);

const SESSION_COOKIE_NAME = "moneytrack_session";
const SESSION_EXPIRY_DAYS = 30;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  currency?: string;
}

export interface MobileSessionUser {
  userId: string;
  deviceId: string;
  email: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(user: SessionUser): Promise<string> {
  const token = await new SignJWT({
    id: user.id,
    name: user.name,
    email: user.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_EXPIRY_DAYS}d`)
    .sign(SECRET_KEY);

  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * SESSION_EXPIRY_DAYS,
    });
  } catch {
    // cookies() might not be writable in some contexts, token is still returned
  }

  return token;
}

export async function createMobileTokens(
  user: { id: string; email: string },
  deviceId: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const accessToken = await new SignJWT({
    userId: user.id,
    email: user.email,
    deviceId,
    type: "access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(SECRET_KEY);

  const refreshToken = await new SignJWT({
    userId: user.id,
    email: user.email,
    deviceId,
    type: "refresh",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("90d")
    .sign(SECRET_KEY);

  return { accessToken, refreshToken, expiresIn: 3600 };
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    // If it's a mobile access token
    if (payload.userId && typeof payload.userId === "string") {
      const db = await getDb();
      const user = await db.collection("users").findOne({ _id: new ObjectId(payload.userId) });
      if (user) {
        return {
          id: user._id.toString(),
          name: user.name || "",
          email: user.email || (payload.email as string) || "",
          currency: user.baseCurrency || "INR",
        };
      }
    }

    if (payload.id && typeof payload.id === "string") {
      return {
        id: payload.id as string,
        name: (payload.name as string) || "",
        email: (payload.email as string) || "",
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function verifyMobileToken(req?: Request): Promise<MobileSessionUser | null> {
  let token: string | undefined;

  if (req) {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token) {
    try {
      const headerStore = await headers();
      const authHeader = headerStore.get("authorization") || headerStore.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      }
    } catch {
      // ignore
    }
  }

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    if (payload.type !== "access" && payload.type !== "refresh") {
      // If regular session token, still allow if userId/id present
      const userId = (payload.userId || payload.id) as string;
      if (userId) {
        return {
          userId,
          deviceId: (payload.deviceId as string) || "generic",
          email: (payload.email as string) || "",
        };
      }
      return null;
    }

    const userId = payload.userId as string;
    const deviceId = payload.deviceId as string;

    const db = await getDb();
    const device = await db.collection("mobile_devices").findOne({
      deviceId,
      userId: new ObjectId(userId),
      revokedAt: null,
    });

    if (!device) {
      // Check if user still exists
      const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });
      if (!user) return null;
    }

    return {
      userId,
      deviceId,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<{ userId: string; deviceId: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    if (payload.type !== "refresh") {
      return null;
    }

    return {
      userId: payload.userId as string,
      deviceId: payload.deviceId as string,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}

export async function getSession(request?: Request): Promise<SessionUser | null> {
  let token: string | undefined;

  if (request) {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token) {
    try {
      const headerStore = await headers();
      const authHeader = headerStore.get("authorization") || headerStore.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      }
    } catch {
      // ignore
    }
  }

  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      // ignore
    }
  }

  if (!token) return null;
  return verifySessionToken(token);
}

export async function destroySession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch {
    // ignore
  }
}

export async function getUserById(userId: string) {
  const db = await getDb();
  return db.collection("users").findOne({ _id: new ObjectId(userId) });
}
