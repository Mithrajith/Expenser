import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { GoalSchema } from "@/lib/validations";
import { ObjectId } from "mongodb";

export async function GET(req: Request) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = await getDb();
    const userObjectId = new ObjectId(session.id);
    const goals = await db.collection("savings_goals").find({ userId: userObjectId }).toArray();

    return NextResponse.json({
      success: true,
      goals: goals.map((g) => ({
        id: g._id.toString(),
        title: g.title,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount || 0,
        percentage: Math.min(100, Math.round(((g.currentAmount || 0) / g.targetAmount) * 100)),
        targetDate: g.targetDate || null,
        category: g.category || "General",
        notes: g.notes || "",
        createdAt: g.createdAt,
      })),
    });
  } catch (error) {
    console.error("Fetch goals error:", error);
    return NextResponse.json({ error: "Failed to fetch savings goals" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = GoalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const db = await getDb();
    const userObjectId = new ObjectId(session.id);

    const doc = {
      userId: userObjectId,
      title: parsed.data.title,
      targetAmount: parsed.data.targetAmount,
      currentAmount: parsed.data.currentAmount || 0,
      targetDate: parsed.data.targetDate || null,
      category: parsed.data.category || "General",
      notes: parsed.data.notes || "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const res = await db.collection("savings_goals").insertOne(doc);
    return NextResponse.json({
      success: true,
      goal: { id: res.insertedId.toString(), ...doc, userId: session.id },
    });
  } catch (error) {
    console.error("Create goal error:", error);
    return NextResponse.json({ error: "Failed to create savings goal" }, { status: 500 });
  }
}
