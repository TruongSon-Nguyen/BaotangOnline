import { Router, type IRouter } from "express";
import adminAccountsRouter from "./admin-accounts";
import adminArtifactsRouter from "./admin-artifacts";
import adminContentRouter from "./admin-content";
import healthRouter from "./health";
import museumRouter from "./museum";
import storageRouter from "./storage";
import { requireMuseumAdmin } from "../lib/museumAdmin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(museumRouter);
router.use("/admin", requireMuseumAdmin);
router.use("/admin", adminAccountsRouter);
router.use("/admin", adminArtifactsRouter);
router.use("/admin", adminContentRouter);
router.use("/storage", storageRouter);

export default router;
