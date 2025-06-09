import { DataTypes } from "sequelize";
import connection_db from "../../config/database";
import OperatorsModel from "./operators.models";

const PlansModel = connection_db.define(
    'PlansModel', 
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        operadora: {
            type: DataTypes.STRING,
            allowNull: false
        },
        codigo_produto: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: OperatorsModel,
                key: 'codigo_produto'
            }
        },
        nome_produto: {
            type: DataTypes.STRING,
            allowNull: false
        },
        codigo_plano: {
            type: DataTypes.STRING,
            allowNull: false
        },
        nome_plano: {
            type: DataTypes.STRING,
            allowNull: false
        },
        status_plano: {
            type: DataTypes.STRING,
            allowNull: false
        },
        regiao: {
            type: DataTypes.STRING,
            allowNull: false
        },
        registro_ans: {
            type: DataTypes.STRING,
            allowNull: false
        },
        acomodacao: {
            type: DataTypes.STRING,
            allowNull: false
        },
        abrangencia: {
            type: DataTypes.STRING,
            allowNull: false
        },
        coparticipacao: {
            type: DataTypes.STRING,
            allowNull: false
        },
        integracao_plano: {
            type: DataTypes.STRING,
            allowNull: false
        },
    },
    {
        tableName: 'cliente_digital_planos',
        timestamps: true
    }
)

export default PlansModel;