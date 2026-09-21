import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { RegisterSchema } from "@/lib/validations";
import { hashPassword, createSession } from "@/lib/auth";
import { seedUserData } from "@/lib/default-data";
import { ensureIndexes } from "@/lib/db-indexes";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const { name, email, password, baseCurrency } = parsed.data;

    let db;
    try {
      db = await getDb();
      await ensureIndexes();
    } catch (dbErr: unknown) {
      console.error("MongoDB Connection Error during Register:", dbErr);
      const errMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      return NextResponse.json(
        { error: `Database Connection Error: ${errMsg}. Please verify MongoDB Atlas IP whitelist (0.0.0.0/0) and credentials.` },
        { status: 500 }
      );
    }

    const existingUser = await db.collection("users").findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json({ error: "Email is already registered" }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const result = await db.collection("users").insertOne({
      name,
      email: email.toLowerCase(),
      passwordHash,
      baseCurrency: baseCurrency || "INR",
      createdAt: new Date(),
    });

    const userId = result.insertedId.toString();

    // Automatically seed default categories and accounts
    await seedUserData(db, userId);

    // Create session cookie
    await createSession({
      id: userId,
      name,
      email: email.toLowerCase(),
      currency: baseCurrency || "INR",
    });

    return NextResponse.json({
      success: true,
      user: { id: userId, name, email: email.toLowerCase(), currency: baseCurrency || "INR" },
    });
  } catch (error: unknown) {
    console.error("Register error:", error);
    const errMsg = error instanceof Error ? error.message : "Failed to register user";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
