// routes/reprocessamento.route.ts
import { Router } from "express";
import { ReprocessamentoController } from "../controllers/reprocessamento.controller";

const router = Router();

// Rota para reprocessar por ID de log
router.post("/reprocessar/:id", ReprocessamentoController.reprocessarPorId);
router.get("/logs", ReprocessamentoController.listarLogs);

export default router;
