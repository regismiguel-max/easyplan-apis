// models/ranking_operadora.model.js
module.exports = (sequelize, DataTypes) => {
    const RankingOperadora = sequelize.define('rk_operadoras', {
        id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        operadora_chave: { type: DataTypes.STRING(128), allowNull: false },
        operadora_nome: { type: DataTypes.STRING, allowNull: true },
        ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    }, {
        tableName: 'produtores_ranking_operadoras',
        timestamps: false,
        underscored: true,
        indexes: [
            { unique: true, name: 'uniq_rk_operadora_chave', fields: ['operadora_chave'] },
            { name: 'idx_rk_operadora_ativo', fields: ['ativo'] },
        ],
    });
    return RankingOperadora;
};
