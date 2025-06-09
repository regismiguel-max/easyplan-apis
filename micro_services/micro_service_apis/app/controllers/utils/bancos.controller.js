const db = require("../../../../../models");
const Banco = db.utils_bancos;

const { where, Op } = require("sequelize");

exports.addBanco = async (req, res) => {
    await Banco.create({
        nome: req.body.nome,
        codigo: req.body.codigo,
        tipoObjetoID: req.body.tipoObjetoID,
    })
        .then(async bc => {
            if (bc) {
                res.send({
                    banco: bc,
                    message: "Banco cadastrado com sucesso!",
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

exports.addBancoLote = async (req, res) => {
    let i = req.body.length;
    req.body.forEach(async (element, index) => {
        if (index === i - 1) {
            await Banco.create({
                bancoID: element.bancoID,
                nome: element.nome,
                codigo: element.codigo,
                tipoObjetoID: element.tipoObjetoID,
            })
                .then(async bc => {
                    if (bc) {
                        res.send({
                            message: "Bancos cadastrados com sucesso!",
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
            await Banco.create({
                bancoID: element.bancoID,
                nome: element.nome,
                codigo: element.codigo,
                tipoObjetoID: element.tipoObjetoID,
            })
        }
    });
};

exports.updateBanco = async (req, res) => {
    await Banco.update(
        {
            nome: req.body.nome,
            codigo: req.body.codigo,
            tipoObjetoID: req.body.tipoObjetoID,
        },
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(async bc => {
            if (bc) {
                res.send({
                    banco: bc,
                    message: "Banco atualizado com sucesso!",
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
    Banco.findAll(
        {
            order: [
                ['codigo', 'ASC']
            ]
        }
    )
        .then(bc => {
            res.send({
                bancos: bc,
                message: "Essa lista contém todas os bancos cadastrados no sistema!",
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

exports.findBanco = (req, res) => {
    Banco.findByPk(req.params.id)
        .then(bc => {
            res.send({
                banco: bc,
                message: "Essa lista contém o banco cadastrado no sistema!",
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

exports.deleteBanco = async (req, res) => {
    await Banco.destroy({
        where: {
            id: req.params.id
        },
    }).then(bc => {
        res.send({
            message: "Banco deletado com sucesso!",
            sucesso: true
        });
    }).catch(err => {
        res.status(401).send({
            message: err.message,
            sucesso: false
        });
    })
};