const axiosCfg = require("../../config/axios/axios.config");

class PlaniumDnvClient {
    constructor() {
        this.inst = axiosCfg.https_dnv;
        if (!this.inst) throw new Error("Instância https_dnv inexistente.");

        // agora via ENV (fallback mantido)
        this.MIN_DATE_SIG = process.env.DNV_MIN_DATE_SIG || "2025-09-01";

        // UFs configuráveis: "GO,DF"
        const ufs = (process.env.DNV_ALLOWED_UFS || "GO,DF")
            .split(",")
            .map(s => s.trim().toUpperCase())
            .filter(Boolean);
        this.ALLOWED_UFS = new Set(ufs);
    }

    _normalize(resp) {
        const d = resp?.data;
        if (!d) return [];
        if (Array.isArray(d.propostas)) return d.propostas;
        if (Array.isArray(d.result)) return d.result;
        if (Array.isArray(d)) return d;
        if (d.propostas && typeof d.propostas === "object") {
            const vals = Object.values(d.propostas);
            if (Array.isArray(vals) && Array.isArray(vals[0])) return vals[0];
        }
        return [];
    }

    // tenta extrair UF de múltiplas chaves
    _getUF(p) {
        const candidates = [
            p?.uf,
            p?.UF,
            p?.metadados?.uf,
            p?.metadados?.uf_corretor,
            p?.metadados?.uf_contratacao,
        ];
        for (const v of candidates) {
            const s = (v ?? "").toString().trim().toUpperCase();
            if (/^[A-Z]{2}$/.test(s)) return s;
        }
        return null;
    }

    _filter(arr) {
        const alvo = '17591959680786';
        const rawHit = (arr || []).some(p => String(p?.propostaID) === alvo);
        const min = this.MIN_DATE_SIG;
        const allowedUFs = this.ALLOWED_UFS;

        // IDs de proposta que devem ser ignorados SEMPRE
        const BLOCKED_PROPOSTAS = new Set([
            '17603714939695'
        ]);

        const filtered = (arr || []).filter(p => {
            const propId = String(p?.propostaID || '');

            // se estiver na lista bloqueada, ignora
            if (BLOCKED_PROPOSTAS.has(propId)) {
                if (process.env.RANKING_DEBUG_DNV === '1') {
                    console.log('[DNV][DROP][BLOCKED_PROPOSTA]', propId);
                }
                return false;
            }

            const ds = p?.date_sig;
            const uf = this._getUF(p);
            return typeof ds === "string" && ds >= min && uf && allowedUFs.has(uf);
        });

        const keptHit = filtered.some(p => String(p?.propostaID) === alvo);
        if (process.env.RANKING_DEBUG_DNV === '1') {
            console.log('[DNV][TRACE] FILTER', { alvo, rawHit, keptHit, kept: filtered.length });
        }
        return filtered;
    }

    async consultarPeriodo({ cnpj_operadora, data_inicio, data_fim }) {
        const resp = await this.inst.post("proposta/consulta/v1", {
            cnpj_operadora, data_inicio, data_fim
        }, { validateStatus: s => s >= 200 && s < 300 });

        const arr = this._normalize(resp);
        if (process.env.RANKING_DEBUG_DNV === '1') {
            const alvo = '17591959680786';
            const hit = (arr || []).some(p => String(p?.propostaID) === alvo);
            console.log('[DNV][TRACE] RAW_HAS_ALVO?', { alvo, hit, total_raw: arr?.length || 0 });
        }
        return this._filter(arr);
    }

    async listarPorDia(cnpj_operadora, ymd) {
        return this.consultarPeriodo({ cnpj_operadora, data_inicio: ymd, data_fim: ymd });
    }
}

module.exports = { PlaniumDnvClient };