module.exports = (sequelize, Sequelize) => {
    const File = sequelize.define("files", {
        name: {
            type: Sequelize.STRING
        },
        descricao: {
            type: Sequelize.STRING
        },
        pasta: {
            type: Sequelize.BOOLEAN
        }
    });

    return File;
};