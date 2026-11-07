import { NextResponse } from "next/server";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import {
  verifyPassword,
  createMobileTokens,
  hashToken,
} from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { pairingCode, email, username, password, deviceName, deviceModel } = body;
    const db = await getDb();
    let targetUser = null;

    const userIdentifier = (username || email || "").trim();

    if (userIdentifier && password) {
      const escaped = userIdentifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const user = await db.collection("users").findOne({
        $or: [
          { email: userIdentifier.toLowerCase() },
          { name: { $regex: new RegExp(`^${escaped}$`, "i") } },
        ],
      });

      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        return NextResponse.json({ error: "Invalid username/email or password" }, { status: 401 });
      }
      targetUser = user;
    } else if (pairingCode) {
      const codeRecord = await db.collection("mobile_pairing_codes").findOne({
        code: pairingCode.toString().trim(),
        usedAt: null,
        expiresAt: { $gt: new Date() },
      });

      if (!codeRecord) {
        return NextResponse.json({ error: "Invalid or expired pairing code." }, { status: 400 });
      }

      targetUser = await db.collection("users").findOne({ _id: codeRecord.userId });
      await db.collection("mobile_pairing_codes").updateOne(
        { _id: codeRecord._id },
        { $set: { usedAt: new Date() } }
      );
    } else {
      return NextResponse.json({ error: "Please enter your username/email and password" }, { status: 400 });
    }

    if (!targetUser) {
      return NextResponse.json({ error: "User account not found" }, { status: 404 });
    }

    const deviceId = crypto.randomUUID();
    const userIdStr = targetUser._id.toString();

    const { accessToken, refreshToken, expiresIn } = await createMobileTokens(
      { id: userIdStr, email: targetUser.email },
      deviceId
    );

    // Register mobile device
    await db.collection("mobile_devices").insertOne({
      deviceId,
      userId: targetUser._id,
      deviceName: deviceName || "Android Device",
      deviceModel: deviceModel || "Generic Android",
      refreshTokenHash: hashToken(refreshToken),
      lastSyncAt: null,
      createdAt: new Date(),
      revokedAt: null,
    });

    // Fetch initial list of accounts, categories, and transactions for offline local DB
    const accounts = await db.collection("accounts").find({ userId: targetUser._id }).toArray();
    const categories = await db.collection("categories").find({ userId: targetUser._id }).toArray();
    const transactions = await db
      .collection("transactions")
      .find({ userId: targetUser._id })
      .sort({ transactionDate: -1, transactionTime: -1 })
      .limit(1000)
      .toArray();

    return NextResponse.json({
      success: true,
      deviceId,
      accessToken,
      refreshToken,
      expiresIn,
      user: {
        id: userIdStr,
        name: targetUser.name,
        email: targetUser.email,
        baseCurrency: targetUser.baseCurrency || "INR",
      },
      accounts: accounts.map((a) => ({
        id: a._id.toString(),
        name: a.name,
        type: a.type,
        currency: a.currency || "INR",
        balance: a.balance || 0,
        openingBalance: a.openingBalance || 0,
        icon: a.icon || "Wallet",
        color: a.color || "#3B82F6",
      })),
      categories: categories.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        type: c.type || "EXPENSE",
        icon: c.icon || "Tag",
        color: c.color || "#10B981",
        subcategories: c.subcategories || [],
      })),
      transactions: transactions.map((t) => ({
        id: t._id.toString(),
        amount: t.amount,
        type: t.type,
        currency: t.currency || "INR",
        title: t.title,
        description: t.description || "",
        transactionDate: t.transactionDate,
        transactionTime: t.transactionTime || "12:00",
        accountId: t.accountId?.toString() || null,
        categoryId: t.categoryId?.toString() || null,
      })),
    });
  } catch (error) {
    console.error("Mobile pair error:", error);
    return NextResponse.json({ error: "Failed to pair mobile device" }, { status: 500 });
  }
}
