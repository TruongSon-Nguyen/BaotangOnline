import {
  createHash,
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod/v4";
import {
  collections,
  db,
  findByField,
  getById,
  newId,
} from "../lib/firestore";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const scryptAsync = promisify(scrypt);
const SESSION_COOKIE = "bao_tang_session";
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_BYTES = 64;
const configuredJwtSecret = process.env.AUTH_JWT_SECRET;
if (configuredJwtSecret && Buffer.byteLength(configuredJwtSecret) < 32) {
  throw new Error("AUTH_JWT_SECRET must contain at least 32 bytes.");
}
if (process.env.NODE_ENV === "production" && !configuredJwtSecret) {
  throw new Error("AUTH_JWT_SECRET must be configured in production.");
}
const jwtSecret = configuredJwtSecret
  ? Buffer.from(configuredJwtSecret)
  : randomBytes(32);
if (!configuredJwtSecret) {
  logger.warn(
    "AUTH_JWT_SECRET is not set; development login sessions will expire when the API restarts.",
  );
}
const passwordSchema = z.string().min(8).max(128);
const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: passwordSchema,
});
const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: passwordSchema,
});

type PublicAccount = {
  id: string;
  email: string;
  name: string;
};
type AuthenticatedAccount = PublicAccount & { isAdmin: boolean };
type UserAccount = AuthenticatedAccount & {
  passwordHash: string;
  createdAt: Date;
};
type AuthSession = {
  id: string;
  userId: string;
  expiresAt: Date;
};

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(PASSWORD_SALT_BYTES);
  const derivedKey = (await scryptAsync(
    password,
    salt,
    PASSWORD_KEY_BYTES,
  )) as Buffer;
  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [saltHex, keyHex] = storedHash.split(":");
  if (!saltHex || !keyHex || !/^[a-f0-9]+$/i.test(saltHex + keyHex)) {
    return false;
  }
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(keyHex, "hex");
  if (
    salt.length !== PASSWORD_SALT_BYTES ||
    expected.length !== PASSWORD_KEY_BYTES
  ) {
    return false;
  }
  const actual = (await scryptAsync(
    password,
    salt,
    PASSWORD_KEY_BYTES,
  )) as Buffer;
  return timingSafeEqual(actual, expected);
}

function getSessionToken(req: Request): string | null {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  return typeof token === "string" ? token : null;
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

type SessionClaims = { sub: string; exp: number };
function signSessionToken(userId: string, expiresAt: Date): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: "bao-tang-online",
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000),
      jti: randomBytes(16).toString("hex"),
    }),
  ).toString("base64url");
  const content = `${header}.${payload}`;
  const signature = createHmac("sha256", jwtSecret)
    .update(content)
    .digest("base64url");
  return `${content}.${signature}`;
}

function verifySessionToken(token: string): SessionClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

  let header: unknown;
  let payload: unknown;
  let actualSignature: Buffer;
  try {
    header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString());
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString());
    actualSignature = Buffer.from(encodedSignature, "base64url");
  } catch {
    return null;
  }

  const expectedSignature = createHmac(
    "sha256",
    jwtSecret,
  ).update(`${encodedHeader}.${encodedPayload}`).digest();
  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return null;
  }
  if (
    !header ||
    typeof header !== "object" ||
    !("alg" in header) ||
    header.alg !== "HS256" ||
    !("typ" in header) ||
    header.typ !== "JWT" ||
    !payload ||
    typeof payload !== "object" ||
    !("iss" in payload) ||
    payload.iss !== "bao-tang-online" ||
    !("sub" in payload) ||
    typeof payload.sub !== "string" ||
    !("exp" in payload) ||
    typeof payload.exp !== "number" ||
    payload.exp <= Math.floor(Date.now() / 1000)
  ) {
    return null;
  }
  return { sub: payload.sub, exp: payload.exp };
}

function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api",
    maxAge: SESSION_LIFETIME_MS,
  });
}

async function createSession(
  account: PublicAccount,
  res: Response,
): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  const token = signSessionToken(account.id, expiresAt);
  const tokenHash = hashSessionToken(token);
  await db.collection(collections.authSessions).doc(tokenHash).create({
    tokenHash,
    userId: account.id,
    expiresAt,
  });
  setSessionCookie(res, token);
}

export async function getAuthenticatedAccount(
  req: Request,
): Promise<AuthenticatedAccount | null> {
  const token = getSessionToken(req);
  if (!token) return null;
  const claims = verifySessionToken(token);
  if (!claims) return null;

  const session = await getById<AuthSession>(
    collections.authSessions,
    hashSessionToken(token),
  );
  if (
    !session ||
    session.userId !== claims.sub ||
    session.expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }
  const account = await getById<UserAccount>(collections.accounts, claims.sub);
  if (!account) return null;
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    isAdmin: account.isAdmin,
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Vui lòng nhập tên, email hợp lệ và mật khẩu từ 8 đến 128 ký tự.",
    });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await findByField<UserAccount>(
    collections.accounts,
    "email",
    email,
  );
  if (existing) {
    res.status(409).json({ error: "Email này đã được đăng ký." });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  const accountId = newId();
  const token = signSessionToken(accountId, expiresAt);
  const emailKey = createHash("sha256").update(email).digest("hex");
  const sessionHash = hashSessionToken(token);
  const created = await db.runTransaction(async (transaction) => {
    const emailRef = db.collection(collections.accountEmailIndex).doc(emailKey);
    if ((await transaction.get(emailRef)).exists) return false;
    const accountRef = db.collection(collections.accounts).doc(accountId);
    transaction.create(accountRef, {
      id: accountId,
      name: parsed.data.name,
      email,
      passwordHash,
      isAdmin: true,
      createdAt: new Date(),
    });
    transaction.create(emailRef, { accountId });
    transaction.create(
      db.collection(collections.authSessions).doc(sessionHash),
      { tokenHash: sessionHash, userId: accountId, expiresAt },
    );
    return true;
  });
  if (!created) {
    res.status(409).json({ error: "Email này đã được đăng ký." });
    return;
  }

  setSessionCookie(res, token);
  res.status(201).json({
    user: { id: accountId, email, name: parsed.data.name },
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Vui lòng nhập email hợp lệ và mật khẩu từ 8 ký tự trở lên.",
    });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const account = await findByField<UserAccount>(
    collections.accounts,
    "email",
    email,
  );
  if (!account || !(await verifyPassword(parsed.data.password, account.passwordHash))) {
    res.status(401).json({ error: "Email hoặc mật khẩu không chính xác." });
    return;
  }

  const user: PublicAccount = {
    id: account.id,
    email: account.email,
    name: account.name,
  };
  await createSession(user, res);
  res.json({ user });
});

router.get("/auth/session", async (req, res): Promise<void> => {
  const account = await getAuthenticatedAccount(req);
  if (!account) {
    res.status(401).json({ error: "Bạn chưa đăng nhập." });
    return;
  }
  res.json({ user: account });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const token = getSessionToken(req);
  if (token) {
    await db
      .collection(collections.authSessions)
      .doc(hashSessionToken(token))
      .delete();
  }
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api",
  });
  res.sendStatus(204);
});

export default router;
