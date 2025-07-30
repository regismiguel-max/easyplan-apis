const db = require("../../../../../models");
const Operadora = db.utils_operadoras_digital;

const { where, Op } = require("sequelize");

exports.findAll = (req, res) => {
    Operadora.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ],
        }
    )
        .then(ope => {
            res.send({
                operadoras: ope,
                message: "Essa lista contém todas as operadoras cadastradas no sistema!",
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

exports.findOperadora = (req, res) => {
    Operadora.findByPk(req.params.id)
        .then(ope => {
            res.send({
                operadora: ope,
                message: "Essa lista contém a operadora cadastrada no sistema!",
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
