const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const fs = require('fs');
const moment = require('moment');
const { jobHorariosFixos, jobDezesseteTrinta } = require('./push/pushBoletos.cron.js');
const { jobVerifyStatusPaymentSwile } = require('./swile/swileStatusPayment.cron.js');
const { jobRanking } = require('./ranking/ranking.cron.js')
const { jobRankingWhatsApp } = require('./ranking/ranking-whatsapp.cron.js')
const {
    jobExpirePendings,
    jobSettleFinished,
    jobUpdateVigenciaRanking,
    jobUpdateCycleRanking
} = require('./duelo/produtores-duel-cron.js');

// Inicialização dos cron jobs
jobHorariosFixos.start();
// jobDezesseteTrinta.start();
jobVerifyStatusPaymentSwile.start();

// jobRanking.start();

// jobRankingWhatsApp.start();

// jobExpirePendings.start();
// jobSettleFinished.start();
// jobUpdateVigenciaRanking.start();
// jobUpdateCycleRanking.start();

console.log('⏱️ Cron server iniciado.');

const { createLogger } = require('../utils/logs/logger');
const log = createLogger('cron', 'cronServer', 'cronServer');

// Log manual de evento
log('🕐 cronServer inicializado');

// Exemplo de uso dentro de uma tarefa:
log('🔄 Executando tarefa agendada...');