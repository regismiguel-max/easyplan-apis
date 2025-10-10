const db = require("../../../../../models");
const Bonuse = db.bonuse;
const { where, Op } = require("sequelize");

exports.addBonuse = (req, res) => {
    Bonuse.create({
        cliente: req.body.client,
        documento: req.body.document,
        bonificacao: req.body.bonificacao,
        previsao: req.body.previsao,
        dataPagamento: req.body.dataPagamento,
        vigencia: req.body.vigencia,
        status: req.body.status,
        prudutor: req.body.prudutor,
        idLoteBonuses: req.body.idLoteBonuses,
    })
        .then(bo => {
            if (bo) {
                res.send({
                    bonuse: bo,
                    message: "Bônus cadastrado com sucesso!",
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

exports.updateBonuse = async (req, res) => {
    await Bonuse.update(
        {
            dataPagamento: req.body.dataPagamento,
            status: req.body.status,
        },
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(bo => {
            if (bo) {
                Bonuse.findByPk(req.params.id)
                    .then((result) => {
                        res.send({
                            bonuse: result,
                            message: "Bônus atualizado com sucesso!",
                            sucesso: true
                        });
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
    Bonuse.findAll()
        .then(bo => {
            res.send({
                bonuse: bo,
                message: "Essa lista contém todos bônus cadastrados no sistema!",
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

exports.findBonuseDocument = (req, res) => {
    Bonuse.findAll(
        {
            where: {
                documento: req.params.documento,
                status: {
                    [Op.or]: ['PAGO', 'PENDENTE'],
                }
            }
        }
    )
        .then(bo => {
            res.send({
                bonuses: bo,
                message: "Essa lista contém o bônus cadastrado no sistema!",
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

exports.findBonuseDocumentSearch = (req, res) => {
    const where = {};
    if (req.body.documento) { where.documento = req.body.documento; };
    if (req.body.status) {
        where.status = req.body.status;
    }
    else {
        where.status = {
            [Op.or]: ['PAGO', 'PENDENTE'],
        }
    }
    if (req.body.dataInicio) {
        where.previsao = {
            [Op.between]: [req.body.dataInicio, req.body.dataFim],
        };
    };
    Bonuse.findAll(
        {
            where
        }
    )
        .then(bo => {
            res.send({
                bonuses: bo,
                message: "Essa lista contém o bônus cadastrado no sistema!",
                sucesso: true
            });;
        })
        .catch(err => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            })
        })
};

exports.findBonuseProdutorSearch = (req, res) => {
    let where;
    if (req.body.documento && req.body.produtor) {
        where = {
            [Op.or]: {
                documento: `%${req.body.documento}%`,
                produtor: `%${req.body.produtor}%`
            },
        }
    }
    else if (req.body.documento && !req.body.produtor) {
        where = { documento: { [Op.like]: `%${req.body.documento}%` } }
    }
    else if (req.body.produtor && !req.body.documento) {
        where = { produtor: { [Op.like]: `%${req.body.produtor}%` } }
    };
    Bonuse.findAll(
        {
            where
        }
    )
        .then(bo => {
            res.send({
                bonuses: bo,
                message: "Essa lista contém o bônus cadastrado no sistema!",
                sucesso: true
            });;
        })
        .catch(err => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            })
        })
};

exports.findBonuse = (req, res) => {
    Bonuse.findByPk(req.params.id,
        {
            include: [
                {
                    model: db.loteBonuses,
                },
            ],
        })
        .then(bo => {
            res.send({
                bonuse: bo,
                message: "Essa lista contém o bônus cadastrado no sistema!",
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

exports.findBonuseDigitalSaude = (req, res) => {
    Bonuse.findOne(
        {
            where: {
                codigoBonusesDigitalSaude: req.params.codigo,
            }
        }
    )
        .then(bo => {
            if (bo) {
                res.send({
                    bonuse: true,
                    sucesso: true
                });
            }
            else {
                res.send({
                    bonuse: false,
                    sucesso: true
                });
            }

        })
        .catch(err => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            })
        })
};

exports.findBonuseDigitalSaudeSearch = (req, res) => {
    console.log(req.body)
    Bonuse.findOne(
        {
            where: {
                codigoBonusesDigitalSaude: req.body.codigoBonusesDigitalSaude,
            }
        }
    )
        .then(bo => {
            if (bo) {
                res.send({
                    bonuse: true,
                    sucesso: true
                });
            }
            else {
                // Bonuse.findOne(
                //     {
                //         where: {
                //             dataLancamento: req.body.dataLancamento,
                //             documento: req.body.documento,
                //             numeroParcela: req.body.numeroParcela,
                //         }
                //     }
                // )
                //     .then(bon => {
                //         if (bon) {
                //             res.send({
                //                 bonuse: true,
                //                 sucesso: true
                //             });
                //         }
                //         else {
                            res.send({
                                bonuse: false,
                                sucesso: true
                            });
                    //     }

                    // })
                    // .catch(err => {
                    //     res.status(500).send({
                    //         message: err.message,
                    //         sucesso: false
                    //     })
                    // })
            }

        })
        .catch(err => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            })
        })
};

exports.deleteBonuse = async (req, res) => {
    await Bonuse.destroy({
        where: {
            id: req.params.id
        },
    }).then(bo => {
        res.send({
            message: "Bônus deletado com sucesso!",
            sucesso: true
        });
    })
        .catch(err => {
            res.status(401).send({
                message: err.message,
                sucesso: false
            });
        })
};