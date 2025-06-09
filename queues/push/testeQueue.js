const pushQueue = require('./pushQueue');

pushQueue.add({
  dispositivo: { player_id: 'teste-player', user_id: 99 },
  fatura: {
    codigo: 'teste-codigo',
    contratoID: 'contrato-teste',
    linkFatura: 'https://example.com'
  },
  tipo: 'emitido_inicial',
  dias_vencido: 0
}).then(() => {
  console.log('✅ Job de teste adicionado com sucesso.');
}).catch((err) => {
  console.error('❌ Erro ao adicionar job:', err);
});
