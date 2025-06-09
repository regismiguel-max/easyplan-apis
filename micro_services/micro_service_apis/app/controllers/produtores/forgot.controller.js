const db = require("../../../../../models");
const config = require("../../config/auth/auth.config");
const DadosAcesso = db.produtores_dados_acessos;
const Contato = db.produtores_contatos;
const Produtor = db.produtores;
var bcrypt = require("bcryptjs");

exports.forgot = (req, res) => {
    Produtor.findOne({
        where: {
            cpf: req.body.cpf.replace(/\D/g, '')
        }
    })
        .then(pro => {
            if (pro) {
                Contato.findOne({
                    where: {
                        id: pro.contato_ID,
                        email: req.body.email
                    }
                })
                    .then(user => {
                        if (!user) {
                            return res.status(404).send({
                                message: "Usuário não encontrado.",
                                sucesso: false
                            });
                        }

                        Produtor.findOne(
                            {
                                where: {
                                    id: pro.id
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
                                res.status(200).send({
                                    produtor: prod,
                                    message: 'Produtor encontrado!',
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

exports.updateProdutor = async (req, res) => {
    await DadosAcesso.update(
        {
            password: bcrypt.hashSync(req.body.password, 8),
        },
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(async da => {
            if (da) {
                res.send({
                    message: "Dados de acesso do produtor atualizado com sucesso!",
                    sucesso: true
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