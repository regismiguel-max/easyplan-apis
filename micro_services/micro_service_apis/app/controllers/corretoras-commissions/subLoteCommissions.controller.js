const db = require("../../../../../models");
const SubLoteCommissions = db.corretoras_subLoteCommissions;
const Commissions = db.corretoras_commission;
const Corretora = db.corretoras;
const NFDocumento = db.corretoras_commission_nf;
const WhatsApp = require("../whatsapp/whatsapp.controller")

const moment = require('moment');
const { where, Op } = require("sequelize");
const axios = require('axios');


exports.updateSubLoteCommissions = async (req, res) => {
    const partesData = req.body.data_pagamento.split('/');
    const dataPagamento = new Date(partesData[2], partesData[1] - 1, partesData[0]).toJSON();
    await SubLoteCommissions.update(
        {
            data_pagamento: req.body.data_pagamento ? dataPagamento : null,
            situacao_ID: req.body.situacao_ID,
            motivo: req.body.motivo ? req.body.motivo : '',
            disabled: req.body.disabled,
        },
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(async loco => {
            if (loco) {
                await Commissions.findAll({
                    where: {
                        sub_lote_commissions_ID: req.params.id
                    }
                }).then(async co => {
                    let i = co.length;
                    co.forEach((element, index) => {
                        if (index === i - 1) {
                            Commissions.update(
                                {
                                    data_pagamento: req.body.data_pagamento ? dataPagamento : null,
                                    situacao_ID: req.body.situacao_ID,
                                    motivo: req.body.motivo ? req.body.motivo : '',
                                },
                                {
                                    where: {
                                        id: element.id
                                    },
                                }
                            ).then(async c => {
                                NFDocumento.update(
                                    {
                                        situacao_ID: req.body.situacao_ID,
                                        motivo: req.body.motivo ? req.body.motivo : '',
                                    },
                                    {
                                        where: {
                                            id: element.nf_ID
                                        },
                                    }
                                ).then(async c => {
                                    SubLoteCommissions.findByPk(req.params.id,
                                        {
                                            include: [
                                                {
                                                    model: db.corretoras_commission,
                                                },
                                            ],
                                        })
                                        .then((result) => {
                                            res.send({
                                                loteCommissions: result,
                                                message: "Lote de comissões atualizado com sucesso!",
                                                sucesso: true
                                            });
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
                            Commissions.update(
                                {
                                    data_pagamento: req.body.data_pagamento ? dataPagamento : null,
                                    situacao_ID: req.body.situacao_ID,
                                    motivo: req.body.motivo ? req.body.motivo : '',
                                },
                                {
                                    where: {
                                        id: element.id
                                    },
                                }
                            )
                        }
                    });
                    if (Number(req.body.situacao_ID) === 1 || Number(req.body.situacao_ID) === 2) {
                        SubLoteCommissions.findOne(
                            {
                                where: {
                                    id: req.params.id,
                                }
                            }
                        )
                            .then(subl => {
                                Corretora.findOne(
                                    {
                                        where: {
                                            cnpj: subl.corretora_CNPJ
                                        },
                                        order: [
                                            ['createdAt', 'DESC']
                                        ],
                                        include: [
                                            {
                                                model: db.corretoras_contatos,
                                            },
                                            {
                                                model: db.corretoras_responsavels,
                                            },
                                        ],
                                    }
                                )
                                    .then(corr => {
                                        if (corr) {
                                            if (corr.corretoras_contatos.length > 0) {
                                                WhatsApp.sendMessageAlertLote(
                                                    {
                                                        whatsapp: `${corr.corretoras_contatos[0].whatsapp}`,
                                                        message: `Olá ${corr.corretoras_responsavels[0].nome}!
                
Informamos que sua nota fiscal foi ${Number(req.body.situacao_ID) === 1 ? '*aprovada*. Para assegurar um processamento ágil e eficaz do seu pagamento, solicitamos que acesse o aplicativo EasyPlan Corretor e acompanhe o status e a data prevista para o seu pagamento.' : `*reprovada*. Motivo: ${req.body.motivo}. Para garantir um processamento rápido e eficiente do seu pagamento, solicitamos que acesse o aplicativo *EasyPlan Corretor*, verifique os dados das suas comissões e gere sua nota fiscal. Assim que nos enviar a nota fiscal pelo aplicativo, iniciaremos o processo de pagamento.`}
                
Agradecemos por escolher a EasyPlan.
                
Se precisar de qualquer assistência, não hesite em nos contatar através do número _(61)98259-3281_.
                
Atenciosamente,
                
*Equipe EasyPlan*
                
_Esta é uma mensagem automática. Favor não responder_.
                                `,
                                                    },
                                                );
                                                axios.post(
                                                    'https://events.sendpulse.com/events/id/97cf7cdcfda84e4bdf14c9aca0b94aa0/8659497',
                                                    {
                                                        email: corr.corretoras_contatos[0].email,
                                                        phone: `55${corr.corretoras_contatos[0].whatsapp}`,
                                                        responsavel: corr.corretoras_responsavels[0].nome,
                                                        isnew: 'false',
                                                        isapproved: Number(req.body.situacao_ID) === 1 ? 'true' : 'false',
                                                        isauthentication: '',
                                                        url: ''
                                                    })
                                                    .then(function (response) {
                                                        // console.log(response);
                                                    })
                                                    .catch(function (error) {
                                                        // console.log(error);
                                                    });
                                            }
                                        }
                                    })
                                    .catch(err => { })
                            })
                            .catch(err => { })
                    }
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
    SubLoteCommissions.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ],
            include: [
                {
                    model: db.corretoras_commission,
                },
            ],
        }
    )
        .then(loco => {
            res.send({
                loteCommissions: loco,
                message: "Essa lista contém todos os lotes de comissões cadastrados no sistema!",
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

exports.findSubLoteCommissions = (req, res) => {
    SubLoteCommissions.findAll(
        {
            where: {
                lote_commissions_ID: req.params.id
            },
            order: [
                ['createdAt', 'DESC']
            ],
            include: [
                // {
                //     model: db.corretoras_commission,
                // },
                {
                    model: db.corretoras_commission_nf,
                },
            ],
        })
        .then(sublo => {
            res.send({
                subLotesCommissions: sublo,
                message: "Essa lista contém o sublotes de comissão cadastrado no sistema!",
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

exports.getSubLoteCommissions = (req, res) => {
    SubLoteCommissions.findAll(
        {
            where: {
                lote_commissions_ID: req.params.id
            },
            order: [
                ['createdAt', 'DESC']
            ],
        })
        .then(sublo => {
            let i = sublo.length;
            const sublotes = []
            sublo.forEach((element, index) => {
                console.log(element.corretora_CNPJ)
                if (index === i - 1) {
                    Corretora.findOne(
                        {
                            where: {
                                cnpj: element.corretora_CNPJ
                            },
                            include: [
                                {
                                    model: db.corretoras_dados_bancarios,
                                },
                            ],
                        }
                    ).then(async cor => {
                        NFDocumento.findOne(
                            {
                                where: {
                                    id: element.nf_ID
                                },
                            }
                        ).then(async nfs => {
                            sublotes.push({
                                sublote: element,
                                corretoras_commissions_nfs: nfs,
                                corretora: cor
                            });
                            res.send({
                                subLotesCommissions: sublotes,
                                message: "Essa lista contém o sublotes de comissão cadastrado no sistema!",
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
                    Corretora.findOne(
                        {
                            where: {
                                cnpj: element.corretora_CNPJ
                            },
                            include: [
                                {
                                    model: db.corretoras_dados_bancarios,
                                },
                            ],
                        }
                    ).then(async cor => {
                        NFDocumento.findOne(
                            {
                                where: {
                                    id: element.nf_ID
                                },
                            }
                        ).then(async nfs => {
                            sublotes.push({
                                sublote: element,
                                corretoras_commissions_nfs: nfs,
                                corretora: cor
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

            });
        })
        .catch(err => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            })
        })
};

exports.findSubLoteCommissionsID = (req, res) => {
    SubLoteCommissions.findAll(
        {
            where: {
                id: req.params.id
            },
            order: [
                ['createdAt', 'DESC']
            ],
            include: [
                {
                    model: db.corretoras_commission,
                },
                {
                    model: db.corretoras_commission_nf,
                },
            ],
        })
        .then(sublo => {
            res.send({
                subLotesCommissions: sublo,
                message: "Essa lista contém o sublotes de comissão cadastrado no sistema!",
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

exports.findSubLoteCommissionsDocument = (req, res) => {
    SubLoteCommissions.findAll(
        {
            where: {
                corretora_CNPJ: req.params.corretora_CNPJ,
                status_ID: 1
            },
            order: [
                ['createdAt', 'DESC']
            ],
            include: [
                {
                    model: db.corretoras_commission,
                },
                {
                    model: db.corretoras_commission_nf,
                },
            ],
        })
        .then(sublo => {
            res.send({
                subLotesCommissions: sublo,
                message: "Essa lista contém o sublotes de comissão cadastrado no sistema!",
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

exports.findLoteCommissionsNotification = async (req, res) => {
    SubLoteCommissions.findOne(
        {
            where: {
                id: req.params.id
            },
        }
    ).then(async sub => {
        Corretora.findOne(
            {
                where: {
                    cnpj: sub.corretora_CNPJ
                },
                order: [
                    ['createdAt', 'DESC']
                ],
                include: [
                    {
                        model: db.corretoras_contatos,
                    },
                    {
                        model: db.corretoras_responsavels,
                    },
                ],
            }
        )
            .then(corr => {
                if (corr) {
                    if (corr.corretoras_contatos.length > 0) {
                        WhatsApp.sendMessageAlertLote(
                            {
                                whatsapp: `${corr.corretoras_contatos[0].whatsapp}`,
                                message: `Olá ${corr.corretoras_responsavels[0].nome}!
    
Temos o prazer de informar que um novo lote de comissões está disponível para você na *EasyPlan*. Para garantir um processamento rápido e eficiente do seu pagamento, solicitamos que acesse o aplicativo *EasyPlan Corretor*, verifique os dados das suas comissões e gere sua nota fiscal. Assim que nos enviar a nota fiscal pelo aplicativo, iniciaremos o processo de pagamento.

Agradecemos por escolher a EasyPlan.

Se precisar de qualquer assistência, não hesite em nos contatar através do número _(61)98259-3281_.

Atenciosamente,

*Equipe EasyPlan*

_Esta é uma mensagem automática. Favor não responder_.
`,
                            },
                        );
                        axios.post(
                            'https://events.sendpulse.com/events/id/97cf7cdcfda84e4bdf14c9aca0b94aa0/8659497',
                            {
                                email: corr.corretoras_contatos[0].email,
                                phone: `55${corr.corretoras_contatos[0].whatsapp}`,
                                responsavel: corr.corretoras_responsavels[0].nome,
                                isnew: 'true',
                                isapproved: '',
                                isauthentication: '',
                                url: ''
                            })
                            .then(function (response) {
                                // console.log(response);
                            })
                            .catch(function (error) {
                                // console.log(error);
                            });
                        res.send({
                            message: "Notificação enviada com sucesso!",
                            sucesso: true
                        });
                    }
                    else {
                        res.send({
                            message: "Essa corretora ainda não está cadastrada no sistema",
                            sucesso: false
                        });
                    }
                }
            })
            .catch(err => {
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
    });
};

exports.findSubLoteCommissionsCommission = (req, res) => {
    Commissions.findAll(
        {
            where: {
                sub_lote_commissions_ID: req.params.id
            },
            order: [
                ['createdAt', 'DESC']
            ],
        })
        .then(co => {
            res.send({
                commissions: co,
                message: "Essa lista contém o lote de comissão cadastrado no sistema!",
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

exports.findSubLoteCommissionsSearch = (req, res) => {
    const where = {};
    if (req.body.lote_commissions_ID) { where.lote_commissions_ID = req.body.lote_commissions_ID; };
    if (req.body.documento) { where.corretora_CNPJ = req.body.documento; };
    if (req.body.situacao_ID) { where.situacao_ID = req.body.situacao_ID; };
    if (req.body.dataInicio) {
        where.createdAt = {
            [Op.between]: [req.body.dataInicio, req.body.dataFim],
        };
    };
    where.status_ID = 1;
    SubLoteCommissions.findAll(
        {
            where,
            order: [
                ['createdAt', 'DESC']
            ],
            include: [
                {
                    model: db.corretoras_commission,
                },
                {
                    model: db.corretoras_commission_nf,
                },
            ],
        })
        .then(loco => {
            res.send({
                subLotesCommissions: loco,
                message: "Essa lista contém o lote de comissão cadastrado no sistema!",
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

exports.findSubLoteCommissionsAllSearch = (req, res) => {
    const where = {};
    if (req.body.documento) { where.corretora_CNPJ = req.body.documento; };
    if (req.body.situacao_ID) { where.situacao_ID = req.body.situacao_ID; };
    if (req.body.dataInicio) {
        where.createdAt = {
            [Op.between]: [req.body.dataInicio, req.body.dataFim],
        };
    };
    where.status_ID = 1;
    SubLoteCommissions.findAll(
        {
            where,
            order: [
                ['createdAt', 'DESC']
            ],
            include: [
                {
                    model: db.corretoras_commission,
                },
                {
                    model: db.corretoras_commission_nf,
                },
            ],
        })
        .then(loco => {
            res.send({
                subLotesCommissions: loco,
                message: "Essa lista contém o lote de comissão cadastrado no sistema!",
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