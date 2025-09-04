const path = require("path");
const { withRateLimit } = require("../utils/withRateLimit");
const { DigitalSaudeClient } = require("./digitalSaude/DigitalSaudeClient");

// ---------- helpers ----------
const normDigits = (s) => String(s || '').replace(/\D+/g, '');
const normContrato = (s) => String(s ?? '').replace(/\s+/g, '');

const parseMoneyToCents = (s) => {
  if (s == null) return 0;
  let str = String(s).trim().replace(/\s+/g, '');
  if (/,/.test(str) && /\./.test(str)) str = str.replace(/\./g, '').replace(',', '.');
  else if (/,/.test(str) && !/\./.test(str)) str = str.replace(',', '.');
  const n = Number(str);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

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

const isActive = (row) => String(row.status_do_beneficiario || '').trim().toLowerCase() === 'ativo';

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

    // usar models existentes
    this.tblExec = this.db.rk_execucoes;
    this.tblRes = this.db.rk_resultados;
    this.tblVig = this.db.rk_vig_validas;
    this.tblOper = this.db.rk_operadoras;
    this.tblExcl = this.db.rk_exclusoes;
    this.tblCache = this.db.rk_cache_contrato_status;

    // caches em memória
    this._metaCache = new Map();    // cpf -> { nome, uf }
    this._pagoCache = new Map();    // contrato -> boolean
    this._exclSet = null;         // Set de cpfs (normalizados)
  }

  // -------- exclusões --------
  async _loadExcluidosSet() {
    if (this._exclSet) return this._exclSet;
    try {
      const rows = await this.tblExcl.findAll({ where: { ativo: true }, raw: true });
      const pickCpf = (r) => normDigits(r.corretor_cpf || r.cpf || r.documento || r.documento_corretor || r.documento_corretora);
      this._exclSet = new Set(rows.map(pickCpf).filter(Boolean));
    } catch {
      this._exclSet = new Set();
    }
    return this._exclSet;
  }
  _isExcluido(cpfRaw) {
    const set = this._exclSet || new Set();
    return set.has(normDigits(cpfRaw));
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
    const nome = sampleRow?.nome_corretor || sampleRow?.nome_corretora || null;
    const uf = guessUF(sampleRow);
    const meta = { nome, uf };
    this._metaCache.set(cpf, meta);
    return meta;
  }

  async _carregarVigenciasValidas(inicio, fim) {
    const confRows = await this.tblVig?.findAll({ where: { ativo: true }, raw: true }).catch(() => []);
    const mesParaDiasValidos = new Map(); // grupo -> set(dias)
    const diaParaGrupo = new Map();       // dia -> grupo

    const inRange = (ymd) => {
      const d = new Date(ymd + "T00:00:00Z");
      const st = new Date(inicio + "T00:00:00Z");
      const en = new Date(fim + "T00:00:00Z");
      return d >= st && d <= en;
    };

    for (const r of (confRows || [])) {
      const grupo = String(r.referencia_mes || '').slice(0, 7);
      const dia = toYMD(r.vigencia_dia);
      if (!grupo || !dia) continue;
      if (!inRange(dia)) continue;
      const set = mesParaDiasValidos.get(grupo) || new Set();
      set.add(dia);
      mesParaDiasValidos.set(grupo, set);
      diaParaGrupo.set(dia, grupo);
    }

    const diasValidosNoPeriodo = [];
    for (const [, setDias] of mesParaDiasValidos.entries()) for (const dia of setDias) diasValidosNoPeriodo.push(dia);

    return { mesParaDiasValidos, diaParaGrupo, diasValidosNoPeriodo };
  }

  async _buildWhitelistCnpjsPorEstado() {
    const ESTADO_IDS = String(process.env.RANKING_ESTADO_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (ESTADO_IDS.length === 0) return null;

    const endRows = await this.db.sequelize.query(
      `
      SELECT id FROM \`corretoras_enderecos\`
      WHERE estado_ID IN (${ESTADO_IDS.map(() => '?').join(',')})
      `,
      { replacements: ESTADO_IDS, type: this.db.Sequelize.QueryTypes.SELECT }
    );
    const endIds = endRows.map(r => String(r.id));
    if (endIds.length === 0) throw new Error("Whitelist de corretoras vazia (nenhum endereço para os estado_ID informados).");

    const corRows = await this.db.sequelize.query(
      `
      SELECT c.cnpj
      FROM \`corretoras\` c
      WHERE c.endereco_ID IN (${endIds.map(() => '?').join(',')})
      UNION
      SELECT c2.cnpj
      FROM \`corretoras\` c2
      WHERE c2.endereco_ID IN (${endIds.map(() => '?').join(',')})
      `,
      { replacements: [...endIds, ...endIds], type: this.db.Sequelize.QueryTypes.SELECT }
    );
    const whitelistCnpjs = new Set(corRows.map(r => normDigits(r.cnpj)));
    if (whitelistCnpjs.size === 0) throw new Error("Whitelist de corretoras vazia após aplicar os filtros informados (estado_ID). Revise os cadastros.");
    return whitelistCnpjs;
  }

  // ------------------ pipeline principal ------------------
  async gerarEPersistir({ inicio, fim }) {
    if (!inicio || !fim) throw new Error("Parâmetros 'inicio' e 'fim' são obrigatórios");

    // carrega excluídos
    await this._loadExcluidosSet();

    // Vigências/grupos válidos (modo estrito)
    const { diaParaGrupo, diasValidosNoPeriodo } = await this._carregarVigenciasValidas(inicio, fim);
    if (diasValidosNoPeriodo.length === 0) {
      throw new Error("Não há vigências ativas configuradas dentro do período informado (modo estrito).");
    }

    // carrega beneficiários (fallback p/ model legado)
    let benRows;
    try {
      benRows = await this.db.sequelize.query(
        "SELECT * FROM `automation_cliente_digital_beneficiarios`",
        { type: this.db.Sequelize.QueryTypes.SELECT }
      );
    } catch {
      benRows = await this.db.beneficiariosDigital.findAll({ raw: true });
    }

    const whitelistCnpjs = await this._buildWhitelistCnpjsPorEstado();

    const byCpfContrato = new Map();
    const byCpfDia = new Map();
    const byCpfGrupo = new Map();

    for (const b of benRows) {
      const subest = String(b.subestipulante || '').trim();
      if (subest.toLowerCase() === 'empresas') continue;

      const cpf = normDigits(b.documento_corretor || b.documento_corretora);
      if (!cpf) continue;
      if (this._isExcluido(cpf)) continue; // << excluídos

      if (whitelistCnpjs) {
        const cnpj = normDigits(b.documento_corretora || b.documento_corretor || b.cnpj_corretora);
        if (!cnpj || !whitelistCnpjs.has(cnpj)) continue;
      }

      const ymd = toYMD(b.vigencia);
      if (!ymd) continue;
      if (!diaParaGrupo.has(ymd)) continue;
      const grupo = String(diaParaGrupo.get(ymd));

      const rawCod = String(b.codigo_do_contrato || '');
      const cod = normContrato(rawCod);

      // por contrato
      let mapContrato = byCpfContrato.get(cpf);
      if (!mapContrato) { mapContrato = new Map(); byCpfContrato.set(cpf, mapContrato); }
      if (cod) {
        let entry = mapContrato.get(cod);
        if (!entry) { entry = { valorContratoCent: 0, rows: [], grupos: new Set(), dias: new Set() }; mapContrato.set(cod, entry); }
        entry.rows.push(b);
        entry.grupos.add(grupo);
        entry.dias.add(ymd);
        const val = parseMoneyToCents(b.valor_contrato);
        if (String(b.tipo_de_beneficiario || '').toLowerCase() === 'titular') {
          if (val > 0) entry.valorContratoCent = val;
        } else if (!entry.valorContratoCent && val > 0) {
          entry.valorContratoCent = val;
        }
      }

      // por dia
      let mapDia = byCpfDia.get(cpf);
      if (!mapDia) { mapDia = new Map(); byCpfDia.set(cpf, mapDia); }
      let gDia = mapDia.get(ymd);
      if (!gDia) { gDia = { rows: [], contratos: new Set() }; mapDia.set(ymd, gDia); }
      gDia.rows.push(b);
      if (cod) gDia.contratos.add(cod);

      // por grupo
      let mapGrupo = byCpfGrupo.get(cpf);
      if (!mapGrupo) { mapGrupo = new Map(); byCpfGrupo.set(cpf, mapGrupo); }
      let gGrupo = mapGrupo.get(grupo);
      if (!gGrupo) { gGrupo = { rows: [], contratos: new Set() }; mapGrupo.set(grupo, gGrupo); }
      gGrupo.rows.push(b);
      if (cod) gGrupo.contratos.add(cod);
    }

    // status de contratos (com cache persistente e rate limit)
    const limiter = withRateLimit({ concurrency: this.paralelo, minDelayMs: 200 });
    const contratoPago = new Map();
    const allCodigos = new Set();
    for (const mapContrato of byCpfContrato.values()) for (const cod of mapContrato.keys()) allCodigos.add(cod);

    await Promise.all(Array.from(allCodigos).map(cod => limiter(async () => {
      const pago = await this._getContratoPagoComCache(cod);
      contratoPago.set(cod, pago);
    })));

    const onlyTit = (x) => this.soTitular ? String(x.tipo_de_beneficiario || '').toLowerCase() === 'titular' : true;

    const conta = (rows, contratosSet, getValorContrato) => {
      const vendidas = rows.filter(onlyTit).length;
      const ativas = rows.filter(r => onlyTit(r) && isActive(r)).length;

      let confirmadas = 0;
      let confirmadasAtivas = 0;
      for (const r of rows) {
        if (!onlyTit(r)) continue;
        const cod = normContrato(r.codigo_do_contrato);
        const pago = cod && contratoPago.get(cod);
        if (pago) {
          confirmadas++;
          if (isActive(r)) confirmadasAtivas++;
        }
      }

      const contratosVendidos = contratosSet.size;
      let contratosConfirmados = 0;
      let valorConfirmado = 0;
      for (const cod of contratosSet) {
        if (contratoPago.get(cod)) {
          contratosConfirmados++;
          valorConfirmado += getValorContrato(cod);
        }
      }
      return { vendidas, confirmadas, confirmadasAtivas, ativas, contratosVendidos, contratosConfirmados, valorConfirmado };
    };

    const linhas = [];

    // TOTAL
    for (const [cpf, mapDia] of byCpfDia.entries()) {
      const allRows = [];
      const cods = new Set();
      for (const g of mapDia.values()) { allRows.push(...g.rows); g.contratos.forEach(c => cods.add(c)); }
      if (!allRows.length) continue;

      const meta = await this._getMetaByCpf(cpf, allRows[0]);
      const mapContrato = byCpfContrato.get(cpf);
      const getValor = (cod) => (mapContrato?.get(cod)?.valorContratoCent) || 0;
      const r = conta(allRows, cods, getValor);

      linhas.push({ escopo: 'NACIONAL', uf: null, janela: 'TOTAL', vigencia: null, cpf, nome: meta.nome, ufMeta: meta.uf, ...r });
      if (meta.uf) {
        linhas.push({ escopo: 'UF', uf: meta.uf, janela: 'TOTAL', vigencia: null, cpf, nome: meta.nome, ufMeta: meta.uf, ...r });
      }
    }

    // DIA
    for (const [cpf, mapDia] of byCpfDia.entries()) {
      const firstBucket = mapDia.values().next().value;
      const meta = await this._getMetaByCpf(cpf, firstBucket?.rows?.[0]);
      const mapContrato = byCpfContrato.get(cpf);
      const getValor = (cod) => (mapContrato?.get(cod)?.valorContratoCent) || 0;

      for (const [ymd, g] of mapDia.entries()) {
        if (!g.rows.length) continue;
        const r = conta(g.rows, g.contratos, getValor);

        linhas.push({ escopo: 'NACIONAL', uf: null, janela: 'DIA', vigencia: ymd, cpf, nome: meta.nome, ufMeta: meta.uf, ...r });
        if (meta.uf) {
          linhas.push({ escopo: 'UF', uf: meta.uf, janela: 'DIA', vigencia: ymd, cpf, nome: meta.nome, ufMeta: meta.uf, ...r });
        }
      }
    }

    // GRUPO (MES compat.)
    for (const [cpf, mapGrupo] of byCpfGrupo.entries()) {
      const any = mapGrupo.values().next().value;
      const meta = await this._getMetaByCpf(cpf, any?.rows?.[0]);
      const mapContrato = byCpfContrato.get(cpf);
      const getValor = (cod) => (mapContrato?.get(cod)?.valorContratoCent) || 0;

      for (const [grupo, g] of mapGrupo.entries()) {
        if (!g.rows.length) continue;
        const r = conta(g.rows, g.contratos, getValor);

        linhas.push({ escopo: 'NACIONAL', uf: null, janela: 'MES', vigencia: grupo, cpf, nome: meta.nome, ufMeta: meta.uf, ...r });
        if (meta.uf) {
          linhas.push({ escopo: 'UF', uf: meta.uf, janela: 'MES', vigencia: grupo, cpf, nome: meta.nome, ufMeta: meta.uf, ...r });
        }
      }
    }

    const bucketKey = (ln) => `${ln.escopo}:${ln.uf || 'NA'}|${ln.janela}:${ln.vigencia || 'TOTAL'}`;

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
            String(a.nome || '').localeCompare(String(b.nome || '')) ||
            String(a.cpf).localeCompare(String(b.cpf));
        } else {
          return (b.confirmadas - a.confirmadas) ||
            (b.valorConfirmado - a.valorConfirmado) ||
            (b.vendidas - a.vendidas) ||
            String(a.nome || '').localeCompare(String(b.nome || '')) ||
            String(a.cpf).localeCompare(String(b.cpf));
        }
      });

      const primary = isTotal ? sorted.map(x => x.confirmadasAtivas) : sorted.map(x => x.confirmadas);
      const top1 = primary[0] || 0, top2 = primary[1] || 0, top3 = primary[2] || 0;

      sorted.forEach((ln, i) => {
        ranked.push({
          escopo: ln.escopo,
          uf: ln.uf,
          janela: ln.janela,
          vigencia: ln.vigencia,
          corretor_cpf: ln.cpf,
          nome_corretor: ln.nome,
          vidas_vendidas: ln.vendidas,
          vidas_confirmadas: ln.confirmadas,
          vidas_ativas: ln.ativas,
          vidas_confirmadas_ativas: ln.confirmadasAtivas,
          contratos_unicos_vendidos: ln.contratosVendidos,
          contratos_unicos_confirmados: ln.contratosConfirmados,
          valor_confirmado_contratos_cent: ln.valorConfirmado,
          rank_confirmadas: i + 1,
          faltam_para_primeiro: Math.max(0, top1 - (isTotal ? ln.confirmadasAtivas : ln.confirmadas)),
          faltam_para_segundo: Math.max(0, top2 - (isTotal ? ln.confirmadasAtivas : ln.confirmadas)),
          faltam_para_terceiro: Math.max(0, top3 - (isTotal ? ln.confirmadasAtivas : ln.confirmadas)),
        });
      });
    }

    if (ranked.length === 0) {
      throw new Error("Não há vendas elegíveis nas vigências ativas do período informado.");
    }

    const exec = await this.tblExec.create({
      data_inicio_campanha: new Date(inicio),
      data_fim_campanha: new Date(fim),
    });

    await this.tblRes.bulkCreate(ranked.map(ln => ({
      execucao_id: exec.id,
      escopo: ln.escopo,
      uf: ln.uf,
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
    })), {
      updateOnDuplicate: [
        'nome_corretor', 'vidas_vendidas', 'vidas_confirmadas', 'vidas_ativas', 'vidas_confirmadas_ativas',
        'contratos_unicos_vendidos', 'contratos_unicos_confirmados',
        'valor_confirmado_contratos_cent', 'rank_confirmadas',
        'faltam_para_primeiro', 'faltam_para_segundo', 'faltam_para_terceiro'
      ]
    });

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

    const where = { execucao_id: id, janela: 'TOTAL', vigencia: null };
    if (String(escopo || 'NACIONAL').toUpperCase() === 'UF') {
      where.escopo = 'UF';
      if (uf) where.uf = String(uf).toUpperCase();
    } else { where.escopo = 'NACIONAL'; where.uf = null; }

    const ord = [['rank_confirmadas', 'ASC'], ['corretor_cpf', 'ASC']];
    const lim = Number(limit) > 0 ? Math.min(Number(limit), 100) : null;

    let topRows = await this.tblRes.findAll({
      where, order: ord, ...(lim ? { limit: lim * 3 } : {}), raw: true
    });
    topRows = await this._filterOutExcluidos(topRows);
    if (lim) topRows = topRows.slice(0, lim);

    let alvo = null, alvo_in_top = false;
    if (cpf) {
      const cpfN = normDigits(cpf);
      const a = await this.tblRes.findOne({ where: { ...where, corretor_cpf: cpfN }, raw: true });
      if (a && !(await this._isExcluido(cpfN))) alvo = a;
      if (alvo && topRows.length) alvo_in_top = topRows.some(r => r.corretor_cpf === cpfN);
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

    const vig = J === 'DIA' ? toYMD(vigencia) : (String(vigencia || '').slice(0, 7));
    if (!vig) throw new Error(J === 'DIA' ? "vigencia precisa ser YYYY-MM-DD" : "vigencia precisa ser YYYY-MM");

    const where = { execucao_id: id, janela: J, vigencia: vig };
    if (String(escopo || 'NACIONAL').toUpperCase() === 'UF') {
      where.escopo = 'UF';
      if (!uf) throw new Error("Informe 'uf' quando escopo=UF");
      where.uf = String(uf).toUpperCase();
    } else { where.escopo = 'NACIONAL'; where.uf = null; }

    const ord = [['rank_confirmadas', 'ASC'], ['corretor_cpf', 'ASC']];
    const lim = Number(limit) > 0 ? Math.min(Number(limit), 100) : null;

    let topRows = await this.tblRes.findAll({
      where, order: ord, ...(lim ? { limit: lim * 3 } : {}), raw: true
    });
    topRows = await this._filterOutExcluidos(topRows);
    if (lim) topRows = topRows.slice(0, lim);

    let alvo = null, alvo_in_top = false;
    if (cpf) {
      const cpfN = normDigits(cpf);
      const a = await this.tblRes.findOne({ where: { ...where, corretor_cpf: cpfN }, raw: true });
      if (a && !(await this._isExcluido(cpfN))) alvo = a;
      if (alvo && topRows.length) alvo_in_top = topRows.some(r => r.corretor_cpf === cpfN);
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

    const cpfN = normDigits(cpf);
    if (!cpfN) throw new Error("Informe 'cpf' (apenas dígitos)");

    await this._loadExcluidosSet();
    if (this._isExcluido(cpfN)) {
      return { execucaoId: id, janela: J, cpf: cpfN, lista: [] };
    }

    const where = { execucao_id: id, janela: J, escopo: 'NACIONAL', corretor_cpf: cpfN };
    const ord = [['vigencia', 'ASC']];
    const qOpts = { where, order: ord, raw: true };
    if (Number(limit) > 0) qOpts.limit = Math.min(Number(limit), 1000);

    const rows = await this.tblRes.findAll(qOpts);

    const stripValor = (r) => {
      if (!r) return r;
      if (String(incluirValor) === 'true') return r;
      const { valor_confirmado_contratos_cent, ...rest } = r;
      return rest;
    };

    return { execucaoId: id, janela: J, cpf: cpfN, lista: rows.map(stripValor) };
  }

  async consultarPorOperadora({ execucaoId, operadora, limit, cpf, incluirValor, escopo, uf }) {
    const id = await this._resolveExec(execucaoId);
    if (!id) return { execucaoId: null, operadoras: [] };

    await this._loadExcluidosSet();

    const exec = await this.tblExec.findByPk(id, { raw: true });
    if (!exec) return { execucaoId: id, operadoras: [] };
    const inicio = String(exec.data_inicio_campanha).slice(0, 10);
    const fim = String(exec.data_fim_campanha).slice(0, 10);

    const { diaParaGrupo, diasValidosNoPeriodo } = await this._carregarVigenciasValidas(inicio, fim);
    if (diasValidosNoPeriodo.length === 0) {
      return { execucaoId: id, operadoras: [], mensagem: "Não há vigências ativas no período desta execução." };
    }

    // operadoras
    let operadorasLista = [];
    try {
      const rows = await this.tblOper.findAll({ where: { ativo: true }, raw: true }).catch(() => []);
      operadorasLista = rows.map(r => r.nome || r.operadora || r.titulo).filter(Boolean);
    } catch { /* ignore */ }

    const filtrarTodas = !operadora || String(operadora).toLowerCase() === 'todas';
    const alvoOperadoras = filtrarTodas ? operadorasLista : [String(operadora)];

    // beneficiários
    let benRows;
    try {
      benRows = await this.db.sequelize.query(
        "SELECT * FROM `automation_cliente_digital_beneficiarios`",
        { type: this.db.Sequelize.QueryTypes.SELECT }
      );
    } catch {
      benRows = await this.db.beneficiariosDigital.findAll({ raw: true });
    }

    const whitelistCnpjs = await this._buildWhitelistCnpjsPorEstado();

    const porOperadora = new Map();
    const byCpfContrato = new Map();

    for (const b of benRows) {
      const subest = String(b.subestipulante || '').trim();
      if (subest.toLowerCase() === 'empresas') continue;

      const cpfRow = normDigits(b.documento_corretor || b.documento_corretora);
      if (!cpfRow) continue;
      if (this._isExcluido(cpfRow)) continue;

      if (whitelistCnpjs) {
        const cnpj = normDigits(b.documento_corretora || b.documento_corretor || b.cnpj_corretora);
        if (!cnpj || !whitelistCnpjs.has(cnpj)) continue;
      }

      const ymd = toYMD(b.vigencia);
      if (!ymd) continue;
      if (!diaParaGrupo.has(ymd)) continue;

      const nomeOp = String(b.operadora || '').trim();
      if (!nomeOp) continue;
      if (!filtrarTodas && !alvoOperadoras.some(x => String(x).trim().toLowerCase() === nomeOp.toLowerCase())) continue;

      const cod = normContrato(b.codigo_do_contrato || '');

      let mapCpf = porOperadora.get(nomeOp);
      if (!mapCpf) { mapCpf = new Map(); porOperadora.set(nomeOp, mapCpf); }
      let bucket = mapCpf.get(cpfRow);
      if (!bucket) { bucket = { rows: [], contratos: new Set(), sampleRow: b }; mapCpf.set(cpfRow, bucket); }
      bucket.rows.push(b);
      if (cod) bucket.contratos.add(cod);

      if (cod) {
        let mapContrato = byCpfContrato.get(cpfRow);
        if (!mapContrato) { mapContrato = new Map(); byCpfContrato.set(cpfRow, mapContrato); }
        let entry = mapContrato.get(cod);
        if (!entry) { entry = { valorContratoCent: 0 }; mapContrato.set(cod, entry); }
        const val = parseMoneyToCents(b.valor_contrato);
        if (String(b.tipo_de_beneficiario || '').toLowerCase() === 'titular') {
          if (val > 0) entry.valorContratoCent = val;
        } else if (!entry.valorContratoCent && val > 0) {
          entry.valorContratoCent = val;
        }
      }
    }

    // status de contratos via cache
    const limiter = withRateLimit({ concurrency: this.paralelo, minDelayMs: 200 });
    const contratoPago = new Map();
    const allCodigos = new Set();
    for (const mapCpf of porOperadora.values()) for (const { contratos } of mapCpf.values()) contratos.forEach(c => allCodigos.add(c));
    await Promise.all(Array.from(allCodigos).map(cod => limiter(async () => {
      const pago = await this._getContratoPagoComCache(cod);
      contratoPago.set(cod, pago);
    })));

    const onlyTit = (x) => this.soTitular ? String(x.tipo_de_beneficiario || '').toLowerCase() === 'titular' : true;
    const getValor = (cpf, cod) => (byCpfContrato.get(cpf)?.get(cod)?.valorContratoCent) || 0;

    const montarTop = async (mapCpf, nomeOperadora) => {
      const linhas = [];
      for (const [cpfRow, bucket] of mapCpf.entries()) {
        const rows = bucket.rows;
        const cods = bucket.contratos;
        if (!rows.length) continue;

        const meta = await this._getMetaByCpf(cpfRow, bucket.sampleRow);

        const vendidas = rows.filter(onlyTit).length;
        const ativas = rows.filter(r => onlyTit(r) && isActive(r)).length;

        let confirmadas = 0;
        let confirmadasAtivas = 0;
        let valorConfirmado = 0;
        let contratosConfirmados = 0;

        for (const r of rows) {
          if (!onlyTit(r)) continue;
          const cod = normContrato(r.codigo_do_contrato);
          const pago = cod && contratoPago.get(cod);
          if (pago) {
            confirmadas++;
            if (isActive(r)) confirmadasAtivas++;
          }
        }
        for (const cod of cods) {
          if (contratoPago.get(cod)) {
            contratosConfirmados++;
            valorConfirmado += getValor(cpfRow, cod);
          }
        }

        linhas.push({
          operadora: nomeOperadora,
          escopo: String(escopo || 'NACIONAL').toUpperCase() === 'UF' ? 'UF' : 'NACIONAL',
          uf: meta.uf && String(escopo || 'NACIONAL').toUpperCase() === 'UF' ? meta.uf : null,
          janela: 'TOTAL',
          vigencia: null,
          cpf: cpfRow, nome: meta.nome,
          vendidas, confirmadas, confirmadasAtivas, ativas,
          contratosVendidos: cods.size,
          contratosConfirmados,
          valorConfirmado
        });
      }

      const sorted = linhas.sort((a, b) =>
        (b.confirmadasAtivas - a.confirmadasAtivas) ||
        (b.valorConfirmado - a.valorConfirmado) ||
        (b.ativas - a.ativas) ||
        (b.confirmadas - a.confirmadas) ||
        (b.vendidas - a.vendidas) ||
        String(a.nome || '').localeCompare(String(b.nome || '')) ||
        String(a.cpf).localeCompare(String(b.cpf))
      );

      let alvo = null, alvo_in_top = false;
      if (cpf) {
        const cpfN = normDigits(cpf);
        alvo = sorted.find(r => r.cpf === cpfN) || null;
        if (alvo) alvo_in_top = true;
      }

      const lim = Number(limit) > 0 ? Math.min(Number(limit), 100) : null;
      const top = lim ? sorted.slice(0, lim) : sorted;

      const stripValor = (r) => {
        if (!r) return r;
        if (String(incluirValor) === 'true') return r;
        const { valorConfirmado, ...rest } = r;
        return rest;
      };

      return { operadora: nomeOperadora, top: top.map(stripValor), alvo: stripValor(alvo), alvo_in_top };
    };

    const respostas = [];
    const conjunto = filtrarTodas ? (operadorasLista.length ? operadorasLista : Array.from(porOperadora.keys())) : alvoOperadoras;
    for (const nome of conjunto) {
      const mapCpf = porOperadora.get(nome) || new Map();
      const pacote = await montarTop(mapCpf, nome);
      respostas.push(pacote);
    }

    return { execucaoId: id, operadoras: respostas };
  }
}

module.exports = { RankingService };
