const { TopVendidasService } = require("../../services/topVendidas.service");

const isRuleError = (msg) => /parâmetro|parametro|limit|formato|vigencia|mes/i.test(String(msg || ""));

function sendError(res, e) {
    const msg = e?.message || "Erro interno";
    const code = isRuleError(msg) ? 400 : 500;
    return res.status(code).send({ sucesso: false, mensagem: msg });
}

function createTopVendidasController() {
    const topVendidas = async (req, res) => {
        try {
            const limit = Number(req.query.limit || 10);
            const vigenciaMes = req.query.vigenciaMes; // YYYY-MM (opcional)

            const svc = new TopVendidasService();
            const data = await svc.buscarTopVendidas({ limit, vigenciaMes });

            return res.send({ sucesso: true, ...data });
        } catch (e) { return sendError(res, e); }
    };

    return { topVendidas };
}

module.exports = { createTopVendidasController };
