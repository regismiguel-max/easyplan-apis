module.exports = (sequelize, Sequelize) => {
    const Shorten = sequelize.define("utils_shorten", {
        shortenID: {
            type: Sequelize.STRING,
            primaryKey: true
        },
        url: {
            type: Sequelize.STRING(500)
        },
    });

    return Shorten;
};