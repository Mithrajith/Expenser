import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ReminderSchema } from "@/lib/validations";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const reminderId = new ObjectId(id);
    const body = await req.json();
    const parsed = ReminderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid reminder" }, { status: 400 });
    }

    const db = await getDb();
    const userObjectId = new ObjectId(session.id);
    const timeZone = parsed.data.timeZone?.trim() || "";

    const updateFields: Record<string, unknown> = {
      title: parsed.data.title.trim(),
      message: parsed.data.message.trim(),
      time: parsed.data.time.trim(),
      repeat: parsed.data.repeat,
      enabled: parsed.data.enabled,
      updatedAt: new Date(),
    };
    if (timeZone) {
      updateFields.timeZone = timeZone;
    }

    const result = await db.collection("reminders").findOneAndUpdate(
      { _id: reminderId, userId: userObjectId },
      { $set: updateFields },
      { returnDocument: "after" }
    );

    if (timeZone) {
      await db.collection("users").updateOne(
        { _id: userObjectId },
        { $set: { timeZone } }
      );
    }

    if (!result) return NextResponse.json({ error: "Reminder not found" }, { status: 404 });

    return NextResponse.json({
      success: true,
      reminder: { ...result, id: result._id.toString() },
    });
  } catch (error) {
    console.error("Update reminder error:", error);
    return NextResponse.json({ error: "Failed to update reminder" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const db = await getDb();
    const result = await db.collection("reminders").deleteOne({
      _id: new ObjectId(id),
      userId: new ObjectId(session.id),
    });

    if (!result.deletedCount) return NextResponse.json({ error: "Reminder not found" }, { status: 404 });

    await db.collection("reminder_deliveries").deleteMany({ reminderId: new ObjectId(id), userId: new ObjectId(session.id) });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete reminder error:", error);
    return NextResponse.json({ error: "Failed to delete reminder" }, { status: 500 });
  }
}
