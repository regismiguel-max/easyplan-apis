const { where, Op } = require("sequelize");
const { raw } = require("body-parser");
const db = require("../../../../../../models");
const Corretora = db.corretoras;

const IncentiveRepository = require("./repositories/incentivos.repository");
const { validateIncentivePayload } = require("./validators/incentive-validators");

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
        console.log('Persistido');
        
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
                where: {user_id}
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
            console.log('Passou na validação');
            
            const incentive = await db.incentives.findByPk(incentive_id)
            console.log('Persistido');
            
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
            console.log('Atualizado');
            
            return res.status(201).json({
                sucesso: true,
                message: "Incentivo atualizado com sucesso.",
                data: result.incentive,
            });
        } catch (error) {
            return res.status(500).json({
                sucesso: false,
                message: error.message || "Erro inesperado ao criar incentivo.",
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
}

module.exports = new IncentiveController();
