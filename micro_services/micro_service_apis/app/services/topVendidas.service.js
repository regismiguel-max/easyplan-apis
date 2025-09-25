const path = require("path");
const { QueryTypes } = require("sequelize");

const UF_NACIONAL = "NA";
const OPERADORA_GERAL = "GERAL";
const isYM = (s) => /^\d{4}-\d{2}$/.test(String(s || ""));
const normDigits = (s) => String(s || "").replace(/\D+/g, "");

class TopVendidasService {
    constructor() {
        this.db = require(path.resolve(__dirname, "../../../../models"));
        this.tblExec = this.db.rk_execucoes;
        this.tblVig = this.db.produtores_ranking_vigencias_validas;
        this.tblRes = this.db.produtores_ranking_resultados;   // tabela certa (tem 'operadora')
        this.tblExcl = this.db.rk_exclusoes;
        this.sequelize = this.db.sequelize;

        this._exclSet = null;
    }

    async _loadExcluidosSet() {
        if (this._exclSet) return this._exclSet;
        try {
            const rows = await this.tblExcl.findAll({ where: { ativo: true }, raw: true });
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

    async _resolveLastExecucaoId() {
        const last = await this.tblExec.findOne({ order: [["id", "DESC"]], raw: true });
        return last?.id || null;
    }

    /** MES “atual”: prefere cadastro ativo; fallback = maior vigência mensal nos resultados. */
    async _resolveMesAtualReferencia(execucaoId) {
        try {
            const rowV = await this.sequelize.query(
                `SELECT MAX(SUBSTRING(referencia_mes,1,7)) AS mesRef
           FROM produtores_ranking_vigencias_validas
          WHERE ativo = 1`,
                { type: QueryTypes.SELECT }
            );
            const mesRefV = rowV?.[0]?.mesRef || null;
            if (mesRefV) return mesRefV;
        } catch { /* ignore */ }

        const rowR = await this.sequelize.query(
            `SELECT MAX(vigencia) AS mesRef
         FROM produtores_ranking_resultados
        WHERE execucao_id = :id
          AND escopo = 'NACIONAL' AND uf = :uf
          AND janela = 'MES'`,
            { replacements: { id: execucaoId, uf: UF_NACIONAL }, type: QueryTypes.SELECT }
        );
        return rowR?.[0]?.mesRef ?? null;
    }

    /**
     * Se 'vigenciaMes' (YYYY-MM) vier, usa-o para a janela MES.
     * Senão, resolve automaticamente a referência. TOTAL sempre vem junto.
     *
     * Saída:
     * {
     *   execucaoId,
     *   referenciaMES,
     *   geral: { TOTAL: Rank[], MES: Rank[] }
     * }
     * Rank = { rank, corretor_cpf, nome_corretor, vidas_vendidas, vidas_confirmadas }
     */
    async buscarTopVendidas({ limit = 10, vigenciaMes }) {
        const execucaoId = await this._resolveLastExecucaoId();
        if (!execucaoId) {
            return { execucaoId: null, referenciaMES: null, geral: { TOTAL: [], MES: [] } };
        }

        // Mês da janela MES
        let mesRef = null;
        if (vigenciaMes && isYM(vigenciaMes)) mesRef = String(vigenciaMes);
        else mesRef = await this._resolveMesAtualReferencia(execucaoId);

        await this._loadExcluidosSet();

        // Query única: pega apenas GERAL (operadora='GERAL'), NACIONAL/NA, TOTAL + MES(mesRef)
        const rows = await this.sequelize.query(
            `
      WITH base AS (
        SELECT
          rr.janela,
          rr.vigencia,
          rr.corretor_cpf,
          rr.nome_corretor,
          rr.vidas_vendidas,
          rr.vidas_confirmadas
        FROM produtores_ranking_resultados rr
        WHERE rr.execucao_id = :execucaoId
          AND rr.escopo = 'NACIONAL'
          AND rr.uf = :uf
          AND rr.operadora = :opGeral
          AND (
                (rr.janela = 'TOTAL' AND rr.vigencia IS NULL)
             OR (:mesRefOk = 1 AND rr.janela = 'MES' AND rr.vigencia = :mesRef)
          )
      ),
      ranked AS (
        SELECT
          b.*,
          ROW_NUMBER() OVER (
            PARTITION BY b.janela
            ORDER BY b.vidas_vendidas DESC,
                     b.nome_corretor ASC,
                     b.corretor_cpf ASC
          ) AS rnk
        FROM base b
      )
      SELECT *
      FROM ranked
      WHERE rnk <= :limit
      ORDER BY janela, rnk
      `,
            {
                replacements: {
                    execucaoId,
                    uf: UF_NACIONAL,
                    opGeral: OPERADORA_GERAL,
                    mesRef,
                    mesRefOk: mesRef ? 1 : 0,
                    limit: Number(limit) > 0 ? Number(limit) : 10
                },
                type: QueryTypes.SELECT
            }
        );

        // Filtro de excluídos
        const filtered = rows.filter(r => !this._isExcluido(r.corretor_cpf));

        // Organizar saída
        const geral = { TOTAL: [], MES: [] };

        const pushItem = (arr, r, rank) => {
            arr.push({
                rank,
                corretor_cpf: r.corretor_cpf,
                nome_corretor: r.nome_corretor,
                vidas_vendidas: Number(r.vidas_vendidas || 0),
                vidas_confirmadas: Number(r.vidas_confirmadas || 0)
            });
        };

        const byJanela = new Map(); // janela -> rows ordenadas
        for (const r of filtered) {
            if (!byJanela.has(r.janela)) byJanela.set(r.janela, []);
            byJanela.get(r.janela).push(r);
        }

        for (const [janela, list] of byJanela) {
            list.forEach((r, i) => {
                const rank = i + 1;
                if (janela === "TOTAL") pushItem(geral.TOTAL, r, rank);
                if (janela === "MES") pushItem(geral.MES, r, rank);
            });
        }

        return {
            execucaoId,
            referenciaMES: mesRef,
            geral
        };
    }
}

module.exports = { TopVendidasService };
