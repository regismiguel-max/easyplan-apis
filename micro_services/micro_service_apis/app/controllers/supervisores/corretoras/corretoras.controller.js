const db = require("../../../../../../models");
const Corretora = db.corretoras;
const Endereco = db.corretoras_enderecos;
const Situacao = db.corretoras_situacoes;
const Cidade = db.utils_cidades;
const Estado = db.utils_estados;
const Categoria = db.corretoras_categorias;
const Banco = db.utils_bancos;
const TipoConta = db.utils_tipos_contas_bancarias;
const Supervisor = db.corretoras_supervisors;
const { where, Op } = require("sequelize");

exports.findCorretorasEstados = (req, res) => {
    const where = {};
    if (req.params.estadoID !== "00NACI") { 
        if (req.params.estadoID === "00DFGO") { 
            where.estado_ID = {
                [Op.or]: [7, 9],
            } 
        }
        else {
            where.estado_ID = req.params.estadoID;
        }  
    }
    Endereco.findAll(
        {
            where,
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
                                            model: db.corretoras_supervisors,
                                        },
                                        {
                                            model: db.corretoras_responsavels,
                                            include: [
                                                {
                                                    model: db.corretoras_responsavels_documentos,
                                                }
                                            ]
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
                                            model: db.corretoras_supervisors,
                                        },
                                        {
                                            model: db.corretoras_responsavels,
                                            include: [
                                                {
                                                    model: db.corretoras_responsavels_documentos,
                                                }
                                            ]
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
            let situacao = null;
            let banco = null;
            let tipoConta = null;
            let categoria = null;
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
                                    situacao = si;
                                    Banco.findOne(
                                        {
                                            where: {
                                                bancoID: co.corretoras_dados_bancarios[0].banco_ID,
                                            },
                                        }
                                    )
                                        .then(db => {
                                            banco = db;
                                            TipoConta.findOne(
                                                {
                                                    where: {
                                                        tipoContaBancariaID: co.corretoras_dados_bancarios[0].tipo_conta_ID,
                                                    },
                                                }
                                            )
                                                .then(tc => {
                                                    tipoConta = tc;
                                                    if (co.categoria_ID) {
                                                        Categoria.findOne(
                                                            {
                                                                where: {
                                                                    id: co.categoria_ID,
                                                                },
                                                            }
                                                        )
                                                            .then(cat => {
                                                                categoria = cat;
                                                                if (co.supervisor_ID) {
                                                                    Supervisor.findOne(
                                                                        {
                                                                            where: {
                                                                                id: co.supervisor_ID,
                                                                            },
                                                                        }
                                                                    )
                                                                        .then(sup => {
                                                                            res.status(200).send({
                                                                                corretora: {
                                                                                    dados: co,
                                                                                    cidade: cidade,
                                                                                    estado: estado,
                                                                                    situacao: situacao,
                                                                                    banco: banco,
                                                                                    tipoConta: tipoConta,
                                                                                    categoria: categoria,
                                                                                    supervisor: sup
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
                                                                }
                                                                else {
                                                                    res.status(200).send({
                                                                        corretora: {
                                                                            dados: co,
                                                                            cidade: cidade,
                                                                            estado: estado,
                                                                            situacao: situacao,
                                                                            banco: banco,
                                                                            tipoConta: tipoConta,
                                                                            categoria: categoria,
                                                                            supervisor: null
                                                                        },
                                                                        message: 'Essa lista contém a corretora cadastradas no sistema!',
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
                                                    }
                                                    else {
                                                        if (co.supervisor_ID) {
                                                            Supervisor.findOne(
                                                                {
                                                                    where: {
                                                                        id: co.supervisor_ID,
                                                                    },
                                                                }
                                                            )
                                                                .then(sup => {
                                                                    res.status(200).send({
                                                                        corretora: {
                                                                            dados: co,
                                                                            cidade: cidade,
                                                                            estado: estado,
                                                                            situacao: situacao,
                                                                            banco: banco,
                                                                            tipoConta: tipoConta,
                                                                            categoria: categoria,
                                                                            supervisor: sup
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
                                                        }
                                                        else {
                                                            res.status(200).send({
                                                                corretora: {
                                                                    dados: co,
                                                                    cidade: cidade,
                                                                    estado: estado,
                                                                    situacao: situacao,
                                                                    banco: banco,
                                                                    tipoConta: tipoConta,
                                                                    categoria: categoria,
                                                                    supervisor: null
                                                                },
                                                                message: 'Essa lista contém a corretora cadastradas no sistema!',
                                                                sucesso: true
                                                            });
                                                        }
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