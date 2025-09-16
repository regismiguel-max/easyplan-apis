const express = require("express");
const { createRankingCadastroController } = require("../../controllers/ranking/rankingCadastro.controller");

// ---------- helpers ----------
const onlyDigits = (s) => String(s || "").replace(/\D+/g, "");
const isYM = (s) => /^\d{4}-\d{2}$/.test(String(s || ""));
const normalizarEscopo = (raw) => {
    const v = String(raw || "nacional").toUpperCase();
    if (v === "UF" || v === "ESTADO") return "ESTADO";
    return "NACIONAL";
};

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = (app, opts = {}) => {
    const router = express.Router();
    const ctrl = createRankingCadastroController(opts);

    // GET /api/ranking/top60-status?vigencia=YYYY-MM[&escopo=nacional|estado&uf=UF&limit=60]
    router.get("/top60-status", wrap(ctrl.top60Status));

    // health opcional
    router.get("/health", wrap(ctrl.health));

    // monta sob /api/ranking (mesma base do seu módulo existente)
    app.use("/api/ranking", router);

    // handler de erro local (mantendo o padrão do seu arquivo)
    app.use((err, req, res, _next) => {
        const msg = err?.message || "Erro interno";
        const isRegra = /vigênc|vigenc|estrito|parâmetro|parametro|janela|escopo|estadoId|vigencia|cpf|limit|uf/i.test(msg);
        res.status(isRegra ? 400 : 500).json({ sucesso: false, mensagem: msg });
    });
};
