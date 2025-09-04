module.exports = (sequelize, DataTypes) => {
    const RankingVigValidas = sequelize.define('rk_vig_validas', {
        id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },

        // chave do grupo mensal
        referencia_mes: { type: DataTypes.STRING(7), allowNull: false }, // 'YYYY-MM'
        // dia pertencente ao grupo
        vigencia_dia: { type: DataTypes.DATEONLY, allowNull: false },  // 'YYYY-MM-DD'

        ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    }, {
        tableName: 'produtores_ranking_vigencias_validas',
        timestamps: false,
        underscored: true,
        indexes: [
            { unique: true, name: 'uniq_vig_dia', fields: ['vigencia_dia'] },
            { name: 'idx_vig_ativo_mes', fields: ['ativo', 'referencia_mes'] },
        ],
    });

    return RankingVigValidas;
};
