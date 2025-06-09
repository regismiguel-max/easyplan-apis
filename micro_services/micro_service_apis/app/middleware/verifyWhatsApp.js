const db = require("../../../../models");
const jwt = require("jsonwebtoken");
const config = require("../config/auth/auth.config");
const TWFA = db.corretoras_two_factor_authentications;
const TWFAP = db.produtores_two_factor_authentications;
var bcrypt = require("bcryptjs");

checkAuthProdutor = (req, res, next) => {
    TWFAP.findOne({
        where: {
            cpf: req.body.cpf
        }
    }).then(async tw => {
        if (tw) {
            const codeIsValid = await bcrypt.compareSync(
                tw.code,
                req.body.code
            );

            const whatsappIsValid = await bcrypt.compareSync(
                tw.whatsapp,
                req.body.whatsapp
            );

            const tokenIsValid = await jwt.verify(req.body.token, config.privateKey, (err, decoded) => {
                if (err) {
                    console.log(err)
                    return false
                }
                else {
                    return true;
                }
            });
            console.log(`code = ${codeIsValid} , whatsapp = ${whatsappIsValid} , token = ${tokenIsValid}, authenticad = ${tw.authenticated}`)

            if (codeIsValid && whatsappIsValid && tokenIsValid && !tw.authenticated) {
                await TWFAP.update(
                    {
                        authenticated: true,
                    },
                    {
                        where: {
                            cpf: req.body.cpf,
                        }
                    }
                )
                    .then(async twf => {
                        if (twf) {
                            res.status(200).send({
                                message: 'WhatsApp validado com sucesso!',
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
                await TWFAP.destroy({
                    where: {
                        cpf: req.body.cpf
                    },
                }).then(tw => {
                    res.status(401).send({
                        message: "O link expirou, acesse o aplicativo e solicite novamente!",
                        sucesso: false,
                    });
                    return;
                }).catch(err => {
                    res.status(401).send({
                        message: "Link inválido, acesse o aplicativo e solicite novamente!",
                        sucesso: false,
                    });
                })
            }
        }
        else {
            res.status(401).send({
                message: "Link inválido, acesse o aplicativo e solicite novamente!",
                sucesso: false,
            });
            return;
        }
    });
};

checkAuth = (req, res, next) => {
    TWFA.findOne({
        where: {
            cnpj: req.body.cnpj
        }
    }).then(async tw => {
        if (tw) {
            const codeIsValid = await bcrypt.compareSync(
                tw.code,
                req.body.code
            );

            const whatsappIsValid = await bcrypt.compareSync(
                tw.whatsapp,
                req.body.whatsapp
            );

            const tokenIsValid = await jwt.verify(req.body.token, config.privateKey, (err, decoded) => {
                if (err) {
                    console.log(err)
                    return false
                }
                else {
                    return true;
                }
            });
            console.log(`code = ${codeIsValid} , whatsapp = ${whatsappIsValid} , token = ${tokenIsValid}, authenticad = ${tw.authenticated}`)

            if (codeIsValid && whatsappIsValid && tokenIsValid && !tw.authenticated) {
                await TWFA.update(
                    {
                        authenticated: true,
                    },
                    {
                        where: {
                            cnpj: req.body.cnpj,
                        }
                    }
                )
                    .then(async twf => {
                        if (twf) {
                            res.status(200).send({
                                message: 'WhatsApp validado com sucesso!',
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
                await TWFA.destroy({
                    where: {
                        cnpj: req.body.cnpj
                    },
                }).then(tw => {
                    res.status(401).send({
                        message: "O link expirou, acesse o aplicativo e solicite novamente!",
                        sucesso: false,
                    });
                    return;
                }).catch(err => {
                    res.status(401).send({
                        message: "Link inválido, acesse o aplicativo e solicite novamente!",
                        sucesso: false,
                    });
                })
            }
        }
        else {
            res.status(401).send({
                message: "Link inválido, acesse o aplicativo e solicite novamente!",
                sucesso: false,
            });
            return;
        }


    });
};


const verifyWhatsApp = {
    checkAuth: checkAuth,
    checkAuthProdutor: checkAuthProdutor
};

module.exports = verifyWhatsApp;