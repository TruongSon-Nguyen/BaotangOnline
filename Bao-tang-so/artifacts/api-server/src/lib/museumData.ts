import type {
  ArtifactImageRow,
  ArtifactRow,
  ExhibitionRow,
  HistoricalPeriodRow,
  ImageHotspotRow,
  MaterialRow,
  MuseumIntroRow,
} from "@workspace/db/schema";
import {
  collections,
  findByField,
  getAll,
  getById,
} from "./firestore";

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
  artifact: ArtifactRow;
  periodName: string;
  materialName: string;
  imageUrl: string | null;
};

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

async function joinArtifact(
  artifact: ArtifactRow,
  periods: Map<string, HistoricalPeriodRow>,
  materials: Map<string, MaterialRow>,
  images: ArtifactImageRow[],
): Promise<JoinedArtifact | undefined> {
  const period = periods.get(artifact.periodId);
  const material = materials.get(artifact.materialId);
  if (!period || !material) return undefined;
  const primaryImage = images.find(
    (image) => image.artifactId === artifact.id && image.isPrimary,
  );
  return {
    artifact,
    periodName: period.name,
    materialName: material.name,
    imageUrl: primaryImage?.imageUrl ?? null,
  };
}

async function getJoinedArtifacts(
  artifacts: ArtifactRow[],
): Promise<JoinedArtifact[]> {
  const [periods, materials, images] = await Promise.all([
    getAll<HistoricalPeriodRow & { id: string }>(collections.historicalPeriods),
    getAll<MaterialRow & { id: string }>(collections.materials),
    getAll<ArtifactImageRow & { id: string }>(collections.artifactImages),
  ]);
  const periodById = new Map(periods.map((row) => [row.id, row]));
  const materialById = new Map(materials.map((row) => [row.id, row]));
  const joined = await Promise.all(
    artifacts.map((artifact) =>
      joinArtifact(artifact, periodById, materialById, images),
    ),
  );
  return joined.filter((row): row is JoinedArtifact => row !== undefined);
}

export async function listArtifactSummaries(options: ListArtifactOptions) {
  const [artifacts, exhibitionLinks] = await Promise.all([
    getAll<ArtifactRow & { id: string }>(collections.artifacts),
    options.exhibitionId
      ? getAll<{ id: string; artifactId: string; exhibitionId: string }>(
          collections.artifactExhibitions,
        )
      : Promise.resolve([]),
  ]);
  const linkedArtifactIds = new Set(
    exhibitionLinks
      .filter((link) => link.exhibitionId === options.exhibitionId)
      .map((link) => link.artifactId),
  );
  const search = options.q?.trim().toLocaleLowerCase();
  const filtered = artifacts.filter((artifact) => {
    if (!options.includeDraft && artifact.status !== "published") return false;
    if (options.periodId && artifact.periodId !== options.periodId) return false;
    if (options.materialId && artifact.materialId !== options.materialId) return false;
    if (options.exhibitionId && !linkedArtifactIds.has(artifact.id)) return false;
    if (
      search &&
      ![artifact.name, artifact.summary, artifact.history, artifact.origin]
        .some((value) => value.toLocaleLowerCase().includes(search))
    ) {
      return false;
    }
    return true;
  });

  const rows = await getJoinedArtifacts(filtered);
  rows.sort((a, b) => {
    const featuredDifference =
      Number(b.artifact.isFeatured) - Number(a.artifact.isFeatured);
    if (featuredDifference) return featuredDifference;
    const orderDifference =
      (a.artifact.featuredOrder ?? Number.MAX_SAFE_INTEGER) -
      (b.artifact.featuredOrder ?? Number.MAX_SAFE_INTEGER);
    if (orderDifference) return orderDifference;
    return b.artifact.updatedAt.getTime() - a.artifact.updatedAt.getTime();
  });

  return {
    items: rows
      .slice((options.page - 1) * options.limit, options.page * options.limit)
      .map(summaryFromJoined),
    total: rows.length,
    page: options.page,
    limit: options.limit,
  };
}

async function findArtifact(reference: string) {
  return (await getById<ArtifactRow & { id: string }>(
    collections.artifacts,
    reference,
  )) ?? findByField<ArtifactRow & { id: string }>(
    collections.artifacts,
    "slug",
    reference,
  );
}

async function findExhibition(reference: string) {
  return (await getById<ExhibitionRow & { id: string }>(
    collections.exhibitions,
    reference,
  )) ?? findByField<ExhibitionRow & { id: string }>(
    collections.exhibitions,
    "slug",
    reference,
  );
}

export async function getArtifactDetails(
  reference: string,
  includeDraft = false,
) {
  const artifact = await findArtifact(reference);
  if (!artifact || (!includeDraft && artifact.status !== "published")) {
    return undefined;
  }
  const [joined] = await getJoinedArtifacts([artifact]);
  if (!joined) return undefined;

  const [imageRows, exhibitions] = await Promise.all([
    getAll<ArtifactImageRow & { id: string }>(collections.artifactImages),
    getAll<{ id: string; artifactId: string; exhibitionId: string }>(
      collections.artifactExhibitions,
    ),
  ]);
  const images = imageRows
    .filter((image) => image.artifactId === artifact.id)
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
  const imageIds = new Set(images.map((image) => image.id));
  const hotspots = (
    await getAll<ImageHotspotRow & { id: string }>(collections.imageHotspots)
  ).filter((hotspot) => imageIds.has(hotspot.imageId));
  const hotspotsByImage = new Map<string, ImageHotspotRow[]>();
  for (const hotspot of hotspots) {
    const current = hotspotsByImage.get(hotspot.imageId) ?? [];
    current.push(hotspot);
    hotspotsByImage.set(hotspot.imageId, current);
  }

  return {
    ...summaryFromJoined(joined),
    history: artifact.history,
    origin: artifact.origin,
    dimensions: artifact.dimensions,
    condition: artifact.condition,
    periodId: artifact.periodId,
    materialId: artifact.materialId,
    images: images.map((image) => ({
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
    exhibitionIds: exhibitions
      .filter((link) => link.artifactId === artifact.id)
      .map((link) => link.exhibitionId),
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
  };
}

export async function getArtifactSummaryById(
  id: string,
  includeDraft = false,
) {
  const artifact = await getById<ArtifactRow & { id: string }>(
    collections.artifacts,
    id,
  );
  if (!artifact || (!includeDraft && artifact.status !== "published")) {
    return undefined;
  }
  const [row] = await getJoinedArtifacts([artifact]);
  return row ? summaryFromJoined(row) : undefined;
}

export async function getMuseumIntro() {
  const intro = await getById<MuseumIntroRow & { id: string }>(
    collections.museumIntro,
    "intro",
  );
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
  const [rows, exhibitionLinks, artifacts] = await Promise.all([
    getAll<ExhibitionRow & { id: string }>(collections.exhibitions),
    getAll<{ id: string; exhibitionId: string; artifactId: string }>(
      collections.artifactExhibitions,
    ),
    getAll<ArtifactRow & { id: string }>(collections.artifacts),
  ]);
  const artifactById = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  const filtered = rows
    .filter((row) => includeDraft || row.status === "published")
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return filtered.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    coverImage: row.coverImage,
    artifactCount: exhibitionLinks.filter((link) => {
      if (link.exhibitionId !== row.id) return false;
      const artifact = artifactById.get(link.artifactId);
      return artifact && (includeDraft || artifact.status === "published");
    }).length,
  }));
}

export async function getExhibitionDetails(
  reference: string,
  includeDraft = false,
) {
  const row = await findExhibition(reference);
  if (!row || (!includeDraft && row.status !== "published")) return undefined;

  const selectedArtifacts = (
    await getAll<{ id: string; exhibitionId: string; artifactId: string }>(
      collections.artifactExhibitions,
    )
  ).filter((link) => link.exhibitionId === row.id);
  const artifacts = await Promise.all(
    selectedArtifacts.map((link) =>
      getArtifactSummaryById(link.artifactId, includeDraft),
    ),
  );
  const summaries = await getExhibitionSummaries(includeDraft);
  const summary = summaries.find((item) => item.id === row.id);

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    coverImage: row.coverImage,
    artifactCount: summary?.artifactCount ?? artifacts.length,
    story: row.story,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status as "draft" | "published",
    artifacts: artifacts.filter((item) => item !== undefined),
  };
}

export function artifactSummaryFromRow(row: JoinedArtifact) {
  return summaryFromJoined(row);
}
