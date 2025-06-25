module.exports = (sequelize, Sequelize) => {
    const Corretora = sequelize.define("corretora", {
        cnpj: {
            type: Sequelize.STRING
        },
        razao_social: {
            type: Sequelize.STRING
        },
        contrato_social_ID: {
            type: Sequelize.STRING
        },
        dados_acesso_ID: {
            type: Sequelize.STRING
        },
        responsavel_ID: {
            type: Sequelize.STRING
        },
        contato_ID: {
            type: Sequelize.STRING
        },
        endereco_ID: {
            type: Sequelize.STRING
        },
        supervisor_ID: {
            type: Sequelize.STRING
        },
        dados_bancarios_ID: {
            type: Sequelize.STRING
        },
        situacao_ID: {
            type: Sequelize.STRING
        },
        categoria_ID: {
            type: Sequelize.STRING
        },
        pertence_corretora_ID: {
            type: Sequelize.STRING
        },
        contrato_ID: {
            type: Sequelize.STRING
        },
        contrato_URL: {
            type: Sequelize.STRING
        },
        termo_aditivo: {
            type: Sequelize.STRING
        },
        termo_aditivo_ID: {
            type: Sequelize.STRING
        },
        termo_aditivo_URL: {
            type: Sequelize.STRING
        },
        termo_aditivo_2: {
            type: Sequelize.STRING
        },
        termo_aditivo_ID_2: {
            type: Sequelize.STRING
        },
        termo_aditivo_URL_2: {
            type: Sequelize.STRING
        }
    });

    return Corretora;
};

// module.exports = (sequelize, Sequelize) => {
//     const Corretora_Corretora = sequelize.define("corretora_corretora", {
//         corretora_ID: {
//             type: Sequelize.STRING
//         },
//         pertence_corretora_ID: {
//             type: Sequelize.STRING
//         }
//     });

//     return Corretora_Corretora;
// };