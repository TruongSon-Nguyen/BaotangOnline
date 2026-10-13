import { randomUUID } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { asc, count, eq } from "drizzle-orm";
import express, { Router, type IRouter } from "express";
import {
  AddArtifactImageBody,
  AddArtifactImageParams,
  AddArtifactImageResponse,
  AddImageHotspotBody,
  AddImageHotspotParams,
  AddImageHotspotResponse,
  CreateArtifactBody,
  CreateArtifactResponse,
  DeleteArtifactImageParams,
  DeleteArtifactParams,
  DeleteImageHotspotParams,
  GetArtifactParams,
  GetArtifactResponse,
  GetAdminOverviewResponse,
  GetAdminSessionResponse,
  ListAdminArtifactsQueryParams,
  ListAdminArtifactsResponse,
  UpdateArtifactBody,
  UpdateArtifactImageBody,
  UpdateArtifactImageParams,
  UpdateArtifactImageResponse,
  UpdateArtifactParams,
  UpdateArtifactResponse,
  UpdateImageHotspotBody,
  UpdateImageHotspotParams,
  UpdateImageHotspotResponse,
} from "@workspace/api-zod";
import {
  artifactExhibitionsTable,
  artifactImagesTable,
  artifactsTable,
  db,
  exhibitionsTable,
  imageHotspotsTable,
} from "@workspace/db";
import { getArtifactDetails, listArtifactSummaries } from "../lib/museumData";
import { localUploadDirectory } from "../lib/localUploads";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();
const supportedImageTypes = new Map([
  ["image/jpeg", { extension: "jpg", signature: (file: Buffer) => file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff }],
  ["image/png", { extension: "png", signature: (file: Buffer) => file.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) }],
  ["image/webp", { extension: "webp", signature: (file: Buffer) => file.toString("ascii", 0, 4) === "RIFF" && file.toString("ascii", 8, 12) === "WEBP" }],
]);

async function validateImageUrl(
  imageUrl: string,
  accountId: string,
): Promise<string | null> {
  if (imageUrl.startsWith("/api/storage/objects/")) {
    const objectPath = imageUrl.slice("/api/storage".length);
    try {
      const objectFile = await objectStorage.getObjectEntityFile(objectPath);
      const [metadata] = await objectFile.getMetadata();
      const contentType = String(metadata.contentType ?? "").toLowerCase();
      const size = Number(metadata.size ?? 0);
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(contentType) ||
        size < 1 ||
        size > 10 * 1024 * 1024
      ) {
        return "Unsupported or oversized image";
      }
      await objectStorage.trySetObjectEntityAclPolicy(objectPath, {
        owner: accountId,
        visibility: "private",
      });
      return null;
    } catch {
      return "Uploaded image could not be verified";
    }
  }
  if (imageUrl.startsWith("/api/storage/uploads/")) {
    const filename = imageUrl.slice("/api/storage/uploads/".length);
    if (!/^[0-9a-f-]+\.(jpg|png|webp)$/i.test(filename)) {
      return "Uploaded image could not be verified";
    }
    try {
      const info = await stat(path.join(localUploadDirectory, filename));
      if (!info.isFile() || info.size < 1 || info.size > 10 * 1024 * 1024) {
        return "Uploaded image could not be verified";
      }
      return null;
    } catch {
      return "Uploaded image could not be verified";
    }
  }
  if (imageUrl.startsWith("/images/")) return null;
  try {
    if (new URL(imageUrl).protocol !== "https:") {
      return "Image URL must use HTTPS or museum storage";
    }
    return null;
  } catch {
    return "Image URL must use HTTPS or museum storage";
  }
}

router.post(
  "/uploads/image",
  express.raw({ type: [...supportedImageTypes.keys()], limit: "10mb" }),
  async (req, res): Promise<void> => {
    const contentType = req.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    const imageType = contentType ? supportedImageTypes.get(contentType) : undefined;
    const image = Buffer.isBuffer(req.body) ? req.body : undefined;
    if (
      !imageType ||
      !image ||
      image.length === 0 ||
      !imageType.signature(image)
    ) {
      res.status(400).json({ error: "Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP hợp lệ." });
      return;
    }

    const filename = `${randomUUID()}.${imageType.extension}`;
    try {
      await mkdir(localUploadDirectory, { recursive: true });
      await writeFile(path.join(localUploadDirectory, filename), image, {
        flag: "wx",
      });
    } catch (error) {
      req.log.error({ err: error }, "Failed to store uploaded artifact image");
      res.status(500).json({ error: "Không thể lưu ảnh hiện vật." });
      return;
    }
    res.status(201).json({ imageUrl: `/api/storage/uploads/${filename}` });
  },
);

router.get("/session", async (_req, res): Promise<void> => {
  const admin = res.locals.museumAdmin as {
    id: string;
    email: string;
    displayName: string;
  };
  res.json(GetAdminSessionResponse.parse(admin));
});

router.get("/overview", async (_req, res): Promise<void> => {
  const [artifactCount, publishedCount, draftCount, exhibitionCount, imageCount] =
    await Promise.all([
      db.select({ value: count() }).from(artifactsTable),
      db
        .select({ value: count() })
        .from(artifactsTable)
        .where(eq(artifactsTable.status, "published")),
      db
        .select({ value: count() })
        .from(artifactsTable)
        .where(eq(artifactsTable.status, "draft")),
      db.select({ value: count() }).from(exhibitionsTable),
      db.select({ value: count() }).from(artifactImagesTable),
    ]);
  const recentArtifacts = await listArtifactSummaries({
    includeDraft: true,
    page: 1,
    limit: 6,
  });
  res.json(
    GetAdminOverviewResponse.parse({
      artifactCount: Number(artifactCount[0]?.value ?? 0),
      publishedCount: Number(publishedCount[0]?.value ?? 0),
      draftCount: Number(draftCount[0]?.value ?? 0),
      exhibitionCount: Number(exhibitionCount[0]?.value ?? 0),
      imageCount: Number(imageCount[0]?.value ?? 0),
      recentArtifacts: recentArtifacts.items,
    }),
  );
});

router.get("/artifacts", async (req, res): Promise<void> => {
  const params = ListAdminArtifactsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const page = await listArtifactSummaries({
    ...params.data,
    includeDraft: true,
  });
  res.json(ListAdminArtifactsResponse.parse(page));
});

router.get("/artifacts/:id", async (req, res): Promise<void> => {
  const params = GetArtifactParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const artifact = await getArtifactDetails(params.data.id, true);
  if (!artifact) {
    res.status(404).json({ error: "Artifact not found" });
    return;
  }
  res.json(GetArtifactResponse.parse(artifact));
});

router.post("/artifacts", async (req, res): Promise<void> => {
  const parsed = CreateArtifactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { exhibitionIds = [], imageUrl, ...fields } = parsed.data;
  const admin = res.locals.museumAdmin as { accountId: string };
  const imageError = await validateImageUrl(imageUrl, admin.accountId);
  if (imageError) {
    res.status(400).json({ error: imageError });
    return;
  }

  const artifact = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(artifactsTable)
      .values({
        ...fields,
        status: "published",
        isFeatured: true,
        featuredOrder: -1,
      })
      .returning();
    await tx.insert(artifactImagesTable).values({
      artifactId: created.id,
      imageUrl,
      alt: fields.name,
      caption: "",
      isPrimary: true,
      sortOrder: 0,
    });
    if (exhibitionIds.length) {
      await tx.insert(artifactExhibitionsTable).values(
        exhibitionIds.map((exhibitionId) => ({
          artifactId: created.id,
          exhibitionId,
        })),
      );
    }
    return created;
  });
  const full = await getArtifactDetails(artifact.id, true);
  res.status(201).json(CreateArtifactResponse.parse(full));
});

router.patch("/artifacts/:id", async (req, res): Promise<void> => {
  const params = UpdateArtifactParams.safeParse(req.params);
  const parsed = UpdateArtifactBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { exhibitionIds, ...fields } = parsed.data;
  const updates = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as Partial<typeof artifactsTable.$inferInsert>;
  const updated = await db.transaction(async (tx) => {
    const [artifact] = await tx
      .update(artifactsTable)
      .set(updates)
      .where(eq(artifactsTable.id, params.data.id))
      .returning();
    if (!artifact) return undefined;
    if (exhibitionIds !== undefined) {
      await tx
        .delete(artifactExhibitionsTable)
        .where(eq(artifactExhibitionsTable.artifactId, artifact.id));
      if (exhibitionIds.length) {
        await tx.insert(artifactExhibitionsTable).values(
          exhibitionIds.map((exhibitionId) => ({
            artifactId: artifact.id,
            exhibitionId,
          })),
        );
      }
    }
    return artifact;
  });
  if (!updated) {
    res.status(404).json({ error: "Artifact not found" });
    return;
  }
  const full = await getArtifactDetails(updated.id, true);
  res.json(UpdateArtifactResponse.parse(full));
});

router.delete("/artifacts/:id", async (req, res): Promise<void> => {
  const params = DeleteArtifactParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(artifactsTable)
    .where(eq(artifactsTable.id, params.data.id))
    .returning({ id: artifactsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Artifact not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/artifacts/:id/images", async (req, res): Promise<void> => {
  const params = AddArtifactImageParams.safeParse(req.params);
  const parsed = AddArtifactImageBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [artifact] = await db
    .select({ id: artifactsTable.id })
    .from(artifactsTable)
    .where(eq(artifactsTable.id, params.data.id))
    .limit(1);
  if (!artifact) {
    res.status(404).json({ error: "Artifact not found" });
    return;
  }
  const imageUrl = parsed.data.imageUrl.trim();
  const admin = res.locals.museumAdmin as { accountId: string };
  const imageError = await validateImageUrl(imageUrl, admin.accountId);
  if (imageError) {
    res.status(400).json({ error: imageError });
    return;
  }

  const existingImages = await db
    .select({ id: artifactImagesTable.id })
    .from(artifactImagesTable)
    .where(eq(artifactImagesTable.artifactId, params.data.id));
  const isPrimary = parsed.data.isPrimary || existingImages.length === 0;
  const image = await db.transaction(async (tx) => {
    if (isPrimary) {
      await tx
        .update(artifactImagesTable)
        .set({ isPrimary: false })
        .where(eq(artifactImagesTable.artifactId, params.data.id));
    }
    const [created] = await tx
      .insert(artifactImagesTable)
      .values({
        artifactId: params.data.id,
        imageUrl,
        alt: parsed.data.alt,
        caption: parsed.data.caption,
        isPrimary,
        sortOrder: existingImages.length,
      })
      .returning();
    return created;
  });
  res
    .status(201)
    .json(AddArtifactImageResponse.parse({ ...image, hotspots: [] }));
});

router.patch("/images/:id", async (req, res): Promise<void> => {
  const params = UpdateArtifactImageParams.safeParse(req.params);
  const parsed = UpdateArtifactImageBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(artifactImagesTable)
    .where(eq(artifactImagesTable.id, params.data.id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  const { sortOrder, isPrimary, ...fields } = parsed.data;
  const updates = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as Partial<typeof artifactImagesTable.$inferInsert>;
  const image = await db.transaction(async (tx) => {
    if (isPrimary === true) {
      await tx
        .update(artifactImagesTable)
        .set({ isPrimary: false })
        .where(eq(artifactImagesTable.artifactId, existing.artifactId));
    }
    const [updated] = await tx
      .update(artifactImagesTable)
      .set({
        ...updates,
        ...(sortOrder === undefined ? {} : { sortOrder }),
        ...(isPrimary === undefined ? {} : { isPrimary }),
      })
      .where(eq(artifactImagesTable.id, params.data.id))
      .returning();
    return updated;
  });
  const hotspots = await db
    .select()
    .from(imageHotspotsTable)
    .where(eq(imageHotspotsTable.imageId, image.id));
  res.json(UpdateArtifactImageResponse.parse({ ...image, hotspots }));
});

router.delete("/images/:id", async (req, res): Promise<void> => {
  const params = DeleteArtifactImageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(artifactImagesTable)
    .where(eq(artifactImagesTable.id, params.data.id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  await db.delete(artifactImagesTable).where(eq(artifactImagesTable.id, existing.id));
  if (existing.isPrimary) {
    const [nextImage] = await db
      .select({ id: artifactImagesTable.id })
      .from(artifactImagesTable)
      .where(eq(artifactImagesTable.artifactId, existing.artifactId))
      .orderBy(asc(artifactImagesTable.sortOrder), asc(artifactImagesTable.createdAt))
      .limit(1);
    if (nextImage) {
      await db
        .update(artifactImagesTable)
        .set({ isPrimary: true })
        .where(eq(artifactImagesTable.id, nextImage.id));
    }
  }
  res.sendStatus(204);
});

router.post("/images/:id/hotspots", async (req, res): Promise<void> => {
  const params = AddImageHotspotParams.safeParse(req.params);
  const parsed = AddImageHotspotBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [image] = await db
    .select({ id: artifactImagesTable.id })
    .from(artifactImagesTable)
    .where(eq(artifactImagesTable.id, params.data.id))
    .limit(1);
  if (!image) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  const [hotspot] = await db
    .insert(imageHotspotsTable)
    .values({ imageId: image.id, ...parsed.data })
    .returning();
  res.status(201).json(AddImageHotspotResponse.parse(hotspot));
});

router.patch("/hotspots/:id", async (req, res): Promise<void> => {
  const params = UpdateImageHotspotParams.safeParse(req.params);
  const parsed = UpdateImageHotspotBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined),
  ) as Partial<typeof imageHotspotsTable.$inferInsert>;
  const [hotspot] = await db
    .update(imageHotspotsTable)
    .set(updates)
    .where(eq(imageHotspotsTable.id, params.data.id))
    .returning();
  if (!hotspot) {
    res.status(404).json({ error: "Image annotation not found" });
    return;
  }
  res.json(UpdateImageHotspotResponse.parse(hotspot));
});

router.delete("/hotspots/:id", async (req, res): Promise<void> => {
  const params = DeleteImageHotspotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(imageHotspotsTable)
    .where(eq(imageHotspotsTable.id, params.data.id))
    .returning({ id: imageHotspotsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Image annotation not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
