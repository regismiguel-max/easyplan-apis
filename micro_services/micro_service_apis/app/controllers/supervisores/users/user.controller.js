const db = require("../../../../../../models");
const Permission = db.user_permissions;
const User = db.user;
const { where, Op } = require("sequelize");
var bcrypt = require("bcryptjs");
var salt = bcrypt.genSaltSync(Number(process.env.SALT));

exports.createUser = (req, res) => {
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
                                res.send(
                                    {
                                        message: "O usuário foi cadastrado com sucesso!",
                                        sucesso: true
                                    });
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

exports.createPermission = async (req, res) => {
    await Permission.create()
        .then(perm => {
            let sql = 'INSERT INTO `user_userpermission` (`userPermissonId`, `userId`) VALUES (';
            db.sequelize.query(`${sql}${perm.id}, ${req.params.id})`, { type: db.sequelize.QueryTypes.INSERT })
                .then(async (userperm) => {
                    res.send({ message: "Permissões do usuário foram criadas com sucesso!" });
                })
                .catch(async err => {
                    res.status(500).send({ message: err.message });
                });
        })
        .catch(err => {
            res.status(500).send({ message: err.message });
        });
};

exports.updateUserPermissions = async (req, res) => {
    console.log(req.body)
    await Permission.update(
        req.body,
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(async per => {
            if (per) {
                res.send({
                    Permission: per,
                    message: "Permissões do usuário atualizada com sucesso!",
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

exports.findAllPermissions = (req, res) => {
    User.findByPk(req.params.id,
        {
            attributes: {
                exclude: ['password',]
            },
            include: [
                {
                    model: db.user_permissions,
                    attributes: {
                        exclude: ['user_userPermission', 'createdAt', 'updatedAt']
                    },
                },
            ],
        })
        .then(user => {
            res.send({
                user: user,
                message: "Essa lista contém o usuário cadastrado no sistema!",
                sucesso: true
            });
        })
        .catch(err => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            })
        })
};

exports.findAllUsers = (req, res) => {
    User.findAll(
        {
            attributes: {
                exclude: ['password']
            },
        }
    )
        .then(users => {
            res.send({
                users: users,
                message: "Essa lista contém todos os usuários cadastrados no sistema!",
                sucesso: true
            });
        })
        .catch(err => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            })
        })
};

exports.updateUser = async (req, res) => {
    const dados = {};
    if (req.body.active === false || req.body.active === true) { dados.active = req.body.active; };
    if (req.body.celular) { dados.celular = req.body.celular; };
    if (req.body.email) { dados.email = req.body.email; };
    if (req.body.name) { dados.name = req.body.name; };
    if (req.body.password) { dados.password = bcrypt.hashSync(req.body.password, salt); };
    await User.update(
        dados,
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(async user => {
            if (user) {
                res.send({
                    user: user,
                    message: "Dados do usuário atualizado com sucesso!",
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

exports.findUser = (req, res) => {
    const where = {};
    where.cpf = req.params.documento;
    where.email = req.params.email;

    User.findOne(
        {
            where
        }
    )
        .then(us => {
            res.send({
                user: us,
                message: "Essa lista contém o usuário cadastrado no sistema!",
                sucesso: true
            });;
        })
        .catch(err => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            })
        })
};

exports.updatePasswordUser = async (req, res) => {
    const where = {};
    where.cpf = req.params.documento;
    await User.update(
        {
            password: bcrypt.hashSync(req.body.password, salt),
        },
        {
            where
        }
    )
        .then(us => {
            if (us) {
                User.findOne(
                    {
                        where
                    }
                )
                    .then((result) => {
                        res.send({
                            user: result,
                            message: "Senha atualizada com sucesso!",
                            sucesso: true
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
};