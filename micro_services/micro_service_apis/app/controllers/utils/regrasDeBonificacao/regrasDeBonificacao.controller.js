const db = require("../../../../../../models");
const Estado = db.utils_regras_de_bonificacao_estados;
const Operadora = db.utils_regras_de_bonificacao_operadoras;
const Produto = db.utils_regras_de_bonificacao_produtos;

const { where, Op } = require("sequelize");

exports.addRegraDeBonificacao = async (req, res) => {
    const state = req.body.state;
    const operator = req.body.operadora;
    const product = req.body.produto;
    let sql_estado_operadora = 'INSERT INTO `utils_regras_de_bonificacao_estado_operadora` (`estado_ID`, `operadora_ID`) VALUES (';
    let sql_operadora_produto = 'INSERT INTO `utils_regras_de_bonificacao_operadora_produto` (`operadora_ID`, `produto_ID`) VALUES (';

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
                    await Produto.create({
                        produtoID: product.codigo === 0 ? `${operator.codigo}00PROD` : product.codigo,
                        nome: product.codigo === 0 ? '-' : product.nome,
                        idade: product.idade,
                        valorPorVida: product.valorporvida,
                        dataInicio: product.dataInicio,
                        dataFim: product.dataFim,
                        status: true,
                        operadoraID: operator.codigo,
                        estadoID: state.estadoID,
                    })
                        .then(async pro => {
                            if (pro) {
                                db.sequelize.query(`${sql_operadora_produto}${ope.id}, ${pro.id})`, { type: db.sequelize.QueryTypes.INSERT })
                                    .then(async (end) => {
                                        res.send({
                                            message: "Produto cadastrado com sucesso!",
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
                                        await Produto.create({
                                            produtoID: product.codigo === 0 ? `${operator.codigo}00PROD` : product.codigo,
                                            nome: product.codigo === 0 ? '-' : product.nome,
                                            idade: product.idade,
                                            valorPorVida: product.valorporvida,
                                            dataInicio: product.dataInicio,
                                            dataFim: product.dataFim,
                                            status: true,
                                            operadoraID: operator.codigo,
                                            estadoID: state.estadoID,
                                        })
                                            .then(async pro => {
                                                if (pro) {
                                                    db.sequelize.query(`${sql_operadora_produto}${ope.id}, ${pro.id})`, { type: db.sequelize.QueryTypes.INSERT })
                                                        .then(async (end) => {
                                                            res.send({
                                                                message: "Produto cadastrado com sucesso!",
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
                                            await Produto.create({
                                                produtoID: product.codigo === 0 ? `${operator.codigo}00PROD` : product.codigo,
                                                nome: product.codigo === 0 ? '-' : product.nome,
                                                idade: product.idade,
                                                valorPorVida: product.valorporvida,
                                                dataInicio: product.dataInicio,
                                                dataFim: product.dataFim,
                                                status: true,
                                                operadoraID: operator.codigo,
                                                estadoID: state.estadoID,
                                            })
                                                .then(async pro => {
                                                    if (pro) {
                                                        db.sequelize.query(`${sql_operadora_produto}${ope.id}, ${pro.id})`, { type: db.sequelize.QueryTypes.INSERT })
                                                            .then(async (end) => {
                                                                res.send({
                                                                    message: "Produto cadastrado com sucesso!",
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

exports.getRegrasDeBonificacao = async (req, res) => {
    Estado.findAll(
            {
                order: [
                    ['createdAt', 'DESC']
                ],
                include: [
                    {
                        model: db.utils_regras_de_bonificacao_operadoras,
                        include: [
                            {
                                model: db.utils_regras_de_bonificacao_produtos,
                            }
                        ]
                    }
                ],
            }
        )
            .then(co => {
                res.send({
                    regrasdebonificacoes: co,
                    message: "Essa lista contém as regras de bonificações cadastradas no sistema!",
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
