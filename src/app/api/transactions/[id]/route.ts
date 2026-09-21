import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { TransactionSchema } from "@/lib/validations";
import { recalculateAccountBalance } from "@/lib/balance";
import { ObjectId } from "mongodb";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid transaction ID" }, { status: 400 });

  const db = await getDb();
  const tx = await db.collection("transactions").findOne({
    _id: new ObjectId(id),
    userId: new ObjectId(session.id),
  });

  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  return NextResponse.json({ transaction: { ...tx, id: tx._id.toString() } });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid transaction ID" }, { status: 400 });

  try {
    const body = await req.json();
    const parsed = TransactionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const db = await getDb();
    const userObjectId = new ObjectId(session.id);
    const txObjectId = new ObjectId(id);

    const existingTx = await db.collection("transactions").findOne({
      _id: txObjectId,
      userId: userObjectId,
    });

    if (!existingTx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const oldAccountId = existingTx.accountId.toString();
    const oldToAccountId = existingTx.toAccountId?.toString();

    const data = parsed.data;

    // Validate account ownership
    if (!ObjectId.isValid(data.accountId)) {
      return NextResponse.json({ error: "Invalid account ID" }, { status: 400 });
    }
    const newAccountObjId = new ObjectId(data.accountId);
    const accountExists = await db.collection("accounts").findOne({ _id: newAccountObjId, userId: userObjectId });
    if (!accountExists) {
      return NextResponse.json({ error: "Account not found or does not belong to user" }, { status: 400 });
    }

    // Validate destination account ownership if transfer
    let newToAccountObjId: ObjectId | undefined = undefined;
    if (data.type === "TRANSFER" && data.toAccountId) {
      if (!ObjectId.isValid(data.toAccountId)) {
        return NextResponse.json({ error: "Invalid destination account ID" }, { status: 400 });
      }
      newToAccountObjId = new ObjectId(data.toAccountId);
      const toAccountExists = await db.collection("accounts").findOne({ _id: newToAccountObjId, userId: userObjectId });
      if (!toAccountExists) {
        return NextResponse.json({ error: "Destination account not found or does not belong to user" }, { status: 400 });
      }
    }

    // Validate category ownership if categoryId provided
    let newCategoryObjId: ObjectId | undefined = undefined;
    if (data.categoryId) {
      if (!ObjectId.isValid(data.categoryId)) {
        return NextResponse.json({ error: "Invalid category ID" }, { status: 400 });
      }
      newCategoryObjId = new ObjectId(data.categoryId);
      const categoryExists = await db.collection("categories").findOne({ _id: newCategoryObjId, userId: userObjectId });
      if (!categoryExists) {
        return NextResponse.json({ error: "Category not found or does not belong to user" }, { status: 400 });
      }
    }

    const updatedFields = {
      type: data.type,
      amount: data.amount,
      currency: data.currency || "INR",
      accountId: newAccountObjId,
      toAccountId: newToAccountObjId,
      categoryId: newCategoryObjId,
      subcategoryId: data.subcategoryId || "",
      title: data.title,
      description: data.description || "",
      transactionDate: data.transactionDate,
      transactionTime: data.transactionTime,
      updatedAt: new Date(),
    };

    await db.collection("transactions").updateOne(
      { _id: txObjectId, userId: userObjectId },
      { $set: updatedFields }
    );

    // Recalculate old and new affected account balances
    await recalculateAccountBalance(db, session.id, oldAccountId);
    if (oldToAccountId) await recalculateAccountBalance(db, session.id, oldToAccountId);
    await recalculateAccountBalance(db, session.id, data.accountId);
    if (data.toAccountId) await recalculateAccountBalance(db, session.id, data.toAccountId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update transaction error:", error);
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid transaction ID" }, { status: 400 });

  try {
    const db = await getDb();
    const userObjectId = new ObjectId(session.id);
    const txObjectId = new ObjectId(id);

    const existingTx = await db.collection("transactions").findOne({
      _id: txObjectId,
      userId: userObjectId,
    });

    if (!existingTx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const accountId = existingTx.accountId.toString();
    const toAccountId = existingTx.toAccountId?.toString();

    await db.collection("transactions").deleteOne({
      _id: txObjectId,
      userId: userObjectId,
    });

    // Recalculate affected account balances
    await recalculateAccountBalance(db, session.id, accountId);
    if (toAccountId) await recalculateAccountBalance(db, session.id, toAccountId);

    return NextResponse.json({ success: true, deletedTransaction: existingTx });
  } catch (error) {
    console.error("Delete transaction error:", error);
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}
