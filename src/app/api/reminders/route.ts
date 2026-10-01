import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ReminderSchema } from "@/lib/validations";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const userObjectId = new ObjectId(session.id);

  const reminders = await db
    .collection("reminders")
    .find({ userId: userObjectId })
    .sort({ _id: -1 })
    .toArray();

  return NextResponse.json({ reminders: reminders.map((reminder) => ({ ...reminder, id: reminder._id.toString() })) });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = ReminderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid reminder" }, { status: 400 });
    }

    const db = await getDb();
    const userObjectId = new ObjectId(session.id);
    const timeZone = parsed.data.timeZone?.trim() || "";

    const reminderDoc: Record<string, unknown> = {
      userId: userObjectId,
      title: parsed.data.title.trim(),
      message: parsed.data.message.trim(),
      time: parsed.data.time.trim(),
      repeat: parsed.data.repeat,
      enabled: parsed.data.enabled,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    if (timeZone) {
      reminderDoc.timeZone = timeZone;
    }

    const result = await db.collection("reminders").insertOne(reminderDoc);

    if (timeZone) {
      await db.collection("users").updateOne(
        { _id: userObjectId },
        { $set: { timeZone } }
      );
    }

    return NextResponse.json({
      success: true,
      reminder: {
        id: result.insertedId.toString(),
        userId: session.id,
        title: parsed.data.title.trim(),
        message: parsed.data.message.trim(),
        time: parsed.data.time.trim(),
        repeat: parsed.data.repeat,
        enabled: parsed.data.enabled,
        timeZone: timeZone || undefined,
      },
    });
  } catch (error) {
    console.error("Create reminder error:", error);
    return NextResponse.json({ error: "Failed to create reminder" }, { status: 500 });
  }
}
