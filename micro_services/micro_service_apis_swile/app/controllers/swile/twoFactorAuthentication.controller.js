const db = require("../../../../../models");
const User = db.user;
const SwileTwoFactorAuthentication = db.swile_two_factor_authentications;
const SwileTwoFactorAuthenticationRequest = db.swile_two_factor_authentications_request;
const Pay = db.swile_payment;
const OrderPayment = db.swile_payment;
const WhatsApp = require("../whatsapp/whatsapp.controller")
const SendMail = require("../mail/mail.controller")
const Payment = require("./paymentLoteBonuses.controller")
const { where, Op } = require("sequelize");

const bcrypt = require("bcryptjs");
const salt = bcrypt.genSaltSync(Number(process.env.SALT));


exports.addTwoFactorAuthentication = async (req, res) => {
    await OrderPayment.findOne({
        where: {
            lote_ID: req.body.lote_ID,
        }
    })
        .then(async pay => {
            if (pay && !req.body.resend) {
                res.status(401).send({
                    message: 'Esse lote de bonificação já possuí uma solicitação de pagamento em andamento!',
                    sucesso: false
                });
            }
            else {
                let code = '';
                while (code.length < 6) {
                    code = String(Number(code)).concat(String(Math.floor(Math.random() * (9 - 0 + 1)) + 0));
                }

                await User.findOne({
                    where: {
                        id: req.userId,
                    }
                })
                    .then(async user => {
                        if (user) {
                            if (user.payment) {
                                req.body.email = user.email;
                                req.body.name = user.name;
                                req.body.whatsapp = user.celular;

                                const swileRequests = await SwileTwoFactorAuthenticationRequest.findAll({
                                    where: { lote_ID: req.body.lote_ID },
                                    order: [['createdAt', 'ASC']]
                                });

                                const firstRequest = swileRequests[0];

                                const dados = {
                                    user_ID: req.userId,
                                    whatsapp: bcrypt.hashSync(user.celular.replace(/\D/g, ''), salt),
                                    email: bcrypt.hashSync(user.email, salt),
                                    code: bcrypt.hashSync(code, salt),
                                    authenticated: false,
                                    request_ID: null,
                                }

                                const dadosSave = {
                                    user_ID: req.userId,
                                    user_IP: req.body.ip,
                                    user_lat: req.body.lat,
                                    user_lng: req.body.lng,
                                    user_endereco: req.body.endereco,
                                    lote_ID: req.body.lote_ID,
                                    lote_type: req.body.lote_type,
                                    whatsapp: bcrypt.hashSync(user.celular.replace(/\D/g, ''), salt),
                                    email: bcrypt.hashSync(user.email, salt),
                                    code: bcrypt.hashSync(code, salt),
                                    lotePay: firstRequest?.lotePay || null,
                                    authenticated: false,
                                }

                                await SwileTwoFactorAuthentication.findOne({
                                    where: {
                                        user_ID: req.userId,
                                    }
                                })
                                    .then(async twfa => {
                                        if (!twfa) {
                                            await SwileTwoFactorAuthenticationRequest.create(dadosSave)
                                                .then(async twr => {
                                                    if (twr) {
                                                        dados.request_ID = twr.id;
                                                        await SwileTwoFactorAuthentication.create(dados)
                                                            .then(async tw => {
                                                                if (tw) {
                                                                    if (tw) {
                                                                        if (req.body.type === 'mail') {
                                                                            SendMail.sendMessageCodeImage(req, res, code);
                                                                        }
                                                                        else {
                                                                            WhatsApp.sendMessageCodeImage(req, res, code);
                                                                        }
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
                                            await SwileTwoFactorAuthenticationRequest.create(dadosSave)
                                                .then(async twr => {
                                                    if (twr) {
                                                        dados.request_ID = twr.id;
                                                        await SwileTwoFactorAuthentication.update(dados,
                                                            {
                                                                where: {
                                                                    user_ID: req.userId,
                                                                }
                                                            }
                                                        )
                                                            .then(async tw => {
                                                                if (tw) {
                                                                    if (req.body.type === 'mail') {
                                                                        SendMail.sendMessageCodeImage(req, res, code);
                                                                    }
                                                                    else {
                                                                        WhatsApp.sendMessageCodeImage(req, res, code);
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
                            }
                            else {
                                res.status(401).send({
                                    message: 'Usuário não tem permissão para executar essa ação.',
                                    sucesso: false
                                });
                            }
                        }
                        else {
                            res.status(401).send({
                                message: 'Usuário não encontrado!',
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

exports.verifyTwoFactorAuthentication = (req, res, next) => {
    SwileTwoFactorAuthentication.findOne({
        where: {
            user_ID: req.userId,
        }
    }).then(async tw => {
        if (tw) {
            const codeIsValid = await bcrypt.compareSync(
                req.body.code,
                tw.code
            );

            // console.log(`code = ${codeIsValid} , whatsapp = ${whatsappIsValid} , email = ${emailIsValid}, authenticad = ${tw.authenticated}`)

            if (codeIsValid && !tw.authenticated) {
                await SwileTwoFactorAuthenticationRequest.update(
                    {
                        authenticated: true,
                    },
                    {
                        where: {
                            user_ID: req.userId,
                            id: tw.request_ID
                        }
                    }
                )
                    .then(async twfr => {
                        if (twfr) {
                            console.log(twfr)
                            await SwileTwoFactorAuthentication.update(
                                {
                                    authenticated: true,
                                },
                                {
                                    where: {
                                        user_ID: req.userId,

                                    }
                                }
                            )
                                .then(async twf => {
                                    if (twf) {
                                        if (req.body.resend) {
                                            await SwileTwoFactorAuthenticationRequest.findOne({
                                                where: {
                                                    user_ID: req.userId,
                                                    id: tw.request_ID
                                                }
                                            })
                                                .then(async stwfr => {
                                                    await Pay.findOne({
                                                        where: {
                                                            lote_ID: stwfr.lote_ID,
                                                        }
                                                    })
                                                        .then(async pay => {
                                                            console.log('STATUS: ' + pay.payment_status_ID)
                                                            if (pay.payment_status_ID === '2') {
                                                                await User.findOne({
                                                                    where: {
                                                                        id: req.userId,
                                                                    }
                                                                })
                                                                    .then(async user => {
                                                                        if (user) {
                                                                            WhatsApp.sendMessagePayAnalise(user.name, user.celular)
                                                                        }
                                                                    })
                                                                    .catch(err => { })

                                                                Payment.orderSummary(tw.request_ID, req.body.resend);
                                                                res.status(200).send({
                                                                    message: 'Código validado com sucesso!<br />Sua solicitação de pagamento está sendo processada.',
                                                                    sucesso: true
                                                                });
                                                                return;
                                                            }
                                                            else {
                                                                res.status(401).send({
                                                                    message: "Não foi possível reenviar a solicitação de pagamento para este lote.",
                                                                    sucesso: false
                                                                });
                                                                return;
                                                            }
                                                        })
                                                        .catch(err => {
                                                            res.status(401).send({
                                                                message: err.message,
                                                                sucesso: false
                                                            });
                                                            return;
                                                        })
                                                })
                                                .catch(err => {
                                                    res.status(401).send({
                                                        message: err.message,
                                                        sucesso: false
                                                    });
                                                    return;
                                                })

                                        }
                                        else {
                                            await User.findOne({
                                                where: {
                                                    id: req.userId,
                                                }
                                            })
                                                .then(async user => {
                                                    if (user) {
                                                        WhatsApp.sendMessagePayAnalise(user.name, user.celular)
                                                    }
                                                })
                                                .catch(err => { })

                                            Payment.orderSummary(tw.request_ID, req.body.resend);
                                            res.status(200).send({
                                                message: 'Código validado com sucesso!<br />Sua solicitação de pagamento está sendo processada.',
                                                sucesso: true
                                            });
                                            return;
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
                if (!codeIsValid && !tw.authenticated) {
                    res.status(401).send({
                        message: "Código inválido, acesse o aplicativo e solicite novamente!",
                        sucesso: false,
                    });
                    return;
                }
                else {
                    await SwileTwoFactorAuthentication.destroy({
                        where: {
                            user_ID: req.userId,
                        },
                    }).then(tw => {
                        res.status(401).send({
                            message: "Código inválido, acesse o aplicativo e solicite novamente!",
                            sucesso: false,
                        });
                        return;
                    }).catch(err => {
                        res.status(401).send({
                            message: "Código inválido, acesse o aplicativo e solicite novamente!",
                            sucesso: false,
                        });
                    })
                }
            }
        }
        else {
            res.status(401).send({
                message: "Código inválido, acesse o aplicativo e solicite novamente!",
                sucesso: false,
            });
            return;
        }


    });
};