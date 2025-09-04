// services/planium/PlaniumDnvClient.js
const axiosCfg = require("../../config/axios/axios.config");

class PlaniumDnvClient {
    constructor() {
        this.inst = axiosCfg.https_dnv;
        if (!this.inst) {
            throw new Error("Instância https_dnv inexistente. Verifique config/axios/axios.config.js");
        }
    }

    // Normaliza diferentes formatos de resposta da DNV
    _normalize(resp) {
        const d = resp?.data;
        if (!d) return [];

        // Caso padrão observado:
        // { retcode: 0, propostas: [...] }
        if (Array.isArray(d.propostas)) return d.propostas;

        // Alguns serviços usam 'result'
        if (Array.isArray(d.result)) return d.result;

        // Às vezes a API já retorna array na raiz
        if (Array.isArray(d)) return d;

        // Última tentativa: se houver objeto com chave 'propostas' não-array, evita quebrar
        if (d.propostas && typeof d.propostas === 'object') {
            const vals = Object.values(d.propostas);
            if (Array.isArray(vals) && Array.isArray(vals[0])) return vals[0];
        }

        return [];
    }

    /**
     * POST /prod/proposta/consulta/v1
     * headers: Planium-apikey (configurado na instância)
     * body: { cnpj_operadora, data_inicio, data_fim }
     */
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
        return arr;
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
