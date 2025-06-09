const db = require("../../../../../models");
const Estado = db.utils_estados;
const Cidade = db.utils_cidades;

const { where, Op } = require("sequelize");



exports.addEstado = async (req, res) => {
    await Estado.create({
        estadoNome: req.body.estadoNome,
        estadoUF: req.body.estadoUF,
    })
        .then(async es => {
            if (es) {
                res.send({
                    estado: es,
                    message: "Estado cadastrado com sucesso!",
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

exports.addEstadoLote = async (req, res) => {
    let i = req.body.length;
    req.body.forEach(async (element, index) => {
        if (index === i - 1) {
            await Estado.create({
                estadoID: element.estadoID,
                estadoNome: element.estadoNome,
                estadoUF: element.estadoUF,
            })
                .then(async es => {
                    if (es) {
                        res.send({
                            message: "Estados cadastrados com sucesso!",
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
            await Estado.create({
                estadoID: element.estadoID,
                estadoNome: element.estadoNome,
                estadoUF: element.estadoUF,
            })
        }
    });
};

exports.updateEstado = async (req, res) => {
    await Estado.update(
        {
            estadoNome: req.body.estadoNome,
            estadoUF: req.body.estadoUF,
        },
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(async es => {
            if (es) {
                await Cidade.findAll({
                    where: {
                        estadoID: req.params.id
                    }
                }).then(async ci => {
                    let i = ci.length;
                    ci.forEach((element, index) => {
                        if (index === i - 1) {
                            Cidade.update(
                                {
                                    estadoNome: req.body.estadoNome,
                                    estadoUF: req.body.estadoUF,
                                },
                                {
                                    where: {
                                        id: element.id
                                    },
                                }
                            ).then(async b => {
                                Estado.findByPk(req.params.id,
                                    {
                                        include: [
                                            {
                                                model: db.cidade,
                                            },
                                        ],
                                    })
                                    .then((result) => {
                                        res.send({
                                            estado: result,
                                            message: "Estado atualizado com sucesso!",
                                            sucesso: true
                                        });
                                    });
                            }).catch(err => {
                                res.status(401).send({
                                    message: err.message,
                                    sucesso: false
                                });
                            })

                        }
                        else {
                            Cidade.update(
                                {
                                    estadoNome: req.body.estadoNome,
                                    estadoUF: req.body.estadoUF,
                                },
                                {
                                    where: {
                                        id: element.id
                                    },
                                }
                            )
                        }
                    });
                }).catch(err => {
                    res.status(401).send({
                        message: err.message,
                        sucesso: false
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
    Estado.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ],
        }
    )
        .then(es => {
            res.send({
                estados: es,
                message: "Essa lista contém todos os Estados cadastrados no sistema!",
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

exports.findEstado = (req, res) => {
    Estado.findByPk(req.params.id,
        {
            include: [
                {
                    model: db.utils_cidades,
                },
            ],
        })
        .then(es => {
            res.send({
                estado: es,
                message: "Essa lista contém o Estado cadastrado no sistema!",
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

exports.deleteEstado = async (req, res) => {
    await Cidade.findAll({
        where: {
            estadoID: req.params.id
        }
    }).then(async ci => {
        let i = ci.length;
        if (ci) {
            ci.forEach((element, index) => {
                if (index === i - 1) {
                    Cidade.destroy({
                        where: {
                            id: element.id
                        },
                    }).then(async bo => {
                        await Estado.destroy({
                            where: {
                                id: req.params.id
                            },
                        }).then(bo => {
                            res.send({
                                message: "Estado deletado com sucesso!",
                                sucesso: true
                            });
                        }).catch(err => {
                            res.status(401).send({
                                message: err.message,
                                sucesso: false
                            });
                        })
                    }).catch(err => {
                        res.status(401).send({
                            message: err.message,
                            sucesso: false
                        });
                    })

                }
                else {
                    Cidade.destroy({
                        where: {
                            id: element.id
                        },
                    })
                }
            });
        } else {
            await Estado.destroy({
                where: {
                    id: req.params.id
                },
            }).then(bo => {
                res.send({
                    message: "Estado deletado com sucesso!",
                    sucesso: true
                });
            }).catch(err => {
                res.status(401).send({
                    message: err.message,
                    sucesso: false
                });
            })
        }
    }).catch(err => {
        res.status(401).send({
            message: err.message,
            sucesso: false
        });
    });
};