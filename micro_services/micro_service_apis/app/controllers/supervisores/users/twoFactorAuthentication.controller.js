const db = require("../../../../../../models");
const TwoFactorAuthentication = db.supervisores_two_factor_authentications;
const WhatsApp = require("../whatsapp/whatsapp.controller")
const { where, Op } = require("sequelize");

const bcrypt = require("bcryptjs");
const salt = bcrypt.genSaltSync(Number(process.env.SALT));

exports.addTwoFactorAuthentication = async (req, res) => {
    let code = '';
    while (code.length < 6) {
        code = String(Number(code)).concat(String(Math.floor(Math.random() * (9 - 0 + 1)) + 0));
    }

    const dados = {
        documento: req.body.documento.replace(/\D/g, ''),
        whatsapp: bcrypt.hashSync(req.body.whatsapp.replace(/\D/g, ''), salt),
        email: bcrypt.hashSync(req.body.email, salt),
        code: bcrypt.hashSync(code, salt),
        authenticated: false,
    }

    await TwoFactorAuthentication.findOne({
        where: {
            documento: req.body.documento.replace(/\D/g, ''),
        }
    })
        .then(async twfa => {
            if (!twfa) {
                await TwoFactorAuthentication.create(dados)
                    .then(async tw => {
                        if (tw) {
                            if (tw) {
                                WhatsApp.sendMessageCodeImage(req, res, code);
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
                            documento: req.body.documento.replace(/\D/g, ''),
                        }
                    }
                )
                    .then(async tw => {
                        if (tw) {
                            WhatsApp.sendMessageCodeImage(req, res, code);
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


exports.verifyTwoFactorAuthentication = (req, res, next) => {
    TwoFactorAuthentication.findOne({
        where: {
            documento: req.body.documento.replace(/\D/g, ''),
        }
    }).then(async tw => {
        if (tw) {
            const codeIsValid = await bcrypt.compareSync(
                req.body.code,
                tw.code
            );

            const whatsappIsValid = await bcrypt.compareSync(
                req.body.whatsapp,
                tw.whatsapp
            );

            const emailIsValid = await bcrypt.compareSync(
                req.body.email,
                tw.email,
            );

            // console.log(`code = ${codeIsValid} , whatsapp = ${whatsappIsValid} , email = ${emailIsValid}, authenticad = ${tw.authenticated}`)

            if (codeIsValid && whatsappIsValid && emailIsValid && !tw.authenticated) {
                await TwoFactorAuthentication.update(
                    {
                        authenticated: true,
                    },
                    {
                        where: {
                            documento: req.body.documento.replace(/\D/g, ''),
                        }
                    }
                )
                    .then(async twf => {
                        if (twf) {
                            res.status(200).send({
                                message: 'Código validado com sucesso!',
                                sucesso: true
                            });
                            return;

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
                console.log(`${codeIsValid} - ${whatsappIsValid} - ${emailIsValid} - ${tw.authenticated}`)
                if (!codeIsValid && whatsappIsValid && emailIsValid && !tw.authenticated) {
                    res.status(401).send({
                        message: "Código inválido, acesse o aplicativo e solicite novamente!",
                        sucesso: false,
                    });
                    return;
                }
                else {
                    await TwoFactorAuthentication.destroy({
                        where: {
                            documento: req.body.documento.replace(/\D/g, '')
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
