module.exports = (sequelize, DataTypes) => {
    const RankingExclusao = sequelize.define('rk_exclusoes', {
        id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        corretor_cpf: { type: DataTypes.STRING(32), allowNull: false },
        nome_corretor: { type: DataTypes.STRING, allowNull: true },
        motivo: { type: DataTypes.STRING, allowNull: true },
        ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    }, {
        tableName: 'produtores_ranking_exclusoes',
        timestamps: false,
        underscored: true,
        indexes: [
            { unique: true, name: 'uniq_rkexc_cpf', fields: ['corretor_cpf'] },
            { name: 'idx_rkexc_ativo', fields: ['ativo'] },
        ],
    });
    return RankingExclusao;
};
