const axiosCfg = require("../../config/axios/axios.config");

class DigitalSaudeClient {
  // util: espera em ms
  _sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
  }

  // retry genérico com backoff exponencial + jitter
  async _retry(fn, {
    attempts = Number(process.env.FATURAS_RETRY_ATTEMPTS || 6),
    baseMs = Number(process.env.FATURAS_BACKOFF_BASE_MS || 5000),
    factor = Number(process.env.FATURAS_BACKOFF_FACTOR || 2.0),
    maxMs = Number(process.env.FATURAS_BACKOFF_MAX_MS || 10000),
    jitter = true,
    tag = 'FATURAS'
  } = {}) {
    let lastErr = null;
    for (let i = 1; i <= attempts; i++) {
      try {
        const out = await fn(i);
        // nossa convenção: null = erro (retry), [] ou array = sucesso (não retry)
        if (out !== null) return out;
        lastErr = new Error('fetch returned null');
      } catch (e) {
        lastErr = e;
      }

      if (i < attempts) {
        // calcula backoff
        let wait = Math.min(maxMs, Math.round(baseMs * Math.pow(factor, i - 1)));
        if (jitter) {
          const rand = Math.random() * 0.4 + 0.85; // jitter ~±15%
          wait = Math.round(wait * rand);
        }
        if (process.env.RANKING_DEBUG_FATURAS === "1") {
          console.log(`[${tag}][RETRY] tentativa=${i}/${attempts} aguardando=${wait}ms motivo=${lastErr?.message || 'erro'}`);
        }
        await this._sleep(wait);
      }
    }
    if (process.env.RANKING_DEBUG_FATURAS === "1") {
      console.log(`[${tag}][RETRY][GAVEUP] após ${attempts} tentativas -> ${lastErr?.message || 'erro'}`);
    }
    return null;
  }

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
      // null sinaliza "tente novamente"
      return null;
    }
  }

  async consultarStatusFaturaPorContrato(codigoContrato) {
    const code = String(codigoContrato || "").trim();
    if (!code) return [];

    const tries = [axiosCfg.https_digital].filter(Boolean);

    for (const inst of tries) {
      const out = await this._retry(
        (attempt) => this._fetchLiquidadas(inst, code),
        {
          // pode ajustar via env sem mexer no código
          attempts: Number(process.env.FATURAS_RETRY_ATTEMPTS || 6),
          baseMs: Number(process.env.FATURAS_BACKOFF_BASE_MS || 5000),
          factor: Number(process.env.FATURAS_BACKOFF_FACTOR || 2.0),
          maxMs: Number(process.env.FATURAS_BACKOFF_MAX_MS || 10000),
          jitter: true,
          tag: 'FATURAS'
        }
      );
      if (out !== null) return out; // array (ok) ou [] (sem faturas)
    }

    return [];
  }
}

module.exports = { DigitalSaudeClient };
