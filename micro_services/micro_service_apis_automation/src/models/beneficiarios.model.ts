import { DataTypes, Model, Optional, Sequelize } from "sequelize";
import { sequelize } from "../config/database";

export interface ClienteDigitalBeneficiarioAttributes {
  id: string;
  operadora?: string;
  convenio?: string;
  grupo?: string;
  subestipulante?: string;
  data_proximo_reajuste?: string;
  codigo_do_contrato?: string;
  data_de_cancelamento?: string;
  data_de_exclusao?: string;
  numero_da_proposta?: string;
  data_de_inclusao?: string;
  data_de_assinatura?: string;
  dias_de_permanencia?: string | null;
  dia_vencimento?: string;
  plano?: string;
  acomodacao?: string;
  produto?: string;
  documento_corretor?: string;
  codigo_corretor?: string;
  nome_corretor?: string;
  grupo_corretor?: string;
  documento_supervisor?: string;
  nome_supervisor?: string;
  documento_corretora?: string;
  nome_corretora?: string;
  grupo_corretora?: string;
  documento_angariador?: string;
  angariador?: string;
  nome_responsavel_financeiro?: string;
  cpf_responsavel?: string;
  id_beneficiario?: string;
  codigo_do_beneficiario?: string;
  marca_optica?: string;
  marca_optica_opcional?: string;
  nome_do_beneficiario?: string;
  data_de_nascimento?: string;
  idade?: string | null;
  rg?: string;
  orgao_emissor?: string;
  cpf?: string;
  dnv?: string;
  cns?: string;
  pis?: string;
  nome_da_mae?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  ddd_telefone?: string;
  telefone?: string;
  ddd_celular?: string;
  celular?: string;
  email_principal?: string;
  email_secundario?: string;
  altura?: string;
  peso?: string;
  imc?: string;
  vigencia?: string;
  carencia?: string;
  estado_civil?: string;
  tipo_de_beneficiario?: string;
  sexo?: string;
  parentesco?: string;
  status_do_beneficiario?: string;
  forma_de_ajuste?: string;
  ajuste?: string;
  origem_de_venda?: string;
  valor_contrato?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type CreationAttributes = Optional<ClienteDigitalBeneficiarioAttributes, keyof ClienteDigitalBeneficiarioAttributes>;

export default class ClienteDigitalBeneficiarioModel extends Model<
  ClienteDigitalBeneficiarioAttributes,
  CreationAttributes
> implements ClienteDigitalBeneficiarioAttributes {
  public id!: string;
  // ... todas as propriedades omitidas para brevidade

  static initialize(sequelize: Sequelize) {
    this.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        operadora: { type: DataTypes.STRING },
        convenio: { type: DataTypes.STRING },
        grupo: { type: DataTypes.STRING },
        subestipulante: { type: DataTypes.STRING },
        data_proximo_reajuste: { type: DataTypes.STRING, field: "data_proximo_reajuste" },
        codigo_do_contrato: { type: DataTypes.STRING, field: "codigo_do_contrato" },
        data_de_cancelamento: { type: DataTypes.STRING, field: "data_de_cancelamento" },
        data_de_exclusao: { type: DataTypes.STRING, field: "data_de_exclusao" },
        numero_da_proposta: { type: DataTypes.STRING, field: "numero_da_proposta" },
        data_de_inclusao: { type: DataTypes.STRING, field: "data_de_inclusao" },
        data_de_assinatura: { type: DataTypes.STRING, field: "data_de_assinatura" },
        dias_de_permanencia: { type: DataTypes.STRING, field: "dias_de_permanencia" },
        dia_vencimento: { type: DataTypes.STRING, field: "dia_vencimento" },
        plano: { type: DataTypes.STRING },
        acomodacao: { type: DataTypes.STRING },
        produto: { type: DataTypes.STRING },
        documento_corretor: { type: DataTypes.STRING, field: "documento_corretor" },
        codigo_corretor: { type: DataTypes.STRING, field: "codigo_corretor" },
        nome_corretor: { type: DataTypes.STRING, field: "nome_corretor" },
        grupo_corretor: { type: DataTypes.STRING, field: "grupo_corretor" },
        documento_supervisor: { type: DataTypes.STRING, field: "documento_supervisor" },
        nome_supervisor: { type: DataTypes.STRING, field: "nome_supervisor" },
        documento_corretora: { type: DataTypes.STRING, field: "documento_corretora" },
        nome_corretora: { type: DataTypes.TEXT, field: "nome_corretora" },
        grupo_corretora: { type: DataTypes.STRING, field: "grupo_corretora" },
        documento_angariador: { type: DataTypes.STRING, field: "documento_angariador" },
        angariador: { type: DataTypes.STRING },
        nome_responsavel_financeiro: { type: DataTypes.TEXT, field: "nome_responsavel_financeiro" },
        cpf_responsavel: { type: DataTypes.STRING, field: "cpf_responsavel" },
        id_beneficiario: { type: DataTypes.STRING, field: "id_beneficiario" },
        codigo_do_beneficiario: { type: DataTypes.STRING, field: "codigo_do_beneficiario" },
        marca_optica: { type: DataTypes.STRING, field: "marca_optica" },
        marca_optica_opcional: { type: DataTypes.STRING, field: "marca_optica_opcional" },
        nome_do_beneficiario: { type: DataTypes.TEXT, field: "nome_do_beneficiario" },
        data_de_nascimento: { type: DataTypes.STRING, field: "data_de_nascimento" },
        idade: { type: DataTypes.STRING },
        rg: { type: DataTypes.STRING },
        orgao_emissor: { type: DataTypes.STRING, field: "orgao_emissor" },
        cpf: { type: DataTypes.STRING, allowNull: false }, // Recomendado
        dnv: { type: DataTypes.STRING },
        cns: { type: DataTypes.STRING },
        pis: { type: DataTypes.STRING },
        nome_da_mae: { type: DataTypes.TEXT, field: "nome_da_mae" },
        endereco: { type: DataTypes.TEXT },
        numero: { type: DataTypes.STRING },
        complemento: { type: DataTypes.TEXT },
        bairro: { type: DataTypes.STRING },
        municipio: { type: DataTypes.STRING },
        uf: { type: DataTypes.STRING },
        cep: { type: DataTypes.STRING },
        ddd_telefone: { type: DataTypes.STRING, field: "ddd_telefone" },
        telefone: { type: DataTypes.STRING },
        ddd_celular: { type: DataTypes.STRING, field: "ddd_celular" },
        celular: { type: DataTypes.STRING },
        email_principal: { type: DataTypes.STRING, field: "email_principal" },
        email_secundario: { type: DataTypes.TEXT, field: "email_secundario" },
        altura: { type: DataTypes.STRING },
        peso: { type: DataTypes.STRING },
        imc: { type: DataTypes.STRING },
        vigencia: { type: DataTypes.STRING },
        carencia: { type: DataTypes.STRING },
        estado_civil: { type: DataTypes.STRING, field: "estado_civil" },
        tipo_de_beneficiario: { type: DataTypes.STRING, field: "tipo_de_beneficiario" },
        sexo: { type: DataTypes.STRING },
        parentesco: { type: DataTypes.STRING },
        status_do_beneficiario: { type: DataTypes.STRING, field: "status_do_beneficiario" },
        forma_de_ajuste: { type: DataTypes.STRING, field: "forma_de_ajuste" },
        ajuste: { type: DataTypes.STRING },
        origem_de_venda: { type: DataTypes.STRING, field: "origem_de_venda" },
        valor_contrato: {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: null,
        }
      },
      {
        sequelize,
        tableName: "automation_cliente_digital_beneficiarios",
        timestamps: true,
        underscored: true,
        indexes: [
          {
            name: 'uniq_cpf_contrato_benef',
            unique: true,
            fields: ['cpf', 'codigo_do_contrato', 'codigo_do_beneficiario'],
          },
        ],
      }
    );
  }
}
