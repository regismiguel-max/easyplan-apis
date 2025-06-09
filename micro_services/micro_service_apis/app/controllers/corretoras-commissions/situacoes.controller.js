const db = require("../../../../../models");
const CommissionsSituacoes = db.corretoras_commission_situacao;

exports.findAll = (req, res) => {
    CommissionsSituacoes.findAll(
        {
            order: [
                ['nome', 'ASC']
            ],
        }
    )
        .then(st => {
            res.send({
                situacoes: st,
                message: "Essa lista contém todos as situações das comissões cadastradas no sistema!",
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
