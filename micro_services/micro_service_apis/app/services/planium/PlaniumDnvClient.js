const axiosCfg = require("../../config/axios/axios.config");

class PlaniumDnvClient {
    constructor() {
        this.inst = axiosCfg.https_dnv;
        if (!this.inst) {
            throw new Error("Instância https_dnv inexistente. Verifique config/axios/axios.config.js");
        }
        // Permite ajustar via env sem mexer no código. Default: 2025-09-01
        this.MIN_DATE_SIG = "2025-09-01";

        // UFs permitidas no filtro
        this.ALLOWED_UFS = new Set(["GO", "DF"]);
    }

    // Normaliza diferentes formatos de resposta da DNV
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

    // Filtra por date_sig >= MIN_DATE_SIG e UF permitida
    _filter(arr) {
        const min = this.MIN_DATE_SIG;
        const allowedUFs = this.ALLOWED_UFS;

        const filtered = (arr || []).filter(p => {
            const ds = p?.date_sig;
            const uf = (p?.uf || "").toString().trim().toUpperCase();
            return typeof ds === "string" && ds >= min && allowedUFs.has(uf);
        });

        if (process.env.RANKING_DEBUG_DNV === "1") {
            console.log(`[DNV] filtros aplicados (date_sig >= ${min}, uf in ${Array.from(allowedUFs).join(",")})`);
            console.log(`antes=${arr?.length || 0} depois=${filtered.length}`);
        }
        return filtered;
    }

    async consultarPeriodo({ cnpj_operadora, data_inicio, data_fim }) {
        const payload = { cnpj_operadora, data_inicio, data_fim };
        const url = "proposta/consulta/v1";

        const resp = await this.inst.post(url, payload, {
            validateStatus: (s) => s >= 200 && s < 300,
        });

        const arr = this._normalize(resp);
        if (process.env.RANKING_DEBUG_DNV === "1") {
            console.log(`[DNV] periodo=${data_inicio}..${data_fim} ret=${arr.length}`);
        }

        // ✅ aplica os filtros (date_sig + uf)
        return this._filter(arr);
    }

    async listarPorDia(cnpj_operadora, ymd) {
        return this.consultarPeriodo({
            cnpj_operadora,
            data_inicio: ymd,
            data_fim: ymd,
        });
    }
}

module.exports = { PlaniumDnvClient };