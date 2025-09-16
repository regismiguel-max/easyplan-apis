export default interface RecipientGroup {
    id: number;
    emailCampaignId: number;
    ddd_celular: string;
    celular: string;
    email_principal: string;
    operadora: string;
    plano: string;
    status_do_beneficiario: string;
    tipo_de_beneficiario: string;
    nome_do_beneficiario: string;
    convenio: string;
    subestipulante: string;
    vigencia: string;
    uf: string;
    sexo: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface RecipientGroupToSend {
    recipientsGroup: RecipientGroup[],
    count: number
}