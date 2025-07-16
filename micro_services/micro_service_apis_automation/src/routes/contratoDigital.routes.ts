import { Router } from "express";
import { ContratoDigitalController } from "../controllers/contratoDigital.controller";

const router = Router();

router.post("/consultar-cpfs", ContratoDigitalController.consultarPorCpfLista);

export default router;
