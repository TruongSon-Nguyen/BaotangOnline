import { Router, type IRouter } from "express";
import {
  CreateExhibitionBody,
  CreateExhibitionResponse,
  DeleteExhibitionParams,
  ListAdminExhibitionsResponse,
  UpdateExhibitionBody,
  UpdateExhibitionParams,
  UpdateExhibitionResponse,
  UpdateFeaturedArtifactsBody,
  UpdateFeaturedArtifactsResponse,
  UpdateMuseumIntroBody,
  UpdateMuseumIntroResponse,
} from "@workspace/api-zod";
import type {
  ArtifactRow,
  ExhibitionRow,
  MuseumIntroRow,
} from "@workspace/db/schema";
import {
  getArtifactSummaryById,
  getExhibitionDetails,
  getExhibitionSummaries,
  getMuseumIntro,
} from "../lib/museumData";
import {
  collections,
  createRecord,
  db,
  deleteByField,
  deleteRecord,
  findByField,
  getAll,
  getById,
  now,
  updateRecord,
} from "../lib/firestore";

const router: IRouter = Router();

function normalizeDate(value: string | Date | null | undefined) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

router.get("/exhibitions", async (_req, res): Promise<void> => {
  const summaries = await getExhibitionSummaries(true);
  const details = await Promise.all(
    summaries.map((exhibition) => getExhibitionDetails(exhibition.id, true)),
  );
  res.json(ListAdminExhibitionsResponse.parse(details));
});

router.post("/exhibitions", async (req, res): Promise<void> => {
  const parsed = CreateExhibitionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { artifactIds = [], ...input } = parsed.data;
  const fields = {
    ...input,
    startDate: normalizeDate(input.startDate),
    endDate: normalizeDate(input.endDate),
  };
  if (
    artifactIds.length &&
    (await Promise.all(
      artifactIds.map((id) => getById<ArtifactRow>(collections.artifacts, id)),
    )).some((artifact) => !artifact)
  ) {
    res.status(400).json({ error: "One or more artifacts do not exist" });
    return;
  }
  if (await findByField<ExhibitionRow>(collections.exhibitions, "slug", input.slug)) {
    res.status(409).json({ error: "Exhibition slug already exists" });
    return;
  }
  const timestamp = now();
  const created = await createRecord(collections.exhibitions, {
    ...fields,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await Promise.all(
    artifactIds.map((artifactId) =>
      createRecord(collections.artifactExhibitions, {
        exhibitionId: created.id,
        artifactId,
      }),
    ),
  );
  const detail = await getExhibitionDetails(created.id, true);
  res.status(201).json(CreateExhibitionResponse.parse(detail));
});

router.patch("/exhibitions/:id", async (req, res): Promise<void> => {
  const params = UpdateExhibitionParams.safeParse(req.params);
  const parsed = UpdateExhibitionBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { artifactIds, ...fields } = parsed.data;
  const updates = Object.fromEntries(
    Object.entries({
      ...fields,
      startDate: normalizeDate(fields.startDate),
      endDate: normalizeDate(fields.endDate),
    }).filter(([, value]) => value !== undefined),
  ) as Record<string, unknown>;

  const existing = await getById<ExhibitionRow>(
    collections.exhibitions,
    params.data.id,
  );
  if (!existing) {
    res.status(404).json({ error: "Exhibition not found" });
    return;
  }
  if (updates.slug && updates.slug !== existing.slug) {
    const duplicate = await findByField<ExhibitionRow>(
      collections.exhibitions,
      "slug",
      updates.slug,
    );
    if (duplicate) {
      res.status(409).json({ error: "Exhibition slug already exists" });
      return;
    }
  }
  if (
    artifactIds !== undefined &&
    (await Promise.all(
      artifactIds.map((id) => getById<ArtifactRow>(collections.artifacts, id)),
    )).some((artifact) => !artifact)
  ) {
    res.status(400).json({ error: "One or more artifacts do not exist" });
    return;
  }
  const updated = await updateRecord<ExhibitionRow>(
    collections.exhibitions,
    existing.id,
    { ...updates, updatedAt: now() },
  );
  if (artifactIds !== undefined) {
    await deleteByField(
      collections.artifactExhibitions,
      "exhibitionId",
      existing.id,
    );
    await Promise.all(
      artifactIds.map((artifactId) =>
        createRecord(collections.artifactExhibitions, {
          exhibitionId: existing.id,
          artifactId,
        }),
      ),
    );
  }
  if (!updated) {
    res.status(404).json({ error: "Exhibition not found" });
    return;
  }
  const detail = await getExhibitionDetails(updated.id, true);
  res.json(UpdateExhibitionResponse.parse(detail));
});

router.delete("/exhibitions/:id", async (req, res): Promise<void> => {
  const params = DeleteExhibitionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const deleted = await deleteRecord(
    collections.exhibitions,
    params.data.id,
  );
  if (!deleted) {
    res.status(404).json({ error: "Exhibition not found" });
    return;
  }
  await deleteByField(
    collections.artifactExhibitions,
    "exhibitionId",
    params.data.id,
  );
  res.sendStatus(204);
});

router.patch("/content/intro", async (req, res): Promise<void> => {
  const parsed = UpdateMuseumIntroBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await getById<MuseumIntroRow>(
    collections.museumIntro,
    "intro",
  );
  if (!existing) {
    res.status(503).json({ error: "Museum introduction is not initialized" });
    return;
  }
  const updated = await updateRecord<MuseumIntroRow>(
    collections.museumIntro,
    existing.id,
    { ...parsed.data, updatedAt: now() },
  );
  const result = await getMuseumIntro();
  res.json(UpdateMuseumIntroResponse.parse(result ?? updated));
});

router.patch("/content/featured", async (req, res): Promise<void> => {
  const parsed = UpdateFeaturedArtifactsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const artifactIds = [...new Set(parsed.data.artifactIds)];
  if (artifactIds.length) {
    const matching = await Promise.all(
      artifactIds.map((id) => getById<ArtifactRow>(collections.artifacts, id)),
    );
    if (matching.some((artifact) => !artifact)) {
      res.status(400).json({ error: "One or more artifacts do not exist" });
      return;
    }
  }
  const artifacts = await getAll<ArtifactRow>(collections.artifacts);
  const featuredOrder = new Map(artifactIds.map((id, index) => [id, index + 1]));
  for (let offset = 0; offset < artifacts.length; offset += 400) {
    const batch = db.batch();
    for (const artifact of artifacts.slice(offset, offset + 400)) {
      const order = featuredOrder.get(artifact.id);
      batch.update(db.collection(collections.artifacts).doc(artifact.id), {
        isFeatured: order !== undefined,
        featuredOrder: order ?? null,
        updatedAt: now(),
      });
    }
    await batch.commit();
  }
  const featured = await Promise.all(
    artifactIds.map((id) => getArtifactSummaryById(id, true)),
  );
  res.json(
    UpdateFeaturedArtifactsResponse.parse(
      featured.filter((item) => item !== undefined),
    ),
  );
});

export default router;
