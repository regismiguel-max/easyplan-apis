const express = require("express");
const router = express.Router();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const { createHlsProxyController } = require("../../controllers/streams/hlsProxy.controller");
const ctrl = createHlsProxyController();

/**
 * GET /api/streams/proxy/play?u=<URL .m3u8 ou .ts>
 * - .m3u8: reescreve para manter no proxy
 * - .ts/.m4s: stream binário
 */
router.get("/proxy/play", wrap(ctrl.proxy));

module.exports = (app) => {
    app.use("/api/streams", router);
};
