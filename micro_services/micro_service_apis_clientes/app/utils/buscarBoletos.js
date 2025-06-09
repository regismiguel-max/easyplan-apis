const axios = require("../config/axios/axios.config.js");

module.exports = async function buscarBoletosPendentesOuVencidos(cpf) {
  const faturas = [];

  try {
    const { data: contratos } = await axios.https_digital.get(`/contrato/procurarPorCpfTitular?cpf=${cpf}`);

    if (!Array.isArray(contratos) || contratos.length === 0) return faturas;

    for (const contrato of contratos) {
      const status = contrato?.statusContrato?.nome;
      if (status !== 'Ativo' && status !== 'Suspenso') continue;

      const codigoContrato = contrato.codigo;

      const pendentes = await axios.https_digital.get(`/fatura/procurarPorContrato?codigoContrato=${codigoContrato}&idStatusFatura=2&pix=1`);
      const vencidas = await axios.https_digital.get(`/fatura/procurarPorContrato?codigoContrato=${codigoContrato}&idStatusFatura=4&pix=1`);

      if (Array.isArray(pendentes.data)) {
        pendentes.data.forEach(f => {
          faturas.push({
            codigo: f.codigo,
            dataVencimento: f.dataVencimento,
            linkFatura: f.linkFatura,
            statusFatura: f.statusFatura,
            beneficiario: f.beneficiario,
            pixList: f.pixList,
            linhaDigitavel: f.linhaDigitavel,
            valorCobranca: f.valorCobranca,
            contratoID: codigoContrato
          });
        });
      }

      if (Array.isArray(vencidas.data)) {
        vencidas.data.forEach(f => {
          faturas.push({
            codigo: f.codigo,
            dataVencimento: f.dataVencimento,
            linkFatura: f.linkFatura,
            statusFatura: f.statusFatura,
            beneficiario: f.beneficiario,
            pixList: f.pixList,
            linhaDigitavel: f.linhaDigitavel,
            valorCobranca: f.valorCobranca,
            contratoID: codigoContrato
          });
        });
      }
    }

  } catch (err) {
    console.error('Erro ao buscar boletos:', err);
  }

  return faturas;
};
