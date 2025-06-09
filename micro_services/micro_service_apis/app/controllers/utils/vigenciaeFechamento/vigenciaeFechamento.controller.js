const db = require("../../../../../../models");
const Estado = db.utils_vigencia_e_fechamento_estados;
const Operadora = db.utils_vigencia_e_fechamento_operadoras;
const Data = db.utils_vigencia_e_fechamento_datas;

const { where, Op } = require("sequelize");

exports.addVigenciaEFechamento = async (req, res) => {
    const state = req.body.state;
    const operator = req.body.operadora;
    const data = req.body.data;
    let sql_estado_operadora = 'INSERT INTO `utils_vigencia_e_fechamento_estado_operadora` (`estado_ID`, `operadora_ID`) VALUES (';
    let sql_operadora_data = 'INSERT INTO `utils_vigencia_e_fechamento_operadora_data` (`operadora_ID`, `data_ID`) VALUES (';

    Estado.findOne({
        where: {
            estadoID: state.estadoID
        }
    }).then(async sta => {
        if (sta) {
            Operadora.findOne({
                where: {
                    estadoID: state.estadoID,
                    operadoraID: operator.codigo
                }
            }).then(async ope => {
                if (ope) {
                    await Data.create({
                        dataVigencia: data.dataVigencia,
                        dataHoraFechamento: data.dataHoraFechamento,
                        dataVencimento: data.dataVencimento,
                        dataInicio: data.dataInicio,
                        dataFim: data.dataFim,
                        status: true,
                        operadoraID: operator.codigo,
                        estadoID: state.estadoID,
                    })
                        .then(async dat => {
                            if (dat) {
                                db.sequelize.query(`${sql_operadora_data}${ope.id}, ${dat.id})`, { type: db.sequelize.QueryTypes.INSERT })
                                    .then(async (end) => {
                                        res.send({
                                            message: "Data cadastrada com sucesso!",
                                            sucesso: true
                                        });
                                    })
                                    .catch(err => {
                                        res.status(500).send({
                                            message: err.message,
                                            sucesso: false
                                        });
                                    });
                            }
                            else {
                                res.status(401).send({
                                    message: 'Algo deu errado. Tente novamente',
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
                    await Operadora.create({
                        operadoraID: operator.codigo,
                        nomeFantasia: operator.nomeTipo,
                        razaoSocial: operator.nome,
                        estadoID: state.estadoID,
                    })
                        .then(async ope => {
                            if (ope) {
                                db.sequelize.query(`${sql_estado_operadora}${sta.id}, ${ope.id})`, { type: db.sequelize.QueryTypes.INSERT })
                                    .then(async (end) => {
                                        await Data.create({
                                            dataVigencia: data.dataVigencia,
                                            dataHoraFechamento: data.dataHoraFechamento,
                                            dataVencimento: data.dataVencimento,
                                            dataInicio: data.dataInicio,
                                            dataFim: data.dataFim,
                                            status: true,
                                            operadoraID: operator.codigo,
                                            estadoID: state.estadoID,
                                        })
                                            .then(async dat => {
                                                if (dat) {
                                                    db.sequelize.query(`${sql_operadora_data}${ope.id}, ${dat.id})`, { type: db.sequelize.QueryTypes.INSERT })
                                                        .then(async (end) => {
                                                            res.send({
                                                                message: "Data cadastrada com sucesso!",
                                                                sucesso: true
                                                            });
                                                        })
                                                        .catch(err => {
                                                            res.status(500).send({
                                                                message: err.message,
                                                                sucesso: false
                                                            });
                                                        });
                                                }
                                                else {
                                                    res.status(401).send({
                                                        message: 'Algo deu errado. Tente novamente',
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
                                    })
                                    .catch(err => {
                                        res.status(500).send({
                                            message: err.message,
                                            sucesso: false
                                        });
                                    });
                            }
                            else {
                                res.status(401).send({
                                    message: 'Algo deu errado. Tente novamente',
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
            }).catch(err => {
                res.status(401).send({
                    message: err.message,
                    sucesso: false
                });
            });
        }
        else {
            await Estado.create({
                estadoID: state.estadoID,
                estadoNome: state.estadoNome,
                estadoUF: state.estadoUF
            })
                .then(async st => {
                    if (st) {
                        await Operadora.create({
                            operadoraID: operator.codigo,
                            nomeFantasia: operator.nomeTipo,
                            razaoSocial: operator.nome,
                            estadoID: state.estadoID,
                        })
                            .then(async ope => {
                                if (ope) {
                                    db.sequelize.query(`${sql_estado_operadora}${st.id}, ${ope.id})`, { type: db.sequelize.QueryTypes.INSERT })
                                        .then(async (end) => {
                                            await Data.create({
                                                dataVigencia: data.dataVigencia,
                                                dataHoraFechamento: data.dataHoraFechamento,
                                                dataVencimento: data.dataVencimento,
                                                dataInicio: data.dataInicio,
                                                dataFim: data.dataFim,
                                                status: true,
                                                operadoraID: operator.codigo,
                                                estadoID: state.estadoID,
                                            })
                                                .then(async dat => {
                                                    if (dat) {
                                                        db.sequelize.query(`${sql_operadora_data}${ope.id}, ${dat.id})`, { type: db.sequelize.QueryTypes.INSERT })
                                                            .then(async (end) => {
                                                                res.send({
                                                                    message: "Data cadastrada com sucesso!",
                                                                    sucesso: true
                                                                });
                                                            })
                                                            .catch(err => {
                                                                res.status(500).send({
                                                                    message: err.message,
                                                                    sucesso: false
                                                                });
                                                            });
                                                    }
                                                    else {
                                                        res.status(401).send({
                                                            message: 'Algo deu errado. Tente novamente',
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
                                        })
                                        .catch(err => {
                                            res.status(500).send({
                                                message: err.message,
                                                sucesso: false
                                            });
                                        });
                                }
                                else {
                                    res.status(401).send({
                                        message: 'Algo deu errado. Tente novamente',
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
                        res.status(401).send({
                            message: 'Algo deu errado. Tente novamente',
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
    }).catch(err => {
        res.status(401).send({
            message: err.message,
            sucesso: false
        });
    });
};

exports.getVigenciaEFechamento = async (req, res) => {
    Estado.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ],
            include: [
                {
                    model: db.utils_vigencia_e_fechamento_operadoras,
                    include: [
                        {
                            model: db.utils_vigencia_e_fechamento_datas,
                        }
                    ]
                }
            ],
        }
    )
        .then(vef => {
            res.send({
                vigenciasefechamentos: vef,
                message: "Essa lista contém as vigências e fechamentos cadastradas no sistema!",
                sucesso: true
            });
        })
        .catch(err => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            })
        })
}
