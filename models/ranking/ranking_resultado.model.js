module.exports = (sequelize, DataTypes) => {
    const RankingResultado = sequelize.define('rk_resultados', {
        id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },

        execucao_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

        // Escopo regional
        escopo: { type: DataTypes.ENUM('NACIONAL', 'UF'), allowNull: false },
        uf: { type: DataTypes.STRING(2), allowNull: true }, // null = nacional

        // Janela temporal e chave da janela
        // TOTAL: vigencia = null
        // DIA:   vigencia = 'YYYY-MM-DD'
        // MES:   vigencia = 'YYYY-MM'
        janela: { type: DataTypes.ENUM('TOTAL', 'DIA', 'MES'), allowNull: false },
        vigencia: { type: DataTypes.STRING(10), allowNull: true },

        // Chave do corretor (CPF)
        corretor_cpf: { type: DataTypes.STRING(32), allowNull: false },
        nome_corretor: { type: DataTypes.STRING, allowNull: true },

        // Métricas
        vidas_vendidas: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        vidas_confirmadas: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        vidas_ativas: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },

        // NOVO: Confirmadas + Ativas (confirmadoativo)
        vidas_confirmadas_ativas: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },

        contratos_unicos_vendidos: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        contratos_unicos_confirmados: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },

        // Desempate (não retornado por padrão)
        valor_confirmado_contratos_cent: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },

        // Rank e “faltam”
        rank_confirmadas: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        faltam_para_primeiro: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        faltam_para_segundo: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        faltam_para_terceiro: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },

        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    }, {
        tableName: 'produtores_ranking_resultados',
        timestamps: false,
        underscored: true,
        indexes: [
            {
                unique: true,
                name: 'uniq_rkres_exec_esc_uf_jan_vig_cpf',
                fields: ['execucao_id', 'escopo', 'uf', 'janela', 'vigencia', 'corretor_cpf'],
            },
            {
                name: 'idx_rkres_consulta',
                fields: ['execucao_id', 'janela', 'vigencia', 'escopo', 'uf', 'rank_confirmadas'],
            },
        ],
    });
    return RankingResultado;
};