import { DataTypes } from "sequelize";
import connection_db from "../../config/database";


const ModalityModel = connection_db.define(
    'ModalityModel', 
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        descricao_modalidade: {
            type: DataTypes.STRING,
            allowNull: false
        },
        tipo_contratacao: {
            type: DataTypes.STRING,
            allowNull: false
        },

    },
    {
        tableName: 'cliente_digital_modalidades',
        timestamps: true
    }
)

export default ModalityModel;