const config = require("../config/database/db.config.js");

const Sequelize = require("sequelize");
const sequelize = new Sequelize(
    config.DB,
    config.USER,
    config.PASSWORD, {
    host: config.HOST,
    dialect: config.dialect,
    timezone: config.timezone,
    operatorsAliases: false,

    pool: {
        max: config.pool.max,
        min: config.pool.min,
        acquire: config.pool.acquire,
        idle: config.pool.idle
    }
}
);

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.user = require("./users/user.model.js")(sequelize, Sequelize);
db.role = require("./users/role.model.js")(sequelize, Sequelize);
db.user_permissions = require("./users/userPermission.model.js")(sequelize, Sequelize);
db.user_client = require("./clientes/user.model.js")(sequelize, Sequelize);
db.user_client_two_factor_authentication = require("./clientes/twoFactorAuthentication.model.js")(sequelize, Sequelize);

db.redes_credenciadas = require("./redes-credenciadas/redesCredenciadas.model.js")(sequelize, Sequelize);
db.redes_credenciadas_especialidade = require("./redes-credenciadas/especialidade.model.js")(sequelize, Sequelize);
db.redes_credenciadas_operadora = require("./redes-credenciadas/operadora.model.js")(sequelize, Sequelize);
db.redes_credenciadas_prestador_tipo = require("./redes-credenciadas/prestadorTipo.model.js")(sequelize, Sequelize);
db.redes_credenciadas_produto = require("./redes-credenciadas/produto.model.js")(sequelize, Sequelize);

db.contatos_operadoras = require("./contatos/contatos.model.js")(sequelize, Sequelize);
db.push_dispositivos = require("./push/push_dispositivos.model.js")(sequelize, Sequelize);
db.push_logs = require("./push/push_logs.model.js")(sequelize, Sequelize);

db.file = require("./apoio_vendas/file.model.js")(sequelize, Sequelize);
db.operator = require("./apoio_vendas/operator.model.js")(sequelize, Sequelize);
db.document = require("./apoio_vendas/document.model.js")(sequelize, Sequelize);

db.bonuse = require("./bonuses/bonuses.model.js")(sequelize, Sequelize);
db.loteBonuses = require("./bonuses/loteBonuses.model.js")(sequelize, Sequelize);

db.utils_estados = require("./utils/estados.model.js")(sequelize, Sequelize);
db.utils_cidades = require("./utils/cidades.model.js")(sequelize, Sequelize);
db.utils_tipos_contas_bancarias = require("./utils/tipoContaBancaria.model.js")(sequelize, Sequelize);
db.utils_bancos = require("./utils/bancos.model.js")(sequelize, Sequelize);
db.utils_shortens = require("./utils/shorten.model.js")(sequelize, Sequelize);
db.utils_regras_de_bonificacao_estados = require("./utils/regrasDeBonificacao/estados.model.js")(sequelize, Sequelize);
db.utils_regras_de_bonificacao_operadoras = require("./utils/regrasDeBonificacao/operadoras.model.js")(sequelize, Sequelize);
db.utils_regras_de_bonificacao_produtos = require("./utils/regrasDeBonificacao/produtos.model.js")(sequelize, Sequelize);
db.utils_digital_saude_operadoras = require("./utils/digitalSaude/operadoras.model.js")(sequelize, Sequelize);
db.utils_digital_saude_produtos = require("./utils/digitalSaude/produtos.model.js")(sequelize, Sequelize);
db.utils_vigencia_e_fechamento_estados = require("./utils/vigenciaeFechamento/estados.model.js")(sequelize, Sequelize);
db.utils_vigencia_e_fechamento_operadoras = require("./utils/vigenciaeFechamento/operadoras.model.js")(sequelize, Sequelize);
db.utils_vigencia_e_fechamento_datas = require("./utils/vigenciaeFechamento/datas.model.js")(sequelize, Sequelize);
db.utils_operadoras_digital = require("./utils/operadoras.model.js")(sequelize, Sequelize);

db.corretoras = require("./corretoras/corretora.model.js")(sequelize, Sequelize);
db.corretoras_contatos = require("./corretoras/contato.model.js")(sequelize, Sequelize);
db.corretoras_documentos = require("./corretoras/corretoraDocumento.model.js")(sequelize, Sequelize);
db.corretoras_dados_acessos = require("./corretoras/dadosAcesso.model.js")(sequelize, Sequelize);
db.corretoras_dados_bancarios = require("./corretoras/dadosBancario.model.js")(sequelize, Sequelize);
db.corretoras_enderecos = require("./corretoras/endereco.model.js")(sequelize, Sequelize);
db.corretoras_responsavels = require("./corretoras/responsavel.model.js")(sequelize, Sequelize);
db.corretoras_responsavels_documentos = require("./corretoras/responsavelDocumento.model.js")(sequelize, Sequelize);
db.corretoras_situacoes = require("./corretoras/situacao.model.js")(sequelize, Sequelize);
db.corretoras_supervisors = require("./corretoras/supervisor.model.js")(sequelize, Sequelize);
db.corretoras_two_factor_authentications = require("./corretoras/twoFactorAuthentication.model.js")(sequelize, Sequelize);
db.corretoras_categorias = require("./corretoras/categoria.model.js")(sequelize, Sequelize);

db.corretoras_commission = require("./corretoras-commissions/commissions.model.js")(sequelize, Sequelize);
db.corretoras_subLoteCommissions = require("./corretoras-commissions/subLoteCommissions.model.js")(sequelize, Sequelize);
db.corretoras_loteCommissions = require("./corretoras-commissions/loteCommissions.model.js")(sequelize, Sequelize);
db.corretoras_commission_modalidade = require("./corretoras-commissions/modalidades.model.js")(sequelize, Sequelize);
db.corretoras_commission_situacao = require("./corretoras-commissions/situacao.model.js")(sequelize, Sequelize);
db.corretoras_commission_status = require("./corretoras-commissions/status.model.js")(sequelize, Sequelize);
db.corretoras_commission_empresa = require("./corretoras-commissions/empresa.model.js")(sequelize, Sequelize);
db.corretoras_commission_nf = require("./corretoras-commissions/NFDocumento.model.js")(sequelize, Sequelize);

db.supervisores_two_factor_authentications = require("./supervisores/twoFactorAuthentication.model.js")(sequelize, Sequelize);

db.produtores = require("./produtores/produtores.model.js")(sequelize, Sequelize);
db.produtores_contatos = require("./produtores/contato.model.js")(sequelize, Sequelize);
db.produtores_documentos = require("./produtores/produtoresDocumento.model.js")(sequelize, Sequelize);
db.produtores_dados_acessos = require("./produtores/dadosAcesso.model.js")(sequelize, Sequelize);
db.produtores_enderecos = require("./produtores/endereco.model.js")(sequelize, Sequelize);
db.produtores_situacoes = require("./produtores/situacao.model.js")(sequelize, Sequelize);
db.produtores_two_factor_authentications = require("./produtores/twoFactorAuthentication.model.js")(sequelize, Sequelize);

db.swile_two_factor_authentications = require("./swile/swileTwoFactorAuthentication.model.js")(sequelize, Sequelize);
db.swile_two_factor_authentications_request = require("./swile/swileTwoFactorAuthenticationRequest.model.js")(sequelize, Sequelize);
db.swile_payment = require("./swile/swilePayment.model.js")(sequelize, Sequelize);

db.produtorWalletsBonuses = require("./bonuses/produtorWalletsBonuses.model.js")(sequelize, Sequelize);
db.produtorTransactionsBonuses = require("./bonuses/produtorTransactionsBonuses.model.js")(sequelize, Sequelize);
db.produtorPaymentsBonuses = require("./bonuses/produtorPaymentsBonuses.model.js")(sequelize, Sequelize);

db.corretoraWalletsCommissions = require("./corretoras-commissions/corretoraWalletsCommissions.model.js")(sequelize, Sequelize);
db.corretoraTransactionsCommissions = require("./corretoras-commissions/corretoraTransactionsCommissions.model.js")(sequelize, Sequelize);
db.corretoraPaymentsCommissions = require("./corretoras-commissions/corretoraPaymentsCommissions.model.js")(sequelize, Sequelize);

db.beneficiariosDigital = require("./beneficiarios/beneficiario.model.js")(sequelize, Sequelize);


db.incentives = require("./incentivos-comerciais/incentives.model.js")(sequelize, Sequelize);
db.incentives_results = require("./incentivos-comerciais/incentives-results.model.js")(sequelize, Sequelize);
db.incentives_propostas = require("./incentivos-comerciais/incentives-qualitative.model.js")(sequelize, Sequelize);

db.systemConfigCheck = require("./system-config/systemConfigCheck.model.js")(sequelize, Sequelize);



db.role.belongsToMany(db.user, {
    through: "user_role",
    foreignKey: "roleId",
    otherKey: "userId"
});
db.user.belongsToMany(db.role, {
    through: "user_role",
    foreignKey: "userId",
    otherKey: "roleId"
});

db.user_permissions.belongsToMany(db.user, {
    through: "user_userPermission",
    foreignKey: "userPermissonId",
    otherKey: "userId"
});
db.user.belongsToMany(db.user_permissions, {
    through: "user_userPermission",
    foreignKey: "userId",
    otherKey: "userPermissonId"
});

db.file.belongsToMany(db.operator, {
    through: "file_operator",
    foreignKey: "fileId",
    otherKey: "operatorId"
});
db.operator.belongsToMany(db.file, {
    through: "file_operator",
    foreignKey: "operatorId",
    otherKey: "fileId"
});

db.operator.belongsToMany(db.document, {
    through: "operator_document",
    foreignKey: "operatorId",
    otherKey: "documentId"
});
db.document.belongsToMany(db.operator, {
    through: "operator_document",
    foreignKey: "documentId",
    otherKey: "operatorId"
});

db.bonuse.belongsToMany(db.loteBonuses, {
    through: "bonuse_loteBonuses",
    foreignKey: "bonuseId",
    otherKey: "loteBonusesId"
});
db.loteBonuses.belongsToMany(db.bonuse, {
    through: "bonuse_loteBonuses",
    foreignKey: "loteBonusesId",
    otherKey: "bonuseId"
});

db.utils_estados.belongsToMany(db.utils_cidades, {
    through: "utils_estado_cidade",
    foreignKey: "estado_ID",
    otherKey: "cidade_ID"
});
db.utils_cidades.belongsToMany(db.utils_estados, {
    through: "utils_estado_cidade",
    foreignKey: "cidade_ID",
    otherKey: "estado_ID"
});

db.utils_regras_de_bonificacao_estados.belongsToMany(db.utils_regras_de_bonificacao_operadoras, {
    through: "utils_regras_de_bonificacao_estado_operadora",
    foreignKey: "estado_ID",
    otherKey: "operadora_ID"
});
db.utils_regras_de_bonificacao_operadoras.belongsToMany(db.utils_regras_de_bonificacao_estados, {
    through: "utils_regras_de_bonificacao_estado_operadora",
    foreignKey: "operadora_ID",
    otherKey: "estado_ID"
});

db.utils_regras_de_bonificacao_operadoras.belongsToMany(db.utils_regras_de_bonificacao_produtos, {
    through: "utils_regras_de_bonificacao_operadora_produto",
    foreignKey: "operadora_ID",
    otherKey: "produto_ID"
});
db.utils_regras_de_bonificacao_produtos.belongsToMany(db.utils_regras_de_bonificacao_operadoras, {
    through: "utils_regras_de_bonificacao_operadora_produto",
    foreignKey: "produto_ID",
    otherKey: "operadora_ID"
});

db.utils_digital_saude_operadoras.belongsToMany(db.utils_digital_saude_produtos, {
    through: "utils_digital_saude_operadora_produto",
    foreignKey: "operadora_ID",
    otherKey: "produto_ID"
});
db.utils_digital_saude_produtos.belongsToMany(db.utils_digital_saude_operadoras, {
    through: "utils_digital_saude_operadora_produto",
    foreignKey: "produto_ID",
    otherKey: "operadora_ID"
});

db.utils_vigencia_e_fechamento_estados.belongsToMany(db.utils_vigencia_e_fechamento_operadoras, {
    through: "utils_vigencia_e_fechamento_estado_operadora",
    foreignKey: "estado_ID",
    otherKey: "operadora_ID"
});
db.utils_vigencia_e_fechamento_operadoras.belongsToMany(db.utils_vigencia_e_fechamento_estados, {
    through: "utils_vigencia_e_fechamento_estado_operadora",
    foreignKey: "operadora_ID",
    otherKey: "estado_ID"
});

db.utils_vigencia_e_fechamento_operadoras.belongsToMany(db.utils_vigencia_e_fechamento_datas, {
    through: "utils_vigencia_e_fechamento_operadora_data",
    foreignKey: "operadora_ID",
    otherKey: "data_ID"
});
db.utils_vigencia_e_fechamento_datas.belongsToMany(db.utils_vigencia_e_fechamento_operadoras, {
    through: "utils_vigencia_e_fechamento_operadora_data",
    foreignKey: "data_ID",
    otherKey: "operadora_ID"
});

db.corretoras.belongsToMany(db.corretoras_contatos, {
    through: "corretora_contato",
    foreignKey: "corretora_ID",
    otherKey: "contato_ID"
});
db.corretoras_contatos.belongsToMany(db.corretoras, {
    through: "corretora_contato",
    foreignKey: "contato_ID",
    otherKey: "corretora_ID"
});

db.corretoras.belongsToMany(db.corretoras_documentos, {
    through: "corretora_documento",
    foreignKey: "corretora_ID",
    otherKey: "documento_ID"
});
db.corretoras_documentos.belongsToMany(db.corretoras, {
    through: "corretora_documento",
    foreignKey: "documento_ID",
    otherKey: "corretora_ID"
});

db.corretoras.belongsToMany(db.corretoras_dados_acessos, {
    through: "corretora_dados_acesso",
    foreignKey: "corretora_ID",
    otherKey: "dados_acesso_ID"
});
db.corretoras_dados_acessos.belongsToMany(db.corretoras, {
    through: "corretora_dados_acesso",
    foreignKey: "dados_acesso_ID",
    otherKey: "corretora_ID"
});

db.corretoras.belongsToMany(db.corretoras_dados_bancarios, {
    through: "corretora_dados_bancario",
    foreignKey: "corretora_ID",
    otherKey: "dados_bancario_ID"
});
db.corretoras_dados_bancarios.belongsToMany(db.corretoras, {
    through: "corretora_dados_bancario",
    foreignKey: "dados_bancario_ID",
    otherKey: "corretora_ID"
});

db.corretoras.belongsToMany(db.corretoras_enderecos, {
    through: "corretora_endereco",
    foreignKey: "corretora_ID",
    otherKey: "endereco_ID"
});
db.corretoras_enderecos.belongsToMany(db.corretoras, {
    through: "corretora_endereco",
    foreignKey: "endereco_ID",
    otherKey: "corretora_ID"
});

db.corretoras.belongsToMany(db.corretoras_responsavels, {
    through: "corretora_responsavel",
    foreignKey: "corretora_ID",
    otherKey: "responsavel_ID"
});
db.corretoras_responsavels.belongsToMany(db.corretoras, {
    through: "corretora_responsavel",
    foreignKey: "responsavel_ID",
    otherKey: "corretora_ID"
});

db.corretoras_responsavels.belongsToMany(db.corretoras_responsavels_documentos, {
    through: "corretora_responsavel_documento",
    foreignKey: "responsavel_ID",
    otherKey: "documento_ID"
});
db.corretoras_responsavels_documentos.belongsToMany(db.corretoras_responsavels, {
    through: "corretora_responsavel_documento",
    foreignKey: "documento_ID",
    otherKey: "responsavel_ID"
});

db.corretoras.belongsToMany(db.corretoras_supervisors, {
    through: "corretora_supervisor",
    foreignKey: "corretora_ID",
    otherKey: "supervisor_ID"
});
db.corretoras_supervisors.belongsToMany(db.corretoras, {
    through: "corretora_supervisor",
    foreignKey: "supervisor_ID",
    otherKey: "corretora_ID"
});

db.corretoras.belongsToMany(db.corretoras_categorias, {
    through: "corretora_categoria",
    foreignKey: "corretora_ID",
    otherKey: "categoria_ID"
});
db.corretoras_categorias.belongsToMany(db.corretoras, {
    through: "corretora_categoria",
    foreignKey: "categoria_ID",
    otherKey: "corretora_ID"
});

db.corretoras_commission.belongsToMany(db.corretoras_subLoteCommissions, {
    through: "corretora_commissions_commission_sub_lote",
    foreignKey: "commission_ID",
    otherKey: "sub_lote_ID"
});
db.corretoras_subLoteCommissions.belongsToMany(db.corretoras_commission, {
    through: "corretora_commissions_commission_sub_lote",
    foreignKey: "sub_lote_ID",
    otherKey: "commission_ID"
});

db.corretoras_subLoteCommissions.belongsToMany(db.corretoras_loteCommissions, {
    through: "corretora_commissions_sub_lote_lotes",
    foreignKey: "sub_lote_ID",
    otherKey: "lote_ID"
});
db.corretoras_loteCommissions.belongsToMany(db.corretoras_subLoteCommissions, {
    through: "corretora_commissions_sub_lote_lotes",
    foreignKey: "lote_ID",
    otherKey: "sub_lote_ID"
});

db.corretoras_subLoteCommissions.belongsToMany(db.corretoras_commission_nf, {
    through: "corretora_commissions_sub_lote_nf",
    foreignKey: "sub_lote_ID",
    otherKey: "nf_ID"
});
db.corretoras_commission_nf.belongsToMany(db.corretoras_subLoteCommissions, {
    through: "corretora_commissions_sub_lote_nf",
    foreignKey: "nf_ID",
    otherKey: "sub_lote_ID"
});

db.produtores.belongsToMany(db.produtores_contatos, {
    through: "produtor_contato",
    foreignKey: "produtor_ID",
    otherKey: "contato_ID"
});
db.produtores_contatos.belongsToMany(db.produtores, {
    through: "produtor_contato",
    foreignKey: "contato_ID",
    otherKey: "produtor_ID"
});

db.produtores.belongsToMany(db.produtores_documentos, {
    through: "produtor_documento",
    foreignKey: "produtor_ID",
    otherKey: "documento_ID"
});
db.produtores_documentos.belongsToMany(db.produtores, {
    through: "produtor_documento",
    foreignKey: "documento_ID",
    otherKey: "produtor_ID"
});

db.produtores.belongsToMany(db.produtores_dados_acessos, {
    through: "produtor_dados_acesso",
    foreignKey: "produtor_ID",
    otherKey: "dados_acesso_ID"
});
db.produtores_dados_acessos.belongsToMany(db.produtores, {
    through: "produtor_dados_acesso",
    foreignKey: "dados_acesso_ID",
    otherKey: "produtor_ID"
});

db.produtores.belongsToMany(db.produtores_enderecos, {
    through: "produtor_endereco",
    foreignKey: "produtor_ID",
    otherKey: "endereco_ID"
});
db.produtores_enderecos.belongsToMany(db.produtores, {
    through: "produtor_endereco",
    foreignKey: "endereco_ID",
    otherKey: "produtor_ID"
});

db.ROLES = ["admin", "agent", "operator", "client"];
// db.corretoras_situacoes.create({ id: 1,nome: 'ATIVO', descricao: 'Situação em atividade' })
// db.corretoras_situacoes.create({ id: 2,nome: 'CANCELADO', descricao: 'Situação cancelado' })
// db.corretoras_situacoes.create({ id: 3,nome: 'EM ANALISE', descricao: 'Situação em em análise' })
// db.corretoras_situacoes.create({ id: 4,nome: 'PENDENTE', descricao: 'Situação em pendencia' })


// db.corretoras_categorias.create({ id: 1,nome: 'CORRETORA', descricao: 'Categoria Corretora' })
// db.corretoras_categorias.create({ id: 2,nome: 'ASSESSORIA', descricao: 'Categoria Assessoria' })
// db.corretoras_categorias.create({ id: 3,nome: 'ASSESSORADO', descricao: 'Categoria Assessorado' })

// db.corretoras_commission_modalidade.create({ id: 1, nome: 'COLETIVO POR ADESAO' });
// db.corretoras_commission_modalidade.create({ id: 2, nome: 'EMPRESARIAL' });

// db.corretoras_commission_situacao.create({ id: 1,nome: 'APROVADO', descricao: 'Situação aprovado' })
// db.corretoras_commission_situacao.create({ id: 2,nome: 'REPROVADO', descricao: 'Situação reprovado' })
// db.corretoras_commission_situacao.create({ id: 3,nome: 'EM ANALISE', descricao: 'Situação em análise' })
// db.corretoras_commission_situacao.create({ id: 4,nome: 'PENDENTE', descricao: 'Situação em pendência' })

// db.corretoras_commission_status.create({ id: 1,nome: 'ATIVO', descricao: 'Status em atividade' })
// db.corretoras_commission_status.create({ id: 2,nome: 'CANCELADO', descricao: 'Status cancelado' })
// db.corretoras_commission_status.create({ id: 3,nome: 'PENDENTE', descricao: 'Status em pendência' })

// db.corretoras_commission_empresa.create(
//     {
//         id: 1,
//         razao_social: 'EASYPLAN ADMINISTRADORA DE BENEFÍCIOS LTDA',
//         cnpj: '27.252.086/0001-04',
//         ie: '07.801.652/0001-30',
//         endereco: 'SCRS 502 Bloco C Loja 37 Asa Sul',
//         bairro: 'ASA SUL – BRASILIA – DF',
//         cep: '70330-530'
//     }
// );
// db.corretoras_commission_empresa.create(
//     {
//         id: 2,
//         razao_social: 'EQUILIBRAR CORRETORA DE SEGUROS DE VIDA LTDA',
//         cnpj: '08.568.566/0001-26',
//         ie: '07.483.354.001-07',
//         endereco: 'SCS QUADRA 02, BLOCO C, N°180, ED. CEDRO II, SALA 601',
//         bairro: 'ASA SUL – BRASILIA – DF',
//         cep: '70.302-914'
//     }
// );

// db.produtores_situacoes.create({ id: 1,nome: 'ATIVO', descricao: 'Situação em atividade' })
// db.produtores_situacoes.create({ id: 2,nome: 'CANCELADO', descricao: 'Situação cancelado' })
// db.produtores_situacoes.create({ id: 3,nome: 'EM ANALISE', descricao: 'Situação em em análise' })
// db.produtores_situacoes.create({ id: 4,nome: 'PENDENTE', descricao: 'Situação em pendencia' })

db.incentives.hasOne(db.incentives_results, {
    foreignKey: 'incentive_id',
    as: 'result'
});

db.incentives_results.belongsTo(db.incentives, {
    foreignKey: 'incentive_id',
    as: 'incentive'
})

db.incentives.belongsTo(db.user, {
    foreignKey: 'user_id',
    as: 'user'
});

db.user.hasMany(db.incentives, {
    foreignKey: 'user_id',
    as: 'incentives'
})

db.incentives.belongsTo(db.corretoras, {
    foreignKey: 'corretora_id',
    as: 'corretora'
});

db.corretoras.hasMany(db.incentives, {
    foreignKey: 'corretora_id',
    as: 'incentives'
})

// Um Incentivo possui muitas propostas
db.incentives.hasMany(db.incentives_propostas, {
    foreignKey: 'incentive_id',
    as: 'propostas'
});

// Cada proposta pertence a um Incentivo
db.incentives_propostas.belongsTo(db.incentives, {
    foreignKey: 'incentive_id',
    as: 'incentivo'
});
module.exports = db;