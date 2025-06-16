import { WhereOptions } from "sequelize";
import RecipientGroup, { RecipientGroupToSend } from "../../domain/entities/interfaces/recipient-group.interface";
import ClientModel from "../database/models/client.model";
import RecipientGroupModel from "../database/models/recipient-group.models";

export default class RecipientGroupRepository {
    //************************** RECIPIENT GROUP REPOSITORY ***************************/
    async getRecipientsByFilters(filters: WhereOptions): Promise<Partial<RecipientGroup>[] | string> {
        const recipientGroupDB = await ClientModel.findAll({
            where: filters,
            attributes: ['ddd_celular', 'celular', 'email_principal']
        });

        if(recipientGroupDB.length <= 0) return 'Não existe cliente(s) que atendam a esse conjunto de filtros';
        
        let response: Partial<RecipientGroup>[] = [];

        recipientGroupDB.forEach(recipient => {
            const pureObject = recipient.get({plain: true});
            
            response.push(pureObject);
        });

        console.log('Grupo Destinatário - Manipulação realizada com sucesso: ', response);

        return response;
    }
    async saveRecipientsGroup(recipientsGroup: Partial<RecipientGroup>[], campaignId: number): Promise<RecipientGroup[]> {
        const data: Partial<RecipientGroup>[] = recipientsGroup.map((rg) => ({
            campaignId,
            ddd_celular: rg.ddd_celular,
            celular: rg.celular,
            email_principal: rg.email_principal
        }));

        console.log('Dado formatado para persistir: ', data);

        const recipientGroupSaved = await RecipientGroupModel.bulkCreate(data);

        if(!recipientGroupSaved) throw new Error('Erro ao salvar os grupos destinatários');

        const recipientsGroupResponse: RecipientGroup[] = recipientGroupSaved.map(recipientGroup => recipientGroup.get({plain: true}))

        console.log('RG salvo e manipulado: ', recipientsGroupResponse);

        return recipientsGroupResponse;
    }
    async deleteRecipientsGroup(campaignId: number): Promise<string> {
        try {
            const deleteResponse = await RecipientGroupModel.destroy({
                where: {campaignId}
            });
            
            console.log(deleteResponse);
            
            if (deleteResponse === 0)  'Não foi encontrado nenhum registro com o id passado - Falha';
    
            return 'Deletado com sucesso';
        } catch (error) {
            throw new Error(`Ocorreu algum erro ao deletar a tabela de grupo destinatário: ${error}`);
        }
    }
    async getRecipientGroupById(campaignId: number): Promise<RecipientGroupToSend> {
        console.log('Fazer a query de grupo destinatário: ', campaignId);
        const {rows, count} = await RecipientGroupModel.findAndCountAll({
            where: {campaignId}
        });

        if(rows.length <= 0) throw new Error('Não existe grupo destinatário para essa campanha');

        let recipientsGroup: RecipientGroup[] = [];

        rows.forEach(rg => {
            const pureObject = rg.get({plain: true})

            recipientsGroup.push(pureObject);
        });

        const response: RecipientGroupToSend = {
            recipientsGroup,
            count
        }

        console.log('Dado final de RecipientGroup Repository: ', response);
        
        return response;
    }
}