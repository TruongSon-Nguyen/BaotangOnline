import { count, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import {
  InviteAdminBody,
  InviteAdminResponse,
  ListAdminAccountsResponse,
  RevokeAdminParams,
} from "@workspace/api-zod";
import { db, userAccountsTable } from "@workspace/db";
import { hashPassword } from "./auth";

const router: IRouter = Router();
const CreateAdminAccountBody = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

router.get("/accounts", async (_req, res): Promise<void> => {
  const accounts = await db
    .select()
    .from(userAccountsTable)
    .orderBy(userAccountsTable.createdAt);
  res.json(
    ListAdminAccountsResponse.parse(
      accounts.map((account) => ({
        id: account.id,
        email: account.email,
        status: account.isAdmin ? "active" : "suspended",
        createdAt: account.createdAt,
      })),
    ),
  );
});

router.post("/accounts/create", async (req, res): Promise<void> => {
  const parsed = CreateAdminAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Vui lòng nhập tên, email hợp lệ và mật khẩu từ 8 đến 128 ký tự.",
    });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const passwordHash = await hashPassword(parsed.data.password);
  const [account] = await db
    .insert(userAccountsTable)
    .values({
      name: parsed.data.name,
      email,
      passwordHash,
      isAdmin: true,
    })
    .onConflictDoNothing({ target: userAccountsTable.email })
    .returning({
      id: userAccountsTable.id,
      email: userAccountsTable.email,
      createdAt: userAccountsTable.createdAt,
    });

  if (!account) {
    res.status(409).json({ error: "Email này đã được đăng ký." });
    return;
  }

  res.status(201).json({
    ...account,
    status: "active",
  });
});

router.post("/accounts", async (req, res): Promise<void> => {
  const parsed = InviteAdminBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const [account] = await db
    .select()
    .from(userAccountsTable)
    .where(eq(userAccountsTable.email, email))
    .limit(1);
  if (!account) {
    res.status(404).json({ error: "Tài khoản này chưa đăng ký." });
    return;
  }
  if (account.isAdmin) {
    res.status(409).json({ error: "Tài khoản này đã có quyền quản trị." });
    return;
  }

  const [updated] = await db
    .update(userAccountsTable)
    .set({ isAdmin: true })
    .where(eq(userAccountsTable.id, account.id))
    .returning();
  res.status(201).json(
    InviteAdminResponse.parse({
      id: updated.id,
      email: updated.email,
      status: "active",
      createdAt: updated.createdAt,
    }),
  );
});

router.delete("/accounts/:id", async (req, res): Promise<void> => {
  const params = RevokeAdminParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [account] = await db
    .select()
    .from(userAccountsTable)
    .where(eq(userAccountsTable.id, params.data.id))
    .limit(1);
  if (!account) {
    res.status(404).json({ error: "Tài khoản không tồn tại." });
    return;
  }
  if (!account.isAdmin) {
    res.status(409).json({ error: "Tài khoản này không có quyền quản trị." });
    return;
  }

  const [adminCount] = await db
    .select({ value: count() })
    .from(userAccountsTable)
    .where(eq(userAccountsTable.isAdmin, true));
  if (Number(adminCount?.value ?? 0) <= 1) {
    res.status(409).json({ error: "Phải giữ lại ít nhất một quản trị viên." });
    return;
  }

  await db
    .update(userAccountsTable)
    .set({ isAdmin: false })
    .where(eq(userAccountsTable.id, account.id));
  res.sendStatus(204);
});

export default router;
