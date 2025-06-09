const db = require("../../../../../models");
const CommissionsStatus = db.corretoras_commission_status;

exports.findAll = (req, res) => {
    CommissionsStatus.findAll(
        {
            order: [
                ['nome', 'ASC']
            ],
        }
    )
        .then(st => {
            res.send({
                status: st,
                message: "Essa lista contém todos os status das comissões cadastradas no sistema!",
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
