const db = require("../../../../../models");
const config = require("../../config/auth/auth.config");
const DadosAcesso = db.corretoras_dados_acessos;
const Corretora = db.corretoras;
const Situacao = db.corretoras_situacoes;
const Cidade = db.utils_cidades;
const Estado = db.utils_estados;

const Op = db.Sequelize.Op;

var jwt = require("jsonwebtoken");
var bcrypt = require("bcryptjs");
var salt = bcrypt.genSaltSync(Number(process.env.SALT));


exports.signin = (req, res) => {
    Corretora.findOne({
        where: {
            cnpj: req.body.cnpj.replace(/\D/g, '')
        }
    })
        .then(cor => {
            if (cor) {
                DadosAcesso.findOne({
                    where: {
                        id: cor.dados_acesso_ID,
                    }
                })
                    .then(user => {
                        if (!user) {
                            return res.status(404).send({
                                message: "Usuário não encontrado.",
                                sucesso: false
                            });
                        }

                        var passwordIsValid = bcrypt.compareSync(
                            req.body.password,
                            user.password
                        );

                        if (!passwordIsValid) {
                            return res.status(401).send({
                                accessToken: null,
                                message: "Senha inválida!",
                                sucesso: false
                            });
                        }

                        var token = jwt.sign({ id: user.id }, config.privateKey, {
                            // expiresIn: 2592000000 // 30 dias
                            expiresIn: 86400 // 1 dia
                        });

                        Corretora.findOne(
                            {
                                where: {
                                    dados_acesso_ID: user.id
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
                            },
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
                                                        if (si.nome === "EM ANALISE") {
                                                            res.status(200).send({
                                                                situacao: {
                                                                    id: si.id,
                                                                    nome: si.nome,
                                                                },
                                                                accessToken: null,
                                                                message: 'Aguarde, seus documentos estão em análise!',
                                                                sucesso: false
                                                            });

                                                        }
                                                        else if (si.nome === "PENDENTE") {
                                                            res.status(200).send({
                                                                corretora: {
                                                                    dados: co,
                                                                    cidade: cidade,
                                                                    estado: estado
                                                                },
                                                                situacao: {
                                                                    id: si.id,
                                                                    nome: si.nome,
                                                                },
                                                                accessToken: token,
                                                                message: 'Atenção, é preciso concluir o cadastro!',
                                                                sucesso: false
                                                            });
                                                        }
                                                        else if (si.nome === "CANCELADO") {
                                                            res.status(401).send({
                                                                accessToken: null,
                                                                message: "Acesso negado, usuário sem permissão de acesso ao sistema!",
                                                                sucesso: false
                                                            });
                                                        }
                                                        else {
                                                            if (co.termo_aditivo && co.termo_aditivo_ID && co.termo_aditivo_URL && co.termo_aditivo_2 && co.termo_aditivo_ID_2 && co.termo_aditivo_URL_2) {
                                                                res.status(200).send({
                                                                    corretora: {
                                                                        dados: co,
                                                                        cidade: cidade,
                                                                        estado: estado,
                                                                        situacao: {
                                                                            id: si.id,
                                                                            nome: si.nome,
                                                                        },
                                                                        accessToken: token
                                                                    },
                                                                    situacao: {
                                                                        id: si.id,
                                                                        nome: si.nome,
                                                                    },
                                                                    accessToken: token,
                                                                    message: 'Acesso autorizado com sucesso!',
                                                                    sucesso: true
                                                                });
                                                            }
                                                            else {
                                                                if (co.categoria_ID === 1) {
                                                                    res.status(200).send({
                                                                        corretora: {
                                                                            dados: co,
                                                                            cidade: cidade,
                                                                            estado: estado
                                                                        },
                                                                        situacao: {
                                                                            id: 0,
                                                                            nome: 'TERMO_ADITIVO',
                                                                        },
                                                                        accessToken: token,
                                                                        message: 'Termo Aditivo ainda não foi assinado!',
                                                                        sucesso: false
                                                                    });
                                                                }
                                                                else {
                                                                    res.status(200).send({
                                                                        corretora: {
                                                                            dados: co,
                                                                            cidade: cidade,
                                                                            estado: estado,
                                                                            situacao: {
                                                                                id: si.id,
                                                                                nome: si.nome,
                                                                            },
                                                                            accessToken: token
                                                                        },
                                                                        situacao: {
                                                                            id: si.id,
                                                                            nome: si.nome,
                                                                        },
                                                                        accessToken: token,
                                                                        message: 'Acesso autorizado com sucesso!',
                                                                        sucesso: true
                                                                    });
                                                                }
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
            }
            else {
                return res.status(404).send({
                    message: "Usuário não encontrado.",
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