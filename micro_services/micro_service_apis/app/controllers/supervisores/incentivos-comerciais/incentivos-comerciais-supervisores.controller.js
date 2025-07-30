const { where, Op } = require("sequelize");
const { raw } = require("body-parser");
const db = require("../../../../../../models");
const Corretora = db.corretoras;

const IncentiveRepository = require("./repositories/incentivos.repository");
const { validateIncentivePayload } = require("./validators/incentive-validators");
const corretoraModel = require("../../../../../../models/corretoras/corretora.model");
const PlaniumPropostaService = require("./services/planium-propostas.service");

class IncentiveController {

    async save(req, res) {
        try {
        const payload = req.body;

        console.log('Entrou na controller: ', payload);
        
        const { valid, message } = validateIncentivePayload(payload);
        if (!valid) return res.status(400).json({ sucesso: false, message });
        console.log('Passou na validação');

        const IncentiveRepositoryInstance = new IncentiveRepository();
        const result = await IncentiveRepositoryInstance.save(payload);
        console.log('Persistido: ', result);
        
        return res.status(201).json({
            sucesso: true,
            message: "Incentivo criado com sucesso.",
            data: result.incentive,
        });
        } catch (error) {
            return res.status(500).json({
                sucesso: false,
                message: error.message || "Erro inesperado ao criar incentivo.",
            });
        }
    }
    async getAll(req, res) {
        try {
            console.log('Entrou na controller');
            const user_id = req.query.user_id;
            
            if (!user_id) return res.status(400).json({ sucesso: false, message: 'Não foi encontrado nenhum user_id nos parâmetros da requisição' });
            console.log('Passou na validação');
            
            const incentives = await db.incentives.findAll({
                where: {user_id},
                include: {model: db.corretoras, as: 'corretora'}
            })
            
            console.log('Incentivos Encontrados: ', incentives);
            
            return res.status(201).json({
                sucesso: true,
                message: "Incentivos encontrados com sucesso.",
                data: incentives,
            });
        } catch (error) {
            return res.status(500).json({
                sucesso: false,
                message: error.message || "Erro inesperado ao buscar incentivos.",
            });
        }
    }
    async getById(req, res) {
        try {
            // const user_id = req.query.user_id;
            const incentive_id = req.query.incentive_id;
            
            if (!incentive_id) return res.status(400).json({ sucesso: false, message: 'Não foi encontrado nenhum user_id ou identificador do incentivo nos parâmetros da requisição' });
            console.log('Passou na validação: ', incentive_id);
            
            const incentive = await db.incentives.findByPk(incentive_id, {
                include: [
                    {model: db.corretoras, as: 'corretora'},
                    {model: db.incentives_propostas, as: 'propostas'},
                    {model: db.incentives_results, as: 'result'}
                ]
            })
            console.log('Persistido: ', incentive);
            
            return res.status(201).json({
                sucesso: true,
                message: "Incentivo encontrado com sucesso.",
                data: incentive,
            });
        } catch (error) {
            return res.status(500).json({
                sucesso: false,
                message: error.message || "Erro inesperado ao criar incentivo.",
            });
        }
    }
    
    async update(req, res) {
        try {
            
            const payload = req.body;
            console.log('Entrou na controller: ', payload);
            // const user_id = req.query.user_id;
            const incentive_id = req.query.incentive_id;
            if (!incentive_id) return res.status(400).json({ sucesso: false, message: 'Não foi encontrado nenhum user_id ou identificador do incentivo nos parâmetros da requisição' });
            
            const { valid, message } = validateIncentivePayload(payload);
            if (!valid) return res.status(400).json({ sucesso: false, message });
            console.log('Passou na validação');
            
            const IncentiveRepositoryInstance = new IncentiveRepository();
            const result = await IncentiveRepositoryInstance.update(payload, incentive_id);
            console.log('Atualizado', result);
            
            return res.status(201).json({
                sucesso: true,
                message: "Incentivo atualizado com sucesso.",
            });
        } catch (error) {
            return res.status(500).json({
                sucesso: false,
                message: error.message || "Erro inesperado ao atualizar incentivo.",
            });
        }
    }
    
    async delete(req, res) {
        try {
            const incentive_id = req.query.incentive_id;

            if (!incentive_id) return res.status(400).json({ sucesso: false, message: 'Não foi encontrado nenhum identificador do incentivo nos parâmetros da requisição' });
            console.log('Passou na validação');

            const deleteResult = await db.incentives.destroy({
                where: {id: incentive_id}
            })
            console.log('Persistido ', deleteResult);
            
            return res.status(201).json({
                sucesso: true,
                message: "Incentivo deletado com sucesso.",
                data: deleteResult,
            });
        } catch (error) {
            return res.status(500).json({
                sucesso: false,
                message: error.message || "Erro inesperado ao criar incentivo.",
            });
        }
    }

    async getAllCorretorasByName(req, res) {
        try {
        const corretoraName = req.query.corretoraName;
        console.log(corretoraName);

        if (!corretoraName || typeof corretoraName !== "string") {
            return res
            .status(400)
            .json({
                error:
                "Parâmetro corretoraName é obrigatório e deve ser uma string.",
            });
        }

        const corretoras = await Corretora.findAll({
            where: {
            razao_social: {
                [Op.like]: `%${corretoraName}%`,
            },
            },
            raw: true,
        });
        console.log(corretoras);

        if (corretoras.length === 0) {
            return res
            .status(404)
            .json({ message: "Nenhuma corretora encontrada com esse nome." });
        }

        return res.status(200).json({
            corretoras: corretoras,
        });
        } catch (error) {
        return res
            .status(500)
            .json({ message: "Erro ao buscar corretoras.", erro: error });
        }
    }

    async getSales(req, res) {
        const planiumPayload = req.body;
        console.log('Chegou na controller: ', planiumPayload);

        const apiPleniumService = new PlaniumPropostaService();

        apiPleniumService.getPropostas(planiumPayload);
    }

    async getUltimaProposta(req, res) {
        try {
            // const user_id = req.query.user_id;
            const incentive_id = req.query.incentive_id;
            
            if (!incentive_id) return res.status(400).json({ sucesso: false, message: 'Não foi encontrado nenhum user_id ou identificador do incentivo nos parâmetros da requisição' });
            console.log('Passou na validação: ', incentive_id);
            
            const propostaDataCriacao = await db.incentives_propostas.findOne({
                where: {incentive_id},
                order: [['data_criacao', 'DESC']],
                attributes: [ 'data_criacao' ]
            })
            console.log('Olha o retorno: ', propostaDataCriacao);
            
            if(propostaDataCriacao){
                return res.status(201).json({
                    sucesso: true,
                    message: "Tem dado",
                    data: propostaDataCriacao,
                });
            } else {
                return res.status(201).json({
                    sucesso: true,
                    message: "Não tem dado",
                });
            }
        } catch (error) {
            return res.status(500).json({
                sucesso: false,
                message: error.message || "Erro inesperado ao criar incentivo.",
            });
        }
    }

    async getFaturaPaga(req, res) {
        const incentive_id = req.query.incentive_id;

        console.log('Caiu no server e com o id certin: ', incentive_id);
        //Pegar todos os CPF das vendas relacionadas ao Desafio em questão
        const propostasDB = await db.incentives_propostas.findAll({
            where: {incentive_id}
        });

        console.log('Validar o retorno de propostas: ', propostasDB);
        
        const propostas = propostasDB.map(proposta => proposta.get({plain: true}))

        // Realizar a query no nosso banco Buscando o codigo_do_contrato na tabela de Beneficiário através do CPF
        let codigos_cpfs = [];
        for(let proposta of propostas){
            const codigoDB = await db.automation_cliente_digital_beneficiario.findOne({
                where: {cpf: proposta.contratante_cpf},
                attributes: ['codigo_do_contrato']
            });

            const codigo = codigoDB.map(codigo => codigo.get({plain: true}))

            codigos_cpfs.push(
                {
                    cpf: proposta.contratante_cpf,
                    codigo
                }
            );
        }

        console.log('Vejamos como ficou o final de tudo: ', codigos_cpfs);
        
        // Realizar a query no Digital Saúde por Fatura paga através do codigo_do_contrato do Beneficiário
    }
}

module.exports = new IncentiveController();
