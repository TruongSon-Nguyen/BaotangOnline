import { Readable } from "node:stream";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  RequestImageUploadUrlBody,
  RequestImageUploadUrlResponse,
} from "@workspace/api-zod";
import {
  artifactImagesTable,
  artifactsTable,
  db,
  exhibitionsTable,
  museumIntroTable,
} from "@workspace/db";
import { getAuthenticatedAccount } from "./auth";
import { localUploadDirectory } from "../lib/localUploads";
import { requireMuseumAdmin } from "../lib/museumAdmin";
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();
const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

router.post(
  "/uploads/request-url",
  requireMuseumAdmin,
  async (req, res): Promise<void> => {
    const parsed = RequestImageUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (
      !supportedImageTypes.has(parsed.data.contentType) ||
      parsed.data.size > 10 * 1024 * 1024
    ) {
      res.status(400).json({ error: "Unsupported or oversized image" });
      return;
    }

    try {
      const rawUrl = await objectStorage.getObjectEntityUploadURL();
      const objectPath = objectStorage.normalizeObjectEntityPath(rawUrl);
      res.json(
        RequestImageUploadUrlResponse.parse({
          uploadUrl: rawUrl,
          objectPath,
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Failed to create image upload URL");
      res.status(500).json({ error: "Unable to prepare image upload" });
    }
  },
);

async function isPublishedImage(imageUrl: string): Promise<boolean> {
  const [artifactImage] = await db
    .select({ id: artifactImagesTable.id })
    .from(artifactImagesTable)
    .innerJoin(
      artifactsTable,
      eq(artifactImagesTable.artifactId, artifactsTable.id),
    )
    .where(
      and(
        eq(artifactImagesTable.imageUrl, imageUrl),
        eq(artifactsTable.status, "published"),
      ),
    )
    .limit(1);
  if (artifactImage) return true;

  const [exhibitionCover] = await db
    .select({ id: exhibitionsTable.id })
    .from(exhibitionsTable)
    .where(
      and(
        eq(exhibitionsTable.coverImage, imageUrl),
        eq(exhibitionsTable.status, "published"),
      ),
    )
    .limit(1);
  if (exhibitionCover) return true;

  const [intro] = await db
    .select({ id: museumIntroTable.id })
    .from(museumIntroTable)
    .where(eq(museumIntroTable.heroImage, imageUrl))
    .limit(1);
  return Boolean(intro);
}

async function isMuseumAdmin(req: Parameters<Parameters<typeof router.get>[1]>[0]) {
  const account = await getAuthenticatedAccount(req);
  return Boolean(account?.isAdmin);
}

router.get("/uploads/:filename", async (req, res): Promise<void> => {
  const filename = req.params.filename;
  if (!/^[0-9a-f-]+\.(jpg|png|webp)$/i.test(filename)) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  const imageUrl = `/api/storage/uploads/${filename}`;
  try {
    const image = await readFile(path.join(localUploadDirectory, filename));
    const isPublic = await isPublishedImage(imageUrl);
    if (!isPublic && !(await isMuseumAdmin(req))) {
      res.status(404).json({ error: "Image not found" });
      return;
    }
    const extension = path.extname(filename).toLowerCase();
    res
      .status(200)
      .type(extension === ".jpg" ? "image/jpeg" : extension === ".png" ? "image/png" : "image/webp")
      .set("Cache-Control", isPublic ? "public, max-age=3600" : "private, no-store")
      .send(image);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      res.status(404).json({ error: "Image not found" });
      return;
    }
    req.log.error({ err: error }, "Failed to serve locally stored museum image");
    res.status(500).json({ error: "Unable to serve image" });
  }
});

router.get("/objects/*path", async (req, res): Promise<void> => {
  const raw = req.params.path;
  const relativePath = Array.isArray(raw) ? raw.join("/") : raw;
  if (
    !relativePath.startsWith("uploads/") ||
    relativePath.split("/").some((part) => part === "..")
  ) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  const objectPath = `/objects/${relativePath}`;
  const imageUrl = `/api/storage${objectPath}`;

  try {
    const file = await objectStorage.getObjectEntityFile(objectPath);
    const isPublic = await isPublishedImage(imageUrl);
    if (!isPublic && !(await isMuseumAdmin(req))) {
      res.status(404).json({ error: "Image not found" });
      return;
    }
    const response = await objectStorage.downloadObject(file);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "cache-control" && isPublic) {
        res.setHeader(key, "public, max-age=3600");
        return;
      }
      res.setHeader(key, value);
    });
    res.status(response.status);
    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Image not found" });
      return;
    }
    req.log.error({ err: error }, "Failed to serve museum image");
    res.status(500).json({ error: "Unable to serve image" });
  }
});

export default router;
