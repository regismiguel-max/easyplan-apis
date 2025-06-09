const db = require("../../../../../models");
const TwoFactorAuthentication = db.user_client_two_factor_authentication;
const WhatsApp = require("../whatsapp/whatsapp.controller")
const SendMail = require("../mail/mail.controller")
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

// exports.updateTwoFactorAuthentication = async (req, res) => {
//     await TwoFactorAuthentication.update(
//         {
//             authenticated: true,
//         },
//         {
//             where: {
//                 id: req.params.id,
//             }
//         }
//     )
//         .then(async tw => {
//             if (tw) {
//                 res.send({
//                     message: "Autenticado com sucesso!",
//                     sucesso: true
//                 });

//             } else {
//                 res.status(401).send({
//                     message: err.message,
//                     sucesso: false
//                 });
//             }
//         })
//         .catch(err => {
//             res.status(500).send({
//                 message: err.message,
//                 sucesso: false
//             });
//         });
// };

// exports.findTwoFactorAuthentication = (req, res) => {
//     TwoFactorAuthentication.findOne(
//         {
//             where: {
//                 cnpj: req.params.cnpj,
//             }
//         }
//     )
//         .then(tw => {
//             if (tw) {
//                 res.send({
//                     twofactorauthentication: tw ? tw.authenticated : false,
//                     message: "Essa lista contém o valor de autenticação!",
//                     sucesso: true
//                 });
//             }
//             else {
//                 res.status(401).send({
//                     twofactorauthentication: null,
//                     message: 'CNPJ não encontrado!',
//                     sucesso: false
//                 });
//             }

//         })
//         .catch(err => {
//             res.status(500).send({
//                 twofactorauthentication: null,
//                 message: err.message,
//                 sucesso: false
//             })
//         })
// };

// exports.deleteTwoFactorAuthentication = async (req, res) => {
//     await TwoFactorAuthentication.destroy({
//         where: {
//             id: req.params.id
//         },
//     }).then(tw => {
//         res.send({
//             message: "Autenticação deletada com sucesso!",
//             sucesso: true
//         });
//     }).catch(err => {
//         res.status(401).send({
//             message: err.message,
//             sucesso: false
//         });
//     })
// };