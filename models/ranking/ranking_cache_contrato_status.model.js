module.exports = (sequelize, DataTypes) => {
    const ProdutoresRankingCacheContratoStatus = sequelize.define(
        "produtores_ranking_cache_contrato_status",
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
            codigo_contrato: {
                type: DataTypes.STRING(128),
                allowNull: false,
                unique: true,
                comment: "Identificador do contrato (normalizado sem espaços).",
            },
            pago: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: "Status cacheado: true = há 1ª fatura paga.",
            },
            last_checked: {
                type: DataTypes.DATE,
                allowNull: false,
                comment: "Momento (UTC) da última verificação na API Digital.",
            },
        },
        {
            tableName: "produtores_ranking_cache_contrato_status",
            freezeTableName: true,
            timestamps: false,
            indexes: [
                { fields: ["last_checked"], name: "idx_prccs_last_checked" },
                { unique: true, fields: ["codigo_contrato"], name: "uq_prccs_codigo_contrato" },
            ],
        }
    );

    return ProdutoresRankingCacheContratoStatus;
};
