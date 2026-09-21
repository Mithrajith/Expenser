import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { AccountSchema } from "@/lib/validations";
import { recalculateAccountBalance } from "@/lib/balance";
import { ObjectId } from "mongodb";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const userObjectId = new ObjectId(session.id);

  const accounts = await db
    .collection("accounts")
    .find({ userId: userObjectId })
    .sort({ createdAt: 1 })
    .toArray();

  const formattedAccounts = accounts.map((acc) => ({
    id: acc._id.toString(),
    name: acc.name,
    type: acc.type,
    currency: acc.currency,
    openingBalance: acc.openingBalance || 0,
    currentBalance: acc.currentBalance ?? acc.openingBalance ?? 0,
    icon: acc.icon || "Wallet",
    color: acc.color || "#3B82F6",
    createdAt: acc.createdAt,
  }));

  return NextResponse.json({ accounts: formattedAccounts });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = AccountSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const db = await getDb();
    const userObjectId = new ObjectId(session.id);
    const data = parsed.data;

    const newAccount = {
      userId: userObjectId,
      name: data.name,
      type: data.type,
      currency: data.currency || "INR",
      openingBalance: data.openingBalance || 0,
      currentBalance: data.openingBalance || 0,
      icon: data.icon || "Wallet",
      color: data.color || "#3B82F6",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("accounts").insertOne(newAccount);
    const accountId = result.insertedId.toString();

    await recalculateAccountBalance(db, session.id, accountId);

    return NextResponse.json({
      success: true,
      account: { ...newAccount, id: accountId },
    });
  } catch (error) {
    console.error("Create account error:", error);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
