export default interface RecipientGroup {
    id: number,
    emailCampaignId: number,
    ddd_celular: string,
    celular: string,
    email_principal: string,
    createdAt: Date,
    updatedAt: Date
}

export interface RecipientGroupToSend {
    recipientsGroup: RecipientGroup[],
    count: number
}