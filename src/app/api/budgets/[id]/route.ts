import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { BudgetSchema } from "@/lib/validations";
import { ObjectId } from "mongodb";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const budget = await db.collection("budgets").findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(session.id),
    });

    if (!budget) return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    return NextResponse.json({ success: true, budget: { id: budget._id.toString(), ...budget } });
  } catch (error) {
    console.error("Get budget error:", error);
    return NextResponse.json({ error: "Failed to get budget" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = BudgetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const db = await getDb();
    const updateDoc = {
      name: parsed.data.name,
      amount: parsed.data.amount,
      period: parsed.data.period,
      categoryId: parsed.data.categoryId ? new ObjectId(parsed.data.categoryId) : null,
      alertThreshold: parsed.data.alertThreshold,
      startDate: parsed.data.startDate || null,
      endDate: parsed.data.endDate || null,
      updatedAt: new Date(),
    };

    const res = await db.collection("budgets").updateOne(
      { _id: new ObjectId(id), userId: new ObjectId(session.id) },
      { $set: updateDoc }
    );

    if (res.matchedCount === 0) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Budget updated" });
  } catch (error) {
    console.error("Update budget error:", error);
    return NextResponse.json({ error: "Failed to update budget" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const res = await db.collection("budgets").deleteOne({
      _id: new ObjectId(id),
      userId: new ObjectId(session.id),
    });

    if (res.deletedCount === 0) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Budget deleted" });
  } catch (error) {
    console.error("Delete budget error:", error);
    return NextResponse.json({ error: "Failed to delete budget" }, { status: 500 });
  }
}
