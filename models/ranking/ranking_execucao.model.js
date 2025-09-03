module.exports = (sequelize, DataTypes) => {
  const RankingExecucao = sequelize.define('rk_execucoes', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    data_inicio_campanha: { type: DataTypes.DATEONLY, allowNull: false },
    data_fim_campanha: { type: DataTypes.DATEONLY, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'produtores_ranking_execucoes',
    timestamps: false,
    underscored: true,
  });
  return RankingExecucao;
};
