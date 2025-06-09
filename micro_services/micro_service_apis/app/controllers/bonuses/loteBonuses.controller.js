const db = require("../../../../../models");
const LoteBonuses = db.loteBonuses;
const Bonuses = db.bonuse;
const Transaction = require("./produtorTransactionsBonuses.controler")
const Wallet = db.produtorWalletsBonuses;
const Transactions = db.produtorTransactionsBonuses;
const xlsx = require('node-xlsx');
const moment = require('moment');
const { where, Op } = require("sequelize");



exports.addLoteBonuse = async (req, res) => {
    const host = `${process.env.PROTOCOL}://${process.env.DOMAIN}/`;
    const bonuses = [];
    let totalBonificacoes = 0;
    const filePath = `${req.file.destination}${req.file.filename}`;
    const plan = await xlsx.parse(filePath);
    const unixTime = (plan[0].data[1][4] - 25569) * 86400 * 1000;
    const previsao = new Date(unixTime).toJSON();

    await plan[0].data.forEach(async (element, index) => {
        let unixTime2 = null;
        let vigencia = null
        if (index > 0) {
            unixTime2 = (plan[0].data[index][5] - 25569) * 86400 * 1000;
            vigencia = new Date(unixTime2).toJSON();
            bonuses.push(
                {
                    cliente: plan[0].data[index][3],
                    documento: String(plan[0].data[index][1]),
                    bonificacao: plan[0].data[index][2],
                    previsao: previsao,
                    dataPagamento: null,
                    vigencia: vigencia,
                    status: 'PENDENTE',
                    produtor: plan[0].data[index][0],
                    idLoteBonuses: '',
                    codigoBonusesDigitalSaude: ''
                }
            )
            totalBonificacoes += Number(plan[0].data[index][2].toFixed(2));
        }
    });


    await LoteBonuses.create({
        quantidade: bonuses.length,
        totalBonificacoes: totalBonificacoes,
        previsao: bonuses[0].previsao,
        dataPagamento: bonuses[0].dataPagamento,
        status: bonuses[0].status,
        arquivoUrl: `${host}${req.file.destination}${req.file.filename}`,
        disabled: false,
    })
        .then(async lobo => {
            if (lobo) {
                await bonuses.forEach(async (element, i) => {
                    bonuses[i].idLoteBonuses = lobo.id
                    Bonuses.create(element)
                        .then(bo => {
                            if (bo) {
                                bo.setLoteBonuses(lobo.id).then(() => {
                                    if (Number(bonuses.length) - 1 === Number(i)) {
                                        res.send({
                                            loteBonuses: lobo,
                                            message: "Lote de bonificações cadastrado com sucesso!",
                                            sucesso: true
                                        });
                                    }
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

exports.addLoteBonuseDigital = async (req, res) => {
    const bonuses = req.body.bonuses;
    const estornos = req.body.estornos;

    await LoteBonuses.create({
        quantidade: bonuses.length,
        totalBonificacoes: req.body.totalBonificacoes,
        previsao: req.body.previsao,
        dataPagamento: null,
        status: 'PENDENTE',
        quantidadeEstornos: estornos.length,
        totalEstornos: req.body.totalEstornos,
        dataInicial: req.body.dataInicial,
        dataFinal: req.body.dataFinal,
        arquivoUrl: ``,
        disabled: false,
    })
        .then(async lobo => {
            if (lobo) {
                let lotebonusesestornos;
                if (bonuses.length > 0 && estornos.length > 0) {
                    lotebonusesestornos = await bonuses.concat(estornos);
                }
                else {
                    if (bonuses.length > 0) {
                        lotebonusesestornos = await bonuses;
                    }
                    else {
                        lotebonusesestornos = await estornos;
                    }
                }

                await lotebonusesestornos.forEach(async (element, i) => {
                    lotebonusesestornos[i].idLoteBonuses = lobo.id
                    Bonuses.create(element)
                        .then(bo => {
                            if (bo) {
                                bo.setLoteBonuses(lobo.id).then(async () => {
                                    if (Number(lotebonusesestornos.length) - 1 === Number(i)) {
                                        await Bonuses.findAll({
                                            where: {
                                                idLoteBonuses: lobo.id
                                            }
                                        }).then(async bons => {
                                            if (bons.length > 0) {
                                                Transaction.CreateWallet(req, res, bons);
                                            } else {
                                                deleteLoteBonusesError(req, res, lobo.id);
                                            }
                                        }).catch(err => {
                                            deleteLoteBonusesError(req, res, lobo.id);
                                        });
                                    }
                                });
                            } else {
                                deleteLoteBonusesError(req, res, lobo.id);
                            }
                        })
                        .catch(err => {
                            deleteLoteBonusesError(req, res, lobo.id);
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

exports.updateLoteBonuse = async (req, res) => {
    const dataPagamento = new Date(moment(req.body.dataPagamento, "MM-DD-YYYY")).toJSON();
    await LoteBonuses.update(
        {
            dataPagamento: dataPagamento,
            status: req.body.status,
            disabled: req.body.disabled,
        },
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(async lobo => {
            if (lobo) {
                await Bonuses.findAll({
                    where: {
                        idLoteBonuses: req.params.id
                    }
                }).then(async bo => {
                    let i = bo.length;
                    bo.forEach((element, index) => {
                        if (index === i - 1) {
                            Bonuses.update(
                                {
                                    dataPagamento: dataPagamento,
                                    status: req.body.status,
                                },
                                {
                                    where: {
                                        id: element.id
                                    },
                                }
                            ).then(async b => {
                                LoteBonuses.findByPk(req.params.id,
                                    {
                                        include: [
                                            {
                                                model: db.bonuse,
                                            },
                                        ],
                                    })
                                    .then((result) => {
                                        res.send({
                                            loteBonuses: result,
                                            message: "Lote de bonificações atualizado com sucesso!",
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
                            Bonuses.update(
                                {
                                    dataPagamento: dataPagamento,
                                    status: req.body.status,
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

exports.closeLoteBonuse = async (req, res) => {
    let mom = moment(new Date()).format('YYYY-MM-DD HH:mm');
    const dataPagamento = new Date(mom).toJSON();

    await LoteBonuses.update(
        {
            dataPagamento: dataPagamento,
            status: 'PAGO',
            disabled: true,
        },
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(async lobo => {
            if (lobo) {
                await Bonuses.findAll({
                    where: {
                        idLoteBonuses: req.params.id
                    }
                }).then(async bo => {
                    let i = bo.length;
                    bo.forEach((element, index) => {
                        if (index === i - 1) {
                            Bonuses.update(
                                {
                                    dataPagamento: dataPagamento,
                                    status: 'PAGO',
                                },
                                {
                                    where: {
                                        id: element.id
                                    },
                                }
                            ).then(async b => {
                                LoteBonuses.findByPk(req.params.id,
                                    {
                                        include: [
                                            {
                                                model: db.bonuse,
                                            },
                                        ],
                                    })
                                    .then((result) => {
                                        res.send({
                                            loteBonuses: result,
                                            message: "Lote de bonificações concluído com sucesso!",
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
                            Bonuses.update(
                                {
                                    dataPagamento: dataPagamento,
                                    status: 'PAGO',
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
    LoteBonuses.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ]
        }
    )
        .then(lobo => {
            res.send({
                loteBonuses: lobo,
                message: "Essa lista contém todos os lotes de bonificações cadastrados no sistema!",
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

exports.findLoteBonuses = (req, res) => {
    LoteBonuses.findByPk(req.params.id,
        {
            include: [
                {
                    model: db.bonuse,
                },
            ],
        })
        .then(lobo => {
            res.send({
                loteBonuses: lobo,
                message: "Essa lista contém o lote de bonificação cadastrado no sistema!",
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

removeCircularReferences = (obj) => {
    const seen = new WeakSet();
    return JSON.parse(JSON.stringify(obj, (key, value) => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) return undefined; // Remove referência circular
            seen.add(value);
        }
        return value;
    }));
}

exports.findLoteBonusesAvailableBalance = async (req, res) => {
    try {
        const lobo = await LoteBonuses.findByPk(req.params.id, {
            include: [{ model: db.bonuse }]
        });

        if (!lobo) {
            return res.status(404).send({
                message: "Lote de bonificação não encontrado!",
                sucesso: false
            });
        }

        let totalBonificacoes = 0;
        const bonusMap = new Map(); // Armazena os documentos agrupados

        // Agrupa as bonificações por CPF antes de buscar as carteiras
        lobo.bonuses.forEach(element => {
            const cpf = element.documento.replace(/\D/g, ''); // Remove caracteres não numéricos

            if (bonusMap.has(cpf)) {
                const existingBonus = bonusMap.get(cpf);
                existingBonus.bonificacao += Number(element.bonificacao || 0);
                existingBonus.estorno += Number(element.estorno || 0);
            } else {
                bonusMap.set(cpf, {
                    documento: cpf,
                    bonificacao: Number(element.bonificacao || 0),
                    estorno: Number(element.estorno || 0),
                    previsao: element.previsao,
                    produtor: element.produtor,
                    idLoteBonuses: element.idLoteBonuses
                });
            }
        });

        // Buscar todas as carteiras de uma vez com os CPFs únicos
        const cpfsUnicos = Array.from(bonusMap.keys());
        const wallets = await Wallet.findAll({
            where: { produtorCPF: cpfsUnicos }
        });

        // Criamos um Map de carteiras para acesso rápido
        const walletMap = new Map(wallets.map(wl => [wl.produtorCPF, wl]));

        // Atualiza os valores do bonusMap com os dados da Wallet
        const filteredBonuses = [];
        bonusMap.forEach((bonus, cpf) => {
            const wallet = walletMap.get(cpf);

            if (!wallet || Number(wallet.saldoDisponivel) <= 0) return;

            bonus.saldoAtual = Number(wallet.saldoAtual);
            bonus.saldoProvisionado = Number(wallet.saldoProvisionado);
            bonus.saldoDisponivel = Number(wallet.saldoDisponivel);
            totalBonificacoes += bonus.saldoDisponivel;

            filteredBonuses.push(bonus);
        });

        res.send({
            loteBonuses: {
                id: lobo.id,
                bonuses: filteredBonuses,
                previsao: lobo.previsao,
                quantidade: filteredBonuses.length,
                status: lobo.status,
                totalBonificacoes
            },
            message: "Lista de bonificações agrupada com sucesso!",
            sucesso: true
        });

    } catch (err) {
        console.error("Erro ao processar a busca:", err.message);
        res.status(500).send({
            message: err.message,
            sucesso: false
        });
    }
};


exports.findLoteBonusesSearch = (req, res) => {
    const where = {};
    if (req.body.status) { where.status = req.body.status; };
    if (req.body.dataInicio) {
        where.createdAt = {
            [Op.between]: [req.body.dataInicio, req.body.dataFim],
        };
    };
    LoteBonuses.findAll(
        {
            where
        },
        {
            include: [
                {
                    model: db.bonuse,
                },
            ],
        })
        .then(lobo => {
            res.send({
                loteBonuses: lobo,
                message: "Essa lista contém o lote de bonificação cadastrado no sistema!",
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

exports.deleteLoteBonusesErrorTransactions = async (req, res, lobo_ID) => {
    deleteLoteBonusesError(req, res, lobo_ID);
}

deleteLoteBonusesError = async (req, res, lobo_ID) => {
    await Bonuses.findAll({
        where: {
            idLoteBonuses: lobo_ID
        }
    }).then(async bo => {
        let i = bo.length;
        if (bo.length > 0) {
            bo.forEach((element, index) => {
                if (index === i - 1) {
                    Bonuses.destroy({
                        where: {
                            id: element.id
                        },
                    }).then(async bo => {
                        await LoteBonuses.destroy({
                            where: {
                                id: lobo_ID
                            },
                        }).then(bo => {
                            res.send({
                                message: "Algo deu errado. Verifique e tente novamente!",
                                sucesso: false
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
                    Bonuses.destroy({
                        where: {
                            id: element.id
                        },
                    })
                }
            });
        } else {
            await LoteBonuses.destroy({
                where: {
                    id: lobo_ID
                },
            }).then(bo => {
                res.send({
                    message: "Algo deu errado. Verifique e tente novamente!",
                    sucesso: false
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

goDeleteLoteBonuses = async (req, res, lobo_ID, msg) => {
    await Bonuses.findAll({
        where: {
            idLoteBonuses: lobo_ID
        }
    }).then(async bo => {
        let i = bo.length;
        if (bo.length > 0) {
            bo.forEach((element, index) => {
                if (index === i - 1) {
                    Bonuses.destroy({
                        where: {
                            id: element.id
                        },
                    }).then(async bo => {
                        await LoteBonuses.destroy({
                            where: {
                                id: lobo_ID
                            },
                        }).then(bo => {
                            res.send({
                                message: msg ? msg : "Algo deu errado. Verifique e tente novamente!",
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
                    Bonuses.destroy({
                        where: {
                            id: element.id
                        },
                    })
                }
            });
        } else {
            await LoteBonuses.destroy({
                where: {
                    id: lobo_ID
                },
            }).then(bo => {
                res.send({
                    message: msg ? msg : "Algo deu errado. Verifique e tente novamente!",
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

exports.deleteLoteBonuses = async (req, res) => {
    try {
        const transactions = await Transactions.findAll({
            where: { idLoteBonuses: req.params.id }
        });

        if (transactions.length === 0) {
            return goDeleteLoteBonuses(req, res, req.params.id, 'Lote de bonificações e suas transações foram excluídos com sucesso!');
        }

        for (const transaction of transactions) {
            const cpf = transaction.produtorCPF.replace(/\D/g, '');

            // Buscar a carteira atualizada antes de cada operação
            const wallet = await Wallet.findOne({ where: { produtorCPF: cpf } });

            if (transaction.calculated && wallet) {
                let valor = Number(transaction.valor);
                let novoSaldoAtual = Number(wallet.saldoAtual);
                let novoSaldoDisponivel = Number(wallet.saldoDisponivel);

                if (transaction.tipo === 'credito') {
                    novoSaldoAtual -= valor;
                    novoSaldoDisponivel -= valor;
                } else if (transaction.tipo === 'debito') {
                    novoSaldoAtual += valor;
                    novoSaldoDisponivel += valor;
                }

                // Atualiza a carteira no banco
                await Wallet.update(
                    {
                        saldoAtual: novoSaldoAtual.toFixed(2),
                        saldoDisponivel: novoSaldoDisponivel.toFixed(2)
                    },
                    { where: { id: wallet.id } }
                );
            }

            // Deletar a transação após a atualização da carteira
            await Transactions.destroy({ where: { id: transaction.id } });
        }

        // Depois que todas as transações foram removidas, excluir o Lote de Bonificações
        return goDeleteLoteBonuses(req, res, req.params.id, 'Lote de bonificações e suas transações foram excluídos com sucesso!');
    } catch (err) {
        console.error("Erro ao excluir lote de bonificações:", err);
        return deleteLoteBonusesError(req, res, req.params.id);
    }

    // await Bonuses.findAll({
    //     where: {
    //         idLoteBonuses: req.params.id
    //     }
    // }).then(async bo => {
    //     let i = bo.length;
    //     if (bo) {
    //         bo.forEach((element, index) => {
    //             if (index === i - 1) {
    //                 Bonuses.destroy({
    //                     where: {
    //                         id: element.id
    //                     },
    //                 }).then(async bo => {
    //                     await LoteBonuses.destroy({
    //                         where: {
    //                             id: req.params.id
    //                         },
    //                     }).then(bo => {
    //                         res.send({
    //                             message: "Lote de bonificações deletado com sucesso!",
    //                             sucesso: true
    //                         });
    //                     }).catch(err => {
    //                         res.status(401).send({
    //                             message: err.message,
    //                             sucesso: false
    //                         });
    //                     })
    //                 }).catch(err => {
    //                     res.status(401).send({
    //                         message: err.message,
    //                         sucesso: false
    //                     });
    //                 })

    //             }
    //             else {
    //                 Bonuses.destroy({
    //                     where: {
    //                         id: element.id
    //                     },
    //                 })
    //             }
    //         });
    //     } else {
    //         await LoteBonuses.destroy({
    //             where: {
    //                 id: req.params.id
    //             },
    //         }).then(bo => {
    //             res.send({
    //                 message: "Lote de bonificações deletado com sucesso!",
    //                 sucesso: true
    //             });
    //         }).catch(err => {
    //             res.status(401).send({
    //                 message: err.message,
    //                 sucesso: false
    //             });
    //         })
    //     }
    // }).catch(err => {
    //     res.status(401).send({
    //         message: err.message,
    //         sucesso: false
    //     });
    // });
};