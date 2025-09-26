const { HlsProxyService } = require("../../services/streams/hlsProxy.service");
const svc = new HlsProxyService();

function createHlsProxyController() {
  const proxy = async (req, res) => {
    const raw = req.query?.u;
    if (!raw) return res.status(400).json({ sucesso:false, mensagem:"Parâmetro 'u' obrigatório" });
    return svc.handle(req, res, raw);
  };
  return { proxy };
}

module.exports = { createHlsProxyController };
