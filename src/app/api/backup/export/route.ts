import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { exportUserBackup } from "@/lib/import-export/backup";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const backup = await exportUserBackup(db, session.id);

  const jsonStr = JSON.stringify(backup, null, 2);
  const fileName = `money_track_backup_${new Date().toISOString().substring(0, 10)}.json`;

  return new NextResponse(jsonStr, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
