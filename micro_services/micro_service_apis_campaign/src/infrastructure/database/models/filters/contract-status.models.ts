import { DataTypes } from "sequelize";
import connection_db from "../../config/database";

const ContractStatusModel = connection_db.define(
    'ContractStatusModel', 
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        status: {
            type: DataTypes.ENUM('ATIVO', 'SUSPENSO', 'CANCELADO'),
            allowNull: false
        },
    },
    {
        tableName: 'cliente_digital_status',
        timestamps: true
    }
)

export default ContractStatusModel;