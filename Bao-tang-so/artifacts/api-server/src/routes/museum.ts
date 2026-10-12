import { asc } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetArtifactParams,
  GetArtifactResponse,
  GetExhibitionParams,
  GetExhibitionResponse,
  GetMuseumHomeResponse,
  GetMuseumIntroResponse,
  ListArtifactsQueryParams,
  ListArtifactsResponse,
  ListExhibitionsResponse,
  ListMaterialsResponse,
  ListPeriodsResponse,
} from "@workspace/api-zod";
import {
  db,
  historicalPeriodsTable,
  materialsTable,
} from "@workspace/db";
import {
  getArtifactDetails,
  getExhibitionDetails,
  getExhibitionSummaries,
  getMuseumIntro,
  listArtifactSummaries,
} from "../lib/museumData";

const router: IRouter = Router();

router.get("/museum/home", async (req, res): Promise<void> => {
  const intro = await getMuseumIntro();
  if (!intro) {
    res.status(503).json({ error: "Museum homepage content is not initialized" });
    return;
  }

  const [collection, exhibitions] = await Promise.all([
    listArtifactSummaries({
      page: 1,
      limit: 48,
    }),
    getExhibitionSummaries(),
  ]);
  res.json(
    GetMuseumHomeResponse.parse({
      intro,
      featuredArtifacts: collection.items
        .filter((artifact) => artifact.isFeatured)
        .slice(0, 6),
      exhibitions: exhibitions.slice(0, 4),
      collectionCount: collection.total,
    }),
  );
});

router.get("/museum/intro", async (_req, res): Promise<void> => {
  const intro = await getMuseumIntro();
  if (!intro) {
    res.status(503).json({ error: "Museum introduction is not initialized" });
    return;
  }
  res.json(GetMuseumIntroResponse.parse(intro));
});

router.get("/artifacts", async (req, res): Promise<void> => {
  const params = ListArtifactsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const page = await listArtifactSummaries(params.data);
  res.json(ListArtifactsResponse.parse(page));
});

router.get("/artifacts/:id", async (req, res): Promise<void> => {
  const params = GetArtifactParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const artifact = await getArtifactDetails(params.data.id);
  if (!artifact) {
    res.status(404).json({ error: "Artifact not found" });
    return;
  }
  res.json(GetArtifactResponse.parse(artifact));
});

router.get("/periods", async (_req, res): Promise<void> => {
  const periods = await db
    .select()
    .from(historicalPeriodsTable)
    .orderBy(asc(historicalPeriodsTable.startYear));
  res.json(ListPeriodsResponse.parse(periods));
});

router.get("/materials", async (_req, res): Promise<void> => {
  const materials = await db
    .select()
    .from(materialsTable)
    .orderBy(asc(materialsTable.name));
  res.json(ListMaterialsResponse.parse(materials));
});

router.get("/exhibitions", async (_req, res): Promise<void> => {
  const exhibitions = await getExhibitionSummaries();
  res.json(ListExhibitionsResponse.parse(exhibitions));
});

router.get("/exhibitions/:id", async (req, res): Promise<void> => {
  const params = GetExhibitionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const exhibition = await getExhibitionDetails(params.data.id);
  if (!exhibition) {
    res.status(404).json({ error: "Exhibition not found" });
    return;
  }
  res.json(GetExhibitionResponse.parse(exhibition));
});

export default router;
