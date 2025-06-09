const db = require("../../../../../models");
const Corretora = db.corretoras;
const Situacao = db.corretoras_situacoes;
const Cidade = db.utils_cidades;
const Estado = db.utils_estados;
const Endereco = db.corretoras_enderecos;
const { where, Op } = require("sequelize");
const WhatsApp = require("../whatsapp/whatsapp.controller")

exports.addCorretora = async (req, res) => {
    await Corretora.create({
        cnpj: req.body.cnpj,
        razao_social: req.body.razao_social,
        contrato_social_ID: req.body.contrato_social_ID,
        dados_acesso_ID: req.body.dados_acesso_ID,
        responsavel_ID: req.body.responsavel_ID,
        contato_ID: req.body.contato_ID,
        endereco_ID: req.body.endereco_ID,
        supervisor_ID: req.body.supervisor_ID,
        dados_bancarios_ID: req.body.dados_bancarios_ID,
        situacao_ID: req.body.situacao_ID,
        categoria_ID: req.body.categoria_ID,
        pertence_corretora_ID: req.body.pertence_corretora_ID,
        contrato_ID: req.body.contrato_ID,
        contrato_URL: req.body.contrato_URL,
    })
        .then(async co => {
            if (co) {
                let sql = 'INSERT INTO `corretora_endereco` (`corretora_ID`, `endereco_ID`) VALUES (';
                db.sequelize.query(`${sql}${co.id}, ${req.body.endereco_ID})`, { type: db.sequelize.QueryTypes.INSERT })
                    .then((end) => {
                        let sql2 = 'INSERT INTO `corretora_contato` (`corretora_ID`, `contato_ID`) VALUES (';
                        db.sequelize.query(`${sql2}${co.id}, ${req.body.contato_ID})`, { type: db.sequelize.QueryTypes.INSERT })
                            .then((cont) => {
                                let sql3 = 'INSERT INTO `corretora_documento` (`corretora_ID`, `documento_ID`) VALUES (';
                                db.sequelize.query(`${sql3}${co.id}, ${req.body.contrato_social_ID})`, { type: db.sequelize.QueryTypes.INSERT })
                                    .then((docCo) => {
                                        let sql4 = 'INSERT INTO `corretora_dados_acesso` (`corretora_ID`, `dados_acesso_ID`) VALUES (';
                                        db.sequelize.query(`${sql4}${co.id}, ${req.body.dados_acesso_ID})`, { type: db.sequelize.QueryTypes.INSERT })
                                            .then((daac) => {
                                                let sql5 = 'INSERT INTO `corretora_dados_bancario` (`corretora_ID`, `dados_bancario_ID`) VALUES (';
                                                db.sequelize.query(`${sql5}${co.id}, ${req.body.dados_bancarios_ID})`, { type: db.sequelize.QueryTypes.INSERT })
                                                    .then((daba) => {
                                                        let sql6 = 'INSERT INTO `corretora_responsavel` (`corretora_ID`, `responsavel_ID`) VALUES (';
                                                        db.sequelize.query(`${sql6}${co.id}, ${req.body.responsavel_ID})`, { type: db.sequelize.QueryTypes.INSERT })
                                                            .then((resp) => {
                                                                res.send({
                                                                    corretora: co,
                                                                    message: "Corretora cadastrada com sucesso!",
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

exports.updateCorretora = async (req, res) => {
    await Corretora.update(
        {
            contrato_social_ID: req.body.contrato_social_ID,
            dados_acesso_ID: req.body.dados_acesso_ID,
            responsavel_ID: req.body.responsavel_ID,
            contato_ID: req.body.contato_ID,
            endereco_ID: req.body.endereco_ID,
            supervisor_ID: req.body.supervisor_ID,
            dados_bancarios_ID: req.body.dados_bancarios_ID,
            situacao_ID: req.body.situacao_ID,
            categoria_ID: req.body.categoria_ID,
            pertence_corretora_ID: req.body.pertence_corretora_ID,
            contrato_ID: req.body.contrato_ID,
            contrato_URL: req.body.contrato_URL,
            termo_aditivo: req.body.termo_aditivo,
            termo_aditivo_ID: req.body.termo_aditivo_ID,
            termo_aditivo_URL: req.body.termo_aditivo_URL,
        },
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(async co => {
            if (co) {
                if (req.body.situacao_ID === '4' || req.body.situacao_ID === 4) {
                    Corretora.findByPk(
                        req.params.id,
                        {
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
                        .then(cor => {
                            WhatsApp.sendMessageSituacao(
                                {
                                    whatsapp: `${cor.corretoras_contatos[0].whatsapp}`,
                                    message: `Olá ${cor.corretoras_responsavels[0].nome}, 
                                    
Gostaríamos de informar que os documentos enviados para análise pela *EasyPlan* foram processados com sucesso e agora estão com o status de *concluído*.

Para prosseguir com o seu cadastro, por favor, acesse o aplicativo *EasyPlan Corretor* ou clique no link abaixo para fazer o login e concluir o processo:

*https://corretor.easyplan.com.br/*

_Caso não consiga clicar no link, adicione-nos à sua lista de contatos. Isso permitirá que você clique nos links de nossas mensagens_

Agradecemos por escolher a *EasyPlan* e estamos aqui para ajudar em qualquer etapa do processo.

Atenciosamente,
Equipe *EasyPlan*

_Esta é uma mensagem automática. Favor não responder._`,
                                },
                                res,
                                cor
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
                        corretora: co,
                        message: "Corretora atualizada com sucesso!",
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
    Corretora.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ],
            include: [

                {
                    model: db.corretoras_categorias,
                },
                {
                    model: db.corretoras_contatos,
                },
                {
                    model: db.corretoras_dados_bancarios,
                },
                {
                    model: db.corretoras_documentos,
                },
                {
                    model: db.corretoras_enderecos,
                },
                {
                    model: db.corretoras_responsavels,
                    include: [
                        {
                            model: db.corretoras_responsavels_documentos,
                        }
                    ]
                },
                {
                    model: db.corretoras_supervisors,
                },
            ],
        }
    )
        .then(co => {
            res.send({
                corretoras: co,
                message: "Essa lista contém as corretoras cadastradas no sistema!",
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

exports.findAllCorretoraEndereco = (req, res) => {
    Corretora.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ],
            include: [
                {
                    model: db.corretoras_enderecos,
                },
            ],
        }
    )
        .then(co => {
            const corretoras = []
            co.forEach((element, index) => {
                if (index === co.length - 1) {
                    Cidade.findOne(
                        {
                            where: {
                                cidadeID: element.corretoras_enderecos[0].cidade_ID,
                            },
                        }
                    )
                        .then(ci => {
                            Estado.findOne(
                                {
                                    where: {
                                        estadoID: element.corretoras_enderecos[0].estado_ID,
                                    },
                                }
                            )
                                .then(st => {
                                    if (req.body.estadoID) {
                                        if (Number(req.body.estadoID) === Number(st.estadoID)) {
                                            corretoras.push({
                                                id: element.id,
                                                cnpj: element.cnpj,
                                                razao_social: element.razao_social,
                                                createdAt: element.createdAt,
                                                updatedAt: element.updatedAt,
                                                corretora_endereco: {
                                                    id: element.corretoras_enderecos[0].id,
                                                    cep: element.corretoras_enderecos[0].cep,
                                                    bairro: element.corretoras_enderecos[0].bairro,
                                                    rua: element.corretoras_enderecos[0].rua,
                                                    numero: element.corretoras_enderecos[0].numero,
                                                    complemento: element.corretoras_enderecos[0].complemento,
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
                                            corretoras: corretoras,
                                            message: "Essa lista contém as corretoras cadastradas no sistema!",
                                            sucesso: true
                                        });
                                    }
                                    else {
                                        corretoras.push({
                                            id: element.id,
                                            cnpj: element.cnpj,
                                            razao_social: element.razao_social,
                                            createdAt: element.createdAt,
                                            updatedAt: element.updatedAt,
                                            corretora_endereco: {
                                                id: element.corretoras_enderecos[0].id,
                                                cep: element.corretoras_enderecos[0].cep,
                                                bairro: element.corretoras_enderecos[0].bairro,
                                                rua: element.corretoras_enderecos[0].rua,
                                                numero: element.corretoras_enderecos[0].numero,
                                                complemento: element.corretoras_enderecos[0].complemento,
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
                                            corretoras: corretoras,
                                            message: "Essa lista contém as corretoras cadastradas no sistema!",
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
                                cidadeID: element.corretoras_enderecos[0].cidade_ID,
                            },
                        }
                    )
                        .then(ci => {
                            Estado.findOne(
                                {
                                    where: {
                                        estadoID: element.corretoras_enderecos[0].estado_ID,
                                    },
                                }
                            )
                                .then(st => {
                                    if (req.body.estadoID) {
                                        if (Number(req.body.estadoID) === Number(st.estadoID)) {
                                            corretoras.push({
                                                id: element.id,
                                                cnpj: element.cnpj,
                                                razao_social: element.razao_social,
                                                createdAt: element.createdAt,
                                                updatedAt: element.updatedAt,
                                                corretora_endereco: {
                                                    id: element.corretoras_enderecos[0].id,
                                                    estado_ID: element.corretoras_enderecos[0].estado_ID,
                                                    cidade_ID: element.corretoras_enderecos[0].cidade_ID,
                                                    cep: element.corretoras_enderecos[0].cep,
                                                    bairro: element.corretoras_enderecos[0].bairro,
                                                    rua: element.corretoras_enderecos[0].rua,
                                                    numero: element.corretoras_enderecos[0].numero,
                                                    complemento: element.corretoras_enderecos[0].complemento,
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
                                        corretoras.push({
                                            id: element.id,
                                            cnpj: element.cnpj,
                                            razao_social: element.razao_social,
                                            createdAt: element.createdAt,
                                            updatedAt: element.updatedAt,
                                            corretora_endereco: {
                                                id: element.corretoras_enderecos[0].id,
                                                estado_ID: element.corretoras_enderecos[0].estado_ID,
                                                cidade_ID: element.corretoras_enderecos[0].cidade_ID,
                                                cep: element.corretoras_enderecos[0].cep,
                                                bairro: element.corretoras_enderecos[0].bairro,
                                                rua: element.corretoras_enderecos[0].rua,
                                                numero: element.corretoras_enderecos[0].numero,
                                                complemento: element.corretoras_enderecos[0].complemento,
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

exports.findCorretora = (req, res) => {
    Corretora.findByPk(
        req.params.id,
        {
            include: [
                {
                    model: db.corretoras_categorias,
                },
                {
                    model: db.corretoras_contatos,
                },
                {
                    model: db.corretoras_dados_bancarios,
                },
                {
                    model: db.corretoras_documentos,
                },
                {
                    model: db.corretoras_enderecos,
                },
                {
                    model: db.corretoras_responsavels,
                    include: [
                        {
                            model: db.corretoras_responsavels_documentos,
                        }
                    ]
                },
                {
                    model: db.corretoras_supervisors,
                },
            ],
        }
    )
        .then(co => {
            let cidade = null;
            let estado = null;
            Cidade.findOne(
                {
                    where: {
                        cidadeID: co.corretoras_enderecos[0].cidade_ID,
                    },
                }
            )
                .then(ci => {
                    cidade = ci;
                    Estado.findOne(
                        {
                            where: {
                                estadoID: co.corretoras_enderecos[0].estado_ID,
                            },
                        }
                    )
                        .then(st => {
                            estado = st;
                            Situacao.findOne(
                                {
                                    where: {
                                        id: co.situacao_ID
                                    },
                                }
                            )
                                .then(si => {
                                    res.status(200).send({
                                        corretora: {
                                            dados: co,
                                            cidade: cidade,
                                            estado: estado,
                                            situacao: si,
                                        },
                                        message: 'Essa lista contém a corretora cadastradas no sistema!',
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

exports.findCorretorasSearch = (req, res) => {
    const where = {};
    if (req.body.status) { where.situacao_ID = req.body.status; };
    if (req.body.dataInicio) {
        where.createdAt = {
            [Op.between]: [req.body.dataInicio, req.body.dataFim],
        };
    };
    Corretora.findAll(
        {
            where,
            include: [
                {
                    model: db.corretoras_categorias,
                },
                {
                    model: db.corretoras_contatos,
                },
                {
                    model: db.corretoras_dados_bancarios,
                },
                {
                    model: db.corretoras_documentos,
                },
                {
                    model: db.corretoras_enderecos,
                },
                {
                    model: db.corretoras_responsavels,
                    include: [
                        {
                            model: db.corretoras_responsavels_documentos,
                        }
                    ]
                },
                {
                    model: db.corretoras_supervisors,
                },
            ],
        })
        .then(co => {
            res.send({
                corretoras: co,
                message: "Essa lista contém as corretoras cadastradas no sistema!",
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

exports.findCorretorasEstados = (req, res) => {
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
        .then(co => {
            if (co) {
                const corretora = [];
                if (co.length > 0) {
                    co.forEach((element, index) => {
                        console.log(index + " === " + co.length - 1)
                        if (index === co.length - 1) {
                            Corretora.findAll(
                                {
                                    where: {
                                        endereco_ID: element.id,
                                    },
                                    include: [
                                        {
                                            model: db.corretoras_categorias,
                                        },
                                        {
                                            model: db.corretoras_contatos,
                                        },
                                        {
                                            model: db.corretoras_dados_bancarios,
                                        },
                                        {
                                            model: db.corretoras_documentos,
                                        },
                                        {
                                            model: db.corretoras_enderecos,
                                        },
                                        {
                                            model: db.corretoras_responsavels,
                                            include: [
                                                {
                                                    model: db.corretoras_responsavels_documentos,
                                                }
                                            ]
                                        },
                                        {
                                            model: db.corretoras_supervisors,
                                        },
                                    ],
                                })
                                .then(cor => {
                                    if (cor.length > 0) {
                                        cor.forEach(async (el, i) => {
                                            if (cor.length - 1 === i) {
                                                const query = await el.razao_social.toLowerCase();
                                                const validcorretora = await corretora.filter((b) => (b.razao_social.toLowerCase().indexOf(query) > -1));
                                                if (validcorretora.length === 0) {
                                                    corretora.push(el);
                                                }
                                                res.send({
                                                    corretoras: corretora,
                                                    message: "Essa lista contém as corretoras cadastradas no sistema!",
                                                    sucesso: true
                                                });
                                            }
                                            else {
                                                const query = await el.razao_social.toLowerCase();
                                                const validcorretora = await corretora.filter((b) => (b.razao_social.toLowerCase().indexOf(query) > -1));
                                                if (validcorretora.length === 0) {
                                                    corretora.push(el);
                                                }
                                            }
                                        });
                                    }
                                    else {
                                        res.send({
                                            corretoras: corretora,
                                            message: "Essa lista contém as corretoras cadastradas no sistema!",
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
                            Corretora.findAll(
                                {
                                    where: {
                                        endereco_ID: element.id,
                                    },
                                    include: [
                                        {
                                            model: db.corretoras_categorias,
                                        },
                                        {
                                            model: db.corretoras_contatos,
                                        },
                                        {
                                            model: db.corretoras_dados_bancarios,
                                        },
                                        {
                                            model: db.corretoras_documentos,
                                        },
                                        {
                                            model: db.corretoras_enderecos,
                                        },
                                        {
                                            model: db.corretoras_responsavels,
                                            include: [
                                                {
                                                    model: db.corretoras_responsavels_documentos,
                                                }
                                            ]
                                        },
                                        {
                                            model: db.corretoras_supervisors,
                                        },
                                    ],
                                })
                                .then(cor => {
                                    cor.forEach(async (el, i) => {
                                        const query = await el.razao_social.toLowerCase();
                                        const validcorretora = await corretora.filter((b) => (b.razao_social.toLowerCase().indexOf(query) > -1));
                                        if (validcorretora.length === 0) {
                                            corretora.push(el);
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
                        corretoras: [],
                        message: "Essa lista contém as corretoras cadastradas no sistema!",
                        sucesso: true
                    });
                }
            }
            else {
                res.send({
                    corretoras: [],
                    message: "Essa lista contém as corretoras cadastradas no sistema!",
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

exports.findCorretoraCategoria = (req, res) => {
    Corretora.findAll(
        {
            where: {
                categoria_ID: {
                    [Op.or]: [2],
                }
            },
        })
        .then(co => {
            res.send({
                corretoras: co,
                message: "Essa lista contém as corretoras cadastradas no sistema com a categoria assessoria!",
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

exports.deleteCorretora = async (req, res) => {
    await Corretora.destroy({
        where: {
            id: req.params.id
        },
    }).then(co => {
        res.send({
            message: "Corretora deletada com sucesso!",
            sucesso: true
        });
    }).catch(err => {
        res.status(401).send({
            message: err.message,
            sucesso: false
        });
    })
};