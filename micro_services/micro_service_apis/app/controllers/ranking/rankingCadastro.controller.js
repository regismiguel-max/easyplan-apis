const { verificarCadastroTop60PorVigencia } = require("../../services/verificarCadastroTop60.service");

function createRankingCadastroController(_opts = {}) {
    return {
        async top60Status(req, res) {
            const { vigencia, escopo = "nacional", limit = "60" } = req.query;

            const result = await verificarCadastroTop60PorVigencia(vigencia, {
                escopo,
                limit: Number(limit),
            });

            return res.json({ sucesso: true, ...result });
        },

        health(_req, res) {
            return res.json({ ok: true, modulo: "ranking-cadastro" });
        },
    };
}

module.exports = { createRankingCadastroController };
