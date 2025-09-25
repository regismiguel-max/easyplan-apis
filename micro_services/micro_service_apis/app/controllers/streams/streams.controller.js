const { StreamsService } = require("../../services/streams/streams.service");

const isRuleError = (msg) => /parâmetro|parametro|cam|inválido|invalido/i.test(String(msg || ""));

function sendError(res, e) {
    const msg = e?.message || "Erro interno";
    const code = isRuleError(msg) ? 400 : 500;
    return res.status(code).send({ sucesso: false, mensagem: msg });
}

function createStreamsController() {
    // Uma única instância de serviço (browser/abas/caches compartilhados)
    const svc = new StreamsService();

    const startAll = async (_req, res) => {
        try {
            const data = await svc.startAll(); // respeita cache
            return res.send({ sucesso: true, cams: data });
        } catch (e) { return sendError(res, e); }
    };

    const renewAll = async (_req, res) => {
        try {
            const data = await svc.renewAll(); // força novo token p/ todas
            return res.send({ sucesso: true, cams: data });
        } catch (e) { return sendError(res, e); }
    };

    const genToken = async (req, res) => {
        try {
            const cam = req.params.cam; // esplanada|mane_garrincha|parque_da_cidade
            const d = await svc.getPlayable(cam); // respeita cache
            return res.send({
                sucesso: true,
                cam,
                monoUrl: d.monoUrl,
                indexUrl: d.indexUrl,
                expUnix: d.expUnix,
                startUnix: d.startUnix
            });
        } catch (e) { return sendError(res, e); }
    };

    const hlsRedirect = async (req, res) => {
        try {
            const cam = req.params.cam;
            const d = await svc.getPlayable(cam);
            return res.redirect(302, d.monoUrl);
        } catch (e) { return sendError(res, e); }
    };

    const health = async (_req, res) => {
        try { return res.send({ sucesso: true }); }
        catch (e) { return sendError(res, e); }
    };

    return { startAll, renewAll, genToken, hlsRedirect, health };
}

module.exports = { createStreamsController };
