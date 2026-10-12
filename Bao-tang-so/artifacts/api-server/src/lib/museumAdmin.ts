import { getAuth, clerkClient } from "@clerk/express";
import type { RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { db, museumAdminsTable } from "@workspace/db";

export type MuseumAdminPrincipal = {
  id: string;
  email: string;
  displayName: string;
  clerkUserId: string;
};

export const requireMuseumAdmin: RequestHandler = async (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Sign-in required" });
    return;
  }

  const clerkUser = await clerkClient.users.getUser(userId);
  const primaryEmail = clerkUser.primaryEmailAddress;
  const email =
    primaryEmail?.verification?.status === "verified"
      ? primaryEmail.emailAddress.trim().toLowerCase()
      : "";
  if (!email) {
    res.status(403).json({ error: "A verified administrator email is required" });
    return;
  }

  const [admin] = await db
    .select()
    .from(museumAdminsTable)
    .where(eq(museumAdminsTable.email, email))
    .limit(1);

  if (!admin || admin.status === "suspended") {
    res.status(403).json({ error: "Administrator access required" });
    return;
  }

  if (admin.status === "invited") {
    await db
      .update(museumAdminsTable)
      .set({ status: "active" })
      .where(eq(museumAdminsTable.id, admin.id));
  }

  const displayName = [clerkUser.firstName, clerkUser.lastName]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
    .trim();
  res.locals.museumAdmin = {
    id: admin.id,
    email,
    clerkUserId: userId,
    displayName: displayName || email.split("@")[0],
  } satisfies MuseumAdminPrincipal;
  next();
};

export function getMuseumAdmin(res: Parameters<RequestHandler>[1]) {
  return res.locals.museumAdmin as MuseumAdminPrincipal;
}
