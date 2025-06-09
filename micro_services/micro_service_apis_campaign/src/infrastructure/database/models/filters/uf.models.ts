import { DataTypes } from "sequelize";
import connection_db from "../../config/database";


const UfModel = connection_db.define(
    'UfModel', 
    {
        estadoID: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        estadoNome: {
            type: DataTypes.STRING,
            allowNull: false
        },
        estadoUF: {
            type: DataTypes.STRING,
            allowNull: false
        },
    },
    {
        tableName: 'utils_estados',
        timestamps: true
    }
)

export default UfModel;