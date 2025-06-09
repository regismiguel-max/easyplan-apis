const db = require("../../../../../models");
const Operadora = db.redes_credenciadas_operadora;

exports.getOperadoraAll = (req, res) => {
    Operadora.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ]
        }
    )
        .then(ope => {
            res.send({
                operadoras: ope,
                message: "Essa lista contém as operadoras cadastradas no sistema!",
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