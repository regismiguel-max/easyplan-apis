const db = require("../../../../../models");
const { sequelize } = require('../../../../../models');
const LoteCommissions = db.corretoras_loteCommissions;
const SubLoteCommissions = db.corretoras_subLoteCommissions;
const Commissions = db.corretoras_commission;
const Corretora = db.corretoras;

const WhatsApp = require("../whatsapp/whatsapp.controller")

const xlsx = require('node-xlsx');
const moment = require('moment');
const { where, Op } = require("sequelize");
const axios = require('axios');
const path = require('path');

const Wallet = db.corretoraWalletsCommissions;
const Transaction = db.corretoraTransactionsCommissions;


exports.addLoteCommissions = async (req, res) => {
    const baseUploadPath = path.resolve(__dirname, '../../../../../uploads');

    // Caminho absoluto real do arquivo salvo
    const fullFilePath = path.join(req.file.destination, req.file.filename);

    // Caminho relativo a /uploads
    const relativePath = path.relative(baseUploadPath, fullFilePath).replace(/\\/g, '/');

    // URL pública
    const host = `${process.env.PROTOCOL}://${process.env.DOMAIN}`;
    const publicUrl = `${host}/uploads/${relativePath}`;
    const lotecnpj = [];
    let totalContrato = 0;
    let totalProvisionado = 0;
    const filePath = fullFilePath;
    const plan = await xlsx.parse(filePath);
    const unixTime = (plan[0].data[1][11] - 25569) * 86400 * 1000;
    const previsao = new Date(unixTime).toJSON();

    await plan[0].data.forEach(async (element, index) => {
        if (index > 0) {
            if (lotecnpj.indexOf(plan[0].data[index][1]) === -1) {
                lotecnpj.push(plan[0].data[index][1]);
            }
            totalContrato += Number(plan[0].data[index][10].toFixed(2));
            totalProvisionado += Number(plan[0].data[index][12].toFixed(2));
        }
    });

    await LoteCommissions.create({
        quantidade: Number(plan[0].data.length) - 1,
        total_contrato: totalContrato,
        total_provisionado: totalProvisionado,
        data_previsao: previsao,
        status_ID: 3,
        empresa_ID: null,
        arquivo_URL: publicUrl,
        disabled: false,
    })
        .then(async lote => {
            if (lote) {
                await lotecnpj.forEach(async (element, index) => {
                    const commi = [];
                    let subTotalContrato = 0;
                    let subtotalProvisionado = 0;
                    await plan[0].data.forEach((el, i) => {
                        if (i > 0) {
                            if (String(element) === String(el[1])) {
                                commi.push({
                                    corretora: plan[0].data[i][0],
                                    corretora_CNPJ: String(plan[0].data[i][1]),
                                    produtor: plan[0].data[i][2],
                                    nome_contrato: plan[0].data[i][3],
                                    cpf_cnpj_contrato: plan[0].data[i][4],
                                    operadora: plan[0].data[i][5],
                                    modalidade: plan[0].data[i][6],
                                    parcela: plan[0].data[i][7],
                                    percentual_comissao: plan[0].data[i][8],
                                    vidas: plan[0].data[i][9],
                                    valor_contrato: plan[0].data[i][10],
                                    data_previsao: previsao,
                                    data_pagamento: null,
                                    valor_provisionado: plan[0].data[i][12],
                                    situacao_ID: 4,
                                    status_ID: 3,
                                    sub_lote_commissions_ID: null,
                                    lote_commissions_ID: null,
                                    nf_ID: null,
                                })
                                subTotalContrato += Number(plan[0].data[i][10].toFixed(2));
                                subtotalProvisionado += Number(plan[0].data[i][12].toFixed(2));
                            }
                        }
                    });
                    if (commi.length > 0) {
                        await SubLoteCommissions.create({
                            corretora: commi[0].corretora,
                            corretora_CNPJ: commi[0].corretora_CNPJ,
                            quantidade: commi.length,
                            total_contrato: subTotalContrato,
                            total_provisionado: subtotalProvisionado,
                            data_previsao: previsao,
                            data_pagamento: null,
                            situacao_ID: 4,
                            status_ID: 3,
                            lote_commissions_ID: lote.id,
                            nf_ID: null,
                            disabled: false,
                        })
                            .then(async sublote => {
                                if (sublote) {
                                    let sql = 'INSERT INTO `corretora_commissions_sub_lote_lotes` (`sub_lote_ID`, `lote_ID`) VALUES (';
                                    db.sequelize.query(`${sql}${sublote.id}, ${lote.id})`, { type: db.sequelize.QueryTypes.INSERT })
                                        .then(async (sublotelote) => {
                                            await commi.forEach(async (ele, ind) => {
                                                commi[ind].sub_lote_commissions_ID = sublote.id;
                                                commi[ind].lote_commissions_ID = lote.id;
                                                Commissions.create(ele)
                                                    .then(async co => {
                                                        if (co) {
                                                            let sql2 = 'INSERT INTO `corretora_commissions_commission_sub_lote` (`commission_ID`, `sub_lote_ID`) VALUES (';
                                                            db.sequelize.query(`${sql2}${co.id}, ${sublote.id})`, { type: db.sequelize.QueryTypes.INSERT })
                                                                .then(async (commissionsublote) => {
                                                                    if (Number(lotecnpj.length) - 1 === Number(index) && Number(commi.length) - 1 === Number(ind)) {
                                                                        res.send({
                                                                            loteCommissions: lote,
                                                                            message: "Lote de comissões cadastrado com sucesso!",
                                                                            sucesso: true
                                                                        });
                                                                    }
                                                                })
                                                                .catch(async err => {
                                                                    await Commissions.findAll({
                                                                        where: {
                                                                            lote_commissions_ID: lote.id
                                                                        }
                                                                    }).then(async com => {
                                                                        if (com) {
                                                                            com.forEach((eldc, idc) => {
                                                                                if (idc === com.length - 1) {
                                                                                    Commissions.destroy({
                                                                                        where: {
                                                                                            id: eldc.id
                                                                                        },
                                                                                    }).then(async dco => {
                                                                                        await SubLoteCommissions.findAll({
                                                                                            where: {
                                                                                                lote_commissions_ID: lote.id
                                                                                            }
                                                                                        }).then(async sub => {
                                                                                            if (sub) {
                                                                                                sub.forEach(async (elsu, isu) => {
                                                                                                    if (isu === sub.length - 1) {
                                                                                                        await SubLoteCommissions.destroy({
                                                                                                            where: {
                                                                                                                id: elsu.id
                                                                                                            },
                                                                                                        }).then(async dsub => {
                                                                                                            await LoteCommissions.destroy({
                                                                                                                where: {
                                                                                                                    id: lote.id
                                                                                                                },
                                                                                                            }).then(dlo => {
                                                                                                                res.send({
                                                                                                                    message: "Lote de comissões deletado com sucesso!",
                                                                                                                    sucesso: true
                                                                                                                });
                                                                                                            }).catch(err => {
                                                                                                                res.status(401).send({
                                                                                                                    message: err.message,
                                                                                                                    sucesso: false
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
                                                                                                        SubLoteCommissions.destroy({
                                                                                                            where: {
                                                                                                                id: elsu.id
                                                                                                            },
                                                                                                        })
                                                                                                    }
                                                                                                })
                                                                                            }
                                                                                            else {
                                                                                                await LoteCommissions.destroy({
                                                                                                    where: {
                                                                                                        id: lote.id
                                                                                                    },
                                                                                                }).then(comm => {
                                                                                                    res.send({
                                                                                                        message: "Lote de comissões deletado com sucesso!",
                                                                                                        sucesso: true
                                                                                                    });
                                                                                                }).catch(err => {
                                                                                                    res.status(401).send({
                                                                                                        message: err.message,
                                                                                                        sucesso: false
                                                                                                    });
                                                                                                });
                                                                                            }
                                                                                        }).catch(err => {
                                                                                            res.status(401).send({
                                                                                                message: err.message,
                                                                                                sucesso: false
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
                                                                                    Commissions.destroy({
                                                                                        where: {
                                                                                            id: eldc.id
                                                                                        },
                                                                                    })
                                                                                }
                                                                            });
                                                                        } else {
                                                                            await SubLoteCommissions.findAll({
                                                                                where: {
                                                                                    lote_commissions_ID: lote.id
                                                                                }
                                                                            }).then(async sub => {
                                                                                if (sub) {
                                                                                    sub.forEach(async (elsu, isu) => {
                                                                                        if (isu === sub.length - 1) {
                                                                                            await SubLoteCommissions.destroy({
                                                                                                where: {
                                                                                                    id: elsu.id
                                                                                                },
                                                                                            }).then(async dsub => {
                                                                                                await LoteCommissions.destroy({
                                                                                                    where: {
                                                                                                        id: lote.id
                                                                                                    },
                                                                                                }).then(comm => {
                                                                                                    res.send({
                                                                                                        message: "Lote de comissões deletado com sucesso!",
                                                                                                        sucesso: true
                                                                                                    });
                                                                                                }).catch(err => {
                                                                                                    res.status(401).send({
                                                                                                        message: err.message,
                                                                                                        sucesso: false
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
                                                                                            SubLoteCommissions.destroy({
                                                                                                where: {
                                                                                                    id: elsu.id
                                                                                                },
                                                                                            })
                                                                                        }
                                                                                    })
                                                                                }
                                                                                else {
                                                                                    await LoteCommissions.destroy({
                                                                                        where: {
                                                                                            id: lote.id
                                                                                        },
                                                                                    }).then(comm => {
                                                                                        res.send({
                                                                                            message: "Lote de comissões deletado com sucesso!",
                                                                                            sucesso: true
                                                                                        });
                                                                                    }).catch(err => {
                                                                                        res.status(401).send({
                                                                                            message: err.message,
                                                                                            sucesso: false
                                                                                        });
                                                                                    });
                                                                                }
                                                                            }).catch(err => {
                                                                                res.status(401).send({
                                                                                    message: err.message,
                                                                                    sucesso: false
                                                                                });
                                                                            });
                                                                        }
                                                                    }).catch(err => {
                                                                        res.status(401).send({
                                                                            message: err.message,
                                                                            sucesso: false
                                                                        });
                                                                    });
                                                                });

                                                        } else {
                                                            await Commissions.findAll({
                                                                where: {
                                                                    lote_commissions_ID: lote.id
                                                                }
                                                            }).then(async com => {
                                                                if (com) {
                                                                    com.forEach((eldc, idc) => {
                                                                        if (idc === com.length - 1) {
                                                                            Commissions.destroy({
                                                                                where: {
                                                                                    id: eldc.id
                                                                                },
                                                                            }).then(async dco => {
                                                                                await SubLoteCommissions.findAll({
                                                                                    where: {
                                                                                        lote_commissions_ID: lote.id
                                                                                    }
                                                                                }).then(async sub => {
                                                                                    if (sub) {
                                                                                        sub.forEach(async (elsu, isu) => {
                                                                                            if (isu === sub.length - 1) {
                                                                                                await SubLoteCommissions.destroy({
                                                                                                    where: {
                                                                                                        id: elsu.id
                                                                                                    },
                                                                                                }).then(async dsub => {
                                                                                                    await LoteCommissions.destroy({
                                                                                                        where: {
                                                                                                            id: lote.id
                                                                                                        },
                                                                                                    }).then(dlo => {
                                                                                                        res.send({
                                                                                                            message: "Lote de comissões deletado com sucesso!",
                                                                                                            sucesso: true
                                                                                                        });
                                                                                                    }).catch(err => {
                                                                                                        res.status(401).send({
                                                                                                            message: err.message,
                                                                                                            sucesso: false
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
                                                                                                SubLoteCommissions.destroy({
                                                                                                    where: {
                                                                                                        id: elsu.id
                                                                                                    },
                                                                                                })
                                                                                            }
                                                                                        })
                                                                                    }
                                                                                    else {
                                                                                        await LoteCommissions.destroy({
                                                                                            where: {
                                                                                                id: lote.id
                                                                                            },
                                                                                        }).then(comm => {
                                                                                            res.send({
                                                                                                message: "Lote de comissões deletado com sucesso!",
                                                                                                sucesso: true
                                                                                            });
                                                                                        }).catch(err => {
                                                                                            res.status(401).send({
                                                                                                message: err.message,
                                                                                                sucesso: false
                                                                                            });
                                                                                        });
                                                                                    }
                                                                                }).catch(err => {
                                                                                    res.status(401).send({
                                                                                        message: err.message,
                                                                                        sucesso: false
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
                                                                            Commissions.destroy({
                                                                                where: {
                                                                                    id: eldc.id
                                                                                },
                                                                            })
                                                                        }
                                                                    });
                                                                } else {
                                                                    await SubLoteCommissions.findAll({
                                                                        where: {
                                                                            lote_commissions_ID: lote.id
                                                                        }
                                                                    }).then(async sub => {
                                                                        if (sub) {
                                                                            sub.forEach(async (elsu, isu) => {
                                                                                if (isu === sub.length - 1) {
                                                                                    await SubLoteCommissions.destroy({
                                                                                        where: {
                                                                                            id: elsu.id
                                                                                        },
                                                                                    }).then(async dsub => {
                                                                                        await LoteCommissions.destroy({
                                                                                            where: {
                                                                                                id: lote.id
                                                                                            },
                                                                                        }).then(comm => {
                                                                                            res.send({
                                                                                                message: "Lote de comissões deletado com sucesso!",
                                                                                                sucesso: true
                                                                                            });
                                                                                        }).catch(err => {
                                                                                            res.status(401).send({
                                                                                                message: err.message,
                                                                                                sucesso: false
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
                                                                                    SubLoteCommissions.destroy({
                                                                                        where: {
                                                                                            id: elsu.id
                                                                                        },
                                                                                    })
                                                                                }
                                                                            })
                                                                        }
                                                                        else {
                                                                            await LoteCommissions.destroy({
                                                                                where: {
                                                                                    id: lote.id
                                                                                },
                                                                            }).then(comm => {
                                                                                res.send({
                                                                                    message: "Lote de comissões deletado com sucesso!",
                                                                                    sucesso: true
                                                                                });
                                                                            }).catch(err => {
                                                                                res.status(401).send({
                                                                                    message: err.message,
                                                                                    sucesso: false
                                                                                });
                                                                            });
                                                                        }
                                                                    }).catch(err => {
                                                                        res.status(401).send({
                                                                            message: err.message,
                                                                            sucesso: false
                                                                        });
                                                                    });
                                                                }
                                                            }).catch(err => {
                                                                res.status(401).send({
                                                                    message: err.message,
                                                                    sucesso: false
                                                                });
                                                            });
                                                        }
                                                    })
                                                    .catch(async err => {
                                                        await Commissions.findAll({
                                                            where: {
                                                                lote_commissions_ID: lote.id
                                                            }
                                                        }).then(async com => {
                                                            if (com) {
                                                                com.forEach((eldc, idc) => {
                                                                    if (idc === com.length - 1) {
                                                                        Commissions.destroy({
                                                                            where: {
                                                                                id: eldc.id
                                                                            },
                                                                        }).then(async dco => {
                                                                            await SubLoteCommissions.findAll({
                                                                                where: {
                                                                                    lote_commissions_ID: lote.id
                                                                                }
                                                                            }).then(async sub => {
                                                                                if (sub) {
                                                                                    sub.forEach(async (elsu, isu) => {
                                                                                        if (isu === sub.length - 1) {
                                                                                            await SubLoteCommissions.destroy({
                                                                                                where: {
                                                                                                    id: elsu.id
                                                                                                },
                                                                                            }).then(async dsub => {
                                                                                                await LoteCommissions.destroy({
                                                                                                    where: {
                                                                                                        id: lote.id
                                                                                                    },
                                                                                                }).then(dlo => {
                                                                                                    res.send({
                                                                                                        message: "Lote de comissões deletado com sucesso!",
                                                                                                        sucesso: true
                                                                                                    });
                                                                                                }).catch(err => {
                                                                                                    res.status(401).send({
                                                                                                        message: err.message,
                                                                                                        sucesso: false
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
                                                                                            SubLoteCommissions.destroy({
                                                                                                where: {
                                                                                                    id: elsu.id
                                                                                                },
                                                                                            })
                                                                                        }
                                                                                    })
                                                                                }
                                                                                else {
                                                                                    await LoteCommissions.destroy({
                                                                                        where: {
                                                                                            id: lote.id
                                                                                        },
                                                                                    }).then(comm => {
                                                                                        res.send({
                                                                                            message: "Lote de comissões deletado com sucesso!",
                                                                                            sucesso: true
                                                                                        });
                                                                                    }).catch(err => {
                                                                                        res.status(401).send({
                                                                                            message: err.message,
                                                                                            sucesso: false
                                                                                        });
                                                                                    });
                                                                                }
                                                                            }).catch(err => {
                                                                                res.status(401).send({
                                                                                    message: err.message,
                                                                                    sucesso: false
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
                                                                        Commissions.destroy({
                                                                            where: {
                                                                                id: eldc.id
                                                                            },
                                                                        })
                                                                    }
                                                                });
                                                            } else {
                                                                await SubLoteCommissions.findAll({
                                                                    where: {
                                                                        lote_commissions_ID: lote.id
                                                                    }
                                                                }).then(async sub => {
                                                                    if (sub) {
                                                                        sub.forEach(async (elsu, isu) => {
                                                                            if (isu === sub.length - 1) {
                                                                                await SubLoteCommissions.destroy({
                                                                                    where: {
                                                                                        id: elsu.id
                                                                                    },
                                                                                }).then(async dsub => {
                                                                                    await LoteCommissions.destroy({
                                                                                        where: {
                                                                                            id: lote.id
                                                                                        },
                                                                                    }).then(comm => {
                                                                                        res.send({
                                                                                            message: "Lote de comissões deletado com sucesso!",
                                                                                            sucesso: true
                                                                                        });
                                                                                    }).catch(err => {
                                                                                        res.status(401).send({
                                                                                            message: err.message,
                                                                                            sucesso: false
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
                                                                                SubLoteCommissions.destroy({
                                                                                    where: {
                                                                                        id: elsu.id
                                                                                    },
                                                                                })
                                                                            }
                                                                        })
                                                                    }
                                                                    else {
                                                                        await LoteCommissions.destroy({
                                                                            where: {
                                                                                id: lote.id
                                                                            },
                                                                        }).then(comm => {
                                                                            res.send({
                                                                                message: "Lote de comissões deletado com sucesso!",
                                                                                sucesso: true
                                                                            });
                                                                        }).catch(err => {
                                                                            res.status(401).send({
                                                                                message: err.message,
                                                                                sucesso: false
                                                                            });
                                                                        });
                                                                    }
                                                                }).catch(err => {
                                                                    res.status(401).send({
                                                                        message: err.message,
                                                                        sucesso: false
                                                                    });
                                                                });
                                                            }
                                                        }).catch(err => {
                                                            res.status(401).send({
                                                                message: err.message,
                                                                sucesso: false
                                                            });
                                                        });
                                                    });
                                            });
                                        })
                                        .catch(async err => {
                                            await Commissions.findAll({
                                                where: {
                                                    lote_commissions_ID: lote.id
                                                }
                                            }).then(async com => {
                                                if (com) {
                                                    com.forEach((eldc, idc) => {
                                                        if (idc === com.length - 1) {
                                                            Commissions.destroy({
                                                                where: {
                                                                    id: eldc.id
                                                                },
                                                            }).then(async dco => {
                                                                await SubLoteCommissions.findAll({
                                                                    where: {
                                                                        lote_commissions_ID: lote.id
                                                                    }
                                                                }).then(async sub => {
                                                                    if (sub) {
                                                                        sub.forEach(async (elsu, isu) => {
                                                                            if (isu === sub.length - 1) {
                                                                                await SubLoteCommissions.destroy({
                                                                                    where: {
                                                                                        id: elsu.id
                                                                                    },
                                                                                }).then(async dsub => {
                                                                                    await LoteCommissions.destroy({
                                                                                        where: {
                                                                                            id: lote.id
                                                                                        },
                                                                                    }).then(dlo => {
                                                                                        res.send({
                                                                                            message: "Lote de comissões deletado com sucesso!",
                                                                                            sucesso: true
                                                                                        });
                                                                                    }).catch(err => {
                                                                                        res.status(401).send({
                                                                                            message: err.message,
                                                                                            sucesso: false
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
                                                                                SubLoteCommissions.destroy({
                                                                                    where: {
                                                                                        id: elsu.id
                                                                                    },
                                                                                })
                                                                            }
                                                                        })
                                                                    }
                                                                    else {
                                                                        await LoteCommissions.destroy({
                                                                            where: {
                                                                                id: lote.id
                                                                            },
                                                                        }).then(comm => {
                                                                            res.send({
                                                                                message: "Lote de comissões deletado com sucesso!",
                                                                                sucesso: true
                                                                            });
                                                                        }).catch(err => {
                                                                            res.status(401).send({
                                                                                message: err.message,
                                                                                sucesso: false
                                                                            });
                                                                        });
                                                                    }
                                                                }).catch(err => {
                                                                    res.status(401).send({
                                                                        message: err.message,
                                                                        sucesso: false
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
                                                            Commissions.destroy({
                                                                where: {
                                                                    id: eldc.id
                                                                },
                                                            })
                                                        }
                                                    });
                                                } else {
                                                    await SubLoteCommissions.findAll({
                                                        where: {
                                                            lote_commissions_ID: lote.id
                                                        }
                                                    }).then(async sub => {
                                                        if (sub) {
                                                            sub.forEach(async (elsu, isu) => {
                                                                if (isu === sub.length - 1) {
                                                                    await SubLoteCommissions.destroy({
                                                                        where: {
                                                                            id: elsu.id
                                                                        },
                                                                    }).then(async dsub => {
                                                                        await LoteCommissions.destroy({
                                                                            where: {
                                                                                id: lote.id
                                                                            },
                                                                        }).then(comm => {
                                                                            res.send({
                                                                                message: "Lote de comissões deletado com sucesso!",
                                                                                sucesso: true
                                                                            });
                                                                        }).catch(err => {
                                                                            res.status(401).send({
                                                                                message: err.message,
                                                                                sucesso: false
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
                                                                    SubLoteCommissions.destroy({
                                                                        where: {
                                                                            id: elsu.id
                                                                        },
                                                                    })
                                                                }
                                                            })
                                                        }
                                                        else {
                                                            await LoteCommissions.destroy({
                                                                where: {
                                                                    id: lote.id
                                                                },
                                                            }).then(comm => {
                                                                res.send({
                                                                    message: "Lote de comissões deletado com sucesso!",
                                                                    sucesso: true
                                                                });
                                                            }).catch(err => {
                                                                res.status(401).send({
                                                                    message: err.message,
                                                                    sucesso: false
                                                                });
                                                            });
                                                        }
                                                    }).catch(err => {
                                                        res.status(401).send({
                                                            message: err.message,
                                                            sucesso: false
                                                        });
                                                    });
                                                }
                                            }).catch(err => {
                                                res.status(401).send({
                                                    message: err.message,
                                                    sucesso: false
                                                });
                                            });
                                        });
                                } else {
                                    await Commissions.findAll({
                                        where: {
                                            lote_commissions_ID: lote.id
                                        }
                                    }).then(async com => {
                                        if (com) {
                                            com.forEach((eldc, idc) => {
                                                if (idc === com.length - 1) {
                                                    Commissions.destroy({
                                                        where: {
                                                            id: eldc.id
                                                        },
                                                    }).then(async dco => {
                                                        await SubLoteCommissions.findAll({
                                                            where: {
                                                                lote_commissions_ID: lote.id
                                                            }
                                                        }).then(async sub => {
                                                            if (sub) {
                                                                sub.forEach(async (elsu, isu) => {
                                                                    if (isu === sub.length - 1) {
                                                                        await SubLoteCommissions.destroy({
                                                                            where: {
                                                                                id: elsu.id
                                                                            },
                                                                        }).then(async dsub => {
                                                                            await LoteCommissions.destroy({
                                                                                where: {
                                                                                    id: lote.id
                                                                                },
                                                                            }).then(dlo => {
                                                                                res.send({
                                                                                    message: "Lote de comissões deletado com sucesso!",
                                                                                    sucesso: true
                                                                                });
                                                                            }).catch(err => {
                                                                                res.status(401).send({
                                                                                    message: err.message,
                                                                                    sucesso: false
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
                                                                        SubLoteCommissions.destroy({
                                                                            where: {
                                                                                id: elsu.id
                                                                            },
                                                                        })
                                                                    }
                                                                })
                                                            }
                                                            else {
                                                                await LoteCommissions.destroy({
                                                                    where: {
                                                                        id: lote.id
                                                                    },
                                                                }).then(comm => {
                                                                    res.send({
                                                                        message: "Lote de comissões deletado com sucesso!",
                                                                        sucesso: true
                                                                    });
                                                                }).catch(err => {
                                                                    res.status(401).send({
                                                                        message: err.message,
                                                                        sucesso: false
                                                                    });
                                                                });
                                                            }
                                                        }).catch(err => {
                                                            res.status(401).send({
                                                                message: err.message,
                                                                sucesso: false
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
                                                    Commissions.destroy({
                                                        where: {
                                                            id: eldc.id
                                                        },
                                                    })
                                                }
                                            });
                                        } else {
                                            await SubLoteCommissions.findAll({
                                                where: {
                                                    lote_commissions_ID: lote.id
                                                }
                                            }).then(async sub => {
                                                if (sub) {
                                                    sub.forEach(async (elsu, isu) => {
                                                        if (isu === sub.length - 1) {
                                                            await SubLoteCommissions.destroy({
                                                                where: {
                                                                    id: elsu.id
                                                                },
                                                            }).then(async dsub => {
                                                                await LoteCommissions.destroy({
                                                                    where: {
                                                                        id: lote.id
                                                                    },
                                                                }).then(comm => {
                                                                    res.send({
                                                                        message: "Lote de comissões deletado com sucesso!",
                                                                        sucesso: true
                                                                    });
                                                                }).catch(err => {
                                                                    res.status(401).send({
                                                                        message: err.message,
                                                                        sucesso: false
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
                                                            SubLoteCommissions.destroy({
                                                                where: {
                                                                    id: elsu.id
                                                                },
                                                            })
                                                        }
                                                    })
                                                }
                                                else {
                                                    await LoteCommissions.destroy({
                                                        where: {
                                                            id: lote.id
                                                        },
                                                    }).then(comm => {
                                                        res.send({
                                                            message: "Lote de comissões deletado com sucesso!",
                                                            sucesso: true
                                                        });
                                                    }).catch(err => {
                                                        res.status(401).send({
                                                            message: err.message,
                                                            sucesso: false
                                                        });
                                                    });
                                                }
                                            }).catch(err => {
                                                res.status(401).send({
                                                    message: err.message,
                                                    sucesso: false
                                                });
                                            });
                                        }
                                    }).catch(err => {
                                        res.status(401).send({
                                            message: err.message,
                                            sucesso: false
                                        });
                                    });
                                }
                            })
                            .catch(async err => {
                                await Commissions.findAll({
                                    where: {
                                        lote_commissions_ID: lote.id
                                    }
                                }).then(async com => {
                                    if (com) {
                                        com.forEach((eldc, idc) => {
                                            if (idc === com.length - 1) {
                                                Commissions.destroy({
                                                    where: {
                                                        id: eldc.id
                                                    },
                                                }).then(async dco => {
                                                    await SubLoteCommissions.findAll({
                                                        where: {
                                                            lote_commissions_ID: lote.id
                                                        }
                                                    }).then(async sub => {
                                                        if (sub) {
                                                            sub.forEach(async (elsu, isu) => {
                                                                if (isu === sub.length - 1) {
                                                                    await SubLoteCommissions.destroy({
                                                                        where: {
                                                                            id: elsu.id
                                                                        },
                                                                    }).then(async dsub => {
                                                                        await LoteCommissions.destroy({
                                                                            where: {
                                                                                id: lote.id
                                                                            },
                                                                        }).then(dlo => {
                                                                            res.send({
                                                                                message: "Lote de comissões deletado com sucesso!",
                                                                                sucesso: true
                                                                            });
                                                                        }).catch(err => {
                                                                            res.status(401).send({
                                                                                message: err.message,
                                                                                sucesso: false
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
                                                                    SubLoteCommissions.destroy({
                                                                        where: {
                                                                            id: elsu.id
                                                                        },
                                                                    })
                                                                }
                                                            })
                                                        }
                                                        else {
                                                            await LoteCommissions.destroy({
                                                                where: {
                                                                    id: lote.id
                                                                },
                                                            }).then(comm => {
                                                                res.send({
                                                                    message: "Lote de comissões deletado com sucesso!",
                                                                    sucesso: true
                                                                });
                                                            }).catch(err => {
                                                                res.status(401).send({
                                                                    message: err.message,
                                                                    sucesso: false
                                                                });
                                                            });
                                                        }
                                                    }).catch(err => {
                                                        res.status(401).send({
                                                            message: err.message,
                                                            sucesso: false
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
                                                Commissions.destroy({
                                                    where: {
                                                        id: eldc.id
                                                    },
                                                })
                                            }
                                        });
                                    } else {
                                        await SubLoteCommissions.findAll({
                                            where: {
                                                lote_commissions_ID: lote.id
                                            }
                                        }).then(async sub => {
                                            if (sub) {
                                                sub.forEach(async (elsu, isu) => {
                                                    if (isu === sub.length - 1) {
                                                        await SubLoteCommissions.destroy({
                                                            where: {
                                                                id: elsu.id
                                                            },
                                                        }).then(async dsub => {
                                                            await LoteCommissions.destroy({
                                                                where: {
                                                                    id: lote.id
                                                                },
                                                            }).then(comm => {
                                                                res.send({
                                                                    message: "Lote de comissões deletado com sucesso!",
                                                                    sucesso: true
                                                                });
                                                            }).catch(err => {
                                                                res.status(401).send({
                                                                    message: err.message,
                                                                    sucesso: false
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
                                                        SubLoteCommissions.destroy({
                                                            where: {
                                                                id: elsu.id
                                                            },
                                                        })
                                                    }
                                                })
                                            }
                                            else {
                                                await LoteCommissions.destroy({
                                                    where: {
                                                        id: lote.id
                                                    },
                                                }).then(comm => {
                                                    res.send({
                                                        message: "Lote de comissões deletado com sucesso!",
                                                        sucesso: true
                                                    });
                                                }).catch(err => {
                                                    res.status(401).send({
                                                        message: err.message,
                                                        sucesso: false
                                                    });
                                                });
                                            }
                                        }).catch(err => {
                                            res.status(401).send({
                                                message: err.message,
                                                sucesso: false
                                            });
                                        });
                                    }
                                }).catch(err => {
                                    res.status(401).send({
                                        message: err.message,
                                        sucesso: false
                                    });
                                });
                            });
                    }
                    else {
                        res.status(401).send({
                            message: "Algo deu errado, tente novamente!",
                            sucesso: false
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
};

exports.addLoteCommissionsDigital = async (req, res) => {
    const lotecnpj = [];
    const commissions = req.body.commissions;
    const estornos = req.body.estornos;

    let lotecommissionsestornos;
    if (commissions.length > 0 && estornos.length > 0) {
        lotecommissionsestornos = await commissions.concat(estornos);
    }
    else {
        if (commissions.length > 0) {
            lotecommissionsestornos = await commissions;
        }
        else {
            lotecommissionsestornos = await estornos;
        }
    }

    await lotecommissionsestornos.forEach(async (element, index) => {
        if (lotecnpj.indexOf(element.corretora_CNPJ) === -1) {
            lotecnpj.push(element.corretora_CNPJ);
        }
    });

    await LoteCommissions.create({
        quantidade: lotecommissionsestornos.length,
        total_contrato: req.body.totalContrato,
        total_provisionado: null,
        quantidade_commissions: commissions.length,
        total_commissions: req.body.totalCommissions,
        quantidade_estornos: estornos.length,
        total_estorno: req.body.totalEstornos,
        dataInicial: req.body.dataInicial,
        dataFinal: req.body.dataFinal,
        data_previsao: req.body.previsao,
        status_ID: 3,
        empresa_ID: null,
        arquivo_URL: '',
        disabled: false,
    })
        .then(async lote => {
            if (lote) {
                await lotecnpj.forEach(async (element, index) => {
                    const commi = [];
                    let subTotalContrato = 0;
                    let qntCommissions = 0;
                    let subtotalCommissions = 0;
                    let subtotalEstorno = 0;
                    let qntEstornos = 0;
                    await lotecommissionsestornos.forEach((el, i) => {
                        if (String(element) === String(el.corretora_CNPJ)) {
                            commi.push({
                                corretora: el.corretora,
                                corretora_CNPJ: String(el.corretora_CNPJ),
                                produtor: el.produtor,
                                nome_contrato: el.nome_contrato,
                                cpf_cnpj_contrato: el.cpf_cnpj_contrato,
                                operadora: el.operadora,
                                modalidade: el.modalidade,
                                parcela: el.parcela,
                                percentual_comissao: el.percentual_comissao,
                                vidas: el.vidas,
                                valor_contrato: el.valor_contrato ? Number(el.valor_contrato).toFixed(2) : null,
                                data_previsao: req.body.previsao,
                                data_pagamento: null,
                                valor_provisionado: el.valor_provisionado ? Number(el.valor_provisionado).toFixed(2) : null,
                                situacao_ID: 4,
                                status_ID: 3,
                                sub_lote_commissions_ID: null,
                                lote_commissions_ID: null,
                                nf_ID: null,
                                codigoCommissionsDigitalSaude: el.codigoCommissionsDigitalSaude,
                                valor_estorno: el.valor_estorno ? Number(el.valor_estorno) : null,
                                tipo: el.tipo,
                                descricao: el.descricao,
                                dataLancamento: el.dataLancamento,
                                codigoProduto: el.codigoProduto,
                                nomeProduto: el.nomeProduto,
                                vigencia: el.vigencia,
                            })
                            subTotalContrato = Number(Number(subTotalContrato) + Number(el.valor_contrato.toFixed(2))).toFixed(2);
                            if (el.tipo === 'credito') {
                                qntCommissions += 1;
                                subtotalCommissions = Number(Number(subtotalCommissions) + Number(el.valor_provisionado.toFixed(2))).toFixed(2);
                            }
                            else {
                                qntEstornos += 1;
                                subtotalEstorno = Number(Number(subtotalEstorno) + Number(el.valor_estorno.toFixed(2))).toFixed(2);
                            }
                        }
                    });
                    if (commi.length > 0) {
                        await SubLoteCommissions.create({
                            corretora: commi[0].corretora,
                            corretora_CNPJ: commi[0].corretora_CNPJ,
                            quantidade: commi.length,
                            total_contrato: subTotalContrato,
                            total_provisionado: null,
                            quantidade_commissions: qntCommissions,
                            total_commissions: subtotalCommissions,
                            quantidade_estornos: qntEstornos,
                            total_estornos: subtotalEstorno,
                            data_previsao: req.body.previsao,
                            data_pagamento: null,
                            situacao_ID: 4,
                            status_ID: 3,
                            lote_commissions_ID: lote.id,
                            nf_ID: null,
                            disabled: false,
                        })
                            .then(async sublote => {
                                if (sublote) {
                                    let sql = 'INSERT INTO `corretora_commissions_sub_lote_lotes` (`sub_lote_ID`, `lote_ID`) VALUES (';
                                    db.sequelize.query(`${sql}${sublote.id}, ${lote.id})`, { type: db.sequelize.QueryTypes.INSERT })
                                        .then(async (sublotelote) => {
                                            await commi.forEach(async (ele, ind) => {
                                                commi[ind].sub_lote_commissions_ID = sublote.id;
                                                commi[ind].lote_commissions_ID = lote.id;
                                                Commissions.create(ele)
                                                    .then(async co => {
                                                        if (co) {
                                                            let sql2 = 'INSERT INTO `corretora_commissions_commission_sub_lote` (`commission_ID`, `sub_lote_ID`) VALUES (';
                                                            db.sequelize.query(`${sql2}${co.id}, ${sublote.id})`, { type: db.sequelize.QueryTypes.INSERT })
                                                                .then(async (commissionsublote) => {
                                                                    if (Number(lotecnpj.length) - 1 === Number(index) && Number(commi.length) - 1 === Number(ind)) {
                                                                        res.send({
                                                                            loteCommissions: lote,
                                                                            message: "Lote de comissões cadastrado com sucesso!",
                                                                            sucesso: true
                                                                        });
                                                                    }
                                                                })
                                                                .catch(async err => {
                                                                    await Commissions.findAll({
                                                                        where: {
                                                                            lote_commissions_ID: lote.id
                                                                        }
                                                                    }).then(async com => {
                                                                        if (com) {
                                                                            com.forEach((eldc, idc) => {
                                                                                if (idc === com.length - 1) {
                                                                                    Commissions.destroy({
                                                                                        where: {
                                                                                            id: eldc.id
                                                                                        },
                                                                                    }).then(async dco => {
                                                                                        await SubLoteCommissions.findAll({
                                                                                            where: {
                                                                                                lote_commissions_ID: lote.id
                                                                                            }
                                                                                        }).then(async sub => {
                                                                                            if (sub) {
                                                                                                sub.forEach(async (elsu, isu) => {
                                                                                                    if (isu === sub.length - 1) {
                                                                                                        await SubLoteCommissions.destroy({
                                                                                                            where: {
                                                                                                                id: elsu.id
                                                                                                            },
                                                                                                        }).then(async dsub => {
                                                                                                            await LoteCommissions.destroy({
                                                                                                                where: {
                                                                                                                    id: lote.id
                                                                                                                },
                                                                                                            }).then(dlo => {
                                                                                                                res.send({
                                                                                                                    message: "Lote de comissões deletado com sucesso!",
                                                                                                                    sucesso: true
                                                                                                                });
                                                                                                            }).catch(err => {
                                                                                                                res.status(401).send({
                                                                                                                    message: err.message,
                                                                                                                    sucesso: false
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
                                                                                                        SubLoteCommissions.destroy({
                                                                                                            where: {
                                                                                                                id: elsu.id
                                                                                                            },
                                                                                                        })
                                                                                                    }
                                                                                                })
                                                                                            }
                                                                                            else {
                                                                                                await LoteCommissions.destroy({
                                                                                                    where: {
                                                                                                        id: lote.id
                                                                                                    },
                                                                                                }).then(comm => {
                                                                                                    res.send({
                                                                                                        message: "Lote de comissões deletado com sucesso!",
                                                                                                        sucesso: true
                                                                                                    });
                                                                                                }).catch(err => {
                                                                                                    res.status(401).send({
                                                                                                        message: err.message,
                                                                                                        sucesso: false
                                                                                                    });
                                                                                                });
                                                                                            }
                                                                                        }).catch(err => {
                                                                                            res.status(401).send({
                                                                                                message: err.message,
                                                                                                sucesso: false
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
                                                                                    Commissions.destroy({
                                                                                        where: {
                                                                                            id: eldc.id
                                                                                        },
                                                                                    })
                                                                                }
                                                                            });
                                                                        } else {
                                                                            await SubLoteCommissions.findAll({
                                                                                where: {
                                                                                    lote_commissions_ID: lote.id
                                                                                }
                                                                            }).then(async sub => {
                                                                                if (sub) {
                                                                                    sub.forEach(async (elsu, isu) => {
                                                                                        if (isu === sub.length - 1) {
                                                                                            await SubLoteCommissions.destroy({
                                                                                                where: {
                                                                                                    id: elsu.id
                                                                                                },
                                                                                            }).then(async dsub => {
                                                                                                await LoteCommissions.destroy({
                                                                                                    where: {
                                                                                                        id: lote.id
                                                                                                    },
                                                                                                }).then(comm => {
                                                                                                    res.send({
                                                                                                        message: "Lote de comissões deletado com sucesso!",
                                                                                                        sucesso: true
                                                                                                    });
                                                                                                }).catch(err => {
                                                                                                    res.status(401).send({
                                                                                                        message: err.message,
                                                                                                        sucesso: false
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
                                                                                            SubLoteCommissions.destroy({
                                                                                                where: {
                                                                                                    id: elsu.id
                                                                                                },
                                                                                            })
                                                                                        }
                                                                                    })
                                                                                }
                                                                                else {
                                                                                    await LoteCommissions.destroy({
                                                                                        where: {
                                                                                            id: lote.id
                                                                                        },
                                                                                    }).then(comm => {
                                                                                        res.send({
                                                                                            message: "Lote de comissões deletado com sucesso!",
                                                                                            sucesso: true
                                                                                        });
                                                                                    }).catch(err => {
                                                                                        res.status(401).send({
                                                                                            message: err.message,
                                                                                            sucesso: false
                                                                                        });
                                                                                    });
                                                                                }
                                                                            }).catch(err => {
                                                                                res.status(401).send({
                                                                                    message: err.message,
                                                                                    sucesso: false
                                                                                });
                                                                            });
                                                                        }
                                                                    }).catch(err => {
                                                                        res.status(401).send({
                                                                            message: err.message,
                                                                            sucesso: false
                                                                        });
                                                                    });
                                                                });

                                                        } else {
                                                            await Commissions.findAll({
                                                                where: {
                                                                    lote_commissions_ID: lote.id
                                                                }
                                                            }).then(async com => {
                                                                if (com) {
                                                                    com.forEach((eldc, idc) => {
                                                                        if (idc === com.length - 1) {
                                                                            Commissions.destroy({
                                                                                where: {
                                                                                    id: eldc.id
                                                                                },
                                                                            }).then(async dco => {
                                                                                await SubLoteCommissions.findAll({
                                                                                    where: {
                                                                                        lote_commissions_ID: lote.id
                                                                                    }
                                                                                }).then(async sub => {
                                                                                    if (sub) {
                                                                                        sub.forEach(async (elsu, isu) => {
                                                                                            if (isu === sub.length - 1) {
                                                                                                await SubLoteCommissions.destroy({
                                                                                                    where: {
                                                                                                        id: elsu.id
                                                                                                    },
                                                                                                }).then(async dsub => {
                                                                                                    await LoteCommissions.destroy({
                                                                                                        where: {
                                                                                                            id: lote.id
                                                                                                        },
                                                                                                    }).then(dlo => {
                                                                                                        res.send({
                                                                                                            message: "Lote de comissões deletado com sucesso!",
                                                                                                            sucesso: true
                                                                                                        });
                                                                                                    }).catch(err => {
                                                                                                        res.status(401).send({
                                                                                                            message: err.message,
                                                                                                            sucesso: false
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
                                                                                                SubLoteCommissions.destroy({
                                                                                                    where: {
                                                                                                        id: elsu.id
                                                                                                    },
                                                                                                })
                                                                                            }
                                                                                        })
                                                                                    }
                                                                                    else {
                                                                                        await LoteCommissions.destroy({
                                                                                            where: {
                                                                                                id: lote.id
                                                                                            },
                                                                                        }).then(comm => {
                                                                                            res.send({
                                                                                                message: "Lote de comissões deletado com sucesso!",
                                                                                                sucesso: true
                                                                                            });
                                                                                        }).catch(err => {
                                                                                            res.status(401).send({
                                                                                                message: err.message,
                                                                                                sucesso: false
                                                                                            });
                                                                                        });
                                                                                    }
                                                                                }).catch(err => {
                                                                                    res.status(401).send({
                                                                                        message: err.message,
                                                                                        sucesso: false
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
                                                                            Commissions.destroy({
                                                                                where: {
                                                                                    id: eldc.id
                                                                                },
                                                                            })
                                                                        }
                                                                    });
                                                                } else {
                                                                    await SubLoteCommissions.findAll({
                                                                        where: {
                                                                            lote_commissions_ID: lote.id
                                                                        }
                                                                    }).then(async sub => {
                                                                        if (sub) {
                                                                            sub.forEach(async (elsu, isu) => {
                                                                                if (isu === sub.length - 1) {
                                                                                    await SubLoteCommissions.destroy({
                                                                                        where: {
                                                                                            id: elsu.id
                                                                                        },
                                                                                    }).then(async dsub => {
                                                                                        await LoteCommissions.destroy({
                                                                                            where: {
                                                                                                id: lote.id
                                                                                            },
                                                                                        }).then(comm => {
                                                                                            res.send({
                                                                                                message: "Lote de comissões deletado com sucesso!",
                                                                                                sucesso: true
                                                                                            });
                                                                                        }).catch(err => {
                                                                                            res.status(401).send({
                                                                                                message: err.message,
                                                                                                sucesso: false
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
                                                                                    SubLoteCommissions.destroy({
                                                                                        where: {
                                                                                            id: elsu.id
                                                                                        },
                                                                                    })
                                                                                }
                                                                            })
                                                                        }
                                                                        else {
                                                                            await LoteCommissions.destroy({
                                                                                where: {
                                                                                    id: lote.id
                                                                                },
                                                                            }).then(comm => {
                                                                                res.send({
                                                                                    message: "Lote de comissões deletado com sucesso!",
                                                                                    sucesso: true
                                                                                });
                                                                            }).catch(err => {
                                                                                res.status(401).send({
                                                                                    message: err.message,
                                                                                    sucesso: false
                                                                                });
                                                                            });
                                                                        }
                                                                    }).catch(err => {
                                                                        res.status(401).send({
                                                                            message: err.message,
                                                                            sucesso: false
                                                                        });
                                                                    });
                                                                }
                                                            }).catch(err => {
                                                                res.status(401).send({
                                                                    message: err.message,
                                                                    sucesso: false
                                                                });
                                                            });
                                                        }
                                                    })
                                                    .catch(async err => {
                                                        await Commissions.findAll({
                                                            where: {
                                                                lote_commissions_ID: lote.id
                                                            }
                                                        }).then(async com => {
                                                            if (com) {
                                                                com.forEach((eldc, idc) => {
                                                                    if (idc === com.length - 1) {
                                                                        Commissions.destroy({
                                                                            where: {
                                                                                id: eldc.id
                                                                            },
                                                                        }).then(async dco => {
                                                                            await SubLoteCommissions.findAll({
                                                                                where: {
                                                                                    lote_commissions_ID: lote.id
                                                                                }
                                                                            }).then(async sub => {
                                                                                if (sub) {
                                                                                    sub.forEach(async (elsu, isu) => {
                                                                                        if (isu === sub.length - 1) {
                                                                                            await SubLoteCommissions.destroy({
                                                                                                where: {
                                                                                                    id: elsu.id
                                                                                                },
                                                                                            }).then(async dsub => {
                                                                                                await LoteCommissions.destroy({
                                                                                                    where: {
                                                                                                        id: lote.id
                                                                                                    },
                                                                                                }).then(dlo => {
                                                                                                    res.send({
                                                                                                        message: "Lote de comissões deletado com sucesso!",
                                                                                                        sucesso: true
                                                                                                    });
                                                                                                }).catch(err => {
                                                                                                    res.status(401).send({
                                                                                                        message: err.message,
                                                                                                        sucesso: false
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
                                                                                            SubLoteCommissions.destroy({
                                                                                                where: {
                                                                                                    id: elsu.id
                                                                                                },
                                                                                            })
                                                                                        }
                                                                                    })
                                                                                }
                                                                                else {
                                                                                    await LoteCommissions.destroy({
                                                                                        where: {
                                                                                            id: lote.id
                                                                                        },
                                                                                    }).then(comm => {
                                                                                        res.send({
                                                                                            message: "Lote de comissões deletado com sucesso!",
                                                                                            sucesso: true
                                                                                        });
                                                                                    }).catch(err => {
                                                                                        res.status(401).send({
                                                                                            message: err.message,
                                                                                            sucesso: false
                                                                                        });
                                                                                    });
                                                                                }
                                                                            }).catch(err => {
                                                                                res.status(401).send({
                                                                                    message: err.message,
                                                                                    sucesso: false
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
                                                                        Commissions.destroy({
                                                                            where: {
                                                                                id: eldc.id
                                                                            },
                                                                        })
                                                                    }
                                                                });
                                                            } else {
                                                                await SubLoteCommissions.findAll({
                                                                    where: {
                                                                        lote_commissions_ID: lote.id
                                                                    }
                                                                }).then(async sub => {
                                                                    if (sub) {
                                                                        sub.forEach(async (elsu, isu) => {
                                                                            if (isu === sub.length - 1) {
                                                                                await SubLoteCommissions.destroy({
                                                                                    where: {
                                                                                        id: elsu.id
                                                                                    },
                                                                                }).then(async dsub => {
                                                                                    await LoteCommissions.destroy({
                                                                                        where: {
                                                                                            id: lote.id
                                                                                        },
                                                                                    }).then(comm => {
                                                                                        res.send({
                                                                                            message: "Lote de comissões deletado com sucesso!",
                                                                                            sucesso: true
                                                                                        });
                                                                                    }).catch(err => {
                                                                                        res.status(401).send({
                                                                                            message: err.message,
                                                                                            sucesso: false
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
                                                                                SubLoteCommissions.destroy({
                                                                                    where: {
                                                                                        id: elsu.id
                                                                                    },
                                                                                })
                                                                            }
                                                                        })
                                                                    }
                                                                    else {
                                                                        await LoteCommissions.destroy({
                                                                            where: {
                                                                                id: lote.id
                                                                            },
                                                                        }).then(comm => {
                                                                            res.send({
                                                                                message: "Lote de comissões deletado com sucesso!",
                                                                                sucesso: true
                                                                            });
                                                                        }).catch(err => {
                                                                            res.status(401).send({
                                                                                message: err.message,
                                                                                sucesso: false
                                                                            });
                                                                        });
                                                                    }
                                                                }).catch(err => {
                                                                    res.status(401).send({
                                                                        message: err.message,
                                                                        sucesso: false
                                                                    });
                                                                });
                                                            }
                                                        }).catch(err => {
                                                            res.status(401).send({
                                                                message: err.message,
                                                                sucesso: false
                                                            });
                                                        });
                                                    });
                                            });
                                        })
                                        .catch(async err => {
                                            await Commissions.findAll({
                                                where: {
                                                    lote_commissions_ID: lote.id
                                                }
                                            }).then(async com => {
                                                if (com) {
                                                    com.forEach((eldc, idc) => {
                                                        if (idc === com.length - 1) {
                                                            Commissions.destroy({
                                                                where: {
                                                                    id: eldc.id
                                                                },
                                                            }).then(async dco => {
                                                                await SubLoteCommissions.findAll({
                                                                    where: {
                                                                        lote_commissions_ID: lote.id
                                                                    }
                                                                }).then(async sub => {
                                                                    if (sub) {
                                                                        sub.forEach(async (elsu, isu) => {
                                                                            if (isu === sub.length - 1) {
                                                                                await SubLoteCommissions.destroy({
                                                                                    where: {
                                                                                        id: elsu.id
                                                                                    },
                                                                                }).then(async dsub => {
                                                                                    await LoteCommissions.destroy({
                                                                                        where: {
                                                                                            id: lote.id
                                                                                        },
                                                                                    }).then(dlo => {
                                                                                        res.send({
                                                                                            message: "Lote de comissões deletado com sucesso!",
                                                                                            sucesso: true
                                                                                        });
                                                                                    }).catch(err => {
                                                                                        res.status(401).send({
                                                                                            message: err.message,
                                                                                            sucesso: false
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
                                                                                SubLoteCommissions.destroy({
                                                                                    where: {
                                                                                        id: elsu.id
                                                                                    },
                                                                                })
                                                                            }
                                                                        })
                                                                    }
                                                                    else {
                                                                        await LoteCommissions.destroy({
                                                                            where: {
                                                                                id: lote.id
                                                                            },
                                                                        }).then(comm => {
                                                                            res.send({
                                                                                message: "Lote de comissões deletado com sucesso!",
                                                                                sucesso: true
                                                                            });
                                                                        }).catch(err => {
                                                                            res.status(401).send({
                                                                                message: err.message,
                                                                                sucesso: false
                                                                            });
                                                                        });
                                                                    }
                                                                }).catch(err => {
                                                                    res.status(401).send({
                                                                        message: err.message,
                                                                        sucesso: false
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
                                                            Commissions.destroy({
                                                                where: {
                                                                    id: eldc.id
                                                                },
                                                            })
                                                        }
                                                    });
                                                } else {
                                                    await SubLoteCommissions.findAll({
                                                        where: {
                                                            lote_commissions_ID: lote.id
                                                        }
                                                    }).then(async sub => {
                                                        if (sub) {
                                                            sub.forEach(async (elsu, isu) => {
                                                                if (isu === sub.length - 1) {
                                                                    await SubLoteCommissions.destroy({
                                                                        where: {
                                                                            id: elsu.id
                                                                        },
                                                                    }).then(async dsub => {
                                                                        await LoteCommissions.destroy({
                                                                            where: {
                                                                                id: lote.id
                                                                            },
                                                                        }).then(comm => {
                                                                            res.send({
                                                                                message: "Lote de comissões deletado com sucesso!",
                                                                                sucesso: true
                                                                            });
                                                                        }).catch(err => {
                                                                            res.status(401).send({
                                                                                message: err.message,
                                                                                sucesso: false
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
                                                                    SubLoteCommissions.destroy({
                                                                        where: {
                                                                            id: elsu.id
                                                                        },
                                                                    })
                                                                }
                                                            })
                                                        }
                                                        else {
                                                            await LoteCommissions.destroy({
                                                                where: {
                                                                    id: lote.id
                                                                },
                                                            }).then(comm => {
                                                                res.send({
                                                                    message: "Lote de comissões deletado com sucesso!",
                                                                    sucesso: true
                                                                });
                                                            }).catch(err => {
                                                                res.status(401).send({
                                                                    message: err.message,
                                                                    sucesso: false
                                                                });
                                                            });
                                                        }
                                                    }).catch(err => {
                                                        res.status(401).send({
                                                            message: err.message,
                                                            sucesso: false
                                                        });
                                                    });
                                                }
                                            }).catch(err => {
                                                res.status(401).send({
                                                    message: err.message,
                                                    sucesso: false
                                                });
                                            });
                                        });
                                } else {
                                    await Commissions.findAll({
                                        where: {
                                            lote_commissions_ID: lote.id
                                        }
                                    }).then(async com => {
                                        if (com) {
                                            com.forEach((eldc, idc) => {
                                                if (idc === com.length - 1) {
                                                    Commissions.destroy({
                                                        where: {
                                                            id: eldc.id
                                                        },
                                                    }).then(async dco => {
                                                        await SubLoteCommissions.findAll({
                                                            where: {
                                                                lote_commissions_ID: lote.id
                                                            }
                                                        }).then(async sub => {
                                                            if (sub) {
                                                                sub.forEach(async (elsu, isu) => {
                                                                    if (isu === sub.length - 1) {
                                                                        await SubLoteCommissions.destroy({
                                                                            where: {
                                                                                id: elsu.id
                                                                            },
                                                                        }).then(async dsub => {
                                                                            await LoteCommissions.destroy({
                                                                                where: {
                                                                                    id: lote.id
                                                                                },
                                                                            }).then(dlo => {
                                                                                res.send({
                                                                                    message: "Lote de comissões deletado com sucesso!",
                                                                                    sucesso: true
                                                                                });
                                                                            }).catch(err => {
                                                                                res.status(401).send({
                                                                                    message: err.message,
                                                                                    sucesso: false
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
                                                                        SubLoteCommissions.destroy({
                                                                            where: {
                                                                                id: elsu.id
                                                                            },
                                                                        })
                                                                    }
                                                                })
                                                            }
                                                            else {
                                                                await LoteCommissions.destroy({
                                                                    where: {
                                                                        id: lote.id
                                                                    },
                                                                }).then(comm => {
                                                                    res.send({
                                                                        message: "Lote de comissões deletado com sucesso!",
                                                                        sucesso: true
                                                                    });
                                                                }).catch(err => {
                                                                    res.status(401).send({
                                                                        message: err.message,
                                                                        sucesso: false
                                                                    });
                                                                });
                                                            }
                                                        }).catch(err => {
                                                            res.status(401).send({
                                                                message: err.message,
                                                                sucesso: false
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
                                                    Commissions.destroy({
                                                        where: {
                                                            id: eldc.id
                                                        },
                                                    })
                                                }
                                            });
                                        } else {
                                            await SubLoteCommissions.findAll({
                                                where: {
                                                    lote_commissions_ID: lote.id
                                                }
                                            }).then(async sub => {
                                                if (sub) {
                                                    sub.forEach(async (elsu, isu) => {
                                                        if (isu === sub.length - 1) {
                                                            await SubLoteCommissions.destroy({
                                                                where: {
                                                                    id: elsu.id
                                                                },
                                                            }).then(async dsub => {
                                                                await LoteCommissions.destroy({
                                                                    where: {
                                                                        id: lote.id
                                                                    },
                                                                }).then(comm => {
                                                                    res.send({
                                                                        message: "Lote de comissões deletado com sucesso!",
                                                                        sucesso: true
                                                                    });
                                                                }).catch(err => {
                                                                    res.status(401).send({
                                                                        message: err.message,
                                                                        sucesso: false
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
                                                            SubLoteCommissions.destroy({
                                                                where: {
                                                                    id: elsu.id
                                                                },
                                                            })
                                                        }
                                                    })
                                                }
                                                else {
                                                    await LoteCommissions.destroy({
                                                        where: {
                                                            id: lote.id
                                                        },
                                                    }).then(comm => {
                                                        res.send({
                                                            message: "Lote de comissões deletado com sucesso!",
                                                            sucesso: true
                                                        });
                                                    }).catch(err => {
                                                        res.status(401).send({
                                                            message: err.message,
                                                            sucesso: false
                                                        });
                                                    });
                                                }
                                            }).catch(err => {
                                                res.status(401).send({
                                                    message: err.message,
                                                    sucesso: false
                                                });
                                            });
                                        }
                                    }).catch(err => {
                                        res.status(401).send({
                                            message: err.message,
                                            sucesso: false
                                        });
                                    });
                                }
                            })
                            .catch(async err => {
                                await Commissions.findAll({
                                    where: {
                                        lote_commissions_ID: lote.id
                                    }
                                }).then(async com => {
                                    if (com) {
                                        com.forEach((eldc, idc) => {
                                            if (idc === com.length - 1) {
                                                Commissions.destroy({
                                                    where: {
                                                        id: eldc.id
                                                    },
                                                }).then(async dco => {
                                                    await SubLoteCommissions.findAll({
                                                        where: {
                                                            lote_commissions_ID: lote.id
                                                        }
                                                    }).then(async sub => {
                                                        if (sub) {
                                                            sub.forEach(async (elsu, isu) => {
                                                                if (isu === sub.length - 1) {
                                                                    await SubLoteCommissions.destroy({
                                                                        where: {
                                                                            id: elsu.id
                                                                        },
                                                                    }).then(async dsub => {
                                                                        await LoteCommissions.destroy({
                                                                            where: {
                                                                                id: lote.id
                                                                            },
                                                                        }).then(dlo => {
                                                                            res.send({
                                                                                message: "Lote de comissões deletado com sucesso!",
                                                                                sucesso: true
                                                                            });
                                                                        }).catch(err => {
                                                                            res.status(401).send({
                                                                                message: err.message,
                                                                                sucesso: false
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
                                                                    SubLoteCommissions.destroy({
                                                                        where: {
                                                                            id: elsu.id
                                                                        },
                                                                    })
                                                                }
                                                            })
                                                        }
                                                        else {
                                                            await LoteCommissions.destroy({
                                                                where: {
                                                                    id: lote.id
                                                                },
                                                            }).then(comm => {
                                                                res.send({
                                                                    message: "Lote de comissões deletado com sucesso!",
                                                                    sucesso: true
                                                                });
                                                            }).catch(err => {
                                                                res.status(401).send({
                                                                    message: err.message,
                                                                    sucesso: false
                                                                });
                                                            });
                                                        }
                                                    }).catch(err => {
                                                        res.status(401).send({
                                                            message: err.message,
                                                            sucesso: false
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
                                                Commissions.destroy({
                                                    where: {
                                                        id: eldc.id
                                                    },
                                                })
                                            }
                                        });
                                    } else {
                                        await SubLoteCommissions.findAll({
                                            where: {
                                                lote_commissions_ID: lote.id
                                            }
                                        }).then(async sub => {
                                            if (sub) {
                                                sub.forEach(async (elsu, isu) => {
                                                    if (isu === sub.length - 1) {
                                                        await SubLoteCommissions.destroy({
                                                            where: {
                                                                id: elsu.id
                                                            },
                                                        }).then(async dsub => {
                                                            await LoteCommissions.destroy({
                                                                where: {
                                                                    id: lote.id
                                                                },
                                                            }).then(comm => {
                                                                res.send({
                                                                    message: "Lote de comissões deletado com sucesso!",
                                                                    sucesso: true
                                                                });
                                                            }).catch(err => {
                                                                res.status(401).send({
                                                                    message: err.message,
                                                                    sucesso: false
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
                                                        SubLoteCommissions.destroy({
                                                            where: {
                                                                id: elsu.id
                                                            },
                                                        })
                                                    }
                                                })
                                            }
                                            else {
                                                await LoteCommissions.destroy({
                                                    where: {
                                                        id: lote.id
                                                    },
                                                }).then(comm => {
                                                    res.send({
                                                        message: "Lote de comissões deletado com sucesso!",
                                                        sucesso: true
                                                    });
                                                }).catch(err => {
                                                    res.status(401).send({
                                                        message: err.message,
                                                        sucesso: false
                                                    });
                                                });
                                            }
                                        }).catch(err => {
                                            res.status(401).send({
                                                message: err.message,
                                                sucesso: false
                                            });
                                        });
                                    }
                                }).catch(err => {
                                    res.status(401).send({
                                        message: err.message,
                                        sucesso: false
                                    });
                                });
                            });
                    }
                    else {
                        res.status(401).send({
                            message: "Algo deu errado, tente novamente!",
                            sucesso: false
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
};

exports.updateLoteCommissions = async (req, res) => {
    if (Number(req.body.status_ID) === 1) {
        const dbTransaction = await sequelize.transaction();

        try {
            const subLoteCommissions = await SubLoteCommissions.findAll({
                where: { lote_commissions_ID: req.params.id },
                transaction: dbTransaction
            });

            if (!subLoteCommissions.length) {
                await dbTransaction.rollback();
                return res.status(404).send({ sucesso: false, message: 'Nenhum sublote encontrado para este lote.' });
            }

            for (const elem of subLoteCommissions) {
                const cnpj = elem.corretora_CNPJ.replace(/\D/g, '');
                let wallet = await Wallet.findOne({ where: { corretoraCNPJ: cnpj }, transaction: dbTransaction });

                if (!wallet) {
                    wallet = await Wallet.create({
                        corretoraCNPJ: cnpj,
                        corretoraRazaoSocial: elem.corretora,
                        saldoAtual: Number(0).toFixed(2),
                        saldoProvisionado: Number(0).toFixed(2),
                        saldoDisponivel: Number(0).toFixed(2),
                        ativa: true,
                    }, { transaction: dbTransaction });
                }
            }

            for (const elem of subLoteCommissions) {
                const commissions = await Commissions.findAll({
                    where: { sub_lote_commissions_ID: elem.id },
                    transaction: dbTransaction
                });

                if (!commissions.length) {
                    await dbTransaction.rollback();
                    return res.status(404).send({ sucesso: false, message: `Nenhuma comissão encontrada no sublote ID ${elem.id}.` });
                }

                for (const element of commissions) {
                    await Transaction.create({
                        corretoraCNPJ: element.corretora_CNPJ.replace(/\D/g, ''),
                        corretoraRazaoSocial: element.corretora,
                        produtorCPF: element.cpf_cnpj_contrato.replace(/\D/g, ''),
                        produtorNome: element.produtor,
                        clienteNome: element.nome_contrato,
                        valor: element.tipo === 'credito' ? Number(element.valor_provisionado).toFixed(2) : Number(element.valor_estorno).toFixed(2),
                        tipo: element.tipo,
                        descricao: element.descricao,
                        idLoteCommissions: element.lote_commissions_ID,
                        idSubLoteCommissions: element.sub_lote_commissions_ID,
                        idCommissions: element.id,
                        dataLancamento: element.dataLancamento,
                        vigencia: element.vigencia,
                        numeroParcela: element.parcela,
                        codigoCommissionDigitalSaude: element.codigoCommissionsDigitalSaude,
                        codigoProduto: element.codigoProduto,
                        nomeProduto: element.nomeProduto,
                        calculated: false,
                    }, { transaction: dbTransaction });

                    await Commissions.update(
                        { status_ID: req.body.status_ID },
                        { where: { id: element.id }, transaction: dbTransaction }
                    );
                }

                const transactions = await Transaction.findAll({
                    where: { idSubLoteCommissions: elem.id },
                    transaction: dbTransaction
                });

                if (!transactions.length) {
                    await dbTransaction.rollback();
                    return res.status(404).send({ sucesso: false, message: `Nenhuma transação encontrada no sublote ID ${elem.id}.` });
                }

                for (const transaction of transactions) {
                    const wallet = await Wallet.findOne({ where: { corretoraCNPJ: transaction.corretoraCNPJ }, transaction: dbTransaction });

                    if (!wallet) {
                        console.error(`⚠️ Carteira não encontrada para CNPJ: ${transaction.corretoraCNPJ}`);
                        await dbTransaction.rollback();
                        return res.status(404).send({ sucesso: false, message: `Carteira não encontrada para CNPJ: ${transaction.corretoraCNPJ}` });
                    }

                    let valor = Number(transaction.valor);
                    let saldoAtual = Number(wallet.saldoAtual);
                    let saldoDisponivel = Number(wallet.saldoDisponivel);
                    let novoSaldoAtual, novoSaldoDisponivel;

                    if (transaction.tipo === 'credito') {
                        novoSaldoAtual = saldoAtual + valor;
                        novoSaldoDisponivel = saldoDisponivel + valor;
                    } else if (transaction.tipo === 'debito') {
                        novoSaldoAtual = saldoAtual - valor;
                        novoSaldoDisponivel = saldoDisponivel - valor;
                    }

                    await Wallet.update(
                        {
                            saldoAtual: novoSaldoAtual.toFixed(2),
                            saldoDisponivel: novoSaldoDisponivel.toFixed(2)
                        },
                        { where: { id: wallet.id }, transaction: dbTransaction }
                    );

                    await Transaction.update(
                        { calculated: true },
                        { where: { id: transaction.id }, transaction: dbTransaction }
                    );
                }

                const wallet = await Wallet.findOne({
                    where: { corretoraCNPJ: elem.corretora_CNPJ.replace(/\D/g, '') },
                    transaction: dbTransaction
                });

                if (!wallet) {
                    await dbTransaction.rollback();
                    return res.status(404).send({ sucesso: false, message: `Carteira não encontrada para sublote ID ${elem.id}.` });
                }

                const valor = Number(wallet.saldoDisponivel);

                if (valor > 0) {
                    await SubLoteCommissions.update(
                        {
                            total_provisionado: valor.toFixed(2),
                            status_ID: req.body.status_ID,
                            empresa_ID: req.body.empresa_ID,
                            disabled: false,
                        },
                        { where: { id: elem.id }, transaction: dbTransaction }
                    );

                    const novosaldoProvisionado = Number(wallet.saldoProvisionado) + Number(valor);
                    const novoSaldoDisponivel = Number(wallet.saldoDisponivel) - Number(valor);

                    await Wallet.update(
                        { saldoProvisionado: novosaldoProvisionado.toFixed(2), saldoDisponivel: novoSaldoDisponivel.toFixed(2) },
                        { where: { id: wallet.id }, transaction: dbTransaction }
                    );
                } else {
                    const date = new Date();
                    date.setUTCHours(3, 0, 0, 0);
                    const dataFormatada = date.toISOString();
                    await SubLoteCommissions.update(
                        {
                            total_provisionado: '0.00',
                            status_ID: req.body.status_ID,
                            empresa_ID: req.body.empresa_ID,
                            data_pagamento: dataFormatada,
                            situacao_ID: 5,
                            motivo: 'Lote concluído sem saldo para pagamento',
                            disabled: true,
                        },
                        { where: { id: elem.id }, transaction: dbTransaction }
                    );

                    const commi = await Commissions.findAll({
                        where: { sub_lote_commissions_ID: elem.id },
                        transaction: dbTransaction
                    });

                    if (!commi.length) {
                        await dbTransaction.rollback();
                        return res.status(404).send({ sucesso: false, message: `Nenhuma comissão encontrada no sublote ID ${elem.id}.` });
                    }

                    for (const el of commissions) {
                        Commissions.update(
                            {
                                data_pagamento: dataFormatada,
                                situacao_ID: 5,
                                motivo: 'Lote concluído sem saldo para pagamento',
                            },
                            { where: { id: el.id }, transaction: dbTransaction }
                        )
                    }

                }
            }

            const subLotes = await SubLoteCommissions.findAll({
                where: { lote_commissions_ID: req.params.id },
                transaction: dbTransaction
            });

            if (!subLotes.length) {
                await dbTransaction.rollback();
                return res.status(404).send({ sucesso: false, message: 'Nenhum sublote encontrado para atualização final.' });
            }

            let saldoProvisionado = 0;

            for (const sub of subLotes) {
                saldoProvisionado = Number(saldoProvisionado) + Number(sub.total_provisionado);
            }

            await LoteCommissions.update(
                {
                    status_ID: req.body.status_ID,
                    empresa_ID: req.body.empresa_ID,
                    disabled: req.body.disabled,
                    total_provisionado: saldoProvisionado.toFixed(2)
                },
                { where: { id: req.params.id }, transaction: dbTransaction }
            );

            await dbTransaction.commit();

            return res.send({
                message: "Lote de comissões atualizado com sucesso!",
                sucesso: true
            });

        } catch (error) {
            console.error(error);
            await dbTransaction.rollback();
            return res.status(500).send({ sucesso: false, message: 'Erro ao processar atualização do lote.' });
        }

    }/////////////////////////////////////////////////////////////////////////////////////////////////
    else {
        await LoteCommissions.update(
            {
                status_ID: req.body.status_ID,
                empresa_ID: req.body.empresa_ID,
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
                    await SubLoteCommissions.findAll({
                        where: {
                            lote_commissions_ID: req.params.id
                        }
                    }).then(async sub => {
                        let i = sub.length;
                        sub.forEach((element, index) => {
                            if (index === i - 1) {
                                SubLoteCommissions.update(
                                    {
                                        status_ID: req.body.status_ID,
                                        empresa_ID: req.body.empresa_ID,
                                        disabled: Number(req.body.status_ID) === 2 ? true : false,
                                    },
                                    {
                                        where: {
                                            id: element.id
                                        },
                                    }
                                ).then(async c => {
                                    await Commissions.findAll({
                                        where: {
                                            lote_commissions_ID: req.params.id
                                        }
                                    }).then(async com => {
                                        let ic = com.length;
                                        com.forEach((el, ind) => {
                                            if (ind === ic - 1) {
                                                Commissions.update(
                                                    {
                                                        status_ID: req.body.status_ID,
                                                    },
                                                    {
                                                        where: {
                                                            id: el.id
                                                        },
                                                    }
                                                ).then(async c => {
                                                    LoteCommissions.findByPk(req.params.id,
                                                        {
                                                            include: [
                                                                {
                                                                    model: db.corretoras_subLoteCommissions,
                                                                    include: [
                                                                        {
                                                                            model: db.corretoras_commission,
                                                                        },
                                                                    ],
                                                                },
                                                            ],
                                                        })
                                                        .then((result) => {
                                                            res.send({
                                                                loteCommissions: result,
                                                                message: "Lote de comissões atualizado com sucesso!",
                                                                sucesso: true
                                                            });
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
                                                })
                                            }
                                            else {
                                                Commissions.update(
                                                    {
                                                        status_ID: req.body.status_ID,
                                                    },
                                                    {
                                                        where: {
                                                            id: el.id
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
                                }).catch(err => {
                                    res.status(401).send({
                                        message: err.message,
                                        sucesso: false
                                    });
                                })
                            }
                            else {
                                SubLoteCommissions.update(
                                    {
                                        status_ID: req.body.status_ID,
                                        empresa_ID: req.body.empresa_ID,
                                        disabled: Number(req.body.status_ID) === 2 ? true : false,
                                    },
                                    {
                                        where: {
                                            id: element.id
                                        },
                                    }
                                )
                            }
                            if (Number(req.body.status_ID) === 1) {
                                Corretora.findOne(
                                    {
                                        where: {
                                            cnpj: element.corretora_CNPJ
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
                                            }
                                        }
                                    })
                                    .catch(err => { })
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
    }
};

exports.findLoteCommissionsNotification = async (req, res) => {
    await SubLoteCommissions.findAll({
        where: {
            lote_commissions_ID: req.params.id
        }
    }).then(async sub => {
        sub.forEach((element, index) => {
            if (index === sub.length - 1) {
                Corretora.findOne(
                    {
                        where: {
                            cnpj: element.corretora_CNPJ
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
                            }
                        }
                    })
                    .catch(err => { })
                res.send({
                    message: "Notificações enviadas com sucesso!",
                    sucesso: true
                });
            }
            else {
                Corretora.findOne(
                    {
                        where: {
                            cnpj: element.corretora_CNPJ
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
                            }
                        }
                    })
                    .catch(err => { })
            }
        });
    }).catch(err => {
        res.status(401).send({
            message: err.message,
            sucesso: false
        });
    });
};

exports.findAll = (req, res) => {
    LoteCommissions.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ],
            // include: [
            //     {
            //         model: db.corretoras_subLoteCommissions,
            //         include: [
            //             {
            //                 model: db.corretoras_commission,
            //             },
            //         ],
            //     },
            // ],
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

exports.findLoteCommissions = (req, res) => {
    LoteCommissions.findByPk(req.params.id,
        {
            include: [
                {
                    model: db.corretoras_subLoteCommissions,
                    include: [
                        {
                            model: db.corretoras_commission,
                        },
                    ],
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

exports.findLoteCommissionsCommission = (req, res) => {
    Commissions.findAll(
        {
            where: {
                lote_commissions_ID: req.params.id
            }
        })
        .then(co => {
            LoteCommissions.findByPk(req.params.id
            )
                .then(loco => {
                    res.send({
                        commissions: co,
                        arquivo_URL: loco.arquivo_URL,
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
        })
        .catch(err => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            })
        })
};

exports.findLoteCommissionsSearch = (req, res) => {
    const where = {};
    if (req.body.status) { where.status_ID = req.body.status; };
    if (req.body.dataInicio) {
        where.updatedAt = {
            [Op.between]: [req.body.dataInicio, req.body.dataFim],
        };
    };
    LoteCommissions.findAll(
        {
            where
        },
        {
            include: [
                {
                    model: db.corretoras_subLoteCommissions,
                    include: [
                        {
                            model: db.corretoras_commission,
                        },
                    ],
                },
            ],
        })
        .then(loco => {
            res.send({
                loteCommissions: loco,
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

exports.deleteLoteCommissions = async (req, res) => {
    await Commissions.findAll({
        where: {
            lote_commissions_ID: req.params.id
        }
    }).then(async co => {
        let i = co.length;
        if (co) {
            co.forEach((element, index) => {
                if (index === i - 1) {
                    Commissions.destroy({
                        where: {
                            id: element.id
                        },
                    }).then(async com => {
                        await SubLoteCommissions.findAll({
                            where: {
                                lote_commissions_ID: req.params.id
                            }
                        }).then(async sub => {
                            let is = sub.length;
                            if (sub) {
                                sub.forEach((el, ind) => {
                                    if (ind === is - 1) {
                                        SubLoteCommissions.destroy({
                                            where: {
                                                id: el.id
                                            },
                                        }).then(async subl => {
                                            await LoteCommissions.destroy({
                                                where: {
                                                    id: req.params.id
                                                },
                                            }).then(comm => {
                                                res.send({
                                                    message: "Lote de comissões deletado com sucesso!",
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
                                        SubLoteCommissions.destroy({
                                            where: {
                                                id: el.id
                                            },
                                        })
                                    }
                                });
                            } else {
                                await LoteCommissions.destroy({
                                    where: {
                                        id: req.params.id
                                    },
                                }).then(co => {
                                    res.send({
                                        message: "Lote de bonificações deletado com sucesso!",
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
                    }).catch(err => {
                        res.status(401).send({
                            message: err.message,
                            sucesso: false
                        });
                    })
                }
                else {
                    Commissions.destroy({
                        where: {
                            id: element.id
                        },
                    })
                }
            });
        } else {
            await SubLoteCommissions.findAll({
                where: {
                    lote_commissions_ID: req.params.id
                }
            }).then(async sub => {
                let is = sub.length;
                if (sub) {
                    sub.forEach((el, ind) => {
                        if (ind === is - 1) {
                            SubLoteCommissions.destroy({
                                where: {
                                    id: el.id
                                },
                            }).then(async subl => {
                                await LoteCommissions.destroy({
                                    where: {
                                        id: req.params.id
                                    },
                                }).then(comm => {
                                    res.send({
                                        message: "Lote de comissões deletado com sucesso!",
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
                            SubLoteCommissions.destroy({
                                where: {
                                    id: el.id
                                },
                            })
                        }
                    });
                } else {
                    await LoteCommissions.destroy({
                        where: {
                            id: req.params.id
                        },
                    }).then(co => {
                        res.send({
                            message: "Lote de bonificações deletado com sucesso!",
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
        }
    }).catch(err => {
        res.status(401).send({
            message: err.message,
            sucesso: false
        });
    });
};