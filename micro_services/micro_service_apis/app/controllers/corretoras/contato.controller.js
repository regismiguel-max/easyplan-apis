const db = require("../../../../../models");
const Contato = db.corretoras_contatos;
const { where, Op } = require("sequelize");

exports.addContato = async (req, res) => {
    await Contato.create({
        email: req.body.email,
        telefone: req.body.telefone,
        whatsapp: req.body.whatsapp,
    })
        .then(async co => {
            if (co) {
                res.send({
                    contato: co,
                    message: "Contato cadastrado com sucesso!",
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

exports.updateContato = async (req, res) => {
    await Contato.update(
        {
            email: req.body.email,
            telefone: req.body.telefone,
            whatsapp: req.body.whatsapp,
        },
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(async co => {
            if (co) {
                res.send({
                    contato: co,
                    message: "Contatos atualizados com sucesso!",
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
    Contato.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ]
        }
    )
        .then(co => {
            res.send({
                contatos: co,
                message: "Essa lista contém todas os contatos cadastrados no sistema!",
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

exports.findContato = (req, res) => {
    Contato.findByPk(req.params.id)
        .then(co => {
            res.send({
                contato: co,
                message: "Essa lista contém o contato cadastrado no sistema!",
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

exports.deleteContato = async (req, res) => {
    await Contato.destroy({
        where: {
            id: req.params.id
        },
    }).then(co => {
        res.send({
            message: "Contato deletado com sucesso!",
            sucesso: true
        });
    }).catch(err => {
        res.status(401).send({
            message: err.message,
            sucesso: false
        });
    })
};