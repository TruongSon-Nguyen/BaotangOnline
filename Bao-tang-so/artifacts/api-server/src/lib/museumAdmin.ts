import type { RequestHandler } from "express";
import { getAuthenticatedAccount } from "../routes/auth";

export type MuseumAdminPrincipal = {
  id: string;
  email: string;
  displayName: string;
  accountId: string;
};

export const requireMuseumAdmin: RequestHandler = async (req, res, next) => {
  const account = await getAuthenticatedAccount(req);
  if (!account) {
    res.status(401).json({ error: "Sign-in required" });
    return;
  }
  if (!account.isAdmin) {
    res.status(403).json({ error: "Administrator access required" });
    return;
  }

  res.locals.museumAdmin = {
    id: account.id,
    accountId: account.id,
    email: account.email,
    displayName: account.name,
  } satisfies MuseumAdminPrincipal;
  next();
};

export function getMuseumAdmin(res: Parameters<RequestHandler>[1]) {
  return res.locals.museumAdmin as MuseumAdminPrincipal;
}
