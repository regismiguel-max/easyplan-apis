const express = require("express");

// helpers
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const CAMS = new Set(["esplanada", "mane_garrincha", "parque_da_cidade"]);

function validarCam(req, res, next) {
    const cam = req.params.cam;
    if (!CAMS.has(cam)) {
        return res.status(400).json({ sucesso: false, mensagem: "parâmetro 'cam' inválido. Use: esplanada | mane_garrincha | parque_da_cidade" });
    }
    next();
}

module.exports = (app, opts = {}) => {
    const router = express.Router();
    const { createStreamsController } = require("../../controllers/streams/streams.controller");
    const ctrl = createStreamsController(opts);

    // Inicia as 3 câmeras (gera tokens sob demanda; respeita cache)
    router.post("/start-all", wrap(ctrl.startAll));

    // RENOVA todas as 3 câmeras numa única chamada (força novo token; ignora cache)
    router.post("/renew-all", wrap(ctrl.renewAll));

    // Gera/renova 1 câmera (sob demanda; respeita cache)
    router.get("/gen-token/:cam", validarCam, wrap(ctrl.genToken));

    // Redirect estável para mono.m3u8 atual
    router.get("/hls/:cam", validarCam, wrap(ctrl.hlsRedirect));

    // Health
    router.get("/health", wrap(ctrl.health));

    app.use("/api/streams", router);

    // error handler local
    app.use((err, req, res, _next) => {
        const msg = err?.message || "Erro interno";
        const isRegra = /parâmetro|parametro|cam|inválido|invalido/i.test(msg);
        res.status(isRegra ? 400 : 500).json({ sucesso: false, mensagem: msg });
    });
};
