import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { restoreUserBackup } from "@/lib/import-export/backup";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "No JSON backup file uploaded" }, { status: 400 });

    const text = await file.text();
    const backupData = JSON.parse(text);

    if (!backupData.version || !backupData.transactions) {
      return NextResponse.json({ error: "Invalid backup file structure" }, { status: 400 });
    }

    const db = await getDb();
    const result = await restoreUserBackup(db, session.id, backupData);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Restore backup error:", error);
    return NextResponse.json({ error: "Failed to restore backup" }, { status: 500 });
  }
}
