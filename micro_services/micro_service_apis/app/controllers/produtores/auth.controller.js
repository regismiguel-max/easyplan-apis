const db = require("../../../../../models");
const config = require("../../config/auth/auth.config");
const DadosAcesso = db.produtores_dados_acessos;
const Produtor = db.produtores;
const Situacao = db.produtores_situacoes;
const Cidade = db.utils_cidades;
const Estado = db.utils_estados;

const Op = db.Sequelize.Op;

var jwt = require("jsonwebtoken");
var bcrypt = require("bcryptjs");
var salt = bcrypt.genSaltSync(Number(process.env.SALT));


exports.signin = (req, res) => {
    Produtor.findOne({
        where: {
            cpf: req.body.cpf.replace(/\D/g, '')
        }
    })
        .then(pro => {
            if (pro) {
                DadosAcesso.findOne({
                    where: {
                        id: pro.dados_acesso_ID,
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

                        Produtor.findOne(
                            {
                                where: {
                                    dados_acesso_ID: user.id
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
                                    },
                                ],
                            },
                        )
                            .then(prod => {
                                let cidade = null;
                                let estado = null;
                                Cidade.findOne(
                                    {
                                        where: {
                                            cidadeID: prod.produtores_enderecos[0].cidade_ID,
                                        },
                                    }
                                )
                                    .then(ci => {
                                        cidade = ci;
                                        Estado.findOne(
                                            {
                                                where: {
                                                    estadoID: prod.produtores_enderecos[0].estado_ID,
                                                },
                                            }
                                        )
                                            .then(st => {
                                                estado = st;
                                                Situacao.findOne(
                                                    {
                                                        where: {
                                                            id: prod.situacao_ID
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
                                                                message: 'Aguarde, seus dados estão em análise!',
                                                                sucesso: false
                                                            });

                                                        }
                                                        else if (si.nome === "PENDENTE") {
                                                            res.status(200).send({
                                                                produtor: {
                                                                    dados: prod,
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
                                                            res.status(200).send({
                                                                produtor: {
                                                                    dados: prod,
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