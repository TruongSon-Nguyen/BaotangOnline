import express, { type Express } from "express";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();
app.set("trust proxy", 1);

const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY || "";
const clerkSecretKey = process.env.CLERK_SECRET_KEY || "";
const hasValidClerkConfig =
  clerkPublishableKey.startsWith("pk_") && clerkSecretKey.startsWith("sk_");
const shouldEnableClerkMiddleware = hasValidClerkConfig;

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (shouldEnableClerkMiddleware) {
  app.use(
    clerkMiddleware((req) => {
      const host = getClerkProxyHost(req);
      const rawProtocol = req.headers["x-forwarded-proto"];
      const protocol = (
        Array.isArray(rawProtocol) ? rawProtocol[0] : rawProtocol
      )
        ?.split(",")[0]
        ?.trim() || (process.env.NODE_ENV === "production" ? "https" : "http");
      return {
        publishableKey: host
          ? publishableKeyFromHost(host, clerkPublishableKey)
          : clerkPublishableKey,
        secretKey: clerkSecretKey,
        ...(process.env.NODE_ENV === "production" && host
          ? { proxyUrl: `${protocol}://${host}${CLERK_PROXY_PATH}` }
          : {}),
      };
    }),
  );
}

app.use("/api", router);

app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    req.log?.error({ err }, "Unhandled API error");
    res.status(500).json({ error: "Internal server error" });
  },
);

export default app;
