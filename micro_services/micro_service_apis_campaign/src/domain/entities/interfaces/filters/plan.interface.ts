export default interface Plan {
    id: number;
    operadora: string;
    codigo_produto: string;
    nome_produto: string;
    codigo_plano: string;
    nome_plano: string;
    status_plano: string;
    regiao: string;
    registro_ans: string;
    acomodacao: string;
    abrangencia: string;
    coparticipacao: string;
    integracao_plano: string;
    createdAt: Date;
    updatedAt: Date | null;
}