module.exports = (sequelize, Sequelize) => {
    const Document = sequelize.define("documents", {
        name: {
            type: Sequelize.STRING
        },
        descricao: {
            type: Sequelize.STRING
        },
        imagemUrl: {
            type: Sequelize.STRING
        },
        idPai: {
            type: Sequelize.STRING
        },
        pasta: {
            type: Sequelize.BOOLEAN
        }
    });

    return Document;
};