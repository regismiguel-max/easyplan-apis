const db = require("../../../../../models");
const CommissionsModalidades = db.corretoras_commission_modalidade;

exports.findAll = (req, res) => {
    CommissionsModalidades.findAll(
        {
            order: [
                ['nome', 'ASC']
            ],
        }
    )
        .then(mod => {
            res.send({
                modalidades: mod,
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
