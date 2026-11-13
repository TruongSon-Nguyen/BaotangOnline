import { randomUUID } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
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
import type {
  ArtifactImageRow,
  ArtifactRow,
  ExhibitionRow,
  ImageHotspotRow,
} from "@workspace/db/schema";
import { getArtifactDetails, listArtifactSummaries } from "../lib/museumData";
import { localUploadDirectory } from "../lib/localUploads";
import { ObjectStorageService } from "../lib/objectStorage";
import {
  collections,
  createRecord,
  db,
  deleteByField,
  deleteRecord,
  findByField,
  getAll,
  getById,
  newId,
  now,
  updateRecord,
} from "../lib/firestore";

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
  const [artifacts, exhibitions, images] = await Promise.all([
    getAll<ArtifactRow>(collections.artifacts),
    getAll<ExhibitionRow>(collections.exhibitions),
    getAll<ArtifactImageRow>(collections.artifactImages),
  ]);
  const recentArtifacts = await listArtifactSummaries({
    includeDraft: true,
    page: 1,
    limit: 6,
  });
  res.json(
    GetAdminOverviewResponse.parse({
      artifactCount: artifacts.length,
      publishedCount: artifacts.filter((item) => item.status === "published").length,
      draftCount: artifacts.filter((item) => item.status === "draft").length,
      exhibitionCount: exhibitions.length,
      imageCount: images.length,
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

  if (await findByField<ArtifactRow>(collections.artifacts, "slug", fields.slug)) {
    res.status(409).json({ error: "Artifact slug already exists" });
    return;
  }
  const timestamp = now();
  const artifact = await createRecord(collections.artifacts, {
    ...fields,
    dimensions: fields.dimensions ?? null,
    condition: fields.condition ?? null,
    isSample: false,
    status: "published",
    isFeatured: true,
    featuredOrder: -1,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await createRecord(collections.artifactImages, {
    artifactId: artifact.id,
    imageUrl,
    alt: fields.name,
    caption: "",
    isPrimary: true,
    sortOrder: 0,
    createdAt: timestamp,
  });
  await Promise.all(
    exhibitionIds.map((exhibitionId) =>
      createRecord(collections.artifactExhibitions, {
        artifactId: artifact.id,
        exhibitionId,
      }),
    ),
  );
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
  ) as Record<string, unknown>;
  const existing = await getById<ArtifactRow>(
    collections.artifacts,
    params.data.id,
  );
  if (!existing) {
    res.status(404).json({ error: "Artifact not found" });
    return;
  }
  if (updates.slug && updates.slug !== existing.slug) {
    const duplicate = await findByField<ArtifactRow>(
      collections.artifacts,
      "slug",
      updates.slug,
    );
    if (duplicate) {
      res.status(409).json({ error: "Artifact slug already exists" });
      return;
    }
  }
  if (
    exhibitionIds !== undefined &&
    (await Promise.all(
      exhibitionIds.map((id) => getById<ExhibitionRow>(collections.exhibitions, id)),
    )).some((item) => !item)
  ) {
    res.status(400).json({ error: "One or more exhibitions do not exist" });
    return;
  }
  const updated = await updateRecord<ArtifactRow>(
    collections.artifacts,
    existing.id,
    { ...updates, updatedAt: now() },
  );
  if (exhibitionIds !== undefined) {
    await deleteByField(
      collections.artifactExhibitions,
      "artifactId",
      existing.id,
    );
    await Promise.all(
      exhibitionIds.map((exhibitionId) =>
        createRecord(collections.artifactExhibitions, {
          artifactId: existing.id,
          exhibitionId,
        }),
      ),
    );
  }
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
  const deleted = await deleteRecord(
    collections.artifacts,
    params.data.id,
  );
  if (!deleted) {
    res.status(404).json({ error: "Artifact not found" });
    return;
  }
  const images = await getAll<ArtifactImageRow>(collections.artifactImages);
  const artifactImages = images.filter(
    (image) => image.artifactId === params.data.id,
  );
  await Promise.all([
    ...artifactImages.map((image) =>
      deleteByField(collections.imageHotspots, "imageId", image.id),
    ),
    deleteByField(
      collections.artifactExhibitions,
      "artifactId",
      params.data.id,
    ),
  ]);
  const batch = db.batch();
  for (const image of artifactImages) {
    batch.delete(db.collection(collections.artifactImages).doc(image.id));
  }
  if (artifactImages.length) await batch.commit();
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
  const artifact = await getById<ArtifactRow>(
    collections.artifacts,
    params.data.id,
  );
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

  const existingImages = (await getAll<ArtifactImageRow>(
    collections.artifactImages,
  )).filter((image) => image.artifactId === params.data.id);
  const isPrimary = parsed.data.isPrimary || existingImages.length === 0;
  const id = newId();
  const image: ArtifactImageRow = {
    id,
    artifactId: params.data.id,
    imageUrl,
    alt: parsed.data.alt,
    caption: parsed.data.caption,
    isPrimary,
    sortOrder: existingImages.length,
    createdAt: now(),
  };
  const batch = db.batch();
  if (isPrimary) {
    for (const existing of existingImages) {
      batch.update(
        db.collection(collections.artifactImages).doc(existing.id),
        { isPrimary: false },
      );
    }
  }
  batch.create(db.collection(collections.artifactImages).doc(id), image);
  await batch.commit();
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
  const existing = await getById<ArtifactImageRow>(
    collections.artifactImages,
    params.data.id,
  );
  if (!existing) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  const { sortOrder, isPrimary, ...fields } = parsed.data;
  const updates = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as Record<string, unknown>;
  const imageUpdates = {
    ...updates,
    ...(sortOrder === undefined ? {} : { sortOrder }),
    ...(isPrimary === undefined ? {} : { isPrimary }),
  };
  if (isPrimary === true) {
    const siblings = (await getAll<ArtifactImageRow>(
      collections.artifactImages,
    )).filter((item) => item.artifactId === existing.artifactId);
    const batch = db.batch();
    for (const sibling of siblings) {
      batch.update(db.collection(collections.artifactImages).doc(sibling.id), {
        isPrimary: false,
      });
    }
    batch.update(
      db.collection(collections.artifactImages).doc(params.data.id),
      { ...imageUpdates, isPrimary: true },
    );
    await batch.commit();
  } else if (Object.keys(imageUpdates).length > 0) {
    await db
      .collection(collections.artifactImages)
      .doc(params.data.id)
      .update(imageUpdates);
  }
  const image = { ...existing, ...imageUpdates };
  const hotspots = (await getAll<ImageHotspotRow>(
    collections.imageHotspots,
  )).filter((hotspot) => hotspot.imageId === image.id);
  res.json(UpdateArtifactImageResponse.parse({ ...image, hotspots }));
});

router.delete("/images/:id", async (req, res): Promise<void> => {
  const params = DeleteArtifactImageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const existing = await getById<ArtifactImageRow>(
    collections.artifactImages,
    params.data.id,
  );
  if (!existing) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  await deleteRecord(collections.artifactImages, existing.id);
  await deleteByField(collections.imageHotspots, "imageId", existing.id);
  if (existing.isPrimary) {
    const [nextImage] = (await getAll<ArtifactImageRow>(
      collections.artifactImages,
    ))
      .filter((image) => image.artifactId === existing.artifactId)
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          a.createdAt.getTime() - b.createdAt.getTime(),
      );
    if (nextImage) {
      await db.collection(collections.artifactImages).doc(nextImage.id).update({
        isPrimary: true,
      });
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
  const image = await getById<ArtifactImageRow>(
    collections.artifactImages,
    params.data.id,
  );
  if (!image) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  const hotspot = await createRecord(collections.imageHotspots, {
    imageId: image.id,
    ...parsed.data,
  });
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
  ) as Record<string, unknown>;
  const hotspot = await updateRecord<ImageHotspotRow>(
    collections.imageHotspots,
    params.data.id,
    updates,
  );
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
  const deleted = await deleteRecord(
    collections.imageHotspots,
    params.data.id,
  );
  if (!deleted) {
    res.status(404).json({ error: "Image annotation not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
