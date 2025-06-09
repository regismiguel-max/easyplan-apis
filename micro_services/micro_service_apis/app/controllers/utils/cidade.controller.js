const db = require("../../../../../models");
const Estado = db.utils_estados;
const Cidade = db.utils_cidades;

const { where, Op } = require("sequelize");



exports.addCidade = async (req, res) => {
    await Cidade.create({
        cidadeNome: req.body.cidadeNome,
        estadoID: req.body.estadoID,
        estadoNome: req.body.estadoNome,
    })
        .then(async ci => {
            if (ci) {
                ci.setEstados(req.body.estadoID).then(() => {
                    res.send({
                        cidade: ci,
                        message: "Cidade cadastrada com sucesso!",
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

exports.addCidadeLote = async (req, res) => {
    let i = req.body.length;
    req.body.forEach(async (element, index) => {
        if (index === i - 1) {
            await Cidade.create({
                cidadeID: element.cidadeID,
                cidadeNome: element.cidadeNome,
                estadoID: element.estadoID,
                estadoNome: element.estadoNome,
            })
                .then(async ci => {
                    if (ci) {
                        ci.setEstados(element.estadoID).then(() => {
                            res.send({
                                message: "Cidades cadastradas com sucesso!",
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
        }
        else {
            await Cidade.create({
                cidadeID: element.cidadeID,
                cidadeNome: element.cidadeNome,
                estadoID: element.estadoID,
                estadoNome: element.estadoNome,
            })
                .then(async ci => {
                    if (ci) {
                        ci.setEstados(element.estadoID).then(() => { });
                    }
                })
        }
    });
};

exports.updateCidade = async (req, res) => {
    await Cidade.update(
        {
            cidadeNome: req.body.cidadeNome,
            estadoID: req.body.estadoID,
            estadoNome: req.body.estadoNome,
        },
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(async ci => {
            if (ci) {
                res.send({
                    cidade: ci,
                    message: "Cidade atualizada com sucesso!",
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
    Cidade.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ]
        }
    )
        .then(ci => {
            res.send({
                cidades: ci,
                message: "Essa lista contém todas as Cidades cadastradas no sistema!",
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

exports.findCidade = (req, res) => {
    Cidade.findByPk(req.params.id)
        .then(ci => {
            res.send({
                cidade: ci,
                message: "Essa lista contém a Cidade cadastrada no sistema!",
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

exports.deleteCidade = async (req, res) => {
    await Cidade.destroy({
        where: {
            id: req.params.id
        },
    }).then(ci => {
        res.send({
            message: "Cidade deletada com sucesso!",
            sucesso: true
        });
    }).catch(err => {
        res.status(401).send({
            message: err.message,
            sucesso: false
        });
    })
};