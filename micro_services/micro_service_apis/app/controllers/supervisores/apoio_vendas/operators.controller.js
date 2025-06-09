const db = require("../../../../../../models");
const Operator = db.operator;

exports.findAll = (req, res) => {
    Operator.findAll(
        {
            order: [
                ['name', 'ASC']
            ],
        }
    )
        .then(ops => {
            res.send({
                operators: ops,
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

exports.findOperator = (req, res) => {
    Operator.findByPk(req.params.id,
        {
            include: [
                db.document,
            ],
        }
    )
        .then(op => {
            res.send({
                operator: op,
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
