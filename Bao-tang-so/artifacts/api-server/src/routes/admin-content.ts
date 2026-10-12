import { eq, inArray } from "drizzle-orm";
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
import {
  artifactExhibitionsTable,
  artifactsTable,
  db,
  exhibitionsTable,
  museumIntroTable,
} from "@workspace/db";
import {
  getArtifactSummaryById,
  getExhibitionDetails,
  getExhibitionSummaries,
  getMuseumIntro,
} from "../lib/museumData";

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
  const created = await db.transaction(async (tx) => {
    const [exhibition] = await tx
      .insert(exhibitionsTable)
      .values(fields)
      .returning();
    if (artifactIds.length) {
      await tx.insert(artifactExhibitionsTable).values(
        artifactIds.map((artifactId) => ({
          exhibitionId: exhibition.id,
          artifactId,
        })),
      );
    }
    return exhibition;
  });
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
  ) as Partial<typeof exhibitionsTable.$inferInsert>;

  const updated = await db.transaction(async (tx) => {
    const [exhibition] = await tx
      .update(exhibitionsTable)
      .set(updates)
      .where(eq(exhibitionsTable.id, params.data.id))
      .returning();
    if (!exhibition) return undefined;
    if (artifactIds !== undefined) {
      await tx
        .delete(artifactExhibitionsTable)
        .where(eq(artifactExhibitionsTable.exhibitionId, exhibition.id));
      if (artifactIds.length) {
        await tx.insert(artifactExhibitionsTable).values(
          artifactIds.map((artifactId) => ({
            exhibitionId: exhibition.id,
            artifactId,
          })),
        );
      }
    }
    return exhibition;
  });
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
  const [deleted] = await db
    .delete(exhibitionsTable)
    .where(eq(exhibitionsTable.id, params.data.id))
    .returning({ id: exhibitionsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Exhibition not found" });
    return;
  }
  res.sendStatus(204);
});

router.patch("/content/intro", async (req, res): Promise<void> => {
  const parsed = UpdateMuseumIntroBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(museumIntroTable).limit(1);
  if (!existing) {
    res.status(503).json({ error: "Museum introduction is not initialized" });
    return;
  }
  const [updated] = await db
    .update(museumIntroTable)
    .set(parsed.data)
    .where(eq(museumIntroTable.id, existing.id))
    .returning();
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
    const matching = await db
      .select({ id: artifactsTable.id })
      .from(artifactsTable)
      .where(inArray(artifactsTable.id, artifactIds));
    if (matching.length !== artifactIds.length) {
      res.status(400).json({ error: "One or more artifacts do not exist" });
      return;
    }
  }
  await db.transaction(async (tx) => {
    await tx
      .update(artifactsTable)
      .set({ isFeatured: false, featuredOrder: null });
    for (const [index, artifactId] of artifactIds.entries()) {
      await tx
        .update(artifactsTable)
        .set({ isFeatured: true, featuredOrder: index + 1 })
        .where(eq(artifactsTable.id, artifactId));
    }
  });
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
