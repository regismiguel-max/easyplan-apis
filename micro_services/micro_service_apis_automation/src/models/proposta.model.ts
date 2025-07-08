import { DataTypes, Model, Optional, Sequelize } from "sequelize";
import { sequelize } from "../config/database";

interface PropostaAttributes {
    id: string;
    propostaID: number;
    oper_propnum: string;
    oper_protocolo?: string | null;
    contrato: string;
    tipo_proposta: string;
    produto: string;
    beneficiarios: number;
    status: string;
    decsau: number;
    pgtoccredito?: string | null;
    date_sig: string;
    date_sale: string;
    date_vigencia: string;
    vendedor_cpf: string;
    vendedor_nome: string;
    concessionaria_cnpj?: string | null;
    concessionaria_nome?: string | null;
    corretora_cnpj: string;
    corretora_nome: string;
    contratante_cpf: string;
    contratante_nome: string;
    contratante_email: string;
    contratante_cnpj?: string | null;
    datacadastro: string;
    datamodificacao: string;
    datacriacao: string;
    uf: string;
    data_notificacao: string;
    total_valor: number;
    motivo_pendencia_doc?: string[] | null;
    motivo_cancelamento?: object | null;
    metadados?: object | null;
    possui_contrato_digital: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

type PropostaCreationAttributes = Optional<
    PropostaAttributes,
    | "id"
    | "possui_contrato_digital"
    | "motivo_pendencia_doc"
    | "motivo_cancelamento"
    | "metadados"
    | "oper_protocolo"
    | "pgtoccredito"
    | "concessionaria_cnpj"
    | "concessionaria_nome"
    | "contratante_cnpj"
>;

class PropostaModel extends Model<PropostaAttributes, PropostaCreationAttributes> implements PropostaAttributes {
    public id!: string;
    public propostaID!: number;
    public oper_propnum!: string;
    public oper_protocolo?: string;
    public contrato!: string;
    public tipo_proposta!: string;
    public produto!: string;
    public beneficiarios!: number;
    public status!: string;
    public decsau!: number;
    public pgtoccredito?: string;
    public date_sig!: string;
    public date_sale!: string;
    public date_vigencia!: string;
    public vendedor_cpf!: string;
    public vendedor_nome!: string;
    public concessionaria_cnpj?: string;
    public concessionaria_nome?: string;
    public corretora_cnpj!: string;
    public corretora_nome!: string;
    public contratante_cpf!: string;
    public contratante_nome!: string;
    public contratante_email!: string;
    public contratante_cnpj?: string;
    public datacadastro!: string;
    public datamodificacao!: string;
    public datacriacao!: string;
    public uf!: string;
    public data_notificacao!: string;
    public total_valor!: number;
    public motivo_pendencia_doc?: string[];
    public motivo_cancelamento?: object;
    public metadados?: object;
    public possui_contrato_digital!: boolean;
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
                propostaID: {
                    type: DataTypes.BIGINT,
                    allowNull: false,
                    unique: true,
                    field: "proposta_id",
                },
                oper_propnum: { type: DataTypes.STRING, field: "oper_propnum" },
                oper_protocolo: { type: DataTypes.STRING, field: "oper_protocolo" },
                contrato: { type: DataTypes.STRING, field: "contrato" },
                tipo_proposta: { type: DataTypes.STRING, field: "tipo_proposta" },
                produto: { type: DataTypes.STRING, field: "produto" },
                beneficiarios: { type: DataTypes.INTEGER, field: "beneficiarios" },
                status: { type: DataTypes.STRING, field: "status" },
                decsau: { type: DataTypes.INTEGER, field: "decsau" },
                pgtoccredito: { type: DataTypes.STRING, field: "pgtoccredito" },
                date_sig: { type: DataTypes.STRING, field: "date_sig" },
                date_sale: { type: DataTypes.STRING, field: "date_sale" },
                date_vigencia: { type: DataTypes.STRING, field: "date_vigencia" },
                vendedor_cpf: { type: DataTypes.STRING, field: "vendedor_cpf" },
                vendedor_nome: { type: DataTypes.STRING, field: "vendedor_nome" },
                concessionaria_cnpj: { type: DataTypes.STRING, field: "concessionaria_cnpj" },
                concessionaria_nome: { type: DataTypes.STRING, field: "concessionaria_nome" },
                corretora_cnpj: { type: DataTypes.STRING, field: "corretora_cnpj" },
                corretora_nome: { type: DataTypes.STRING, field: "corretora_nome" },
                contratante_cpf: { type: DataTypes.STRING, field: "contratante_cpf" },
                contratante_nome: { type: DataTypes.STRING, field: "contratante_nome" },
                contratante_email: { type: DataTypes.STRING, field: "contratante_email" },
                contratante_cnpj: { type: DataTypes.STRING, field: "contratante_cnpj" },
                datacadastro: { type: DataTypes.STRING, field: "datacadastro" },
                datamodificacao: { type: DataTypes.STRING, field: "datamodificacao" },
                datacriacao: { type: DataTypes.STRING, field: "datacriacao" },
                uf: { type: DataTypes.STRING, field: "uf" },
                data_notificacao: { type: DataTypes.STRING, field: "data_notificacao" },
                total_valor: { type: DataTypes.FLOAT, field: "total_valor" },
                motivo_pendencia_doc: { type: DataTypes.JSON, field: "motivo_pendencia_doc" },
                motivo_cancelamento: { type: DataTypes.JSON, field: "motivo_cancelamento" },
                metadados: { type: DataTypes.JSON, field: "metadados" },
                possui_contrato_digital: {
                    type: DataTypes.BOOLEAN,
                    defaultValue: false,
                    field: "possui_contrato_digital",
                },
            },
            {
                sequelize,
                tableName: "automation_propostas",
                timestamps: true,
                underscored: true,
                indexes: [
                    { fields: ["proposta_id"] },
                ],
            }
        );
    }
}

export default PropostaModel;
