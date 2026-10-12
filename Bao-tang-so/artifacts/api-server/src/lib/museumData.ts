import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  type SQL,
} from "drizzle-orm";
import {
  artifactExhibitionsTable,
  artifactImagesTable,
  artifactsTable,
  db,
  exhibitionsTable,
  historicalPeriodsTable,
  imageHotspotsTable,
  materialsTable,
  museumIntroTable,
} from "@workspace/db";

type ListArtifactOptions = {
  includeDraft?: boolean;
  q?: string;
  periodId?: string;
  materialId?: string;
  exhibitionId?: string;
  page: number;
  limit: number;
};

type JoinedArtifact = {
  artifact: typeof artifactsTable.$inferSelect;
  periodName: string;
  materialName: string;
  imageUrl: string | null;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function artifactReferenceCondition(reference: string) {
  return uuidPattern.test(reference)
    ? eq(artifactsTable.id, reference)
    : eq(artifactsTable.slug, reference);
}

function exhibitionReferenceCondition(reference: string) {
  return uuidPattern.test(reference)
    ? eq(exhibitionsTable.id, reference)
    : eq(exhibitionsTable.slug, reference);
}

function summaryFromJoined(row: JoinedArtifact) {
  return {
    id: row.artifact.id,
    name: row.artifact.name,
    slug: row.artifact.slug,
    summary: row.artifact.summary,
    periodName: row.periodName,
    materialName: row.materialName,
    dateLabel: row.artifact.dateLabel,
    imageUrl: row.imageUrl ?? "",
    isFeatured: row.artifact.isFeatured,
    isSample: row.artifact.isSample,
    status: row.artifact.status as "draft" | "published",
  };
}

function artifactConditions(options: ListArtifactOptions): SQL[] {
  const conditions: SQL[] = [];
  if (!options.includeDraft) conditions.push(eq(artifactsTable.status, "published"));
  if (options.periodId) conditions.push(eq(artifactsTable.periodId, options.periodId));
  if (options.materialId) conditions.push(eq(artifactsTable.materialId, options.materialId));
  if (options.exhibitionId) {
    conditions.push(
      inArray(
        artifactsTable.id,
        db
          .select({ artifactId: artifactExhibitionsTable.artifactId })
          .from(artifactExhibitionsTable)
          .where(eq(artifactExhibitionsTable.exhibitionId, options.exhibitionId)),
      ),
    );
  }
  if (options.q?.trim()) {
    const search = `%${options.q.trim().replace(/[%_]/g, "\\$&")}%`;
    conditions.push(
      or(
        ilike(artifactsTable.name, search),
        ilike(artifactsTable.summary, search),
        ilike(artifactsTable.history, search),
        ilike(artifactsTable.origin, search),
      )!,
    );
  }
  return conditions;
}

export async function listArtifactSummaries(options: ListArtifactOptions) {
  const conditions = artifactConditions(options);
  const where = conditions.length ? and(...conditions) : undefined;
  const [totalRow] = await db
    .select({ value: count() })
    .from(artifactsTable)
    .where(where);
  const rows = (await db
    .select({
      artifact: artifactsTable,
      periodName: historicalPeriodsTable.name,
      materialName: materialsTable.name,
      imageUrl: artifactImagesTable.imageUrl,
    })
    .from(artifactsTable)
    .innerJoin(
      historicalPeriodsTable,
      eq(artifactsTable.periodId, historicalPeriodsTable.id),
    )
    .innerJoin(materialsTable, eq(artifactsTable.materialId, materialsTable.id))
    .leftJoin(
      artifactImagesTable,
      and(
        eq(artifactImagesTable.artifactId, artifactsTable.id),
        eq(artifactImagesTable.isPrimary, true),
      ),
    )
    .where(where)
    .orderBy(
      desc(artifactsTable.isFeatured),
      asc(artifactsTable.featuredOrder),
      desc(artifactsTable.updatedAt),
    )
    .limit(options.limit)
    .offset((options.page - 1) * options.limit)) as JoinedArtifact[];

  return {
    items: rows.map(summaryFromJoined),
    total: Number(totalRow?.value ?? 0),
    page: options.page,
    limit: options.limit,
  };
}

export async function getArtifactDetails(
  reference: string,
  includeDraft = false,
) {
  const conditions = [artifactReferenceCondition(reference)];
  if (!includeDraft) conditions.push(eq(artifactsTable.status, "published"));

  const [row] = (await db
    .select({
      artifact: artifactsTable,
      periodName: historicalPeriodsTable.name,
      materialName: materialsTable.name,
      imageUrl: artifactImagesTable.imageUrl,
    })
    .from(artifactsTable)
    .innerJoin(
      historicalPeriodsTable,
      eq(artifactsTable.periodId, historicalPeriodsTable.id),
    )
    .innerJoin(materialsTable, eq(artifactsTable.materialId, materialsTable.id))
    .leftJoin(
      artifactImagesTable,
      and(
        eq(artifactImagesTable.artifactId, artifactsTable.id),
        eq(artifactImagesTable.isPrimary, true),
      ),
    )
    .where(and(...conditions))
    .limit(1)) as JoinedArtifact[];

  if (!row) return undefined;

  const imageRows = await db
    .select()
    .from(artifactImagesTable)
    .where(eq(artifactImagesTable.artifactId, row.artifact.id))
    .orderBy(asc(artifactImagesTable.sortOrder), asc(artifactImagesTable.createdAt));

  const imageIds = imageRows.map((image) => image.id);
  const hotspots = imageIds.length
    ? await db
        .select()
        .from(imageHotspotsTable)
        .where(inArray(imageHotspotsTable.imageId, imageIds))
    : [];
  const hotspotsByImage = new Map<string, typeof hotspots>();
  for (const hotspot of hotspots) {
    const current = hotspotsByImage.get(hotspot.imageId) ?? [];
    current.push(hotspot);
    hotspotsByImage.set(hotspot.imageId, current);
  }
  const exhibitionRows = await db
    .select({ exhibitionId: artifactExhibitionsTable.exhibitionId })
    .from(artifactExhibitionsTable)
    .where(eq(artifactExhibitionsTable.artifactId, row.artifact.id));

  return {
    ...summaryFromJoined(row),
    history: row.artifact.history,
    origin: row.artifact.origin,
    dimensions: row.artifact.dimensions,
    condition: row.artifact.condition,
    periodId: row.artifact.periodId,
    materialId: row.artifact.materialId,
    images: imageRows.map((image) => ({
      id: image.id,
      imageUrl: image.imageUrl,
      alt: image.alt,
      caption: image.caption,
      isPrimary: image.isPrimary,
      sortOrder: image.sortOrder,
      hotspots: (hotspotsByImage.get(image.id) ?? []).map((hotspot) => ({
        id: hotspot.id,
        x: hotspot.x,
        y: hotspot.y,
        title: hotspot.title,
        body: hotspot.body,
      })),
    })),
    exhibitionIds: exhibitionRows.map((item) => item.exhibitionId),
    createdAt: row.artifact.createdAt,
    updatedAt: row.artifact.updatedAt,
  };
}

export async function getArtifactSummaryById(
  id: string,
  includeDraft = false,
) {
  const conditions = [eq(artifactsTable.id, id)];
  if (!includeDraft) conditions.push(eq(artifactsTable.status, "published"));
  const [row] = (await db
    .select({
      artifact: artifactsTable,
      periodName: historicalPeriodsTable.name,
      materialName: materialsTable.name,
      imageUrl: artifactImagesTable.imageUrl,
    })
    .from(artifactsTable)
    .innerJoin(
      historicalPeriodsTable,
      eq(artifactsTable.periodId, historicalPeriodsTable.id),
    )
    .innerJoin(materialsTable, eq(artifactsTable.materialId, materialsTable.id))
    .leftJoin(
      artifactImagesTable,
      and(
        eq(artifactImagesTable.artifactId, artifactsTable.id),
        eq(artifactImagesTable.isPrimary, true),
      ),
    )
    .where(and(...conditions))
    .limit(1)) as JoinedArtifact[];
  return row ? summaryFromJoined(row) : undefined;
}

export async function getMuseumIntro() {
  const [intro] = await db.select().from(museumIntroTable).limit(1);
  if (!intro) return undefined;
  return {
    museumName: intro.museumName,
    tagline: intro.tagline,
    story: intro.story,
    heroImage: intro.heroImage,
    updatedAt: intro.updatedAt,
  };
}

export async function getExhibitionSummaries(includeDraft = false) {
  const conditions = includeDraft
    ? undefined
    : eq(exhibitionsTable.status, "published");
  const rows = await db
    .select()
    .from(exhibitionsTable)
    .where(conditions)
    .orderBy(desc(exhibitionsTable.updatedAt));
  const counts = rows.length
    ? await db
        .select({
          exhibitionId: artifactExhibitionsTable.exhibitionId,
          value: count(),
        })
        .from(artifactExhibitionsTable)
        .innerJoin(
          artifactsTable,
          eq(artifactExhibitionsTable.artifactId, artifactsTable.id),
        )
        .where(
          and(
            inArray(
              artifactExhibitionsTable.exhibitionId,
              rows.map((row) => row.id),
            ),
            ...(includeDraft
              ? []
              : [eq(artifactsTable.status, "published")]),
          ),
        )
        .groupBy(artifactExhibitionsTable.exhibitionId)
    : [];
  const countByExhibition = new Map(
    counts.map((item) => [item.exhibitionId, Number(item.value)]),
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    coverImage: row.coverImage,
    artifactCount: countByExhibition.get(row.id) ?? 0,
  }));
}

export async function getExhibitionDetails(
  reference: string,
  includeDraft = false,
) {
  const [row] = await db
    .select()
    .from(exhibitionsTable)
    .where(
      and(
        exhibitionReferenceCondition(reference),
        ...(includeDraft ? [] : [eq(exhibitionsTable.status, "published")]),
      ),
    )
    .limit(1);
  if (!row) return undefined;

  const selectedArtifacts = await db
    .select({ artifactId: artifactExhibitionsTable.artifactId })
    .from(artifactExhibitionsTable)
    .innerJoin(
      artifactsTable,
      eq(artifactExhibitionsTable.artifactId, artifactsTable.id),
    )
    .where(
      and(
        eq(artifactExhibitionsTable.exhibitionId, row.id),
        ...(includeDraft ? [] : [eq(artifactsTable.status, "published")]),
      ),
    );
  const artifactIds = selectedArtifacts.map((item) => item.artifactId);
  const summaries = artifactIds.length
    ? await Promise.all(
        artifactIds.map((artifactId) =>
          getArtifactSummaryById(artifactId, includeDraft),
        ),
      )
    : [];
  const summaryRows = await getExhibitionSummaries(includeDraft);
  const summary = summaryRows.find((item) => item.id === row.id);

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    coverImage: row.coverImage,
    artifactCount: summary?.artifactCount ?? artifactIds.length,
    story: row.story,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status as "draft" | "published",
    artifacts: summaries.filter((item) => item !== undefined),
  };
}

export function artifactSummaryFromRow(row: JoinedArtifact) {
  return summaryFromJoined(row);
}
