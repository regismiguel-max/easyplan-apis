const db = require("../../../../../models");
const Supervisor = db.corretoras_supervisors;
const { where, Op } = require("sequelize");

exports.addSupervisor = async (req, res) => {
    await Supervisor.create({
        nome: req.body.nome,
        cpf: req.body.cpf,
        email: req.body.email,
        telefone: req.body.telefone,
    })
        .then(async su => {
            if (su) {
                res.send({
                    supervisor: su,
                    message: "Supervisor cadastrado com sucesso!",
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

exports.updateSupervisor = async (req, res) => {
    await Supervisor.update(
        {
            nome: req.body.nome,
            cpf: req.body.cpf,
            email: req.body.email,
            telefone: req.body.telefone,
        },
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(async su => {
            if (su) {
                res.send({
                    supervisor: su,
                    message: "Supervisor atualizado com sucesso!",
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
    Supervisor.findAll(
        {
            order: [
                ['nome', 'ASC']
            ]
        }
    )
        .then(su => {
            res.send({
                supervisors: su,
                message: "Essa lista contém todas os supervisores cadastrados no sistema!",
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

exports.findSupervisor = (req, res) => {
    Supervisor.findByPk(req.params.id)
        .then(su => {
            res.send({
                supervisor: su,
                message: "Essa lista contém o supervisor cadastrado no sistema!",
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

exports.deleteSupervisor = async (req, res) => {
    await Supervisor.destroy({
        where: {
            id: req.params.id
        },
    }).then(su => {
        res.send({
            message: "Supervisor deletado com sucesso!",
            sucesso: true
        });
    }).catch(err => {
        res.status(401).send({
            message: err.message,
            sucesso: false
        });
    })
};