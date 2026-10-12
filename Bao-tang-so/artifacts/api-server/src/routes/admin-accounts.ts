import { clerkClient } from "@clerk/express";
import { and, count, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  InviteAdminBody,
  InviteAdminResponse,
  ListAdminAccountsResponse,
  RevokeAdminParams,
} from "@workspace/api-zod";
import { db, museumAdminsTable } from "@workspace/db";
import { INITIAL_ADMIN_EMAIL } from "../lib/seedMuseum";

const router: IRouter = Router();

router.get("/accounts", async (_req, res): Promise<void> => {
  const accounts = await db
    .select()
    .from(museumAdminsTable)
    .orderBy(museumAdminsTable.createdAt);
  res.json(
    ListAdminAccountsResponse.parse(
      accounts.map((account) => ({
        id: account.id,
        email: account.email,
        status: account.status as "active" | "invited" | "suspended",
        createdAt: account.createdAt,
      })),
    ),
  );
});

router.post("/accounts", async (req, res): Promise<void> => {
  const parsed = InviteAdminBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const [existing] = await db
    .select()
    .from(museumAdminsTable)
    .where(eq(museumAdminsTable.email, email))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "Administrator email already exists" });
    return;
  }

  const [admin] = await db
    .insert(museumAdminsTable)
    .values({ email, status: "invited" })
    .returning();
  const rawHost = req.headers["x-forwarded-host"] ?? req.get("host") ?? "";
  const host = (Array.isArray(rawHost) ? rawHost[0] : rawHost)
    .split(",")[0]
    ?.trim();
  const rawProtocol = req.headers["x-forwarded-proto"] ?? "https";
  const protocol = (Array.isArray(rawProtocol) ? rawProtocol[0] : rawProtocol)
    .split(",")[0]
    ?.trim();

  try {
    if (!host) throw new Error("Request host is unavailable");
    const redirectUrl = new URL("/sign-up", `${protocol || "https"}://${host}`);
    const invitation = await clerkClient.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: redirectUrl.toString(),
    });
    const [updated] = await db
      .update(museumAdminsTable)
      .set({ clerkInvitationId: invitation.id })
      .where(eq(museumAdminsTable.id, admin.id))
      .returning();
    res.status(201).json(
      InviteAdminResponse.parse({
        id: updated.id,
        email: updated.email,
        status: updated.status,
        createdAt: updated.createdAt,
      }),
    );
  } catch (error) {
    await db.delete(museumAdminsTable).where(eq(museumAdminsTable.id, admin.id));
    req.log.error({ err: error }, "Failed to create administrator invitation");
    res.status(502).json({ error: "Unable to send administrator invitation" });
  }
});

router.delete("/accounts/:id", async (req, res): Promise<void> => {
  const params = RevokeAdminParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [admin] = await db
    .select()
    .from(museumAdminsTable)
    .where(eq(museumAdminsTable.id, params.data.id))
    .limit(1);
  if (!admin) {
    res.status(404).json({ error: "Administrator not found" });
    return;
  }
  if (admin.email === INITIAL_ADMIN_EMAIL) {
    res.status(409).json({ error: "The initial administrator cannot be removed" });
    return;
  }

  if (admin.status === "active") {
    const [activeCount] = await db
      .select({ value: count() })
      .from(museumAdminsTable)
      .where(eq(museumAdminsTable.status, "active"));
    if (Number(activeCount?.value ?? 0) <= 1) {
      res.status(409).json({ error: "At least one active administrator is required" });
      return;
    }
  }

  if (admin.status === "invited" && admin.clerkInvitationId) {
    try {
      await clerkClient.invitations.revokeInvitation(admin.clerkInvitationId);
    } catch (error) {
      req.log.warn({ err: error }, "Clerk invitation was already unavailable");
    }
  }
  await db
    .delete(museumAdminsTable)
    .where(and(eq(museumAdminsTable.id, admin.id), eq(museumAdminsTable.email, admin.email)));
  res.sendStatus(204);
});

export default router;
