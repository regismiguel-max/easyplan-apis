const db = require("../../../../../models");
const DadosAcesso = db.corretoras_dados_acessos;
const { where, Op } = require("sequelize");
var bcrypt = require("bcryptjs");

exports.addDadosAcesso = async (req, res) => {
    await DadosAcesso.create({
        cnpj: req.body.cnpj,
        password: bcrypt.hashSync(req.body.password, 8),
    })
        .then(async da => {
            if (da) {
                res.send({
                    dados_acesso_ID: da.id,
                    message: "Dados de acesso do corretor cadastrado com sucesso!",
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
                    message: "Dados de acesso da corretora atualizado com sucesso!",
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
            message: "Dados de acesso da corretora deletado com sucesso!",
            sucesso: true
        });
    }).catch(err => {
        res.status(401).send({
            message: err.message,
            sucesso: false
        });
    })
};