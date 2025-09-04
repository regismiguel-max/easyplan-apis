module.exports = (sequelize, DataTypes) => {
    const RankingSupervisor = sequelize.define('rk_supervisores', {
        id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        documento_supervisor: { type: DataTypes.STRING(32), allowNull: false }, // CPF (apenas dígitos)
        nome_supervisor: { type: DataTypes.STRING, allowNull: true },
        ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    }, {
        tableName: 'produtores_ranking_supervisores',
        timestamps: false,
        underscored: true,
        indexes: [
            { unique: true, name: 'uniq_rksup_doc', fields: ['documento_supervisor'] },
            { name: 'idx_rksup_ativo', fields: ['ativo'] },
        ],
    });
    return RankingSupervisor;
};
