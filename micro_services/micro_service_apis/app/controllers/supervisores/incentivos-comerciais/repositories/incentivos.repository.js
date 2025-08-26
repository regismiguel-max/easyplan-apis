const { where } = require("sequelize");
const { incentives } = require("../../../../../../../models");
const db = require("../../../../../../../models");
const Incentives = db.incentives;

class IncentiveRepository {
    async save(payload) {
        console.log('Entrou no repository');
        
        try {
            const data = {
                name: payload.incentiveName,
                incentive_type: payload.incentiveType,
                incentive_description: payload.incentiveDescription,
                award_date: payload.dateAward || null,
                payment_award: payload.awardPrice || null,
                broker_cpf: payload.cpfCorretor || null,
                broker_name: payload.nameCorretor || null,
                life_goal: payload.lifeGoal || null,
                start_challenge_date: payload.startDate || null,
                end_challenge_date: payload.endDate || null,
                payment_life: payload.lifePrice || null,
                payment_challenge: payload.challengePrice || null,
                cnpj: payload.cnpjCorretora,
                user_id: payload.user_id,
                corretora_id: payload.corretora_id,
                status: payload.status,
                broker_cpf_1: payload.cpfCorretor1 || null,
                broker_name_1: payload.nameCorretor1 || null,
            };

            console.log('payload criado: ', data);
            
            const incentive = await Incentives.create(data);

            console.log('Dado persistido');
            
            return { sucesso: true, incentive };
        } catch (error) {
            throw new Error(`Erro ao salvar incentivo: ${error.message}`);
        }
    }

    async update(payload, user_id) {
        console.log('Entrou no repository');
        
        try {
            const data = {
                name: payload.incentiveName,
                incentive_type: payload.incentiveType,
                incentive_description: payload.incentiveDescription,
                award_date: payload.dateAward || null,
                payment_award: payload.awardPrice || null,
                broker_cpf: payload.cpfCorretor || null,
                broker_name: payload.nameCorretor || null,
                life_goal: payload.lifeGoal || null,
                start_challenge_date: payload.startDate || null,
                end_challenge_date: payload.endDate || null,
                payment_life: payload.lifePrice || null,
                payment_challenge: payload.challengePrice || null,
                cnpj: payload.cnpjCorretora,
                user_id: user_id
            };

            console.log('payload criado: ', data);
            
            const incentive = await Incentives.update(data, {
                where: {id: payload.incentive_id}
            });

            console.log('Dado persistido');
            
            return { sucesso: true, incentive };
        } catch (error) {
            throw new Error(`Erro ao ataualizar incentivo: ${error.message}`);
        }
    }
}

module.exports = IncentiveRepository;