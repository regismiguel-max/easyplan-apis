const db = require("../../../../../../models");
const Operadoras = db.utils_digital_saude_operadoras;
const Produtos = db.utils_digital_saude_produtos;

const xlsx = require('node-xlsx');
const moment = require('moment');
const { where, Op } = require("sequelize");

exports.addOperadorasProdutos = async (req, res) => {
    let sql1 = 'TRUNCATE TABLE utils_digital_saude_operadora_produto;';
    let sql2 = 'TRUNCATE TABLE utils_digital_saude_produtos;';
    let sql3 = 'TRUNCATE TABLE utils_digital_saude_operadoras;';

    db.sequelize.query(`SET FOREIGN_KEY_CHECKS = 0`)
        .then(async () => {
            db.sequelize.query(`${sql1}`, { type: db.sequelize.QueryTypes.TRUNCATE })
                .then(async () => {
                    db.sequelize.query(`${sql2}`, { type: db.sequelize.QueryTypes.TRUNCATE })
                        .then(async () => {
                            db.sequelize.query(`${sql3}`, { type: db.sequelize.QueryTypes.TRUNCATE })
                                .then(async () => {
                                    db.sequelize.query(`SET FOREIGN_KEY_CHECKS = 1`)
                                        .then(async () => {
                                            addCreate(req, res);
                                        })
                                        .catch(async err => {
                                            ReturnError(res, err);
                                        });
                                })
                                .catch(async err => {
                                    ReturnError(res, err);
                                });
                        })
                        .catch(async err => {
                            ReturnError(res, err);
                        });
                })
                .catch(async err => {
                    ReturnError(res, err);
                });
        })
        .catch(async err => {
            ReturnError(res, err);
        });
};

addCreate = async (req, res) => {
    const operadoras = [
        // {
        //     codigo: null,
        //     nome: null,
        //     nomeTipo: null,
        //     produtos: [
        //         {
        //             codigo: null,
        //             nome: null,
        //             status: null,
        //             regiao: null,
        //             registroANS: null,
        //             acomodacao: null,
        //             abrangencia: null,
        //             coparticipacao: null,
        //             integracaoDoPlano: null,
        //         }
        //     ]
        // }
    ];
    const operadorasCodigo = [];
    const filePath = `${req.file.destination}${req.file.filename}`;
    const plan = await xlsx.parse(filePath);

    await plan[0].data.forEach(async (el, index) => {
        if (index > 0) {
            if (operadorasCodigo.indexOf(plan[0].data[index][1]) === -1) {
                operadorasCodigo.push(plan[0].data[index][1]);
                operadoras.push(
                    {
                        codigo: plan[0].data[index][1] ? plan[0].data[index][1] : '',
                        nome: plan[0].data[index][0] ? plan[0].data[index][0] : '',
                        nomeTipo: plan[0].data[index][2] ? plan[0].data[index][2] : '',
                        produtos: [
                            {
                                codigo: plan[0].data[index][3] ? plan[0].data[index][3] : '',
                                nome: plan[0].data[index][4] ? plan[0].data[index][4] : '',
                                status: plan[0].data[index][5] ? plan[0].data[index][5] : '',
                                regiao: plan[0].data[index][6] ? plan[0].data[index][6] : '',
                                registroANS: plan[0].data[index][7] ? plan[0].data[index][7] : '',
                                acomodacao: plan[0].data[index][8] ? plan[0].data[index][8] : '',
                                abrangencia: plan[0].data[index][9] ? plan[0].data[index][9] : '',
                                coparticipacao: plan[0].data[index][10] ? plan[0].data[index][10] : '',
                                integracaoDoPlano: plan[0].data[index][11] ? plan[0].data[index][11] : '',
                            }
                        ]
                    }
                );
            }
            else {
                operadoras[operadorasCodigo.indexOf(plan[0].data[index][1])].produtos.push(
                    {
                        codigo: plan[0].data[index][3] ? plan[0].data[index][3] : '',
                        nome: plan[0].data[index][4] ? plan[0].data[index][4] : '',
                        status: plan[0].data[index][5] ? plan[0].data[index][5] : '',
                        regiao: plan[0].data[index][6] ? plan[0].data[index][6] : '',
                        registroANS: plan[0].data[index][7] ? plan[0].data[index][7] : '',
                        acomodacao: plan[0].data[index][8] ? plan[0].data[index][8] : '',
                        abrangencia: plan[0].data[index][9] ? plan[0].data[index][9] : '',
                        coparticipacao: plan[0].data[index][10] ? plan[0].data[index][10] : '',
                        integracaoDoPlano: plan[0].data[index][11] ? plan[0].data[index][11] : '',
                    }
                )
            }
        }
    });

    if (operadoras.length > 0) {
        await operadoras.forEach(async (operadora, ind) => {
            if (operadoras.length - 1 === ind) {
                Operadoras.create(
                    {
                        codigo: operadora.codigo,
                        nome: operadora.nome,
                        nomeTipo: operadora.nomeTipo,
                    }
                )
                    .then(async ope => {
                        if (ope) {
                            operadora.produtos.forEach((produto, indpro) => {
                                if (operadora.produtos.length - 1 === indpro) {
                                    Produtos.create(
                                        {
                                            codigo: produto.codigo,
                                            nome: produto.nome,
                                            status: produto.status,
                                            regiao: produto.regiao,
                                            registroANS: produto.registroANS,
                                            acomodacao: produto.acomodacao,
                                            abrangencia: produto.abrangencia,
                                            coparticipacao: produto.coparticipacao,
                                            integracaoDoPlano: produto.integracaoDoPlano,
                                        }
                                    )
                                        .then(async produt => {
                                            if (produt) {
                                                let sql1 = 'INSERT INTO `utils_digital_saude_operadora_produto` (`operadora_ID`, `produto_ID`) VALUES (';
                                                db.sequelize.query(`${sql1}${ope.id}, ${produt.id})`, { type: db.sequelize.QueryTypes.INSERT })
                                                    .then(async () => {
                                                        res.send({
                                                            message: "Operadoras e produtos cadastrados com sucesso!",
                                                            sucesso: true
                                                        });
                                                    })
                                                    .catch(async err => {
                                                        await Produtos.findAll().then(async pro => {
                                                            if (pro) {
                                                                pro.forEach((pro, ipro) => {
                                                                    if (ipro === com.length - 1) {
                                                                        Produtos.destroy({
                                                                            where: {
                                                                                id: pro.id
                                                                            },
                                                                        }).then(async dpro => {
                                                                            await Operadoras.findAll().then(async ope => {
                                                                                if (ope) {
                                                                                    ope.forEach(async (opd, iop) => {
                                                                                        if (iop === ope.length - 1) {
                                                                                            await Operadoras.destroy({
                                                                                                where: {
                                                                                                    id: opd.id
                                                                                                },
                                                                                            }).then(async op => {
                                                                                                res.send({
                                                                                                    message: "Operadoras e produtos deletados com sucesso!",
                                                                                                    sucesso: true
                                                                                                });
                                                                                            }).catch(err => {
                                                                                                res.status(401).send({
                                                                                                    message: err.message,
                                                                                                    sucesso: false
                                                                                                });
                                                                                            })
                                                                                        }
                                                                                        else {
                                                                                            Operadoras.destroy({
                                                                                                where: {
                                                                                                    id: opd.id
                                                                                                },
                                                                                            })
                                                                                        }
                                                                                    })
                                                                                }
                                                                                else {
                                                                                    res.send({
                                                                                        message: "Operadoras e produtos deletados com sucesso!",
                                                                                        sucesso: true
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
                                                                        Produtos.destroy({
                                                                            where: {
                                                                                id: pro.id
                                                                            },
                                                                        })
                                                                    }
                                                                });
                                                            } else {
                                                                await Operadoras.findAll().then(async ope => {
                                                                    if (ope) {
                                                                        ope.forEach(async (oped, iop) => {
                                                                            if (iop === ope.length - 1) {
                                                                                await Operadoras.destroy({
                                                                                    where: {
                                                                                        id: oped.id
                                                                                    },
                                                                                }).then(async op => {
                                                                                    res.send({
                                                                                        message: "Operadoras e produtos deletados com sucesso!",
                                                                                        sucesso: true
                                                                                    });
                                                                                }).catch(err => {
                                                                                    res.status(401).send({
                                                                                        message: err.message,
                                                                                        sucesso: false
                                                                                    });
                                                                                })
                                                                            }
                                                                            else {
                                                                                Operadoras.destroy({
                                                                                    where: {
                                                                                        id: oped.id
                                                                                    },
                                                                                })
                                                                            }
                                                                        })
                                                                    }
                                                                    else {
                                                                        res.send({
                                                                            message: "Operadoras e produtos deletados com sucesso!",
                                                                            sucesso: true
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
                                                await Produtos.findAll().then(async pro => {
                                                    if (pro) {
                                                        pro.forEach((pro, ipro) => {
                                                            if (ipro === com.length - 1) {
                                                                Produtos.destroy({
                                                                    where: {
                                                                        id: pro.id
                                                                    },
                                                                }).then(async dpro => {
                                                                    await Operadoras.findAll().then(async ope => {
                                                                        if (ope) {
                                                                            ope.forEach(async (opd, iop) => {
                                                                                if (iop === ope.length - 1) {
                                                                                    await Operadoras.destroy({
                                                                                        where: {
                                                                                            id: opd.id
                                                                                        },
                                                                                    }).then(async op => {
                                                                                        res.send({
                                                                                            message: "Operadoras e produtos deletados com sucesso!",
                                                                                            sucesso: true
                                                                                        });
                                                                                    }).catch(err => {
                                                                                        res.status(401).send({
                                                                                            message: err.message,
                                                                                            sucesso: false
                                                                                        });
                                                                                    })
                                                                                }
                                                                                else {
                                                                                    Operadoras.destroy({
                                                                                        where: {
                                                                                            id: opd.id
                                                                                        },
                                                                                    })
                                                                                }
                                                                            })
                                                                        }
                                                                        else {
                                                                            res.send({
                                                                                message: "Operadoras e produtos deletados com sucesso!",
                                                                                sucesso: true
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
                                                                Produtos.destroy({
                                                                    where: {
                                                                        id: pro.id
                                                                    },
                                                                })
                                                            }
                                                        });
                                                    } else {
                                                        await Operadoras.findAll().then(async ope => {
                                                            if (ope) {
                                                                ope.forEach(async (oped, iop) => {
                                                                    if (iop === ope.length - 1) {
                                                                        await Operadoras.destroy({
                                                                            where: {
                                                                                id: oped.id
                                                                            },
                                                                        }).then(async op => {
                                                                            res.send({
                                                                                message: "Operadoras e produtos deletados com sucesso!",
                                                                                sucesso: true
                                                                            });
                                                                        }).catch(err => {
                                                                            res.status(401).send({
                                                                                message: err.message,
                                                                                sucesso: false
                                                                            });
                                                                        })
                                                                    }
                                                                    else {
                                                                        Operadoras.destroy({
                                                                            where: {
                                                                                id: oped.id
                                                                            },
                                                                        })
                                                                    }
                                                                })
                                                            }
                                                            else {
                                                                res.send({
                                                                    message: "Operadoras e produtos deletados com sucesso!",
                                                                    sucesso: true
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
                                            await Produtos.findAll().then(async pro => {
                                                if (pro) {
                                                    pro.forEach((pro, ipro) => {
                                                        if (ipro === com.length - 1) {
                                                            Produtos.destroy({
                                                                where: {
                                                                    id: pro.id
                                                                },
                                                            }).then(async dpro => {
                                                                await Operadoras.findAll().then(async ope => {
                                                                    if (ope) {
                                                                        ope.forEach(async (opd, iop) => {
                                                                            if (iop === ope.length - 1) {
                                                                                await Operadoras.destroy({
                                                                                    where: {
                                                                                        id: opd.id
                                                                                    },
                                                                                }).then(async op => {
                                                                                    res.send({
                                                                                        message: "Operadoras e produtos deletados com sucesso!",
                                                                                        sucesso: true
                                                                                    });
                                                                                }).catch(err => {
                                                                                    res.status(401).send({
                                                                                        message: err.message,
                                                                                        sucesso: false
                                                                                    });
                                                                                })
                                                                            }
                                                                            else {
                                                                                Operadoras.destroy({
                                                                                    where: {
                                                                                        id: opd.id
                                                                                    },
                                                                                })
                                                                            }
                                                                        })
                                                                    }
                                                                    else {
                                                                        res.send({
                                                                            message: "Operadoras e produtos deletados com sucesso!",
                                                                            sucesso: true
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
                                                            Produtos.destroy({
                                                                where: {
                                                                    id: pro.id
                                                                },
                                                            })
                                                        }
                                                    });
                                                } else {
                                                    await Operadoras.findAll().then(async ope => {
                                                        if (ope) {
                                                            ope.forEach(async (oped, iop) => {
                                                                if (iop === ope.length - 1) {
                                                                    await Operadoras.destroy({
                                                                        where: {
                                                                            id: oped.id
                                                                        },
                                                                    }).then(async op => {
                                                                        res.send({
                                                                            message: "Operadoras e produtos deletados com sucesso!",
                                                                            sucesso: true
                                                                        });
                                                                    }).catch(err => {
                                                                        res.status(401).send({
                                                                            message: err.message,
                                                                            sucesso: false
                                                                        });
                                                                    })
                                                                }
                                                                else {
                                                                    Operadoras.destroy({
                                                                        where: {
                                                                            id: oped.id
                                                                        },
                                                                    })
                                                                }
                                                            })
                                                        }
                                                        else {
                                                            res.send({
                                                                message: "Operadoras e produtos deletados com sucesso!",
                                                                sucesso: true
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
                                    Produtos.create(
                                        {
                                            codigo: produto.codigo,
                                            nome: produto.nome,
                                            status: produto.status,
                                            regiao: produto.regiao,
                                            registroANS: produto.registroANS,
                                            acomodacao: produto.acomodacao,
                                            abrangencia: produto.abrangencia,
                                            coparticipacao: produto.coparticipacao,
                                            integracaoDoPlano: produto.integracaoDoPlano,
                                        }
                                    )
                                        .then(async produt => {
                                            if (produt) {
                                                let sql1 = 'INSERT INTO `utils_digital_saude_operadora_produto` (`operadora_ID`, `produto_ID`) VALUES (';
                                                db.sequelize.query(`${sql1}${ope.id}, ${produt.id})`, { type: db.sequelize.QueryTypes.INSERT })
                                                    .then(async () => { })
                                                    .catch(async err => {
                                                        await Produtos.findAll().then(async pro => {
                                                            if (pro) {
                                                                pro.forEach((pro, ipro) => {
                                                                    if (ipro === com.length - 1) {
                                                                        Produtos.destroy({
                                                                            where: {
                                                                                id: pro.id
                                                                            },
                                                                        }).then(async dpro => {
                                                                            await Operadoras.findAll().then(async ope => {
                                                                                if (ope) {
                                                                                    ope.forEach(async (opd, iop) => {
                                                                                        if (iop === ope.length - 1) {
                                                                                            await Operadoras.destroy({
                                                                                                where: {
                                                                                                    id: opd.id
                                                                                                },
                                                                                            }).then(async op => {
                                                                                                res.send({
                                                                                                    message: "Operadoras e produtos deletados com sucesso!",
                                                                                                    sucesso: true
                                                                                                });
                                                                                            }).catch(err => {
                                                                                                res.status(401).send({
                                                                                                    message: err.message,
                                                                                                    sucesso: false
                                                                                                });
                                                                                            })
                                                                                        }
                                                                                        else {
                                                                                            Operadoras.destroy({
                                                                                                where: {
                                                                                                    id: opd.id
                                                                                                },
                                                                                            })
                                                                                        }
                                                                                    })
                                                                                }
                                                                                else {
                                                                                    res.send({
                                                                                        message: "Operadoras e produtos deletados com sucesso!",
                                                                                        sucesso: true
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
                                                                        Produtos.destroy({
                                                                            where: {
                                                                                id: pro.id
                                                                            },
                                                                        })
                                                                    }
                                                                });
                                                            } else {
                                                                await Operadoras.findAll().then(async ope => {
                                                                    if (ope) {
                                                                        ope.forEach(async (oped, iop) => {
                                                                            if (iop === ope.length - 1) {
                                                                                await Operadoras.destroy({
                                                                                    where: {
                                                                                        id: oped.id
                                                                                    },
                                                                                }).then(async op => {
                                                                                    res.send({
                                                                                        message: "Operadoras e produtos deletados com sucesso!",
                                                                                        sucesso: true
                                                                                    });
                                                                                }).catch(err => {
                                                                                    res.status(401).send({
                                                                                        message: err.message,
                                                                                        sucesso: false
                                                                                    });
                                                                                })
                                                                            }
                                                                            else {
                                                                                Operadoras.destroy({
                                                                                    where: {
                                                                                        id: oped.id
                                                                                    },
                                                                                })
                                                                            }
                                                                        })
                                                                    }
                                                                    else {
                                                                        res.send({
                                                                            message: "Operadoras e produtos deletados com sucesso!",
                                                                            sucesso: true
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
                                                await Produtos.findAll().then(async pro => {
                                                    if (pro) {
                                                        pro.forEach((pro, ipro) => {
                                                            if (ipro === com.length - 1) {
                                                                Produtos.destroy({
                                                                    where: {
                                                                        id: pro.id
                                                                    },
                                                                }).then(async dpro => {
                                                                    await Operadoras.findAll().then(async ope => {
                                                                        if (ope) {
                                                                            ope.forEach(async (opd, iop) => {
                                                                                if (iop === ope.length - 1) {
                                                                                    await Operadoras.destroy({
                                                                                        where: {
                                                                                            id: opd.id
                                                                                        },
                                                                                    }).then(async op => {
                                                                                        res.send({
                                                                                            message: "Operadoras e produtos deletados com sucesso!",
                                                                                            sucesso: true
                                                                                        });
                                                                                    }).catch(err => {
                                                                                        res.status(401).send({
                                                                                            message: err.message,
                                                                                            sucesso: false
                                                                                        });
                                                                                    })
                                                                                }
                                                                                else {
                                                                                    Operadoras.destroy({
                                                                                        where: {
                                                                                            id: opd.id
                                                                                        },
                                                                                    })
                                                                                }
                                                                            })
                                                                        }
                                                                        else {
                                                                            res.send({
                                                                                message: "Operadoras e produtos deletados com sucesso!",
                                                                                sucesso: true
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
                                                                Produtos.destroy({
                                                                    where: {
                                                                        id: pro.id
                                                                    },
                                                                })
                                                            }
                                                        });
                                                    } else {
                                                        await Operadoras.findAll().then(async ope => {
                                                            if (ope) {
                                                                ope.forEach(async (oped, iop) => {
                                                                    if (iop === ope.length - 1) {
                                                                        await Operadoras.destroy({
                                                                            where: {
                                                                                id: oped.id
                                                                            },
                                                                        }).then(async op => {
                                                                            res.send({
                                                                                message: "Operadoras e produtos deletados com sucesso!",
                                                                                sucesso: true
                                                                            });
                                                                        }).catch(err => {
                                                                            res.status(401).send({
                                                                                message: err.message,
                                                                                sucesso: false
                                                                            });
                                                                        })
                                                                    }
                                                                    else {
                                                                        Operadoras.destroy({
                                                                            where: {
                                                                                id: oped.id
                                                                            },
                                                                        })
                                                                    }
                                                                })
                                                            }
                                                            else {
                                                                res.send({
                                                                    message: "Operadoras e produtos deletados com sucesso!",
                                                                    sucesso: true
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
                                            await Produtos.findAll().then(async pro => {
                                                if (pro) {
                                                    pro.forEach((pro, ipro) => {
                                                        if (ipro === com.length - 1) {
                                                            Produtos.destroy({
                                                                where: {
                                                                    id: pro.id
                                                                },
                                                            }).then(async dpro => {
                                                                await Operadoras.findAll().then(async ope => {
                                                                    if (ope) {
                                                                        ope.forEach(async (opd, iop) => {
                                                                            if (iop === ope.length - 1) {
                                                                                await Operadoras.destroy({
                                                                                    where: {
                                                                                        id: opd.id
                                                                                    },
                                                                                }).then(async op => {
                                                                                    res.send({
                                                                                        message: "Operadoras e produtos deletados com sucesso!",
                                                                                        sucesso: true
                                                                                    });
                                                                                }).catch(err => {
                                                                                    res.status(401).send({
                                                                                        message: err.message,
                                                                                        sucesso: false
                                                                                    });
                                                                                })
                                                                            }
                                                                            else {
                                                                                Operadoras.destroy({
                                                                                    where: {
                                                                                        id: opd.id
                                                                                    },
                                                                                })
                                                                            }
                                                                        })
                                                                    }
                                                                    else {
                                                                        res.send({
                                                                            message: "Operadoras e produtos deletados com sucesso!",
                                                                            sucesso: true
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
                                                            Produtos.destroy({
                                                                where: {
                                                                    id: pro.id
                                                                },
                                                            })
                                                        }
                                                    });
                                                } else {
                                                    await Operadoras.findAll().then(async ope => {
                                                        if (ope) {
                                                            ope.forEach(async (oped, iop) => {
                                                                if (iop === ope.length - 1) {
                                                                    await Operadoras.destroy({
                                                                        where: {
                                                                            id: oped.id
                                                                        },
                                                                    }).then(async op => {
                                                                        res.send({
                                                                            message: "Operadoras e produtos deletados com sucesso!",
                                                                            sucesso: true
                                                                        });
                                                                    }).catch(err => {
                                                                        res.status(401).send({
                                                                            message: err.message,
                                                                            sucesso: false
                                                                        });
                                                                    })
                                                                }
                                                                else {
                                                                    Operadoras.destroy({
                                                                        where: {
                                                                            id: oped.id
                                                                        },
                                                                    })
                                                                }
                                                            })
                                                        }
                                                        else {
                                                            res.send({
                                                                message: "Operadoras e produtos deletados com sucesso!",
                                                                sucesso: true
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
                            });
                        } else {
                            await Produtos.findAll().then(async pro => {
                                if (pro) {
                                    pro.forEach((pro, ipro) => {
                                        if (ipro === com.length - 1) {
                                            Produtos.destroy({
                                                where: {
                                                    id: pro.id
                                                },
                                            }).then(async dpro => {
                                                await Operadoras.findAll().then(async ope => {
                                                    if (ope) {
                                                        ope.forEach(async (opd, iop) => {
                                                            if (iop === ope.length - 1) {
                                                                await Operadoras.destroy({
                                                                    where: {
                                                                        id: opd.id
                                                                    },
                                                                }).then(async op => {
                                                                    res.send({
                                                                        message: "Operadoras e produtos deletados com sucesso!",
                                                                        sucesso: true
                                                                    });
                                                                }).catch(err => {
                                                                    res.status(401).send({
                                                                        message: err.message,
                                                                        sucesso: false
                                                                    });
                                                                })
                                                            }
                                                            else {
                                                                Operadoras.destroy({
                                                                    where: {
                                                                        id: opd.id
                                                                    },
                                                                })
                                                            }
                                                        })
                                                    }
                                                    else {
                                                        res.send({
                                                            message: "Operadoras e produtos deletados com sucesso!",
                                                            sucesso: true
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
                                            Produtos.destroy({
                                                where: {
                                                    id: pro.id
                                                },
                                            })
                                        }
                                    });
                                } else {
                                    await Operadoras.findAll().then(async ope => {
                                        if (ope) {
                                            ope.forEach(async (oped, iop) => {
                                                if (iop === ope.length - 1) {
                                                    await Operadoras.destroy({
                                                        where: {
                                                            id: oped.id
                                                        },
                                                    }).then(async op => {
                                                        res.send({
                                                            message: "Operadoras e produtos deletados com sucesso!",
                                                            sucesso: true
                                                        });
                                                    }).catch(err => {
                                                        res.status(401).send({
                                                            message: err.message,
                                                            sucesso: false
                                                        });
                                                    })
                                                }
                                                else {
                                                    Operadoras.destroy({
                                                        where: {
                                                            id: oped.id
                                                        },
                                                    })
                                                }
                                            })
                                        }
                                        else {
                                            res.send({
                                                message: "Operadoras e produtos deletados com sucesso!",
                                                sucesso: true
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
                        await Produtos.findAll().then(async pro => {
                            if (pro) {
                                pro.forEach((pro, ipro) => {
                                    if (ipro === com.length - 1) {
                                        Produtos.destroy({
                                            where: {
                                                id: pro.id
                                            },
                                        }).then(async dpro => {
                                            await Operadoras.findAll().then(async ope => {
                                                if (ope) {
                                                    ope.forEach(async (opd, iop) => {
                                                        if (iop === ope.length - 1) {
                                                            await Operadoras.destroy({
                                                                where: {
                                                                    id: opd.id
                                                                },
                                                            }).then(async op => {
                                                                res.send({
                                                                    message: "Operadoras e produtos deletados com sucesso!",
                                                                    sucesso: true
                                                                });
                                                            }).catch(err => {
                                                                res.status(401).send({
                                                                    message: err.message,
                                                                    sucesso: false
                                                                });
                                                            })
                                                        }
                                                        else {
                                                            Operadoras.destroy({
                                                                where: {
                                                                    id: opd.id
                                                                },
                                                            })
                                                        }
                                                    })
                                                }
                                                else {
                                                    res.send({
                                                        message: "Operadoras e produtos deletados com sucesso!",
                                                        sucesso: true
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
                                        Produtos.destroy({
                                            where: {
                                                id: pro.id
                                            },
                                        })
                                    }
                                });
                            } else {
                                await Operadoras.findAll().then(async ope => {
                                    if (ope) {
                                        ope.forEach(async (oped, iop) => {
                                            if (iop === ope.length - 1) {
                                                await Operadoras.destroy({
                                                    where: {
                                                        id: oped.id
                                                    },
                                                }).then(async op => {
                                                    res.send({
                                                        message: "Operadoras e produtos deletados com sucesso!",
                                                        sucesso: true
                                                    });
                                                }).catch(err => {
                                                    res.status(401).send({
                                                        message: err.message,
                                                        sucesso: false
                                                    });
                                                })
                                            }
                                            else {
                                                Operadoras.destroy({
                                                    where: {
                                                        id: oped.id
                                                    },
                                                })
                                            }
                                        })
                                    }
                                    else {
                                        res.send({
                                            message: "Operadoras e produtos deletados com sucesso!",
                                            sucesso: true
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
                Operadoras.create(
                    {
                        codigo: operadora.codigo,
                        nome: operadora.nome,
                        nomeTipo: operadora.nomeTipo,
                    }
                )
                    .then(async ope => {
                        if (ope) {
                            operadora.produtos.forEach((produto, indpro) => {
                                Produtos.create(
                                    {
                                        codigo: produto.codigo,
                                        nome: produto.nome,
                                        status: produto.status,
                                        regiao: produto.regiao,
                                        registroANS: produto.registroANS,
                                        acomodacao: produto.acomodacao,
                                        abrangencia: produto.abrangencia,
                                        coparticipacao: produto.coparticipacao,
                                        integracaoDoPlano: produto.integracaoDoPlano,
                                    }
                                )
                                    .then(async produt => {
                                        if (produt) {
                                            let sql1 = 'INSERT INTO `utils_digital_saude_operadora_produto` (`operadora_ID`, `produto_ID`) VALUES (';
                                            db.sequelize.query(`${sql1}${ope.id}, ${produt.id})`, { type: db.sequelize.QueryTypes.INSERT })
                                                .then(async () => { })
                                                .catch(async err => {
                                                    await Produtos.findAll().then(async pro => {
                                                        if (pro) {
                                                            pro.forEach((pro, ipro) => {
                                                                if (ipro === com.length - 1) {
                                                                    Produtos.destroy({
                                                                        where: {
                                                                            id: pro.id
                                                                        },
                                                                    }).then(async dpro => {
                                                                        await Operadoras.findAll().then(async ope => {
                                                                            if (ope) {
                                                                                ope.forEach(async (opd, iop) => {
                                                                                    if (iop === ope.length - 1) {
                                                                                        await Operadoras.destroy({
                                                                                            where: {
                                                                                                id: opd.id
                                                                                            },
                                                                                        }).then(async op => {
                                                                                            res.send({
                                                                                                message: "Operadoras e produtos deletados com sucesso!",
                                                                                                sucesso: true
                                                                                            });
                                                                                        }).catch(err => {
                                                                                            res.status(401).send({
                                                                                                message: err.message,
                                                                                                sucesso: false
                                                                                            });
                                                                                        })
                                                                                    }
                                                                                    else {
                                                                                        Operadoras.destroy({
                                                                                            where: {
                                                                                                id: opd.id
                                                                                            },
                                                                                        })
                                                                                    }
                                                                                })
                                                                            }
                                                                            else {
                                                                                res.send({
                                                                                    message: "Operadoras e produtos deletados com sucesso!",
                                                                                    sucesso: true
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
                                                                    Produtos.destroy({
                                                                        where: {
                                                                            id: pro.id
                                                                        },
                                                                    })
                                                                }
                                                            });
                                                        } else {
                                                            await Operadoras.findAll().then(async ope => {
                                                                if (ope) {
                                                                    ope.forEach(async (oped, iop) => {
                                                                        if (iop === ope.length - 1) {
                                                                            await Operadoras.destroy({
                                                                                where: {
                                                                                    id: oped.id
                                                                                },
                                                                            }).then(async op => {
                                                                                res.send({
                                                                                    message: "Operadoras e produtos deletados com sucesso!",
                                                                                    sucesso: true
                                                                                });
                                                                            }).catch(err => {
                                                                                res.status(401).send({
                                                                                    message: err.message,
                                                                                    sucesso: false
                                                                                });
                                                                            })
                                                                        }
                                                                        else {
                                                                            Operadoras.destroy({
                                                                                where: {
                                                                                    id: oped.id
                                                                                },
                                                                            })
                                                                        }
                                                                    })
                                                                }
                                                                else {
                                                                    res.send({
                                                                        message: "Operadoras e produtos deletados com sucesso!",
                                                                        sucesso: true
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
                                            await Produtos.findAll().then(async pro => {
                                                if (pro) {
                                                    pro.forEach((pro, ipro) => {
                                                        if (ipro === com.length - 1) {
                                                            Produtos.destroy({
                                                                where: {
                                                                    id: pro.id
                                                                },
                                                            }).then(async dpro => {
                                                                await Operadoras.findAll().then(async ope => {
                                                                    if (ope) {
                                                                        ope.forEach(async (opd, iop) => {
                                                                            if (iop === ope.length - 1) {
                                                                                await Operadoras.destroy({
                                                                                    where: {
                                                                                        id: opd.id
                                                                                    },
                                                                                }).then(async op => {
                                                                                    res.send({
                                                                                        message: "Operadoras e produtos deletados com sucesso!",
                                                                                        sucesso: true
                                                                                    });
                                                                                }).catch(err => {
                                                                                    res.status(401).send({
                                                                                        message: err.message,
                                                                                        sucesso: false
                                                                                    });
                                                                                })
                                                                            }
                                                                            else {
                                                                                Operadoras.destroy({
                                                                                    where: {
                                                                                        id: opd.id
                                                                                    },
                                                                                })
                                                                            }
                                                                        })
                                                                    }
                                                                    else {
                                                                        res.send({
                                                                            message: "Operadoras e produtos deletados com sucesso!",
                                                                            sucesso: true
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
                                                            Produtos.destroy({
                                                                where: {
                                                                    id: pro.id
                                                                },
                                                            })
                                                        }
                                                    });
                                                } else {
                                                    await Operadoras.findAll().then(async ope => {
                                                        if (ope) {
                                                            ope.forEach(async (oped, iop) => {
                                                                if (iop === ope.length - 1) {
                                                                    await Operadoras.destroy({
                                                                        where: {
                                                                            id: oped.id
                                                                        },
                                                                    }).then(async op => {
                                                                        res.send({
                                                                            message: "Operadoras e produtos deletados com sucesso!",
                                                                            sucesso: true
                                                                        });
                                                                    }).catch(err => {
                                                                        res.status(401).send({
                                                                            message: err.message,
                                                                            sucesso: false
                                                                        });
                                                                    })
                                                                }
                                                                else {
                                                                    Operadoras.destroy({
                                                                        where: {
                                                                            id: oped.id
                                                                        },
                                                                    })
                                                                }
                                                            })
                                                        }
                                                        else {
                                                            res.send({
                                                                message: "Operadoras e produtos deletados com sucesso!",
                                                                sucesso: true
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
                                        await Produtos.findAll().then(async pro => {
                                            if (pro) {
                                                pro.forEach((pro, ipro) => {
                                                    if (ipro === com.length - 1) {
                                                        Produtos.destroy({
                                                            where: {
                                                                id: pro.id
                                                            },
                                                        }).then(async dpro => {
                                                            await Operadoras.findAll().then(async ope => {
                                                                if (ope) {
                                                                    ope.forEach(async (opd, iop) => {
                                                                        if (iop === ope.length - 1) {
                                                                            await Operadoras.destroy({
                                                                                where: {
                                                                                    id: opd.id
                                                                                },
                                                                            }).then(async op => {
                                                                                res.send({
                                                                                    message: "Operadoras e produtos deletados com sucesso!",
                                                                                    sucesso: true
                                                                                });
                                                                            }).catch(err => {
                                                                                res.status(401).send({
                                                                                    message: err.message,
                                                                                    sucesso: false
                                                                                });
                                                                            })
                                                                        }
                                                                        else {
                                                                            Operadoras.destroy({
                                                                                where: {
                                                                                    id: opd.id
                                                                                },
                                                                            })
                                                                        }
                                                                    })
                                                                }
                                                                else {
                                                                    res.send({
                                                                        message: "Operadoras e produtos deletados com sucesso!",
                                                                        sucesso: true
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
                                                        Produtos.destroy({
                                                            where: {
                                                                id: pro.id
                                                            },
                                                        })
                                                    }
                                                });
                                            } else {
                                                await Operadoras.findAll().then(async ope => {
                                                    if (ope) {
                                                        ope.forEach(async (oped, iop) => {
                                                            if (iop === ope.length - 1) {
                                                                await Operadoras.destroy({
                                                                    where: {
                                                                        id: oped.id
                                                                    },
                                                                }).then(async op => {
                                                                    res.send({
                                                                        message: "Operadoras e produtos deletados com sucesso!",
                                                                        sucesso: true
                                                                    });
                                                                }).catch(err => {
                                                                    res.status(401).send({
                                                                        message: err.message,
                                                                        sucesso: false
                                                                    });
                                                                })
                                                            }
                                                            else {
                                                                Operadoras.destroy({
                                                                    where: {
                                                                        id: oped.id
                                                                    },
                                                                })
                                                            }
                                                        })
                                                    }
                                                    else {
                                                        res.send({
                                                            message: "Operadoras e produtos deletados com sucesso!",
                                                            sucesso: true
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
                        } else {
                            await Produtos.findAll().then(async pro => {
                                if (pro) {
                                    pro.forEach((pro, ipro) => {
                                        if (ipro === com.length - 1) {
                                            Produtos.destroy({
                                                where: {
                                                    id: pro.id
                                                },
                                            }).then(async dpro => {
                                                await Operadoras.findAll().then(async ope => {
                                                    if (ope) {
                                                        ope.forEach(async (opd, iop) => {
                                                            if (iop === ope.length - 1) {
                                                                await Operadoras.destroy({
                                                                    where: {
                                                                        id: opd.id
                                                                    },
                                                                }).then(async op => {
                                                                    res.send({
                                                                        message: "Operadoras e produtos deletados com sucesso!",
                                                                        sucesso: true
                                                                    });
                                                                }).catch(err => {
                                                                    res.status(401).send({
                                                                        message: err.message,
                                                                        sucesso: false
                                                                    });
                                                                })
                                                            }
                                                            else {
                                                                Operadoras.destroy({
                                                                    where: {
                                                                        id: opd.id
                                                                    },
                                                                })
                                                            }
                                                        })
                                                    }
                                                    else {
                                                        res.send({
                                                            message: "Operadoras e produtos deletados com sucesso!",
                                                            sucesso: true
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
                                            Produtos.destroy({
                                                where: {
                                                    id: pro.id
                                                },
                                            })
                                        }
                                    });
                                } else {
                                    await Operadoras.findAll().then(async ope => {
                                        if (ope) {
                                            ope.forEach(async (oped, iop) => {
                                                if (iop === ope.length - 1) {
                                                    await Operadoras.destroy({
                                                        where: {
                                                            id: oped.id
                                                        },
                                                    }).then(async op => {
                                                        res.send({
                                                            message: "Operadoras e produtos deletados com sucesso!",
                                                            sucesso: true
                                                        });
                                                    }).catch(err => {
                                                        res.status(401).send({
                                                            message: err.message,
                                                            sucesso: false
                                                        });
                                                    })
                                                }
                                                else {
                                                    Operadoras.destroy({
                                                        where: {
                                                            id: oped.id
                                                        },
                                                    })
                                                }
                                            })
                                        }
                                        else {
                                            res.send({
                                                message: "Operadoras e produtos deletados com sucesso!",
                                                sucesso: true
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
                        await Produtos.findAll().then(async pro => {
                            if (pro) {
                                pro.forEach((pro, ipro) => {
                                    if (ipro === com.length - 1) {
                                        Produtos.destroy({
                                            where: {
                                                id: pro.id
                                            },
                                        }).then(async dpro => {
                                            await Operadoras.findAll().then(async ope => {
                                                if (ope) {
                                                    ope.forEach(async (opd, iop) => {
                                                        if (iop === ope.length - 1) {
                                                            await Operadoras.destroy({
                                                                where: {
                                                                    id: opd.id
                                                                },
                                                            }).then(async op => {
                                                                res.send({
                                                                    message: "Operadoras e produtos deletados com sucesso!",
                                                                    sucesso: true
                                                                });
                                                            }).catch(err => {
                                                                res.status(401).send({
                                                                    message: err.message,
                                                                    sucesso: false
                                                                });
                                                            })
                                                        }
                                                        else {
                                                            Operadoras.destroy({
                                                                where: {
                                                                    id: opd.id
                                                                },
                                                            })
                                                        }
                                                    })
                                                }
                                                else {
                                                    res.send({
                                                        message: "Operadoras e produtos deletados com sucesso!",
                                                        sucesso: true
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
                                        Produtos.destroy({
                                            where: {
                                                id: pro.id
                                            },
                                        })
                                    }
                                });
                            } else {
                                await Operadoras.findAll().then(async ope => {
                                    if (ope) {
                                        ope.forEach(async (oped, iop) => {
                                            if (iop === ope.length - 1) {
                                                await Operadoras.destroy({
                                                    where: {
                                                        id: oped.id
                                                    },
                                                }).then(async op => {
                                                    res.send({
                                                        message: "Operadoras e produtos deletados com sucesso!",
                                                        sucesso: true
                                                    });
                                                }).catch(err => {
                                                    res.status(401).send({
                                                        message: err.message,
                                                        sucesso: false
                                                    });
                                                })
                                            }
                                            else {
                                                Operadoras.destroy({
                                                    where: {
                                                        id: oped.id
                                                    },
                                                })
                                            }
                                        })
                                    }
                                    else {
                                        res.send({
                                            message: "Operadoras e produtos deletados com sucesso!",
                                            sucesso: true
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
        });
    }
    else {
        res.status(401).send({
            message: "Algo deu errado, tente novamente!",
            sucesso: false
        });
    }
}

ReturnError = async (res, err) => {
    res.status(500).send({
        message: err.message,
        sucesso: false
    });
}

exports.getOperadorasProdutos = (req, res) => {
    Operadoras.findAll(
        {
            order: [
                ['nomeTipo', 'ASC']
            ],
            include: [

                {
                    model: db.utils_digital_saude_produtos,
                }
            ],
        }
    )
        .then(ope => {
            res.send({
                operadoras: ope,
                message: "Essa lista contém as operadoras e produtos cadastrados no sistema!",
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