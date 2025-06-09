const db = require("../../../../../models");
const buscarBoletosPendentesOuVencidos = require("../../utils/buscarBoletos.js");
const pushQueue = require("../../../../../queues/push/pushQueue.js");
const { Op } = require("sequelize");

const PushDispositivos = db.push_dispositivos;
const PushLogs = db.push_logs;
const User = db.user_client;

const parseDataVencimento = (dataString) => {
  const [dia, mes, ano] = dataString.split("/");
  return new Date(`${ano}-${mes}-${dia}T00:00:00-03:00`);
};

const diasEntreDatas = (data1, data2) => {
  const msPorDia = 1000 * 60 * 60 * 24;
  const diffMs = data2.setHours(0, 0, 0, 0) - data1.setHours(0, 0, 0, 0);
  return Math.floor(diffMs / msPorDia);
};

const pushJaEnviado = async (userId, playerId, faturaCodigo, tipo, dias_vencido = null) => {
  const where = {
    user_id: userId,
    player_id: playerId,
    fatura_codigo: faturaCodigo,
    tipo
  };
  if (dias_vencido !== null) where.dias_vencido = dias_vencido;

  const existente = await PushLogs.findOne({ where });
  return !!existente;
};

exports.dispararPushBoletos = async () => {
  const relatorio = [];

  try {
    const dispositivos = await PushDispositivos.findAll({ where: { is_logged_in: true } });

    for (const dispositivo of dispositivos) {
      if (!dispositivo.player_id) continue;

      const usuario = await User.findOne({ where: { id: dispositivo.user_id } });
      if (!usuario || !usuario.cpf) continue;

      const cpf = usuario.cpf.replace(/\D/g, "");
      const boletos = await buscarBoletosPendentesOuVencidos(cpf);

      if (!boletos.length) continue;

      for (const fatura of boletos) {
        const status = fatura.statusFatura?.id;
        const codigo = fatura.codigo;
        const vencimento = parseDataVencimento(fatura.dataVencimento);
        const hoje = new Date();
        const dias = diasEntreDatas(vencimento, hoje);

        let tipo = null;
        let dias_vencido = null;

        if (status === 2) {
          if (!(await pushJaEnviado(dispositivo.user_id, dispositivo.player_id, codigo, 'emitido_inicial'))) {
            tipo = 'emitido_inicial';
          } else if (dias === 0 && !(await pushJaEnviado(dispositivo.user_id, dispositivo.player_id, codigo, 'emitido_vencimento'))) {
            tipo = 'emitido_vencimento';
          }
        } else if (status === 4) {
          if (dias === 4 && !(await pushJaEnviado(dispositivo.user_id, dispositivo.player_id, codigo, 'vencido_4dias'))) {
            tipo = 'vencido_4dias';
          } else if (dias > 4 && dias % 3 === 1 && !(await pushJaEnviado(dispositivo.user_id, dispositivo.player_id, codigo, 'vencido_recorrente', dias))) {
            tipo = 'vencido_recorrente';
            dias_vencido = dias;
          }
        }

        if (!tipo) continue;

        const jobId = `${dispositivo.user_id}-${dispositivo.player_id}-${codigo}-${tipo}-${dias_vencido || 0}`;
        const delay = tipo === 'vencido_recorrente' ? 1000 * 60 * 30 : 0;

        await pushQueue.add({
          dispositivo,
          fatura: {
            codigo: fatura.codigo,
            linkFatura: fatura.linkFatura,
            contratoID: fatura.contratoID
          },
          tipo,
          dias_vencido
        }, {
          delay,
          jobId
        });

        relatorio.push({
          user_id: dispositivo.user_id,
          player_id: dispositivo.player_id,
          tipo,
          dias_vencido,
          fatura_codigo: codigo,
          vencimento: fatura.dataVencimento
        });
      }
    }

    console.log("✅ Pushs agendados com fila Bull. Total:", relatorio.length);
  } catch (error) {
    console.error("❌ Erro ao agendar pushs:", error);
  }
};
