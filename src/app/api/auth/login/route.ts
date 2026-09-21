import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { LoginSchema } from "@/lib/validations";
import { verifyPassword, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const { email, password } = parsed.data;

    let db;
    try {
      db = await getDb();
    } catch (dbErr: unknown) {
      console.error("MongoDB Connection Error during Login:", dbErr);
      const errMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      return NextResponse.json(
        { error: `Database Connection Error: ${errMsg}. Please verify MongoDB Atlas IP whitelist (0.0.0.0/0) and credentials.` },
        { status: 500 }
      );
    }

    const user = await db.collection("users").findOne({ email: email.toLowerCase() });
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const userId = user._id.toString();
    await createSession({
      id: userId,
      name: user.name,
      email: user.email,
      currency: user.baseCurrency || "INR",
    });

    return NextResponse.json({
      success: true,
      user: { id: userId, name: user.name, email: user.email, currency: user.baseCurrency || "INR" },
    });
  } catch (error: unknown) {
    console.error("Login error:", error);
    const errMsg = error instanceof Error ? error.message : "Failed to log in";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
