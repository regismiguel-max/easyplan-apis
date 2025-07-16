// routes/index.ts
import { Router } from "express";
import sincronizacaoRoutes from "./sincronizacao.route";
import reprocessamentoRoutes from "./reprocessamento.route";
import contratoDigitalRoutes from "./contratoDigital.routes";


const router = Router();

router.use("/sincronizacao", sincronizacaoRoutes);
router.use("/reprocessamento", reprocessamentoRoutes);
router.use("/contratos", contratoDigitalRoutes);

export default router;
