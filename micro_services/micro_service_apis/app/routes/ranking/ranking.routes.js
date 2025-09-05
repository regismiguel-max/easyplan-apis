const express = require("express");
const { createRankingController } = require("../../controllers/ranking/ranking.controller");
const { listarOperadoras } = require('../../controllers/ranking/operadoras.controller');

// ---------- helpers ----------
const onlyDigits = (s) => String(s || "").replace(/\D+/g, "");
const isYMD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const isYM = (s) => /^\d{4}-\d{2}$/.test(String(s || ""));
const toBool = (v) => String(v).toLowerCase() === "true";

function validarGerar(req, res, next) {
  const { inicio, fim } = req.query || {};
  if (!isYMD(inicio) || !isYMD(fim)) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Parâmetros obrigatórios: inicio=YYYY-MM-DD e fim=YYYY-MM-DD",
    });
  }
  req.query.inicio = String(inicio);
  req.query.fim = String(fim);
  next();
}

function normalizarEscopo(raw) {
  const v = String(raw || "nacional").toUpperCase();
  if (v === "UF" || v === "ESTADO") return "ESTADO";
  return "NACIONAL";
}

function validarGeral(req, res, next) {
  const q = req.query || {};
  const escopo = normalizarEscopo(q.escopo);
  const estadoIdNorm = onlyDigits(q.estadoId ?? q.uf);
  if (!["NACIONAL", "ESTADO"].includes(escopo)) {
    return res.status(400).json({ sucesso: false, mensagem: "escopo deve ser 'nacional' ou 'estado'" });
  }
  if (escopo === "ESTADO" && !estadoIdNorm) {
    return res.status(400).json({ sucesso: false, mensagem: "Quando escopo=estado, informe estadoId=<id do estado>" });
  }

  const limit = q.limit != null ? Number(q.limit) : null;
  if (limit != null && (!Number.isFinite(limit) || limit <= 0)) {
    return res.status(400).json({ sucesso: false, mensagem: "limit deve ser número > 0" });
  }

  req.query.escopo = escopo;
  req.query.estadoId = estadoIdNorm || undefined;
  req.query.limit = limit || undefined;
  req.query.execucaoId = q.execucaoId ? Number(q.execucaoId) : undefined;
  req.query.cpf = q.cpf ? onlyDigits(q.cpf) : undefined;
  req.query.incluirValor = toBool(q.incluirValor);
  next();
}

function validarPorVigencia(req, res, next) {
  const q = req.query || {};
  const janela = String(q.janela || "").toUpperCase();
  if (!["DIA", "MES"].includes(janela)) {
    return res.status(400).json({ sucesso: false, mensagem: "janela deve ser DIA ou MES" });
  }
  if (janela === "DIA" && !isYMD(q.vigencia)) {
    return res.status(400).json({ sucesso: false, mensagem: "Para janela=DIA, use vigencia=YYYY-MM-DD" });
  }
  if (janela === "MES" && !isYM(q.vigencia)) {
    return res.status(400).json({ sucesso: false, mensagem: "Para janela=MES, use vigencia=YYYY-MM" });
  }

  const escopo = normalizarEscopo(q.escopo);
  const estadoIdNorm = onlyDigits(q.estadoId ?? q.uf);
  if (!["NACIONAL", "ESTADO"].includes(escopo)) {
    return res.status(400).json({ sucesso: false, mensagem: "escopo deve ser 'nacional' ou 'estado'" });
  }
  if (escopo === "ESTADO" && !estadoIdNorm) {
    return res.status(400).json({ sucesso: false, mensagem: "Quando escopo=estado, informe estadoId=<id do estado>" });
  }

  const limit = q.limit != null ? Number(q.limit) : null;
  if (limit != null && (!Number.isFinite(limit) || limit <= 0)) {
    return res.status(400).json({ sucesso: false, mensagem: "limit deve ser número > 0" });
  }

  req.query.janela = janela;
  req.query.vigencia = String(q.vigencia);
  req.query.escopo = escopo;
  req.query.estadoId = estadoIdNorm || undefined;
  req.query.limit = limit || undefined;
  req.query.execucaoId = q.execucaoId ? Number(q.execucaoId) : undefined;
  req.query.cpf = q.cpf ? onlyDigits(q.cpf) : undefined;
  req.query.incluirValor = toBool(q.incluirValor);
  next();
}

function validarPorCpfVigencias(req, res, next) {
  const q = req.query || {};
  const janela = String(q.janela || "").toUpperCase();
  const cpf = onlyDigits(q.cpf);
  if (!["DIA", "MES"].includes(janela)) {
    return res.status(400).json({ sucesso: false, mensagem: "janela deve ser DIA ou MES" });
  }
  if (!cpf) {
    return res.status(400).json({ sucesso: false, mensagem: "Informe cpf (apenas dígitos)" });
  }
  const limit = q.limit != null ? Number(q.limit) : undefined;
  if (limit != null && (!Number.isFinite(limit) || limit <= 0)) {
    return res.status(400).json({ sucesso: false, mensagem: "limit deve ser número > 0" });
  }
  req.query.janela = janela;
  req.query.cpf = cpf;
  req.query.execucaoId = q.execucaoId ? Number(q.execucaoId) : undefined;
  req.query.incluirValor = toBool(q.incluirValor);
  req.query.limit = limit;
  next();
}

function validarPorOperadora(req, res, next) {
  const q = req.query || {};
  const limit = q.limit != null ? Number(q.limit) : undefined;
  if (limit != null && (!Number.isFinite(limit) || limit <= 0)) {
    return res.status(400).json({ sucesso: false, mensagem: "limit deve ser número > 0" });
  }
  req.query.execucaoId = q.execucaoId ? Number(q.execucaoId) : undefined;
  req.query.operadora = q.operadora ? String(q.operadora) : 'todas';
  req.query.cpf = q.cpf ? onlyDigits(q.cpf) : undefined;
  req.query.incluirValor = toBool(q.incluirValor);
  req.query.limit = limit;
  req.query.escopo = q.escopo ? String(q.escopo).toUpperCase() : 'NACIONAL';
  req.query.uf = q.uf ? String(q.uf).toUpperCase() : undefined;
  next();
}

function validarPorOperadoraCpfVigencias(req, res, next) {
  const q = req.query || {};
  const janela = String(q.janela || "").toUpperCase();
  if (!["DIA", "MES"].includes(janela)) {
    return res.status(400).json({ sucesso: false, mensagem: "janela deve ser DIA ou MES" });
  }

  const cpf = onlyDigits(q.cpf);
  if (!cpf) {
    return res.status(400).json({ sucesso: false, mensagem: "Informe cpf (apenas dígitos)" });
  }

  // operadora pode ser 'GERAL' (default) ou nome exato
  const operadora = q.operadora ? String(q.operadora) : 'GERAL';

  const escopo = normalizarEscopo(q.escopo);
  if (!["NACIONAL", "ESTADO"].includes(escopo)) {
    return res.status(400).json({ sucesso: false, mensagem: "escopo deve ser 'nacional' ou 'estado'" });
  }
  const uf = q.uf ? String(q.uf).toUpperCase() : undefined;
  if (escopo === "ESTADO" && !uf) {
    return res.status(400).json({ sucesso: false, mensagem: "Quando escopo=estado, informe ?uf=UF" });
  }

  const limit = q.limit != null ? Number(q.limit) : undefined;
  if (limit != null && (!Number.isFinite(limit) || limit <= 0)) {
    return res.status(400).json({ sucesso: false, mensagem: "limit deve ser número > 0" });
  }

  req.query.janela = janela;
  req.query.cpf = cpf;
  req.query.operadora = operadora;
  req.query.escopo = escopo;
  req.query.uf = uf;
  req.query.execucaoId = q.execucaoId ? Number(q.execucaoId) : undefined;
  req.query.incluirValor = toBool(q.incluirValor);
  req.query.limit = limit;
  next();
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = (app, opts = {}) => {
  const router = express.Router();
  const ctrl = createRankingController(opts);

  router.post("/gerar", validarGerar, wrap(ctrl.gerar));
  router.get("/geral", validarGeral, wrap(ctrl.geral));
  router.get("/por-vigencia", validarPorVigencia, wrap(ctrl.porVigencia));
  router.get("/por-cpf-vigencias", validarPorCpfVigencias, wrap(ctrl.porCpfVigencias));
  router.get("/por-operadora", validarPorOperadora, wrap(ctrl.porOperadora));
  router.get("/por-operadora-cpf-vigencias", validarPorOperadoraCpfVigencias, wrap(ctrl.porOperadoraCpfVigencias));
  router.get('/operadoras', listarOperadoras);

  app.use("/api/ranking", router);

  app.use((err, req, res, _next) => {
    const msg = err?.message || "Erro interno";
    const isRegra = /vigênc|vigenc|estrito|parâmetro|parametro|janela|escopo|estadoId|vigencia|cpf/i.test(msg);
    res.status(isRegra ? 400 : 500).json({ sucesso: false, mensagem: msg });
  });
};
