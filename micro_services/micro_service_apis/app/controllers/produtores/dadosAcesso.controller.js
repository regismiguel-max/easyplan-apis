const db = require("../../../../../models");
const DadosAcesso = db.produtores_dados_acessos;
const { where, Op } = require("sequelize");
var bcrypt = require("bcryptjs");

exports.addDadosAcesso = async (req, res) => {
    await DadosAcesso.create({
        cpf: req.body.cpf,
        password: bcrypt.hashSync(req.body.password, 8),
    })
        .then(async da => {
            if (da) {
                res.send({
                    dados_acesso_ID: da.id,
                    message: "Dados de acesso do produtor cadastrado com sucesso!",
                    sucesso: true
                });

            } else {
                res.status(401).send({
                    message: err.message,
                    sucesso: false
                });
            }
        })
        .catch(err => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            });
        });
};

exports.updateDadosAcesso = async (req, res) => {
    await DadosAcesso.update(
        {
            password: bcrypt.hashSync(req.body.password, 8),
        },
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(async da => {
            if (da) {
                res.send({
                    dados_acesso_ID: da.id,
                    message: "Dados de acesso do produtor atualizado com sucesso!",
                    sucesso: true
                });

            } else {
                res.status(401).send({
                    message: err.message,
                    sucesso: false
                });
            }
        })
        .catch(err => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            });
        });
};

exports.deleteDadosAcesso = async (req, res) => {
    await DadosAcesso.destroy({
        where: {
            id: req.params.id
        },
    }).then(da => {
        res.send({
            message: "Dados de acesso do produtor deletado com sucesso!",
            sucesso: true
        });
    }).catch(err => {
        res.status(401).send({
            message: err.message,
            sucesso: false
        });
    })
};