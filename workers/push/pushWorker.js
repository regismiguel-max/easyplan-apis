const pushQueue = require('../../queues/push/pushQueue');
const pushProcessor = require('../../jobs/push/pushProcessor');

pushQueue.process(async (job, done) => {
    try {
        console.log(`📥 Job recebido:`, job.data);
        await pushProcessor(job);
        done();
    } catch (error) {
        console.error("❌ Erro ao processar job:", error);
        done(error);
    }
});

console.log('👷‍♂️ Worker de push iniciado e escutando a fila push-boletos...');

pushQueue.on('completed', (job) => {
    console.log(`✅ Job ${job.id} processado com sucesso`);
});

pushQueue.on('failed', (job, err) => {
    console.error(`❌ Job ${job.id} falhou:`, err);
});


const { createLogger } = require('../../utils/logs/logger');
const log = createLogger('worker', 'pushWorker', 'pushWorker');

// Log manual de evento
log('👷 Worker de push iniciado');