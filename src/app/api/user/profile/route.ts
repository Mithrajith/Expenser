import { NextResponse } from "next/server";
import { getSession, hashPassword, verifyPassword, createSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, email, baseCurrency, currentPassword, newPassword } = body;

    const db = await getDb();
    const userObjectId = new ObjectId(session.id);

    const currentUser = await db.collection("users").findOne({ _id: userObjectId });
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    let updatedName = currentUser.name;
    let updatedEmail = currentUser.email;
    let updatedCurrency = currentUser.baseCurrency || "INR";

    // Update Name / Username if provided
    if (typeof name === "string" && name.trim().length > 0) {
      updatedName = name.trim();
      updates.name = updatedName;
    }

    // Update Email if provided and changed
    if (typeof email === "string" && email.trim().length > 0 && email.trim().toLowerCase() !== currentUser.email) {
      const newEmailClean = email.trim().toLowerCase();
      const existingEmail = await db.collection("users").findOne({
        email: newEmailClean,
        _id: { $ne: userObjectId },
      });

      if (existingEmail) {
        return NextResponse.json({ error: "Email address is already in use" }, { status: 400 });
      }

      updatedEmail = newEmailClean;
      updates.email = updatedEmail;
    }

    // Update Base Currency if provided
    if (typeof baseCurrency === "string" && baseCurrency.trim().length > 0) {
      updatedCurrency = baseCurrency.trim();
      updates.baseCurrency = updatedCurrency;
    }

    // Update Password if currentPassword & newPassword provided
    if (currentPassword || newPassword) {
      if (!currentPassword || !newPassword) {
        return NextResponse.json({ error: "Both current password and new password are required to change password" }, { status: 400 });
      }

      if (newPassword.length < 6) {
        return NextResponse.json({ error: "New password must be at least 6 characters long" }, { status: 400 });
      }

      const isValidPassword = await verifyPassword(currentPassword, currentUser.passwordHash);
      if (!isValidPassword) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }

      const newPasswordHash = await hashPassword(newPassword);
      updates.passwordHash = newPasswordHash;
    }

    await db.collection("users").updateOne(
      { _id: userObjectId },
      { $set: updates }
    );

    // Re-issue session cookie with updated user info
    await createSession({
      id: session.id,
      name: updatedName,
      email: updatedEmail,
      currency: updatedCurrency,
    });

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: session.id,
        name: updatedName,
        email: updatedEmail,
        baseCurrency: updatedCurrency,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
