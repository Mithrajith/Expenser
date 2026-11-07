import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { verifyMobileToken, getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const mobileSession = await verifyMobileToken(req);
  const webSession = !mobileSession ? await getSession(req) : null;
  const userId = mobileSession?.userId || webSession?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const userObjectId = new ObjectId(userId);

    const device = mobileSession?.deviceId
      ? await db.collection("mobile_devices").findOne({
          deviceId: mobileSession.deviceId,
          userId: userObjectId,
        })
      : null;

    const totalSyncedEvents = await db
      .collection("mobile_synced_events")
      .countDocuments({ userId: userObjectId });

    const totalTransactions = await db
      .collection("transactions")
      .countDocuments({ userId: userObjectId });

    return NextResponse.json({
      success: true,
      lastSyncAt: device?.lastSyncAt ? device.lastSyncAt.toISOString() : null,
      serverTransactionCount: totalTransactions,
      totalSyncedEvents,
      deviceId: mobileSession?.deviceId || null,
      deviceName: device?.deviceName || null,
    });
  } catch (error) {
    console.error("Sync status error:", error);
    return NextResponse.json({ error: "Failed to retrieve sync status" }, { status: 500 });
  }
}
