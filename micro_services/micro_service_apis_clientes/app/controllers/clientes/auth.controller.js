const db = require("../../../../../models");
const config = require("../../config/auth/auth.config");
const User = db.user_client;

const Op = db.Sequelize.Op;

var jwt = require("jsonwebtoken");
var bcrypt = require("bcryptjs");


exports.signin = (req, res, next) => {
    const where = {};
    if (req.body.documento.length === 11) {
        where.cpf = req.body.documento;
    }
    else {
        where.cnpj = req.body.documento;
    }

    User.findOne(
        {
            where
        }
    )
        .then(user => {
            if (!user) {
                return res.status(200).send({
                    message: "Não há registro de usuário correspondente a este identificador, verifique e tente novamente!",
                    sucesso: false
                });
            }

            var passwordIsValid = bcrypt.compareSync(
                req.body.password,
                user.password
            );

            if (!passwordIsValid) {
                return res.status(200).send({
                    message: "Senha inválida, verifique e tente novamente!",
                    sucesso: false
                });
            }

            res.status(200).send({
                user,
                message: 'Acesso autorizado com sucesso!',
                sucesso: true
            });
        })
        .catch(err => {
            res.status(500).send({
                message: 'err.message',
                sucesso: false
            });
        });
};