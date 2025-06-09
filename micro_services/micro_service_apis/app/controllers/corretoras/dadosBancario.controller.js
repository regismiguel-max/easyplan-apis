const db = require("../../../../../models");
const DadosBancario = db.corretoras_dados_bancarios;
const { where, Op } = require("sequelize");

exports.addDadosBancario = async (req, res) => {
    await DadosBancario.create({
        banco_ID: req.body.banco_ID,
        agencia: req.body.agencia,
        agencia_DV: req.body.agencia_DV,
        conta: req.body.conta,
        conta_DV: req.body.conta_DV,
        chave_PIX: req.body.chave_PIX,
        tipo_conta_ID: req.body.tipo_conta_ID
    })
        .then(async db => {
            if (db) {
                res.send({
                    dados_bancario: db,
                    message: "Dados bancario do corretor cadastrado com sucesso!",
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

exports.updateDadosBancario = async (req, res) => {
    await DadosBancario.update(
        {
            banco_ID: req.body.banco_ID,
            agencia: req.body.agencia,
            agencia_DV: req.body.agencia_DV,
            conta: req.body.conta,
            conta_DV: req.body.conta_DV,
            chave_PIX: req.body.chave_PIX,
            tipo_conta_ID: req.body.tipo_conta_ID
        },
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(async db => {
            if (db) {
                res.send({
                    dados_bancario: db,
                    message: "Dados bancarios da corretora atualizado com sucesso!",
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

exports.findAll = (req, res) => {
    DadosBancario.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ]
        }
    )
        .then(db => {
            res.send({
                dados_Bancarios: db,
                message: "Essa lista contém todas os dados bancarios cadastrados no sistema!",
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

exports.findDadosBancario = (req, res) => {
    DadosBancario.findByPk(req.params.id)
        .then(db => {
            res.send({
                dados_bancario: db,
                message: "Essa lista contém o dado bancario da corretora cadastrado no sistema!",
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

exports.deleteDadosBancario = async (req, res) => {
    await DadosBancario.destroy({
        where: {
            id: req.params.id
        },
    }).then(db => {
        res.send({
            message: "Dados bancario da corretora deletado com sucesso!",
            sucesso: true
        });
    }).catch(err => {
        res.status(401).send({
            message: err.message,
            sucesso: false
        });
    })
};