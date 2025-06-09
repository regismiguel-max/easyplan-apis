export default interface Operator {
    id: number;

    nome_operadora: string;

    cnpj_operadora: string | null;

    codigo_produto: string;

    createdAt: Date;

    updatedAt: Date;
}
