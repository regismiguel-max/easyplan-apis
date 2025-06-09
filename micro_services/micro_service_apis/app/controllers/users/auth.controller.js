const db = require("../../../../../models");
const config = require("../../config/auth/auth.config");
const User = db.user;
const Role = db.role;
const Permission = db.user_permissions;

const Op = db.Sequelize.Op;

var jwt = require("jsonwebtoken");
var bcrypt = require("bcryptjs");
var salt = bcrypt.genSaltSync(Number(process.env.SALT));

exports.signup = (req, res) => {
    // Save User to Database
    User.create({
        name: req.body.name,
        cpf: req.body.cpf,
        email: req.body.email,
        celular: req.body.celular,
        password: bcrypt.hashSync(req.body.password, salt)
    })
        .then(user => {
            Permission.create()
                .then(perm => {
                    let sql = 'INSERT INTO `user_userpermission` (`userPermissonId`, `userId`) VALUES (';
                    db.sequelize.query(`${sql}${perm.id}, ${user.id})`, { type: db.sequelize.QueryTypes.INSERT })
                        .then(async (userperm) => {
                            user.setRoles([1]).then(() => {
                                res.send({ message: "O usuário foi cadastrado com sucesso!" });
                            });
                        })
                        .catch(async err => {
                            res.status(500).send({ message: err.message });
                        });
                })
                .catch(err => {
                    res.status(500).send({ message: err.message });
                });
        })
        .catch(err => {
            res.status(500).send({ message: err.message });
        });
};

exports.signin = (req, res) => {
    User.findOne({
        where: {
            cpf: req.body.cpf.replace(/\D/g, '')
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

            var authorities = [];
            user.getRoles().then(roles => {
                roles.forEach(role => {
                    authorities.push("ROLE_" + role.name.toUpperCase())
                });

                if(user.active){
                    res.status(200).send({
                        user: {
                            id: user.id,
                            name: user.name,
                            cpf: user.cpf,
                            email: user.email,
                            celular: user.celular,
                            roles: authorities,
                            accessToken: token
                        },
                        message: 'Acesso autorizado com sucesso!',
                        sucesso: true
                    });
                }
                else {
                    res.status(200).send({
                        message: 'Acesso negado. Seu usuário está bloqueado no sistema.<br/>Por favor, entre em contato com o administrador para mais informações.',
                        sucesso: false
                    });
                }
            });
        })
        .catch(err => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            });
        });
};

exports.verifyToken = (req, res, next) => {
    let token = req.headers["x-access-token"];

    if (!token) {
        return res.status(403).send({
            message: "Acesso negado. Nenhum token fornecido!",
            sucesso: false,
        });
    }

    jwt.verify(token, config.privateKey, (err, decoded) => {
        if (err) {
            return res.status(401).send({
                message: "Não autorizado!",
                sucesso: false,
            });
        }
        else {
            res.status(200).send({
                message: 'Acesso autorizado com sucesso!',
                sucesso: true
            });
        }
    });
};