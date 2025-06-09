const db = require("../../../../../models");
const config = require("../../config/auth/auth.config");
const DadosAcesso = db.corretoras_dados_acessos;
const Contato = db.corretoras_contatos;
const Corretora = db.corretoras;
var bcrypt = require("bcryptjs");

exports.forgot = (req, res) => {
    Corretora.findOne({
        where: {
            cnpj: req.body.cnpj.replace(/\D/g, '')
        }
    })
        .then(cor => {
            if (cor) {
                Contato.findOne({
                    where: {
                        id: cor.contato_ID,
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

                        Corretora.findOne(
                            {
                                where: {
                                    id: cor.id
                                },
                                include: [
                                    {
                                        model: db.corretoras_contatos,
                                    },
                                    {
                                        model: db.corretoras_enderecos,
                                    },
                                    {
                                        model: db.corretoras_responsavels,
                                    },
                                ],
                            },
                        )
                            .then(corr => {
                                res.status(200).send({
                                    corretora: corr,
                                    message: 'Corretora encontrado!',
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
                    message: "Dados de acesso da corretora atualizado com sucesso!",
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