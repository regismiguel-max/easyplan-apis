const db = require("../../../../../models");
const TwoFactorAuthentication = db.produtores_two_factor_authentications;
const WhatsApp = require("../whatsapp/whatsapp.controller")
const { where, Op } = require("sequelize");

const config = require("../../config/auth/auth.config");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const salt = bcrypt.genSaltSync(Number(process.env.SALT));
const shortId = require('shortid');
const Shorten = db.utils_shortens;

exports.addTwoFactorAuthentication = async (req, res) => {
    let code = '';
    while (code.length < 6) {
        code = String(Number(code)).concat(String(Math.floor(Math.random() * (9 - 0 + 1)) + 0));
    }
    const token = jwt.sign({ code: code }, config.privateKey, {
        expiresIn: 600 // 10 min
    });

    const dados = {
        cpf: req.body.cpf,
        whatsapp: req.body.whatsapp,
        code: code,
        validity: token,
        authenticated: false,
    }

    await TwoFactorAuthentication.findOne({
        where: {
            cpf: req.body.cpf.replace(/\D/g, ''),
        }
    })
        .then(async twfa => {
            if (!twfa) {
                await TwoFactorAuthentication.create(dados)
                    .then(async tw => {
                        if (tw) {
                            if (tw) {
                                shortenGenerateProdutor(dados, code, req, res, req.body.cpf)
                            } else {
                                res.status(401).send({
                                    message: err.message,
                                    sucesso: false
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
            }
            else {
                await TwoFactorAuthentication.update(dados,
                    {
                        where: {
                            cpf: req.body.cpf,
                        }
                    }
                )
                    .then(async tw => {
                        if (tw) {
                            shortenGenerateProdutor(dados, code, req, res, req.body.cpf)
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
            }
        })
        .catch(err => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            });
        });
};

shortenGenerateProdutor = async (dados, code, req, res, cpf) => {
    console.log("AQUIII")
    const id = shortId.generate();
    await Shorten.findOne({
        where: {
            shortenID: id
        }
    })
        .then(async sh => {
            if (!sh) {
                await Shorten.create(
                    {
                        shortenID: id,
                        url: `d1=${dados.cpf}&d2=${bcrypt.hashSync(req.body.whatsapp, salt)}&d3=${bcrypt.hashSync(code, salt)}&d4=${dados.validity}`
                    }
                )
                    .then(async st => {
                        if (st) {
                            WhatsApp.sendMessageLinkImageProdutor(
                                {
                                    whatsapp: `${req.body.whatsapp}`,
                                    url: `*https://${process.env.DOMAINSITE}/#/shorten?d1=${id}*`,
                                    message1: `Olá ${req.body.responsavel}!`,
                                    message2: `Seja muito bem-vindo ao canal de *Suporte EasyPlan*.`,
                                    message3: `Para validar o seu número de WhatsApp, por favor, acesse o link abaixo:`,
                                    message4: `_Caso não consiga clicar no link, adicione-nos à sua lista de contatos. Isso permitirá que você clique nos links de nossas mensagens_`,
                                    message5: `Agradecemos por escolher a *EasyPlan*!`,
                                    message6: `_Favor não responder, esta é uma mensagem automática._`,
                                },
                                res,
                                cpf
                            );
                        }
                        else {
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
            }
            else {
                shortenGenerateProdutor(dados, code, req, res, cpf);
            }
        })
        .catch(err => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            });
        });
}

exports.updateTwoFactorAuthentication = async (req, res) => {
    await TwoFactorAuthentication.update(
        {
            authenticated: true,
        },
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(async tw => {
            if (tw) {
                res.send({
                    message: "Autenticado com sucesso!",
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

exports.findTwoFactorAuthentication = (req, res) => {
    TwoFactorAuthentication.findOne(
        {
            where: {
                cpf: req.params.cpf,
            }
        }
    )
        .then(tw => {
            if (tw) {
                res.send({
                    twofactorauthentication: tw ? tw.authenticated : false,
                    message: "Essa lista contém o valor de autenticação!",
                    sucesso: true
                });
            }
            else {
                res.status(401).send({
                    twofactorauthentication: null,
                    message: 'CPF não encontrado!',
                    sucesso: false
                });
            }

        })
        .catch(err => {
            res.status(500).send({
                twofactorauthentication: null,
                message: err.message,
                sucesso: false
            })
        })
};

exports.deleteTwoFactorAuthentication = async (req, res) => {
    await TwoFactorAuthentication.destroy({
        where: {
            id: req.params.id
        },
    }).then(tw => {
        res.send({
            message: "Autenticação deletada com sucesso!",
            sucesso: true
        });
    }).catch(err => {
        res.status(401).send({
            message: err.message,
            sucesso: false
        });
    })
};