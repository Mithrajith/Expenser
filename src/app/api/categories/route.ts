import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { CategorySchema } from "@/lib/validations";
import { ObjectId } from "mongodb";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const userObjectId = new ObjectId(session.id);

  const categories = await db
    .collection("categories")
    .find({ userId: userObjectId })
    .sort({ name: 1 })
    .toArray();

  const formatted = categories.map((cat) => ({
    id: cat._id.toString(),
    name: cat.name,
    type: cat.type || "EXPENSE",
    icon: cat.icon || "Tag",
    color: cat.color || "#10B981",
    subcategories: cat.subcategories || [],
    createdAt: cat.createdAt,
  }));

  return NextResponse.json({ categories: formatted });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = CategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const db = await getDb();
    const userObjectId = new ObjectId(session.id);
    const data = parsed.data;

    const newCategory = {
      userId: userObjectId,
      name: data.name,
      type: data.type || "EXPENSE",
      icon: data.icon || "Tag",
      color: data.color || "#10B981",
      subcategories: data.subcategories || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("categories").insertOne(newCategory);

    return NextResponse.json({
      success: true,
      category: { ...newCategory, id: result.insertedId.toString() },
    });
  } catch (error) {
    console.error("Create category error:", error);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
