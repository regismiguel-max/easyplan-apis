const db = require("../../../../../models");
const CommissionsEmpresa = db.corretoras_commission_empresa;

exports.findAll = (req, res) => {
    CommissionsEmpresa.findAll(
        {
            order: [
                ['razao_social', 'ASC']
            ],
        }
    )
        .then(emp => {
            res.send({
                empresas: emp,
                message: "Essa lista contém todos as empresas cadastradas no sistema!",
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

exports.findEmpresa= (req, res) => {
    CommissionsEmpresa.findByPk(req.params.id)
        .then(emp=> {
            res.send({
                empresa: emp,
                message: "Essa lista contém a empresa cadastrada no sistema!",
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
