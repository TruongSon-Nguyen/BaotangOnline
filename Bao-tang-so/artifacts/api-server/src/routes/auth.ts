import {
  createHash,
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod/v4";
import {
  authSessionsTable,
  db,
  userAccountsTable,
} from "@workspace/db";
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
  await db.insert(authSessionsTable).values({
    tokenHash: hashSessionToken(token),
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

  const [result] = await db
    .select({
      id: userAccountsTable.id,
      email: userAccountsTable.email,
      name: userAccountsTable.name,
      isAdmin: userAccountsTable.isAdmin,
    })
    .from(authSessionsTable)
    .innerJoin(
      userAccountsTable,
      eq(authSessionsTable.userId, userAccountsTable.id),
    )
    .where(
      and(
        eq(authSessionsTable.tokenHash, hashSessionToken(token)),
        eq(authSessionsTable.userId, claims.sub),
        gt(authSessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return result ?? null;
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
  const [existing] = await db
    .select({ id: userAccountsTable.id })
    .from(userAccountsTable)
    .where(eq(userAccountsTable.email, email))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "Email này đã được đăng ký." });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  const createdSession = await db.transaction(async (transaction) => {
    const [created] = await transaction
      .insert(userAccountsTable)
      .values({ name: parsed.data.name, email, passwordHash })
      .onConflictDoNothing({ target: userAccountsTable.email })
      .returning({
        id: userAccountsTable.id,
        email: userAccountsTable.email,
        name: userAccountsTable.name,
      });
    if (!created) return null;

      const token = signSessionToken(created.id, expiresAt);
      await transaction.insert(authSessionsTable).values({
      tokenHash: hashSessionToken(token),
      userId: created.id,
      expiresAt,
    });
    return {
      account: { id: created.id, email: created.email, name: created.name },
      token,
    };
  });
  if (!createdSession) {
    res.status(409).json({ error: "Email này đã được đăng ký." });
    return;
  }

  setSessionCookie(res, createdSession.token);
  res.status(201).json({ user: createdSession.account });
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
  const [account] = await db
    .select()
    .from(userAccountsTable)
    .where(eq(userAccountsTable.email, email))
    .limit(1);
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
      .delete(authSessionsTable)
      .where(eq(authSessionsTable.tokenHash, hashSessionToken(token)));
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
