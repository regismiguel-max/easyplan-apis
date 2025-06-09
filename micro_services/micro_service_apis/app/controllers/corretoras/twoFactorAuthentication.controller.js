const db = require("../../../../../models");
const TwoFactorAuthentication = db.corretoras_two_factor_authentications;
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
        cnpj: req.body.cnpj,
        whatsapp: req.body.whatsapp,
        code: code,
        validity: token,
        authenticated: false,
    }

    await TwoFactorAuthentication.findOne({
        where: {
            cnpj: req.body.cnpj.replace(/\D/g, ''),
        }
    })
        .then(async twfa => {
            if (!twfa) {
                await TwoFactorAuthentication.create(dados)
                    .then(async tw => {
                        if (tw) {
                            if (tw) {
                                shortenGenerateCorretora(dados, code, req, res, req.body.cnpj)
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
                            cnpj: req.body.cnpj,
                        }
                    }
                )
                    .then(async tw => {
                        if (tw) {
                            shortenGenerateCorretora(dados, code, req, res, req.body.cnpj)
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

shortenGenerateCorretora = async (dados, code, req, res, cnpj) => {
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
                        url: `d1=${dados.cnpj}&d2=${bcrypt.hashSync(req.body.whatsapp, salt)}&d3=${bcrypt.hashSync(code, salt)}&d4=${dados.validity}`
                    }
                )
                    .then(async st => {
                        if (st) {
                            WhatsApp.sendMessageLinkImage(
                                {
                                    whatsapp: `${req.body.whatsapp}`,
                                    // url: `http://localhost:8100/#/authentication?d1=${dados.cnpj}&d2=${bcrypt.hashSync(req.body.whatsapp, salt)}&d3=${bcrypt.hashSync(code, salt)}&d4=${dados.validity}`,
                                    url: `*https://${process.env.DOMAINSITE}/#/shorten?d1=${id}*`,
                                    message1: `Olá ${req.body.responsavel}!`,
                                    message2: `Seja muito bem-vindo ao canal de *Suporte EasyPlan*.`,
                                    message3: `Para validar o seu número de WhatsApp e continuar com o seu cadastro no aplicativo *EasyPlan Corretor*, por favor, acesse o link abaixo:`,
                                    message4: `_Caso não consiga clicar no link, adicione-nos à sua lista de contatos. Isso permitirá que você clique nos links de nossas mensagens_`,
                                    message5: `Agradecemos por escolher a *EasyPlan*!`,
                                    message6: `_Favor não responder, esta é uma mensagem automática._`,
                                },
                                res,
                                cnpj
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
                shortenGenerateCorretora(dados, code, req, res, cnpj);
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
                cnpj: req.params.cnpj,
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
                    message: 'CNPJ não encontrado!',
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