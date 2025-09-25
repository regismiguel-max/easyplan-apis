const express = require("express");
const app = express();

require('./users/auth.routes')(app);
require('./users/user.routes')(app);
require('./card.routes')(app);

require('./apoio_vendas/files.routes')(app);
require('./apoio_vendas/operators.routes')(app);
require('./apoio_vendas/document.routes')(app);

require('./bonuses/loteBonuses.routes')(app);
require('./bonuses/bonuses.routes')(app);

require('./utils/estado.routes')(app);
require('./utils/cidade.routes')(app);
require('./utils/tipoContaBancaria.routes')(app);
require('./utils/bancos.routes')(app);
require('./utils/shorten.routes')(app);
require('./utils/versionAPP.routes')(app);
require('./utils/regrasBonificacao.routes')(app);
require('./utils/vigenciaFechamento.routes')(app);
require('./utils/digitalSaude/operadorasProdutos.routes')(app);
require('./utils/regrasDeBonificacao/regrasDeBonificacao.routes')(app);
require('./utils/vigenciaeFechamento/vigenciaeFechamento.routes')(app);
require('./utils/ckeditor.routes')(app);
require('./utils/maintenance/maintenance.routes')(app);
require('./utils/azure.routes')(app);
require('./utils/operadoras.routes')(app);

require('./corretoras/corretoras.routes')(app);
require('./corretoras/contato.routes')(app);
require('./corretoras/corretoraDocumento.routes')(app);
require('./corretoras/dadosAcesso.routes')(app);
require('./corretoras/dadosBancario.routes')(app);
require('./corretoras/endereco.routes')(app);
require('./corretoras/responsavel.routes')(app);
require('./corretoras/responsavelDocumento.routes')(app);
require('./corretoras/situacao.routes')(app);
require('./corretoras/supervisor.routes')(app);
require('./corretoras/twoFactorAuthentication.routes')(app);
require('./corretoras/categoria.routes')(app);
require('./corretoras/auth.routes')(app);
require('./corretoras/forgot.routes')(app);
require('./corretoras/vendas.routes')(app);

require('./corretoras-commissions/loteCommissions.routes')(app);
require('./corretoras-commissions/subLoteCommissions.routes')(app);
require('./corretoras-commissions/commissions.routes')(app);
require('./corretoras-commissions/status.routes')(app);
require('./corretoras-commissions/situacoes.routes')(app);
require('./corretoras-commissions/empresa.routes')(app);
require('./corretoras-commissions/NFDocumento.routes')(app);
require('./corretoras-commissions/modalidades.routes')(app);
require('./corretoras-commissions/validaNF.routes')(app);

require('./supervisores/users/auth.routes')(app);
require('./supervisores/users/user.routes')(app);
require('./supervisores/users/twoFactorAuthentication.routes')(app);
require('./supervisores/propostas/proposta.routes')(app);
require('./supervisores/commissions/commission.routes')(app);
require('./supervisores/bonuses/bonuses.routes')(app);
require('./supervisores/corretoras/corretoras.routes')(app);
require('./supervisores/apoio_vendas/files.routes')(app);
require('./supervisores/apoio_vendas/operators.routes')(app);
require('./supervisores/utils/regrasBonificacao.routes')(app);
require('./supervisores/utils/vigenciaFechamento.routes')(app);
require('./supervisores/access/token.routes')(app);
require('./supervisores/incentivos/incentivos.routes.js')(app);

require('./whatsapp/whatsappcorretora.routes')(app);

require('./wallets/walletProdutor.routes')(app);
require('./wallets/walletCorretora.routes')(app);

require('./produtores/produtores.routes')(app);
require('./produtores/contato.routes')(app);
require('./produtores/produtoresDocumento.routes')(app);
require('./produtores/dadosAcesso.routes')(app);
require('./produtores/endereco.routes')(app);
require('./produtores/situacao.routes')(app);
require('./produtores/twoFactorAuthentication.routes')(app);
require('./produtores/auth.routes')(app);
require('./produtores/forgot.routes')(app);
require('./produtores/vendas.routes')(app);

require('./ranking/ranking.routes')(app);
require('./ranking/rankingCadastro.routes.js')(app);
require('./ranking/topvendidas.routes.js')(app);

// require('./duelos/produtores-duel-actions.js')(app);
// require('./duelos/produtores-duel-audit.js')(app);
// require('./duelos/produtores-duel-upload.js')(app);

module.exports = app;