const { RankingService } = require("../../services/ranking.service");

// helpers
const onlyDigits = (s) => String(s || "").replace(/\D+/g, "");
const isYMD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const isYM = (s) => /^\d{4}-\d{2}$/.test(String(s || ""));
const toBool = (v) => String(v).toLowerCase() === "true";
const toIntOrUndef = (v) => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

const isRuleError = (msg) =>
  /vigênc|vigenc|estrito|parâmetro|parametro|formato|janela|escopo|informe|estadoId|vigencia|cpf|obrigatóri/i.test(
    String(msg || "")
  );

function sendError(res, e) {
  const msg = e?.message || "Erro interno";
  const code = isRuleError(msg) ? 400 : 500;
  return res.status(code).send({ sucesso: false, mensagem: msg });
}

const normEscopo = (raw) => {
  const v = String(raw || "nacional").toUpperCase();
  return (v === "UF" || v === "ESTADO") ? "ESTADO" : "NACIONAL";
};

function createRankingController() {
  const gerar = async (req, res) => {
    try {
      const { inicio, fim } = req.query;
      if (!isYMD(inicio) || !isYMD(fim)) {
        return res.status(400).send({
          sucesso: false,
          mensagem: "Parâmetros obrigatórios: ?inicio=YYYY-MM-DD e ?fim=YYYY-MM-DD",
        });
      }
      const svc = new RankingService();
      const out = await svc.gerarEPersistir({ inicio, fim });
      return res.send({ sucesso: true, ...out });
    } catch (e) { return sendError(res, e); }
  };

  const geral = async (req, res) => {
    try {
      const escopo = normEscopo(req.query.escopo);
      const estadoId = req.query.estadoId ? String(req.query.estadoId) : undefined;
      const ufAlias = req.query.uf ? String(req.query.uf) : undefined;

      let limit = toIntOrUndef(req.query.limit);
      if (limit !== undefined) {
        if (limit <= 0) return res.status(400).send({ sucesso: false, mensagem: "limit deve ser número > 0" });
        limit = clamp(limit, 1, 100);
      }
      const execucaoId = toIntOrUndef(req.query.execucaoId);
      const cpf = req.query.cpf ? onlyDigits(req.query.cpf) : undefined;
      const incluirValor = toBool(req.query.incluirValor);

      const svc = new RankingService();
      const data = await svc.consultarTotal({ execucaoId, escopo, estadoId, uf: ufAlias, limit, cpf, incluirValor });
      return res.send({ sucesso: true, ...data });
    } catch (e) { return sendError(res, e); }
  };

  const porVigencia = async (req, res) => {
    try {
      const janela = String(req.query.janela || "").toUpperCase();
      const vigencia = String(req.query.vigencia || "");
      if (!["DIA", "MES"].includes(janela)) {
        return res.status(400).send({ sucesso: false, mensagem: "Informe ?janela=DIA ou MES" });
      }
      if (janela === "DIA" && !isYMD(vigencia)) {
        return res.status(400).send({ sucesso: false, mensagem: "Para janela=DIA, use ?vigencia=YYYY-MM-DD" });
      }
      if (janela === "MES" && !isYM(vigencia)) {
        return res.status(400).send({ sucesso: false, mensagem: "Para janela=MES, use ?vigencia=YYYY-MM" });
      }

      const escopo = normEscopo(req.query.escopo);
      const estadoId = req.query.estadoId ? String(req.query.estadoId) : undefined;
      const ufAlias = req.query.uf ? String(req.query.uf) : undefined;

      let limit = toIntOrUndef(req.query.limit);
      if (limit !== undefined) {
        if (limit <= 0) return res.status(400).send({ sucesso: false, mensagem: "limit deve ser número > 0" });
        limit = clamp(limit, 1, 100);
      }

      const execucaoId = toIntOrUndef(req.query.execucaoId);
      const cpf = req.query.cpf ? onlyDigits(req.query.cpf) : undefined;
      const incluirValor = toBool(req.query.incluirValor);

      const svc = new RankingService();
      const data = await svc.consultarJanela({ execucaoId, escopo, estadoId, uf: ufAlias, janela, vigencia, limit, cpf, incluirValor });
      return res.send({ sucesso: true, ...data });
    } catch (e) { return sendError(res, e); }
  };

  const porCpfVigencias = async (req, res) => {
    try {
      const janela = String(req.query.janela || "").toUpperCase();
      const cpf = onlyDigits(req.query.cpf);
      if (!["DIA", "MES"].includes(janela)) {
        return res.status(400).send({ sucesso: false, mensagem: "Informe ?janela=DIA ou MES" });
      }
      if (!cpf) {
        return res.status(400).send({ sucesso: false, mensagem: "Informe ?cpf (apenas dígitos)" });
      }
      let limit = toIntOrUndef(req.query.limit);
      if (limit !== undefined) {
        if (limit <= 0) return res.status(400).send({ sucesso: false, mensagem: "limit deve ser número > 0" });
        limit = clamp(limit, 1, 366);
      }
      const execucaoId = toIntOrUndef(req.query.execucaoId);
      const incluirValor = toBool(req.query.incluirValor);

      const svc = new RankingService();
      const data = await svc.consultarTodasVigenciasCpf({ execucaoId, janela, cpf, incluirValor, limit });
      return res.send({ sucesso: true, ...data });
    } catch (e) { return sendError(res, e); }
  };

  const porOperadora = async (req, res) => {
    try {
      const execucaoId = toIntOrUndef(req.query.execucaoId);
      const cpf = req.query.cpf ? onlyDigits(req.query.cpf) : undefined;
      const incluirValor = toBool(req.query.incluirValor);
      let limit = toIntOrUndef(req.query.limit);
      if (limit !== undefined) {
        if (limit <= 0) return res.status(400).send({ sucesso: false, mensagem: "limit deve ser número > 0" });
        limit = clamp(limit, 1, 100);
      }
      const operadora = req.query.operadora ? String(req.query.operadora) : 'todas';
      const escopo = String(req.query.escopo || 'NACIONAL').toUpperCase();
      const uf = req.query.uf ? String(req.query.uf) : undefined;

      const svc = new RankingService();
      const data = await svc.consultarPorOperadora({ execucaoId, operadora, limit, cpf, incluirValor, escopo, uf });
      return res.send({ sucesso: true, ...data });
    } catch (e) { return sendError(res, e); }
  };

  return { gerar, geral, porVigencia, porCpfVigencias, porOperadora };
}

module.exports = { createRankingController };
