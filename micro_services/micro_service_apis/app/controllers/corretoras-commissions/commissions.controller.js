const db = require("../../../../../models");
const Commission = db.corretoras_commission;
const { where, Op } = require("sequelize");

exports.addCommission = (req, res) => {
    Commission.create({
        cliente: req.body.client,
        documento: req.body.document,
        comissao: req.body.comissao,
        previsao: req.body.previsao,
        dataPagamento: req.body.dataPagamento,
        vigencia: req.body.vigencia,
        status: req.body.status,
        prudutor: req.body.prudutor,
        idLoteCommissions: req.body.idLoteCommissions,
    })
        .then(co => {
            if (co) {
                res.send({
                    commission: co,
                    message: "Comissão cadastrada com sucesso!",
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

exports.updateCommission = async (req, res) => {
    await Commission.update(
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
        .then(co => {
            if (co) {
                Commission.findByPk(req.params.id)
                    .then((result) => {
                        res.send({
                            commission: result,
                            message: "Comissão atualizada com sucesso!",
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
    Commission.findAll()
        .then(co => {
            res.send({
                commission: co,
                message: "Essa lista contém todas comissões cadastradas no sistema!",
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

exports.findCommissionDocument = (req, res) => {
    Commission.findAll(
        {
            where: {
                corretora_CNPJ: req.params.corretora_CNPJ,
                data_pagamento: {
                    [Op.not]: null,
                }
            }
        }
    )
        .then(co => {
            res.send({
                commission: co,
                message: "Essa lista contém a comissão cadastrada no sistema!",
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

exports.findCommissionDigitalSaude = (req, res) => {
    Commission.findOne(
        {
            where: {
                codigoCommissionsDigitalSaude: req.params.codigo,
            }
        }
    )
        .then(bo => {
            if (bo) {
                res.send({
                    commission: true,
                    sucesso: true
                });
            }
            else {
                res.send({
                    commission: false,
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

exports.findCommissionDocumentSearch = (req, res) => {
    const where = {};
    if (req.body.documento) { where.corretora_CNPJ = req.body.documento; };
    where.data_pagamento = { [Op.not]: null, };
    if (req.body.dataInicio) {
        where.data_pagamento = {
            [Op.between]: [req.body.dataInicio, req.body.dataFim],
        };
    };
    Commission.findAll(
        {
            where
        }
    )
        .then(co => {
            res.send({
                commission: co,
                message: "Essa lista contém a comissão cadastrada no sistema!",
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

exports.findCommissionDocumentSearchName = (req, res) => {
    const where = {};
    if (req.body.documento) { where.corretora_CNPJ = req.body.documento; };
    where.nome_contrato = { [Op.substring]: req.body.nome_contrato, };

    Commission.findAll(
        {
            where
        }
    )
        .then(co => {
            res.send({
                commission: co,
                message: "Essa lista contém a comissão cadastrada no sistema!",
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

exports.findCommission = (req, res) => {
    Commission.findByPk(req.params.id,
        {
            include: [
                {
                    model: db.loteCommissions,
                },
            ],
        })
        .then(co => {
            res.send({
                commission: co,
                message: "Essa lista contém a comissão cadastrada no sistema!",
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

exports.deleteCommission = async (req, res) => {
    await Commission.destroy({
        where: {
            id: req.params.id
        },
    }).then(co => {
        res.send({
            message: "Comissão deletada com sucesso!",
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