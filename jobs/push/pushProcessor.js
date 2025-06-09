const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const axios = require("../../micro_services/micro_service_apis_clientes/app/config/axios/axios.config.js");
const gerarMensagemPushPorStatusFatura = require("../../utils/push/pushTemplates.js");
const db = require("../../models");

const PushLogs = db.push_logs;

module.exports = async function (job) {
  console.log('📥 Job recebido:', job.data);

  const { dispositivo, fatura, tipo, dias_vencido } = job.data;

  if (!dispositivo?.player_id || !fatura?.codigo) {
    console.warn("⚠️ Dados incompletos para envio de push:", job.data);
    return;
  }

  const codigoContrato = fatura.contratoID;
  if (!codigoContrato) {
    console.warn("❌ contratoID ausente na fatura:", fatura);
    return;
  }

  let faturaAtualizada = null;
  try {
    const pendenteResp = await axios.https_digital.get(`/fatura/procurarPorContrato?codigoContrato=${codigoContrato}&idStatusFatura=2&pix=1`);
    faturaAtualizada = pendenteResp.data.find(item => item.codigo === fatura.codigo);
  } catch (e) {
    console.warn("⚠️ Erro ao buscar faturas pendentes:", e.response?.data || e.message);
  }

  if (!faturaAtualizada) {
    try {
      const vencidaResp = await axios.https_digital.get(`/fatura/procurarPorContrato?codigoContrato=${codigoContrato}&idStatusFatura=4&pix=1`);
      faturaAtualizada = vencidaResp.data.find(item => item.codigo === fatura.codigo);
    } catch (e) {
      console.warn("⚠️ Erro ao buscar faturas vencidas:", e.response?.data || e.message);
    }
  }

  if (!faturaAtualizada) {
    console.log(`⛔️ Fatura ${fatura.codigo} não localizada em status 2 nem 4. Push cancelado.`);
    return;
  }

  const statusAtual = faturaAtualizada?.statusFatura?.id;
  console.log("📊 Status atual da fatura:", statusAtual);

  const mensagem = gerarMensagemPushPorStatusFatura(faturaAtualizada, tipo, dias_vencido || 0);

  const payload = {
    app_id: process.env.ONESIGNALAPPID,
    include_player_ids: [dispositivo.player_id],
    headings: mensagem.headings,
    contents: mensagem.contents,
    data: {
      rota: "boleto"
    }
  };

  try {
    await axios.https_onesignal.post("/notifications", payload);

    await PushLogs.create({
      user_id: dispositivo.user_id,
      player_id: dispositivo.player_id, // <- importante para diferenciar logs por dispositivo
      tipo,
      data_envio: new Date(),
      fatura_codigo: fatura.codigo,
      fatura_url: fatura.linkFatura,
      mensagem: mensagem.contents.pt,
      status: "enviado",
      dias_vencido
    });

    console.log(`✅ Push enviado e registrado no banco para user_id=${dispositivo.user_id} / player_id=${dispositivo.player_id}`);
  } catch (err) {
    console.error("❌ Erro ao enviar push ou salvar no banco:", err.response?.data || err.message);
  }
};
