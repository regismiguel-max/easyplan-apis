const db = require("../../../../../models");
const Situacao = db.corretoras_situacoes;
const { where, Op } = require("sequelize");

exports.addSituacao = async (req, res) => {
    await Situacao.create({
        nome: req.body.situacao,
        descricao: req.body.descricao,
    })
        .then(async si => {
            if (si) {
                res.send({
                    situacao: si,
                    message: "Situação cadastrada com sucesso!",
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

exports.updateSituacao = async (req, res) => {
    await Situacao.update(
        {
            nome: req.body.situacao,
            descricao: req.body.descricao,
        },
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(async si => {
            if (si) {
                res.send({
                    situacao: si,
                    message: "Situação atualizada com sucesso!",
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
    Situacao.findAll(
        {
            order: [
                ['nome', 'ASC']
            ]
        }
    )
        .then(si => {
            res.send({
                situacoes: si,
                message: "Essa lista contém todas as situações cadastradas no sistema!",
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

exports.findSituacao = (req, res) => {
    Situacao.findByPk(req.params.id)
        .then(si => {
            res.send({
                situacao: si,
                message: "Essa lista contém a situação cadastrada no sistema!",
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

exports.deleteSituacao = async (req, res) => {
    await Situacao.destroy({
        where: {
            id: req.params.id
        },
    }).then(si => {
        res.send({
            message: "Situação deletada com sucesso!",
            sucesso: true
        });
    }).catch(err => {
        res.status(401).send({
            message: err.message,
            sucesso: false
        });
    })
};