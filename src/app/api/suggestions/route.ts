import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { getSmartSuggestions } from "@/lib/suggestions";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const field = (searchParams.get("field") as "title" | "category" | "subcategory" | "description") || "title";

  const db = await getDb();
  const suggestions = await getSmartSuggestions(db, session.id, query, field);

  return NextResponse.json({ suggestions });
}
