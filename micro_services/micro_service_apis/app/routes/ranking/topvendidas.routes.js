const express = require("express");

// helpers
const toIntOrUndef = (v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
};
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

const isYM = (s) => /^\d{4}-\d{2}$/.test(String(s || ""));

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function validarTopVendidas(req, res, next) {
    const q = req.query || {};

    // limit
    let limit = toIntOrUndef(q.limit);
    if (limit !== undefined) {
        if (limit <= 0) return res.status(400).json({ sucesso: false, mensagem: "limit deve ser número > 0" });
        limit = clamp(limit, 1, 100);
    }
    req.query.limit = limit || 10; // default top 10

    // mês/vigencia (opcional) para a janela MES
    const ym = q.mes || q.vigencia; // aceitar ambos
    if (ym != null && ym !== "") {
        if (!isYM(ym)) {
            return res.status(400).json({ sucesso: false, mensagem: "mes/vigencia deve estar no formato YYYY-MM" });
        }
        req.query.vigenciaMes = String(ym);
    } else {
        req.query.vigenciaMes = undefined; // deixamos o service resolver via fallback
    }

    next();
}

module.exports = (app, opts = {}) => {
    const router = express.Router();
    const { createTopVendidasController } = require("../../controllers/ranking/topvendidas.controller");
    const ctrl = createTopVendidasController(opts);

    // GET /api/ranking/top-vendidas?limit=10&mes=YYYY-MM
    router.get("/top-vendidas", validarTopVendidas, wrap(ctrl.topVendidas));

    app.use("/api/ranking", router);

    app.use((err, req, res, _next) => {
        const msg = err?.message || "Erro interno";
        const isRegra = /parâmetro|parametro|limit|formato|vigencia|mes/i.test(msg);
        res.status(isRegra ? 400 : 500).json({ sucesso: false, mensagem: msg });
    });
};
