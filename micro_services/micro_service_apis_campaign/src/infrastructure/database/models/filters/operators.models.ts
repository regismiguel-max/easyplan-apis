import { DataTypes } from "sequelize";
import connection_db from "../../config/database";

const OperatorsModel = connection_db.define(
    'OperatorsModel', 
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        nome_operadora: {
            type: DataTypes.STRING,
            allowNull: false
        },
        cnpj_operadora: {
            type: DataTypes.STRING,
            allowNull: true
        },
        codigo_produto: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false
        },
    },
    {
        tableName: 'cliente_digital_operadoras',
        timestamps: true
    }
)

export default OperatorsModel;