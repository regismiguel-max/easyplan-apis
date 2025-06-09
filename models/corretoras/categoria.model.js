module.exports = (sequelize, Sequelize) => {
    const Categoria = sequelize.define("corretoras_categorias", {
        nome: {
            type: Sequelize.STRING
        },
        descricao: {
            type: Sequelize.STRING
        },
    });

    return Categoria;
};