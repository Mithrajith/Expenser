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
    const {
      name,
      email,
      baseCurrency,
      currentPassword,
      newPassword,
      analyticsStartDate,
      analyticsEndDate,
      transactionStartDate,
      transactionEndDate,
      transactionSearch,
      transactionType,
      transactionAccountId,
      transactionCategoryId,
      timeZone,
    } = body;

    const db = await getDb();
    const userObjectId = new ObjectId(session.id);

    const currentUser = await db.collection("users").findOne({ _id: userObjectId });
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (typeof timeZone === "string" && timeZone.trim().length > 0) {
      updates.timeZone = timeZone.trim();
    }

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

    if (typeof analyticsStartDate === "string") {
      updates.analyticsStartDate = analyticsStartDate.trim();
    }

    if (typeof analyticsEndDate === "string") {
      updates.analyticsEndDate = analyticsEndDate.trim();
    }

    if (typeof transactionStartDate === "string") {
      updates.transactionStartDate = transactionStartDate.trim();
    }

    if (typeof transactionEndDate === "string") {
      updates.transactionEndDate = transactionEndDate.trim();
    }

    if (typeof transactionSearch === "string") {
      updates.transactionSearch = transactionSearch.trim();
    }

    if (typeof transactionType === "string") {
      updates.transactionType = transactionType.trim();
    }

    if (typeof transactionAccountId === "string") {
      updates.transactionAccountId = transactionAccountId.trim();
    }

    if (typeof transactionCategoryId === "string") {
      updates.transactionCategoryId = transactionCategoryId.trim();
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
        analyticsStartDate: typeof updates.analyticsStartDate === "string" ? updates.analyticsStartDate : currentUser.analyticsStartDate || "",
        analyticsEndDate: typeof updates.analyticsEndDate === "string" ? updates.analyticsEndDate : currentUser.analyticsEndDate || "",
        transactionStartDate: typeof updates.transactionStartDate === "string" ? updates.transactionStartDate : currentUser.transactionStartDate || "",
        transactionEndDate: typeof updates.transactionEndDate === "string" ? updates.transactionEndDate : currentUser.transactionEndDate || "",
        transactionSearch: typeof updates.transactionSearch === "string" ? updates.transactionSearch : currentUser.transactionSearch || "",
        transactionType: typeof updates.transactionType === "string" ? updates.transactionType : currentUser.transactionType || "",
        transactionAccountId: typeof updates.transactionAccountId === "string" ? updates.transactionAccountId : currentUser.transactionAccountId || "",
        transactionCategoryId: typeof updates.transactionCategoryId === "string" ? updates.transactionCategoryId : currentUser.transactionCategoryId || "",
        timeZone: typeof updates.timeZone === "string" ? updates.timeZone : currentUser.timeZone || "",
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const user = await db.collection("users").findOne(
    { _id: new ObjectId(session.id) },
    { projection: { passwordHash: 0 } }
  );

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      baseCurrency: user.baseCurrency || "INR",
      analyticsStartDate: user.analyticsStartDate || "",
      analyticsEndDate: user.analyticsEndDate || "",
      transactionStartDate: user.transactionStartDate || "",
      transactionEndDate: user.transactionEndDate || "",
      transactionSearch: user.transactionSearch || "",
      transactionType: user.transactionType || "",
      transactionAccountId: user.transactionAccountId || "",
      transactionCategoryId: user.transactionCategoryId || "",
      timeZone: user.timeZone || "",
      createdAt: user.createdAt,
    },
  });
}
