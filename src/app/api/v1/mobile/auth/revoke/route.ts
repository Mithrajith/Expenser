import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { verifyMobileToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await verifyMobileToken(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    await db.collection("mobile_devices").updateOne(
      { deviceId: session.deviceId, userId: new ObjectId(session.userId) },
      { $set: { revokedAt: new Date() } }
    );

    return NextResponse.json({ success: true, message: "Device session revoked successfully" });
  } catch (error) {
    console.error("Revoke error:", error);
    return NextResponse.json({ error: "Failed to revoke device session" }, { status: 500 });
  }
}
