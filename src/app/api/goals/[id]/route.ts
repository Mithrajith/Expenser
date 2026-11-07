import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { GoalSchema } from "@/lib/validations";
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
    const goal = await db.collection("savings_goals").findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(session.id),
    });

    if (!goal) return NextResponse.json({ error: "Savings goal not found" }, { status: 404 });
    return NextResponse.json({ success: true, goal: { id: goal._id.toString(), ...goal } });
  } catch (error) {
    console.error("Get goal error:", error);
    return NextResponse.json({ error: "Failed to get savings goal" }, { status: 500 });
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
    const parsed = GoalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const db = await getDb();
    const updateDoc = {
      title: parsed.data.title,
      targetAmount: parsed.data.targetAmount,
      currentAmount: parsed.data.currentAmount,
      targetDate: parsed.data.targetDate || null,
      category: parsed.data.category || "General",
      notes: parsed.data.notes || "",
      updatedAt: new Date(),
    };

    const res = await db.collection("savings_goals").updateOne(
      { _id: new ObjectId(id), userId: new ObjectId(session.id) },
      { $set: updateDoc }
    );

    if (res.matchedCount === 0) {
      return NextResponse.json({ error: "Savings goal not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Savings goal updated" });
  } catch (error) {
    console.error("Update goal error:", error);
    return NextResponse.json({ error: "Failed to update savings goal" }, { status: 500 });
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
    const res = await db.collection("savings_goals").deleteOne({
      _id: new ObjectId(id),
      userId: new ObjectId(session.id),
    });

    if (res.deletedCount === 0) {
      return NextResponse.json({ error: "Savings goal not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Savings goal deleted" });
  } catch (error) {
    console.error("Delete goal error:", error);
    return NextResponse.json({ error: "Failed to delete savings goal" }, { status: 500 });
  }
}
