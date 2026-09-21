import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { seedUserData } from "@/lib/default-data";
import { recalculateAllUserBalances } from "@/lib/balance";
import { ObjectId } from "mongodb";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = await getDb();
    const userObjectId = new ObjectId(session.id);

    // Delete all user's transactions, accounts, and categories
    await db.collection("transactions").deleteMany({ userId: userObjectId });
    await db.collection("accounts").deleteMany({ userId: userObjectId });
    await db.collection("categories").deleteMany({ userId: userObjectId });

    // Seed clean default categories and accounts
    await seedUserData(db, session.id);
    await recalculateAllUserBalances(db, session.id);

    return NextResponse.json({ success: true, message: "All user data reset successfully" });
  } catch (error) {
    console.error("Reset data error:", error);
    return NextResponse.json({ error: "Failed to reset data" }, { status: 500 });
  }
}
