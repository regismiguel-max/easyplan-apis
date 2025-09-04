const axiosCfg = require("../../config/axios/axios.config");

class DigitalSaudeClient {
  async _fetchLiquidadas(inst, code) {
    try {
      const resp = await inst.get("/fatura/procurarLiquidadasPorContrato", {
        params: { codigoContrato: code },
        validateStatus: s => (s >= 200 && s < 300) || s === 400,
      });

      if (process.env.RANKING_DEBUG_FATURAS === "1") {
        const len = Array.isArray(resp.data) ? resp.data.length : "NA";
        console.log(
          `[FATURAS] base=${inst.defaults?.baseURL || "undefined"} code=${code} status=${resp.status} len=${len}`
        );
      }

      if (resp.status === 400) return [];
      return Array.isArray(resp.data) ? resp.data : [];
    } catch (e) {
      if (process.env.RANKING_DEBUG_FATURAS === "1") {
        console.log(
          `[FATURAS][ERR] base=${inst.defaults?.baseURL || "undefined"} code=${code} -> ${e.message}`
        );
      }
      return null;
    }
  }

  async consultarStatusFaturaPorContrato(codigoContrato) {
    const code = String(codigoContrato || "").trim();
    if (!code) return [];

    const tries = [axiosCfg.https_digital, axiosCfg.https].filter(Boolean);

    for (const inst of tries) {
      const out = await this._fetchLiquidadas(inst, code);
      if (out !== null) return out;
    }

    return [];
  }
}

module.exports = { DigitalSaudeClient };
