const path = require("path");
const { withRateLimit } = require("../utils/withRateLimit");
const { DigitalSaudeClient } = require("./digitalSaude/DigitalSaudeClient");
const { PlaniumDnvClient } = require("./planium/PlaniumDnvClient");
const axiosCfg = require("../config/axios/axios.config");

const UF_NACIONAL = 'NA';
const OPERADORA_GERAL = 'GERAL';

// ---------- helpers ----------
const normDigits = (s) => String(s || '').replace(/\D+/g, '');
const normContrato = (s) => String(s ?? '').replace(/\s+/g, '');

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
  if (typeof st === 'object') {
    if (st.primeiraFaturaPaga === true) return true;
    if (Array.isArray(st)) return st.length > 0;
    if (Array.isArray(st.faturas)) return st.faturas.length > 0;
    if (typeof st.length === 'number') return st.length > 0;
  }
  return false;
};
// -----------------------------

class RankingService {
  constructor({ paralelo = 6, soTitular = false } = {}) {
    this.db = require(path.resolve(__dirname, "../../../../models"));
    this.paralelo = Number(paralelo || 6);
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
    this._pagoCache = new Map();    // contrato -> boolean
    this._exclSet = null;           // Set de cpfs (normalizados)
    this._superSet = null;          // Set de nomes de supervisor (exatos)
    this._operSet = null;           // Set de nomes de operadora (exatos)

    // DNV limits
    this.dnvConcurrency = Number(process.env.DNV_CONCURRENCY || 4);
    this.dnvMinDelay = Number(process.env.DNV_MIN_DELAY_MS || 150);

    this.allowNullSupervisor = '1';
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

  // -------- contrato pago (com cache persistente) --------
  async _getContratoPagoComCache(cod) {
    const key = String(cod || '').trim();
    if (!key) return false;
    if (this._pagoCache.has(key)) return this._pagoCache.get(key);

    // tenta cache no banco
    if (this.tblCache) {
      try {
        const row = await this.tblCache.findOne({ where: { codigo_contrato: key }, raw: true });
        if (row) {
          const val = !!(row.status_pago ?? row.pago ?? row.conf_pagamento);
          this._pagoCache.set(key, val);
          return val;
        }
      } catch { /* ignore */ }
    }

    // consulta API externa (apenas se não houver cache)
    let pago = false;
    try {
      const st = await this.ds.consultarStatusFaturaPorContrato(key);
      pago = resolvePago(st);
      // grava no cache
      if (this.tblCache) {
        try {
          await this.tblCache.upsert({
            codigo_contrato: key,
            status_pago: pago,
            payload_json: null,
            updated_at: new Date(),
            created_at: new Date(),
          });
        } catch { /* ignore */ }
      }
    } catch {
      // mantém falso; não faz loop infinito
    }

    this._pagoCache.set(key, pago);
    return pago;
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

    await Promise.all(dias.map(ymd => dnvLimiter(async () => {
      const arr = await this.dnv.listarPorDia(CNPJ_OPERADORA, ymd);
      if (Array.isArray(arr)) diag.propostas_total_api += arr.length;

      for (const it of (arr || [])) {
        const vendedorCpf = normDigits(it?.vendedor_cpf);
        if (!vendedorCpf) { diag.drop_sem_cpf_vendedor++; continue; }
        if (this._isExcluido(vendedorCpf)) { diag.drop_excluido++; continue; }

        // supervisor obrigatório + exato
        const supNomeRaw = it?.metadados?.supervisao_nome;
        const supNome = (supNomeRaw ?? '').toString().trim();
        const supIsNullish = supNomeRaw == null || supNome === '';

        if (supIsNullish) {
          if (!this.allowNullSupervisor) {
            diag.drop_supervisor++;
            continue;
          }
          // quando permitido, segue com supNome = null
        } else {
          if (!whitelistSuper.has(supNome)) {
            diag.drop_supervisor++;
            continue;
          }
        }

        // operadora obrigatória + exata
        const operadoraNome = String(it?.metadados?.operadora_nome || '').trim();
        if (!operadoraNome || !whitelistOper.has(operadoraNome)) { diag.drop_operadora++; continue; }

        // filtros status/contrato/produto
        const st = toLower(it?.status);
        if (banStatus.has(st)) { diag.drop_status++; continue; }

        // if (!(toLower(it?.contrato) === 'ad' && toLower(it?.produto) === 'saude')) { diag.drop_cont_prod++; continue; }
        if (!(toLower(it?.contrato) === 'ad')) { diag.drop_cont_prod++; continue; }

        // vigência: deve existir na tabela (modo estrito)
        const vigDia = toYMD(it?.date_vigencia);
        if (!vigDia) { diag.drop_sem_vigencia++; continue; }
        if (!diaParaGrupo.has(vigDia)) { diag.drop_vig_nao_mapeada++; continue; }
        const grupo = String(diaParaGrupo.get(vigDia)); // YYYY-MM do cadastro

        // beneficiários > 0
        const beneficiarios = Number(it?.beneficiarios) || 0;
        if (beneficiarios <= 0) { diag.drop_beneficiarios++; continue; }

        const totalValorCent = parseMoneyToCents(it?.total_valor);
        const vendedorNome = String(it?.vendedor_nome || '').trim();

        // confirmação por CPF (titular -> contrato)
        const titularCpf = normDigits(Array.isArray(it?.metadados?.titulares_cpf) ? it.metadados.titulares_cpf[0] : null)
          || normDigits(it?.contratante_cpf);

        items.push({
          propostaID: it?.propostaID, // auditoria
          vendedorCpf,
          vendedorNome,
          vigDia,
          vigMes: grupo, // vem do cadastro
          beneficiarios,
          totalValorCent,
          operadoraNome,
          supNome: supIsNullish ? null : supNome,
          titularCpf,
        });
        diag.kept++;
      }
    })));

    // se quiser logar em console:
    if (process.env.RANKING_DEBUG_DNV === '1') {
      console.log('[DNV][DIAG]', JSON.stringify(diag));
    }

    // anexa o diagnóstico para o chamador usar na mensagem de erro, se necessário
    return { items, diag };
  }

  // -------- resolve contrato por CPF (usa a MESMA base já usada no projeto) --------
  async _resolverContratoCodigoPorCpf(cpf) {
    const c = normDigits(cpf);
    if (!c) return null;
    try {
      const resp = await axiosCfg.https.get("/contrato/procurarPorCpfTitular", {
        params: { cpf: c },
        validateStatus: s => (s >= 200 && s < 300) || s === 404 || s === 400,
      });
      if (resp.status >= 200 && resp.status < 300) {
        const data = resp.data;
        const codigo = data?.codigo_do_contrato || data?.codigoContrato || data?.contrato || null;
        return codigo ? String(codigo).trim() : null;
      }
      return null;
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

    // === NOVO: coleta vendidas via DNV + filtros estritos ===
    const { items: dnvRows, diag: dnvDiag } = await this._coletarVendidasDNV({ inicio, fim, diaParaGrupo, whitelistSuper, whitelistOper });

    // Buckets por CPF (Geral)
    const byCpfDia = new Map();       // cpf -> Map(ymd -> { rows, vidas, valor })
    const byCpfGrupo = new Map();     // cpf -> Map(grupo -> { rows, vidas, valor })
    const byCpfValorTotal = new Map(); // cpf -> total valor cent (para confirmado quando pago)

    // Buckets por Operadora -> CPF
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

      // MES/grupo (do cadastro)
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

    // === Confirmação/Ativo por CPF (contrato + faturas) ===
    const limiter = withRateLimit({ concurrency: this.paralelo, minDelayMs: 200 });
    const cpfSet = new Set([...byCpfDia.keys()]);
    const cpfToConfirm = new Map();

    await Promise.all(Array.from(cpfSet).map(cpf => limiter(async () => {
      // pegar um titularCpf de amostra desse CPF
      const sampleMap = byCpfDia.get(cpf) || new Map();
      const firstBucket = sampleMap.values().next().value;
      const titularCpf =
        (firstBucket?.rows || []).map(x => normDigits(x.titularCpf)).find(Boolean) || null;

      let contratoCodigo = null;
      if (titularCpf) {
        contratoCodigo = await this._resolverContratoCodigoPorCpf(titularCpf);
      }

      let pago = false;
      if (contratoCodigo) {
        pago = await this._getContratoPagoComCache(contratoCodigo); // mantém cache persistente
      }

      // Ativo: se quiser uma regra diferente, ajuste aqui.
      const ativo = !!pago;

      cpfToConfirm.set(cpf, { pago, ativo });
    })));

    const onlyVendidas = (rows) => rows.reduce((acc, it) => acc + (it.beneficiarios || 0), 0);

    const linhas = [];

    const montarLinhaGeral = async (cpf, nome, janela, vigencia, rows) => {
      const vendidas = onlyVendidas(rows);
      const metaConf = cpfToConfirm.get(cpf) || { pago: false, ativo: false };

      const confirmadas = metaConf.pago ? vendidas : 0;
      const confirmadasAtivas = (metaConf.pago && metaConf.ativo) ? vendidas : 0;
      const ativas = metaConf.ativo ? vendidas : 0;

      const valorConfirmado = metaConf.pago ? (byCpfValorTotal.get(cpf) || 0) : 0;
      const valorTotalVendido = byCpfValorTotal.get(cpf) || 0;

      const meta = await this._getMetaByCpf(cpf, rows[0]);

      return {
        operadora: OPERADORA_GERAL, // GERAL
        escopo: 'NACIONAL',
        uf: UF_NACIONAL,
        janela,
        vigencia,
        cpf,
        nome: nome || meta.nome || null,
        ufMeta: meta.uf || null,
        vendidas,
        confirmadas,
        confirmadasAtivas,
        ativas,
        contratosVendidos: 0,
        contratosConfirmados: metaConf.pago ? 1 : 0,
        valorConfirmado,
        valorTotalVendido
      };
    };

    const montarLinhaOperadora = async (operadora, cpf, nome, janela, vigencia, rows) => {
      const vendidas = onlyVendidas(rows);
      const metaConf = cpfToConfirm.get(cpf) || { pago: false, ativo: false };

      const confirmadas = metaConf.pago ? vendidas : 0;
      const confirmadasAtivas = (metaConf.pago && metaConf.ativo) ? vendidas : 0;
      const ativas = metaConf.ativo ? vendidas : 0;

      const valorConfirmado = metaConf.pago ? (opCpfValorTotal.get(operadora)?.get(cpf) || 0) : 0;
      const valorTotalVendido = opCpfValorTotal.get(operadora)?.get(cpf) || 0;

      const meta = await this._getMetaByCpf(cpf, rows[0]);

      return {
        operadora, // POR OPERADORA
        escopo: 'NACIONAL',
        uf: UF_NACIONAL,
        janela,
        vigencia,
        cpf,
        nome: nome || meta.nome || null,
        ufMeta: meta.uf || null,
        vendidas,
        confirmadas,
        confirmadasAtivas,
        ativas,
        contratosVendidos: 0,
        contratosConfirmados: metaConf.pago ? 1 : 0,
        valorConfirmado,
        valorTotalVendido
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
          operadora: ln.operadora || null, // campo extra (se seu model suportar)
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

    // helper local para evitar NULL nas chaves
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
          uf: uf_db,                         // << nunca NULL
          operadora: operadora_db,           // << 'GERAL' quando for “sem operadora”
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
    const where = { execucao_id: id, janela: 'TOTAL', vigencia: null, operadora: OPERADORA_GERAL }; // << geral usa 'GERAL'
    if (ESC === 'UF') {
      if (!uf) throw new Error("Informe 'uf' quando escopo=UF");
      where.escopo = 'UF';
      where.uf = String(uf).toUpperCase();      // uf obrigatório
    } else {
      where.escopo = 'NACIONAL';
      where.uf = 'NA';                           // << nunca null
    }

    const ord = [['rank_confirmadas', 'ASC'], ['corretor_cpf', 'ASC']];
    const lim = Number(limit) > 0 ? Math.min(Number(limit), 100) : null;

    let topRows = await this.tblRes.findAll({
      where, order: ord, ...(lim ? { limit: lim * 3 } : {}), raw: true
    });
    topRows = await this._filterOutExcluidos(topRows);
    if (lim) topRows = topRows.slice(0, lim);

    // 🔹 imagens para o TOP
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

      // 🔹 imagem para o ALVO
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
    const where = { execucao_id: id, janela: J, vigencia: vig, operadora: OPERADORA_GERAL }; // << geral usa 'GERAL'
    if (ESC === 'UF') {
      if (!uf) throw new Error("Informe 'uf' quando escopo=UF");
      where.escopo = 'UF';
      where.uf = String(uf).toUpperCase();
    } else {
      where.escopo = 'NACIONAL';
      where.uf = 'NA'; // << nunca null
    }

    const ord = [['rank_confirmadas', 'ASC'], ['corretor_cpf', 'ASC']];
    const lim = Number(limit) > 0 ? Math.min(Number(limit), 100) : null;

    let topRows = await this.tblRes.findAll({
      where, order: ord, ...(lim ? { limit: lim * 3 } : {}), raw: true
    });
    topRows = await this._filterOutExcluidos(topRows);
    if (lim) topRows = topRows.slice(0, lim);

    // 🔹 imagens para o TOP
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

      // 🔹 imagem para o ALVO
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

    // 🔹 imagem em todos os itens da LISTA
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

    // Normaliza janela/vigência
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
      V = null; // TOTAL = vigencia NULL
    }

    // Escopo/UF
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

    // Lista de operadoras realmente existentes no recorte pedido (para diagnosticar)
    const opsDisponiveisRows = await this.tblRes.findAll({
      attributes: ['operadora'],
      where: whereBase,
      group: ['operadora'],
      raw: true
    });
    const opsDisponiveis = opsDisponiveisRows
      .map(r => (r.operadora ?? '').toString().trim())
      .filter(Boolean);

    // Normaliza parâmetro recebido (trim/exato)
    const opParam = (operadora ?? '').toString().trim();

    // Operadoras alvo
    let alvoOperadoras = [];
    if (!opParam || opParam.toLowerCase() === 'todas' || opParam.toLowerCase() === 'geral') {
      alvoOperadoras = opsDisponiveis.slice(); // todas as que existem nesse recorte
    } else {
      // tenta casar exatamente; se não achar, tenta um match por TRIM/case-insensitive
      const matchExato = opsDisponiveis.find(o => o === opParam);
      const matchICase = matchExato ? matchExato : opsDisponiveis.find(o => o.toLowerCase() === opParam.toLowerCase());
      alvoOperadoras = matchICase ? [matchICase] : [opParam]; // ainda tenta com o param
    }

    const ord = [['rank_confirmadas', 'ASC'], ['corretor_cpf', 'ASC']];
    const lim = Number(limit) > 0 ? Math.min(Number(limit), 100) : null;
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

      // 🔹 imagens para o TOP da operadora
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

        // 🔹 imagem para o ALVO
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
        // campo auxiliar de diagnóstico (só quando vazio)
        _diag: topRows.length ? undefined : {
          opsDisponiveis, // operadoras realmente existentes nesse recorte
          whereBase,      // para conferir janela/vigencia/escopo
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

    // Normaliza operadora: 'GERAL' quando vazio/“geral”
    let op = (operadora ?? '').toString().trim();
    if (!op || op.toLowerCase() === 'geral' || op.toLowerCase() === 'todas') op = 'GERAL';

    // Escopo/UF
    const ESC = String(escopo || 'NACIONAL').toUpperCase();
    const where = { execucao_id: id, janela: J, escopo: ESC, operadora: op, corretor_cpf: cpfN };

    if (ESC === 'UF') {
      if (!uf) throw new Error("Informe 'uf' quando escopo=UF");
      where.uf = String(uf).toUpperCase();
    } else {
      where.uf = 'NA'; // padronização p/ nacional
    }

    const ord = [['vigencia', 'ASC']];
    const qOpts = { where, order: ord, raw: true };
    if (Number(limit) > 0) qOpts.limit = Math.min(Number(limit), 1000);

    let rows = await this.tblRes.findAll(qOpts);

    // 🔹 imagem em todos os itens da LISTA
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
