import { Router } from "express";
import { SincronizacaoController } from "../controllers/sincronizacao.controller";

const router = Router();

router.post("/buscar-propostas", SincronizacaoController.buscarPropostas);
router.post("/verificar-contratos", SincronizacaoController.verificarContratos);
router.post("/atualizar-beneficiarios", SincronizacaoController.atualizarBeneficiarios);
router.post("/executar-tudo", SincronizacaoController.executarTudo);

export default router;
