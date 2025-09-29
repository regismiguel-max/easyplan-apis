import { WhereOptions } from "sequelize";
import RecipientGroup, { RecipientGroupToSend } from "../../domain/entities/interfaces/recipient-group.interface";
import ClientModel from "../database/models/client.model";
import RecipientGroupModel from "../database/models/recipient-group.models";
import { sequelizeWhereToSQL } from "../../utils/sql-recipient-group/where-to-sql.util";
import { FilterStep } from "../../domain/entities/interfaces/email-campaign/output/process-filter.interface";
import connection_db from "../database/config/database";
import ClienteBeneficiarioTesteModel from "../database/models/client-test.model";
import ClienteBeneficiarioProductionModel from "../database/models/client-production.model";

export default class RecipientGroupRepository {
    //************************** RECIPIENT GROUP REPOSITORY ***************************/
    async getRecipientsByFilters(filters: WhereOptions): Promise<Partial<RecipientGroup>[] | string> {
        const recipientGroupDB = await ClienteBeneficiarioProductionModel.findAll({
            where: filters,
            attributes: ['operadora', 'convenio', 'subestipulante', 'plano', 'nome_do_beneficiario', 'vigencia', 'status_do_beneficiario', 'uf', 'ddd_celular', 'celular', 'email_principal', 'sexo', 'tipo_de_beneficiario']
        });
        // const recipientGroupDB = await ClienteBeneficiarioTesteModel.findAll({
        //     where: filters,
        //     attributes: ['operadora', 'convenio', 'subestipulante', 'plano', 'nome_do_beneficiario', 'vigencia', 'status_do_beneficiario', 'uf', 'ddd_celular', 'celular', 'email_principal', 'sexo', 'tipo_de_beneficiario']
        // });

        if(recipientGroupDB.length <= 0) return 'Não existe cliente(s) que atendam a esse conjunto de filtros';
        
        let response: Partial<RecipientGroup>[] = [];

        recipientGroupDB.forEach(recipient => {
            const pureObject = recipient.get({plain: true});
            
            response.push(pureObject);
        });

        console.log('Grupo Destinatário Geral - titulares e dependentes: ', response);
        const res = response.filter( rc => rc.tipo_de_beneficiario !== 'Dependente');

        console.log('Veja os titulares: ', res);
        

        return res;
    }
    async saveRecipientsGroup(recipientsGroup: Partial<RecipientGroup>[], campaignId: number): Promise<RecipientGroup[]> {
        const data: Partial<RecipientGroup>[] = recipientsGroup.map((rg) => ({
            campaignId,
            ddd_celular: rg.ddd_celular,
            celular: rg.celular,
            email_principal: rg.email_principal,
            operadora: rg.operadora,
            plano: rg.plano,
            status_do_beneficiario: rg.status_do_beneficiario,
            uf: rg.uf,
            sexo: rg.sexo,
            convenio: rg.convenio,
            subestipulante: rg.subestipulante,
            nome_do_beneficiario: rg.nome_do_beneficiario,
            vigencia: rg.vigencia
        }));

        console.log('Dado formatado para persistir: ', data);

        const recipientGroupSaved = await RecipientGroupModel.bulkCreate(data);

        if(!recipientGroupSaved) throw new Error('Erro ao salvar os grupos destinatários');

        const recipientsGroupResponse: RecipientGroup[] = recipientGroupSaved.map(recipientGroup => recipientGroup.get({plain: true}))

        console.log('RG salvo e manipulado: ', recipientsGroupResponse.length);

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

    async getFilterDiagnostics(filterSteps: FilterStep[]): Promise<{ report: string[], totalFinal: number }> {
        console.log('Entrou no diagnostic');
        
        let sqlParts: string[] = [];
        let previousStep = '`automation_cliente_digital_beneficiarios`';

        for (let i = 0; i < filterSteps.length; i++) {
            const step = filterSteps[i];
            console.log('Vamos entender cada 1: ', step);
            
            const stepAlias = `step_${i}`;
            console.log('Vamos entender o passo anterior: ', stepAlias);

            const whereClauseSQL = sequelizeWhereToSQL(step.where).trim();
            console.log('Vamos entender a whereSQL criada no util: ', whereClauseSQL);
            

            const hasConditions = whereClauseSQL !== '' && whereClauseSQL !== '1=1';

            const cte = `
                ${stepAlias} AS (
                    SELECT * FROM ${previousStep}
                    ${hasConditions ? `WHERE ${whereClauseSQL}` : ''}
                )`;

            console.log('Vamos entender o CTE criado: ', cte);
            
            sqlParts.push(cte);
            previousStep = stepAlias;
        }


        console.log('Sql criada: ', sqlParts);

        const finalSelect = `
            SELECT
                ${filterSteps.map((_, i) => `(SELECT COUNT(*) FROM step_${i}) AS after_${i}`).join(',\n    ')}
            `;

        const fullSQL = `WITH\n${sqlParts.join(',\n')}\n${finalSelect};`;

        console.log('Full sql criada: ', fullSQL);
        

        const result = await connection_db.query(fullSQL) as [Record<string, number>[], unknown];
        console.log('resultado da query: ', result);
        const rows = result[0];
        console.log('resultado da query acessando result[0]: ', rows);


        const report = filterSteps.map((step, i) => {
            console.log('Vamos vê o filterSteps: ', step);
            
            const count = rows[0][`after_${i}`];
            console.log('Count do resultado do filtro atual: ', count);
            
            const status = count === 0 ? '❌' : '✅';
            return `${status} O filtro ${step.label} está retornando: ${count} registro(s). Ajuste o filtro`;
        });
        console.log('Report final: ', report);
        
        const totalFinal = rows[0][`after_${filterSteps.length - 1}`];
        console.log('Total final que restou no ultimo filtro: ', report);

        return { report, totalFinal };
    }
}

// WITH
// base AS (
//     SELECT * FROM cliente_digital_beneficiarios
// ),
// filtro_idade AS (
//     SELECT * FROM base WHERE idade BETWEEN 1 AND 97
// ),
// filtro_status AS (
//     SELECT * FROM filtro_idade WHERE status_do_beneficiario IN ('ATIVO', 'SUSPENSO', 'CANCELADO')
// ),
// filtro_operadora AS (
//     SELECT * FROM filtro_status WHERE operadora IN ('Amil', 'Assim Saúde')
// ),
// filtro_plano AS (
//     SELECT * FROM filtro_operadora WHERE plano IN (
//         ' AMIL FACIL S80 QC  SP RJ DF PR PE  ',
//         'ASSIM SAUDE SUPERIOR QP APARTAMENTO COM COPART '
//     )
// ),
// filtro_uf AS (
//     SELECT * FROM filtro_plano WHERE uf IN ('AC', 'AL', 'AP')
// ),
// filtro_vigencia AS (
//     SELECT * FROM filtro_uf WHERE vigencia BETWEEN '2025-07-08 00:00:00' AND '2025-07-08 00:00:00'
// ),
// filtro_nascimento AS (
//     SELECT * FROM filtro_vigencia WHERE SUBSTRING(data_de_nascimento, 6, 2) = '03'
// )

// SELECT
//     (SELECT COUNT(*) FROM base) AS total_original,
//     (SELECT COUNT(*) FROM filtro_idade) AS depois_idade,
//     (SELECT COUNT(*) FROM filtro_status) AS depois_status,
//     (SELECT COUNT(*) FROM filtro_operadora) AS depois_operadora,
//     (SELECT COUNT(*) FROM filtro_plano) AS depois_plano,
//     (SELECT COUNT(*) FROM filtro_uf) AS depois_uf,
//     (SELECT COUNT(*) FROM filtro_vigencia) AS depois_vigencia,
//     (SELECT COUNT(*) FROM filtro_nascimento) AS depois_nascimento;