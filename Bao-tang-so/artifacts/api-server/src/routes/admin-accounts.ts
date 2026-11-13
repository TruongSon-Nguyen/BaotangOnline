import { createHash } from "node:crypto";
import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import {
  InviteAdminBody,
  InviteAdminResponse,
  ListAdminAccountsResponse,
  RevokeAdminParams,
} from "@workspace/api-zod";
import {
  collections,
  db,
  findByField,
  getAll,
  getById,
  newId,
} from "../lib/firestore";
import { hashPassword } from "./auth";

const router: IRouter = Router();
const CreateAdminAccountBody = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

type UserAccount = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  isAdmin: boolean;
  createdAt: Date;
};

router.get("/accounts", async (_req, res): Promise<void> => {
  const accounts = (await getAll<UserAccount>(collections.accounts)).sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
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
  const id = newId();
  const emailKey = createHash("sha256").update(email).digest("hex");
  const account = await db.runTransaction(async (transaction) => {
    const emailRef = db.collection(collections.accountEmailIndex).doc(emailKey);
    if ((await transaction.get(emailRef)).exists) return undefined;
    const createdAt = new Date();
    transaction.create(db.collection(collections.accounts).doc(id), {
      id,
      name: parsed.data.name,
      email,
      passwordHash,
      isAdmin: true,
      createdAt,
    });
    transaction.create(emailRef, { accountId: id });
    return { id, email, createdAt };
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
  const account = await findByField<UserAccount>(
    collections.accounts,
    "email",
    email,
  );
  if (!account) {
    res.status(404).json({ error: "Tài khoản này chưa đăng ký." });
    return;
  }
  if (account.isAdmin) {
    res.status(409).json({ error: "Tài khoản này đã có quyền quản trị." });
    return;
  }

  const updated = await db
    .collection(collections.accounts)
    .doc(account.id)
    .update({ isAdmin: true })
    .then(() => ({ ...account, isAdmin: true }));
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
  const account = await getById<UserAccount>(
    collections.accounts,
    params.data.id,
  );
  if (!account) {
    res.status(404).json({ error: "Tài khoản không tồn tại." });
    return;
  }
  if (!account.isAdmin) {
    res.status(409).json({ error: "Tài khoản này không có quyền quản trị." });
    return;
  }

  const result = await db.runTransaction(async (transaction) => {
    const accounts = db.collection(collections.accounts);
    const accountRef = accounts.doc(account.id);
    const [current, admins] = await Promise.all([
      transaction.get(accountRef),
      transaction.get(accounts.where("isAdmin", "==", true)),
    ]);
    if (!current.exists) return "not-found";
    if (current.get("isAdmin") !== true) return "not-admin";
    if (admins.size <= 1) return "last-admin";
    transaction.update(accountRef, { isAdmin: false });
    return "revoked";
  });
  if (result === "not-found") {
    res.status(404).json({ error: "Tài khoản không tồn tại." });
    return;
  }
  if (result === "not-admin") {
    res.status(409).json({ error: "Tài khoản này không có quyền quản trị." });
    return;
  }
  if (result === "last-admin") {
    res.status(409).json({ error: "Phải giữ lại ít nhất một quản trị viên." });
    return;
  }
  res.sendStatus(204);
});

export default router;
