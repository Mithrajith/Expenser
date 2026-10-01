import { NextResponse } from "next/server";

/**
 * Web Push subscriptions have been removed.
 * Reminders are now delivered via SMTP email.
 */
export async function POST() {
  return NextResponse.json({ error: "Web Push notifications have been replaced by email reminders." }, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json({ error: "Web Push notifications have been replaced by email reminders." }, { status: 410 });
}
