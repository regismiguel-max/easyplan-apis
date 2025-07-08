import { DataTypes, Model, Optional, Sequelize } from "sequelize";

interface SyncLogAttributes {
    id: string;
    tipo: "propostas" | "contratos" | "beneficiarios" | "completo";
    status: "sucesso" | "erro";
    detalhes: string;
    executado_em: Date;
    duracao_ms: number;
    createdAt?: Date;
    updatedAt?: Date;
}

type SyncLogCreationAttributes = Optional<SyncLogAttributes, "id" | "executado_em">;

class SyncLogModel extends Model<SyncLogAttributes, SyncLogCreationAttributes> implements SyncLogAttributes {
    public id!: string;
    public tipo!: "propostas" | "contratos" | "beneficiarios" | "completo";
    public status!: "sucesso" | "erro";
    public detalhes!: string;
    public executado_em!: Date;
    public duracao_ms!: number;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static initialize(sequelize: Sequelize) {
        this.init(
            {
                id: {
                    type: DataTypes.UUID,
                    defaultValue: DataTypes.UUIDV4,
                    primaryKey: true,
                },
                tipo: {
                    type: DataTypes.ENUM("propostas", "contratos", "beneficiarios", "completo"),
                    allowNull: false,
                    field: "tipo",
                },
                status: {
                    type: DataTypes.ENUM("sucesso", "erro"),
                    allowNull: false,
                    field: "status",
                },
                detalhes: {
                    type: DataTypes.TEXT,
                    allowNull: false,
                    field: "detalhes",
                },
                executado_em: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW,
                    field: "executado_em",
                },
                duracao_ms: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    field: "duracao_ms",
                },
            },
            {
                sequelize,
                tableName: "automation_sync_logs",
                timestamps: true,
                underscored: true,
                indexes: [
                    { fields: ["tipo"] },
                    { fields: ["status"] },
                    { fields: ["executado_em"] },
                    { fields: ["tipo", "executado_em"] },
                ],
            }
        );
    }
}

export default SyncLogModel;
