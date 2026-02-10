const path = require("path");
const { withRateLimit } = require("../utils/withRateLimit");
const { DigitalSaudeClient } = require("./digitalSaude/DigitalSaudeClient");
const { PlaniumDnvClient } = require("./planium/PlaniumDnvClient");
const axiosCfg = require("../config/axios/axios.config");

const UF_NACIONAL = 'NA';
const OPERADORA_GERAL = 'GERAL';

const { exportDebugCsv } = require('../utils/exportDebug.util');

// ---------- helpers ----------
const normDigits = (s) => String(s || '').replace(/\D+/g, '');
const normContrato = (s) => String(s ?? '').replace(/\s+/g, '');
const normId = (s) => String(s ?? '')
  .trim()
  .toUpperCase()
  .replace(/[\s\.\-_/]/g, '');

const parseMoneyToCents = (s) => {
  if (s == null) return 0;
  if (typeof s === 'number' && Number.isFinite(s)) return Math.round(s * 100);
  let str = String(s).trim().replace(/\s+/g, '');
  if (/,/.test(str) && /\./.test(str)) str = str.replace(/\./g, '').replace(',', '.');
  else if (/,/.test(str) && !/\./.test(str)) str = str.replace(',', '.');
  const n = Number(str);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

const toLower = (s) => String(s || '').trim().toLowerCase();

const toYMD = (v) => {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{4})$/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const Y = d.getUTCFullYear();
    const M = String(d.getUTCMonth() + 1).padStart(2, '0');
    const D = String(d.getUTCDate()).padStart(2, '0');
    return `${Y}-${M}-${D}`;
  }
  return null;
};
const monthKey = (ymd) => ymd ? ymd.slice(0, 7) : null;

const guessUF = (row) => {
  const candidates = [row.corretor_uf, row.uf_corretor, row.uf_beneficiario, row.estadoUF, row.uf, row.estado];
  for (const v of candidates) {
    if (!v) continue;
    const s = String(v).trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(s)) return s;
  }
  return null;
};

const resolvePago = (st) => {
  if (!st) return false;
  if (st === true) return true;
  if (st.length > 0) return true;
  // if (typeof st === 'object') {
  //   if (st.primeiraFaturaPaga === true) return true;
  //   if (Array.isArray(st)) return st.length > 0;
  //   if (Array.isArray(st.faturas)) return st.faturas.length > 0;
  //   if (typeof st.length === 'number') return st.length > 0;
  // }
  return false;
};

const DEBUG_CONTRATO = String(process.env.RANKING_DEBUG_CONTRATO || '') === '1';
const DEBUG_CPFS_FILTER = (process.env.RANKING_DEBUG_CONTRATO_CPFS || '')
  .split(',')
  .map(s => s.replace(/\D+/g, ''))
  .filter(Boolean);
const debugMatchCpf = (cpf) => {
  if (!DEBUG_CONTRATO) return false;
  if (!DEBUG_CPFS_FILTER.length) return true;
  return DEBUG_CPFS_FILTER.includes(String(cpf).replace(/\D+/g, ''));
};
// -----------------------------

class RankingService {
  constructor({ paralelo = 2, soTitular = false } = {}) {
    this.db = require(path.resolve(__dirname, "../../../../models"));
    this.paralelo = Number(paralelo || 2);
    this.soTitular = !!soTitular;

    this.ds = new DigitalSaudeClient();
    this.dnv = new PlaniumDnvClient();

    // usar models existentes
    this.tblExec = this.db.rk_execucoes;
    this.tblRes = this.db.rk_resultados;
    this.tblVig = this.db.rk_vig_validas;
    this.tblOper = this.db.rk_operadoras;
    this.tblExcl = this.db.rk_exclusoes;
    this.tblCache = this.db.rk_cache_contrato_status;
    this.tblSupervisores = this.db.rk_supervisores; // tabela com campo nome_supervisor

    // caches em memória
    this._metaCache = new Map();    // cpf -> { nome, uf }
    this._pagoCache = new Map();    // contrato -> boolean (somente true em memória)
    this._exclSet = null;           // Set de cpfs (normalizados)
    this._superSet = null;          // Set de nomes de supervisor (exatos)
    this._operSet = null;           // Set de nomes de operadora (exatos)

    // DNV limits
    this.dnvConcurrency = Number(process.env.DNV_CONCURRENCY || 1);
    this.dnvMinDelay = Number(process.env.DNV_MIN_DELAY_MS || 750);

    this.allowNullSupervisor = '1';

    this.faturasLimiter = withRateLimit({
      concurrency: Number(process.env.FATURAS_CONCURRENCY || 1),
      minDelayMs: Number(process.env.FATURAS_MIN_DELAY_MS || 900),
    });
  }

  // -------- exclusões --------
  async _loadExcluidosSet() {
    if (this._exclSet) return this._exclSet;
    try {
      const rows = await this.tblExcl.findAll({ where: { ativo: true }, raw: true });
      // na tabela de exclusões, o campo correto é 'corretor_cpf'
      this._exclSet = new Set(rows.map(r => normDigits(r.corretor_cpf)).filter(Boolean));
    } catch {
      this._exclSet = new Set();
    }
    return this._exclSet;
  }
  _isExcluido(cpfRaw) {
    const set = this._exclSet || new Set();
    return set.has(normDigits(cpfRaw));
  }

  // -------- supervisores (matching exato) --------
  async _loadSupervisoresSet() {
    if (this._superSet) return this._superSet;
    try {
      const rows = await this.tblSupervisores?.findAll({
        attributes: ['nome_supervisor'],
        raw: true
      }).catch(() => []);
      const list = (rows || []).map(r => String(r.nome_supervisor || '').trim()).filter(Boolean);
      this._superSet = new Set(list);
    } catch {
      this._superSet = new Set();
    }
    // fail-fast para evitar descartar tudo silenciosamente
    if ((this._superSet?.size || 0) === 0) {
      throw new Error("Lista de supervisores vazia (rk_supervisores). Cadastre pelo menos um nome_supervisor ativo.");
    }
    return this._superSet;
  }

  // -------- operadoras (matching exato) --------
  async _loadOperadorasSet() {
    if (this._operSet) return this._operSet;
    try {
      const rows = await this.tblOper?.findAll({ where: { ativo: true }, attributes: ['operadora_nome'], raw: true }).catch(() => []);
      // alguns modelos usam 'nome', outros 'operadora'/'titulo'; prioriza 'nome' e faz fallback
      const list = (rows || []).map(r => (r.operadora_nome || '').toString().trim()).filter(Boolean);
      this._operSet = new Set(list);
    } catch {
      this._operSet = new Set();
    }

    if (process.env.RANKING_DEBUG_DNV === '1') {
      console.log('[RANK] Operadoras ativas:', Array.from(this._operSet || []).slice(0, 50));
      console.log('[RANK] Supervisores:', Array.from(this._superSet || []).slice(0, 50));
    }

    if ((this._operSet?.size || 0) === 0) {
      throw new Error("Lista de operadoras vazia (rk_operadoras.ativo=true). Cadastre pelo menos uma operadora_nome.");
    }
    return this._operSet;
  }

  // -------- contrato pago (sempre consultar com rate-limit; sem cache) --------
  async _getContratoPagoComCache(cod) {
    const key = String(cod || '').trim();
    if (!key) return false;

    let st = null;
    try {
      // sempre consulta a API; usa rate-limit para não estourar
      await this.faturasLimiter(async () => {
        st = await this.ds.consultarStatusFaturaPorContrato(key);
      });
    } catch {
      // em erro, consideramos "não pago" nesta execução
      return false;
    }

    // st pode ser: [] (sem liquidadas), [ ... ] (pagas), ou null (erro interno já tratado)
    return resolvePago(st);
  }

  async _getMetaByCpf(cpfRaw, sampleRow) {
    const cpf = normDigits(cpfRaw);
    if (this._metaCache.has(cpf)) return this._metaCache.get(cpf);
    const nome = sampleRow?.vendedorNome || sampleRow?.nome_corretor || sampleRow?.nome_corretora || null;
    const uf = guessUF(sampleRow);
    const meta = { nome, uf };
    this._metaCache.set(cpf, meta);
    return meta;
  }

  // ---------- NOVO: buscar imagens por CPF no model produtores ----------
  async _getImgUrlMapByCpfs(cpfs = []) {
    const map = new Map();
    try {
      const uniq = Array.from(new Set((cpfs || []).map(c => normDigits(c)).filter(Boolean)));
      if (!uniq.length) return map;
      const Prod = this.db?.produtores;
      if (!Prod) return map;

      const rows = await Prod.findAll({
        attributes: ['cpf', 'imagem_gladiador_URL'],
        where: { cpf: uniq },
        raw: true
      });

      for (const r of rows || []) {
        const c = normDigits(r.cpf);
        if (c) map.set(c, r.imagem_gladiador_URL || null);
      }
    } catch { /* silencioso para não quebrar consultas */ }
    return map;
  }
  // ---------------------------------------------------------------------

  // -------- vigências válidas (modo estrito, sem filtrar por início/fim) --------
  async _carregarVigenciasValidas() {
    const confRows = await this.tblVig?.findAll({ where: { ativo: true }, raw: true }).catch(() => []);
    const mesParaDiasValidos = new Map(); // grupo (YYYY-MM) -> set(dias YYYY-MM-DD)
    const diaParaGrupo = new Map();       // dia (YYYY-MM-DD) -> grupo (YYYY-MM)

    for (const r of (confRows || [])) {
      const grupo = String(r.referencia_mes || '').slice(0, 7);
      const dia = toYMD(r.vigencia_dia);
      if (!grupo || !dia) continue;
      const set = mesParaDiasValidos.get(grupo) || new Set();
      set.add(dia);
      mesParaDiasValidos.set(grupo, set);
      diaParaGrupo.set(dia, grupo);
    }

    const diasValidosNoPeriodo = Array.from(diaParaGrupo.keys());
    return { mesParaDiasValidos, diaParaGrupo, diasValidosNoPeriodo };
  }

  // -------- iterator de dias (America/Sao_Paulo) --------
  _eachDayYMD(inicio, fim) {
    const out = [];
    const tzFix = (d) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    let d = new Date(inicio + "T00:00:00-03:00");
    const end = new Date(fim + "T00:00:00-03:00");
    while (tzFix(d) <= tzFix(end)) {
      const Y = d.getFullYear(), M = String(d.getMonth() + 1).padStart(2, '0'), D = String(d.getDate()).padStart(2, '0');
      out.push(`${Y}-${M}-${D}`);
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  // -------- DNV: coleta e filtros para VENDIDAS --------
  async _coletarVendidasDNV({ inicio, fim, diaParaGrupo, whitelistSuper, whitelistOper }) {
    const CNPJ_OPERADORA = "27252086000104";
    const banStatus = new Set(['cancelado', 'cancelada', 'retificado', 'retificada']);
    const CPF_DEBUG = '09781452161'; // alvo
    await this._loadExcluidosSet();

    const dnvLimiter = withRateLimit({ concurrency: this.dnvConcurrency, minDelayMs: this.dnvMinDelay });
    const dias = this._eachDayYMD(inicio, fim);

    const items = [];
    // contadores de diagnóstico
    const diag = {
      dias_consultados: dias.length,
      propostas_total_api: 0,
      kept: 0,
      drop_sem_cpf_vendedor: 0,
      drop_excluido: 0,
      drop_supervisor: 0,
      drop_operadora: 0,
      drop_status: 0,
      drop_cont_prod: 0,
      drop_sem_vigencia: 0,
      drop_vig_nao_mapeada: 0,
      drop_beneficiarios: 0,
    };

    // await Promise.all(dias.map(ymd => dnvLimiter(async () => {
    //   const arr = await this.dnv.listarPorDia(CNPJ_OPERADORA, ymd);
    //   if (Array.isArray(arr)) diag.propostas_total_api += arr.length;

    //   for (const it of (arr || [])) {
    //     const vendedorCpfRaw = it?.vendedor_cpf;
    //     const vendedorCpfDebug = (vendedorCpfRaw || '').replace(/\D/g, '');
    //     const isAlvo = vendedorCpfDebug === CPF_DEBUG;

    //     if (isAlvo && process.env.RANKING_DEBUG_DNV === '1') {
    //       console.log('[DNV][DEBUG][PRE] id', it?.propostaID, {
    //         uf: it?.uf, status: it?.status, contrato: it?.contrato,
    //         date_sig: it?.date_sig, operadora: it?.metadados?.operadora_nome,
    //         vendedores: { cpf: vendedorCpfRaw, nome: it?.vendedor_nome },
    //         vigencia: it?.date_vigencia, beneficiarios: it?.beneficiarios
    //       });
    //     }
    //     const vendedorCpf = normDigits(it?.vendedor_cpf);
    //     if (!vendedorCpf) { diag.drop_sem_cpf_vendedor++; continue; }
    //     if (this._isExcluido(vendedorCpf)) { diag.drop_excluido++; continue; }

    //     // supervisor obrigatório + exato
    //     const supNomeRaw = it?.metadados?.supervisao_nome;
    //     const supNome = (supNomeRaw ?? '').toString().trim();
    //     const supIsNullish = supNomeRaw == null || supNome === '';

    //     if (supIsNullish) {
    //       if (!this.allowNullSupervisor) {
    //         diag.drop_supervisor++;
    //         continue;
    //       }
    //     } else {
    //       if (!whitelistSuper.has(supNome)) {
    //         diag.drop_supervisor++;
    //         continue;
    //       }
    //     }

    //     // operadora obrigatória + exata
    //     const operadoraNome = String(it?.metadados?.operadora_nome || '').trim();
    //     if (!operadoraNome || !whitelistOper.has(operadoraNome)) { if (isAlvo) console.log('[DNV][DROP] operadora', it?.propostaID, operadoraNome); diag.drop_operadora++; continue; }

    //     // filtros status/contrato/produto
    //     const st = toLower(it?.status);
    //     if (banStatus.has(st)) { if (isAlvo) console.log('[DNV][DROP] status', it?.propostaID, st); diag.drop_status++; continue; }

    //     if (!(toLower(it?.contrato) === 'ad')) { if (isAlvo) console.log('[DNV][DROP] contrato!=AD', it?.propostaID, it?.contrato); diag.drop_cont_prod++; continue; }

    //     // vigência: deve existir na tabela (modo estrito)
    //     const vigDia = toYMD(it?.date_vigencia);
    //     if (!vigDia) { if (isAlvo) console.log('[DNV][DROP] sem vigencia', it?.propostaID); diag.drop_sem_vigencia++; continue; }
    //     if (!diaParaGrupo.has(vigDia)) { if (isAlvo) console.log('[DNV][DROP] vig_nao_mapeada', it?.propostaID, vigDia); diag.drop_vig_nao_mapeada++; continue; }
    //     const grupo = String(diaParaGrupo.get(vigDia)); // YYYY-MM do cadastro

    //     // beneficiários > 0
    //     const beneficiarios = Number(it?.beneficiarios) || 0;
    //     if (beneficiarios <= 0) { diag.drop_beneficiarios++; continue; }

    //     const totalValorCent = parseMoneyToCents(it?.total_valor);
    //     const vendedorNome = String(it?.vendedor_nome || '').trim();

    //     // >>> NOVO: titularCpf a partir de metadados.titulares[0].cpf; fallback antigos + contratante_cpf
    //     let titularCpf = null;

    //     const meta = it?.metadados;

    //     // novo formato: metadados.titulares: [{ cpf, nome, ... }]
    //     if (Array.isArray(meta?.titulares) && meta.titulares.length > 0) {
    //       titularCpf = normDigits(meta.titulares[0]?.cpf);
    //     }

    //     // legado: metadados.titulares_cpf: [ 'cpf1', 'cpf2', ... ]
    //     if (!titularCpf && Array.isArray(meta?.titulares_cpf) && meta.titulares_cpf.length > 0) {
    //       titularCpf = normDigits(meta.titulares_cpf[0]);
    //     }

    //     // fallback final: contratante_cpf
    //     if (!titularCpf) {
    //       titularCpf = normDigits(it?.contratante_cpf);
    //     }

    //     items.push({
    //       propostaID: it?.propostaID, // auditoria
    //       vendedorCpf,
    //       vendedorNome,
    //       vigDia,
    //       vigMes: grupo, // vem do cadastro
    //       beneficiarios,
    //       totalValorCent,
    //       operadoraNome,
    //       supNome: supIsNullish ? null : supNome,
    //       titularCpf,
    //     });
    //     diag.kept++;
    //   }
    // })));


    ////////////// init propostas json ///////////////////////////////////


    const arr = [
      {
        "vendedor_cpf": "55263895100",
        "vendedor_nome": "MARILDA CASTRO DUARTE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17570820494981",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "04070520112"
      },
      {
        "vendedor_cpf": "02558943170",
        "vendedor_nome": "LIDIA MARIA NUNES LEAL ROCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17570815968309",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "06916863196"
      },
      {
        "vendedor_cpf": "71419993100",
        "vendedor_nome": "JAIRO GOMES DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17570780297012",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 876.96,
        "titularCpf": "78511712291"
      },
      {
        "vendedor_cpf": "94396973691",
        "vendedor_nome": "EDITE ALMEIDA NERIS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17568171457066",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "05215891184"
      },
      {
        "vendedor_cpf": "02558943170",
        "vendedor_nome": "LIDIA MARIA NUNES LEAL ROCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17567601262846",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "06351505143"
      },
      {
        "vendedor_cpf": "05711768107",
        "vendedor_nome": "RENATHA LEANDRO ALMEIDA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17571274182296",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "05697792190"
      },
      {
        "vendedor_cpf": "46210199100",
        "vendedor_nome": "ROSANE DE SOUZA MAGALHAES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17575331208266",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "03078415104"
      },
      {
        "vendedor_cpf": "04447604159",
        "vendedor_nome": "DOUGLAS DA SILVA GERONIMO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17575372815395",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 4,
        "total_valor": 1647.84,
        "titularCpf": "88855244191"
      },
      {
        "vendedor_cpf": "00247949612",
        "vendedor_nome": "KELLY MARCIA RIBEIRO DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17575463255803",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 2,
        "total_valor": 1084.38,
        "titularCpf": "07611434675"
      },
      {
        "vendedor_cpf": "02609251793",
        "vendedor_nome": "IVAN RAFAGNATO CALDAS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17575468219302",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 2,
        "total_valor": 2111.48,
        "titularCpf": "81641516534"
      },
      {
        "vendedor_cpf": "92145752315",
        "vendedor_nome": "JOSÉ ARIMATEIA SEIXAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17575948078204",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 649.11,
        "titularCpf": "01385389133"
      },
      {
        "vendedor_cpf": "05318407196",
        "vendedor_nome": "KAMILA MOREIRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17576002155128",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "08438395112"
      },
      {
        "vendedor_cpf": "01739661109",
        "vendedor_nome": "DIEGO FERREIRA BARROSO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17576907440667",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "03204401170"
      },
      {
        "vendedor_cpf": "73744506134",
        "vendedor_nome": "LUCAS DINIZ TELEA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17579607734714",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "70148599192"
      },
      {
        "vendedor_cpf": "03178237100",
        "vendedor_nome": "MATEUS CASSEB FERRAZ SAAVEDRA DIAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17579541695241",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "07245301182"
      },
      {
        "vendedor_cpf": "00384233163",
        "vendedor_nome": "LIGIA MARQUEZ SOCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17577801902768",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "05186320161"
      },
      {
        "vendedor_cpf": "01734783109",
        "vendedor_nome": "NADIELE DE CARVALHO E SOUSA MAIA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17576988951042",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 649.11,
        "titularCpf": "00728856107"
      },
      {
        "vendedor_cpf": "03023897174",
        "vendedor_nome": "WAYNE ALVES SOARES DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17577032878284",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "11429444177"
      },
      {
        "vendedor_cpf": "07221295646",
        "vendedor_nome": "THIAGO BARBOSA DE SOUSA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17573432364733",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "05786490122"
      },
      {
        "vendedor_cpf": "02429050137",
        "vendedor_nome": "LEONARDO SILVA BARBOSA CRUZ",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17576163468012",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 3,
        "total_valor": 1287.23,
        "titularCpf": "05529299130"
      },
      {
        "vendedor_cpf": "26179547149",
        "vendedor_nome": "GEOVANI PEREIRA COIMBRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17576315476383",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 551.81,
        "titularCpf": "01439955107"
      },
      {
        "vendedor_cpf": "03048676163",
        "vendedor_nome": "GABRIEL PINHEIRO PARENTE FELIX",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17579526483630",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "10902543180"
      },
      {
        "vendedor_cpf": "95339329100",
        "vendedor_nome": "CARLOS MATIAS DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17576726233815",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 876.96,
        "titularCpf": "88899640149"
      },
      {
        "vendedor_cpf": "69262993153",
        "vendedor_nome": "ELAINE NUNES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17575232119991",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 3,
        "total_valor": 1374.51,
        "titularCpf": "02013104146"
      },
      {
        "vendedor_cpf": "00771432135",
        "vendedor_nome": "BRUNA COSTA DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17576310813560",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 3,
        "total_valor": 1440.28,
        "titularCpf": "99310775149"
      },
      {
        "vendedor_cpf": "02646169108",
        "vendedor_nome": "JOAO CHRISTIANO RODRIGUES ANDRADE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17575368213306",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 873.38,
        "titularCpf": "01270499165"
      },
      {
        "vendedor_cpf": "17729157349",
        "vendedor_nome": "ELZINETE FERNANDES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17576980551168",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 685.00,
        "titularCpf": "03110551179"
      },
      {
        "vendedor_cpf": "56445520120",
        "vendedor_nome": "DENISE ABOIM INGLES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17580641981355",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "00974807117"
      },
      {
        "vendedor_cpf": "00197445101",
        "vendedor_nome": "CARMINDA DE OLIVEIRA NETO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17576133222888",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 873.38,
        "titularCpf": "02972528280"
      },
      {
        "vendedor_cpf": "00038974193",
        "vendedor_nome": "WILSON SOARES DE ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17577108336416",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 4,
        "total_valor": 1606.71,
        "titularCpf": "70239304187"
      },
      {
        "vendedor_cpf": "04317737183",
        "vendedor_nome": "YASMINE PAZ",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17577190025589",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 2,
        "total_valor": 805.78,
        "titularCpf": "07327646108"
      },
      {
        "vendedor_cpf": "04066347185",
        "vendedor_nome": "RENAN SOUSA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17579756082765",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "03130778195"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17580272405217",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 1121.10,
        "titularCpf": "65905296120"
      },
      {
        "vendedor_cpf": "01739661109",
        "vendedor_nome": "DIEGO FERREIRA BARROSO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17576132516814",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 3,
        "total_valor": 1694.73,
        "titularCpf": "00467458154"
      },
      {
        "vendedor_cpf": "01275570160",
        "vendedor_nome": "FILIPE NERES NUNES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17576111361004",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 1121.10,
        "titularCpf": "76895653449"
      },
      {
        "vendedor_cpf": "04476091571",
        "vendedor_nome": "FELIPE FLORENCIO DE LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17576721263355",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 2,
        "total_valor": 2307.52,
        "titularCpf": "79556744134"
      },
      {
        "vendedor_cpf": "05157657161",
        "vendedor_nome": "SUELEN DA ROCHA NOBRE CAVALCANTE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17580478766032",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 533.86,
        "titularCpf": "07445772170"
      },
      {
        "vendedor_cpf": "05555092490",
        "vendedor_nome": "JOAO RUFINO DA SILVA NETO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17581540188587",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 328.99,
        "titularCpf": "11072877155"
      },
      {
        "vendedor_cpf": "02400589178",
        "vendedor_nome": "ALESSANDRO SANTOS GOMES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17580335097556",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "05069455109"
      },
      {
        "vendedor_cpf": "95606629100",
        "vendedor_nome": "OZENILTON JOSE PEREIRA RODRIGUES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17569111074566",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "04646990105"
      },
      {
        "vendedor_cpf": "71192514149",
        "vendedor_nome": "MAICLIN DE SOUZA MESQUITA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17577124734558",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 2,
        "total_valor": 899.91,
        "titularCpf": "03011092575"
      },
      {
        "vendedor_cpf": "05121077181",
        "vendedor_nome": "STEPHANE RODRIGUES ASSUNCAO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17578678587788",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 597.92,
        "titularCpf": "04448653145"
      },
      {
        "vendedor_cpf": "56508050168",
        "vendedor_nome": "NILDA MARIA BARBOSA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17579552383426",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "04574571128"
      },
      {
        "vendedor_cpf": "57988170163",
        "vendedor_nome": "LUCIANA ALBUQUERQUE GOMES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17579597271414",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "06067587122"
      },
      {
        "vendedor_cpf": "03308922150",
        "vendedor_nome": "LAURA DE SOUZA FARIA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17579601420706",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 2,
        "total_valor": 1018.61,
        "titularCpf": "01781299170"
      },
      {
        "vendedor_cpf": "01436512182",
        "vendedor_nome": "MARCOS VINICIUS EMILIANO DUTRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17579716405969",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 2,
        "total_valor": 899.91,
        "titularCpf": "02018793101"
      },
      {
        "vendedor_cpf": "01436512182",
        "vendedor_nome": "MARCOS VINICIUS EMILIANO DUTRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17579736289215",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 575.01,
        "titularCpf": "02338292103"
      },
      {
        "vendedor_cpf": "80396925120",
        "vendedor_nome": "RAFAELA SILVA DANEZI",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17579827957241",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "06059650139"
      },
      {
        "vendedor_cpf": "03423555114",
        "vendedor_nome": "BARBARA AGUIAR VIANA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17580385298550",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "04286712176"
      },
      {
        "vendedor_cpf": "05157657161",
        "vendedor_nome": "SUELEN DA ROCHA NOBRE CAVALCANTE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17580505081436",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "02594623148"
      },
      {
        "vendedor_cpf": "53967879100",
        "vendedor_nome": "VALTER CLAUDIO OLIVEIRA SANTANA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17581410083081",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "09601195157"
      },
      {
        "vendedor_cpf": "70669856134",
        "vendedor_nome": "CLEIZER DA SILVA PINHEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17579751178495",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 615.05,
        "titularCpf": "71186298120"
      },
      {
        "vendedor_cpf": "58161970106",
        "vendedor_nome": "ELIS REGINA MOLINA PEIXOTO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17589816149761",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 960.22,
        "titularCpf": "01899265546"
      },
      {
        "vendedor_cpf": "95606629100",
        "vendedor_nome": "OZENILTON JOSE PEREIRA RODRIGUES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17591602831873",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "08683577155"
      },
      {
        "vendedor_cpf": "60251115100",
        "vendedor_nome": "ADENILSON LOPES MARQUES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17593497386778",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "05462261160"
      },
      {
        "vendedor_cpf": "87815907172",
        "vendedor_nome": "LUCIENE DA SILVA PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17594427213384",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "04679883154"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17598822971370",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "05549551136"
      },
      {
        "vendedor_cpf": "03347586107",
        "vendedor_nome": "JOSE EDUARDO CRISTINO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17598884819335",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "05201351131"
      },
      {
        "vendedor_cpf": "95339329100",
        "vendedor_nome": "CARLOS MATIAS DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17599424725052",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "08708125139"
      },
      {
        "vendedor_cpf": "04447604159",
        "vendedor_nome": "DOUGLAS DA SILVA GERONIMO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17599684233467",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "10193122111"
      },
      {
        "vendedor_cpf": "00239809157",
        "vendedor_nome": "IGOR FERREIRA MATTIOLI",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17600178662563",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "06869585199"
      },
      {
        "vendedor_cpf": "55400795153",
        "vendedor_nome": "KELLY FERNANDES VILHENA ZEIDAN",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17600226564812",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "70597677115"
      },
      {
        "vendedor_cpf": "71192514149",
        "vendedor_nome": "MAICLIN DE SOUZA MESQUITA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17600473963699",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 2,
        "total_valor": 747.64,
        "titularCpf": "72101601168"
      },
      {
        "vendedor_cpf": "03943973123",
        "vendedor_nome": "JULIANA COSTA SOARES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17599447011773",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "09947962180"
      },
      {
        "vendedor_cpf": "00855333197",
        "vendedor_nome": "BRUNA DOS SANTOS CORREIA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17601172683868",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 2,
        "total_valor": 798.00,
        "titularCpf": "10001774166"
      },
      {
        "vendedor_cpf": "01193374103",
        "vendedor_nome": "ADEMILSON DA SILVA PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17601475849853",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "02065560126"
      },
      {
        "vendedor_cpf": "95339329100",
        "vendedor_nome": "CARLOS MATIAS DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17603702974592",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "09776725147"
      },
      {
        "vendedor_cpf": "03344196111",
        "vendedor_nome": "GENERSON PEREIRA ALMEIDA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17603744952379",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 1039.57,
        "titularCpf": "86216104187"
      },
      {
        "vendedor_cpf": "01436512182",
        "vendedor_nome": "MARCOS VINICIUS EMILIANO DUTRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17603782130598",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "05118072107"
      },
      {
        "vendedor_cpf": "01882936124",
        "vendedor_nome": "ANA RAQUEL RIBEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17604396318672",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 2,
        "total_valor": 798.00,
        "titularCpf": "07814361176"
      },
      {
        "vendedor_cpf": "55969003115",
        "vendedor_nome": "LUCINEIDE GOMES DA SILVA ROCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17604646246527",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "05613040176"
      },
      {
        "vendedor_cpf": "02400589178",
        "vendedor_nome": "ALESSANDRO SANTOS GOMES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17604671348769",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 2,
        "total_valor": 1014.73,
        "titularCpf": "03433045119"
      },
      {
        "vendedor_cpf": "39985873149",
        "vendedor_nome": "HELIANE DE OLIVEIRA MOURA FIGUEIREDO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17599194496975",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 2,
        "total_valor": 1504.79,
        "titularCpf": "62013254172"
      },
      {
        "vendedor_cpf": "72213817120",
        "vendedor_nome": "RODRIGO RENATO SOARES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17599691244952",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "08052455103"
      },
      {
        "vendedor_cpf": "80396143172",
        "vendedor_nome": "PAULO ROBERTO DE MELO PEROTTO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17600219014684",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "02545264113"
      },
      {
        "vendedor_cpf": "02429050137",
        "vendedor_nome": "LEONARDO SILVA BARBOSA CRUZ",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17600975926568",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 2,
        "total_valor": 1654.96,
        "titularCpf": "59911360172"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17601102093912",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "02912999383"
      },
      {
        "vendedor_cpf": "82901074120",
        "vendedor_nome": "ROSANGELA ANA DA SILVA TEIXEIRA BOTTINO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17601264283156",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "10726035190"
      },
      {
        "vendedor_cpf": "01193374103",
        "vendedor_nome": "ADEMILSON DA SILVA PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17601465310514",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "00893699128"
      },
      {
        "vendedor_cpf": "87815907172",
        "vendedor_nome": "LUCIENE DA SILVA PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17603817338733",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "11220306142"
      },
      {
        "vendedor_cpf": "99213710100",
        "vendedor_nome": "ANNE CAROLINE OLIVEIRA SANTOS ALMEIDA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17603826821924",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "04559556113"
      },
      {
        "vendedor_cpf": "99938405134",
        "vendedor_nome": "DAYANNE CRISTINE DE FREITAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17604046229472",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "11638228175"
      },
      {
        "vendedor_cpf": "85782513420",
        "vendedor_nome": "GILCILENE MACENO DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17604451501927",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 3,
        "total_valor": 2193.80,
        "titularCpf": "03566755648"
      },
      {
        "vendedor_cpf": "71526684187",
        "vendedor_nome": "CRISTIANO FRANCA DE MORAIS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17601222973899",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "10956475124"
      },
      {
        "vendedor_cpf": "01811244165",
        "vendedor_nome": "ADRIANA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17605341071756",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 2,
        "total_valor": 583.02,
        "titularCpf": "06676942186"
      },
      {
        "vendedor_cpf": "18270697168",
        "vendedor_nome": "RICARDO GIOIA SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17605370195612",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 2242.11,
        "titularCpf": "03592791800"
      },
      {
        "vendedor_cpf": "06970852105",
        "vendedor_nome": "PEDRO IGOR NUNES TAVARES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17605531388306",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 2,
        "total_valor": 894.76,
        "titularCpf": "08513111139"
      },
      {
        "vendedor_cpf": "87612143100",
        "vendedor_nome": "POLIANA BARBOSA DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17605602691398",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "04266512198"
      },
      {
        "vendedor_cpf": "02264160110",
        "vendedor_nome": "SAULO VITOR BARBOSA RODRIGUES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17606287873445",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "01455053406"
      },
      {
        "vendedor_cpf": "04311481128",
        "vendedor_nome": "NATALI DOS ANJOS SEVILHA OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17606344903240",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "10838478131"
      },
      {
        "vendedor_cpf": "03657455108",
        "vendedor_nome": "SHEYLA CRISTINA GONCALVES DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17606350282006",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "00541175181"
      },
      {
        "vendedor_cpf": "03332749110",
        "vendedor_nome": "ERICA THAIS FIGUEIREDO SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17610008331055",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 685.00,
        "titularCpf": "12485824703"
      },
      {
        "vendedor_cpf": "86911716187",
        "vendedor_nome": "FABIO RODRIGUES DA CUNHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17610548723098",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "05760983105"
      },
      {
        "vendedor_cpf": "05286688110",
        "vendedor_nome": "EMANUELLA RODRIGUES CIPRIANO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17610752579694",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "01702520196"
      },
      {
        "vendedor_cpf": "06899205122",
        "vendedor_nome": "GUILHERME MEDEIROS GADELHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17610786573079",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 407.88,
        "titularCpf": "08930777120"
      },
      {
        "vendedor_cpf": "00746149913",
        "vendedor_nome": "LUCILA FERREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17610787677897",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "00237343100"
      },
      {
        "vendedor_cpf": "28998820153",
        "vendedor_nome": "MARIA DO CARMO BATISTA DE MORAIS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17610795852278",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 2,
        "total_valor": 1260.63,
        "titularCpf": "60348099320"
      },
      {
        "vendedor_cpf": "01188890107",
        "vendedor_nome": "ANGELICA TEIXEIRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17607253935847",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "10969914113"
      },
      {
        "vendedor_cpf": "49050788149",
        "vendedor_nome": "MARINEIA LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17606409681568",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 1478.61,
        "titularCpf": "66507782149"
      },
      {
        "vendedor_cpf": "92702503187",
        "vendedor_nome": "TATHIANA ROSELI SANTOS BATTISTI DA SILVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17591664288135",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 2,
        "total_valor": 596.57,
        "titularCpf": "04851912102"
      },
      {
        "vendedor_cpf": "00977687155",
        "vendedor_nome": "RAFAEL SILVA FERREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17600149464720",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 1538.32,
        "titularCpf": "70102862133"
      },
      {
        "vendedor_cpf": "01193374103",
        "vendedor_nome": "ADEMILSON DA SILVA PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17603930387373",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 2,
        "total_valor": 1013.61,
        "titularCpf": "02925943136"
      },
      {
        "vendedor_cpf": "01436512182",
        "vendedor_nome": "MARCOS VINICIUS EMILIANO DUTRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17604967069644",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "06306066179"
      },
      {
        "vendedor_cpf": "03603025130",
        "vendedor_nome": "ANA BEATRIZ DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17601387527530",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "04945636133"
      },
      {
        "vendedor_cpf": "72613297115",
        "vendedor_nome": "ANA PAULA LIPO LOPES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17605610165121",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 675.63,
        "titularCpf": "00745816274"
      },
      {
        "vendedor_cpf": "14077361400",
        "vendedor_nome": "MILCA DE MEDEIROS DANTAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17605631765043",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "08918258194"
      },
      {
        "vendedor_cpf": "71214828191",
        "vendedor_nome": "FERNANDO NOLETO MACHADO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17606449962829",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 614.66,
        "titularCpf": "03710110190"
      },
      {
        "vendedor_cpf": "36868698100",
        "vendedor_nome": "GILMAR RIBEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17610713077194",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "10576719161"
      },
      {
        "vendedor_cpf": "01810947111",
        "vendedor_nome": "JEFFERSON GOMES GUEDES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17610835785966",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "11462037135"
      },
      {
        "vendedor_cpf": "25517937349",
        "vendedor_nome": "MARIA GORETH DIAS FONSECA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17603900847525",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 7,
        "total_valor": 2638.65,
        "titularCpf": "73022403100"
      },
      {
        "vendedor_cpf": "08989608600",
        "vendedor_nome": "JOSE GONCALVES NETO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17603815457278",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 2,
        "total_valor": 1143.16,
        "titularCpf": "95838368187"
      },
      {
        "vendedor_cpf": "71234217104",
        "vendedor_nome": "GLEDSON TAVARES DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17631446391623",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "07688087155"
      },
      {
        "vendedor_cpf": "55263895100",
        "vendedor_nome": "MARILDA CASTRO DUARTE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17629511219058",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "05113026140"
      },
      {
        "vendedor_cpf": "00855333197",
        "vendedor_nome": "BRUNA DOS SANTOS CORREIA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17630596019020",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "05303933105"
      },
      {
        "vendedor_cpf": "04820536150",
        "vendedor_nome": "JECIANE UELLEN DE OLIVEIRA MARQUES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17630407003884",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "07624487179"
      },
      {
        "vendedor_cpf": "08989608600",
        "vendedor_nome": "JOSE GONCALVES NETO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17628090582115",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 3,
        "total_valor": 1129.41,
        "titularCpf": "05113575160"
      },
      {
        "vendedor_cpf": "00384233163",
        "vendedor_nome": "LIGIA MARQUEZ SOCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17631525285503",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 592.38,
        "titularCpf": "05751166175"
      },
      {
        "vendedor_cpf": "07742023199",
        "vendedor_nome": "ERIKA ALEXANDRA ROMÃO DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17630823121177",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "05653930148"
      },
      {
        "vendedor_cpf": "05155224144",
        "vendedor_nome": "KARINA MARTINS MARQUES DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17631227629142",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "07877424140"
      },
      {
        "vendedor_cpf": "25290681272",
        "vendedor_nome": "FRANCISCO REIS ARAUJO TEOFILO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17631715034171",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "07236691127"
      },
      {
        "vendedor_cpf": "77616286100",
        "vendedor_nome": "MONICA ALVES DE ANDRADE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17628889854297",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "05530681131"
      },
      {
        "vendedor_cpf": "03769358392",
        "vendedor_nome": "THIAGO ALVES DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17631486819658",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 2,
        "total_valor": 894.76,
        "titularCpf": "07600632144"
      },
      {
        "vendedor_cpf": "72450231153",
        "vendedor_nome": "ANA PAULA BARBOSA MESQUITA RODRIGUES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17631313573951",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "05963040132"
      },
      {
        "vendedor_cpf": "03088475126",
        "vendedor_nome": "PAULO GEOVAN OLIVEIRA DA CONCEICAO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17631431654968",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 1478.61,
        "titularCpf": "77010760187"
      },
      {
        "vendedor_cpf": "00634528122",
        "vendedor_nome": "TATIANA SOARES LINCES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17630647836670",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "10764129120"
      },
      {
        "vendedor_cpf": "00384233163",
        "vendedor_nome": "LIGIA MARQUEZ SOCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17631534442345",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "05751180160"
      },
      {
        "vendedor_cpf": "65918568115",
        "vendedor_nome": "RODRIGO NOLETO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17621808127117",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 2,
        "total_valor": 2243.23,
        "titularCpf": "26495848234"
      },
      {
        "vendedor_cpf": "72637498153",
        "vendedor_nome": "ALINE CARNEIRO DE LIMA FREITAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17623567267166",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 518.19,
        "titularCpf": "01219434108"
      },
      {
        "vendedor_cpf": "73157082191",
        "vendedor_nome": "ERICA CHRISTINE DE PADUA ANDRADE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17624460024207",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "04026458121"
      },
      {
        "vendedor_cpf": "72744251100",
        "vendedor_nome": "LUIZ ANTONIO FERREIRA CARVALHO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17630768677235",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 551.81,
        "titularCpf": "71249150159"
      },
      {
        "vendedor_cpf": "01101219106",
        "vendedor_nome": "DIEGO LIRA FARIAS DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17631515294630",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 3,
        "total_valor": 1807.86,
        "titularCpf": "31534576894"
      },
      {
        "vendedor_cpf": "01496984102",
        "vendedor_nome": "PAULO KALLIL RIBEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17630671278069",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 2,
        "total_valor": 771.09,
        "titularCpf": "01086223128"
      },
      {
        "vendedor_cpf": "00662533143",
        "vendedor_nome": "IVONALDA SERPA LIMA CAVALCANTE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17628016795120",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "05546213124"
      },
      {
        "vendedor_cpf": "05318407196",
        "vendedor_nome": "KAMILA MOREIRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17631479786561",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 341.25,
        "titularCpf": "52923307879"
      },
      {
        "vendedor_cpf": "00801570174",
        "vendedor_nome": "MICHELE CRISTINA DO NASCIMENTO LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17634169234362",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "05573330160"
      },
      {
        "vendedor_cpf": "07336021182",
        "vendedor_nome": "ISABELLA DOS SANTOS FERNANDES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17631357955719",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "08470736370"
      },
      {
        "vendedor_cpf": "78206634134",
        "vendedor_nome": "CRISTIANE LOUISE LOURENÇO SILVA BENVINDO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17629779914600",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "05365587103"
      },
      {
        "vendedor_cpf": "60251115100",
        "vendedor_nome": "ADENILSON LOPES MARQUES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17631654470664",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "07320333147"
      },
      {
        "vendedor_cpf": "60251115100",
        "vendedor_nome": "ADENILSON LOPES MARQUES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17628852766395",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "07741406159"
      },
      {
        "vendedor_cpf": "08266789630",
        "vendedor_nome": "JOSE MARLEI OLIVEIRA DE ABREU",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17630455843147",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "04936955167"
      },
      {
        "vendedor_cpf": "55369804168",
        "vendedor_nome": "ZENAIDE DE ARAUJO SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17629896188999",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 2,
        "total_valor": 1084.38,
        "titularCpf": "01369230117"
      },
      {
        "vendedor_cpf": "01189796120",
        "vendedor_nome": "FERNANDA MAIARA OLIVEIRA MAIA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17633855748530",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "06060100171"
      },
      {
        "vendedor_cpf": "71214828191",
        "vendedor_nome": "FERNANDO NOLETO MACHADO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17628181612686",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 614.66,
        "titularCpf": "08337938617"
      },
      {
        "vendedor_cpf": "01013944119",
        "vendedor_nome": "SONIA MARIA LIMA DA SILVA MACIEL",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17629636966578",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 3,
        "total_valor": 1409.63,
        "titularCpf": "03513197195"
      },
      {
        "vendedor_cpf": "04059884197",
        "vendedor_nome": "TAYNAH PRISCILA GAMA DE ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17628772037284",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "06884491159"
      },
      {
        "vendedor_cpf": "03898646173",
        "vendedor_nome": "LORENA RODRIGUES SALES DE ALMEIDA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17628741523170",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "00044824254"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17628680052094",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "05890396102"
      },
      {
        "vendedor_cpf": "71949577104",
        "vendedor_nome": "RONAN DA SOLEDADE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17628254390960",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "03713478155"
      },
      {
        "vendedor_cpf": "01166007138",
        "vendedor_nome": "ROGERIO TORRES DE OLIVERIA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17627969596747",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "04818998125"
      },
      {
        "vendedor_cpf": "00197445101",
        "vendedor_nome": "CARMINDA DE OLIVEIRA NETO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17627791984788",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "04575038156"
      },
      {
        "vendedor_cpf": "71419993100",
        "vendedor_nome": "JAIRO GOMES DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17625502646317",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 657.71,
        "titularCpf": "03059500100"
      },
      {
        "vendedor_cpf": "60695820125",
        "vendedor_nome": "ALEXANDRE NONATO RIBEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17625461465215",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 4,
        "total_valor": 2704.86,
        "titularCpf": "65928059191"
      },
      {
        "vendedor_cpf": "92367941149",
        "vendedor_nome": "THAIS DIAS RODRIGUES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17625446166639",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "10038714108"
      },
      {
        "vendedor_cpf": "86911716187",
        "vendedor_nome": "FABIO RODRIGUES DA CUNHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17625440574648",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "13802247728"
      },
      {
        "vendedor_cpf": "72635797153",
        "vendedor_nome": "RAFAEL MORAES MIRANDA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17625243852927",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 960.22,
        "titularCpf": "71748750178"
      },
      {
        "vendedor_cpf": "87815907172",
        "vendedor_nome": "LUCIENE DA SILVA PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17625151355005",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "08313998644"
      },
      {
        "vendedor_cpf": "04066347185",
        "vendedor_nome": "RENAN SOUSA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17624446944060",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "03806407169"
      },
      {
        "vendedor_cpf": "87815907172",
        "vendedor_nome": "LUCIENE DA SILVA PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17623688275759",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "03309424332"
      },
      {
        "vendedor_cpf": "02558943170",
        "vendedor_nome": "LIDIA MARIA NUNES LEAL ROCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17622876754218",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 462.73,
        "titularCpf": "04252885108"
      },
      {
        "vendedor_cpf": "72606649168",
        "vendedor_nome": "PATRICIA DUARTE DA SILVA GONCALVES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17622659641110",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 3,
        "total_valor": 1440.28,
        "titularCpf": "01288442645"
      },
      {
        "vendedor_cpf": "01231447109",
        "vendedor_nome": "LUIS HENRIQUE MATOS BARRETO DE LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17619268432047",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "05159327100"
      },
      {
        "vendedor_cpf": "07213405128",
        "vendedor_nome": "LEONARDO SOARES GONCALVES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17618586384305",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 456.92,
        "titularCpf": "04262053164"
      },
      {
        "vendedor_cpf": "95339329100",
        "vendedor_nome": "CARLOS MATIAS DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17618505853818",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "08578124162"
      },
      {
        "vendedor_cpf": "72635797153",
        "vendedor_nome": "RAFAEL MORAES MIRANDA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17616868229469",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 960.22,
        "titularCpf": "72429003104"
      },
      {
        "vendedor_cpf": "05419090104",
        "vendedor_nome": "ELIEZER AMARAL MONTEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17629421031507",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 675.63,
        "titularCpf": "47774754172"
      },
      {
        "vendedor_cpf": "55369057168",
        "vendedor_nome": "CARMEM LUCIA SANTOS ALMEIDA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17624412418363",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "05404135182"
      },
      {
        "vendedor_cpf": "00670482188",
        "vendedor_nome": "ALEXANDRE SILVA GONDIN",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17628055398301",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "11710674709"
      },
      {
        "vendedor_cpf": "75183021791",
        "vendedor_nome": "SIMONE SANTOS DE CARVALHO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17652991434727",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 3,
        "total_valor": 1374.51,
        "titularCpf": "73437735187"
      },
      {
        "vendedor_cpf": "84489332149",
        "vendedor_nome": "EDNA DE CAMARGOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17647750858285",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 3,
        "total_valor": 1224.81,
        "titularCpf": "03371625141"
      },
      {
        "vendedor_cpf": "03943973123",
        "vendedor_nome": "JULIANA COSTA SOARES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17649692682221",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 649.11,
        "titularCpf": "72612070125"
      },
      {
        "vendedor_cpf": "04820536150",
        "vendedor_nome": "JECIANE UELLEN DE OLIVEIRA MARQUES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17648056687994",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "07795596142"
      },
      {
        "vendedor_cpf": "82976686149",
        "vendedor_nome": "LUCIANA  DO COUTO NUNES JACOBINA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17653904640797",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 1156.26,
        "titularCpf": "81201737168"
      },
      {
        "vendedor_cpf": "03423555114",
        "vendedor_nome": "BARBARA AGUIAR VIANA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17653758557658",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "06333667145"
      },
      {
        "vendedor_cpf": "12612044841",
        "vendedor_nome": "EDMILSON SANTANA DA COSTA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17653722400879",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 592.38,
        "titularCpf": "06261891109"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17653736743939",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 551.81,
        "titularCpf": "72791055134"
      },
      {
        "vendedor_cpf": "90132963191",
        "vendedor_nome": "VIVIANE RIBEIRO DE ALBUQUERQUE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17653983159360",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 575.01,
        "titularCpf": "09504534473"
      },
      {
        "vendedor_cpf": "00038974193",
        "vendedor_nome": "WILSON SOARES DE ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17654742485412",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "12945231638"
      },
      {
        "vendedor_cpf": "71214828191",
        "vendedor_nome": "FERNANDO NOLETO MACHADO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17654929462090",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 1984.40,
        "titularCpf": "18508111134"
      },
      {
        "vendedor_cpf": "55400795153",
        "vendedor_nome": "KELLY FERNANDES VILHENA ZEIDAN",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17654929551467",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "72926309104"
      },
      {
        "vendedor_cpf": "02330635109",
        "vendedor_nome": "LEANDRO FREITAS DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17655406077181",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 2,
        "total_valor": 1247.86,
        "titularCpf": "73158232120"
      },
      {
        "vendedor_cpf": "80581161149",
        "vendedor_nome": "KATHIANE SOARES PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17655520843336",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "02286315132"
      },
      {
        "vendedor_cpf": "82347719149",
        "vendedor_nome": "EDILZA MARIA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17655538815369",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "07603375193"
      },
      {
        "vendedor_cpf": "18993850291",
        "vendedor_nome": "ANA MARIA PEREIRA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17655546832328",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "07212588164"
      },
      {
        "vendedor_cpf": "02429050137",
        "vendedor_nome": "LEONARDO SILVA BARBOSA CRUZ",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17655549026452",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "01758908114"
      },
      {
        "vendedor_cpf": "04322276105",
        "vendedor_nome": "ESTHEFANY BRUNA SIQUEIRA DE ASSIS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17655677487781",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "07268004141"
      },
      {
        "vendedor_cpf": "01913335143",
        "vendedor_nome": "ANA PAULA PEREIRA FRANCA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17655764955303",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 2,
        "total_valor": 725.91,
        "titularCpf": "05259600150"
      },
      {
        "vendedor_cpf": "72558989120",
        "vendedor_nome": "FERNANDA GALDINO SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17656102572136",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "02970850184"
      },
      {
        "vendedor_cpf": "72583240110",
        "vendedor_nome": "CLEITON DE SOUSA TOME",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17656311292011",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "11618560131"
      },
      {
        "vendedor_cpf": "99743574115",
        "vendedor_nome": "RODRIGO FELIX DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17656366918967",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "60559419376"
      },
      {
        "vendedor_cpf": "02429050137",
        "vendedor_nome": "LEONARDO SILVA BARBOSA CRUZ",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17658213319138",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "11619655136"
      },
      {
        "vendedor_cpf": "45496218187",
        "vendedor_nome": "NICACIO LUIS DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17658304796069",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "05969582182"
      },
      {
        "vendedor_cpf": "80314627120",
        "vendedor_nome": "VANESSA LINHARES SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17658342901549",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "08020986146"
      },
      {
        "vendedor_cpf": "14115464747",
        "vendedor_nome": "THAYANE MAYNAR DO CARMO SAMPAIO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17658349984840",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "06736674131"
      },
      {
        "vendedor_cpf": "73440540197",
        "vendedor_nome": "ANDERSON DA SILVA COSTA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17658359309565",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "08412798104"
      },
      {
        "vendedor_cpf": "09718852654",
        "vendedor_nome": "CILEIDE FATIMA FERREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17653851489534",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "02646346166"
      },
      {
        "vendedor_cpf": "02641891166",
        "vendedor_nome": "JOSE OGLEIDE PAULA RODRIGUES JUNIOR  - PRIMEBRASIL",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17568406247017",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "08078841620"
      },
      {
        "vendedor_cpf": "25517937349",
        "vendedor_nome": "MARIA GORETH DIAS FONSECA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17569209997222",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 3,
        "total_valor": 2415.60,
        "titularCpf": "96868325134"
      },
      {
        "vendedor_cpf": "03946068170",
        "vendedor_nome": "ALICE PINHEIRO POUPEU VIANA NETA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17570270111981",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "71815263164"
      },
      {
        "vendedor_cpf": "71419993100",
        "vendedor_nome": "JAIRO GOMES DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17570654163761",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "03424521183"
      },
      {
        "vendedor_cpf": "06510554151",
        "vendedor_nome": "WESLEY FERREIRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17570742225522",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 796.01,
        "titularCpf": "86842064104"
      },
      {
        "vendedor_cpf": "71262610125",
        "vendedor_nome": "WESTER SOUZA ITACARAMBI",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17570762860467",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 852.96,
        "titularCpf": "99828952149"
      },
      {
        "vendedor_cpf": "06510554151",
        "vendedor_nome": "WESLEY FERREIRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17570878282459",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 644.11,
        "titularCpf": "72338903153"
      },
      {
        "vendedor_cpf": "80339662115",
        "vendedor_nome": "DANIELLE RODRIGUES LOUREIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17571132621765",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 1116.10,
        "titularCpf": "56383690159"
      },
      {
        "vendedor_cpf": "05121077181",
        "vendedor_nome": "STEPHANE RODRIGUES ASSUNCAO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17573354392712",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 597.92,
        "titularCpf": "03812963183"
      },
      {
        "vendedor_cpf": "01781043108",
        "vendedor_nome": "ELDON ROCHA MARQUES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17573485684435",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "03993813170"
      },
      {
        "vendedor_cpf": "04023103144",
        "vendedor_nome": "GUILHERME CORREIA BRAGA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17573630599570",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "81985720230"
      },
      {
        "vendedor_cpf": "04066347185",
        "vendedor_nome": "RENAN SOUSA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17574203857835",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "02486183183"
      },
      {
        "vendedor_cpf": "04811947118",
        "vendedor_nome": "NAYARA LOPES DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17574222101625",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "10373944101"
      },
      {
        "vendedor_cpf": "01231447109",
        "vendedor_nome": "LUIS HENRIQUE MATOS BARRETO DE LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17574244352155",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "12071693663"
      },
      {
        "vendedor_cpf": "80396925120",
        "vendedor_nome": "RAFAELA SILVA DANEZI",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17574301853992",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "05381911122"
      },
      {
        "vendedor_cpf": "37429620191",
        "vendedor_nome": "KLEBER LUIZ GOMES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17574572183695",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "09544000119"
      },
      {
        "vendedor_cpf": "95490698187",
        "vendedor_nome": "PATRICIA ALCANTARA VIANA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17574641731876",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 294.01,
        "titularCpf": "04833922193"
      },
      {
        "vendedor_cpf": "03133365126",
        "vendedor_nome": "INARA BRUNA SOUSA BARBOSA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17574679689340",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "03329460105"
      },
      {
        "vendedor_cpf": "02558943170",
        "vendedor_nome": "LIDIA MARIA NUNES LEAL ROCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17575093927350",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "00689244100"
      },
      {
        "vendedor_cpf": "04377187198",
        "vendedor_nome": "ANTONIA JARLENE CAVALCANTE SALES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17575170025574",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "09522937142"
      },
      {
        "vendedor_cpf": "04525733195",
        "vendedor_nome": "NATALIA DE SOUSA POMPEU",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17575174688941",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "06607229174"
      },
      {
        "vendedor_cpf": "00247949612",
        "vendedor_nome": "KELLY MARCIA RIBEIRO DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17575243685010",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "09879210107"
      },
      {
        "vendedor_cpf": "03178237100",
        "vendedor_nome": "MATEUS CASSEB FERRAZ SAAVEDRA DIAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17575312918505",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 402.14,
        "titularCpf": "03888252199"
      },
      {
        "vendedor_cpf": "01945934360",
        "vendedor_nome": "ROSSANA KARLA DE OLIVEIRA QUEIROZ",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17575332955654",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "05176507110"
      },
      {
        "vendedor_cpf": "00820125121",
        "vendedor_nome": "LUCIANO DOS ANJOS TEIXEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17575426693327",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 502.10,
        "titularCpf": "04326312165"
      },
      {
        "vendedor_cpf": "93896069187",
        "vendedor_nome": "MILTON AMARAL LEMBO JUNIOR",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17575436125807",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "05780760128"
      },
      {
        "vendedor_cpf": "05068778176",
        "vendedor_nome": "PAULO HENRIQUE XIMENES RUFINO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17575450874897",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 407.88,
        "titularCpf": "07690500188"
      },
      {
        "vendedor_cpf": "37429620191",
        "vendedor_nome": "KLEBER LUIZ GOMES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17576191174433",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "12010322614"
      },
      {
        "vendedor_cpf": "01436512182",
        "vendedor_nome": "MARCOS VINICIUS EMILIANO DUTRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17576268087464",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "10686873122"
      },
      {
        "vendedor_cpf": "01781043108",
        "vendedor_nome": "ELDON ROCHA MARQUES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17576417412148",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 2,
        "total_valor": 958.82,
        "titularCpf": "04968373112"
      },
      {
        "vendedor_cpf": "00247949612",
        "vendedor_nome": "KELLY MARCIA RIBEIRO DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17576850651649",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 444.88,
        "titularCpf": "08041775110"
      },
      {
        "vendedor_cpf": "01436512182",
        "vendedor_nome": "MARCOS VINICIUS EMILIANO DUTRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17577004346489",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "99041634134"
      },
      {
        "vendedor_cpf": "72614170178",
        "vendedor_nome": "WAGNER BORGES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17577029666628",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "08948557190"
      },
      {
        "vendedor_cpf": "87421453504",
        "vendedor_nome": "VENISIA LIMA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17577106058955",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 649.11,
        "titularCpf": "71292225149"
      },
      {
        "vendedor_cpf": "03410688102",
        "vendedor_nome": "SILOM BRANDAO SCHAIBLICH",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17577112599518",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "03429022100"
      },
      {
        "vendedor_cpf": "59872373272",
        "vendedor_nome": "ADRIANO OLIVEIRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17579448354067",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "00244004161"
      },
      {
        "vendedor_cpf": "00801570174",
        "vendedor_nome": "MICHELE CRISTINA DO NASCIMENTO LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17579576772840",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "11416090100"
      },
      {
        "vendedor_cpf": "78812283187",
        "vendedor_nome": "CLAUDIA RENATA FERNANDES PINHEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17579622688101",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "09819303109"
      },
      {
        "vendedor_cpf": "52842681215",
        "vendedor_nome": "ADRIANE CELINE FERREIRA DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17579725336570",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "06338555108"
      },
      {
        "vendedor_cpf": "59872373272",
        "vendedor_nome": "ADRIANO OLIVEIRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17580235758267",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "02990597158"
      },
      {
        "vendedor_cpf": "06584698190",
        "vendedor_nome": "LEOMAR RAMOS FERREIRA DE PAIVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17580474620107",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "01131859103"
      },
      {
        "vendedor_cpf": "87421453504",
        "vendedor_nome": "VENISIA LIMA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17580475471147",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 649.11,
        "titularCpf": "71292233168"
      },
      {
        "vendedor_cpf": "00798192143",
        "vendedor_nome": "RUDSON FERNANDES DE AZEREDO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17580476331492",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 876.96,
        "titularCpf": "86829106168"
      },
      {
        "vendedor_cpf": "00808314190",
        "vendedor_nome": "AMARALINA DE MEDEIROS SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17580489310495",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 2,
        "total_valor": 752.73,
        "titularCpf": "08422997185"
      },
      {
        "vendedor_cpf": "01882936124",
        "vendedor_nome": "ANA RAQUEL RIBEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17580497938625",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 876.96,
        "titularCpf": "92728685134"
      },
      {
        "vendedor_cpf": "09038010192",
        "vendedor_nome": "NATALY ROSA FERREIRA DOURADO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17580505130622",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 796.01,
        "titularCpf": "89338979172"
      },
      {
        "vendedor_cpf": "55336531120",
        "vendedor_nome": "MARCELO ANTONIO FERREIRA DE SOUSA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17581282878498",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 439.14,
        "titularCpf": "06360010160"
      },
      {
        "vendedor_cpf": "05119567118",
        "vendedor_nome": "THAIS RODRIGUES NEIVA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17581287389890",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 407.88,
        "titularCpf": "08490739102"
      },
      {
        "vendedor_cpf": "89778286191",
        "vendedor_nome": "PAULO HENRIQUE DA FONSECA FIGUEIREDO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17581459131989",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 873.38,
        "titularCpf": "74692747153"
      },
      {
        "vendedor_cpf": "00977687155",
        "vendedor_nome": "RAFAEL SILVA FERREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17582068711132",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 501.39,
        "titularCpf": "34012616811"
      },
      {
        "vendedor_cpf": "00247949612",
        "vendedor_nome": "KELLY MARCIA RIBEIRO DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17579582795323",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 2,
        "total_valor": 583.02,
        "titularCpf": "08202880122"
      },
      {
        "vendedor_cpf": "03769358392",
        "vendedor_nome": "THIAGO ALVES DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17582148744006",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 2,
        "total_valor": 983.74,
        "titularCpf": "05734224197"
      },
      {
        "vendedor_cpf": "01882936124",
        "vendedor_nome": "ANA RAQUEL RIBEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17582198553347",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "08274629132"
      },
      {
        "vendedor_cpf": "01436512182",
        "vendedor_nome": "MARCOS VINICIUS EMILIANO DUTRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17577008718178",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 3,
        "total_valor": 1544.02,
        "titularCpf": "02284076130"
      },
      {
        "vendedor_cpf": "49050788149",
        "vendedor_nome": "MARINEIA LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17582315804304",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "10349050155"
      },
      {
        "vendedor_cpf": "13833588187",
        "vendedor_nome": "MARIA OTILIA RODRIGUES DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17582887754153",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 876.96,
        "titularCpf": "66954053287"
      },
      {
        "vendedor_cpf": "03133365126",
        "vendedor_nome": "INARA BRUNA SOUSA BARBOSA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17574662466984",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "06662608181"
      },
      {
        "vendedor_cpf": "77083032149",
        "vendedor_nome": "IRIS BESERRA DO NASCIMENTO COSTA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17582939428574",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 1344.32,
        "titularCpf": "77452054172"
      },
      {
        "vendedor_cpf": "00820125121",
        "vendedor_nome": "LUCIANO DOS ANJOS TEIXEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17582988711430",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 408.50,
        "titularCpf": "05724700107"
      },
      {
        "vendedor_cpf": "05319558775",
        "vendedor_nome": "JOANA AGUEDA DA SILVA PAVAO MOREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17583040841172",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "02246668190"
      },
      {
        "vendedor_cpf": "71310126100",
        "vendedor_nome": "WESLEY DE OLIVEIRA SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17583048990652",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "05974785118"
      },
      {
        "vendedor_cpf": "73157082191",
        "vendedor_nome": "ERICA CHRISTINE DE PADUA ANDRADE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17583068191769",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 2,
        "total_valor": 944.80,
        "titularCpf": "07024147199"
      },
      {
        "vendedor_cpf": "46210199100",
        "vendedor_nome": "ROSANE DE SOUZA MAGALHAES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17583090424508",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 2140.40,
        "titularCpf": "26243440559"
      },
      {
        "vendedor_cpf": "05131993148",
        "vendedor_nome": "BRENDA EVELYN SANTOS BARBOSA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17583149244300",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 592.38,
        "titularCpf": "06029621378"
      },
      {
        "vendedor_cpf": "05131993148",
        "vendedor_nome": "BRENDA EVELYN SANTOS BARBOSA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17583171739585",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 2,
        "total_valor": 798.00,
        "titularCpf": "06506957123"
      },
      {
        "vendedor_cpf": "72606649168",
        "vendedor_nome": "PATRICIA DUARTE DA SILVA GONCALVES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17583203541030",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "02816031110"
      },
      {
        "vendedor_cpf": "69262993153",
        "vendedor_nome": "ELAINE NUNES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17585382422427",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 960.22,
        "titularCpf": "99022389120"
      },
      {
        "vendedor_cpf": "07138536119",
        "vendedor_nome": "THIAGO GONCALVES DE SOUSA REIS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17585452954004",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "03664718135"
      },
      {
        "vendedor_cpf": "01231447109",
        "vendedor_nome": "LUIS HENRIQUE MATOS BARRETO DE LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17585492857470",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "02976857164"
      },
      {
        "vendedor_cpf": "69993700100",
        "vendedor_nome": "PATRICIA MOREIRA SALDANHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17585635992874",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "02242618199"
      },
      {
        "vendedor_cpf": "71825738149",
        "vendedor_nome": "DANIELA SANTOS COSTA DE AQUINO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17585636438666",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 649.11,
        "titularCpf": "00569731100"
      },
      {
        "vendedor_cpf": "08871632702",
        "vendedor_nome": "VINICIUS GOMES BATISTA MARQUES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17585680013447",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "05245209179"
      },
      {
        "vendedor_cpf": "02558943170",
        "vendedor_nome": "LIDIA MARIA NUNES LEAL ROCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17585680849498",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 852.96,
        "titularCpf": "98574736104"
      },
      {
        "vendedor_cpf": "22378197187",
        "vendedor_nome": "ABELANGELO ANDREZA DE CARVALHO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17586038277141",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "05621363124"
      },
      {
        "vendedor_cpf": "06510554151",
        "vendedor_nome": "WESLEY FERREIRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17586339374807",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 1773.33,
        "titularCpf": "00932544401"
      },
      {
        "vendedor_cpf": "53062582391",
        "vendedor_nome": "NAZARE DE ALMEIDA RAMOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17586349618318",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "00203450116"
      },
      {
        "vendedor_cpf": "02872756124",
        "vendedor_nome": "VITÓRIA CAMÊLO SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17586383123548",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 960.22,
        "titularCpf": "02251074570"
      },
      {
        "vendedor_cpf": "02872756124",
        "vendedor_nome": "VITÓRIA CAMÊLO SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17586389460947",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 873.38,
        "titularCpf": "03066979121"
      },
      {
        "vendedor_cpf": "05513042193",
        "vendedor_nome": "LEILA CLAUDINO DA CRUZ SOUSA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17586421084926",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "10852184140"
      },
      {
        "vendedor_cpf": "99743574115",
        "vendedor_nome": "RODRIGO FELIX DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17586443489531",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "06851984130"
      },
      {
        "vendedor_cpf": "03423555114",
        "vendedor_nome": "BARBARA AGUIAR VIANA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17586593854482",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "05615779195"
      },
      {
        "vendedor_cpf": "60559799187",
        "vendedor_nome": "MARIA DE LOURDES XIMENES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17586636941562",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "06527054130"
      },
      {
        "vendedor_cpf": "16078870106",
        "vendedor_nome": "RICARDO DE FARIA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17586700173129",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 2,
        "total_valor": 590.56,
        "titularCpf": "07451793125"
      },
      {
        "vendedor_cpf": "03197081102",
        "vendedor_nome": "MATHEUS FERNANDES DA SILVA ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17587177386170",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "05114710176"
      },
      {
        "vendedor_cpf": "00247949612",
        "vendedor_nome": "KELLY MARCIA RIBEIRO DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17587198951159",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "10176925139"
      },
      {
        "vendedor_cpf": "66587727115",
        "vendedor_nome": "ANA ALAIDE RIBEIRO MARTINS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17587234559144",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "08021468130"
      },
      {
        "vendedor_cpf": "01143356136",
        "vendedor_nome": "LUCILENE SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17587297577602",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "01894489110"
      },
      {
        "vendedor_cpf": "49340832191",
        "vendedor_nome": "MARIA SIMONE CERQUEIRA DE CARVALHO FRANCO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17587346155358",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "01822835186"
      },
      {
        "vendedor_cpf": "60559799187",
        "vendedor_nome": "MARIA DE LOURDES XIMENES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17587393533655",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 4,
        "total_valor": 2549.70,
        "titularCpf": "91625246153"
      },
      {
        "vendedor_cpf": "89374770172",
        "vendedor_nome": "ERIVANIA BENEDITA SOUZA ROCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17580643093073",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 501.39,
        "titularCpf": "08894137112"
      },
      {
        "vendedor_cpf": "73053511134",
        "vendedor_nome": "MARCIO BARRETO DE MELO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17587401407917",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "06513126550"
      },
      {
        "vendedor_cpf": "01882936124",
        "vendedor_nome": "ANA RAQUEL RIBEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17587402338595",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "03104355100"
      },
      {
        "vendedor_cpf": "03201428175",
        "vendedor_nome": "JUNIO GONÇALVES DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17587417765522",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 649.11,
        "titularCpf": "02370983183"
      },
      {
        "vendedor_cpf": "01436512182",
        "vendedor_nome": "MARCOS VINICIUS EMILIANO DUTRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17587492777245",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 873.38,
        "titularCpf": "01471792110"
      },
      {
        "vendedor_cpf": "72614170178",
        "vendedor_nome": "WAGNER BORGES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17588079408147",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 801.01,
        "titularCpf": "89635060106"
      },
      {
        "vendedor_cpf": "08989608600",
        "vendedor_nome": "JOSE GONCALVES NETO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17588089856963",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "07457094199"
      },
      {
        "vendedor_cpf": "60695820125",
        "vendedor_nome": "ALEXANDRE NONATO RIBEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17588107669613",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 2,
        "total_valor": 1232.86,
        "titularCpf": "88077292100"
      },
      {
        "vendedor_cpf": "72744251100",
        "vendedor_nome": "LUIZ ANTONIO FERREIRA CARVALHO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17588202030962",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 2,
        "total_valor": 1018.61,
        "titularCpf": "02882977174"
      },
      {
        "vendedor_cpf": "46210199100",
        "vendedor_nome": "ROSANE DE SOUZA MAGALHAES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17588219015378",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "02737163102"
      },
      {
        "vendedor_cpf": "53990382187",
        "vendedor_nome": "PATRICIA DE OLIVEIRA AZEVEDO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17588237200990",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 3,
        "total_valor": 1440.28,
        "titularCpf": "72162481120"
      },
      {
        "vendedor_cpf": "04501742127",
        "vendedor_nome": "LORRANY CHRISTINY DE OLIVEIRA MENEZES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17579662385371",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 407.88,
        "titularCpf": "06389162162"
      },
      {
        "vendedor_cpf": "03423555114",
        "vendedor_nome": "BARBARA AGUIAR VIANA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17588273798185",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 4,
        "total_valor": 1817.1,
        "titularCpf": "01557703140"
      },
      {
        "vendedor_cpf": "05119567118",
        "vendedor_nome": "THAIS RODRIGUES NEIVA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17588340927421",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "04122033160"
      },
      {
        "vendedor_cpf": "77083032149",
        "vendedor_nome": "IRIS BESERRA DO NASCIMENTO COSTA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17588384641445",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "05402947139"
      },
      {
        "vendedor_cpf": "72014237115",
        "vendedor_nome": "FABRICIO GUIMARAES LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17588426839035",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "10166337188"
      },
      {
        "vendedor_cpf": "04631233109",
        "vendedor_nome": "ANDREIA PEREIRA DE SOIZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17587515950952",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 2,
        "total_valor": 769.04,
        "titularCpf": "01509094113"
      },
      {
        "vendedor_cpf": "25290681272",
        "vendedor_nome": "FRANCISCO REIS ARAUJO TEOFILO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17582995194767",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 876.96,
        "titularCpf": "64889580387"
      },
      {
        "vendedor_cpf": "87421453504",
        "vendedor_nome": "VENISIA LIMA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17588919384633",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 876.96,
        "titularCpf": "89085302153"
      },
      {
        "vendedor_cpf": "00796292450",
        "vendedor_nome": "GISELE CHAVES CABOCLO DE PAULA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17589167078830",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "71259822125"
      },
      {
        "vendedor_cpf": "03197081102",
        "vendedor_nome": "MATHEUS FERNANDES DA SILVA ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17589178575045",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "02255458101"
      },
      {
        "vendedor_cpf": "00977687155",
        "vendedor_nome": "RAFAEL SILVA FERREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17591609465038",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "71725556197"
      },
      {
        "vendedor_cpf": "60245662120",
        "vendedor_nome": "DEUZELINA PEREIRA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17591746006794",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "04000496190"
      },
      {
        "vendedor_cpf": "01169820123",
        "vendedor_nome": "LUCAS MIRANDA FEITOZA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17567428715981",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "10746770138"
      },
      {
        "vendedor_cpf": "72025310110",
        "vendedor_nome": "GLEIRISTON DA SILVA PINHEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17576315887770",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 1478.61,
        "titularCpf": "77788788104"
      },
      {
        "vendedor_cpf": "87815907172",
        "vendedor_nome": "LUCIENE DA SILVA PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17583088611421",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "03178032550"
      },
      {
        "vendedor_cpf": "52842681215",
        "vendedor_nome": "ADRIANE CELINE FERREIRA DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17588230066713",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "11188953125"
      },
      {
        "vendedor_cpf": "01193374103",
        "vendedor_nome": "ADEMILSON DA SILVA PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17588898615041",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "07940673521"
      },
      {
        "vendedor_cpf": "04952082130",
        "vendedor_nome": "AMANDA TEIXEIRA COHEN",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17591561710520",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 1478.61,
        "titularCpf": "80801820197"
      },
      {
        "vendedor_cpf": "92702503187",
        "vendedor_nome": "TATHIANA ROSELI SANTOS BATTISTI DA SILVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17591734792477",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 552.45,
        "titularCpf": "01682220192"
      },
      {
        "vendedor_cpf": "23881844104",
        "vendedor_nome": "OSMAR TORRES ASSUNÇÃO FILHO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17591795147263",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 649.11,
        "titularCpf": "71446290182"
      },
      {
        "vendedor_cpf": "03203283174",
        "vendedor_nome": "THAIS MIRANDA RIBEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17592353935202",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "04866255161"
      },
      {
        "vendedor_cpf": "60559799187",
        "vendedor_nome": "MARIA DE LOURDES XIMENES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17592624488383",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "04283345121"
      },
      {
        "vendedor_cpf": "80463363191",
        "vendedor_nome": "GEUADES PEREIRA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17584768547616",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 2,
        "total_valor": 958.82,
        "titularCpf": "06027441135"
      },
      {
        "vendedor_cpf": "56508050168",
        "vendedor_nome": "NILDA MARIA BARBOSA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17585623458445",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 501.39,
        "titularCpf": "02705011188"
      },
      {
        "vendedor_cpf": "03429958636",
        "vendedor_nome": "DEGMAR LUIZ DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17586565001727",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 873.38,
        "titularCpf": "74927663191"
      },
      {
        "vendedor_cpf": "71786740168",
        "vendedor_nome": "MICHELLE MARQUES DOS SANTOS FARIAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17586584268586",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 873.38,
        "titularCpf": "02359470167"
      },
      {
        "vendedor_cpf": "02330635109",
        "vendedor_nome": "LEANDRO FREITAS DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17587255368268",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "09958353148"
      },
      {
        "vendedor_cpf": "04066347185",
        "vendedor_nome": "RENAN SOUSA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17587341440006",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "06681311105"
      },
      {
        "vendedor_cpf": "01828367117",
        "vendedor_nome": "RAONNY RUCHY PEREIRA TAVARES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17587416786143",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "11509085130"
      },
      {
        "vendedor_cpf": "05157657161",
        "vendedor_nome": "SUELEN DA ROCHA NOBRE CAVALCANTE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17589136117395",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "10746549199"
      },
      {
        "vendedor_cpf": "71005604118",
        "vendedor_nome": "GUSTAVO ALYSON DE ARAGAO MESQUITA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17591504025181",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "04510921128"
      },
      {
        "vendedor_cpf": "44416148100",
        "vendedor_nome": "MARCIO DOS SANTOS PINHEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17591642422471",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "04201306160"
      },
      {
        "vendedor_cpf": "05121077181",
        "vendedor_nome": "STEPHANE RODRIGUES ASSUNCAO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17591720569005",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 2,
        "total_valor": 894.76,
        "titularCpf": "02642796116"
      },
      {
        "vendedor_cpf": "72635797153",
        "vendedor_nome": "RAFAEL MORAES MIRANDA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17591730641945",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "05995636138"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17591742660366",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 2,
        "total_valor": 974.01,
        "titularCpf": "00906078130"
      },
      {
        "vendedor_cpf": "05759322605",
        "vendedor_nome": "MARCELO ALVES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17591776862073",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "99297566120"
      },
      {
        "vendedor_cpf": "71214828191",
        "vendedor_nome": "FERNANDO NOLETO MACHADO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17592454822274",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 551.81,
        "titularCpf": "98572938168"
      },
      {
        "vendedor_cpf": "02933561140",
        "vendedor_nome": "RICARDO BERNARDES DE ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17593300122893",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "11013595106"
      },
      {
        "vendedor_cpf": "78213568168",
        "vendedor_nome": "ELIENE MARTINS SOARES FERREIRA -BESTBUY",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17594326376385",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "01096081199"
      },
      {
        "vendedor_cpf": "00670482188",
        "vendedor_nome": "ALEXANDRE SILVA GONDIN",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17594515234693",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "10076604144"
      },
      {
        "vendedor_cpf": "71419993100",
        "vendedor_nome": "JAIRO GOMES DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17595094346291",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "06255135179"
      },
      {
        "vendedor_cpf": "84489332149",
        "vendedor_nome": "EDNA DE CAMARGOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17595191002428",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "05407857170"
      },
      {
        "vendedor_cpf": "06601524107",
        "vendedor_nome": "CLAUBER RODRIGUES DE ALMEIDA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17595371352499",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "01227151101"
      },
      {
        "vendedor_cpf": "03203283174",
        "vendedor_nome": "THAIS MIRANDA RIBEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17597787840271",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "04493162112"
      },
      {
        "vendedor_cpf": "99938405134",
        "vendedor_nome": "DAYANNE CRISTINE DE FREITAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17597793287899",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "08143743101"
      },
      {
        "vendedor_cpf": "28998820153",
        "vendedor_nome": "MARIA DO CARMO BATISTA DE MORAIS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17597806278523",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "05449368178"
      },
      {
        "vendedor_cpf": "71825738149",
        "vendedor_nome": "DANIELA SANTOS COSTA DE AQUINO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17597818250751",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "79271227204"
      },
      {
        "vendedor_cpf": "69480583100",
        "vendedor_nome": "CRISTIANE BONJARDIM VAZ",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17598374314391",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 2,
        "total_valor": 1084.38,
        "titularCpf": "98371169191"
      },
      {
        "vendedor_cpf": "00670482188",
        "vendedor_nome": "ALEXANDRE SILVA GONDIN",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17598431565922",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 3,
        "total_valor": 2045.32,
        "titularCpf": "72656875153"
      },
      {
        "vendedor_cpf": "91767105134",
        "vendedor_nome": "MARIA DAS DORES CAROLINO SANTOS SAMPAIO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17598480506740",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "04898487106"
      },
      {
        "vendedor_cpf": "91767105134",
        "vendedor_nome": "MARIA DAS DORES CAROLINO SANTOS SAMPAIO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17598504190291",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "06592576103"
      },
      {
        "vendedor_cpf": "32982771187",
        "vendedor_nome": "RENALDO JUSTINO NOBREGA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17598562682028",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 876.96,
        "titularCpf": "83778187104"
      },
      {
        "vendedor_cpf": "04588865641",
        "vendedor_nome": "VIVIANE MARQUES SERRA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17598600363892",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "70267967470"
      },
      {
        "vendedor_cpf": "02773807154",
        "vendedor_nome": "WALTER MEIRELLES NETO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17598610921773",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 407.88,
        "titularCpf": "05264989192"
      },
      {
        "vendedor_cpf": "85600059191",
        "vendedor_nome": "KATIA REGINA VIANA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17599324308687",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 2,
        "total_valor": 1789.89,
        "titularCpf": "71710289171"
      },
      {
        "vendedor_cpf": "47322019890",
        "vendedor_nome": "MARIA EDUARDA FELIX DIAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17599347283539",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 3,
        "total_valor": 1050.73,
        "titularCpf": "04467745106"
      },
      {
        "vendedor_cpf": "01013944119",
        "vendedor_nome": "SONIA MARIA LIMA DA SILVA MACIEL",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17599389926047",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 649.11,
        "titularCpf": "71870008120"
      },
      {
        "vendedor_cpf": "04059884197",
        "vendedor_nome": "TAYNAH PRISCILA GAMA DE ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17599454556953",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "03749175152"
      },
      {
        "vendedor_cpf": "01081422130",
        "vendedor_nome": "YURI CESAR DE SOUZA CASTRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17599543861157",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 341.56,
        "titularCpf": "05014546161"
      },
      {
        "vendedor_cpf": "69480583100",
        "vendedor_nome": "CRISTIANE BONJARDIM VAZ",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17600257720508",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "05137123307"
      },
      {
        "vendedor_cpf": "02330635109",
        "vendedor_nome": "LEANDRO FREITAS DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17600259581889",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 453.49,
        "titularCpf": "05324266140"
      },
      {
        "vendedor_cpf": "02773807154",
        "vendedor_nome": "WALTER MEIRELLES NETO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17600285419654",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "02089273100"
      },
      {
        "vendedor_cpf": "03133365126",
        "vendedor_nome": "INARA BRUNA SOUSA BARBOSA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17600377939504",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "11581215126"
      },
      {
        "vendedor_cpf": "00820125121",
        "vendedor_nome": "LUCIANO DOS ANJOS TEIXEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17600447191658",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "02513721110"
      },
      {
        "vendedor_cpf": "03898646173",
        "vendedor_nome": "LORENA RODRIGUES SALES DE ALMEIDA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17601090203878",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 575.01,
        "titularCpf": "03706938170"
      },
      {
        "vendedor_cpf": "91767105134",
        "vendedor_nome": "MARIA DAS DORES CAROLINO SANTOS SAMPAIO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17601188346153",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "06803530116"
      },
      {
        "vendedor_cpf": "70116709120",
        "vendedor_nome": "EDUARDO PEREIRA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17601243818879",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 2,
        "total_valor": 1084.38,
        "titularCpf": "98156306104"
      },
      {
        "vendedor_cpf": "87815907172",
        "vendedor_nome": "LUCIENE DA SILVA PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17601338580870",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 685.00,
        "titularCpf": "01862010102"
      },
      {
        "vendedor_cpf": "29650666168",
        "vendedor_nome": "FRANCISCO VALBERTO LEAL DE CASTRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17601283328132",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "11491546166"
      },
      {
        "vendedor_cpf": "01268100102",
        "vendedor_nome": "LILLYANE VIANNA DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17601841574034",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 2,
        "total_valor": 764.04,
        "titularCpf": "06967040138"
      },
      {
        "vendedor_cpf": "70545810167",
        "vendedor_nome": "MANOEL ALEXANDRE DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17601903520842",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "70143338102"
      },
      {
        "vendedor_cpf": "04610593394",
        "vendedor_nome": "FELIPE LIMA SOUSA FERREIRA DE ALCANTARA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17601930951975",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "09751019192"
      },
      {
        "vendedor_cpf": "71159134120",
        "vendedor_nome": "VALDIR RUDIARD DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17602005353784",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "10690300158"
      },
      {
        "vendedor_cpf": "02506708103",
        "vendedor_nome": "GLAUBER DA SILVA MAURICIO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17603703137262",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 685.00,
        "titularCpf": "03422128182"
      },
      {
        "vendedor_cpf": "02429050137",
        "vendedor_nome": "LEONARDO SILVA BARBOSA CRUZ",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17603804287806",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "06152591112"
      },
      {
        "vendedor_cpf": "14115464747",
        "vendedor_nome": "THAYANE MAYNAR DO CARMO SAMPAIO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17603881827012",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 1156.26,
        "titularCpf": "82189617120"
      },
      {
        "vendedor_cpf": "72614170178",
        "vendedor_nome": "WAGNER BORGES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17604521718554",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "06584607143"
      },
      {
        "vendedor_cpf": "55263895100",
        "vendedor_nome": "MARILDA CASTRO DUARTE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17604552373924",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "00808502190"
      },
      {
        "vendedor_cpf": "52842681215",
        "vendedor_nome": "ADRIANE CELINE FERREIRA DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17616948669987",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 407.88,
        "titularCpf": "07582079132"
      },
      {
        "vendedor_cpf": "05986081170",
        "vendedor_nome": "ALVARO HENRIQUE DE CARVALHO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17605383732578",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 558.94,
        "titularCpf": "06412341129"
      },
      {
        "vendedor_cpf": "12273395698",
        "vendedor_nome": "GILVAN NEVES CORREA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17605391117195",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "04304293125"
      },
      {
        "vendedor_cpf": "24303771368",
        "vendedor_nome": "ANA LUCIA DOS SANTOS SOARES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17605425477898",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 407.88,
        "titularCpf": "07640891108"
      },
      {
        "vendedor_cpf": "01231447109",
        "vendedor_nome": "LUIS HENRIQUE MATOS BARRETO DE LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17616838082328",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "04705278119"
      },
      {
        "vendedor_cpf": "60695820125",
        "vendedor_nome": "ALEXANDRE NONATO RIBEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17605430631257",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "09182833109"
      },
      {
        "vendedor_cpf": "03023897174",
        "vendedor_nome": "WAYNE ALVES SOARES DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17610869454847",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "10237614162"
      },
      {
        "vendedor_cpf": "01143356136",
        "vendedor_nome": "LUCILENE SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17616772554601",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "05323137126"
      },
      {
        "vendedor_cpf": "04610593394",
        "vendedor_nome": "FELIPE LIMA SOUSA FERREIRA DE ALCANTARA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17610666582468",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 960.22,
        "titularCpf": "00001558102"
      },
      {
        "vendedor_cpf": "01475346158",
        "vendedor_nome": "PRISCILA LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17616012464923",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "05341838165"
      },
      {
        "vendedor_cpf": "05800469156",
        "vendedor_nome": "EMELY CAROLINE SILVA LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17605469074415",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "10337877106"
      },
      {
        "vendedor_cpf": "06527836198",
        "vendedor_nome": "AMANDA CAMPEIRO DE MIRANDA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17615754318421",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "17131964760"
      },
      {
        "vendedor_cpf": "02813119199",
        "vendedor_nome": "CAROLINE GALVAO AMANCIO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17614136294520",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 575.01,
        "titularCpf": "02208450183"
      },
      {
        "vendedor_cpf": "05121077181",
        "vendedor_nome": "STEPHANE RODRIGUES ASSUNCAO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17605490557708",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "07186180175"
      },
      {
        "vendedor_cpf": "04007928185",
        "vendedor_nome": "MARCIO DE SOUSA PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17614059098004",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "00335086152"
      },
      {
        "vendedor_cpf": "01436512182",
        "vendedor_nome": "MARCOS VINICIUS EMILIANO DUTRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17605528431798",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "72343478104"
      },
      {
        "vendedor_cpf": "03347586107",
        "vendedor_nome": "JOSE EDUARDO CRISTINO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17616873464896",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 551.81,
        "titularCpf": "93744200159"
      },
      {
        "vendedor_cpf": "80396925120",
        "vendedor_nome": "RAFAELA SILVA DANEZI",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17608208036302",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "03052372173"
      },
      {
        "vendedor_cpf": "99743574115",
        "vendedor_nome": "RODRIGO FELIX DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17605630610080",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "06091832140"
      },
      {
        "vendedor_cpf": "03539489185",
        "vendedor_nome": "ALINE DIAS DE MOURA SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17613394089466",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "11387240170"
      },
      {
        "vendedor_cpf": "17729157349",
        "vendedor_nome": "ELZINETE FERNANDES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17613361447888",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 2,
        "total_valor": 798.00,
        "titularCpf": "09856731178"
      },
      {
        "vendedor_cpf": "71234217104",
        "vendedor_nome": "GLEDSON TAVARES DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17607167472955",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 871.96,
        "titularCpf": "00539285129"
      },
      {
        "vendedor_cpf": "06584698190",
        "vendedor_nome": "LEOMAR RAMOS FERREIRA DE PAIVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17613333960617",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 587.38,
        "titularCpf": "05961716171"
      },
      {
        "vendedor_cpf": "78195896120",
        "vendedor_nome": "ALLAN RODRIGUES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17606288689917",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 575.01,
        "titularCpf": "03071083173"
      },
      {
        "vendedor_cpf": "87428288134",
        "vendedor_nome": "CRISTIANE MORLE DE PAULA MATOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17613218615815",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "08683750124"
      },
      {
        "vendedor_cpf": "08991842860",
        "vendedor_nome": "ROSANA KRASILCHIK TOZZI",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17612433793016",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "41247614816"
      },
      {
        "vendedor_cpf": "04610593394",
        "vendedor_nome": "FELIPE LIMA SOUSA FERREIRA DE ALCANTARA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17612361944484",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "06695009171"
      },
      {
        "vendedor_cpf": "56445520120",
        "vendedor_nome": "DENISE ABOIM INGLES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17609038125373",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "05992457194"
      },
      {
        "vendedor_cpf": "00384233163",
        "vendedor_nome": "LIGIA MARQUEZ SOCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17612313945115",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "03640522109"
      },
      {
        "vendedor_cpf": "73366528168",
        "vendedor_nome": "ANTONIA DARLENE MARTINS DE ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17606461338953",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "05376634108"
      },
      {
        "vendedor_cpf": "29271258134",
        "vendedor_nome": "JOVENTINO D ABADIA TORRES DA SILVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17607180301871",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "06464665189"
      },
      {
        "vendedor_cpf": "03203040190",
        "vendedor_nome": "THAYNA DE FATIMA SERPA FIDELES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17612204225079",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "09169817111"
      },
      {
        "vendedor_cpf": "70171890191",
        "vendedor_nome": "REGIANE GOMES DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17611637560434",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 501.39,
        "titularCpf": "04994303100"
      },
      {
        "vendedor_cpf": "53998146172",
        "vendedor_nome": "HAMILTON DE OLIVEIRA JUNIOR",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17611571705074",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "05991782130"
      },
      {
        "vendedor_cpf": "04525733195",
        "vendedor_nome": "NATALIA DE SOUSA POMPEU",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17607140509495",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 2,
        "total_valor": 798.00,
        "titularCpf": "10193701146"
      },
      {
        "vendedor_cpf": "92155871104",
        "vendedor_nome": "MARIZAM MATEUS DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17611617240890",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 2,
        "total_valor": 1084.38,
        "titularCpf": "00878222103"
      },
      {
        "vendedor_cpf": "04782462182",
        "vendedor_nome": "WILLIAN GEORGE DE FARIAS SEABRA - PF",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17611596769851",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "07555772132"
      },
      {
        "vendedor_cpf": "17729157349",
        "vendedor_nome": "ELZINETE FERNANDES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17611469190319",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 2,
        "total_valor": 899.91,
        "titularCpf": "02545931195"
      },
      {
        "vendedor_cpf": "72744251100",
        "vendedor_nome": "LUIZ ANTONIO FERREIRA CARVALHO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17607921872157",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 2,
        "total_valor": 771.09,
        "titularCpf": "03729307193"
      },
      {
        "vendedor_cpf": "04778137124",
        "vendedor_nome": "NATANAEL SAULO DA SILVA PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17616689514094",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 313.76,
        "titularCpf": "71054854181"
      },
      {
        "vendedor_cpf": "03128579180",
        "vendedor_nome": "WALTER ANDERSON SOARES MOREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17607973434718",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "05579051174"
      },
      {
        "vendedor_cpf": "03943973123",
        "vendedor_nome": "JULIANA COSTA SOARES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17611447551632",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 649.11,
        "titularCpf": "02372344161"
      },
      {
        "vendedor_cpf": "69608342104",
        "vendedor_nome": "LUCILENE JACOBINA ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17609676456830",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "10633680141"
      },
      {
        "vendedor_cpf": "26179547149",
        "vendedor_nome": "GEOVANI PEREIRA COIMBRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17611412559785",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "03904358138"
      },
      {
        "vendedor_cpf": "34279890110",
        "vendedor_nome": "PAULO CESAR DIAS BARBOSA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17611395066878",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 2,
        "total_valor": 894.76,
        "titularCpf": "03386780180"
      },
      {
        "vendedor_cpf": "97282561168",
        "vendedor_nome": "PRISCILA DE SOUZA LUCENA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17609793151539",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 2,
        "total_valor": 958.84,
        "titularCpf": "06014007121"
      },
      {
        "vendedor_cpf": "87815907172",
        "vendedor_nome": "LUCIENE DA SILVA PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17609872300112",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "04798638145"
      },
      {
        "vendedor_cpf": "72744251100",
        "vendedor_nome": "LUIZ ANTONIO FERREIRA CARVALHO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17610428728021",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "05608313151"
      },
      {
        "vendedor_cpf": "60559799187",
        "vendedor_nome": "MARIA DE LOURDES XIMENES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17611373633440",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 3,
        "total_valor": 2526.92,
        "titularCpf": "61939498104"
      },
      {
        "vendedor_cpf": "55263895100",
        "vendedor_nome": "MARILDA CASTRO DUARTE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17610569038750",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 873.38,
        "titularCpf": "11668107716"
      },
      {
        "vendedor_cpf": "05898390120",
        "vendedor_nome": "CLAYTON JEOVA VILLETE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17610659953853",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "06047221173"
      },
      {
        "vendedor_cpf": "15305546168",
        "vendedor_nome": "MARIA DE LOURDES SOUSA CUNHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17611021737968",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 592.38,
        "titularCpf": "09531686114"
      },
      {
        "vendedor_cpf": "84009144149",
        "vendedor_nome": "TATIANE ALVES PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17606417674932",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 444.88,
        "titularCpf": "06522301130"
      },
      {
        "vendedor_cpf": "72606649168",
        "vendedor_nome": "PATRICIA DUARTE DA SILVA GONCALVES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17610818155959",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 876.96,
        "titularCpf": "85312363120"
      },
      {
        "vendedor_cpf": "89502256115",
        "vendedor_nome": "ADRIANO ANDRADE BRASILEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17610724242999",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "07477474159"
      },
      {
        "vendedor_cpf": "03476172120",
        "vendedor_nome": "IGOR DANIEL DIAS PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17610736532624",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "05808062195"
      },
      {
        "vendedor_cpf": "00493495118",
        "vendedor_nome": "LEONARDO MENDES PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17616739044180",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 960.22,
        "titularCpf": "32617501892"
      },
      {
        "vendedor_cpf": "69480583100",
        "vendedor_nome": "CRISTIANE BONJARDIM VAZ",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17608887565640",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "06132940332"
      },
      {
        "vendedor_cpf": "01436512182",
        "vendedor_nome": "MARCOS VINICIUS EMILIANO DUTRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17617065641348",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "03068896177"
      },
      {
        "vendedor_cpf": "01436512182",
        "vendedor_nome": "MARCOS VINICIUS EMILIANO DUTRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17617065704078",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "06740434131"
      },
      {
        "vendedor_cpf": "61154369153",
        "vendedor_nome": "VANDEILZA RODRIGUES LISBOAS DIAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17610632507608",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "02119794146"
      },
      {
        "vendedor_cpf": "94396973691",
        "vendedor_nome": "EDITE ALMEIDA NERIS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17616706026351",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "55353053168"
      },
      {
        "vendedor_cpf": "00670482188",
        "vendedor_nome": "ALEXANDRE SILVA GONDIN",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17616703939776",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 402.14,
        "titularCpf": "00352425237"
      },
      {
        "vendedor_cpf": "00621402133",
        "vendedor_nome": "WALISSON SANTOS SOARES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17611469411353",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "06959416159"
      },
      {
        "vendedor_cpf": "99155583172",
        "vendedor_nome": "Elaine Rabelo Teixeira",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17613156810646",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "08243346120"
      },
      {
        "vendedor_cpf": "00183731190",
        "vendedor_nome": "ANDRE HENRIQUE NOLETO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17615839460245",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "07286161148"
      },
      {
        "vendedor_cpf": "37331647415",
        "vendedor_nome": "CELIO BARBOSA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17613341820818",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 2,
        "total_valor": 894.76,
        "titularCpf": "05800308144"
      },
      {
        "vendedor_cpf": "03476172120",
        "vendedor_nome": "IGOR DANIEL DIAS PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17615754424403",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "11739414101"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17614189592511",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "08535063102"
      },
      {
        "vendedor_cpf": "45496218187",
        "vendedor_nome": "NICACIO LUIS DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17624352563182",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "62090711396"
      },
      {
        "vendedor_cpf": "72606649168",
        "vendedor_nome": "PATRICIA DUARTE DA SILVA GONCALVES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17624731892701",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "05718103143"
      },
      {
        "vendedor_cpf": "31878032100",
        "vendedor_nome": "GILVANA FRANCISCO DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17633294044882",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 558.94,
        "titularCpf": "05943049118"
      },
      {
        "vendedor_cpf": "02375747135",
        "vendedor_nome": "DANIELA FERNANDA DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17625441728156",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 2,
        "total_valor": 1084.38,
        "titularCpf": "97818046100"
      },
      {
        "vendedor_cpf": "80396925120",
        "vendedor_nome": "RAFAELA SILVA DANEZI",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17631599820388",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 873.38,
        "titularCpf": "02676614100"
      },
      {
        "vendedor_cpf": "70545810167",
        "vendedor_nome": "MANOEL ALEXANDRE DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17629837860384",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "11339173131"
      },
      {
        "vendedor_cpf": "03731045109",
        "vendedor_nome": "YAN LINS SOARES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17623499427048",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 453.49,
        "titularCpf": "06502936148"
      },
      {
        "vendedor_cpf": "28998103168",
        "vendedor_nome": "ELIEL BENTO COSTA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17630712555548",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "04445160180"
      },
      {
        "vendedor_cpf": "07221295646",
        "vendedor_nome": "THIAGO BARBOSA DE SOUSA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17634167364932",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 501.39,
        "titularCpf": "05688806176"
      },
      {
        "vendedor_cpf": "63933969387",
        "vendedor_nome": "HERICA CORTEZ CARVALHO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17624731234546",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "11582363102"
      },
      {
        "vendedor_cpf": "58470352172",
        "vendedor_nome": "GILDEENE SILVA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17629726330500",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "10356591158"
      },
      {
        "vendedor_cpf": "72744251100",
        "vendedor_nome": "LUIZ ANTONIO FERREIRA CARVALHO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17634133237442",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 3,
        "total_valor": 1498.80,
        "titularCpf": "04876984107"
      },
      {
        "vendedor_cpf": "73382361191",
        "vendedor_nome": "DAYANNA KEYLA DANTAS ALVES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17629638867383",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "04131090112"
      },
      {
        "vendedor_cpf": "03042354903",
        "vendedor_nome": "JANETE EPPING",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17624512773431",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "05706774161"
      },
      {
        "vendedor_cpf": "03731045109",
        "vendedor_nome": "YAN LINS SOARES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17629791619803",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "05116916103"
      },
      {
        "vendedor_cpf": "01814485139",
        "vendedor_nome": "DAIANE SILVA LEANDRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17631600919991",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "06104195105"
      },
      {
        "vendedor_cpf": "73157082191",
        "vendedor_nome": "ERICA CHRISTINE DE PADUA ANDRADE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17628222811072",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 2,
        "total_valor": 1626.16,
        "titularCpf": "89999371191"
      },
      {
        "vendedor_cpf": "82901074120",
        "vendedor_nome": "ROSANGELA ANA DA SILVA TEIXEIRA BOTTINO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17634092772669",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 360.90,
        "titularCpf": "08348082182"
      },
      {
        "vendedor_cpf": "01004011121",
        "vendedor_nome": "MAKSUEL SOARES DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17624342308148",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "04929768136"
      },
      {
        "vendedor_cpf": "72272503187",
        "vendedor_nome": "FABIO RODRIGUES DE ANDRADE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17636701659857",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 2,
        "total_valor": 805.78,
        "titularCpf": "07666318189"
      },
      {
        "vendedor_cpf": "03404875184",
        "vendedor_nome": "THAYNARA SANTOS OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17637523190618",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "05503859162"
      },
      {
        "vendedor_cpf": "40108368149",
        "vendedor_nome": "REYNALDO DONIZETE DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17635916998203",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 960.22,
        "titularCpf": "00030299136"
      },
      {
        "vendedor_cpf": "14056976368",
        "vendedor_nome": "ANTERO LEITE TAVARES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17634993326652",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "10110144163"
      },
      {
        "vendedor_cpf": "73157082191",
        "vendedor_nome": "ERICA CHRISTINE DE PADUA ANDRADE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17635573472183",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 657.71,
        "titularCpf": "02528490194"
      },
      {
        "vendedor_cpf": "05555092490",
        "vendedor_nome": "JOAO RUFINO DA SILVA NETO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17635905061428",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 664.04,
        "titularCpf": "94330476134"
      },
      {
        "vendedor_cpf": "03308922150",
        "vendedor_nome": "LAURA DE SOUZA FARIA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17639949293972",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "73568341115"
      },
      {
        "vendedor_cpf": "53990382187",
        "vendedor_nome": "PATRICIA DE OLIVEIRA AZEVEDO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640058569377",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 501.39,
        "titularCpf": "05036253108"
      },
      {
        "vendedor_cpf": "33352887187",
        "vendedor_nome": "GUTEMBERG LOPES DE LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17637448283714",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "07247614110"
      },
      {
        "vendedor_cpf": "94396973691",
        "vendedor_nome": "EDITE ALMEIDA NERIS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17635968824774",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 575.01,
        "titularCpf": "02280823152"
      },
      {
        "vendedor_cpf": "06800576689",
        "vendedor_nome": "ELISANGELA SOUZA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17637254923818",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "05945435171"
      },
      {
        "vendedor_cpf": "01370932502",
        "vendedor_nome": "CATIANE MENEZES RIBEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17624400243307",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "10921547102"
      },
      {
        "vendedor_cpf": "90743350120",
        "vendedor_nome": "JEDILENE BEZERRA VILAROUCA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17637766547066",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 408.50,
        "titularCpf": "03003229176"
      },
      {
        "vendedor_cpf": "94436924149",
        "vendedor_nome": "POLLYANNA AIRES QUINTELA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17639897756884",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 570.01,
        "titularCpf": "03633623124"
      },
      {
        "vendedor_cpf": "82901074120",
        "vendedor_nome": "ROSANGELA ANA DA SILVA TEIXEIRA BOTTINO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17635802195609",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 378.74,
        "titularCpf": "08309952180"
      },
      {
        "vendedor_cpf": "03419980108",
        "vendedor_nome": "HEMERSON FRAGA FERNANDES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640070841457",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "04641438102"
      },
      {
        "vendedor_cpf": "90293193134",
        "vendedor_nome": "SABRINA KAREN MOTA RODRIGUES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640045717446",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 421.12,
        "titularCpf": "04161037155"
      },
      {
        "vendedor_cpf": "05759322605",
        "vendedor_nome": "MARCELO ALVES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17631464711680",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "05475645116"
      },
      {
        "vendedor_cpf": "72606649168",
        "vendedor_nome": "PATRICIA DUARTE DA SILVA GONCALVES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640828206107",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "03417718139"
      },
      {
        "vendedor_cpf": "02470286140",
        "vendedor_nome": "TAMARA DE OLIVEIRA GOMES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17628864867924",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "03898753174"
      },
      {
        "vendedor_cpf": "01166007138",
        "vendedor_nome": "ROGERIO TORRES DE OLIVERIA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640064312113",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "04409692127"
      },
      {
        "vendedor_cpf": "06215571610",
        "vendedor_nome": "MARIELA MARTINS CRUZ",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17633986633105",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "09180614159"
      },
      {
        "vendedor_cpf": "00591834111",
        "vendedor_nome": "ELMO DO NASCIMENTO SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17636054050832",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 444.88,
        "titularCpf": "03442839173"
      },
      {
        "vendedor_cpf": "00384233163",
        "vendedor_nome": "LIGIA MARQUEZ SOCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640212884314",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 341.56,
        "titularCpf": "05776736102"
      },
      {
        "vendedor_cpf": "01169820123",
        "vendedor_nome": "LUCAS MIRANDA FEITOZA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640762529357",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "11535280107"
      },
      {
        "vendedor_cpf": "05121077181",
        "vendedor_nome": "STEPHANE RODRIGUES ASSUNCAO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640296381230",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 3,
        "total_valor": 1588.76,
        "titularCpf": "87908131115"
      },
      {
        "vendedor_cpf": "92699057134",
        "vendedor_nome": "SANDRA LOPES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17635577049616",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "06383426192"
      },
      {
        "vendedor_cpf": "71455280100",
        "vendedor_nome": "ANTONIO SENA DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640852663624",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "08510777144"
      },
      {
        "vendedor_cpf": "08808736636",
        "vendedor_nome": "TAMARA ELKE PIRES MACIEL",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17635597605368",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "02519465174"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640035258721",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 575.01,
        "titularCpf": "02385099152"
      },
      {
        "vendedor_cpf": "00052661148",
        "vendedor_nome": "PRISCILA MOREIRA LINS ALBUQUERQUE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17642063479386",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "62043886304"
      },
      {
        "vendedor_cpf": "72744251100",
        "vendedor_nome": "LUIZ ANTONIO FERREIRA CARVALHO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17638011306857",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 2,
        "total_valor": 1018.61,
        "titularCpf": "03957097177"
      },
      {
        "vendedor_cpf": "05121077181",
        "vendedor_nome": "STEPHANE RODRIGUES ASSUNCAO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640055192245",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 873.38,
        "titularCpf": "00480477167"
      },
      {
        "vendedor_cpf": "72744251100",
        "vendedor_nome": "LUIZ ANTONIO FERREIRA CARVALHO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640278235500",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 374.56,
        "titularCpf": "04502538132"
      },
      {
        "vendedor_cpf": "82347719149",
        "vendedor_nome": "EDILZA MARIA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17625273559148",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 876.96,
        "titularCpf": "02323501917"
      },
      {
        "vendedor_cpf": "02773807154",
        "vendedor_nome": "WALTER MEIRELLES NETO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640202036544",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 592.38,
        "titularCpf": "05919107138"
      },
      {
        "vendedor_cpf": "00509057160",
        "vendedor_nome": "JUNIO BATISTA SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640960423484",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "00994657102"
      },
      {
        "vendedor_cpf": "02118881177",
        "vendedor_nome": "GABRIELA AFONSO CALAZANS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17641224008354",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 876.96,
        "titularCpf": "63604922372"
      },
      {
        "vendedor_cpf": "00052661148",
        "vendedor_nome": "PRISCILA MOREIRA LINS ALBUQUERQUE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640655973037",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "08363524328"
      },
      {
        "vendedor_cpf": "72014237115",
        "vendedor_nome": "FABRICIO GUIMARAES LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17642578546289",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 575.01,
        "titularCpf": "08399544680"
      },
      {
        "vendedor_cpf": "02118881177",
        "vendedor_nome": "GABRIELA AFONSO CALAZANS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17642846527408",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "04641190143"
      },
      {
        "vendedor_cpf": "37429620191",
        "vendedor_nome": "KLEBER LUIZ GOMES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17642553441060",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 502.10,
        "titularCpf": "03299434136"
      },
      {
        "vendedor_cpf": "00384233163",
        "vendedor_nome": "LIGIA MARQUEZ SOCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640904410641",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "04985651141"
      },
      {
        "vendedor_cpf": "71159134120",
        "vendedor_nome": "VALDIR RUDIARD DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17642710437315",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "03266905148"
      },
      {
        "vendedor_cpf": "87428288134",
        "vendedor_nome": "CRISTIANE MORLE DE PAULA MATOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640999910676",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "09203238123"
      },
      {
        "vendedor_cpf": "04610593394",
        "vendedor_nome": "FELIPE LIMA SOUSA FERREIRA DE ALCANTARA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17635032750613",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "09446829100"
      },
      {
        "vendedor_cpf": "03203283174",
        "vendedor_nome": "THAIS MIRANDA RIBEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640877038423",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "05260562151"
      },
      {
        "vendedor_cpf": "87815907172",
        "vendedor_nome": "LUCIENE DA SILVA PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17634067855301",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "06798384145"
      },
      {
        "vendedor_cpf": "36606756871",
        "vendedor_nome": "ALINE DE OLIVEIRA TEODORO TEIXEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640961882924",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 407.88,
        "titularCpf": "02887708112"
      },
      {
        "vendedor_cpf": "06584698190",
        "vendedor_nome": "LEOMAR RAMOS FERREIRA DE PAIVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17639225257815",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 592.38,
        "titularCpf": "08500805170"
      },
      {
        "vendedor_cpf": "03273064161",
        "vendedor_nome": "EDUARDO DE CASTRO LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17642917651660",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 2,
        "total_valor": 583.02,
        "titularCpf": "08379285166"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17642693092020",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "03760554130"
      },
      {
        "vendedor_cpf": "86349864115",
        "vendedor_nome": "ALEXANDRE DIOGO MARTINS DE MOURA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640961546280",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "07346157109"
      },
      {
        "vendedor_cpf": "05759322605",
        "vendedor_nome": "MARCELO ALVES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17638388671176",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "00492141100"
      },
      {
        "vendedor_cpf": "37429620191",
        "vendedor_nome": "KLEBER LUIZ GOMES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17641537992162",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "11574112155"
      },
      {
        "vendedor_cpf": "00798192143",
        "vendedor_nome": "RUDSON FERNANDES DE AZEREDO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17641034279711",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "07650626156"
      },
      {
        "vendedor_cpf": "97968684153",
        "vendedor_nome": "ANDERRUPSON FERNANDES PONTES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17635841501997",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 2,
        "total_valor": 1430.12,
        "titularCpf": "98489194149"
      },
      {
        "vendedor_cpf": "00038974193",
        "vendedor_nome": "WILSON SOARES DE ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17641070484442",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 2,
        "total_valor": 899.91,
        "titularCpf": "02646780109"
      },
      {
        "vendedor_cpf": "71419993100",
        "vendedor_nome": "JAIRO GOMES DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640018589127",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "00499915151"
      },
      {
        "vendedor_cpf": "69480583100",
        "vendedor_nome": "CRISTIANE BONJARDIM VAZ",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17628839375889",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "01142906108"
      },
      {
        "vendedor_cpf": "01169820123",
        "vendedor_nome": "LUCAS MIRANDA FEITOZA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640199660450",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "06398567137"
      },
      {
        "vendedor_cpf": "72327219191",
        "vendedor_nome": "REINALDO GOMES DE ALMEIDA FILHO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17641880286089",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 2,
        "total_valor": 798.00,
        "titularCpf": "09785948196"
      },
      {
        "vendedor_cpf": "79006779172",
        "vendedor_nome": "PAULO ANDRADE DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640912085009",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "10675038111"
      },
      {
        "vendedor_cpf": "72606649168",
        "vendedor_nome": "PATRICIA DUARTE DA SILVA GONCALVES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17619227906228",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "05618448106"
      },
      {
        "vendedor_cpf": "01436512182",
        "vendedor_nome": "MARCOS VINICIUS EMILIANO DUTRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17622021132324",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "11471543170"
      },
      {
        "vendedor_cpf": "70711801134",
        "vendedor_nome": "GILVANIA ALVES COSTA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17622048368336",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 3,
        "total_valor": 1474.80,
        "titularCpf": "03160133150"
      },
      {
        "vendedor_cpf": "02429050137",
        "vendedor_nome": "LEONARDO SILVA BARBOSA CRUZ",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17622588233879",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "09497456182"
      },
      {
        "vendedor_cpf": "69262993153",
        "vendedor_nome": "ELAINE NUNES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17623614737866",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "06745566150"
      },
      {
        "vendedor_cpf": "72286040168",
        "vendedor_nome": "RICARDO HENRIQUE FERNANDES SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640902900988",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 294.01,
        "titularCpf": "08654911190"
      },
      {
        "vendedor_cpf": "29713633172",
        "vendedor_nome": "MARLI DA COSTA SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17623889278132",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "06804223152"
      },
      {
        "vendedor_cpf": "03423555114",
        "vendedor_nome": "BARBARA AGUIAR VIANA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17624542978565",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 592.38,
        "titularCpf": "05277704183"
      },
      {
        "vendedor_cpf": "03423555114",
        "vendedor_nome": "BARBARA AGUIAR VIANA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17624629785469",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 960.22,
        "titularCpf": "00001248189"
      },
      {
        "vendedor_cpf": "02643616600",
        "vendedor_nome": "ANDREIA COELHO SERRA SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17625297410933",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 456.92,
        "titularCpf": "03737266190"
      },
      {
        "vendedor_cpf": "02564522106",
        "vendedor_nome": "CAIO FERNANDO CAVALCANTE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17628031663396",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "04213888118"
      },
      {
        "vendedor_cpf": "03203283174",
        "vendedor_nome": "THAIS MIRANDA RIBEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17628711066455",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "07781068106"
      },
      {
        "vendedor_cpf": "99938405134",
        "vendedor_nome": "DAYANNE CRISTINE DE FREITAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17628814221269",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 960.22,
        "titularCpf": "00007176147"
      },
      {
        "vendedor_cpf": "47857617504",
        "vendedor_nome": "VANESSA OLIVEIRA GONÇALVES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17628910594564",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 649.11,
        "titularCpf": "01759504157"
      },
      {
        "vendedor_cpf": "72014237115",
        "vendedor_nome": "FABRICIO GUIMARAES LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17628928491504",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "06921592154"
      },
      {
        "vendedor_cpf": "02868212140",
        "vendedor_nome": "NAYARA AGDA DE LIMA VIEIRA FERNANDES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17629676718281",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "04965946138"
      },
      {
        "vendedor_cpf": "05759322605",
        "vendedor_nome": "MARCELO ALVES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17629676964519",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "06073316151"
      },
      {
        "vendedor_cpf": "98014986172",
        "vendedor_nome": "DIOGENES THIAGO PEREIRA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17617470195502",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 456.92,
        "titularCpf": "04747045139"
      },
      {
        "vendedor_cpf": "02868212140",
        "vendedor_nome": "NAYARA AGDA DE LIMA VIEIRA FERNANDES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17642905277229",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "09640707902"
      },
      {
        "vendedor_cpf": "06281458370",
        "vendedor_nome": "JESSIGLEICE FERNANDES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640134785328",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "01825394156"
      },
      {
        "vendedor_cpf": "72613297115",
        "vendedor_nome": "ANA PAULA LIPO LOPES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17647702480631",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "06712638119"
      },
      {
        "vendedor_cpf": "80339662115",
        "vendedor_nome": "DANIELLE RODRIGUES LOUREIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17648554196466",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "04708277180"
      },
      {
        "vendedor_cpf": "94396973691",
        "vendedor_nome": "EDITE ALMEIDA NERIS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17648634898404",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "02145533109"
      },
      {
        "vendedor_cpf": "65818903168",
        "vendedor_nome": "STELLA MARTINS MESQUITA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17647712433492",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 2,
        "total_valor": 732.78,
        "titularCpf": "08342790100"
      },
      {
        "vendedor_cpf": "01745617175",
        "vendedor_nome": "NATALHIA BEATRIZ PEREIRA NEVES MOURA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17647940551133",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "04878283130"
      },
      {
        "vendedor_cpf": "03203283174",
        "vendedor_nome": "THAIS MIRANDA RIBEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17647756001988",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 649.11,
        "titularCpf": "00645568163"
      },
      {
        "vendedor_cpf": "16078870106",
        "vendedor_nome": "RICARDO DE FARIA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17653026096513",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "04159995101"
      },
      {
        "vendedor_cpf": "72583240110",
        "vendedor_nome": "CLEITON DE SOUSA TOME",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17653213054648",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "06521189174"
      },
      {
        "vendedor_cpf": "33622620587",
        "vendedor_nome": "FERNANDO ALVES DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17652249255352",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "07390155167"
      },
      {
        "vendedor_cpf": "00046525173",
        "vendedor_nome": "DANUBIA CRESLAINE LOPES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17648549693843",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "02592662138"
      },
      {
        "vendedor_cpf": "70860866149",
        "vendedor_nome": "GEORGE ROBERTO DE FRANCA GOMES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17652091224115",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 2,
        "total_valor": 1247.86,
        "titularCpf": "01736651102"
      },
      {
        "vendedor_cpf": "02106234112",
        "vendedor_nome": "TAMELLA MOURA ZAGO DIAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17652329949755",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "08686878121"
      },
      {
        "vendedor_cpf": "03128579180",
        "vendedor_nome": "WALTER ANDERSON SOARES MOREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17647853992928",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 464.88,
        "titularCpf": "16393559608"
      },
      {
        "vendedor_cpf": "01808162170",
        "vendedor_nome": "VIVIANE RODRIGEUS DA MARA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17652141448508",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "11561105139"
      },
      {
        "vendedor_cpf": "71159134120",
        "vendedor_nome": "VALDIR RUDIARD DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17652311297070",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "01331488150"
      },
      {
        "vendedor_cpf": "73471666591",
        "vendedor_nome": "MARCIA QUARESMA SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17652851512424",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "05150739111"
      },
      {
        "vendedor_cpf": "08991842860",
        "vendedor_nome": "ROSANA KRASILCHIK TOZZI",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17656592204281",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "06659782192"
      },
      {
        "vendedor_cpf": "04952082130",
        "vendedor_nome": "AMANDA TEIXEIRA COHEN",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17658183463579",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 575.01,
        "titularCpf": "04503169122"
      },
      {
        "vendedor_cpf": "92702503187",
        "vendedor_nome": "TATHIANA ROSELI SANTOS BATTISTI DA SILVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17659843735213",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 847.46,
        "titularCpf": "81850921172"
      },
      {
        "vendedor_cpf": "73427101134",
        "vendedor_nome": "KAROLINE DA SILVA E SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17659858567487",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "07432465193"
      },
      {
        "vendedor_cpf": "01101219106",
        "vendedor_nome": "DIEGO LIRA FARIAS DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17658918667986",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 592.38,
        "titularCpf": "70815431112"
      },
      {
        "vendedor_cpf": "63510782100",
        "vendedor_nome": "MARCO AURELIO ESTEVES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17648622664504",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "02745238175"
      },
      {
        "vendedor_cpf": "03178237100",
        "vendedor_nome": "MATEUS CASSEB FERRAZ SAAVEDRA DIAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17651944666328",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 3,
        "total_valor": 1314.72,
        "titularCpf": "03687197158"
      },
      {
        "vendedor_cpf": "59036842387",
        "vendedor_nome": "FRANCISCO DAS CHAGAS RODRIGUES FILHO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17659812167997",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "04449619170"
      },
      {
        "vendedor_cpf": "82154902120",
        "vendedor_nome": "ULISSES EDUARDO FERREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17658077198163",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 1121.10,
        "titularCpf": "62274341168"
      },
      {
        "vendedor_cpf": "58161970106",
        "vendedor_nome": "ELIS REGINA MOLINA PEIXOTO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17659064998771",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "11138979104"
      },
      {
        "vendedor_cpf": "00801570174",
        "vendedor_nome": "MICHELE CRISTINA DO NASCIMENTO LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17660598351690",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "08712812102"
      },
      {
        "vendedor_cpf": "47322019890",
        "vendedor_nome": "MARIA EDUARDA FELIX DIAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17660789907280",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 453.49,
        "titularCpf": "07571626145"
      },
      {
        "vendedor_cpf": "80339662115",
        "vendedor_nome": "DANIELLE RODRIGUES LOUREIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17660855537324",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 2,
        "total_valor": 1079.90,
        "titularCpf": "00877060169"
      },
      {
        "vendedor_cpf": "60245662120",
        "vendedor_nome": "DEUZELINA PEREIRA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17664428514618",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 2,
        "total_valor": 798.00,
        "titularCpf": "07490857112"
      },
      {
        "vendedor_cpf": "01945934360",
        "vendedor_nome": "ROSSANA KARLA DE OLIVEIRA QUEIROZ",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17660004382298",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "03482517185"
      },
      {
        "vendedor_cpf": "02643616600",
        "vendedor_nome": "ANDREIA COELHO SERRA SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17653981857768",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 2,
        "total_valor": 1286.27,
        "titularCpf": "01110525729"
      },
      {
        "vendedor_cpf": "00670482188",
        "vendedor_nome": "ALEXANDRE SILVA GONDIN",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17660907702383",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "07048148110"
      },
      {
        "vendedor_cpf": "65994256587",
        "vendedor_nome": "TANIA MAGALHAES DAS NEVES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17655523895695",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "02705223100"
      },
      {
        "vendedor_cpf": "95490698187",
        "vendedor_nome": "PATRICIA ALCANTARA VIANA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17659029808803",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 876.96,
        "titularCpf": "72097019153"
      },
      {
        "vendedor_cpf": "00239809157",
        "vendedor_nome": "IGOR FERREIRA MATTIOLI",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17659252974844",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "03675272192"
      },
      {
        "vendedor_cpf": "91927340144",
        "vendedor_nome": "ELIAS RODRIGO OLIVEIRA CEZAR;",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17660637516510",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "11634988310"
      },
      {
        "vendedor_cpf": "40108368149",
        "vendedor_nome": "REYNALDO DONIZETE DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17658269962315",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 592.38,
        "titularCpf": "07811512106"
      },
      {
        "vendedor_cpf": "01189796120",
        "vendedor_nome": "FERNANDA MAIARA OLIVEIRA MAIA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17661757768386",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "04337227113"
      },
      {
        "vendedor_cpf": "06386370155",
        "vendedor_nome": "CARLOS DANIEL LIMA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17660784333575",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "72194138153"
      },
      {
        "vendedor_cpf": "69333777172",
        "vendedor_nome": "MARIA JOSE DOS SANTOS OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17649395113411",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "04340538132"
      },
      {
        "vendedor_cpf": "02044061104",
        "vendedor_nome": "BARBARA BRANDAO DA SILVA SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17658136665480",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 2,
        "total_valor": 1062.28,
        "titularCpf": "10812917103"
      },
      {
        "vendedor_cpf": "18993850291",
        "vendedor_nome": "ANA MARIA PEREIRA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17652367385812",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "06265432150"
      },
      {
        "vendedor_cpf": "80243444168",
        "vendedor_nome": "FABIO SALIM GUIMARAES MARQUES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17658907509906",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 2,
        "total_valor": 958.82,
        "titularCpf": "00657345130"
      },
      {
        "vendedor_cpf": "01108285180",
        "vendedor_nome": "FABIOLA REGINA CARMO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17661708040555",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "12804552179"
      },
      {
        "vendedor_cpf": "00038974193",
        "vendedor_nome": "WILSON SOARES DE ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17660778548173",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "04893094106"
      },
      {
        "vendedor_cpf": "59036842387",
        "vendedor_nome": "FRANCISCO DAS CHAGAS RODRIGUES FILHO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17665248845694",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "04269369140"
      },
      {
        "vendedor_cpf": "04610593394",
        "vendedor_nome": "FELIPE LIMA SOUSA FERREIRA DE ALCANTARA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17661635060860",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "09145917116"
      },
      {
        "vendedor_cpf": "80396925120",
        "vendedor_nome": "RAFAELA SILVA DANEZI",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17664904643328",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "05443090143"
      },
      {
        "vendedor_cpf": "04066347185",
        "vendedor_nome": "RENAN SOUSA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17658429648607",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 592.38,
        "titularCpf": "61293117374"
      },
      {
        "vendedor_cpf": "90558561187",
        "vendedor_nome": "TATIANA DA SILVA SANTOS FERRAZ",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17664119696128",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "03633561188"
      },
      {
        "vendedor_cpf": "00467461104",
        "vendedor_nome": "FELIPE ARAUJO VELOSO ANTUNES MENEZES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17665875216345",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "06674133167"
      },
      {
        "vendedor_cpf": "66546532115",
        "vendedor_nome": "DEMÉTRIOS OZIAS DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17655349419447",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 2,
        "total_valor": 848.09,
        "titularCpf": "05021284100"
      },
      {
        "vendedor_cpf": "95840893153",
        "vendedor_nome": "RONALDO DA SILVA BARROS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17665307257633",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 649.11,
        "titularCpf": "02141016142"
      },
      {
        "vendedor_cpf": "00384233163",
        "vendedor_nome": "LIGIA MARQUEZ SOCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17661765628721",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 592.38,
        "titularCpf": "08748214108"
      },
      {
        "vendedor_cpf": "37331647415",
        "vendedor_nome": "CELIO BARBOSA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17664256434102",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "05122968128"
      },
      {
        "vendedor_cpf": "03368225103",
        "vendedor_nome": "RONIELE GOMES SANTIAGO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17653318369169",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "11768976163"
      },
      {
        "vendedor_cpf": "92702503187",
        "vendedor_nome": "TATHIANA ROSELI SANTOS BATTISTI DA SILVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17666191664319",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 453.49,
        "titularCpf": "00407192190"
      },
      {
        "vendedor_cpf": "00634528122",
        "vendedor_nome": "TATIANA SOARES LINCES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17664175393719",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 685.00,
        "titularCpf": "07402283402"
      },
      {
        "vendedor_cpf": "01999721179",
        "vendedor_nome": "DERICK CRISPIM GOMES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17660015509625",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "11622839129"
      },
      {
        "vendedor_cpf": "04059884197",
        "vendedor_nome": "TAYNAH PRISCILA GAMA DE ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17658228297267",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 592.38,
        "titularCpf": "05843806154"
      },
      {
        "vendedor_cpf": "90132963191",
        "vendedor_nome": "VIVIANE RIBEIRO DE ALBUQUERQUE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17664982466758",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "03943131190"
      },
      {
        "vendedor_cpf": "87767392104",
        "vendedor_nome": "ELIZANDRO DE SOUSA LEITE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17664314657333",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 399.00,
        "titularCpf": "11752186184"
      },
      {
        "vendedor_cpf": "80396143172",
        "vendedor_nome": "PAULO ROBERTO DE MELO PEROTTO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17664302953854",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 2,
        "total_valor": 771.09,
        "titularCpf": "01449424104"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17653877278842",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 2,
        "total_valor": 1084.38,
        "titularCpf": "01121904130"
      },
      {
        "vendedor_cpf": "04363020121",
        "vendedor_nome": "CLEUDIOMAR COELHO RODRIGUES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17664491736879",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 876.96,
        "titularCpf": "88752488187"
      },
      {
        "vendedor_cpf": "97869058149",
        "vendedor_nome": "DANIELE RORIZ",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17570252576908",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "07267760171"
      },
      {
        "vendedor_cpf": "01231447109",
        "vendedor_nome": "LUIS HENRIQUE MATOS BARRETO DE LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17570014887361",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "04259691180"
      },
      {
        "vendedor_cpf": "00801570174",
        "vendedor_nome": "MICHELE CRISTINA DO NASCIMENTO LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17569321720116",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "02871415862"
      },
      {
        "vendedor_cpf": "03699518167",
        "vendedor_nome": "MARCUS VINICIUS BANDEIRA E SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17569233990140",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "08863826102"
      },
      {
        "vendedor_cpf": "90293193134",
        "vendedor_nome": "SABRINA KAREN MOTA RODRIGUES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17569220246261",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "07498867141"
      },
      {
        "vendedor_cpf": "05419090104",
        "vendedor_nome": "ELIEZER AMARAL MONTEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17569059477181",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 402.14,
        "titularCpf": "05313567101"
      },
      {
        "vendedor_cpf": "56508050168",
        "vendedor_nome": "NILDA MARIA BARBOSA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17568480322592",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "07136585171"
      },
      {
        "vendedor_cpf": "24530883191",
        "vendedor_nome": "ELAINE MARCIA MALUF",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17568411752500",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "07217156130"
      },
      {
        "vendedor_cpf": "08189479504",
        "vendedor_nome": "DENILSON SOUZA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17568410947435",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 1109.89,
        "titularCpf": "90301242100"
      },
      {
        "vendedor_cpf": "49035401115",
        "vendedor_nome": "WANDER PEREIRA FREITAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17568380775759",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "06270871166"
      },
      {
        "vendedor_cpf": "81549636120",
        "vendedor_nome": "GUIMARINO DE SOUZA VILELA FILHO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17573418223595",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 1473.61,
        "titularCpf": "78749689134"
      },
      {
        "vendedor_cpf": "71234217104",
        "vendedor_nome": "GLEDSON TAVARES DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17570999530441",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "05580840101"
      },
      {
        "vendedor_cpf": "02118881177",
        "vendedor_nome": "GABRIELA AFONSO CALAZANS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17570292225718",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "07600557185"
      },
      {
        "vendedor_cpf": "02609251793",
        "vendedor_nome": "IVAN RAFAGNATO CALDAS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17569233450596",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "95060529304"
      },
      {
        "vendedor_cpf": "02415373397",
        "vendedor_nome": "NATALIA MONTEIRO SARPI FERREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17569122779257",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "05863311150"
      },
      {
        "vendedor_cpf": "01496984102",
        "vendedor_nome": "PAULO KALLIL RIBEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17567653829296",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "04583480156"
      },
      {
        "vendedor_cpf": "06401602805",
        "vendedor_nome": "DIVANI VILCHER GARRIDO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17567530396478",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "70248990187"
      },
      {
        "vendedor_cpf": "05759322605",
        "vendedor_nome": "MARCELO ALVES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17567502750482",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "05946917102"
      },
      {
        "vendedor_cpf": "04605309179",
        "vendedor_nome": "KALIEL RODRIGUES NUNES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17567413408455",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "10494208619"
      },
      {
        "vendedor_cpf": "71831509172",
        "vendedor_nome": "ANA CAROLINA CAMPOS DE LISCIO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17567345917814",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "11702274144"
      },
      {
        "vendedor_cpf": "72614170178",
        "vendedor_nome": "WAGNER BORGES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17567289981053",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "03370185105"
      },
      {
        "vendedor_cpf": "95606629100",
        "vendedor_nome": "OZENILTON JOSE PEREIRA RODRIGUES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17571030333015",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 2,
        "total_valor": 803.00,
        "titularCpf": "09951795145"
      },
      {
        "vendedor_cpf": "99549123120",
        "vendedor_nome": "LUCELIA DA SILVA SANTOS BEZERRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17571011691119",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "05510250186"
      },
      {
        "vendedor_cpf": "01268100102",
        "vendedor_nome": "LILLYANE VIANNA DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17570976674476",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "01425148107"
      },
      {
        "vendedor_cpf": "36606756871",
        "vendedor_nome": "ALINE DE OLIVEIRA TEODORO TEIXEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17570790369931",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "10330602160"
      },
      {
        "vendedor_cpf": "01945934360",
        "vendedor_nome": "ROSSANA KARLA DE OLIVEIRA QUEIROZ",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17569476775027",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "01683789229"
      },
      {
        "vendedor_cpf": "80530257149",
        "vendedor_nome": "SIMONE LARA BRANDÃO DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17568422014017",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 2,
        "total_valor": 2360.71,
        "titularCpf": "01139799169"
      },
      {
        "vendedor_cpf": "03423555114",
        "vendedor_nome": "BARBARA AGUIAR VIANA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17568259736227",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 2,
        "total_valor": 848.09,
        "titularCpf": "05175254103"
      },
      {
        "vendedor_cpf": "80428568149",
        "vendedor_nome": "ANTONIO CARLOS LIMA DE BRITO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17567625001679",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 876.96,
        "titularCpf": "72080663100"
      },
      {
        "vendedor_cpf": "05759322605",
        "vendedor_nome": "MARCELO ALVES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17567534808275",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 2,
        "total_valor": 974.01,
        "titularCpf": "00944519156"
      },
      {
        "vendedor_cpf": "07221295646",
        "vendedor_nome": "THIAGO BARBOSA DE SOUSA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17573676179916",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "02363787161"
      },
      {
        "vendedor_cpf": "69262993153",
        "vendedor_nome": "ELAINE NUNES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17571070154832",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 852.96,
        "titularCpf": "01134093110"
      },
      {
        "vendedor_cpf": "51235560104",
        "vendedor_nome": "VALDIR PEREIRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17570976531238",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 558.94,
        "titularCpf": "07040924170"
      },
      {
        "vendedor_cpf": "05898390120",
        "vendedor_nome": "CLAYTON JEOVA VILLETE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17570758469161",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "70465958109"
      },
      {
        "vendedor_cpf": "04965311159",
        "vendedor_nome": "MARIA EDUARDA DA SILVA NOGUEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17569897470302",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "07645797118"
      },
      {
        "vendedor_cpf": "04023103144",
        "vendedor_nome": "GUILHERME CORREIA BRAGA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17569404383265",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 575.01,
        "titularCpf": "03690992141"
      },
      {
        "vendedor_cpf": "06800576689",
        "vendedor_nome": "ELISANGELA SOUZA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17569208421448",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "05611450164"
      },
      {
        "vendedor_cpf": "00384233163",
        "vendedor_nome": "LIGIA MARQUEZ SOCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17574315234588",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "05245868105"
      },
      {
        "vendedor_cpf": "00509057160",
        "vendedor_nome": "JUNIO BATISTA SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17573653526326",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "03064740180"
      },
      {
        "vendedor_cpf": "72637498153",
        "vendedor_nome": "ALINE CARNEIRO DE LIMA FREITAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17574265420388",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 852.96,
        "titularCpf": "05850255680"
      },
      {
        "vendedor_cpf": "03715706112",
        "vendedor_nome": "ARTHUR JOSE SOARES DA SILVA DUART",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17571191429562",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "06604756181"
      },
      {
        "vendedor_cpf": "28998103168",
        "vendedor_nome": "ELIEL BENTO COSTA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17571097200499",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "03519514150"
      },
      {
        "vendedor_cpf": "87421453504",
        "vendedor_nome": "VENISIA LIMA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17570986113206",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "70332391140"
      },
      {
        "vendedor_cpf": "49050788149",
        "vendedor_nome": "MARINEIA LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17569832749306",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 1156.26,
        "titularCpf": "86527690100"
      },
      {
        "vendedor_cpf": "03368225103",
        "vendedor_nome": "RONIELE GOMES SANTIAGO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17569449338758",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "09369574174"
      },
      {
        "vendedor_cpf": "00384233163",
        "vendedor_nome": "LIGIA MARQUEZ SOCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17568353528855",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "07950486104"
      },
      {
        "vendedor_cpf": "71831509172",
        "vendedor_nome": "ANA CAROLINA CAMPOS DE LISCIO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17567498081849",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "00626221102"
      },
      {
        "vendedor_cpf": "04965311159",
        "vendedor_nome": "MARIA EDUARDA DA SILVA NOGUEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17573641340375",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 575.01,
        "titularCpf": "02481785126"
      },
      {
        "vendedor_cpf": "01166007138",
        "vendedor_nome": "ROGERIO TORRES DE OLIVERIA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17569168616560",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 2,
        "total_valor": 1014.73,
        "titularCpf": "05207728148"
      },
      {
        "vendedor_cpf": "97758981100",
        "vendedor_nome": "AMANDA MACHADO CALMON XIMENES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17568484075676",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "11545066140"
      },
      {
        "vendedor_cpf": "03423555114",
        "vendedor_nome": "BARBARA AGUIAR VIANA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17571103674496",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 1232.64,
        "titularCpf": "79924298187"
      },
      {
        "vendedor_cpf": "02868212140",
        "vendedor_nome": "NAYARA AGDA DE LIMA VIEIRA FERNANDES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17574498057514",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "00473972174"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17574677031933",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "03212175192"
      },
      {
        "vendedor_cpf": "62625845368",
        "vendedor_nome": "WESLEY VIEIRA DE ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17575988125483",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 592.38,
        "titularCpf": "06397218180"
      },
      {
        "vendedor_cpf": "71310126100",
        "vendedor_nome": "WESLEY DE OLIVEIRA SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17568480015602",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 801.01,
        "titularCpf": "81417233168"
      },
      {
        "vendedor_cpf": "01504141105",
        "vendedor_nome": "JOSE DE RIBAMAR RODRIGUES NOGUEIRA JUNIOR",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17569928779077",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "03255834120"
      },
      {
        "vendedor_cpf": "76746453391",
        "vendedor_nome": "IVON GOMES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17569945538086",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "08440216106"
      },
      {
        "vendedor_cpf": "00234093129",
        "vendedor_nome": "RAFAEL AGUIAR MAGALHAES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17571005292825",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "03658169141"
      },
      {
        "vendedor_cpf": "91767105134",
        "vendedor_nome": "MARIA DAS DORES CAROLINO SANTOS SAMPAIO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17572039254128",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "01334592179"
      },
      {
        "vendedor_cpf": "07083310173",
        "vendedor_nome": "THAMIRIS VIEIRA MARQUES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17573720170998",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 575.01,
        "titularCpf": "04461636194"
      },
      {
        "vendedor_cpf": "05518833407",
        "vendedor_nome": "ALBERTO DE ASSIS VIEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17574282702558",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 2,
        "total_valor": 1125.91,
        "titularCpf": "79178197104"
      },
      {
        "vendedor_cpf": "01275570160",
        "vendedor_nome": "FILIPE NERES NUNES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17574432394065",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 614.66,
        "titularCpf": "02154983138"
      },
      {
        "vendedor_cpf": "78396506191",
        "vendedor_nome": "MOISES RICARDO LIMA DE CARVALHO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17598625645979",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "11754118178"
      },
      {
        "vendedor_cpf": "01231447109",
        "vendedor_nome": "LUIS HENRIQUE MATOS BARRETO DE LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17597970608687",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "02270858174"
      },
      {
        "vendedor_cpf": "05121077181",
        "vendedor_nome": "STEPHANE RODRIGUES ASSUNCAO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17597543803693",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 2,
        "total_valor": 958.82,
        "titularCpf": "05218053171"
      },
      {
        "vendedor_cpf": "00384233163",
        "vendedor_nome": "LIGIA MARQUEZ SOCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17596668654582",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "19276741747"
      },
      {
        "vendedor_cpf": "04525733195",
        "vendedor_nome": "NATALIA DE SOUSA POMPEU",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17596616262807",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "07201910175"
      },
      {
        "vendedor_cpf": "01436512182",
        "vendedor_nome": "MARCOS VINICIUS EMILIANO DUTRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17595915925516",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 2,
        "total_valor": 1084.38,
        "titularCpf": "00229637159"
      },
      {
        "vendedor_cpf": "00913854158",
        "vendedor_nome": "LUANA BORBA EGIDIO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17595826631532",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 2,
        "total_valor": 1343.28,
        "titularCpf": "04096628107"
      },
      {
        "vendedor_cpf": "00052661148",
        "vendedor_nome": "PRISCILA MOREIRA LINS ALBUQUERQUE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17595224281675",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "05077938113"
      },
      {
        "vendedor_cpf": "03423555114",
        "vendedor_nome": "BARBARA AGUIAR VIANA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17595079912161",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "09644092163"
      },
      {
        "vendedor_cpf": "00955119111",
        "vendedor_nome": "SUELLEN DO NASCIMENTO SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17595064389758",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "02868603173"
      },
      {
        "vendedor_cpf": "86073842104",
        "vendedor_nome": "ADRIANO GUIMARAES PINHEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17594968305303",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "01015793142"
      },
      {
        "vendedor_cpf": "69608342104",
        "vendedor_nome": "LUCILENE JACOBINA ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17594908501851",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "10119702100"
      },
      {
        "vendedor_cpf": "71592911153",
        "vendedor_nome": "JOAO BOSCO DE MELO PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17597821362225",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "10230976131"
      },
      {
        "vendedor_cpf": "02773807154",
        "vendedor_nome": "WALTER MEIRELLES NETO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17594370886777",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "06479711190"
      },
      {
        "vendedor_cpf": "02429050137",
        "vendedor_nome": "LEONARDO SILVA BARBOSA CRUZ",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17593494985640",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "11512559121"
      },
      {
        "vendedor_cpf": "03575699119",
        "vendedor_nome": "DIEGO ROBERTO DE LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17593479610569",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "05775947100"
      },
      {
        "vendedor_cpf": "47857617504",
        "vendedor_nome": "VANESSA OLIVEIRA GONÇALVES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17593304539474",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "04207229124"
      },
      {
        "vendedor_cpf": "69262993153",
        "vendedor_nome": "ELAINE NUNES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17593295598449",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 2,
        "total_valor": 1018.61,
        "titularCpf": "03497676101"
      },
      {
        "vendedor_cpf": "35773600110",
        "vendedor_nome": "ADERSON BLANCO CINNANTI",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17593260700160",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 664.04,
        "titularCpf": "69731993134"
      },
      {
        "vendedor_cpf": "71005604118",
        "vendedor_nome": "GUSTAVO ALYSON DE ARAGAO MESQUITA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17593168204074",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 955.22,
        "titularCpf": "02235720129"
      },
      {
        "vendedor_cpf": "71005604118",
        "vendedor_nome": "GUSTAVO ALYSON DE ARAGAO MESQUITA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17592672125360",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 2,
        "total_valor": 1311.95,
        "titularCpf": "84192437104"
      },
      {
        "vendedor_cpf": "71262610125",
        "vendedor_nome": "WESTER SOUZA ITACARAMBI",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17592667111239",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 801.01,
        "titularCpf": "70277028191"
      },
      {
        "vendedor_cpf": "32982771187",
        "vendedor_nome": "RENALDO JUSTINO NOBREGA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17592651940051",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 876.96,
        "titularCpf": "70651493153"
      },
      {
        "vendedor_cpf": "04908227110",
        "vendedor_nome": "ANE CAROLINE ALVES DA SILVA DE LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17592631892406",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "07435068128"
      },
      {
        "vendedor_cpf": "01169820123",
        "vendedor_nome": "LUCAS MIRANDA FEITOZA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17592606960668",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "09951827101"
      },
      {
        "vendedor_cpf": "00247949612",
        "vendedor_nome": "KELLY MARCIA RIBEIRO DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17592573492347",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "08785581100"
      },
      {
        "vendedor_cpf": "82901074120",
        "vendedor_nome": "ROSANGELA ANA DA SILVA TEIXEIRA BOTTINO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17592520864826",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "05747774158"
      },
      {
        "vendedor_cpf": "72637498153",
        "vendedor_nome": "ALINE CARNEIRO DE LIMA FREITAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17592406859182",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "01407194151"
      },
      {
        "vendedor_cpf": "00247949612",
        "vendedor_nome": "KELLY MARCIA RIBEIRO DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17592377720029",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 551.82,
        "titularCpf": "00656451114"
      },
      {
        "vendedor_cpf": "06592605146",
        "vendedor_nome": "VINICIUS GONCALVES DE SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17591858829359",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 575.01,
        "titularCpf": "03650755580"
      },
      {
        "vendedor_cpf": "49984277844",
        "vendedor_nome": "ISABEL BORTOLATO ALENCAR",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17591650253263",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 876.96,
        "titularCpf": "02618519183"
      },
      {
        "vendedor_cpf": "01169820123",
        "vendedor_nome": "LUCAS MIRANDA FEITOZA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17591543845173",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "01696026130"
      },
      {
        "vendedor_cpf": "55336531120",
        "vendedor_nome": "MARCELO ANTONIO FERREIRA DE SOUSA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17588938481786",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 518.19,
        "titularCpf": "04719072194"
      },
      {
        "vendedor_cpf": "73522252187",
        "vendedor_nome": "KLEBER BORGES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17588918768655",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 461.84,
        "titularCpf": "01989930301"
      },
      {
        "vendedor_cpf": "03023897174",
        "vendedor_nome": "WAYNE ALVES SOARES DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17588278070389",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "03437690183"
      },
      {
        "vendedor_cpf": "05513042193",
        "vendedor_nome": "LEILA CLAUDINO DA CRUZ SOUSA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17585831696154",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 575.01,
        "titularCpf": "11026323681"
      },
      {
        "vendedor_cpf": "05944518170",
        "vendedor_nome": "THAIS BATISTA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17585005156372",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 1344.32,
        "titularCpf": "37656724168"
      },
      {
        "vendedor_cpf": "01436512182",
        "vendedor_nome": "MARCOS VINICIUS EMILIANO DUTRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17584965778172",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 876.96,
        "titularCpf": "00878415173"
      },
      {
        "vendedor_cpf": "01436512182",
        "vendedor_nome": "MARCOS VINICIUS EMILIANO DUTRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17598796542682",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 876.96,
        "titularCpf": "63463458268"
      },
      {
        "vendedor_cpf": "32502125120",
        "vendedor_nome": "MARCIA RAMOS SANTIAGO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17598632768627",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "10535776136"
      },
      {
        "vendedor_cpf": "95490698187",
        "vendedor_nome": "PATRICIA ALCANTARA VIANA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17598507825061",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "07694839171"
      },
      {
        "vendedor_cpf": "00234093129",
        "vendedor_nome": "RAFAEL AGUIAR MAGALHAES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17597959155631",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 3,
        "total_valor": 1009.12,
        "titularCpf": "07739426539"
      },
      {
        "vendedor_cpf": "02854933109",
        "vendedor_nome": "DANIEL VICTOR RODRIGUES RAMOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17597782710134",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 408.50,
        "titularCpf": "06505030158"
      },
      {
        "vendedor_cpf": "01436512182",
        "vendedor_nome": "MARCOS VINICIUS EMILIANO DUTRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17596143593933",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "04985661104"
      },
      {
        "vendedor_cpf": "07336021182",
        "vendedor_nome": "ISABELLA DOS SANTOS FERNANDES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17593505867378",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 501.39,
        "titularCpf": "60973247312"
      },
      {
        "vendedor_cpf": "37280058191",
        "vendedor_nome": "JOAO BATISTA ALVES JUNIOR",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17582173589022",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "03224829176"
      },
      {
        "vendedor_cpf": "00493495118",
        "vendedor_nome": "LEONARDO MENDES PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17577787679028",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 592.38,
        "titularCpf": "06181241108"
      },
      {
        "vendedor_cpf": "01475346158",
        "vendedor_nome": "PRISCILA LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17598459380782",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 575.01,
        "titularCpf": "01573511307"
      },
      {
        "vendedor_cpf": "73157082191",
        "vendedor_nome": "ERICA CHRISTINE DE PADUA ANDRADE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17575414979399",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 2,
        "total_valor": 1343.28,
        "titularCpf": "02418751104"
      },
      {
        "vendedor_cpf": "71428054120",
        "vendedor_nome": "LEONARDO HENRIQUE PINHEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17595256045309",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 2,
        "total_valor": 848.09,
        "titularCpf": "11566971667"
      },
      {
        "vendedor_cpf": "01436512182",
        "vendedor_nome": "MARCOS VINICIUS EMILIANO DUTRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17594332921530",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 1339.32,
        "titularCpf": "65243390615"
      },
      {
        "vendedor_cpf": "04013607174",
        "vendedor_nome": "FELIPE NILTON MOTA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17592391863962",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 3,
        "total_valor": 1374.51,
        "titularCpf": "14238850742"
      },
      {
        "vendedor_cpf": "00267683138",
        "vendedor_nome": "HUGO CORREIA LOPES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17591780730757",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "01129648184"
      },
      {
        "vendedor_cpf": "00267683138",
        "vendedor_nome": "HUGO CORREIA LOPES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17591763082244",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "01129646130"
      },
      {
        "vendedor_cpf": "87612143100",
        "vendedor_nome": "POLIANA BARBOSA DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17585763186237",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 2,
        "total_valor": 805.78,
        "titularCpf": "07952327135"
      },
      {
        "vendedor_cpf": "72606649168",
        "vendedor_nome": "PATRICIA DUARTE DA SILVA GONCALVES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17582054050999",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "11212112164"
      },
      {
        "vendedor_cpf": "71005604118",
        "vendedor_nome": "GUSTAVO ALYSON DE ARAGAO MESQUITA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17581448734487",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 801.01,
        "titularCpf": "94088349172"
      },
      {
        "vendedor_cpf": "00627444105",
        "vendedor_nome": "MARILDA RAQUEL CRISTINO SOARES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17581252907391",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "01211687198"
      },
      {
        "vendedor_cpf": "05008842188",
        "vendedor_nome": "LUCAS FERREIRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17581231308780",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 360.90,
        "titularCpf": "09578782144"
      },
      {
        "vendedor_cpf": "00798192143",
        "vendedor_nome": "RUDSON FERNANDES DE AZEREDO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17580695185943",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "09567358192"
      },
      {
        "vendedor_cpf": "73157082191",
        "vendedor_nome": "ERICA CHRISTINE DE PADUA ANDRADE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17579615924817",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 960.22,
        "titularCpf": "01606997114"
      },
      {
        "vendedor_cpf": "82148341120",
        "vendedor_nome": "RITALO DOUGLAS XAVIER SVIECH",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17579599467494",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 2,
        "total_valor": 1014.73,
        "titularCpf": "04191260154"
      },
      {
        "vendedor_cpf": "69262993153",
        "vendedor_nome": "ELAINE NUNES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17579582222201",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "03052432176"
      },
      {
        "vendedor_cpf": "78048915391",
        "vendedor_nome": "MARIA ROBEZANGELA RODRIGUES NEVES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17577919250717",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 592.38,
        "titularCpf": "08434886111"
      },
      {
        "vendedor_cpf": "71159134120",
        "vendedor_nome": "VALDIR RUDIARD DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17577077668458",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "10997277157"
      },
      {
        "vendedor_cpf": "99938405134",
        "vendedor_nome": "DAYANNE CRISTINE DE FREITAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17588959266797",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "05336094102"
      },
      {
        "vendedor_cpf": "04066347185",
        "vendedor_nome": "RENAN SOUSA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17582983557126",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "60512271305"
      },
      {
        "vendedor_cpf": "00820125121",
        "vendedor_nome": "LUCIANO DOS ANJOS TEIXEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17592726739919",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "03585066119"
      },
      {
        "vendedor_cpf": "03039003186",
        "vendedor_nome": "KAMYLA STEPHANIE LIMA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17593428434869",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 3,
        "total_valor": 2095.82,
        "titularCpf": "01453562133"
      },
      {
        "vendedor_cpf": "00247949612",
        "vendedor_nome": "KELLY MARCIA RIBEIRO DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17594914739831",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 575.01,
        "titularCpf": "03891738196"
      },
      {
        "vendedor_cpf": "08991842860",
        "vendedor_nome": "ROSANA KRASILCHIK TOZZI",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17597664911057",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 2,
        "total_valor": 602.98,
        "titularCpf": "07879727116"
      },
      {
        "vendedor_cpf": "71400052149",
        "vendedor_nome": "VANESSA NOBRE MENDONÇA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17597679164601",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 5,
        "total_valor": 3060.76,
        "titularCpf": "25498515871"
      },
      {
        "vendedor_cpf": "14108139402",
        "vendedor_nome": "JUCICLEIDE BATISTA FELIX DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17597735845382",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "08543357659"
      },
      {
        "vendedor_cpf": "01858101107",
        "vendedor_nome": "ADILANE BARROS DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17597831006693",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "09468295192"
      },
      {
        "vendedor_cpf": "01814485139",
        "vendedor_nome": "DAIANE SILVA LEANDRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17598499404688",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "08181297199"
      },
      {
        "vendedor_cpf": "92155871104",
        "vendedor_nome": "MARIZAM MATEUS DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17598763255485",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "09164163130"
      },
      {
        "vendedor_cpf": "01676035150",
        "vendedor_nome": "DEBORA EDUARDO CAVALCANTE MASSARANDUBA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17598738189817",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "03847117157"
      },
      {
        "vendedor_cpf": "47177071172",
        "vendedor_nome": "MARCIA MARTINS DE VASCONCELOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17598723405599",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 685.00,
        "titularCpf": "04115807105"
      },
      {
        "vendedor_cpf": "01734783109",
        "vendedor_nome": "NADIELE DE CARVALHO E SOUSA MAIA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17598514049478",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "08412482140"
      },
      {
        "vendedor_cpf": "02118881177",
        "vendedor_nome": "GABRIELA AFONSO CALAZANS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17622015633070",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 873.38,
        "titularCpf": "01298411106"
      },
      {
        "vendedor_cpf": "72744251100",
        "vendedor_nome": "LUIZ ANTONIO FERREIRA CARVALHO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17621981583413",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 502.10,
        "titularCpf": "03952273139"
      },
      {
        "vendedor_cpf": "82976686149",
        "vendedor_nome": "LUCIANA  DO COUTO NUNES JACOBINA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17621944309850",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "03849814106"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17619216813491",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "06252873128"
      },
      {
        "vendedor_cpf": "72614170178",
        "vendedor_nome": "WAGNER BORGES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17618387398202",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "04462949188"
      },
      {
        "vendedor_cpf": "05309003517",
        "vendedor_nome": "SHEILA BARBOSA DE JESUS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17618384569871",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "02637994177"
      },
      {
        "vendedor_cpf": "01166007138",
        "vendedor_nome": "ROGERIO TORRES DE OLIVERIA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17617653885936",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "02652723197"
      },
      {
        "vendedor_cpf": "02106234112",
        "vendedor_nome": "TAMELLA MOURA ZAGO DIAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17615859942317",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "05186470139"
      },
      {
        "vendedor_cpf": "55336531120",
        "vendedor_nome": "MARCELO ANTONIO FERREIRA DE SOUSA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17615766060524",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "08735621192"
      },
      {
        "vendedor_cpf": "86668102115",
        "vendedor_nome": "ALICIANO BATISTA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17614067431155",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "03271065144"
      },
      {
        "vendedor_cpf": "73259250182",
        "vendedor_nome": "MICAEL FELIPE RODRIGUES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17613343146532",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 3,
        "total_valor": 1374.51,
        "titularCpf": "02257334124"
      },
      {
        "vendedor_cpf": "37331647415",
        "vendedor_nome": "CELIO BARBOSA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17613321131415",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "06824780162"
      },
      {
        "vendedor_cpf": "73471666591",
        "vendedor_nome": "MARCIA QUARESMA SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17613257983776",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 402.13,
        "titularCpf": "05420879107"
      },
      {
        "vendedor_cpf": "01193374103",
        "vendedor_nome": "ADEMILSON DA SILVA PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17611677256228",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "03015052179"
      },
      {
        "vendedor_cpf": "56508050168",
        "vendedor_nome": "NILDA MARIA BARBOSA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17610611666055",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "00567075176"
      },
      {
        "vendedor_cpf": "00197445101",
        "vendedor_nome": "CARMINDA DE OLIVEIRA NETO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17609862990078",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "07739829145"
      },
      {
        "vendedor_cpf": "00160166101",
        "vendedor_nome": "MARCIA KELLY ALBERNAS DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17607381145974",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "11330786130"
      },
      {
        "vendedor_cpf": "04778137124",
        "vendedor_nome": "NATANAEL SAULO DA SILVA PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17607367782088",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "07562902100"
      },
      {
        "vendedor_cpf": "85600059191",
        "vendedor_nome": "KATIA REGINA VIANA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17607130303254",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 1344.32,
        "titularCpf": "66655285100"
      },
      {
        "vendedor_cpf": "71843698153",
        "vendedor_nome": "JORGE LUIZ PLINIO LADEIRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17606371519761",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 649.11,
        "titularCpf": "00412298198"
      },
      {
        "vendedor_cpf": "69262993153",
        "vendedor_nome": "ELAINE NUNES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17605593647019",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 876.96,
        "titularCpf": "70799563153"
      },
      {
        "vendedor_cpf": "03203283174",
        "vendedor_nome": "THAIS MIRANDA RIBEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17604365771776",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "10328205192"
      },
      {
        "vendedor_cpf": "03476172120",
        "vendedor_nome": "IGOR DANIEL DIAS PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17603944885228",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "05977863136"
      },
      {
        "vendedor_cpf": "89374770172",
        "vendedor_nome": "ERIVANIA BENEDITA SOUZA ROCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17603884823445",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "04751084186"
      },
      {
        "vendedor_cpf": "06345193100",
        "vendedor_nome": "FERNANDA KAROLINA SOUZA COSTA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17599659261000",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "02760527301"
      },
      {
        "vendedor_cpf": "89374770172",
        "vendedor_nome": "ERIVANIA BENEDITA SOUZA ROCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17619111595873",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 873.38,
        "titularCpf": "02412660174"
      },
      {
        "vendedor_cpf": "87612143100",
        "vendedor_nome": "POLIANA BARBOSA DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17617484980725",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "11746389150"
      },
      {
        "vendedor_cpf": "71234217104",
        "vendedor_nome": "GLEDSON TAVARES DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17615850739691",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "05099115101"
      },
      {
        "vendedor_cpf": "02199232131",
        "vendedor_nome": "RAFAEL SANTOS SOUZA DE SA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17617555009433",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 3,
        "total_valor": 1921.88,
        "titularCpf": "78014190149"
      },
      {
        "vendedor_cpf": "14108139402",
        "vendedor_nome": "JUCICLEIDE BATISTA FELIX DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17617630181099",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "05335157186"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17617676120342",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "11039284140"
      },
      {
        "vendedor_cpf": "07176381119",
        "vendedor_nome": "MARIA EDUARDA SEREJO CASTRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17618465677729",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "03637724138"
      },
      {
        "vendedor_cpf": "72109114134",
        "vendedor_nome": "WILSON BAPTISTA DIAS FILHO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17618567461640",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "05906009663"
      },
      {
        "vendedor_cpf": "57863822149",
        "vendedor_nome": "CLEA MARIA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17619167919925",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 378.74,
        "titularCpf": "05577434190"
      },
      {
        "vendedor_cpf": "49050788149",
        "vendedor_nome": "MARINEIA LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17622847338079",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 873.38,
        "titularCpf": "73462217100"
      },
      {
        "vendedor_cpf": "71310126100",
        "vendedor_nome": "WESLEY DE OLIVEIRA SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17622903515174",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 2,
        "total_valor": 894.76,
        "titularCpf": "06077551139"
      },
      {
        "vendedor_cpf": "89374770172",
        "vendedor_nome": "ERIVANIA BENEDITA SOUZA ROCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17623483237113",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "04947238151"
      },
      {
        "vendedor_cpf": "02429050137",
        "vendedor_nome": "LEONARDO SILVA BARBOSA CRUZ",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17623495062817",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "99842963187"
      },
      {
        "vendedor_cpf": "02118881177",
        "vendedor_nome": "GABRIELA AFONSO CALAZANS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17623668301312",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "01308016158"
      },
      {
        "vendedor_cpf": "70860866149",
        "vendedor_nome": "GEORGE ROBERTO DE FRANCA GOMES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17623735613774",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 2,
        "total_valor": 1343.28,
        "titularCpf": "03535174104"
      },
      {
        "vendedor_cpf": "53990382187",
        "vendedor_nome": "PATRICIA DE OLIVEIRA AZEVEDO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17623814994991",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "05613683174"
      },
      {
        "vendedor_cpf": "60695820125",
        "vendedor_nome": "ALEXANDRE NONATO RIBEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17623839299530",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 1156.26,
        "titularCpf": "29775773865"
      },
      {
        "vendedor_cpf": "07176381119",
        "vendedor_nome": "MARIA EDUARDA SEREJO CASTRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17623875761765",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "06543659114"
      },
      {
        "vendedor_cpf": "88958566191",
        "vendedor_nome": "ANARITA IANNES DE SALES DIAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17624473445161",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "02518823140"
      },
      {
        "vendedor_cpf": "04610593394",
        "vendedor_nome": "FELIPE LIMA SOUSA FERREIRA DE ALCANTARA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17601308653144",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "10967513138"
      },
      {
        "vendedor_cpf": "01206130180",
        "vendedor_nome": "ANA PAULA DE OLIVEIRA COSTA FERREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17618623744136",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "06097274190"
      },
      {
        "vendedor_cpf": "67582281420",
        "vendedor_nome": "MIRIAM FERREIRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17621765185263",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 801.01,
        "titularCpf": "99189712153"
      },
      {
        "vendedor_cpf": "80339662115",
        "vendedor_nome": "DANIELLE RODRIGUES LOUREIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17622737026323",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "07452444167"
      },
      {
        "vendedor_cpf": "08189479504",
        "vendedor_nome": "DENILSON SOUZA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17622835785520",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 1156.26,
        "titularCpf": "86908430197"
      },
      {
        "vendedor_cpf": "05711768107",
        "vendedor_nome": "RENATHA LEANDRO ALMEIDA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17622854959280",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 407.88,
        "titularCpf": "03717479105"
      },
      {
        "vendedor_cpf": "05711768107",
        "vendedor_nome": "RENATHA LEANDRO ALMEIDA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17622862067030",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 407.88,
        "titularCpf": "07727554189"
      },
      {
        "vendedor_cpf": "00989623378",
        "vendedor_nome": "MAXIMINIANO MORAES DA COSTA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17622909258374",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "10796952140"
      },
      {
        "vendedor_cpf": "01193374103",
        "vendedor_nome": "ADEMILSON DA SILVA PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17623657604646",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 2,
        "total_valor": 1247.86,
        "titularCpf": "90110412168"
      },
      {
        "vendedor_cpf": "60245662120",
        "vendedor_nome": "DEUZELINA PEREIRA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17623757717485",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "11205623175"
      },
      {
        "vendedor_cpf": "05759322605",
        "vendedor_nome": "MARCELO ALVES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17623629896043",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "05386690124"
      },
      {
        "vendedor_cpf": "02118881177",
        "vendedor_nome": "GABRIELA AFONSO CALAZANS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17623703502857",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "07354080179"
      },
      {
        "vendedor_cpf": "71159134120",
        "vendedor_nome": "VALDIR RUDIARD DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17622771263466",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 2,
        "total_valor": 894.76,
        "titularCpf": "98157710278"
      },
      {
        "vendedor_cpf": "56508050168",
        "vendedor_nome": "NILDA MARIA BARBOSA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17617539838333",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 685.00,
        "titularCpf": "73472492104"
      },
      {
        "vendedor_cpf": "71234217104",
        "vendedor_nome": "GLEDSON TAVARES DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17619187541813",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "09814457132"
      },
      {
        "vendedor_cpf": "06800576689",
        "vendedor_nome": "ELISANGELA SOUZA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17619373203552",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "04645272101"
      },
      {
        "vendedor_cpf": "01781043108",
        "vendedor_nome": "ELDON ROCHA MARQUES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17622736625079",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "11559939184"
      },
      {
        "vendedor_cpf": "36606756871",
        "vendedor_nome": "ALINE DE OLIVEIRA TEODORO TEIXEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17623829846767",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 1478.61,
        "titularCpf": "20177180846"
      },
      {
        "vendedor_cpf": "89374770172",
        "vendedor_nome": "ERIVANIA BENEDITA SOUZA ROCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17623903379661",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "09721652156"
      },
      {
        "vendedor_cpf": "88252582168",
        "vendedor_nome": "ALINE SANCHES OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17624353216287",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "11099869129"
      },
      {
        "vendedor_cpf": "00384233163",
        "vendedor_nome": "LIGIA MARQUEZ SOCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17625236946200",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "02541146108"
      },
      {
        "vendedor_cpf": "65907639172",
        "vendedor_nome": "ALAN  NEANDER FERREIRA DE LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17625237737255",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 3,
        "total_valor": 1366.28,
        "titularCpf": "04451550190"
      },
      {
        "vendedor_cpf": "00820125121",
        "vendedor_nome": "LUCIANO DOS ANJOS TEIXEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17625285340018",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "02967781177"
      },
      {
        "vendedor_cpf": "90297571168",
        "vendedor_nome": "WAGNER CABRAL NEVES DA ROCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17625398496542",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "06426888184"
      },
      {
        "vendedor_cpf": "00855333197",
        "vendedor_nome": "BRUNA DOS SANTOS CORREIA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17625420367710",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "09416855197"
      },
      {
        "vendedor_cpf": "04610593394",
        "vendedor_nome": "FELIPE LIMA SOUSA FERREIRA DE ALCANTARA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17625428938388",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "11697386130"
      },
      {
        "vendedor_cpf": "05944518170",
        "vendedor_nome": "THAIS BATISTA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17622860024085",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "05826869119"
      },
      {
        "vendedor_cpf": "01839974176",
        "vendedor_nome": "GLEICE KELLY BRAZ PEREIRA PORTELA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17605652896125",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "02419338111"
      },
      {
        "vendedor_cpf": "89374770172",
        "vendedor_nome": "ERIVANIA BENEDITA SOUZA ROCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17617604675917",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "05797467127"
      },
      {
        "vendedor_cpf": "04066347185",
        "vendedor_nome": "RENAN SOUSA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17621883149476",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "03510995147"
      },
      {
        "vendedor_cpf": "46210199100",
        "vendedor_nome": "ROSANE DE SOUZA MAGALHAES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17621975872142",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "04041717108"
      },
      {
        "vendedor_cpf": "70171890191",
        "vendedor_nome": "REGIANE GOMES DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17623714495465",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "16810664750"
      },
      {
        "vendedor_cpf": "78782295549",
        "vendedor_nome": "SARA ANTUNES RIBEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17624458384985",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 2,
        "total_valor": 974.01,
        "titularCpf": "00098703188"
      },
      {
        "vendedor_cpf": "71592911153",
        "vendedor_nome": "JOAO BOSCO DE MELO PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17607411039115",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "17821110426"
      },
      {
        "vendedor_cpf": "71214828191",
        "vendedor_nome": "FERNANDO NOLETO MACHADO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17618487453195",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "08232992107"
      },
      {
        "vendedor_cpf": "46210199100",
        "vendedor_nome": "ROSANE DE SOUZA MAGALHAES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17619184168266",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "05988121136"
      },
      {
        "vendedor_cpf": "81445393115",
        "vendedor_nome": "KATIUSCIA LELES SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17624446379510",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "71665506199"
      },
      {
        "vendedor_cpf": "02632445124",
        "vendedor_nome": "MARCELLA LORRAINE VIEIRA FERNANDES MESSIAS E SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17624510450136",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "05358816143"
      },
      {
        "vendedor_cpf": "97968684153",
        "vendedor_nome": "ANDERRUPSON FERNANDES PONTES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17625307202002",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "11737330199"
      },
      {
        "vendedor_cpf": "05157657161",
        "vendedor_nome": "SUELEN DA ROCHA NOBRE CAVALCANTE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17623494390215",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "11579678173"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17623650723227",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "06357505200"
      },
      {
        "vendedor_cpf": "07176381119",
        "vendedor_nome": "MARIA EDUARDA SEREJO CASTRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17623941321011",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "11612381154"
      },
      {
        "vendedor_cpf": "36606756871",
        "vendedor_nome": "ALINE DE OLIVEIRA TEODORO TEIXEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17629015634459",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "04050421160"
      },
      {
        "vendedor_cpf": "01199976148",
        "vendedor_nome": "SAMARA SOUSA CASTRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17629766236857",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 685.00,
        "titularCpf": "01948457105"
      },
      {
        "vendedor_cpf": "05119567118",
        "vendedor_nome": "THAIS RODRIGUES NEIVA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17631331724893",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "06257904137"
      },
      {
        "vendedor_cpf": "02773807154",
        "vendedor_nome": "WALTER MEIRELLES NETO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17630440541470",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 294.01,
        "titularCpf": "09663717122"
      },
      {
        "vendedor_cpf": "03203283174",
        "vendedor_nome": "THAIS MIRANDA RIBEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17632941177923",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 649.11,
        "titularCpf": "98563700197"
      },
      {
        "vendedor_cpf": "73471666591",
        "vendedor_nome": "MARCIA QUARESMA SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17628792967480",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "72465883100"
      },
      {
        "vendedor_cpf": "69262993153",
        "vendedor_nome": "ELAINE NUNES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17635743212667",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "05539914180"
      },
      {
        "vendedor_cpf": "04317737183",
        "vendedor_nome": "YASMINE PAZ",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17635122905233",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "10941079139"
      },
      {
        "vendedor_cpf": "02358934127",
        "vendedor_nome": "RAFAEL SANTOS CADUDA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17631372925948",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "06609508127"
      },
      {
        "vendedor_cpf": "85600059191",
        "vendedor_nome": "KATIA REGINA VIANA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17635709765033",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 2,
        "total_valor": 1547.60,
        "titularCpf": "01271193108"
      },
      {
        "vendedor_cpf": "04508279171",
        "vendedor_nome": "ANA FABIOLA ALVES DE JESUS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17631503540669",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "11773954105"
      },
      {
        "vendedor_cpf": "00384233163",
        "vendedor_nome": "LIGIA MARQUEZ SOCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17635690247045",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "06624653000"
      },
      {
        "vendedor_cpf": "00384233163",
        "vendedor_nome": "LIGIA MARQUEZ SOCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17637318201144",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 575.01,
        "titularCpf": "05074416132"
      },
      {
        "vendedor_cpf": "04317737183",
        "vendedor_nome": "YASMINE PAZ",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640078663999",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "10001332147"
      },
      {
        "vendedor_cpf": "02118881177",
        "vendedor_nome": "GABRIELA AFONSO CALAZANS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17641924754565",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "05717394152"
      },
      {
        "vendedor_cpf": "94396973691",
        "vendedor_nome": "EDITE ALMEIDA NERIS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17641014604439",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "05907041170"
      },
      {
        "vendedor_cpf": "53990382187",
        "vendedor_nome": "PATRICIA DE OLIVEIRA AZEVEDO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640076798154",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 876.96,
        "titularCpf": "70848114191"
      },
      {
        "vendedor_cpf": "73471666591",
        "vendedor_nome": "MARCIA QUARESMA SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17634738345341",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "02168284148"
      },
      {
        "vendedor_cpf": "01913335143",
        "vendedor_nome": "ANA PAULA PEREIRA FRANCA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17641094678051",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "06036036108"
      },
      {
        "vendedor_cpf": "95840893153",
        "vendedor_nome": "RONALDO DA SILVA BARROS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17643448843845",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 575.01,
        "titularCpf": "04449321197"
      },
      {
        "vendedor_cpf": "02264160110",
        "vendedor_nome": "SAULO VITOR BARBOSA RODRIGUES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17643556680241",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 499.86,
        "titularCpf": "02723330184"
      },
      {
        "vendedor_cpf": "71419993100",
        "vendedor_nome": "JAIRO GOMES DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17643524769586",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "02945936160"
      },
      {
        "vendedor_cpf": "02106234112",
        "vendedor_nome": "TAMELLA MOURA ZAGO DIAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17646145356904",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "04298653170"
      },
      {
        "vendedor_cpf": "00038974193",
        "vendedor_nome": "WILSON SOARES DE ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17646048117079",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "04500468188"
      },
      {
        "vendedor_cpf": "07221295646",
        "vendedor_nome": "THIAGO BARBOSA DE SOUSA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17643634179379",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "06712018161"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17647930097505",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "03189122105"
      },
      {
        "vendedor_cpf": "71592911153",
        "vendedor_nome": "JOAO BOSCO DE MELO PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17648547026015",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "10178232190"
      },
      {
        "vendedor_cpf": "85764779120",
        "vendedor_nome": "ANDERSON RAYMONDI SOARES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17648960408086",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "08760496177"
      },
      {
        "vendedor_cpf": "89374770172",
        "vendedor_nome": "ERIVANIA BENEDITA SOUZA ROCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17646371763510",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "07666471106"
      },
      {
        "vendedor_cpf": "71843698153",
        "vendedor_nome": "JORGE LUIZ PLINIO LADEIRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17637365469951",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "06495936184"
      },
      {
        "vendedor_cpf": "03439204170",
        "vendedor_nome": "LUCIENE MARTINS ARAUJO PASSOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17648762839154",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 960.22,
        "titularCpf": "86022890225"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17647005468846",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 444.88,
        "titularCpf": "07033225164"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17646077605764",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "05521795154"
      },
      {
        "vendedor_cpf": "83669540130",
        "vendedor_nome": "GISELE SOARES DE SOUSA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640998893388",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "11115535137"
      },
      {
        "vendedor_cpf": "73829560168",
        "vendedor_nome": "FERNANDA SANTOS DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17642756302776",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "71122190190"
      },
      {
        "vendedor_cpf": "83416021134",
        "vendedor_nome": "ESTENIO JAIRO ALVES DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17646062797005",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 3,
        "total_valor": 1529.26,
        "titularCpf": "01354805151"
      },
      {
        "vendedor_cpf": "04476091571",
        "vendedor_nome": "FELIPE FLORENCIO DE LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17649557819058",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 873.38,
        "titularCpf": "13147228754"
      },
      {
        "vendedor_cpf": "72558989120",
        "vendedor_nome": "FERNANDA GALDINO SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17650308360239",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 1156.26,
        "titularCpf": "71021523100"
      },
      {
        "vendedor_cpf": "72583240110",
        "vendedor_nome": "CLEITON DE SOUSA TOME",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17646271037195",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 2,
        "total_valor": 958.82,
        "titularCpf": "04208310103"
      },
      {
        "vendedor_cpf": "00670482188",
        "vendedor_nome": "ALEXANDRE SILVA GONDIN",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17653003222203",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 873.38,
        "titularCpf": "03704689106"
      },
      {
        "vendedor_cpf": "69983852187",
        "vendedor_nome": "JOÃO PAULO SANTANA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17647045791656",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "05166777131"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17648752289627",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 2,
        "total_valor": 958.82,
        "titularCpf": "04248005190"
      },
      {
        "vendedor_cpf": "47177071172",
        "vendedor_nome": "MARCIA MARTINS DE VASCONCELOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17652300565976",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "03368016105"
      },
      {
        "vendedor_cpf": "02106234112",
        "vendedor_nome": "TAMELLA MOURA ZAGO DIAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17636510291196",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 2,
        "total_valor": 1293.22,
        "titularCpf": "00395762138"
      },
      {
        "vendedor_cpf": "33622620587",
        "vendedor_nome": "FERNANDO ALVES DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17648657015320",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 2,
        "total_valor": 1386.19,
        "titularCpf": "02270130189"
      },
      {
        "vendedor_cpf": "70431809100",
        "vendedor_nome": "ANA WALESKA COSTA LEANDRO ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17649449569734",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 649.11,
        "titularCpf": "02152450329"
      },
      {
        "vendedor_cpf": "06281458370",
        "vendedor_nome": "JESSIGLEICE FERNANDES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17640125215234",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 649.11,
        "titularCpf": "00977361128"
      },
      {
        "vendedor_cpf": "04066347185",
        "vendedor_nome": "RENAN SOUSA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17652060643647",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "04458889117"
      },
      {
        "vendedor_cpf": "03769358392",
        "vendedor_nome": "THIAGO ALVES DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17649657032513",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "60239114809"
      },
      {
        "vendedor_cpf": "03133365126",
        "vendedor_nome": "INARA BRUNA SOUSA BARBOSA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17652058010039",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "02110306190"
      },
      {
        "vendedor_cpf": "02506708103",
        "vendedor_nome": "GLAUBER DA SILVA MAURICIO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17646795335740",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "06968301164"
      },
      {
        "vendedor_cpf": "04610593394",
        "vendedor_nome": "FELIPE LIMA SOUSA FERREIRA DE ALCANTARA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17652372326959",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "05545163140"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17649747370386",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 2,
        "total_valor": 1018.61,
        "titularCpf": "03666201180"
      },
      {
        "vendedor_cpf": "02118881177",
        "vendedor_nome": "GABRIELA AFONSO CALAZANS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17649736070414",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 873.38,
        "titularCpf": "01767762143"
      },
      {
        "vendedor_cpf": "69951276172",
        "vendedor_nome": "WILLIAM BENTHON TAVARES DA CAMARA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17647712494889",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "07508984102"
      },
      {
        "vendedor_cpf": "72025310110",
        "vendedor_nome": "GLEIRISTON DA SILVA PINHEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17648137433523",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "08226799147"
      },
      {
        "vendedor_cpf": "03133365126",
        "vendedor_nome": "INARA BRUNA SOUSA BARBOSA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17647951061766",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "09271882105"
      },
      {
        "vendedor_cpf": "92702503187",
        "vendedor_nome": "TATHIANA ROSELI SANTOS BATTISTI DA SILVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17647002435325",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 461.82,
        "titularCpf": "03127067151"
      },
      {
        "vendedor_cpf": "03203283174",
        "vendedor_nome": "THAIS MIRANDA RIBEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17639172767200",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "06391642184"
      },
      {
        "vendedor_cpf": "85764779120",
        "vendedor_nome": "ANDERSON RAYMONDI SOARES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17630637499672",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "98904710197"
      },
      {
        "vendedor_cpf": "63567377191",
        "vendedor_nome": "CARLOS ROBERTO LEITE ALENCAR",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17649412800287",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "05526392147"
      },
      {
        "vendedor_cpf": "01193374103",
        "vendedor_nome": "ADEMILSON DA SILVA PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17648693593710",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "06885177148"
      },
      {
        "vendedor_cpf": "89374770172",
        "vendedor_nome": "ERIVANIA BENEDITA SOUZA ROCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17643617922219",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 4,
        "total_valor": 1670.62,
        "titularCpf": "04411100100"
      },
      {
        "vendedor_cpf": "00595311180",
        "vendedor_nome": "BRUNO BARBOSA BORGES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17646158691593",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "09535978144"
      },
      {
        "vendedor_cpf": "00670482188",
        "vendedor_nome": "ALEXANDRE SILVA GONDIN",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17652279614099",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 2,
        "total_valor": 1547.60,
        "titularCpf": "00020914105"
      },
      {
        "vendedor_cpf": "03659419133",
        "vendedor_nome": "GILBERTO PEREIRA DA ROCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17646888360850",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "07199150156"
      },
      {
        "vendedor_cpf": "02400589178",
        "vendedor_nome": "ALESSANDRO SANTOS GOMES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17647916877495",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "09562544117"
      },
      {
        "vendedor_cpf": "70545810167",
        "vendedor_nome": "MANOEL ALEXANDRE DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17646152878606",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "05381391536"
      },
      {
        "vendedor_cpf": "72558989120",
        "vendedor_nome": "FERNANDA GALDINO SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17652305141269",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 873.38,
        "titularCpf": "00951438158"
      },
      {
        "vendedor_cpf": "71419993100",
        "vendedor_nome": "JAIRO GOMES DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17636552292811",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "03795348196"
      },
      {
        "vendedor_cpf": "18993850291",
        "vendedor_nome": "ANA MARIA PEREIRA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17641128819150",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 4,
        "total_valor": 2213.51,
        "titularCpf": "84349158120"
      },
      {
        "vendedor_cpf": "07213405128",
        "vendedor_nome": "LEONARDO SOARES GONCALVES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17637665577376",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 2,
        "total_valor": 1430.12,
        "titularCpf": "01222060108"
      },
      {
        "vendedor_cpf": "86349864115",
        "vendedor_nome": "ALEXANDRE DIOGO MARTINS DE MOURA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17649673754372",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "11360015140"
      },
      {
        "vendedor_cpf": "80396925120",
        "vendedor_nome": "RAFAELA SILVA DANEZI",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17643602956746",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 4,
        "total_valor": 1275.71,
        "titularCpf": "08433692135"
      },
      {
        "vendedor_cpf": "02876598108",
        "vendedor_nome": "PEDRO HENRIQUE DE OLIVEIRA CEZAR",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17647659665195",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "07441079110"
      },
      {
        "vendedor_cpf": "07213405128",
        "vendedor_nome": "LEONARDO SOARES GONCALVES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17648909961248",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "11633904610"
      },
      {
        "vendedor_cpf": "90743350120",
        "vendedor_nome": "JEDILENE BEZERRA VILAROUCA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17648561050380",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 675.63,
        "titularCpf": "95951229120"
      },
      {
        "vendedor_cpf": "02106234112",
        "vendedor_nome": "TAMELLA MOURA ZAGO DIAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17646154182822",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "11714036405"
      },
      {
        "vendedor_cpf": "05846660126",
        "vendedor_nome": "ESTER ALVES DA SILVA RODRIGUES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17652179578943",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 3,
        "total_valor": 1339.64,
        "titularCpf": "07729712180"
      },
      {
        "vendedor_cpf": "17729157349",
        "vendedor_nome": "ELZINETE FERNANDES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17634845327107",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "07786946152"
      },
      {
        "vendedor_cpf": "01436512182",
        "vendedor_nome": "MARCOS VINICIUS EMILIANO DUTRA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17634130762758",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "10195410165"
      },
      {
        "vendedor_cpf": "03956128109",
        "vendedor_nome": "ALAN DOS SANTOS SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17649685520366",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "05848019126"
      },
      {
        "vendedor_cpf": "05157657161",
        "vendedor_nome": "SUELEN DA ROCHA NOBRE CAVALCANTE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17634062055130",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "10294874135"
      },
      {
        "vendedor_cpf": "64570118615",
        "vendedor_nome": "EDNA MARIA ROCHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17647833031250",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 2,
        "total_valor": 803.00,
        "titularCpf": "08547212159"
      },
      {
        "vendedor_cpf": "36868698100",
        "vendedor_nome": "GILMAR RIBEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17652057554603",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "09950437105"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17647807491863",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 2,
        "total_valor": 1084.38,
        "titularCpf": "00875362184"
      },
      {
        "vendedor_cpf": "79403522100",
        "vendedor_nome": "DILENE GOMES DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17655493012349",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "05148354194"
      },
      {
        "vendedor_cpf": "00808314190",
        "vendedor_nome": "AMARALINA DE MEDEIROS SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17642779060847",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 432.38,
        "titularCpf": "07970450156"
      },
      {
        "vendedor_cpf": "04631233109",
        "vendedor_nome": "ANDREIA PEREIRA DE SOIZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17659139342717",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 592.38,
        "titularCpf": "05359327154"
      },
      {
        "vendedor_cpf": "15305546168",
        "vendedor_nome": "MARIA DE LOURDES SOUSA CUNHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17659048504121",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "06847672102"
      },
      {
        "vendedor_cpf": "06592605146",
        "vendedor_nome": "VINICIUS GONCALVES DE SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17660740833182",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "07150974155"
      },
      {
        "vendedor_cpf": "01799937127",
        "vendedor_nome": "RONEY EMANUEL GRAÇA CAMPOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17660948758118",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "03368496131"
      },
      {
        "vendedor_cpf": "05119567118",
        "vendedor_nome": "THAIS RODRIGUES NEIVA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17659227328694",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "02368827161"
      },
      {
        "vendedor_cpf": "03943973123",
        "vendedor_nome": "JULIANA COSTA SOARES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17660026049263",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 960.22,
        "titularCpf": "01131544102"
      },
      {
        "vendedor_cpf": "25517937349",
        "vendedor_nome": "MARIA GORETH DIAS FONSECA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17664162842635",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "09805457141"
      },
      {
        "vendedor_cpf": "01475346158",
        "vendedor_nome": "PRISCILA LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17656353079343",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 474.90,
        "titularCpf": "07473909169"
      },
      {
        "vendedor_cpf": "06592605146",
        "vendedor_nome": "VINICIUS GONCALVES DE SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17662449186307",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "05766379129"
      },
      {
        "vendedor_cpf": "33352887187",
        "vendedor_nome": "GUTEMBERG LOPES DE LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17665132973584",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "03727060107"
      },
      {
        "vendedor_cpf": "03423555114",
        "vendedor_nome": "BARBARA AGUIAR VIANA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17664537362513",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "07801280105"
      },
      {
        "vendedor_cpf": "03172967107",
        "vendedor_nome": "BIANCA DOS SANTOS CORREIA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17670223812567",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "06884882182"
      },
      {
        "vendedor_cpf": "76661849134",
        "vendedor_nome": "PATRICIA BITTENCOURT",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17659134138563",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "11575505177"
      },
      {
        "vendedor_cpf": "03916815164",
        "vendedor_nome": "THAISA MARA DE ALMEIDA ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17670211994142",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 2140.40,
        "titularCpf": "23620161372"
      },
      {
        "vendedor_cpf": "80339662115",
        "vendedor_nome": "DANIELLE RODRIGUES LOUREIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17671230864052",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "06856139179"
      },
      {
        "vendedor_cpf": "33352887187",
        "vendedor_nome": "GUTEMBERG LOPES DE LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17668764320379",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 649.11,
        "titularCpf": "98689533168"
      },
      {
        "vendedor_cpf": "92702503187",
        "vendedor_nome": "TATHIANA ROSELI SANTOS BATTISTI DA SILVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17659270594501",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 378.74,
        "titularCpf": "08266510113"
      },
      {
        "vendedor_cpf": "01166007138",
        "vendedor_nome": "ROGERIO TORRES DE OLIVERIA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17671244533813",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "07509565189"
      },
      {
        "vendedor_cpf": "03715706112",
        "vendedor_nome": "ARTHUR JOSE SOARES DA SILVA DUART",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17667723267712",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "03722829119"
      },
      {
        "vendedor_cpf": "31643981153",
        "vendedor_nome": "RODRIGO BOTELHO MACHADO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17671197235222",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "02344654178"
      },
      {
        "vendedor_cpf": "60245662120",
        "vendedor_nome": "DEUZELINA PEREIRA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17664457449002",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 2140.40,
        "titularCpf": "28816137134"
      },
      {
        "vendedor_cpf": "56445520120",
        "vendedor_nome": "DENISE ABOIM INGLES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17671504241914",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 685.00,
        "titularCpf": "02748252101"
      },
      {
        "vendedor_cpf": "70431809100",
        "vendedor_nome": "ANA WALESKA COSTA LEANDRO ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17674690197654",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "00725034165"
      },
      {
        "vendedor_cpf": "05339254100",
        "vendedor_nome": "FRANCISCO DIEGO DANTAS CARVALHO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17661440232765",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 523.19,
        "titularCpf": "04298990176"
      },
      {
        "vendedor_cpf": "49035401115",
        "vendedor_nome": "WANDER PEREIRA FREITAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17674801139890",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "07049125113"
      },
      {
        "vendedor_cpf": "01667880152",
        "vendedor_nome": "MARCUS VINICIUS DE BARROS SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17671151944499",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 649.11,
        "titularCpf": "01728086183"
      },
      {
        "vendedor_cpf": "99743574115",
        "vendedor_nome": "RODRIGO FELIX DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17676374097087",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "08319092183"
      },
      {
        "vendedor_cpf": "05155224144",
        "vendedor_nome": "KARINA MARTINS MARQUES DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17676633243846",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "08552987155"
      },
      {
        "vendedor_cpf": "69262993153",
        "vendedor_nome": "ELAINE NUNES DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17676468674462",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "05036856155"
      },
      {
        "vendedor_cpf": "87421453504",
        "vendedor_nome": "VENISIA LIMA DA SILVA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17655666298725",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 2,
        "total_valor": 958.82,
        "titularCpf": "02001191170"
      },
      {
        "vendedor_cpf": "00110452640",
        "vendedor_nome": "CLAYTON VASCONCELOS RODRIGUES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17676410955599",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "02315576121"
      },
      {
        "vendedor_cpf": "80396925120",
        "vendedor_nome": "RAFAELA SILVA DANEZI",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17671199025408",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 728.48,
        "titularCpf": "99550440125"
      },
      {
        "vendedor_cpf": "01461096197",
        "vendedor_nome": "DIEGO DE OLIVEIRA BRANDAO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17673681091567",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 2,
        "total_valor": 1626.16,
        "titularCpf": "71171851120"
      },
      {
        "vendedor_cpf": "71005604118",
        "vendedor_nome": "GUSTAVO ALYSON DE ARAGAO MESQUITA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17677015975588",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "04285801140"
      },
      {
        "vendedor_cpf": "72583240110",
        "vendedor_nome": "CLEITON DE SOUSA TOME",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17677026198225",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 1121.10,
        "titularCpf": "62056492172"
      },
      {
        "vendedor_cpf": "77083032149",
        "vendedor_nome": "IRIS BESERRA DO NASCIMENTO COSTA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17667659636343",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "08304902133"
      },
      {
        "vendedor_cpf": "05419090104",
        "vendedor_nome": "ELIEZER AMARAL MONTEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17667546338948",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "11833184130"
      },
      {
        "vendedor_cpf": "72744251100",
        "vendedor_nome": "LUIZ ANTONIO FERREIRA CARVALHO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17677207361240",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 538.86,
        "titularCpf": "05413428197"
      },
      {
        "vendedor_cpf": "49050788149",
        "vendedor_nome": "MARINEIA LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17677160562314",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 563.94,
        "titularCpf": "07817993173"
      },
      {
        "vendedor_cpf": "90743350120",
        "vendedor_nome": "JEDILENE BEZERRA VILAROUCA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17670994692873",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "03679501110"
      },
      {
        "vendedor_cpf": "84489332149",
        "vendedor_nome": "EDNA DE CAMARGOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17673858612239",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 575.01,
        "titularCpf": "03217826159"
      },
      {
        "vendedor_cpf": "84489332149",
        "vendedor_nome": "EDNA DE CAMARGOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17673817546200",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 649.11,
        "titularCpf": "01688916113"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17676381684697",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "09015210195"
      },
      {
        "vendedor_cpf": "70711801134",
        "vendedor_nome": "GILVANIA ALVES COSTA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17673971380974",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "08145357128"
      },
      {
        "vendedor_cpf": "72539550134",
        "vendedor_nome": "JOENI CARVALHO DE ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17652954312617",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 664.11,
        "titularCpf": "71461566134"
      },
      {
        "vendedor_cpf": "01088844146",
        "vendedor_nome": "Marlon Denis de Souza",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17676491956574",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "11641491132"
      },
      {
        "vendedor_cpf": "01882936124",
        "vendedor_nome": "ANA RAQUEL RIBEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17673766181567",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 619.83,
        "titularCpf": "03368232150"
      },
      {
        "vendedor_cpf": "71831509172",
        "vendedor_nome": "ANA CAROLINA CAMPOS DE LISCIO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17655689961549",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 2,
        "total_valor": 958.82,
        "titularCpf": "09819174457"
      },
      {
        "vendedor_cpf": "04059884197",
        "vendedor_nome": "TAYNAH PRISCILA GAMA DE ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17667896321830",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "51355779200"
      },
      {
        "vendedor_cpf": "00479978182",
        "vendedor_nome": "DANIEL MEDEIROS DE MELO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17671092998473",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 794.44,
        "titularCpf": "06349872169"
      },
      {
        "vendedor_cpf": "00798192143",
        "vendedor_nome": "RUDSON FERNANDES DE AZEREDO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17677131543874",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "06369882100"
      },
      {
        "vendedor_cpf": "37429620191",
        "vendedor_nome": "KLEBER LUIZ GOMES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17676428005245",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "05899179198"
      },
      {
        "vendedor_cpf": "87612143100",
        "vendedor_nome": "POLIANA BARBOSA DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17673706599310",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "05055515198"
      },
      {
        "vendedor_cpf": "01839974176",
        "vendedor_nome": "GLEICE KELLY BRAZ PEREIRA PORTELA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17671316891160",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "09613606157"
      },
      {
        "vendedor_cpf": "99743574115",
        "vendedor_nome": "RODRIGO FELIX DE OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17676376797015",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "08159079150"
      },
      {
        "vendedor_cpf": "00493495118",
        "vendedor_nome": "LEONARDO MENDES PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17678259479505",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 2,
        "total_valor": 803.00,
        "titularCpf": "06475358150"
      },
      {
        "vendedor_cpf": "01954742100",
        "vendedor_nome": "RENATA MENDES GONCALVES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17676420029375",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "01628834129"
      },
      {
        "vendedor_cpf": "87815907172",
        "vendedor_nome": "LUCIENE DA SILVA PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17676446425914",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 303.99,
        "titularCpf": "11758061103"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17676386548553",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 4,
        "total_valor": 1853.69,
        "titularCpf": "71081810106"
      },
      {
        "vendedor_cpf": "03203283174",
        "vendedor_nome": "THAIS MIRANDA RIBEIRO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17677919646979",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 801.01,
        "titularCpf": "70223050130"
      },
      {
        "vendedor_cpf": "87298309153",
        "vendedor_nome": "GLAIME MENDES OLIVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17676436191060",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "06328455119"
      },
      {
        "vendedor_cpf": "95840893153",
        "vendedor_nome": "RONALDO DA SILVA BARROS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17676374005344",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "11575426110"
      },
      {
        "vendedor_cpf": "03946068170",
        "vendedor_nome": "ALICE PINHEIRO POUPEU VIANA NETA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17676703001676",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 873.38,
        "titularCpf": "03317024100"
      },
      {
        "vendedor_cpf": "71159134120",
        "vendedor_nome": "VALDIR RUDIARD DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17678088828900",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 873.38,
        "titularCpf": "07675434676"
      },
      {
        "vendedor_cpf": "83924183104",
        "vendedor_nome": "WIDMARK LOIOLA RODRIGUES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17677870566397",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "09179807194"
      },
      {
        "vendedor_cpf": "03247825193",
        "vendedor_nome": "KAREN SILVA BARBOZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17671224686741",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 662.71,
        "titularCpf": "03473178128"
      },
      {
        "vendedor_cpf": "04610593394",
        "vendedor_nome": "FELIPE LIMA SOUSA FERREIRA DE ALCANTARA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17676445981296",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 402.14,
        "titularCpf": "05722230138"
      },
      {
        "vendedor_cpf": "02375747135",
        "vendedor_nome": "DANIELA FERNANDA DE SOUZA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17676538047296",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "08324393129"
      },
      {
        "vendedor_cpf": "73378208104",
        "vendedor_nome": "RODRIGO OPA ASPIN CABRAL",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17677228336318",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 873.38,
        "titularCpf": "03911794118"
      },
      {
        "vendedor_cpf": "46210199100",
        "vendedor_nome": "ROSANE DE SOUZA MAGALHAES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17678377571031",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 709.86,
        "titularCpf": "03181474169"
      },
      {
        "vendedor_cpf": "69011869168",
        "vendedor_nome": "ANA PAULA VALENTE",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17675611477502",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "03453780167"
      },
      {
        "vendedor_cpf": "70116709120",
        "vendedor_nome": "EDUARDO PEREIRA DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17670390342709",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 2242.11,
        "titularCpf": "69523088149"
      },
      {
        "vendedor_cpf": "92702503187",
        "vendedor_nome": "TATHIANA ROSELI SANTOS BATTISTI DA SILVEIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17659263607763",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 378.74,
        "titularCpf": "08266500150"
      },
      {
        "vendedor_cpf": "22333878134",
        "vendedor_nome": "ENES DE BARROS GARCAO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17676424957511",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "73802832191"
      },
      {
        "vendedor_cpf": "01945934360",
        "vendedor_nome": "ROSSANA KARLA DE OLIVEIRA QUEIROZ",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17677124954915",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "09621584108"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17677314826713",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 2,
        "total_valor": 848.09,
        "titularCpf": "05078808116"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17677349346710",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 4,
        "total_valor": 1861.06,
        "titularCpf": "71953736149"
      },
      {
        "vendedor_cpf": "60559799187",
        "vendedor_nome": "MARIA DE LOURDES XIMENES",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17677829478552",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 3,
        "total_valor": 899.33,
        "titularCpf": "03554186147"
      },
      {
        "vendedor_cpf": "72744251100",
        "vendedor_nome": "LUIZ ANTONIO FERREIRA CARVALHO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17676443496633",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 449.88,
        "titularCpf": "06355871144"
      },
      {
        "vendedor_cpf": "15305546168",
        "vendedor_nome": "MARIA DE LOURDES SOUSA CUNHA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17660044179811",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 602.92,
        "titularCpf": "05294727161"
      },
      {
        "vendedor_cpf": "02106234112",
        "vendedor_nome": "TAMELLA MOURA ZAGO DIAS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17673913275817",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "11427735158"
      },
      {
        "vendedor_cpf": "71592911153",
        "vendedor_nome": "JOAO BOSCO DE MELO PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17677485434488",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "10973544155"
      },
      {
        "vendedor_cpf": "80581161149",
        "vendedor_nome": "KATHIANE SOARES PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17676408333084",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "05337455192"
      },
      {
        "vendedor_cpf": "71592911153",
        "vendedor_nome": "JOAO BOSCO DE MELO PEREIRA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17677296954553",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "11237251109"
      },
      {
        "vendedor_cpf": "71005604118",
        "vendedor_nome": "GUSTAVO ALYSON DE ARAGAO MESQUITA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17676417642405",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 2,
        "total_valor": 651.13,
        "titularCpf": "03626629163"
      },
      {
        "vendedor_cpf": "00801570174",
        "vendedor_nome": "MICHELE CRISTINA DO NASCIMENTO LIMA",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17678836784448",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 2,
        "total_valor": 894.76,
        "titularCpf": "05370856109"
      },
      {
        "vendedor_cpf": "10934542880",
        "vendedor_nome": "FABIANO ASSIS DE MELO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17678222752629",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 444.14,
        "titularCpf": "05995423142"
      },
      {
        "vendedor_cpf": "01861195184",
        "vendedor_nome": "KAREN KAROLYNE FERNANDES DOS SANTOS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17676450308167",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 294.01,
        "titularCpf": "09957017179"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17673786757694",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 4,
        "total_valor": 1944.66,
        "titularCpf": "72907550144"
      },
      {
        "vendedor_cpf": "01918085129",
        "vendedor_nome": "LUIS BITTENCOURT MARTINS",
        "operadora_nome": "PLENUM SAUDE",
        "propostaID": "17673842139828",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 3,
        "total_valor": 1588.76,
        "titularCpf": "70345279204"
      },
      {
        "vendedor_cpf": "17923492115",
        "vendedor_nome": "VALDENOR JOSE DE CARVALHO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17569949302439",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 2,
        "total_valor": 774.20,
        "titularCpf": "06048535139"
      },
      {
        "vendedor_cpf": "69262993153",
        "vendedor_nome": "ELAINE NUNES DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17568572465350",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 572.97,
        "titularCpf": "04096667188"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17570969929814",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 498.89,
        "titularCpf": "07578241109"
      },
      {
        "vendedor_cpf": "69951276172",
        "vendedor_nome": "WILLIAM BENTHON TAVARES DA CAMARA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17576310583305",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 519.37,
        "titularCpf": "01856866130"
      },
      {
        "vendedor_cpf": "04317737183",
        "vendedor_nome": "YASMINE PAZ",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17579822552181",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11505373107"
      },
      {
        "vendedor_cpf": "87418665172",
        "vendedor_nome": "ANDRE ALVARES FERREIRA DOS SANTOS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17580288974399",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 452.27,
        "titularCpf": "00976922126"
      },
      {
        "vendedor_cpf": "04066347185",
        "vendedor_nome": "RENAN SOUSA DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17574337669064",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 2,
        "total_valor": 516.48,
        "titularCpf": "08643314102"
      },
      {
        "vendedor_cpf": "01308623712",
        "vendedor_nome": "MARIA APARECIDA MOTA PINHEIRO VITAL",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17579864649675",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 393.93,
        "titularCpf": "01196118213"
      },
      {
        "vendedor_cpf": "89374770172",
        "vendedor_nome": "ERIVANIA BENEDITA SOUZA ROCHA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17599330542545",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 423.05,
        "titularCpf": "09071384110"
      },
      {
        "vendedor_cpf": "69262993153",
        "vendedor_nome": "ELAINE NUNES DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17599434413772",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "03493857187"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17600173990500",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 519.37,
        "titularCpf": "00538581158"
      },
      {
        "vendedor_cpf": "03203283174",
        "vendedor_nome": "THAIS MIRANDA RIBEIRO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17601228904293",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 572.97,
        "titularCpf": "04916664116"
      },
      {
        "vendedor_cpf": "01370932502",
        "vendedor_nome": "CATIANE MENEZES RIBEIRO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17601353089265",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "09419273180"
      },
      {
        "vendedor_cpf": "01370932502",
        "vendedor_nome": "CATIANE MENEZES RIBEIRO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17603758271923",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "09066338180"
      },
      {
        "vendedor_cpf": "01143356136",
        "vendedor_nome": "LUCILENE SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17603793717769",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 343.20,
        "titularCpf": "07720983106"
      },
      {
        "vendedor_cpf": "05572660175",
        "vendedor_nome": "ALINE REIS DOS SANTOS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17604096705518",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 343.20,
        "titularCpf": "05572660175"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17604462602751",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11700881124"
      },
      {
        "vendedor_cpf": "01759340103",
        "vendedor_nome": "EDUARDO MACIEL RODRIGUES DE SOUZA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17604648817327",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 756.14,
        "titularCpf": "00937722111"
      },
      {
        "vendedor_cpf": "05711768107",
        "vendedor_nome": "RENATHA LEANDRO ALMEIDA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17598793271388",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11734393157"
      },
      {
        "vendedor_cpf": "72107740178",
        "vendedor_nome": "ALINE DO COUTO SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17605501758445",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11365292177"
      },
      {
        "vendedor_cpf": "69262993153",
        "vendedor_nome": "ELAINE NUNES DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17607130905769",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "05830374102"
      },
      {
        "vendedor_cpf": "00627444105",
        "vendedor_nome": "MARILDA RAQUEL CRISTINO SOARES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17607346512956",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "08744365160"
      },
      {
        "vendedor_cpf": "66546532115",
        "vendedor_nome": "DEMÉTRIOS OZIAS DE SOUZA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17597759628030",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10126455171"
      },
      {
        "vendedor_cpf": "07221295646",
        "vendedor_nome": "THIAGO BARBOSA DE SOUSA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17632201999621",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 343.20,
        "titularCpf": "07206978169"
      },
      {
        "vendedor_cpf": "90132963191",
        "vendedor_nome": "VIVIANE RIBEIRO DE ALBUQUERQUE",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17630483913468",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 541.84,
        "titularCpf": "04341060112"
      },
      {
        "vendedor_cpf": "69397651153",
        "vendedor_nome": "LUCIANA DOS SANTOS LELIS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17634236192778",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "09715392199"
      },
      {
        "vendedor_cpf": "99938405134",
        "vendedor_nome": "DAYANNE CRISTINE DE FREITAS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17630586560710",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 2,
        "total_valor": 516.48,
        "titularCpf": "07172253132"
      },
      {
        "vendedor_cpf": "97968684153",
        "vendedor_nome": "ANDERRUPSON FERNANDES PONTES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17631551892127",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 471.82,
        "titularCpf": "04106349132"
      },
      {
        "vendedor_cpf": "05339254100",
        "vendedor_nome": "FRANCISCO DIEGO DANTAS CARVALHO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17631295812940",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 3,
        "total_valor": 1556.00,
        "titularCpf": "05432302101"
      },
      {
        "vendedor_cpf": "01852514124",
        "vendedor_nome": "THOMAS ALISSON PEREIRA CAMPOS COSTA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17629680632180",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 299.10,
        "titularCpf": "07403735102"
      },
      {
        "vendedor_cpf": "08136869111",
        "vendedor_nome": "GABRIEL SILVANO ALVES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17631603036070",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 343.20,
        "titularCpf": "70741951118"
      },
      {
        "vendedor_cpf": "03200645148",
        "vendedor_nome": "HATUS RODRIGUES CARVALHO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17623604285053",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 393.93,
        "titularCpf": "04058045124"
      },
      {
        "vendedor_cpf": "01193374103",
        "vendedor_nome": "ADEMILSON DA SILVA PEREIRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17623657944607",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "08844679108"
      },
      {
        "vendedor_cpf": "03943973123",
        "vendedor_nome": "JULIANA COSTA SOARES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17624631188283",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "07927490141"
      },
      {
        "vendedor_cpf": "73468398115",
        "vendedor_nome": "MAYARA FERNANDA RIBEIRO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17628146569331",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 393.93,
        "titularCpf": "09804881683"
      },
      {
        "vendedor_cpf": "03943973123",
        "vendedor_nome": "JULIANA COSTA SOARES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17628661224462",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 393.93,
        "titularCpf": "04157520190"
      },
      {
        "vendedor_cpf": "07221295646",
        "vendedor_nome": "THIAGO BARBOSA DE SOUSA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17629584320427",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 393.93,
        "titularCpf": "03680707193"
      },
      {
        "vendedor_cpf": "69262993153",
        "vendedor_nome": "ELAINE NUNES DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17630361438253",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10163694176"
      },
      {
        "vendedor_cpf": "03657455108",
        "vendedor_nome": "SHEYLA CRISTINA GONCALVES DOS SANTOS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17647795742587",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10060516194"
      },
      {
        "vendedor_cpf": "17923492115",
        "vendedor_nome": "VALDENOR JOSE DE CARVALHO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17649740969246",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 677.66,
        "titularCpf": "00784989109"
      },
      {
        "vendedor_cpf": "17923492115",
        "vendedor_nome": "VALDENOR JOSE DE CARVALHO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17649797309656",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "09166287103"
      },
      {
        "vendedor_cpf": "06510554151",
        "vendedor_nome": "WESLEY FERREIRA DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17653995415420",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 498.89,
        "titularCpf": "06059962106"
      },
      {
        "vendedor_cpf": "70545810167",
        "vendedor_nome": "MANOEL ALEXANDRE DE OLIVEIRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17653759423521",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "08657672111"
      },
      {
        "vendedor_cpf": "05438146101",
        "vendedor_nome": "KAREN THALYTA FERREIRA SANTOS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17654739474044",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10047431148"
      },
      {
        "vendedor_cpf": "01069193348",
        "vendedor_nome": "ELIZANGELA PEREIRA DOS SANTOS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17655690038020",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 299.10,
        "titularCpf": "07788292192"
      },
      {
        "vendedor_cpf": "88183980163",
        "vendedor_nome": "MARCOS ANDRE RODRIGUES DE PAIVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17658367932209",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 658.16,
        "titularCpf": "02730589163"
      },
      {
        "vendedor_cpf": "72606649168",
        "vendedor_nome": "PATRICIA DUARTE DA SILVA GONCALVES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17652868395112",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "07962938137"
      },
      {
        "vendedor_cpf": "02558943170",
        "vendedor_nome": "LIDIA MARIA NUNES LEAL ROCHA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17655589198087",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 339.44,
        "titularCpf": "11364842130"
      },
      {
        "vendedor_cpf": "72606649168",
        "vendedor_nome": "PATRICIA DUARTE DA SILVA GONCALVES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17655625690693",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "09937405106"
      },
      {
        "vendedor_cpf": "07221295646",
        "vendedor_nome": "THIAGO BARBOSA DE SOUSA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17658055815520",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 2,
        "total_valor": 516.48,
        "titularCpf": "06811816139"
      },
      {
        "vendedor_cpf": "69300844172",
        "vendedor_nome": "MARCELA BANDEIRA VIDAL",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17658120027705",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 647.96,
        "titularCpf": "87485540149"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17658249958622",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 647.96,
        "titularCpf": "71315306115"
      },
      {
        "vendedor_cpf": "92367941149",
        "vendedor_nome": "THAIS DIAS RODRIGUES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17658289278283",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "09039142122"
      },
      {
        "vendedor_cpf": "92367941149",
        "vendedor_nome": "THAIS DIAS RODRIGUES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17658294648415",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11178218112"
      },
      {
        "vendedor_cpf": "07221295646",
        "vendedor_nome": "THIAGO BARBOSA DE SOUSA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17658429595526",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 299.10,
        "titularCpf": "03113077109"
      },
      {
        "vendedor_cpf": "69659524153",
        "vendedor_nome": "FRANCISCA DAS CHAGAS SOARES FERREIRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17648652350568",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 2,
        "total_valor": 1066.86,
        "titularCpf": "02281305147"
      },
      {
        "vendedor_cpf": "01496984102",
        "vendedor_nome": "PAULO KALLIL RIBEIRO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17567648317718",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 343.20,
        "titularCpf": "07322676173"
      },
      {
        "vendedor_cpf": "01861195184",
        "vendedor_nome": "KAREN KAROLYNE FERNANDES DOS SANTOS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17568486905962",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 519.37,
        "titularCpf": "00966569130"
      },
      {
        "vendedor_cpf": "03023897174",
        "vendedor_nome": "WAYNE ALVES SOARES DE SOUZA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17569279096134",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "08495666146"
      },
      {
        "vendedor_cpf": "03200645148",
        "vendedor_nome": "HATUS RODRIGUES CARVALHO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17569454954189",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 299.10,
        "titularCpf": "07394391116"
      },
      {
        "vendedor_cpf": "88089282172",
        "vendedor_nome": "ISMAEL MARQUES ROCHA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17574230912306",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 498.89,
        "titularCpf": "00689398174"
      },
      {
        "vendedor_cpf": "89386795353",
        "vendedor_nome": "FRANCISCO DE ASSIS OLIVEIRA ARAUJO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17569286641151",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 519.37,
        "titularCpf": "93578571172"
      },
      {
        "vendedor_cpf": "53967879100",
        "vendedor_nome": "VALTER CLAUDIO OLIVEIRA SANTANA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17570336325606",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10778235173"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17573576410981",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10614719186"
      },
      {
        "vendedor_cpf": "01143356136",
        "vendedor_nome": "LUCILENE SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17598704562888",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10898403146"
      },
      {
        "vendedor_cpf": "55369057168",
        "vendedor_nome": "CARMEM LUCIA SANTOS ALMEIDA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17576292250658",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 2,
        "total_valor": 708.01,
        "titularCpf": "04129069101"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17598616379202",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10820109100"
      },
      {
        "vendedor_cpf": "05121077181",
        "vendedor_nome": "STEPHANE RODRIGUES ASSUNCAO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17598533834761",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "08642298103"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17598475884684",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "09745376590"
      },
      {
        "vendedor_cpf": "70545810167",
        "vendedor_nome": "MANOEL ALEXANDRE DE OLIVEIRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17585711844848",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10990300137"
      },
      {
        "vendedor_cpf": "53967879100",
        "vendedor_nome": "VALTER CLAUDIO OLIVEIRA SANTANA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17598380787092",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 2,
        "total_valor": 673.88,
        "titularCpf": "10047829184"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17586561228674",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "08296708159"
      },
      {
        "vendedor_cpf": "03178237100",
        "vendedor_nome": "MATEUS CASSEB FERRAZ SAAVEDRA DIAS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17595813776898",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10811851125"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17595202805213",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10820456160"
      },
      {
        "vendedor_cpf": "67582281420",
        "vendedor_nome": "MIRIAM FERREIRA DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17588857629245",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "09014825102"
      },
      {
        "vendedor_cpf": "60559799187",
        "vendedor_nome": "MARIA DE LOURDES XIMENES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17595188004298",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 343.20,
        "titularCpf": "06563106188"
      },
      {
        "vendedor_cpf": "01231447109",
        "vendedor_nome": "LUIS HENRIQUE MATOS BARRETO DE LIMA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17595155722898",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 393.93,
        "titularCpf": "06506935154"
      },
      {
        "vendedor_cpf": "08644575104",
        "vendedor_nome": "GIOVANNA LIMA COSTA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17595004204515",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 343.20,
        "titularCpf": "05773282127"
      },
      {
        "vendedor_cpf": "89374770172",
        "vendedor_nome": "ERIVANIA BENEDITA SOUZA ROCHA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17591756154008",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 647.96,
        "titularCpf": "70093407149"
      },
      {
        "vendedor_cpf": "05484690161",
        "vendedor_nome": "KAYRON VINICIUS BISPO MACHADO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17594417989058",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 393.93,
        "titularCpf": "03552571140"
      },
      {
        "vendedor_cpf": "70821571184",
        "vendedor_nome": "MARIA BEATRIZ DA COSTA SOUSA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17592644073454",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 343.20,
        "titularCpf": "07774805141"
      },
      {
        "vendedor_cpf": "69262993153",
        "vendedor_nome": "ELAINE NUNES DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17592868646733",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10193801108"
      },
      {
        "vendedor_cpf": "78812283187",
        "vendedor_nome": "CLAUDIA RENATA FERNANDES PINHEIRO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17593388578979",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 343.20,
        "titularCpf": "04025054175"
      },
      {
        "vendedor_cpf": "05121077181",
        "vendedor_nome": "STEPHANE RODRIGUES ASSUNCAO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17594154359081",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 343.20,
        "titularCpf": "07609622192"
      },
      {
        "vendedor_cpf": "03178237100",
        "vendedor_nome": "MATEUS CASSEB FERRAZ SAAVEDRA DIAS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17594292075180",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 519.37,
        "titularCpf": "00113637110"
      },
      {
        "vendedor_cpf": "04462462556",
        "vendedor_nome": "GILMAR SOUZA DA COSTA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17596639931930",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 519.37,
        "titularCpf": "03430796741"
      },
      {
        "vendedor_cpf": "50522604153",
        "vendedor_nome": "ANA CLAUDIA GOULART MOREIRA DE ALMEIDA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17593539934921",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 393.93,
        "titularCpf": "04543981154"
      },
      {
        "vendedor_cpf": "04066347185",
        "vendedor_nome": "RENAN SOUSA DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17595103264490",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 393.93,
        "titularCpf": "01326725106"
      },
      {
        "vendedor_cpf": "53858875104",
        "vendedor_nome": "MIGMAR PINTO BARBOSA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17610120574268",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 393.93,
        "titularCpf": "05204635360"
      },
      {
        "vendedor_cpf": "72583240110",
        "vendedor_nome": "CLEITON DE SOUSA TOME",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17610753179834",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 343.20,
        "titularCpf": "60366146327"
      },
      {
        "vendedor_cpf": "70545810167",
        "vendedor_nome": "MANOEL ALEXANDRE DE OLIVEIRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17612496286284",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11689853158"
      },
      {
        "vendedor_cpf": "03276336111",
        "vendedor_nome": "PRISCILA STEFANE ROCHA DOS SANTOS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17616950449682",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "09600709157"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17618288599146",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 519.37,
        "titularCpf": "73098469153"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17611583691236",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10084066199"
      },
      {
        "vendedor_cpf": "70547637187",
        "vendedor_nome": "TATIANY BORGES NEIVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17606464167778",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10298489392"
      },
      {
        "vendedor_cpf": "01370932502",
        "vendedor_nome": "CATIANE MENEZES RIBEIRO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17618376842263",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10281901155"
      },
      {
        "vendedor_cpf": "03757758110",
        "vendedor_nome": "EDUARDO CHAVES DOS SANTOS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17618528619233",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 343.20,
        "titularCpf": "06283127177"
      },
      {
        "vendedor_cpf": "01349914193",
        "vendedor_nome": "CARMINO ALVES DE FRANCA NETO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17618623078061",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "08918893108"
      },
      {
        "vendedor_cpf": "01143356136",
        "vendedor_nome": "LUCILENE SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17618658217011",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 393.93,
        "titularCpf": "04737706108"
      },
      {
        "vendedor_cpf": "08189479504",
        "vendedor_nome": "DENILSON SOUZA DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17618670186203",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 343.20,
        "titularCpf": "06103039100"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17619205221683",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 339.44,
        "titularCpf": "09443311143"
      },
      {
        "vendedor_cpf": "95490698187",
        "vendedor_nome": "PATRICIA ALCANTARA VIANA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17620069826622",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 519.37,
        "titularCpf": "96317353115"
      },
      {
        "vendedor_cpf": "01231447109",
        "vendedor_nome": "LUIS HENRIQUE MATOS BARRETO DE LIMA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17622811466249",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 2,
        "total_valor": 516.48,
        "titularCpf": "05319109113"
      },
      {
        "vendedor_cpf": "27981576172",
        "vendedor_nome": "FLAVIA GALDINO BATISTA MATOS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17623478321427",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 378.46,
        "titularCpf": "09498760110"
      },
      {
        "vendedor_cpf": "03849842150",
        "vendedor_nome": "AFONSO BATISTA DA SILVA NETO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17623482390805",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 557.86,
        "titularCpf": "07782050103"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17623602481804",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 343.20,
        "titularCpf": "05814888148"
      },
      {
        "vendedor_cpf": "08189479504",
        "vendedor_nome": "DENILSON SOUZA DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17623618748869",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 339.44,
        "titularCpf": "11258494108"
      },
      {
        "vendedor_cpf": "05339254100",
        "vendedor_nome": "FRANCISCO DIEGO DANTAS CARVALHO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17623649860630",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 434.47,
        "titularCpf": "08602402155"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17623748650172",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "18107491661"
      },
      {
        "vendedor_cpf": "02176951166",
        "vendedor_nome": "JOSE LEANDRO MARTINS BEZERRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17623781440887",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 519.37,
        "titularCpf": "01302226665"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17623856586602",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 339.44,
        "titularCpf": "11371373124"
      },
      {
        "vendedor_cpf": "69262993153",
        "vendedor_nome": "ELAINE NUNES DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17625366234448",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "07585141157"
      },
      {
        "vendedor_cpf": "61239292325",
        "vendedor_nome": "CARINA LINO BARBOSA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17625660830196",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "09378274102"
      },
      {
        "vendedor_cpf": "08136869111",
        "vendedor_nome": "GABRIEL SILVANO ALVES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17619307425684",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "08841316101"
      },
      {
        "vendedor_cpf": "72109114134",
        "vendedor_nome": "WILSON BAPTISTA DIAS FILHO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17621273770326",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "04733187173"
      },
      {
        "vendedor_cpf": "90743350120",
        "vendedor_nome": "JEDILENE BEZERRA VILAROUCA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17642704913329",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 343.20,
        "titularCpf": "06925321376"
      },
      {
        "vendedor_cpf": "92609163134",
        "vendedor_nome": "FABIO ALVES DUARTE",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17640166969129",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 434.47,
        "titularCpf": "05011975169"
      },
      {
        "vendedor_cpf": "01231447109",
        "vendedor_nome": "LUIS HENRIQUE MATOS BARRETO DE LIMA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17643530169058",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 2,
        "total_valor": 775.11,
        "titularCpf": "72376775191"
      },
      {
        "vendedor_cpf": "78195896120",
        "vendedor_nome": "ALLAN RODRIGUES DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17640140739657",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 393.93,
        "titularCpf": "73429104149"
      },
      {
        "vendedor_cpf": "80581161149",
        "vendedor_nome": "KATHIANE SOARES PEREIRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17646181452546",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10719317177"
      },
      {
        "vendedor_cpf": "01231447109",
        "vendedor_nome": "LUIS HENRIQUE MATOS BARRETO DE LIMA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17646926099564",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "08471675188"
      },
      {
        "vendedor_cpf": "60695820125",
        "vendedor_nome": "ALEXANDRE NONATO RIBEIRO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17641795363588",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 498.89,
        "titularCpf": "70100903193"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17647828196318",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 339.44,
        "titularCpf": "11235526143"
      },
      {
        "vendedor_cpf": "01852514124",
        "vendedor_nome": "THOMAS ALISSON PEREIRA CAMPOS COSTA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17647664946584",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11006429190"
      },
      {
        "vendedor_cpf": "05274823157",
        "vendedor_nome": "MATHEUS CASTRO DA CRUZ",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17646955445643",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 658.16,
        "titularCpf": "02910407136"
      },
      {
        "vendedor_cpf": "03737269106",
        "vendedor_nome": "WILLIANS TADEU DE ARAUJO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17642883143013",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11132351103"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17648030854938",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 452.27,
        "titularCpf": "02520294108"
      },
      {
        "vendedor_cpf": "07221295646",
        "vendedor_nome": "THIAGO BARBOSA DE SOUSA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17641677788316",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "08328288150"
      },
      {
        "vendedor_cpf": "70821571184",
        "vendedor_nome": "MARIA BEATRIZ DA COSTA SOUSA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17647200368441",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 378.46,
        "titularCpf": "09049230105"
      },
      {
        "vendedor_cpf": "01828367117",
        "vendedor_nome": "RAONNY RUCHY PEREIRA TAVARES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17649705627243",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 756.14,
        "titularCpf": "01207102180"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17649470954841",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10203467108"
      },
      {
        "vendedor_cpf": "06592605146",
        "vendedor_nome": "VINICIUS GONCALVES DE SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17647642904824",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 299.1,
        "titularCpf": "07566038117"
      },
      {
        "vendedor_cpf": "00299167127",
        "vendedor_nome": "STELLA JAQUELINE OLIVEIRA CHAVES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17644269700103",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 393.93,
        "titularCpf": "04228753175"
      },
      {
        "vendedor_cpf": "05121077181",
        "vendedor_nome": "STEPHANE RODRIGUES ASSUNCAO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17647664067640",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "09615863114"
      },
      {
        "vendedor_cpf": "07221295646",
        "vendedor_nome": "THIAGO BARBOSA DE SOUSA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17652337577480",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11444727176"
      },
      {
        "vendedor_cpf": "71592911153",
        "vendedor_nome": "JOAO BOSCO DE MELO PEREIRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17648585562427",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 423.84,
        "titularCpf": "03975867108"
      },
      {
        "vendedor_cpf": "05155224144",
        "vendedor_nome": "KARINA MARTINS MARQUES DE OLIVEIRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17648799913570",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 299.1,
        "titularCpf": "08142414171"
      },
      {
        "vendedor_cpf": "01188890107",
        "vendedor_nome": "ANGELICA TEIXEIRA DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17635589438028",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 378.46,
        "titularCpf": "07632008160"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17643516436900",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11356743102"
      },
      {
        "vendedor_cpf": "05438146101",
        "vendedor_nome": "KAREN THALYTA FERREIRA SANTOS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17646878140438",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "06741834109"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17652068922198",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 299.1,
        "titularCpf": "07183638170"
      },
      {
        "vendedor_cpf": "01231447109",
        "vendedor_nome": "LUIS HENRIQUE MATOS BARRETO DE LIMA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17646920414277",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11706075197"
      },
      {
        "vendedor_cpf": "05438146101",
        "vendedor_nome": "KAREN THALYTA FERREIRA SANTOS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17647747904823",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10489617107"
      },
      {
        "vendedor_cpf": "03657455108",
        "vendedor_nome": "SHEYLA CRISTINA GONCALVES DOS SANTOS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17648454436639",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "08976054113"
      },
      {
        "vendedor_cpf": "01231447109",
        "vendedor_nome": "LUIS HENRIQUE MATOS BARRETO DE LIMA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17648649933362",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10271950161"
      },
      {
        "vendedor_cpf": "72274352100",
        "vendedor_nome": "ANALU ALVES DE OLIVEIRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17648660465014",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 756.14,
        "titularCpf": "99747812134"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17647930098044",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11658734190"
      },
      {
        "vendedor_cpf": "00614279186",
        "vendedor_nome": "FRANCISCO ALBERTH DA SILVA PRADO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17648826656344",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 572.97,
        "titularCpf": "04776185105"
      },
      {
        "vendedor_cpf": "49340832191",
        "vendedor_nome": "MARIA SIMONE CERQUEIRA DE CARVALHO FRANCO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17645303698032",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 2,
        "total_valor": 841.2,
        "titularCpf": "04307529111"
      },
      {
        "vendedor_cpf": "04066347185",
        "vendedor_nome": "RENAN SOUZA DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17626041041083",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "07494363106"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17653075325654",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 498.89,
        "titularCpf": "05737490190"
      },
      {
        "vendedor_cpf": "05711768107",
        "vendedor_nome": "RENATHA LEANDRO ALMEIDA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17654547104442",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "09926832113"
      },
      {
        "vendedor_cpf": "61239292325",
        "vendedor_nome": "CARINA LINO BARBOSA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17659021682687",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 393.93,
        "titularCpf": "05841938150"
      },
      {
        "vendedor_cpf": "06800576689",
        "vendedor_nome": "ELISANGELA SOUZA DOS SANTOS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17667028908087",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10439246121"
      },
      {
        "vendedor_cpf": "87815907172",
        "vendedor_nome": "LUCIENE DA SILVA PEREIRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17664929672436",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "08550119121"
      },
      {
        "vendedor_cpf": "36776882215",
        "vendedor_nome": "EDILENE DIAS FERREIRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17668686945123",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "07725133178"
      },
      {
        "vendedor_cpf": "49340832191",
        "vendedor_nome": "MARIA SIMONE CERQUEIRA DE CARVALHO FRANCO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17667554598247",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 299.1,
        "titularCpf": "06320816198"
      },
      {
        "vendedor_cpf": "32822014515",
        "vendedor_nome": "MARIA LUZIA FARIAS DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17676512971298",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 519.37,
        "titularCpf": "01718456174"
      },
      {
        "vendedor_cpf": "01166007138",
        "vendedor_nome": "ROGERIO TORRES DE OLIVERIA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17666134048388",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 647.96,
        "titularCpf": "91148014187"
      },
      {
        "vendedor_cpf": "33352887187",
        "vendedor_nome": "GUTEMBERG LOPES DE LIMA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17677266243848",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 299.1,
        "titularCpf": "71923210106"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17671876949924",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 647.96,
        "titularCpf": "92074170149"
      },
      {
        "vendedor_cpf": "00089704169",
        "vendedor_nome": "MICHEL DA SILVA EXPEDITO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17677236398383",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 519.37,
        "titularCpf": "65143973368"
      },
      {
        "vendedor_cpf": "15484996848",
        "vendedor_nome": "LUIS SILVA NOLETO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17677129051199",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 622.36,
        "titularCpf": "07680296197"
      },
      {
        "vendedor_cpf": "71949577104",
        "vendedor_nome": "RONAN DA SOLEDADE OLIVEIRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17676599598119",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 658.16,
        "titularCpf": "03319189190"
      },
      {
        "vendedor_cpf": "72606649168",
        "vendedor_nome": "PATRICIA DUARTE DA SILVA GONCALVES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17677074748245",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11577362110"
      },
      {
        "vendedor_cpf": "04066347185",
        "vendedor_nome": "RENAN SOUSA DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17665024153290",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11390796116"
      },
      {
        "vendedor_cpf": "01574781146",
        "vendedor_nome": "GABRIELA ALVES DE JESUS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17678973827230",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "16245542456"
      },
      {
        "vendedor_cpf": "00411228102",
        "vendedor_nome": "JULIANA ALVES DE MORAES DE SANTANA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17674596757823",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 821.45,
        "titularCpf": "02886442127"
      },
      {
        "vendedor_cpf": "79447791115",
        "vendedor_nome": "EDNA PAULINO SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17670989725602",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 498.89,
        "titularCpf": "12264061146"
      },
      {
        "vendedor_cpf": "67582281420",
        "vendedor_nome": "MIRIAM FERREIRA DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17677203686942",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10074105159"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17677289777648",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 2,
        "total_valor": 813.47,
        "titularCpf": "93882955104"
      },
      {
        "vendedor_cpf": "04308200113",
        "vendedor_nome": "JAQUELINE NILZA DE OLIVEIRA MOTA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17678908211990",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 393.93,
        "titularCpf": "04708287143"
      },
      {
        "vendedor_cpf": "03657455108",
        "vendedor_nome": "SHEYLA CRISTINA GONCALVES DOS SANTOS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17677301073199",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "07603455111"
      },
      {
        "vendedor_cpf": "08189479504",
        "vendedor_nome": "DENILSON SOUZA DA SILVA",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17574487279325",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 468.38,
        "titularCpf": "70831703121"
      },
      {
        "vendedor_cpf": "03655058110",
        "vendedor_nome": "THYESSA BATISTA MEIRA DE BRITO",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17602170636936",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 914.05,
        "titularCpf": "01978389108"
      },
      {
        "vendedor_cpf": "03984582196",
        "vendedor_nome": "LAYANE DA SILVEIRA MACHADO",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17601224779803",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 482.01,
        "titularCpf": "06085189133"
      },
      {
        "vendedor_cpf": "08189479504",
        "vendedor_nome": "DENILSON SOUZA DA SILVA",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17598704574452",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 601.28,
        "titularCpf": "01240475136"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17599455847752",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 468.38,
        "titularCpf": "07624110156"
      },
      {
        "vendedor_cpf": "08189479504",
        "vendedor_nome": "DENILSON SOUZA DA SILVA",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17608275385300",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 526.31,
        "titularCpf": "09296534674"
      },
      {
        "vendedor_cpf": "70431809100",
        "vendedor_nome": "ANA WALESKA COSTA LEANDRO ARAUJO",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17633974582998",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 601.28,
        "titularCpf": "07054108620"
      },
      {
        "vendedor_cpf": "70431809100",
        "vendedor_nome": "ANA WALESKA COSTA LEANDRO ARAUJO",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17633933989465",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 601.28,
        "titularCpf": "07050201693"
      },
      {
        "vendedor_cpf": "08808736636",
        "vendedor_nome": "TAMARA ELKE PIRES MACIEL",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17630595577817",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 482.02,
        "titularCpf": "03450370146"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17653695935003",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 2,
        "total_valor": 1463.46,
        "titularCpf": "69773955168"
      },
      {
        "vendedor_cpf": "02118881177",
        "vendedor_nome": "GABRIELA AFONSO CALAZANS",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17654660440433",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 1460.73,
        "titularCpf": "83261982187"
      },
      {
        "vendedor_cpf": "70116709120",
        "vendedor_nome": "EDUARDO PEREIRA DOS SANTOS",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17655740344350",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 1044.76,
        "titularCpf": "00976778173"
      },
      {
        "vendedor_cpf": "05380948774",
        "vendedor_nome": "VICTOR LIMA MARQUES",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17574221931682",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 468.38,
        "titularCpf": "11018620419"
      },
      {
        "vendedor_cpf": "90325540187",
        "vendedor_nome": "GIVALDO DIAS BIZERRA DA NOBREGA",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17573728288124",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 468.38,
        "titularCpf": "07670183110"
      },
      {
        "vendedor_cpf": "08808736636",
        "vendedor_nome": "TAMARA ELKE PIRES MACIEL",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17571075544591",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 526.31,
        "titularCpf": "02100784137"
      },
      {
        "vendedor_cpf": "73366528168",
        "vendedor_nome": "ANTONIA DARLENE MARTINS DE ARAUJO",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17567662978810",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 601.28,
        "titularCpf": "72323817191"
      },
      {
        "vendedor_cpf": "03655058110",
        "vendedor_nome": "THYESSA BATISTA MEIRA DE BRITO",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17588288249774",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 836.82,
        "titularCpf": "05497500102"
      },
      {
        "vendedor_cpf": "02118881177",
        "vendedor_nome": "GABRIELA AFONSO CALAZANS",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17591552010249",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 526.31,
        "titularCpf": "03735730140"
      },
      {
        "vendedor_cpf": "03023897174",
        "vendedor_nome": "WAYNE ALVES SOARES DE SOUZA",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17591725446406",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 441.20,
        "titularCpf": "02998595170"
      },
      {
        "vendedor_cpf": "01004011121",
        "vendedor_nome": "MAKSUEL SOARES DE OLIVEIRA",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17594221545443",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 468.38,
        "titularCpf": "05871858139"
      },
      {
        "vendedor_cpf": "07221295646",
        "vendedor_nome": "THIAGO BARBOSA DE SOUSA",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17603875489809",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 482.01,
        "titularCpf": "05025373107"
      },
      {
        "vendedor_cpf": "01143356136",
        "vendedor_nome": "LUCILENE SILVA",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17604738592815",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 2,
        "total_valor": 822.80,
        "titularCpf": "04688224109"
      },
      {
        "vendedor_cpf": "72967560120",
        "vendedor_nome": "NILVANE SOUSA MOTA",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17613358256507",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 482.01,
        "titularCpf": "06521396129"
      },
      {
        "vendedor_cpf": "01368789625",
        "vendedor_nome": "FLAVIO FROIS DRUMOND",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17631328506746",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 482.01,
        "titularCpf": "05040935170"
      },
      {
        "vendedor_cpf": "02118881177",
        "vendedor_nome": "GABRIELA AFONSO CALAZANS",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17637430327790",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 482.01,
        "titularCpf": "03974353127"
      },
      {
        "vendedor_cpf": "03423555114",
        "vendedor_nome": "BARBARA AGUIAR VIANA",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17639949479920",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 468.38,
        "titularCpf": "06752389195"
      },
      {
        "vendedor_cpf": "02118881177",
        "vendedor_nome": "GABRIELA AFONSO CALAZANS",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17641180741732",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 526.31,
        "titularCpf": "10636266680"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17635887763737",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 482.01,
        "titularCpf": "04661886178"
      },
      {
        "vendedor_cpf": "01799937127",
        "vendedor_nome": "RONEY EMANUEL GRAÇA CAMPOS",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17641805252771",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 482.01,
        "titularCpf": "03484134160"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17648101020558",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 468.38,
        "titularCpf": "06515902131"
      },
      {
        "vendedor_cpf": "04013607174",
        "vendedor_nome": "FELIPE NILTON MOTA",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17647812539177",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 482.01,
        "titularCpf": "03364424160"
      },
      {
        "vendedor_cpf": "00239809157",
        "vendedor_nome": "IGOR FERREIRA MATTIOLI",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17653011571724",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 615.10,
        "titularCpf": "05483938186"
      },
      {
        "vendedor_cpf": "08808736636",
        "vendedor_nome": "TAMARA ELKE PIRES MACIEL",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17661640563636",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 482.01,
        "titularCpf": "04274323161"
      },
      {
        "vendedor_cpf": "80396925120",
        "vendedor_nome": "RAFAELA SILVA DANEZI",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17664131956992",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 601.28,
        "titularCpf": "96316993153"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17653063812190",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 601.28,
        "titularCpf": "00213416131"
      },
      {
        "vendedor_cpf": "80396925120",
        "vendedor_nome": "RAFAELA SILVA DANEZI",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17662439498136",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 526.31,
        "titularCpf": "02223498167"
      },
      {
        "vendedor_cpf": "72160039187",
        "vendedor_nome": "MOSERLI GOMES",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17659994181949",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 526.31,
        "titularCpf": "04786579190"
      },
      {
        "vendedor_cpf": "05206297100",
        "vendedor_nome": "CAIO PEREIRA DE MORAES",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17664426011239",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 468.38,
        "titularCpf": "06734725154"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17653974830924",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 601.28,
        "titularCpf": "01788176197"
      },
      {
        "vendedor_cpf": "72413301100",
        "vendedor_nome": "ANDREIA MOREIRA ARAUJO",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17569272221371",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 579.30,
        "titularCpf": "05634625157"
      },
      {
        "vendedor_cpf": "08189479504",
        "vendedor_nome": "DENILSON SOUZA DA SILVA",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17570736114516",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 1,
        "total_valor": 482.01,
        "titularCpf": "03484420170"
      },
      {
        "vendedor_cpf": "03984582196",
        "vendedor_nome": "LAYANE DA SILVEIRA MACHADO",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17569958298005",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-09-20",
        "beneficiarios": 2,
        "total_valor": 867.10,
        "titularCpf": "01846952107"
      },
      {
        "vendedor_cpf": "08189479504",
        "vendedor_nome": "DENILSON SOUZA DA SILVA",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17597893772511",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 458.31,
        "titularCpf": "02423026102"
      },
      {
        "vendedor_cpf": "08189479504",
        "vendedor_nome": "DENILSON SOUZA DA SILVA",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17597847994997",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 419.79,
        "titularCpf": "04406314164"
      },
      {
        "vendedor_cpf": "03655058110",
        "vendedor_nome": "THYESSA BATISTA MEIRA DE BRITO",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17592547522037",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 526.31,
        "titularCpf": "03690161142"
      },
      {
        "vendedor_cpf": "04462462556",
        "vendedor_nome": "GILMAR SOUZA DA COSTA",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17624605590075",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 482.01,
        "titularCpf": "05181847145"
      },
      {
        "vendedor_cpf": "80396925120",
        "vendedor_nome": "RAFAELA SILVA DANEZI",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17624548699653",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 2,
        "total_valor": 942.07,
        "titularCpf": "00557658152"
      },
      {
        "vendedor_cpf": "07221295646",
        "vendedor_nome": "THIAGO BARBOSA DE SOUSA",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17623536273859",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 2,
        "total_valor": 867.10,
        "titularCpf": "01682366138"
      },
      {
        "vendedor_cpf": "01436512182",
        "vendedor_nome": "MARCOS VINICIUS EMILIANO DUTRA DA SILVA",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17622035395422",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 468.38,
        "titularCpf": "06165143105"
      },
      {
        "vendedor_cpf": "27981576172",
        "vendedor_nome": "FLAVIA GALDINO BATISTA MATOS",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17618256985706",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 468.38,
        "titularCpf": "06383461184"
      },
      {
        "vendedor_cpf": "03203283174",
        "vendedor_nome": "THAIS MIRANDA RIBEIRO",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17603852923845",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 526.31,
        "titularCpf": "02313191184"
      },
      {
        "vendedor_cpf": "07221295646",
        "vendedor_nome": "THIAGO BARBOSA DE SOUSA",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17637366414175",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 601.28,
        "titularCpf": "98610759172"
      },
      {
        "vendedor_cpf": "04168075184",
        "vendedor_nome": "EDUARDA BRUNA MAIA ARAUJO",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17637519831142",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 482.01,
        "titularCpf": "04805634111"
      },
      {
        "vendedor_cpf": "18297695700",
        "vendedor_nome": "TAILANA OLIVEIRA GARCIA",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17646126497602",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 468.38,
        "titularCpf": "05950440188"
      },
      {
        "vendedor_cpf": "07221295646",
        "vendedor_nome": "THIAGO BARBOSA DE SOUSA",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17644292485450",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 482.01,
        "titularCpf": "03658039108"
      },
      {
        "vendedor_cpf": "70150745168",
        "vendedor_nome": "KASSIO TARGINO DA SILVA BEZERRA",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17652275008439",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 691.37,
        "titularCpf": "02244399109"
      },
      {
        "vendedor_cpf": "00911065245",
        "vendedor_nome": "MAYARA DA SILVA CADETE",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17659909748242",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 482.01,
        "titularCpf": "04211425102"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17661809511590",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 482.01,
        "titularCpf": "04275308140"
      },
      {
        "vendedor_cpf": "03203283174",
        "vendedor_nome": "THAIS MIRANDA RIBEIRO",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17667665407959",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 601.28,
        "titularCpf": "09978293701"
      },
      {
        "vendedor_cpf": "07221295646",
        "vendedor_nome": "THIAGO BARBOSA DE SOUSA",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17677123210136",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 482.01,
        "titularCpf": "04177007170"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17677330323467",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 601.28,
        "titularCpf": "01939473152"
      },
      {
        "vendedor_cpf": "01188072188",
        "vendedor_nome": "VICTOR DA SILVA MARTINS",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17677331729947",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 526.31,
        "titularCpf": "03198385105"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "ADVENTIST HEALTH",
        "propostaID": "17671157983569",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 601.28,
        "titularCpf": "02216626180"
      },
      {
        "vendedor_cpf": "33833672153",
        "vendedor_nome": "JOSE LUIZ LAZZAROTTO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17571046953483",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 393.93,
        "titularCpf": "05392929150"
      },
      {
        "vendedor_cpf": "05121077181",
        "vendedor_nome": "STEPHANE RODRIGUES ASSUNCAO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17591959680786",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 388.93,
        "titularCpf": "05179366151"
      },
      {
        "vendedor_cpf": "03451248123",
        "vendedor_nome": "JAQUELINE CARVALHO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17591901873948",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 294.10,
        "titularCpf": "07053822141"
      },
      {
        "vendedor_cpf": "04508279171",
        "vendedor_nome": "ANA FABIOLA ALVES DE JESUS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17591766140973",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 388.93,
        "titularCpf": "04508281150"
      },
      {
        "vendedor_cpf": "02696503508",
        "vendedor_nome": "CLÁUDIA OLIVEIRA CRISÓSTOMO ALVES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17591675185423",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 338.20,
        "titularCpf": "03126381162"
      },
      {
        "vendedor_cpf": "02609251793",
        "vendedor_nome": "IVAN RAFAGNATO CALDAS SANTOS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17591565409728",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11559051132"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17591563682187",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 493.89,
        "titularCpf": "05312658111"
      },
      {
        "vendedor_cpf": "67582281420",
        "vendedor_nome": "MIRIAM FERREIRA DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17589096810051",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "06357287105"
      },
      {
        "vendedor_cpf": "06592250186",
        "vendedor_nome": "LEANDRO VINICIUS JANUARIO LIMA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17591767945730",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 338.20,
        "titularCpf": "06592250186"
      },
      {
        "vendedor_cpf": "49035401115",
        "vendedor_nome": "WANDER PEREIRA FREITAS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17589050726876",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 393.93,
        "titularCpf": "04486712129"
      },
      {
        "vendedor_cpf": "99549123120",
        "vendedor_nome": "LUCELIA DA SILVA SANTOS BEZERRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17588999741954",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 519.37,
        "titularCpf": "99549123120"
      },
      {
        "vendedor_cpf": "05121077181",
        "vendedor_nome": "STEPHANE RODRIGUES ASSUNCAO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17588383797766",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 658.16,
        "titularCpf": "02969043173"
      },
      {
        "vendedor_cpf": "03769358392",
        "vendedor_nome": "THIAGO ALVES DOS SANTOS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17588281499358",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 339.44,
        "titularCpf": "07968402107"
      },
      {
        "vendedor_cpf": "02513482107",
        "vendedor_nome": "ARIADNE LORRANY SOUZA ANDRADE",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17588278674234",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 423.05,
        "titularCpf": "09127365182"
      },
      {
        "vendedor_cpf": "02330635109",
        "vendedor_nome": "LEANDRO FREITAS DE OLIVEIRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17574466300520",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 514.37,
        "titularCpf": "01047879107"
      },
      {
        "vendedor_cpf": "01728540160",
        "vendedor_nome": "DIEGO RODRIGUES DINIZ",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17568590429013",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10741997150"
      },
      {
        "vendedor_cpf": "01361021152",
        "vendedor_nome": "NAYARA TEIXEIRA ALVES FERREIRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17575371264731",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 2,
        "total_valor": 759.10,
        "titularCpf": "08849955189"
      },
      {
        "vendedor_cpf": "88958566191",
        "vendedor_nome": "ANARITA IANNES DE SALES DIAS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17576439555626",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 498.89,
        "titularCpf": "02669662170"
      },
      {
        "vendedor_cpf": "00926241117",
        "vendedor_nome": "DYEGO CEZAR LOPES DA CUNHA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17577097236758",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "08332793190"
      },
      {
        "vendedor_cpf": "01436512182",
        "vendedor_nome": "MARCOS VINICIUS EMILIANO DUTRA DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17581349318992",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 393.93,
        "titularCpf": "40393570860"
      },
      {
        "vendedor_cpf": "05759322605",
        "vendedor_nome": "MARCELO ALVES DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17581577403385",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 642.96,
        "titularCpf": "00896319350"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17582015074021",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 452.27,
        "titularCpf": "03405807123"
      },
      {
        "vendedor_cpf": "05711768107",
        "vendedor_nome": "RENATHA LEANDRO ALMEIDA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17582881792852",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10979515106"
      },
      {
        "vendedor_cpf": "53967879100",
        "vendedor_nome": "VALTER CLAUDIO OLIVEIRA SANTANA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17582988287311",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 2,
        "total_valor": 872.35,
        "titularCpf": "04460210169"
      },
      {
        "vendedor_cpf": "05121077181",
        "vendedor_nome": "STEPHANE RODRIGUES ASSUNCAO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17583183086851",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11717046150"
      },
      {
        "vendedor_cpf": "57324395104",
        "vendedor_nome": "MARA CRISTINA SAMPAIO DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17584047788196",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 429.47,
        "titularCpf": "08546858128"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17585442242574",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11155429150"
      },
      {
        "vendedor_cpf": "17923492115",
        "vendedor_nome": "VALDENOR JOSE DE CARVALHO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17585496364941",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 393.93,
        "titularCpf": "05179978190"
      },
      {
        "vendedor_cpf": "04221023180",
        "vendedor_nome": "MARIA CAROLINE ARAUJO MARTINS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17585596519053",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 2,
        "total_valor": 644.67,
        "titularCpf": "04221023180"
      },
      {
        "vendedor_cpf": "56403399187",
        "vendedor_nome": "PAULO CESAR RIBEIRO DE PAIVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17586307021332",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "09940806116"
      },
      {
        "vendedor_cpf": "06510554151",
        "vendedor_nome": "WESLEY FERREIRA DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17586365775648",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 1178.65,
        "titularCpf": "07287967758"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17586391934943",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "09077125175"
      },
      {
        "vendedor_cpf": "04066347185",
        "vendedor_nome": "RENAN SOUSA DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17586545311950",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 447.27,
        "titularCpf": "03101117143"
      },
      {
        "vendedor_cpf": "02696503508",
        "vendedor_nome": "CLÁUDIA OLIVEIRA CRISÓSTOMO ALVES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17586775238513",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 299.10,
        "titularCpf": "07968135150"
      },
      {
        "vendedor_cpf": "56445520120",
        "vendedor_nome": "DENISE ABOIM INGLES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17587506304684",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 519.37,
        "titularCpf": "01380156190"
      },
      {
        "vendedor_cpf": "05121077181",
        "vendedor_nome": "STEPHANE RODRIGUES ASSUNCAO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17587520319199",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "08052962129"
      },
      {
        "vendedor_cpf": "32982771187",
        "vendedor_nome": "RENALDO JUSTINO NOBREGA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17587620001140",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 343.20,
        "titularCpf": "05993681101"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17588107752833",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 447.27,
        "titularCpf": "04057933590"
      },
      {
        "vendedor_cpf": "53062582391",
        "vendedor_nome": "NAZARE DE ALMEIDA RAMOS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17588149173505",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 339.44,
        "titularCpf": "09904958173"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17588200897696",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "08490685177"
      },
      {
        "vendedor_cpf": "04889519173",
        "vendedor_nome": "RAFAEL SILVANO ALVES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17568359668230",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 388.93,
        "titularCpf": "70057942145"
      },
      {
        "vendedor_cpf": "00441324177",
        "vendedor_nome": "OSVALDO EUGENIO TOLEDO JUNIOR",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17591796770565",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 714.96,
        "titularCpf": "04128927155"
      },
      {
        "vendedor_cpf": "01852514124",
        "vendedor_nome": "THOMAS ALISSON PEREIRA CAMPOS COSTA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17595027642051",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 519.37,
        "titularCpf": "97489573149"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17604617703573",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11129855147"
      },
      {
        "vendedor_cpf": "08644575104",
        "vendedor_nome": "GIOVANNA LIMA COSTA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17597736594760",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 343.20,
        "titularCpf": "07366808105"
      },
      {
        "vendedor_cpf": "93430221153",
        "vendedor_nome": "EDUARDO MARTINS BARBOSA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17598412200924",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 294.10,
        "titularCpf": "08101735143"
      },
      {
        "vendedor_cpf": "04820536150",
        "vendedor_nome": "JECIANE UELLEN DE OLIVEIRA MARQUES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17598583168937",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "08069320150"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17599557102841",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 2,
        "total_valor": 516.48,
        "titularCpf": "10340243104"
      },
      {
        "vendedor_cpf": "03769358392",
        "vendedor_nome": "THIAGO ALVES DOS SANTOS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17599634464153",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 339.44,
        "titularCpf": "11514311178"
      },
      {
        "vendedor_cpf": "72635797153",
        "vendedor_nome": "RAFAEL MORAES MIRANDA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17600954153998",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11517067103"
      },
      {
        "vendedor_cpf": "03943973123",
        "vendedor_nome": "JULIANA COSTA SOARES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17603560299405",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 498.89,
        "titularCpf": "06916944196"
      },
      {
        "vendedor_cpf": "78396506191",
        "vendedor_nome": "MOISES RICARDO LIMA DE CARVALHO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17604725443378",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 299.10,
        "titularCpf": "07510053129"
      },
      {
        "vendedor_cpf": "92609163134",
        "vendedor_nome": "FABIO ALVES DUARTE",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17617002310947",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11339103192"
      },
      {
        "vendedor_cpf": "04141845485",
        "vendedor_nome": "HERIBERTO BATISTA MARTINS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17601198379090",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "08601977197"
      },
      {
        "vendedor_cpf": "02044061104",
        "vendedor_nome": "BARBARA BRANDAO DA SILVA SANTOS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17607081787734",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 339.44,
        "titularCpf": "10859669173"
      },
      {
        "vendedor_cpf": "61239292325",
        "vendedor_nome": "CARINA LINO BARBOSA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17607408033475",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "08883056132"
      },
      {
        "vendedor_cpf": "69262993153",
        "vendedor_nome": "ELAINE NUNES DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17609627919910",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "08443664126"
      },
      {
        "vendedor_cpf": "02609251793",
        "vendedor_nome": "IVAN RAFAGNATO CALDAS SANTOS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17610548209517",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11645763137"
      },
      {
        "vendedor_cpf": "88183980163",
        "vendedor_nome": "MARCOS ANDRE RODRIGUES DE PAIVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17605522299634",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 343.20,
        "titularCpf": "07012460148"
      },
      {
        "vendedor_cpf": "70545810167",
        "vendedor_nome": "MANOEL ALEXANDRE DE OLIVEIRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17612403882867",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 393.93,
        "titularCpf": "10270119698"
      },
      {
        "vendedor_cpf": "02352712173",
        "vendedor_nome": "GEORGE WASHINGTON COSTA JUNIOR",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17612524833562",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 447.29,
        "titularCpf": "04870227185"
      },
      {
        "vendedor_cpf": "01202434150",
        "vendedor_nome": "GILMAR BARETO BARBOSA FILHO - REAÇÃO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17614167262557",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "09264711120"
      },
      {
        "vendedor_cpf": "00467461104",
        "vendedor_nome": "FELIPE ARAUJO VELOSO ANTUNES MENEZES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17615995113278",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 2,
        "total_valor": 1288.27,
        "titularCpf": "02634307152"
      },
      {
        "vendedor_cpf": "02176951166",
        "vendedor_nome": "JOSE LEANDRO MARTINS BEZERRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17616664190310",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 519.37,
        "titularCpf": "72412755191"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17616865770566",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11742731198"
      },
      {
        "vendedor_cpf": "05121077181",
        "vendedor_nome": "STEPHANE RODRIGUES ASSUNCAO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17616932981090",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "08215899110"
      },
      {
        "vendedor_cpf": "78195896120",
        "vendedor_nome": "ALLAN RODRIGUES DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17612568618976",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 498.89,
        "titularCpf": "04802984162"
      },
      {
        "vendedor_cpf": "55369057168",
        "vendedor_nome": "CARMEM LUCIA SANTOS ALMEIDA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17622923202701",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "71857166167"
      },
      {
        "vendedor_cpf": "55369057168",
        "vendedor_nome": "CARMEM LUCIA SANTOS ALMEIDA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17623446215491",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "09895304188"
      },
      {
        "vendedor_cpf": "00801570174",
        "vendedor_nome": "MICHELE CRISTINA DO NASCIMENTO LIMA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17628064126836",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 452.27,
        "titularCpf": "04225654150"
      },
      {
        "vendedor_cpf": "55369057168",
        "vendedor_nome": "CARMEM LUCIA SANTOS ALMEIDA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17624799411333",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 2,
        "total_valor": 516.48,
        "titularCpf": "08858486161"
      },
      {
        "vendedor_cpf": "03729039164",
        "vendedor_nome": "CARLOS RENNE DE OLIVEIRA LIRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17634034630041",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 378.46,
        "titularCpf": "10956922163"
      },
      {
        "vendedor_cpf": "01231447109",
        "vendedor_nome": "LUIS HENRIQUE MATOS BARRETO DE LIMA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17629756165439",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10982357117"
      },
      {
        "vendedor_cpf": "01462383114",
        "vendedor_nome": "ELIAS FREITAS DA SILVA JUNIOR",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17635708289469",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 2,
        "total_valor": 516.48,
        "titularCpf": "08719890184"
      },
      {
        "vendedor_cpf": "99195062149",
        "vendedor_nome": "FABIANA CRISTINA LIBERAL CARVALHO BATISTA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17634946665050",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 2,
        "total_valor": 598.94,
        "titularCpf": "07557476158"
      },
      {
        "vendedor_cpf": "97282561168",
        "vendedor_nome": "PRISCILA DE SOUZA LUCENA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17639933583631",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 572.97,
        "titularCpf": "03390297146"
      },
      {
        "vendedor_cpf": "01231447109",
        "vendedor_nome": "LUIS HENRIQUE MATOS BARRETO DE LIMA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17637429214556",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 2,
        "total_valor": 549.84,
        "titularCpf": "07683841170"
      },
      {
        "vendedor_cpf": "03178237100",
        "vendedor_nome": "MATEUS CASSEB FERRAZ SAAVEDRA DIAS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17629042948467",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 338.20,
        "titularCpf": "06463165166"
      },
      {
        "vendedor_cpf": "02696503508",
        "vendedor_nome": "CLÁUDIA OLIVEIRA CRISÓSTOMO ALVES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17635842659150",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 294.10,
        "titularCpf": "09078971185"
      },
      {
        "vendedor_cpf": "61239292325",
        "vendedor_nome": "CARINA LINO BARBOSA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17632223047246",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 378.46,
        "titularCpf": "08427147155"
      },
      {
        "vendedor_cpf": "17923492115",
        "vendedor_nome": "VALDENOR JOSE DE CARVALHO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17632056450003",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11745803130"
      },
      {
        "vendedor_cpf": "07221295646",
        "vendedor_nome": "THIAGO BARBOSA DE SOUSA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17640959692730",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 294.10,
        "titularCpf": "07664976154"
      },
      {
        "vendedor_cpf": "93224958120",
        "vendedor_nome": "JOICE RODRIGUES DE LIMA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17640107046642",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "09008524104"
      },
      {
        "vendedor_cpf": "71831509172",
        "vendedor_nome": "ANA CAROLINA CAMPOS DE LISCIO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17634050601799",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 3,
        "total_valor": 1030.85,
        "titularCpf": "00870537130"
      },
      {
        "vendedor_cpf": "03203283174",
        "vendedor_nome": "THAIS MIRANDA RIBEIRO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17642618007310",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "09807617197"
      },
      {
        "vendedor_cpf": "06592605146",
        "vendedor_nome": "VINICIUS GONCALVES DE SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17640774591651",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 2,
        "total_valor": 516.48,
        "titularCpf": "07912636145"
      },
      {
        "vendedor_cpf": "60489766153",
        "vendedor_nome": "ADRIANA WERNER CANTAGALO COUTO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17641820204653",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 447.27,
        "titularCpf": "02072095107"
      },
      {
        "vendedor_cpf": "71949577104",
        "vendedor_nome": "RONAN DA SOLEDADE OLIVEIRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17640864026762",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 339.44,
        "titularCpf": "08664449120"
      },
      {
        "vendedor_cpf": "00509057160",
        "vendedor_nome": "JUNIO BATISTA SANTOS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17640825286510",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 343.20,
        "titularCpf": "05143889197"
      },
      {
        "vendedor_cpf": "49340832191",
        "vendedor_nome": "MARIA SIMONE CERQUEIRA DE CARVALHO FRANCO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17640882106132",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "04820463179"
      },
      {
        "vendedor_cpf": "01188890107",
        "vendedor_nome": "ANGELICA TEIXEIRA DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17640766701639",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "08987781151"
      },
      {
        "vendedor_cpf": "73378208104",
        "vendedor_nome": "RODRIGO OPA ASPIN CABRAL",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17641657240359",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11238835139"
      },
      {
        "vendedor_cpf": "03603025130",
        "vendedor_nome": "ANA BEATRIZ DE SOUZA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17622679855854",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 2,
        "total_valor": 770.11,
        "titularCpf": "00993965130"
      },
      {
        "vendedor_cpf": "90325540187",
        "vendedor_nome": "GIVALDO DIAS BIZERRA DA NOBREGA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17641763285143",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 378.46,
        "titularCpf": "07615585198"
      },
      {
        "vendedor_cpf": "94543054172",
        "vendedor_nome": "SERGIO PEREIRA ALVES FERREIRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17621800352250",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "07833706108"
      },
      {
        "vendedor_cpf": "04308200113",
        "vendedor_nome": "JAQUELINE NILZA DE OLIVEIRA MOTA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17624565287754",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11620909103"
      },
      {
        "vendedor_cpf": "04525733195",
        "vendedor_nome": "NATALIA DE SOUSA POMPEU",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17624657022785",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11743168101"
      },
      {
        "vendedor_cpf": "42822971153",
        "vendedor_nome": "WILLIA MARCIA ALEXANDRE LIRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17625334904170",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 343.20,
        "titularCpf": "07255585124"
      },
      {
        "vendedor_cpf": "01193374103",
        "vendedor_nome": "ADEMILSON DA SILVA PEREIRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17628022987301",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10231260105"
      },
      {
        "vendedor_cpf": "78256100168",
        "vendedor_nome": "RAQUEL QUINTO DA COSTA RIBEIRO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17628081725665",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 572.97,
        "titularCpf": "04192197146"
      },
      {
        "vendedor_cpf": "61239292325",
        "vendedor_nome": "CARINA LINO BARBOSA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17628803945573",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 471.82,
        "titularCpf": "06957109151"
      },
      {
        "vendedor_cpf": "54013305100",
        "vendedor_nome": "ANGELA AMARAL FERREIRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17629660505060",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 393.93,
        "titularCpf": "05061201124"
      },
      {
        "vendedor_cpf": "53967879100",
        "vendedor_nome": "VALTER CLAUDIO OLIVEIRA SANTANA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17629731964268",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 756.14,
        "titularCpf": "72520752149"
      },
      {
        "vendedor_cpf": "03188962738",
        "vendedor_nome": "RICARDO FERNANDES LEMOS PRATA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17648891301133",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 393.93,
        "titularCpf": "04406328114"
      },
      {
        "vendedor_cpf": "99549123120",
        "vendedor_nome": "LUCELIA DA SILVA SANTOS BEZERRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17654129437802",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 2,
        "total_valor": 649.67,
        "titularCpf": "08195707106"
      },
      {
        "vendedor_cpf": "01166007138",
        "vendedor_nome": "ROGERIO TORRES DE OLIVERIA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17649686704291",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 343.20,
        "titularCpf": "06910209141"
      },
      {
        "vendedor_cpf": "56441487187",
        "vendedor_nome": "RUBEM SOUSA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17654073038703",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "09629738155"
      },
      {
        "vendedor_cpf": "75706342504",
        "vendedor_nome": "AGNALDO GOMES DA ROCHA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17656398130241",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10756820103"
      },
      {
        "vendedor_cpf": "70097440175",
        "vendedor_nome": "YARA LORRANY ALVES DE JESUS",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17659174084835",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 343.20,
        "titularCpf": "70001909142"
      },
      {
        "vendedor_cpf": "71831509172",
        "vendedor_nome": "ANA CAROLINA CAMPOS DE LISCIO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17660663349115",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 647.96,
        "titularCpf": "86814443104"
      },
      {
        "vendedor_cpf": "72327219191",
        "vendedor_nome": "REINALDO GOMES DE ALMEIDA FILHO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17660782419493",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 821.45,
        "titularCpf": "02309706132"
      },
      {
        "vendedor_cpf": "85912611191",
        "vendedor_nome": "CRISTIANE FIRMIANO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17655703072482",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 343.20,
        "titularCpf": "06988760164"
      },
      {
        "vendedor_cpf": "56403399187",
        "vendedor_nome": "PAULO CESAR RIBEIRO DE PAIVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17647986906812",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 938.92,
        "titularCpf": "69710279149"
      },
      {
        "vendedor_cpf": "04038883108",
        "vendedor_nome": "WELINGTON DE SOUZA CRUZ",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17660860320848",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 294.10,
        "titularCpf": "04727204142"
      },
      {
        "vendedor_cpf": "00972260170",
        "vendedor_nome": "MARIA DO SOCORRO LINHARES ARAUJO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17659083525908",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 498.89,
        "titularCpf": "07428825199"
      },
      {
        "vendedor_cpf": "04476091571",
        "vendedor_nome": "FELIPE FLORENCIO DE LIMA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17661569127650",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 393.93,
        "titularCpf": "04979302181"
      },
      {
        "vendedor_cpf": "03201428175",
        "vendedor_nome": "JUNIO GONÇALVES DE SOUZA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17662405083561",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 393.93,
        "titularCpf": "05398735195"
      },
      {
        "vendedor_cpf": "05044272108",
        "vendedor_nome": "ISABELA RAMOS NOBREGA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17652991788243",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11694107159"
      },
      {
        "vendedor_cpf": "03203283174",
        "vendedor_nome": "THAIS MIRANDA RIBEIRO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17648771133681",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 378.46,
        "titularCpf": "09754372160"
      },
      {
        "vendedor_cpf": "02532464151",
        "vendedor_nome": "NAYARA CERQUEIRA ANDRADE",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17657953065304",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10510381111"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17648820328176",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 2,
        "total_valor": 703.01,
        "titularCpf": "05264821500"
      },
      {
        "vendedor_cpf": "04066347185",
        "vendedor_nome": "RENAN SOUSA DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17664099233160",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11559848111"
      },
      {
        "vendedor_cpf": "01224551184",
        "vendedor_nome": "MARCIA DE ARAUJO ALVES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17660763833998",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 299.10,
        "titularCpf": "06116431119"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17658905724359",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 294.10,
        "titularCpf": "08738336197"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17659018859325",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 294.10,
        "titularCpf": "07646515108"
      },
      {
        "vendedor_cpf": "01938644107",
        "vendedor_nome": "JULIA GREICIELE ALVES DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17659827383626",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10349764190"
      },
      {
        "vendedor_cpf": "02464178110",
        "vendedor_nome": "ROYGERS PALHARES RIBEIRO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17664437662947",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10545485100"
      },
      {
        "vendedor_cpf": "02532464151",
        "vendedor_nome": "NAYARA CERQUEIRA ANDRADE",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17652906199501",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10614910137"
      },
      {
        "vendedor_cpf": "01188890107",
        "vendedor_nome": "ANGELICA TEIXEIRA DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17655660740238",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "09910330199"
      },
      {
        "vendedor_cpf": "01169820123",
        "vendedor_nome": "LUCAS MIRANDA FEITOZA DA SILVA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17664311637853",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "05862505148"
      },
      {
        "vendedor_cpf": "72606649168",
        "vendedor_nome": "PATRICIA DUARTE DA SILVA GONCALVES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17658011264855",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "09967777176"
      },
      {
        "vendedor_cpf": "04013607174",
        "vendedor_nome": "FELIPE NILTON MOTA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17660655419735",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 617.36,
        "titularCpf": "06610766100"
      },
      {
        "vendedor_cpf": "04778137124",
        "vendedor_nome": "NATANAEL SAULO DA SILVA PEREIRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17653097131504",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "10757843107"
      },
      {
        "vendedor_cpf": "03046484186",
        "vendedor_nome": "YOLANDA CRISTINA DE ALMEIDA BELEM",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17661815922156",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 2,
        "total_valor": 516.48,
        "titularCpf": "09136191167"
      },
      {
        "vendedor_cpf": "72583240110",
        "vendedor_nome": "CLEITON DE SOUSA TOME",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17665149254027",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 343.20,
        "titularCpf": "12191367780"
      },
      {
        "vendedor_cpf": "87815907172",
        "vendedor_nome": "LUCIENE DA SILVA PEREIRA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17662572987743",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "09520519157"
      },
      {
        "vendedor_cpf": "71419993100",
        "vendedor_nome": "JAIRO GOMES DE SOUZA",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17665981129719",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "07769424178"
      },
      {
        "vendedor_cpf": "05121077181",
        "vendedor_nome": "STEPHANE RODRIGUES ASSUNCAO",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17660937812339",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 260.74,
        "titularCpf": "11332966101"
      },
      {
        "vendedor_cpf": "01954742100",
        "vendedor_nome": "RENATA MENDES GONCALVES",
        "operadora_nome": "NOVA SAÚDE",
        "propostaID": "17661518733841",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 572.97,
        "titularCpf": "02652229150"
      },
      {
        "vendedor_cpf": "04965311159",
        "vendedor_nome": "MARIA EDUARDA DE MELO SOUZA",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17582965740024",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-01",
        "beneficiarios": 1,
        "total_valor": 463.33,
        "titularCpf": "05493438143"
      },
      {
        "vendedor_cpf": "72744251100",
        "vendedor_nome": "LUIZ ANTONIO FERREIRA CARVALHO",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17605511541341",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 652.91,
        "titularCpf": "01061725146"
      },
      {
        "vendedor_cpf": "99195062149",
        "vendedor_nome": "FABIANA CRISTINA LIBERAL CARVALHO BATISTA",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17598596691242",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-01",
        "beneficiarios": 1,
        "total_valor": 396.58,
        "titularCpf": "05206283142"
      },
      {
        "vendedor_cpf": "56403399187",
        "vendedor_nome": "PAULO CESAR RIBEIRO DE PAIVA",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17631317356088",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 617.67,
        "titularCpf": "95707425187"
      },
      {
        "vendedor_cpf": "71949577104",
        "vendedor_nome": "RONAN DA SOLEDADE OLIVEIRA",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17634252608914",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-01",
        "beneficiarios": 1,
        "total_valor": 455.31,
        "titularCpf": "06295329314"
      },
      {
        "vendedor_cpf": "99195062149",
        "vendedor_nome": "FABIANA CRISTINA LIBERAL CARVALHO BATISTA SILVA",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17646264195411",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 752.64,
        "titularCpf": "71598219120"
      },
      {
        "vendedor_cpf": "94436924149",
        "vendedor_nome": "POLLYANNA AIRES QUINTELA",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17652168184995",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 388.37,
        "titularCpf": "02684495114"
      },
      {
        "vendedor_cpf": "71949577104",
        "vendedor_nome": "RONAN DA SOLEDADE OLIVEIRA",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17655598344022",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-01",
        "beneficiarios": 1,
        "total_valor": 546.95,
        "titularCpf": "03852480167"
      },
      {
        "vendedor_cpf": "05219231154",
        "vendedor_nome": "DHEINNY FATIMA VIANA DOS REIS",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17581288131544",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 1,
        "total_valor": 404.00,
        "titularCpf": "02315334110"
      },
      {
        "vendedor_cpf": "24303771368",
        "vendedor_nome": "ANA LUCIA DOS SANTOS SOARES",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17586598037652",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-10",
        "beneficiarios": 2,
        "total_valor": 1590.58,
        "titularCpf": "63574780168"
      },
      {
        "vendedor_cpf": "08136869111",
        "vendedor_nome": "GABRIEL SILVANO ALVES",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17607988490632",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 455.31,
        "titularCpf": "70185230105"
      },
      {
        "vendedor_cpf": "03332749110",
        "vendedor_nome": "ERICA THAIS FIGUEIREDO SILVA",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17610965541048",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-10",
        "beneficiarios": 1,
        "total_valor": 388.37,
        "titularCpf": "04892815160"
      },
      {
        "vendedor_cpf": "55369057168",
        "vendedor_nome": "CARMEM LUCIA SANTOS ALMEIDA",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17630563228614",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 546.95,
        "titularCpf": "01538864126"
      },
      {
        "vendedor_cpf": "94436924149",
        "vendedor_nome": "POLLYANNA AIRES QUINTELA",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17628169265016",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 357.17,
        "titularCpf": "04109913179"
      },
      {
        "vendedor_cpf": "71949577104",
        "vendedor_nome": "RONAN DA SOLEDADE OLIVEIRA",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17631729330012",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 455.31,
        "titularCpf": "04157852192"
      },
      {
        "vendedor_cpf": "01231447109",
        "vendedor_nome": "LUIS HENRIQUE MATOS BARRETO DE LIMA",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17640038840089",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 4,
        "total_valor": 2173.68,
        "titularCpf": "03045017193"
      },
      {
        "vendedor_cpf": "65863771100",
        "vendedor_nome": "JIVAGO BENTO",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17640062385702",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 546.95,
        "titularCpf": "60478437358"
      },
      {
        "vendedor_cpf": "53874706168",
        "vendedor_nome": "PAULO CARVALHO",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17633051170191",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 617.67,
        "titularCpf": "71712747134"
      },
      {
        "vendedor_cpf": "88753999134",
        "vendedor_nome": "Maria Dulcicleia Costa de Souza de Lucena",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17628602025433",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 294.90,
        "titularCpf": "07635845179"
      },
      {
        "vendedor_cpf": "05121077181",
        "vendedor_nome": "STEPHANE RODRIGUES ASSUNCAO",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17623798904294",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-10",
        "beneficiarios": 1,
        "total_valor": 463.33,
        "titularCpf": "06381032154"
      },
      {
        "vendedor_cpf": "01436512182",
        "vendedor_nome": "MARCOS VINICIUS EMILIANO DUTRA DA SILVA",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17655693718480",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 546.95,
        "titularCpf": "09356349673"
      },
      {
        "vendedor_cpf": "72583240110",
        "vendedor_nome": "CLEITON DE SOUSA TOME",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17660774859905",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 455.31,
        "titularCpf": "05743051143"
      },
      {
        "vendedor_cpf": "87612143100",
        "vendedor_nome": "POLIANA BARBOSA DE OLIVEIRA",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17664120163677",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-10",
        "beneficiarios": 1,
        "total_valor": 455.31,
        "titularCpf": "03826981189"
      },
      {
        "vendedor_cpf": "51614111120",
        "vendedor_nome": "LIDIOMAR ARCANJO DE NOVAIS",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17579733643639",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-10-20",
        "beneficiarios": 1,
        "total_valor": 463.33,
        "titularCpf": "06838043165"
      },
      {
        "vendedor_cpf": "90325540187",
        "vendedor_nome": "GIVALDO DIAS BIZERRA DA NOBREGA",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17621799912124",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 752.64,
        "titularCpf": "88570029187"
      },
      {
        "vendedor_cpf": "72583240110",
        "vendedor_nome": "CLEITON DE SOUSA TOME",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17617785867733",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 345.52,
        "titularCpf": "06376724370"
      },
      {
        "vendedor_cpf": "71949577104",
        "vendedor_nome": "RONAN DA SOLEDADE OLIVEIRA",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17616559214339",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-11-20",
        "beneficiarios": 1,
        "total_valor": 388.37,
        "titularCpf": "07220802129"
      },
      {
        "vendedor_cpf": "01013643186",
        "vendedor_nome": "CINTHYA WERCELENS SILVA",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17643753898266",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 357.17,
        "titularCpf": "07017968123"
      },
      {
        "vendedor_cpf": "36606756871",
        "vendedor_nome": "ALINE DE OLIVEIRA TEODORO TEIXEIRA",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17649659155368",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 388.37,
        "titularCpf": "05308110140"
      },
      {
        "vendedor_cpf": "14796180125",
        "vendedor_nome": "GILMAR FERREIRA ARANTES",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17648766461024",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 463.33,
        "titularCpf": "02219429121"
      },
      {
        "vendedor_cpf": "07696553194",
        "vendedor_nome": "ALVARO JOSE DE SOUSA JUNIOR",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17646154724208",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 271.30,
        "titularCpf": "07718509133"
      },
      {
        "vendedor_cpf": "41067355120",
        "vendedor_nome": "CLAUDIA FERNANDES LOPES RODRIGUES",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17648498723919",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2025-12-20",
        "beneficiarios": 1,
        "total_valor": 463.33,
        "titularCpf": "02706392258"
      },
      {
        "vendedor_cpf": "47857617504",
        "vendedor_nome": "VANESSA OLIVEIRA GONÇALVES",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17674027138837",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 455.31,
        "titularCpf": "06434882190"
      },
      {
        "vendedor_cpf": "02854504178",
        "vendedor_nome": "JOSE ELIAS DA SILVA JUNIOR",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17676421760065",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 388.37,
        "titularCpf": "03585129137"
      },
      {
        "vendedor_cpf": "72583240110",
        "vendedor_nome": "CLEITON DE SOUSA TOME",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17678021560047",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 388.37,
        "titularCpf": "02279234130"
      },
      {
        "vendedor_cpf": "72583240110",
        "vendedor_nome": "CLEITON DE SOUSA TOME",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17678050463143",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 388.37,
        "titularCpf": "05074632188"
      },
      {
        "vendedor_cpf": "67582281420",
        "vendedor_nome": "MIRIAM FERREIRA DA SILVA",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17652013523385",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 388.37,
        "titularCpf": "06254161125"
      },
      {
        "vendedor_cpf": "00197445101",
        "vendedor_nome": "CARMINDA DE OLIVEIRA NETO",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17670365299877",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 2,
        "total_valor": 718.06,
        "titularCpf": "06416038196"
      },
      {
        "vendedor_cpf": "73157082191",
        "vendedor_nome": "ERICA CHRISTINE DE PADUA ANDRADE",
        "operadora_nome": "EVO SAÚDE",
        "propostaID": "17667850964777",
        "status": "implantado",
        "contrato": "ad",
        "date_vigencia": "2026-01-20",
        "beneficiarios": 1,
        "total_valor": 388.37,
        "titularCpf": "06259579110"
      }
    ]

    if (Array.isArray(arr)) diag.propostas_total_api += arr.length;

    for (const it of (arr || [])) {
      const vendedorCpfRaw = it?.vendedor_cpf;
      const vendedorCpfDebug = (vendedorCpfRaw || '').replace(/\D/g, '');
      const isAlvo = vendedorCpfDebug === CPF_DEBUG;

      const vendedorCpf = normDigits(it?.vendedor_cpf);
      if (!vendedorCpf) { diag.drop_sem_cpf_vendedor++; continue; }
      if (this._isExcluido(vendedorCpf)) { diag.drop_excluido++; continue; }

      // supervisor obrigatório + exato
      const supNomeRaw = null;
      const supNome = '';
      const supIsNullish = supNomeRaw == null || supNome === '';

      if (supIsNullish) {
        if (!this.allowNullSupervisor) {
          diag.drop_supervisor++;
          continue;
        }
      } else {
        if (!whitelistSuper.has(supNome)) {
          diag.drop_supervisor++;
          continue;
        }
      }

      // operadora obrigatória + exata
      const operadoraNome = String(it?.operadora_nome || '').trim();
      if (!operadoraNome || !whitelistOper.has(operadoraNome)) { if (isAlvo) console.log('[DNV][DROP] operadora', it?.propostaID, operadoraNome); diag.drop_operadora++; continue; }

      // filtros status/contrato/produto
      const st = toLower(it?.status);
      if (banStatus.has(st)) { if (isAlvo) console.log('[DNV][DROP] status', it?.propostaID, st); diag.drop_status++; continue; }

      if (!(toLower(it?.contrato) === 'ad')) { if (isAlvo) console.log('[DNV][DROP] contrato!=AD', it?.propostaID, it?.contrato); diag.drop_cont_prod++; continue; }

      // vigência: deve existir na tabela (modo estrito)
      const vigDia = toYMD(it?.date_vigencia);
      if (!vigDia) { if (isAlvo) console.log('[DNV][DROP] sem vigencia', it?.propostaID); diag.drop_sem_vigencia++; continue; }
      if (!diaParaGrupo.has(vigDia)) { if (isAlvo) console.log('[DNV][DROP] vig_nao_mapeada', it?.propostaID, vigDia); diag.drop_vig_nao_mapeada++; continue; }
      const grupo = String(diaParaGrupo.get(vigDia)); // YYYY-MM do cadastro

      // beneficiários > 0
      const beneficiarios = Number(it?.beneficiarios) || 0;
      if (beneficiarios <= 0) { diag.drop_beneficiarios++; continue; }

      const totalValorCent = parseMoneyToCents(it?.total_valor);
      const vendedorNome = String(it?.vendedor_nome || '').trim();

      // >>> NOVO: titularCpf a partir de titularCpf
      let titularCpf = normDigits(it?.titularCpf);

      items.push({
        propostaID: it?.propostaID, // auditoria
        vendedorCpf,
        vendedorNome,
        vigDia,
        vigMes: grupo, // vem do cadastro
        beneficiarios,
        totalValorCent,
        operadoraNome,
        supNome: null,
        titularCpf,
      });
      diag.kept++;
    };

    /////////////// end propostas json //////////////////////////////////////

    if (process.env.RANKING_DEBUG_DNV === '1') {
      console.log('[DNV][DIAG]', JSON.stringify(diag));
    }

    return { items, diag };
  }

  // -------- resolve contrato por CPF (match ESTRITO por numeroProposta) --------
  async _resolverContratoCodigoPorCpf(cpf, opts = {}) {
    const c = normDigits(cpf);
    const numeroPropostaAlvoRaw = opts.numeroProposta ? String(opts.numeroProposta).trim() : null;
    if (!c || !numeroPropostaAlvoRaw) return null;

    const alvo = normId(numeroPropostaAlvoRaw);

    try {
      const resp = await axiosCfg.https_digital.get("/contrato/procurarPorCpfTitular", {
        params: { cpf: c },
        validateStatus: s => (s >= 200 && s < 300) || s === 404 || s === 400,
      });
      if (!(resp.status >= 200 && resp.status < 300)) return null;

      const arr = Array.isArray(resp.data) ? resp.data : (resp.data ? [resp.data] : []);
      if (!arr.length) return null;

      const chosen = arr.find(it => normId(it?.numeroProposta) === alvo);
      if (!chosen) return null;

      const codigo =
        chosen?.codigo ?? chosen?.codigo_do_contrato ?? chosen?.codigoContrato ?? chosen?.contrato ?? null;

      const statusNome = String(chosen?.statusContrato?.nome || '').trim() || null;
      if (!chosen && process.env.RANKING_DEBUG_CONTRATO === '1') {
        const lista = arr.map(x => ({
          codigo: x?.codigo || x?.codigo_do_contrato || x?.codigoContrato || x?.contrato,
          numeroProposta: String(x?.numeroProposta || '').trim(),
          status: x?.statusContrato?.nome
        }));
        console.log('[DIGITAL][NO-MATCH]', { cpf: c, numeroPropostaAlvo: numeroPropostaAlvo, contratos: lista });
      }
      return codigo ? { codigo: String(codigo).trim(), statusNome } : null;
    } catch {
      return null;
    }
  }

  // ------------------ pipeline principal ------------------
  async gerarEPersistir({ inicio, fim }) {
    if (!inicio || !fim) throw new Error("Parâmetros 'inicio' e 'fim' são obrigatórios");

    // carregar configurações
    await this._loadExcluidosSet();
    const whitelistSuper = await this._loadSupervisoresSet();
    const whitelistOper = await this._loadOperadorasSet();

    // Vigências/grupos válidos (modo estrito, sem filtrar por período)
    const { diaParaGrupo, diasValidosNoPeriodo } = await this._carregarVigenciasValidas();
    if (diasValidosNoPeriodo.length === 0) {
      throw new Error("Não há vigências ativas configuradas (tabela rk_vig_validas).");
    }

    // Coleta vendidas (DNV)
    const { items: dnvRows, diag: dnvDiag } = await this._coletarVendidasDNV({ inicio, fim, diaParaGrupo, whitelistSuper, whitelistOper });

    // >>> MOD: confirmação por LINHA (proposta) com limiter
    const limiter = withRateLimit({ concurrency: this.paralelo, minDelayMs: 500 });
    const diagContrato = { total_rows: dnvRows.length, contratos_found: 0, pagos_true: 0, pagos_false: 0 };

    await Promise.all(dnvRows.map(row => limiter(async () => {
      const titularCpf = normDigits(row.titularCpf);
      const numeroProposta = String(row.propostaID || '').trim() || null;

      let contratoCodigo = null;
      let statusContratoNome = null;

      if (titularCpf) {
        const res = await this._resolverContratoCodigoPorCpf(titularCpf, { numeroProposta });
        if (res?.codigo) {
          contratoCodigo = res.codigo;
          statusContratoNome = res.statusNome || null;
        }
      }

      if (!titularCpf && process.env.RANKING_DEBUG_CONTRATO === '1') {
        console.log('[RANK][WARN] linha sem titularCpf/contratante_cpf para proposta', numeroProposta);
      }

      // flags na linha
      row._contratoCodigo = contratoCodigo || null;       // código do contrato (se achou)
      row._ativo = String(statusContratoNome || '').toLowerCase() === 'ativo'; // ativo só pelo status do contrato
      row._pago = false;
      row._foundContrato = !!contratoCodigo;

      if (row._foundContrato) {
        diagContrato.contratos_found++;
        try {
          row._pago = await this._getContratoPagoComCache(contratoCodigo);
        } catch { row._pago = false; }
        if (row._pago) diagContrato.pagos_true++; else diagContrato.pagos_false++;
      } else {
        diagContrato.pagos_false++; // sem contrato => não pago
      }

      if (DEBUG_CONTRATO && debugMatchCpf(row.vendedorCpf)) {
        console.log('[RANK][DEBUG] LINHA', {
          cpfCorretor: row.vendedorCpf,
          titularCpf,
          numeroProposta,
          contratoCodigo: row._contratoCodigo,
          ativo: row._ativo,
          pago: row._pago
        });
      }
    })));

    if (DEBUG_CONTRATO) {
      console.log('[RANK][DEBUG][RESUMO_CONTRATO_LINHA]', diagContrato);
    }

    // ============================================================
    // >>> NOVO: GERAR CSV POR CPF/MÊS E SALVAR NO SERVIDOR <<<
    // ============================================================
    try {
      const { exportDebugCsv } = require("../utils/exportDebug.util");

      console.log("[RANK][DEBUG] Gerando CSVs por CPF/Mês...");

      const grupos = {}; // chave = cpf_mes

      for (const r of dnvRows) {
        if (!r.vendedorCpf || !r.vigMes) continue;

        const cpf = r.vendedorCpf.replace(/\D/g, "");
        const mes = r.vigMes;
        const chave = `${cpf}_${mes}`;

        if (!grupos[chave]) grupos[chave] = { cpf, mes, rows: [] };
        grupos[chave].rows.push(r);
      }

      for (const chave of Object.keys(grupos)) {
        const { cpf, mes, rows } = grupos[chave];
        try {
          await exportDebugCsv(cpf, mes, rows);
        } catch (err) {
          console.error("[EXPORT DEBUG] Falha ao gerar CSV para", cpf, mes, err);
        }
      }

      console.log("[RANK][DEBUG] CSVs por CPF/Mês gerados com sucesso!");
    } catch (err) {
      console.error("[RANK][DEBUG] Erro ao gerar CSVs por CPF/Mês:", err);
    }
    // ============================================================

    if (DEBUG_CONTRATO) {
      const cpfAlvo = '03046484186';
      const mesAlvo = '2025-10                                                                                                                                                                                             ';
      const rowsAlvo = dnvRows.filter(r =>
        r.vendedorCpf && r.vendedorCpf.replace(/\D/g, '') === cpfAlvo &&
        r.vigMes === mesAlvo
      );
      const resumo = rowsAlvo.map(r => ({
        propostaID: r.propostaID,
        vigDia: r.vigDia,
        beneficiarios: r.beneficiarios,
        _foundContrato: r._foundContrato,
        _contratoCodigo: r._contratoCodigo,
        _ativo: r._ativo,
        _pago: r._pago,
        titularCpf: r.titularCpf,
        operadora: r.operadoraNome,
        sup: r.supNome,
      }));
      console.log('[RANK][DEBUG] DIAG CPF/MES', cpfAlvo, mesAlvo, resumo);
      const somaVidasPago = rowsAlvo.reduce((a, x) => a + (x._pago ? (x.beneficiarios || 0) : 0), 0);
      const somaVidasAtivo = rowsAlvo.reduce((a, x) => a + (x._ativo ? (x.beneficiarios || 0) : 0), 0);
      console.log('[RANK][DEBUG] SOMAS', { confirmadas: somaVidasPago, ativas: somaVidasAtivo });
    }

    // ===== Buckets por CPF (Geral) e por Operadora =====
    const byCpfDia = new Map();       // cpf -> Map(ymd -> { rows, vidas, valor })
    const byCpfGrupo = new Map();     // cpf -> Map(grupo -> { rows, vidas, valor })
    const byCpfValorTotal = new Map(); // cpf -> total valor cent (todas as linhas)

    const opCpfDia = new Map();       // operadora -> Map(cpf -> Map(ymd -> { rows, vidas, valor }))
    const opCpfGrupo = new Map();     // operadora -> Map(cpf -> Map(grupo -> { rows, vidas, valor }))
    const opCpfValorTotal = new Map(); // operadora -> Map(cpf -> total valor cent)

    for (const r of dnvRows) {
      const { vendedorCpf: cpf, vigDia, vigMes, operadoraNome: op } = r;

      // ===== Geral =====
      // DIA
      let mapDia = byCpfDia.get(cpf);
      if (!mapDia) { mapDia = new Map(); byCpfDia.set(cpf, mapDia); }
      let bDia = mapDia.get(vigDia);
      if (!bDia) { bDia = { rows: [], valor: 0, vidas: 0 }; mapDia.set(vigDia, bDia); }
      bDia.rows.push(r);
      bDia.vidas += r.beneficiarios;
      bDia.valor += r.totalValorCent;

      // MES/grupo
      let mapGrupo = byCpfGrupo.get(cpf);
      if (!mapGrupo) { mapGrupo = new Map(); byCpfGrupo.set(cpf, mapGrupo); }
      let bGrupo = mapGrupo.get(vigMes);
      if (!bGrupo) { bGrupo = { rows: [], valor: 0, vidas: 0 }; mapGrupo.set(vigMes, bGrupo); }
      bGrupo.rows.push(r);
      bGrupo.vidas += r.beneficiarios;
      bGrupo.valor += r.totalValorCent;

      // total por CPF
      const v = byCpfValorTotal.get(cpf) || 0;
      byCpfValorTotal.set(cpf, v + r.totalValorCent);

      // ===== Por Operadora =====
      const getOpMap = (map) => {
        let m = map.get(op);
        if (!m) { m = new Map(); map.set(op, m); }
        return m;
      };

      // DIA por Operadora
      {
        const mapCpf = getOpMap(opCpfDia);
        let mapDiaOp = mapCpf.get(cpf);
        if (!mapDiaOp) { mapDiaOp = new Map(); mapCpf.set(cpf, mapDiaOp); }
        let bDiaOp = mapDiaOp.get(vigDia);
        if (!bDiaOp) { bDiaOp = { rows: [], valor: 0, vidas: 0 }; mapDiaOp.set(vigDia, bDiaOp); }
        bDiaOp.rows.push(r);
        bDiaOp.vidas += r.beneficiarios;
        bDiaOp.valor += r.totalValorCent;
      }

      // MES por Operadora
      {
        const mapCpf = getOpMap(opCpfGrupo);
        let mapGrupoOp = mapCpf.get(cpf);
        if (!mapGrupoOp) { mapGrupoOp = new Map(); mapCpf.set(cpf, mapGrupoOp); }
        let bGrupoOp = mapGrupoOp.get(vigMes);
        if (!bGrupoOp) { bGrupoOp = { rows: [], valor: 0, vidas: 0 }; mapGrupoOp.set(vigMes, bGrupoOp); }
        bGrupoOp.rows.push(r);
        bGrupoOp.vidas += r.beneficiarios;
        bGrupoOp.valor += r.totalValorCent;
      }

      // TOTAL por CPF na operadora
      {
        let mapVal = opCpfValorTotal.get(op);
        if (!mapVal) { mapVal = new Map(); opCpfValorTotal.set(op, mapVal); }
        const curr = mapVal.get(cpf) || 0;
        mapVal.set(cpf, curr + r.totalValorCent);
      }
    }

    // >>> MOD: função auxiliar para somar métricas por linhas
    const sumRowsMetrics = (rows, valorTotalOverride = null) => {
      let vendidas = 0, confirmadas = 0, confirmadasAtivas = 0, ativas = 0, valorConfirmado = 0;
      const contratosPagos = new Set();

      for (const it of rows) {
        const vidas = Number(it.beneficiarios) || 0;
        vendidas += vidas;

        const pago = !!it._pago;
        const ativo = !!it._ativo;

        if (ativo) ativas += vidas;
        if (pago) {
          confirmadas += vidas;
          valorConfirmado += (Number(it.totalValorCent) || 0);
          if (it._contratoCodigo) contratosPagos.add(String(it._contratoCodigo));
          if (ativo) confirmadasAtivas += vidas;
        }
      }

      const valorTotalVendido = (valorTotalOverride != null) ? valorTotalOverride
        : rows.reduce((acc, it) => acc + (Number(it.totalValorCent) || 0), 0);

      return {
        vendidas,
        confirmadas,
        confirmadasAtivas,
        ativas,
        contratosConfirmados: contratosPagos.size,
        valorConfirmado,
        valorTotalVendido
      };
    };

    const linhas = [];

    const montarLinhaGeral = async (cpf, nome, janela, vigencia, rows) => {
      const meta = await this._getMetaByCpf(cpf, rows[0]);
      // >>> MOD: métricas usando flags por linha
      const m = sumRowsMetrics(rows, byCpfValorTotal.get(cpf) || 0);

      return {
        operadora: OPERADORA_GERAL, // GERAL
        escopo: 'NACIONAL',
        uf: UF_NACIONAL,
        janela,
        vigencia,
        cpf,
        nome: nome || meta.nome || null,
        ufMeta: meta.uf || null,
        vendidas: m.vendidas,
        confirmadas: m.confirmadas,
        confirmadasAtivas: m.confirmadasAtivas,
        ativas: m.ativas,
        contratosVendidos: 0,
        contratosConfirmados: m.contratosConfirmados,
        valorConfirmado: m.valorConfirmado,
        valorTotalVendido: m.valorTotalVendido
      };
    };

    const montarLinhaOperadora = async (operadora, cpf, nome, janela, vigencia, rows) => {
      const meta = await this._getMetaByCpf(cpf, rows[0]);
      // >>> MOD: métricas usando flags por linha
      const totalValOpCpf = opCpfValorTotal.get(operadora)?.get(cpf) || 0;
      const m = sumRowsMetrics(rows, totalValOpCpf);

      return {
        operadora, // POR OPERADORA
        escopo: 'NACIONAL',
        uf: UF_NACIONAL,
        janela,
        vigencia,
        cpf,
        nome: nome || meta.nome || null,
        ufMeta: meta.uf || null,
        vendidas: m.vendidas,
        confirmadas: m.confirmadas,
        confirmadasAtivas: m.confirmadasAtivas,
        ativas: m.ativas,
        contratosVendidos: 0,
        contratosConfirmados: m.contratosConfirmados,
        valorConfirmado: m.valorConfirmado,
        valorTotalVendido: m.valorTotalVendido
      };
    };

    // ===== GERAL =====
    // TOTAL por CPF
    for (const [cpf, mapDia] of byCpfDia.entries()) {
      const rowsAll = [];
      for (const b of mapDia.values()) rowsAll.push(...b.rows);
      if (!rowsAll.length) continue;
      const nome = rowsAll[0]?.vendedorNome || null;
      const ln = await montarLinhaGeral(cpf, nome, 'TOTAL', null, rowsAll);
      linhas.push(ln);
      if (ln.ufMeta) linhas.push({ ...ln, escopo: 'UF', uf: ln.ufMeta });
    }
    // DIA
    for (const [cpf, mapDia] of byCpfDia.entries()) {
      const firstBucket = mapDia.values().next().value;
      const nome = firstBucket?.rows?.[0]?.vendedorNome || null;

      for (const [ymd, b] of mapDia.entries()) {
        const ln = await montarLinhaGeral(cpf, nome, 'DIA', ymd, b.rows);
        linhas.push(ln);
        if (ln.ufMeta) linhas.push({ ...ln, escopo: 'UF', uf: ln.ufMeta });
      }
    }
    // MES (grupo)
    for (const [cpf, mapGrupo] of byCpfGrupo.entries()) {
      const any = mapGrupo.values().next().value;
      const nome = any?.rows?.[0]?.vendedorNome || null;

      for (const [grupo, b] of mapGrupo.entries()) {
        const ln = await montarLinhaGeral(cpf, nome, 'MES', grupo, b.rows);
        linhas.push(ln);
        if (ln.ufMeta) linhas.push({ ...ln, escopo: 'UF', uf: ln.ufMeta });
      }
    }

    // ===== POR OPERADORA =====
    // TOTAL
    for (const [op, mapCpf] of opCpfDia.entries()) {
      for (const [cpf, mapDia] of mapCpf.entries()) {
        const rowsAll = [];
        for (const b of mapDia.values()) rowsAll.push(...b.rows);
        if (!rowsAll.length) continue;
        const nome = rowsAll[0]?.vendedorNome || null;
        const ln = await montarLinhaOperadora(op, cpf, nome, 'TOTAL', null, rowsAll);
        linhas.push(ln);
        if (ln.ufMeta) linhas.push({ ...ln, escopo: 'UF', uf: ln.ufMeta });
      }
    }
    // DIA
    for (const [op, mapCpf] of opCpfDia.entries()) {
      for (const [cpf, mapDia] of mapCpf.entries()) {
        const first = mapDia.values().next().value;
        const nome = first?.rows?.[0]?.vendedorNome || null;
        for (const [ymd, b] of mapDia.entries()) {
          const ln = await montarLinhaOperadora(op, cpf, nome, 'DIA', ymd, b.rows);
          linhas.push(ln);
          if (ln.ufMeta) linhas.push({ ...ln, escopo: 'UF', uf: ln.ufMeta });
        }
      }
    }
    // MES
    for (const [op, mapCpf] of opCpfGrupo.entries()) {
      for (const [cpf, mapGrupo] of mapCpf.entries()) {
        const any = mapGrupo.values().next().value;
        const nome = any?.rows?.[0]?.vendedorNome || null;
        for (const [grupo, b] of mapGrupo.entries()) {
          const ln = await montarLinhaOperadora(op, cpf, nome, 'MES', grupo, b.rows);
          linhas.push(ln);
          if (ln.ufMeta) linhas.push({ ...ln, escopo: 'UF', uf: ln.ufMeta });
        }
      }
    }

    if (!linhas.length) {
      const d = (dnvDiag || {});
      const msg =
        "Não há vendas elegíveis nas vigências ativas do período informado. " +
        `[diag: dias=${d.dias_consultados ?? 'NA'}, propostas_api=${d.propostas_total_api ?? 'NA'}, ` +
        `kept=${d.kept ?? 0}, drop_supervisor=${d.drop_supervisor ?? 0}, drop_operadora=${d.drop_operadora ?? 0}, ` +
        `drop_status=${d.drop_status ?? 0}, drop_cont_prod=${d.drop_cont_prod ?? 0}, ` +
        `drop_vig_nao_mapeada=${d.drop_vig_nao_mapeada ?? 0}, drop_sem_vigencia=${d.drop_sem_vigencia ?? 0}, ` +
        `drop_excluido=${d.drop_excluido ?? 0}, drop_beneficiarios=${d.drop_beneficiarios ?? 0}]`;
      throw new Error(msg);
    }

    // Ordenação e ranking (com separação por operadora/escopo/janela/vigência)
    const bucketKey = (ln) =>
      `${ln.operadora || 'GERAL'}::${ln.escopo || 'NACIONAL'}:${ln.uf || 'NA'}|${ln.janela}:${ln.vigencia || 'TOTAL'}`;

    const buckets = new Map();
    for (const ln of linhas) {
      const k = bucketKey(ln);
      const arr = buckets.get(k) || [];
      arr.push(ln);
      buckets.set(k, arr);
    }

    const ranked = [];
    for (const [, arr] of buckets) {
      const isTotal = (arr[0]?.janela === 'TOTAL');
      const sorted = arr.sort((a, b) => {
        if (isTotal) {
          return (b.confirmadasAtivas - a.confirmadasAtivas) ||
            (b.valorConfirmado - a.valorConfirmado) ||
            (b.ativas - a.ativas) ||
            (b.confirmadas - a.confirmadas) ||
            (b.vendidas - a.vendidas) ||
            ((b.valorTotalVendido || 0) - (a.valorTotalVendido || 0)) ||
            String(a.nome || '').localeCompare(String(b.nome || '')) ||
            String(a.cpf).localeCompare(String(b.cpf));
        } else {
          return (b.confirmadas - a.confirmadas) ||
            (b.valorConfirmado - a.valorConfirmado) ||
            (b.vendidas - a.vendidas) ||
            ((b.valorTotalVendido || 0) - (a.valorTotalVendido || 0)) ||
            String(a.nome || '').localeCompare(String(b.nome || '')) ||
            String(a.cpf).localeCompare(String(b.cpf));
        }
      });

      const primary = isTotal ? sorted.map(x => x.confirmadasAtivas) : sorted.map(x => x.confirmadas);
      const top1 = primary[0] || 0, top2 = primary[1] || 0, top3 = primary[2] || 0;

      sorted.forEach((ln, i) => {
        ranked.push({
          escopo: ln.escopo || 'NACIONAL',
          uf: ln.uf || null,
          operadora: ln.operadora || null,
          janela: ln.janela,
          vigencia: ln.vigencia,
          corretor_cpf: ln.cpf,
          nome_corretor: ln.nome,
          vidas_vendidas: ln.vendidas,
          vidas_confirmadas: ln.confirmadas,
          vidas_ativas: ln.ativas,
          vidas_confirmadas_ativas: ln.confirmadasAtivas,
          contratos_unicos_vendidos: ln.contratosVendidos || 0,
          contratos_unicos_confirmados: ln.contratosConfirmados || 0,
          valor_confirmado_contratos_cent: ln.valorConfirmado || 0,
          rank_confirmadas: i + 1,
          faltam_para_primeiro: Math.max(0, top1 - (isTotal ? ln.confirmadasAtivas : ln.confirmadas)),
          faltam_para_segundo: Math.max(0, top2 - (isTotal ? ln.confirmadasAtivas : ln.confirmadas)),
          faltam_para_terceiro: Math.max(0, top3 - (isTotal ? ln.confirmadasAtivas : ln.confirmadas)),
        });
      });
    }

    // Persistência
    const exec = await this.tblExec.create({
      data_inicio_campanha: new Date(inicio),
      data_fim_campanha: new Date(fim),
    });

    const normalizeScopeFields = (ln) => {
      const isUF = (ln.escopo || 'NACIONAL').toUpperCase() === 'UF';
      const uf_db = isUF ? String(ln.uf || 'NA').toUpperCase() : 'NA';
      const operadora_db = ln.operadora ? String(ln.operadora).trim() : 'GERAL';
      return { uf_db, operadora_db };
    };

    await this.tblRes.bulkCreate(
      ranked.map(ln => {
        const { uf_db, operadora_db } = normalizeScopeFields(ln);
        return {
          execucao_id: exec.id,
          escopo: ln.escopo || 'NACIONAL',
          uf: uf_db,
          operadora: operadora_db,
          janela: ln.janela,
          vigencia: ln.vigencia,
          corretor_cpf: ln.corretor_cpf,
          nome_corretor: ln.nome_corretor,
          vidas_vendidas: ln.vidas_vendidas,
          vidas_confirmadas: ln.vidas_confirmadas,
          vidas_ativas: ln.vidas_ativas,
          vidas_confirmadas_ativas: ln.vidas_confirmadas_ativas,
          contratos_unicos_vendidos: ln.contratos_unicos_vendidos,
          contratos_unicos_confirmados: ln.contratos_unicos_confirmados,
          valor_confirmado_contratos_cent: ln.valor_confirmado_contratos_cent,
          rank_confirmadas: ln.rank_confirmadas,
          faltam_para_primeiro: ln.faltam_para_primeiro,
          faltam_para_segundo: ln.faltam_para_segundo,
          faltam_para_terceiro: ln.faltam_para_terceiro,
        };
      }),
      {
        updateOnDuplicate: [
          'nome_corretor', 'vidas_vendidas', 'vidas_confirmadas', 'vidas_ativas', 'vidas_confirmadas_ativas',
          'contratos_unicos_vendidos', 'contratos_unicos_confirmados',
          'valor_confirmado_contratos_cent', 'rank_confirmadas',
          'faltam_para_primeiro', 'faltam_para_segundo', 'faltam_para_terceiro',
          'operadora', 'uf'
        ]
      }
    );

    return { execucaoId: exec.id };
  }

  // ------- consultas -------
  async _resolveExec(execucaoId) {
    if (execucaoId) return execucaoId;
    const last = await this.tblExec.findOne({ order: [['id', 'DESC']] });
    if (!last) return null;
    return last.id;
  }

  async _filterOutExcluidos(rows) {
    await this._loadExcluidosSet();
    if (!rows?.length) return rows;
    return rows.filter(r => !this._isExcluido(r.corretor_cpf || r.cpf));
  }

  async consultarTotal({ execucaoId, escopo, uf, limit, cpf, incluirValor }) {
    const id = await this._resolveExec(execucaoId);
    if (!id) return { execucaoId: null, top: [], alvo: null, alvo_in_top: false };

    const ESC = String(escopo || 'NACIONAL').toUpperCase();
    const where = { execucao_id: id, janela: 'TOTAL', vigencia: null, operadora: OPERADORA_GERAL };
    if (ESC === 'UF') {
      if (!uf) throw new Error("Informe 'uf' quando escopo=UF");
      where.escopo = 'UF';
      where.uf = String(uf).toUpperCase();
    } else {
      where.escopo = 'NACIONAL';
      where.uf = 'NA';
    }

    const ord = [['rank_confirmadas', 'ASC'], ['corretor_cpf', 'ASC']];
    const lim = Number(limit) > 0 ? Math.min(Number(limit), 1000) : null;

    let topRows = await this.tblRes.findAll({
      where, order: ord, ...(lim ? { limit: lim * 3 } : {}), raw: true
    });
    topRows = await this._filterOutExcluidos(topRows);
    if (lim) topRows = topRows.slice(0, lim);

    // imagens para o TOP
    if (topRows.length) {
      const cpfsTop = topRows.map(r => r.corretor_cpf);
      const imgMap = await this._getImgUrlMapByCpfs(cpfsTop);
      topRows = topRows.map(r => ({ ...r, imagem_gladiador_URL: imgMap.get(r.corretor_cpf) || null }));
    }

    let alvo = null, alvo_in_top = false;
    if (cpf) {
      const cpfN = String(cpf).replace(/\D+/g, '');
      const a = await this.tblRes.findOne({ where: { ...where, corretor_cpf: cpfN }, raw: true });
      if (a && !(await this._isExcluido(cpfN))) alvo = a;
      if (alvo && topRows.length) alvo_in_top = topRows.some(r => r.corretor_cpf === cpfN);

      if (alvo) {
        const imgMap = await this._getImgUrlMapByCpfs([cpfN]);
        alvo.imagem_gladiador_URL = imgMap.get(cpfN) || null;
      }
    }

    const stripValor = (r) => {
      if (!r) return r;
      if (String(incluirValor) === 'true') return r;
      const { valor_confirmado_contratos_cent, ...rest } = r;
      return rest;
    };

    return {
      execucaoId: id,
      escopo: where.escopo,
      uf: where.uf || null,
      janela: 'TOTAL',
      top: topRows.map(stripValor),
      alvo: stripValor(alvo),
      alvo_in_top
    };
  }

  async consultarJanela({ execucaoId, escopo, uf, janela, vigencia, limit, cpf, incluirValor }) {
    const id = await this._resolveExec(execucaoId);
    if (!id) return { execucaoId: null, top: [], alvo: null, alvo_in_top: false };

    const J = String(janela || '').toUpperCase();
    if (!['DIA', 'MES'].includes(J)) throw new Error("Parâmetro 'janela' deve ser DIA ou MES");

    const vig = J === 'DIA' ? (vigencia ? String(vigencia).trim() : null) : (vigencia ? String(vigencia).slice(0, 7) : null);
    if (J === 'DIA' && !/^\d{4}-\d{2}-\d{2}$/.test(vig || '')) throw new Error("Para janela=DIA, use ?vigencia=YYYY-MM-DD");
    if (J === 'MES' && !/^\d{4}-\d{2}$/.test(vig || '')) throw new Error("Para janela=MES, use ?vigencia=YYYY-MM");

    const ESC = String(escopo || 'NACIONAL').toUpperCase();
    const where = { execucao_id: id, janela: J, vigencia: vig, operadora: OPERADORA_GERAL };
    if (ESC === 'UF') {
      if (!uf) throw new Error("Informe 'uf' quando escopo=UF");
      where.escopo = 'UF';
      where.uf = String(uf).toUpperCase();
    } else {
      where.escopo = 'NACIONAL';
      where.uf = 'NA';
    }

    const ord = [['rank_confirmadas', 'ASC'], ['corretor_cpf', 'ASC']];
    const lim = Number(limit) > 0 ? Math.min(Number(limit), 1000) : null;

    let topRows = await this.tblRes.findAll({
      where, order: ord, ...(lim ? { limit: lim * 3 } : {}), raw: true
    });
    topRows = await this._filterOutExcluidos(topRows);
    if (lim) topRows = topRows.slice(0, lim);

    if (topRows.length) {
      const cpfsTop = topRows.map(r => r.corretor_cpf);
      const imgMap = await this._getImgUrlMapByCpfs(cpfsTop);
      topRows = topRows.map(r => ({ ...r, imagem_gladiador_URL: imgMap.get(r.corretor_cpf) || null }));
    }

    let alvo = null, alvo_in_top = false;
    if (cpf) {
      const cpfN = String(cpf).replace(/\D+/g, '');
      const a = await this.tblRes.findOne({ where: { ...where, corretor_cpf: cpfN }, raw: true });
      if (a && !(await this._isExcluido(cpfN))) alvo = a;
      if (alvo && topRows.length) alvo_in_top = topRows.some(r => r.corretor_cpf === cpfN);

      if (alvo) {
        const imgMap = await this._getImgUrlMapByCpfs([cpfN]);
        alvo.imagem_gladiador_URL = imgMap.get(cpfN) || null;
      }
    }

    const stripValor = (r) => {
      if (!r) return r;
      if (String(incluirValor) === 'true') return r;
      const { valor_confirmado_contratos_cent, ...rest } = r;
      return rest;
    };

    return {
      execucaoId: id,
      escopo: where.escopo,
      uf: where.uf || null,
      janela: J,
      vigencia: vig,
      top: topRows.map(stripValor),
      alvo: stripValor(alvo),
      alvo_in_top
    };
  }

  async consultarTodasVigenciasCpf({ execucaoId, janela, cpf, incluirValor, limit }) {
    const id = await this._resolveExec(execucaoId);
    if (!id) return { execucaoId: null, janela, cpf: null, lista: [] };

    const J = String(janela || '').toUpperCase();
    if (!['DIA', 'MES'].includes(J)) throw new Error("Parâmetro 'janela' deve ser DIA ou MES");

    const cpfN = String(cpf || '').replace(/\D+/g, '');
    if (!cpfN) throw new Error("Informe 'cpf' (apenas dígitos)");

    await this._loadExcluidosSet();
    if (this._isExcluido(cpfN)) {
      return { execucaoId: id, janela: J, cpf: cpfN, lista: [] };
    }

    // Geral = operadora 'GERAL' e uf 'NA'
    const where = { execucao_id: id, janela: J, escopo: 'NACIONAL', uf: 'NA', operadora: OPERADORA_GERAL, corretor_cpf: cpfN };
    const ord = [['vigencia', 'ASC']];
    const qOpts = { where, order: ord, raw: true };
    if (Number(limit) > 0) qOpts.limit = Math.min(Number(limit), 1000);

    let rows = await this.tblRes.findAll(qOpts);

    if (rows.length) {
      const imgMap = await this._getImgUrlMapByCpfs([cpfN]);
      rows = rows.map(r => ({ ...r, imagem_gladiador_URL: imgMap.get(cpfN) || null }));
    }

    const stripValor = (r) => {
      if (!r) return r;
      if (String(incluirValor) === 'true') return r;
      const { valor_confirmado_contratos_cent, ...rest } = r;
      return rest;
    };

    return { execucaoId: id, janela: J, cpf: cpfN, lista: rows.map(stripValor) };
  }

  // ===== Consulta por Operadora (TOTAL/DIA/MÊS) lendo de rk_resultados =====
  async consultarPorOperadora({ execucaoId, operadora, janela, vigencia, escopo, uf, cpf, incluirValor, limit }) {
    const id = await this._resolveExec(execucaoId);
    if (!id) return { execucaoId: null, operadoras: [] };

    await this._loadExcluidosSet();

    const J = String(janela || 'TOTAL').toUpperCase();
    if (!['TOTAL', 'DIA', 'MES'].includes(J)) throw new Error("janela deve ser TOTAL, DIA ou MES");

    let V = null;
    if (J === 'DIA') {
      V = vigencia ? toYMD(vigencia) : null;
      if (V === null && vigencia) throw new Error("Para janela=DIA, use vigencia=YYYY-MM-DD");
    } else if (J === 'MES') {
      V = vigencia ? String(vigencia).slice(0, 7) : null;
      if (V && !/^\d{4}-\d{2}$/.test(V)) throw new Error("Para janela=MES, use vigencia=YYYY-MM");
    } else {
      V = null;
    }

    const whereBase = { execucao_id: id, janela: J };
    if (J === 'TOTAL') whereBase.vigencia = null;
    if (J !== 'TOTAL' && V) whereBase.vigencia = V;

    if (String(escopo || 'NACIONAL').toUpperCase() === 'UF') {
      whereBase.escopo = 'UF';
      if (!uf) throw new Error("Informe 'uf' quando escopo=UF");
      whereBase.uf = String(uf).toUpperCase();
    } else {
      whereBase.escopo = 'NACIONAL';
      whereBase.uf = UF_NACIONAL;
    }

    const opsDisponiveisRows = await this.tblRes.findAll({
      attributes: ['operadora'],
      where: whereBase,
      group: ['operadora'],
      raw: true
    });
    const opsDisponiveis = opsDisponiveisRows
      .map(r => (r.operadora ?? '').toString().trim())
      .filter(Boolean);

    const opParam = (operadora ?? '').toString().trim();

    let alvoOperadoras = [];
    if (!opParam || opParam.toLowerCase() === 'todas' || opParam.toLowerCase() === 'geral') {
      alvoOperadoras = opsDisponiveis.slice();
    } else {
      const matchExato = opsDisponiveis.find(o => o === opParam);
      const matchICase = matchExato ? matchExato : opsDisponiveis.find(o => o.toLowerCase() === opParam.toLowerCase());
      alvoOperadoras = matchICase ? [matchICase] : [opParam];
    }

    const ord = [['rank_confirmadas', 'ASC'], ['corretor_cpf', 'ASC']];
    const lim = Number(limit) > 0 ? Math.min(Number(limit), 1000) : null;
    const stripValor = (r) => {
      if (!r) return r;
      if (String(incluirValor) === 'true') return r;
      const { valor_confirmado_contratos_cent, ...rest } = r;
      return rest;
    };

    const resultados = [];
    for (const opNome of alvoOperadoras) {
      const where = { ...whereBase, operadora: opNome };
      const qOpts = { where, order: ord, raw: true };
      if (lim) qOpts.limit = lim * 3;

      let topRows = await this.tblRes.findAll(qOpts);
      topRows = await this._filterOutExcluidos(topRows);
      if (lim) topRows = topRows.slice(0, lim);

      if (topRows.length) {
        const cpfsTop = topRows.map(r => r.corretor_cpf);
        const imgMap = await this._getImgUrlMapByCpfs(cpfsTop);
        topRows = topRows.map(r => ({ ...r, imagem_gladiador_URL: imgMap.get(r.corretor_cpf) || null }));
      }

      let alvoRow = null, alvo_in_top = false;
      if (cpf) {
        const cpfN = normDigits(cpf);
        const a = await this.tblRes.findOne({ where: { ...where, corretor_cpf: cpfN }, raw: true });
        if (a && !(await this._isExcluido(cpfN))) alvoRow = a;
        if (alvoRow && topRows.length) alvo_in_top = topRows.some(r => r.corretor_cpf === cpfN);

        if (alvoRow) {
          const imgMap = await this._getImgUrlMapByCpfs([cpfN]);
          alvoRow.imagem_gladiador_URL = imgMap.get(cpfN) || null;
        }
      }

      resultados.push({
        operadora: opNome,
        escopo: where.escopo,
        uf: where.uf || null,
        janela: J,
        vigencia: where.vigencia || null,
        top: topRows.map(stripValor),
        alvo: stripValor(alvoRow),
        alvo_in_top,
        _diag: topRows.length ? undefined : {
          opsDisponiveis,
          whereBase,
        }
      });
    }

    return { execucaoId: id, operadoras: resultados };
  }

  async consultarVigenciasCpfPorOperadora({ execucaoId, janela, cpf, operadora, escopo, uf, incluirValor, limit }) {
    const id = await this._resolveExec(execucaoId);
    if (!id) return { execucaoId: null, janela, cpf: null, operadora: null, lista: [] };

    const J = String(janela || '').toUpperCase();
    if (!['DIA', 'MES'].includes(J)) throw new Error("Parâmetro 'janela' deve ser DIA ou MES");

    const cpfN = String(cpf || '').replace(/\D+/g, '');
    if (!cpfN) throw new Error("Informe 'cpf' (apenas dígitos)");

    await this._loadExcluidosSet();
    if (this._isExcluido(cpfN)) {
      return { execucaoId: id, janela: J, cpf: cpfN, operadora: null, lista: [] };
    }

    let op = (operadora ?? '').toString().trim();
    if (!op || op.toLowerCase() === 'geral' || op.toLowerCase() === 'todas') op = 'GERAL';

    const ESC = String(escopo || 'NACIONAL').toUpperCase();
    const where = { execucao_id: id, janela: J, escopo: ESC, operadora: op, corretor_cpf: cpfN };

    if (ESC === 'UF') {
      if (!uf) throw new Error("Informe 'uf' quando escopo=UF");
      where.uf = String(uf).toUpperCase();
    } else {
      where.uf = 'NA';
    }

    const ord = [['vigencia', 'ASC']];
    const qOpts = { where, order: ord, raw: true };
    if (Number(limit) > 0) qOpts.limit = Math.min(Number(limit), 1000);

    let rows = await this.tblRes.findAll(qOpts);

    if (rows.length) {
      const imgMap = await this._getImgUrlMapByCpfs([cpfN]);
      rows = rows.map(r => ({ ...r, imagem_gladiador_URL: imgMap.get(cpfN) || null }));
    }

    const stripValor = (r) => {
      if (!r) return r;
      if (String(incluirValor) === 'true') return r;
      const { valor_confirmado_contratos_cent, ...rest } = r;
      return rest;
    };

    return {
      execucaoId: id,
      janela: J,
      cpf: cpfN,
      operadora: op,
      escopo: where.escopo,
      uf: where.uf,
      lista: rows.map(stripValor)
    };
  }
}

module.exports = { RankingService };
