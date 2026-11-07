import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { verifyMobileToken, getSession } from "@/lib/auth";
import { recalculateAccountBalance } from "@/lib/balance";

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

    const accounts = await db.collection("accounts").find({ userId: userObjectId }).toArray();
    const categories = await db.collection("categories").find({ userId: userObjectId }).toArray();
    const transactions = await db
      .collection("transactions")
      .find({ userId: userObjectId })
      .sort({ transactionDate: -1, transactionTime: -1 })
      .limit(1000)
      .toArray();

    return NextResponse.json({
      success: true,
      accounts: accounts.map((a) => ({
        id: a._id.toString(),
        name: a.name,
        type: a.type,
        currency: a.currency || "INR",
        balance: a.balance || a.currentBalance || 0,
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
    console.error("Pull cloud data error:", error);
    return NextResponse.json({ error: "Failed to pull cloud data" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const mobileSession = await verifyMobileToken(req);
  const webSession = !mobileSession ? await getSession(req) : null;
  const userId = mobileSession?.userId || webSession?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized mobile device" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const events = Array.isArray(body.events) ? body.events : [];

    if (events.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        syncedCount: 0,
        duplicateCount: 0,
        failedCount: 0,
        results: [],
        message: "No events provided in batch",
      });
    }

    const db = await getDb();
    const userObjectId = new ObjectId(userId);

    const accounts = await db.collection("accounts").find({ userId: userObjectId }).toArray();
    const defaultAccount = accounts[0];

    const results = [];
    const affectedAccountIds = new Set<string>();

    let syncedCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;

    for (const ev of events) {
      if (!ev.clientEventId || typeof ev.amountPaise !== "number" || ev.amountPaise <= 0) {
        results.push({
          clientEventId: ev.clientEventId || "unknown",
          status: "REJECTED",
          isDuplicate: false,
          message: "Invalid event data: clientEventId and positive amountPaise are required",
        });
        failedCount++;
        continue;
      }

      // Check Server-Side Idempotency
      const existingSync = await db.collection("mobile_synced_events").findOne({
        userId: userObjectId,
        clientEventId: ev.clientEventId,
      });

      if (existingSync) {
        results.push({
          clientEventId: ev.clientEventId,
          status: "SYNCED",
          transactionId: existingSync.transactionId?.toString(),
          isDuplicate: true,
          message: "Already synchronized previously (idempotent)",
        });
        duplicateCount++;
        continue;
      }

      // Check duplicate by Reference / UTR
      if (ev.reference && ev.reference.trim().length > 4) {
        const dupByRef = await db.collection("mobile_synced_events").findOne({
          userId: userObjectId,
          reference: ev.reference.trim(),
        });
        if (dupByRef) {
          results.push({
            clientEventId: ev.clientEventId,
            status: "DUPLICATE",
            transactionId: dupByRef.transactionId?.toString(),
            isDuplicate: true,
            message: `Duplicate detected with reference ${ev.reference}`,
          });
          duplicateCount++;
          continue;
        }
      }

      // Resolve Target Account
      let selectedAccount = accounts.find((a) => a._id.toString() === ev.targetAccountId);

      if (!selectedAccount && ev.bankAccountHint) {
        selectedAccount = accounts.find(
          (a) =>
            a.name.toLowerCase().includes(ev.bankAccountHint.toLowerCase()) ||
            (a.description && a.description.toLowerCase().includes(ev.bankAccountHint.toLowerCase()))
        );
      }

      if (!selectedAccount && defaultAccount) {
        selectedAccount = defaultAccount;
      }

      if (!selectedAccount) {
        // Create a default Bank account if user has none
        const newAcc = {
          userId: userObjectId,
          name: "Default Account",
          type: "BANK",
          currency: ev.currency || "INR",
          openingBalance: 0,
          currentBalance: 0,
          icon: "Wallet",
          color: "#3B82F6",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const ins = await db.collection("accounts").insertOne(newAcc);
        selectedAccount = { ...newAcc, _id: ins.insertedId };
        accounts.push(selectedAccount);
      }

      // Resolve Category
      let categoryId: ObjectId | null = null;
      if (ev.categoryId && ObjectId.isValid(ev.categoryId)) {
        categoryId = new ObjectId(ev.categoryId);
      } else {
        const categories = await db.collection("categories").find({ userId: userObjectId }).toArray();
        const fallbackCat = categories.find((c) => c.name.toLowerCase() === "miscellaneous") || categories[0];
        if (fallbackCat) {
          categoryId = fallbackCat._id;
        }
      }

      const amountRupees = ev.amountPaise / 100.0;
      const txDoc = {
        userId: userObjectId,
        type: ev.type || "EXPENSE",
        amount: amountRupees,
        currency: ev.currency || "INR",
        accountId: selectedAccount._id,
        toAccountId: ev.toAccountId && ObjectId.isValid(ev.toAccountId) ? new ObjectId(ev.toAccountId) : undefined,
        categoryId: categoryId,
        subcategoryId: ev.subcategoryId || undefined,
        title: ev.title || ev.merchant || "Mobile Transaction",
        description: ev.description || "",
        transactionDate: ev.transactionDate,
        transactionTime: ev.transactionTime || "12:00",
        source: ev.source || "MOBILE_SYNC",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const txResult = await db.collection("transactions").insertOne(txDoc);
      const transactionId = txResult.insertedId;

      await db.collection("mobile_synced_events").insertOne({
        userId: userObjectId,
        clientEventId: ev.clientEventId,
        transactionId,
        source: ev.source,
        reference: ev.reference || null,
        amountPaise: ev.amountPaise,
        syncedAt: new Date(),
      });

      affectedAccountIds.add(selectedAccount._id.toString());
      if (txDoc.toAccountId) {
        affectedAccountIds.add(txDoc.toAccountId.toString());
      }

      results.push({
        clientEventId: ev.clientEventId,
        status: "SYNCED",
        transactionId: transactionId.toString(),
        isDuplicate: false,
        message: "Successfully synchronized to cloud database",
      });
      syncedCount++;
    }

    // Recalculate balances for all affected accounts
    for (const accId of affectedAccountIds) {
      await recalculateAccountBalance(db, userId, accId);
    }

    if (mobileSession?.deviceId) {
      await db.collection("mobile_devices").updateOne(
        { deviceId: mobileSession.deviceId },
        { $set: { lastSyncAt: new Date() } }
      );
    }

    return NextResponse.json({
      success: true,
      processed: events.length,
      syncedCount,
      duplicateCount,
      failedCount,
      results,
    });
  } catch (error) {
    console.error("Batch sync error:", error);
    return NextResponse.json({ error: "Failed to process batch sync" }, { status: 500 });
  }
}
