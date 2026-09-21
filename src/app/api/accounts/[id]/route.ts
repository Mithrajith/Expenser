import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { AccountSchema } from "@/lib/validations";
import { recalculateAccountBalance } from "@/lib/balance";
import { ObjectId } from "mongodb";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid account ID" }, { status: 400 });

  try {
    const body = await req.json();
    const parsed = AccountSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const db = await getDb();
    const userObjectId = new ObjectId(session.id);
    const accObjectId = new ObjectId(id);

    const data = parsed.data;
    const result = await db.collection("accounts").updateOne(
      { _id: accObjectId, userId: userObjectId },
      {
        $set: {
          name: data.name,
          type: data.type,
          currency: data.currency,
          openingBalance: data.openingBalance,
          icon: data.icon,
          color: data.color,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    await recalculateAccountBalance(db, session.id, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update account error:", error);
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid account ID" }, { status: 400 });

  try {
    const db = await getDb();
    const userObjectId = new ObjectId(session.id);
    const accObjectId = new ObjectId(id);

    // Check if account has transactions
    const txCount = await db.collection("transactions").countDocuments({
      userId: userObjectId,
      $or: [{ accountId: accObjectId }, { toAccountId: accObjectId }],
    });

    if (txCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete account with existing transactions. Delete transactions first." },
        { status: 400 }
      );
    }

    await db.collection("accounts").deleteOne({ _id: accObjectId, userId: userObjectId });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
