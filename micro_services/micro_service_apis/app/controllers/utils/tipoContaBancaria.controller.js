const db = require("../../../../../models");
const TipoContaBancaria = db.utils_tipos_contas_bancarias;

const { where, Op } = require("sequelize");



exports.addTipoContaBancaria = async (req, res) => {
    await TipoContaBancaria.create({
        nome: req.body.nome,
    })
        .then(async tcb => {
            if (tcb) {
                res.send({
                    tipoContaBancaria: tcb,
                    message: "Tipo de conta bancaria cadastrada com sucesso!",
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

exports.addTipoContaBancariaLote = async (req, res) => {
    let i = req.body.length;
    req.body.forEach(async (element, index) => {
        if (index === i - 1) {
            await TipoContaBancaria.create({
                tipoContaBancariaID: element.tipoContaBancariaID,
                nome: element.nome,
            })
                .then(async tcb => {
                    if (tcb) {
                        res.send({
                            message: "Tipos de contas bancaria cadastradas com sucesso!",
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
        }
        else {
            await TipoContaBancaria.create({
                tipoContaBancariaID: element.tipoContaBancariaID,
                nome: element.nome,
            })
        }
    });
};

exports.updateTipoContaBancaria = async (req, res) => {
    await TipoContaBancaria.update(
        {
            nome: req.body.nome,
        },
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(async tcb => {
            if (tcb) {
                res.send({
                    tipoContaBancaria: tcb,
                    message: "Tipo de conta bancaria atualizada com sucesso!",
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
    TipoContaBancaria.findAll(
        {
            order: [
                ['nome', 'ASC']
            ]
        }
    )
        .then(tcb => {
            res.send({
                tipoContaBancaria: tcb,
                message: "Essa lista contém todas os tipos de contas bancaria cadastradas no sistema!",
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

exports.findTipoContaBancaria = (req, res) => {
    TipoContaBancaria.findByPk(req.params.id)
        .then(tcb => {
            res.send({
                tipoContaBancaria: tcb,
                message: "Essa lista contém o tipo de conta bancaria cadastrada no sistema!",
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

exports.deleteTipoContaBancaria = async (req, res) => {
    await TipoContaBancaria.destroy({
        where: {
            id: req.params.id
        },
    }).then(ci => {
        res.send({
            message: "Tipo de conta bancaria deletada com sucesso!",
            sucesso: true
        });
    }).catch(err => {
        res.status(401).send({
            message: err.message,
            sucesso: false
        });
    })
};