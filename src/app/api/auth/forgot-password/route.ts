import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, newPassword } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
    }

    const db = await getDb();
    const user = await db.collection("users").findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      // Don't leak user existence for generic recovery, but if newPassword requested without user return standard error
      return NextResponse.json({ error: "No account found with this email address" }, { status: 404 });
    }

    if (newPassword) {
      if (typeof newPassword !== "string" || newPassword.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }

      const passwordHash = await hashPassword(newPassword);
      await db.collection("users").updateOne(
        { _id: user._id },
        { $set: { passwordHash, updatedAt: new Date() } }
      );

      return NextResponse.json({
        success: true,
        message: "Password has been successfully reset. You can now log in with your new password.",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Email verified. You can now enter your new password to reset your account credentials.",
      verified: true,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Failed to process password recovery request" }, { status: 500 });
  }
}
