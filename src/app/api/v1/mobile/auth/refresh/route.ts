import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import {
  createMobileTokens,
  verifyRefreshToken,
  hashToken,
} from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { refreshToken } = body;

    if (!refreshToken) {
      return NextResponse.json({ error: "Missing refreshToken" }, { status: 400 });
    }

    const payload = await verifyRefreshToken(refreshToken);
    if (!payload) {
      return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
    }

    const db = await getDb();
    const tokenHash = hashToken(refreshToken);

    const device = await db.collection("mobile_devices").findOne({
      deviceId: payload.deviceId,
      userId: new ObjectId(payload.userId),
      refreshTokenHash: tokenHash,
      revokedAt: null,
    });

    if (!device) {
      return NextResponse.json({ error: "Device revoked or session invalid" }, { status: 401 });
    }

    const tokens = await createMobileTokens(
      { id: payload.userId, email: payload.email },
      payload.deviceId
    );

    await db.collection("mobile_devices").updateOne(
      { _id: device._id },
      { $set: { refreshTokenHash: hashToken(tokens.refreshToken), lastRefreshedAt: new Date() } }
    );

    return NextResponse.json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json({ error: "Failed to refresh token" }, { status: 500 });
  }
}
