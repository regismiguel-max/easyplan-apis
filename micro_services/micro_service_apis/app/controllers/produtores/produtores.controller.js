const db = require("../../../../../models");
const Produtor = db.produtores;
const Situacao = db.produtores_situacoes;
const Cidade = db.utils_cidades;
const Estado = db.utils_estados;
const Endereco = db.produtores_enderecos;
const { where, Op } = require("sequelize");
const WhatsApp = require("../whatsapp/whatsapp.controller")

exports.addProdutor = async (req, res) => {
    await Produtor.create({
        cpf: req.body.cpf,
        nome: req.body.nome,
        documento_ID: req.body.documento_ID,
        dados_acesso_ID: req.body.dados_acesso_ID,
        contato_ID: req.body.contato_ID,
        endereco_ID: req.body.endereco_ID,
        situacao_ID: req.body.situacao_ID,
        is_supervisor: req.body.is_supervisor,
    })
        .then(async pro => {
            if (pro) {
                let sql = 'INSERT INTO `produtor_endereco` (`produtor_ID`, `endereco_ID`) VALUES (';
                db.sequelize.query(`${sql}${pro.id}, ${req.body.endereco_ID})`, { type: db.sequelize.QueryTypes.INSERT })
                    .then((end) => {
                        let sql2 = 'INSERT INTO `produtor_contato` (`produtor_ID`, `contato_ID`) VALUES (';
                        db.sequelize.query(`${sql2}${pro.id}, ${req.body.contato_ID})`, { type: db.sequelize.QueryTypes.INSERT })
                            .then((cont) => {
                                let sql3 = 'INSERT INTO `produtor_documento` (`produtor_ID`, `documento_ID`) VALUES (';
                                db.sequelize.query(`${sql3}${pro.id}, ${req.body.documento_ID})`, { type: db.sequelize.QueryTypes.INSERT })
                                    .then((docCo) => {
                                        let sql4 = 'INSERT INTO `produtor_dados_acesso` (`produtor_ID`, `dados_acesso_ID`) VALUES (';
                                        db.sequelize.query(`${sql4}${pro.id}, ${req.body.dados_acesso_ID})`, { type: db.sequelize.QueryTypes.INSERT })
                                            .then((daac) => {
                                                res.send({
                                                    produtor: pro,
                                                    message: "Produtor cadastrado com sucesso!",
                                                    sucesso: true
                                                });
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

exports.updateProdutor = async (req, res) => {
    await Produtor.update(
        {
            documento_ID: req.body.documento_ID,
            dados_acesso_ID: req.body.dados_acesso_ID,
            contato_ID: req.body.contato_ID,
            endereco_ID: req.body.endereco_ID,
            situacao_ID: req.body.situacao_ID,
            is_supervisor: req.body.is_supervisor,
        },
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(async pro => {
            if (pro) {
                if (req.body.situacao_ID === '4' || req.body.situacao_ID === 4) {
                    Produtor.findByPk(
                        req.params.id,
                        {
                            include: [
                                {
                                    model: db.produtores_contatos,
                                }
                            ],
                        }
                    )
                        .then(prod => {
                            WhatsApp.sendMessageSituacaoProdutor(
                                {
                                    whatsapp: `${prod.produtores_contatos[0].whatsapp}`,
                                    message: `Olá ${prod.nome}, 
                                    
Gostaríamos de informar que os documentos enviados para análise pela *EasyPlan* foram processados com sucesso e agora estão com o status de *concluído*.

Para acessar sua conta, por favor, acesse o aplicativo *EasyPlan Corretor* ou clique no link abaixo para fazer o login:

*https://corretor.easyplan.com.br/*

_Caso não consiga clicar no link, adicione-nos à sua lista de contatos. Isso permitirá que você clique nos links de nossas mensagens_

Agradecemos por escolher a *EasyPlan* e estamos aqui para ajudar em qualquer etapa do processo.

Atenciosamente,
Equipe *EasyPlan*

_Esta é uma mensagem automática. Favor não responder._`,
                                },
                                res,
                                prod
                            );
                        })
                        .catch(err => {
                            res.status(500).send({
                                message: err.message,
                                sucesso: false
                            })
                        })
                }
                else {
                    res.send({
                        produtor: pro,
                        message: "Produtor atualizada com sucesso!",
                        sucesso: true
                    });
                }
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
    Produtor.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ],
            include: [
                {
                    model: db.produtores_contatos,
                },
                {
                    model: db.produtores_documentos,
                },
                {
                    model: db.produtores_enderecos,
                }
            ],
        }
    )
        .then(pro => {
            res.send({
                produtores: pro,
                message: "Essa lista contém os produtores cadastrados no sistema!",
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

exports.findAllProdutorEndereco = (req, res) => {
    Produtor.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ],
            include: [
                {
                    model: db.produtores_enderecos,
                },
            ],
        }
    )
        .then(pro => {
            const produtores = []
            pro.forEach((element, index) => {
                if (index === pro.length - 1) {
                    Cidade.findOne(
                        {
                            where: {
                                cidadeID: element.produtores_enderecos[0].cidade_ID,
                            },
                        }
                    )
                        .then(ci => {
                            Estado.findOne(
                                {
                                    where: {
                                        estadoID: element.produtores_enderecos[0].estado_ID,
                                    },
                                }
                            )
                                .then(st => {
                                    if (req.body.estadoID) {
                                        if (Number(req.body.estadoID) === Number(st.estadoID)) {
                                            produtores.push({
                                                id: element.id,
                                                cpf: element.cpf,
                                                nome: element.nome,
                                                createdAt: element.createdAt,
                                                updatedAt: element.updatedAt,
                                                produtor_endereco: {
                                                    id: element.produtores_enderecos[0].id,
                                                    cep: element.produtores_enderecos[0].cep,
                                                    bairro: element.produtores_enderecos[0].bairro,
                                                    rua: element.produtores_enderecos[0].rua,
                                                    numero: element.produtores_enderecos[0].numero,
                                                    complemento: element.produtores_enderecos[0].complemento,
                                                    cidade: {
                                                        cidadeID: ci.cidadeID,
                                                        cidadeNome: ci.cidadeNome,
                                                    },
                                                    estado: {
                                                        estadoID: st.estadoID,
                                                        estadoNome: st.estadoNome,
                                                    }

                                                },
                                            })
                                        }
                                        res.send({
                                            produtores: produtores,
                                            message: "Essa lista contém os produtores cadastrados no sistema!",
                                            sucesso: true
                                        });
                                    }
                                    else {
                                        produtores.push({
                                            id: element.id,
                                            cpf: element.cpf,
                                            nome: element.nome,
                                            createdAt: element.createdAt,
                                            updatedAt: element.updatedAt,
                                            produtor_endereco: {
                                                id: element.produtores_enderecos[0].id,
                                                cep: element.produtores_enderecos[0].cep,
                                                bairro: element.produtores_enderecos[0].bairro,
                                                rua: element.produtores_enderecos[0].rua,
                                                numero: element.produtores_enderecos[0].numero,
                                                complemento: element.produtores_enderecos[0].complemento,
                                                cidade: {
                                                    cidadeID: ci.cidadeID,
                                                    cidadeNome: ci.cidadeNome,
                                                },
                                                estado: {
                                                    estadoID: st.estadoID,
                                                    estadoNome: st.estadoNome,
                                                }

                                            },
                                        })
                                        res.send({
                                            produtores: produtores,
                                            message: "Essa lista contém os produtores cadastrados no sistema!",
                                            sucesso: true
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
                    Cidade.findOne(
                        {
                            where: {
                                cidadeID: element.produtores_enderecos[0].cidade_ID,
                            },
                        }
                    )
                        .then(ci => {
                            Estado.findOne(
                                {
                                    where: {
                                        estadoID: element.produtores_enderecos[0].estado_ID,
                                    },
                                }
                            )
                                .then(st => {
                                    if (req.body.estadoID) {
                                        if (Number(req.body.estadoID) === Number(st.estadoID)) {
                                            produtores.push({
                                                id: element.id,
                                                cpf: element.cpf,
                                                nome: element.nome,
                                                createdAt: element.createdAt,
                                                updatedAt: element.updatedAt,
                                                produtor_endereco: {
                                                    id: element.produtores_enderecos[0].id,
                                                    cep: element.produtores_enderecos[0].cep,
                                                    bairro: element.produtores_enderecos[0].bairro,
                                                    rua: element.produtores_enderecos[0].rua,
                                                    numero: element.produtores_enderecos[0].numero,
                                                    complemento: element.produtores_enderecos[0].complemento,
                                                    cidade: {
                                                        cidadeID: ci.cidadeID,
                                                        cidadeNome: ci.cidadeNome,
                                                    },
                                                    estado: {
                                                        estadoID: st.estadoID,
                                                        estadoNome: st.estadoNome,
                                                    }

                                                },
                                            })
                                        }
                                    }
                                    else {
                                        produtores.push({
                                            id: element.id,
                                            cpf: element.cpf,
                                            nome: element.nome,
                                            createdAt: element.createdAt,
                                            updatedAt: element.updatedAt,
                                            produtor_endereco: {
                                                id: element.produtores_enderecos[0].id,
                                                cep: element.produtores_enderecos[0].cep,
                                                bairro: element.produtores_enderecos[0].bairro,
                                                rua: element.produtores_enderecos[0].rua,
                                                numero: element.produtores_enderecos[0].numero,
                                                complemento: element.produtores_enderecos[0].complemento,
                                                cidade: {
                                                    cidadeID: ci.cidadeID,
                                                    cidadeNome: ci.cidadeNome,
                                                },
                                                estado: {
                                                    estadoID: st.estadoID,
                                                    estadoNome: st.estadoNome,
                                                }

                                            },
                                        })
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
            });
        })
        .catch(err => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            })
        })
};

exports.findProdutor = (req, res) => {
    Produtor.findByPk(
        req.params.id,
        {
            include: [
                {
                    model: db.produtores_contatos,
                },
                {
                    model: db.produtores_documentos,
                },
                {
                    model: db.produtores_enderecos,
                },
            ],
        }
    )
        .then(pro => {
            let cidade = null;
            let estado = null;
            Cidade.findOne(
                {
                    where: {
                        cidadeID: pro.produtores_enderecos[0].cidade_ID,
                    },
                }
            )
                .then(ci => {
                    cidade = ci;
                    Estado.findOne(
                        {
                            where: {
                                estadoID: pro.produtores_enderecos[0].estado_ID,
                            },
                        }
                    )
                        .then(st => {
                            estado = st;
                            Situacao.findOne(
                                {
                                    where: {
                                        id: pro.situacao_ID
                                    },
                                }
                            )
                                .then(si => {
                                    res.status(200).send({
                                        produtor: {
                                            dados: pro,
                                            cidade: cidade,
                                            estado: estado,
                                            situacao: si,
                                        },
                                        message: 'Essa lista contém o produtor cadastrados no sistema!',
                                        sucesso: true
                                    });
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
            })
        })
};

exports.findProdutoresSearch = (req, res) => {
    const where = {};
    if (req.body.status) { where.situacao_ID = req.body.status; };
    if (req.body.dataInicio) {
        where.createdAt = {
            [Op.between]: [req.body.dataInicio, req.body.dataFim],
        };
    };
    Produtor.findAll(
        {
            where,
            include: [
                {
                    model: db.produtores_contatos,
                },
                {
                    model: db.produtores_documentos,
                },
                {
                    model: db.produtores_enderecos,
                }
            ],
        })
        .then(pro => {
            res.send({
                produtores: pro,
                message: "Essa lista contém os produtores cadastrados no sistema!",
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

exports.findProdutoresEstados = (req, res) => {
    Endereco.findAll(
        {
            where: {
                estado_ID: req.body.estadoID,
            },
            order: [
                ['createdAt', 'DESC']
            ],
        }
    )
        .then(pro => {
            if (pro) {
                const produtor = [];
                if (pro.length > 0) {
                    pro.forEach((element, index) => {
                        console.log(index + " === " + pro.length - 1)
                        if (index === pro.length - 1) {
                            Produtor.findAll(
                                {
                                    where: {
                                        endereco_ID: element.id,
                                    },
                                    include: [
                                        {
                                            model: db.produtores_contatos,
                                        },
                                        {
                                            model: db.produtores_documentos,
                                        },
                                        {
                                            model: db.produtores_enderecos,
                                        }
                                    ],
                                })
                                .then(prod => {
                                    if (prod.length > 0) {
                                        prod.forEach(async (el, i) => {
                                            if (prod.length - 1 === i) {
                                                const query = await el.nome.toLowerCase();
                                                const validprodutor = await produtor.filter((b) => (b.nome.toLowerCase().indexOf(query) > -1));
                                                if (validprodutor.length === 0) {
                                                    produtor.push(el);
                                                }
                                                res.send({
                                                    produtores: produtor,
                                                    message: "Essa lista contém os produtores cadastrados no sistema!",
                                                    sucesso: true
                                                });
                                            }
                                            else {
                                                const query = await el.nome.toLowerCase();
                                                const validprodutor = await produtor.filter((b) => (b.nome.toLowerCase().indexOf(query) > -1));
                                                if (validprodutor.length === 0) {
                                                    produtor.push(el);
                                                }
                                            }
                                        });
                                    }
                                    else {
                                        res.send({
                                            produtores: produtor,
                                            message: "Essa lista contém os produtores cadastrados no sistema!",
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
                        }
                        else {
                            Produtor.findAll(
                                {
                                    where: {
                                        endereco_ID: element.id,
                                    },
                                    include: [
                                        {
                                            model: db.produtores_contatos,
                                        },
                                        {
                                            model: db.produtores_documentos,
                                        },
                                        {
                                            model: db.produtores_enderecos,
                                        }
                                    ],
                                })
                                .then(prod => {
                                    prod.forEach(async (el, i) => {
                                        const query = await el.nome.toLowerCase();
                                        const validprodutor = await produtor.filter((b) => (b.nome.toLowerCase().indexOf(query) > -1));
                                        if (validprodutor.length === 0) {
                                            produtor.push(el);
                                        }
                                    })
                                })
                                .catch(err => {
                                    res.status(500).send({
                                        message: err.message,
                                        sucesso: false
                                    })
                                })
                        }

                    });
                }
                else {
                    res.send({
                        produtores: [],
                        message: "Essa lista contém os produtores cadastrados no sistema!",
                        sucesso: true
                    });
                }
            }
            else {
                res.send({
                    produtores: [],
                    message: "Essa lista contém os produtores cadastrados no sistema!",
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

exports.deleteProdutor = async (req, res) => {
    await Produtor.destroy({
        where: {
            id: req.params.id
        },
    }).then(pro => {
        res.send({
            message: "Produtor deletado com sucesso!",
            sucesso: true
        });
    }).catch(err => {
        res.status(401).send({
            message: err.message,
            sucesso: false
        });
    })
};