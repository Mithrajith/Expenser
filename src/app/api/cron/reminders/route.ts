import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getReminderOccurrence, getZonedParts } from "@/lib/reminders";
import { hasEmailConfig, sendReminderEmail } from "@/lib/email";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const authToken = url.searchParams.get("token") || "";
  const expectedToken = process.env.CRON_SECRET || "";

  if (expectedToken && authToken !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasEmailConfig()) {
    return NextResponse.json(
      { error: "SMTP not configured. Set SMTP_HOST, SMTP_USERNAME and SMTP_PASSWORD." },
      { status: 503 }
    );
  }

  const db = await getDb();
  const reminders = await db.collection("reminders").find({ enabled: true }).toArray();
  const userIds = Array.from(new Set(reminders.map((r) => r.userId.toString()))).map(
    (id) => new ObjectId(id)
  );

  // Fetch user email + timezone for all relevant users in one query
  const users = await db
    .collection("users")
    .find({ _id: { $in: userIds } })
    .project({ timeZone: 1, name: 1, email: 1 })
    .toArray();

  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  let checked = 0;
  let sent = 0;
  const errors: string[] = [];

  for (const reminder of reminders) {
    checked += 1;
    const userId = reminder.userId.toString();
    const user = userMap.get(userId);

    if (!user?.email) {
      errors.push(`Reminder ${reminder._id}: user has no email`);
      continue;
    }

    const timeZone = user.timeZone || "UTC";
    const occurrence = getReminderOccurrence(
      reminder as unknown as Pick<import("@/lib/reminders").ReminderDoc, "repeat" | "time">,
      timeZone,
      new Date()
    );

    if (!occurrence.due) continue;

    // Idempotency check — skip if already sent for this occurrence
    const existingDelivery = await db.collection("reminder_deliveries").findOne({
      reminderId: reminder._id,
      occurrenceKey: occurrence.occurrenceKey,
    });

    if (existingDelivery) continue;

    // Record delivery first (optimistic lock to avoid duplicate sends)
    await db.collection("reminder_deliveries").insertOne({
      reminderId: reminder._id,
      userId: reminder.userId,
      occurrenceKey: occurrence.occurrenceKey,
      sentAt: new Date(),
    });

    try {
      await sendReminderEmail({
        to: user.email as string,
        toName: (user.name as string) || "there",
        reminderTitle: reminder.title,
        reminderMessage: reminder.message,
      });

      // Update last_sent_at on the reminder document
      await db
        .collection("reminders")
        .updateOne({ _id: reminder._id }, { $set: { last_sent_at: new Date() } });

      sent += 1;
    } catch (emailError) {
      console.error(`Failed to send email for reminder ${reminder._id}:`, emailError);
      errors.push(`Reminder ${reminder._id}: ${emailError instanceof Error ? emailError.message : "unknown error"}`);
      // Roll back the delivery record so it retries next time
      await db.collection("reminder_deliveries").deleteOne({
        reminderId: reminder._id,
        occurrenceKey: occurrence.occurrenceKey,
      });
    }

    // Disable one-time reminders after sending
    if (reminder.repeat === "once") {
      await db.collection("reminders").updateOne({ _id: reminder._id }, { $set: { enabled: false } });
    }
  }

  return NextResponse.json({
    success: true,
    checked,
    sent,
    errors: errors.length ? errors : undefined,
    timestamp: getZonedParts(new Date(), "UTC"),
  });
}

export async function POST(req: Request) {
  return GET(req);
}
