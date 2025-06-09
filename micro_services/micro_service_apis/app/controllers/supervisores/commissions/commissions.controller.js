const db = require("../../../../../../models");
const Commissions = db.corretoras_commission;

const { where, Op } = require("sequelize");

exports.findCommissions = (req, res) => {
    let where;
    if (req.body.documento && req.body.cliente) {
        where = {
            corretora_CNPJ: req.body.documento,
            nome_contrato: { [Op.like]: `%${req.body.cliente}%` },
            situacao_ID: {
                [Op.or]: [1, 3, 4],
            },
            status_ID: 1
        }
    }
    else if (req.body.documento && !req.body.cliente) {
        where = {
            corretora_CNPJ: req.body.documento,
            situacao_ID: {
                [Op.or]: [1, 3, 4],
            },
            status_ID: 1
        }
    }
    Commissions.findAll(
        {
            where,
            order: [
                ['createdAt', 'DESC']
            ],
        }
    )
        .then(co => {
            res.send({
                commissions: co,
                message: "Essa lista contém  comissões cadastradas no sistema!",
                sucesso: true
            });
        })
        .catch(err => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            })
        })
};
