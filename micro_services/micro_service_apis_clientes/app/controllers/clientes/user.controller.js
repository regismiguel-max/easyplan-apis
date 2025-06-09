const db = require("../../../../../models");
const config = require("../../config/auth/auth.config");
const User = db.user_client;
const { where, Op } = require("sequelize");

var CryptoJS = require("crypto-js");
var bcrypt = require("bcryptjs");
var salt = bcrypt.genSaltSync(Number(process.env.SALT));

exports.addUser = (req, res) => {
    User.create({
        adesaoID: req.body.adesaoID,
        apolice: req.body.apolice,
        birth_date: req.body.birth_date,
        cnpj: req.body.cnpj,
        contratoID: req.body.contratoID,
        cpf: req.body.cpf,
        email: req.body.email,
        name: req.body.name,
        password: bcrypt.hashSync(req.body.password, salt),
        telefone: req.body.telefone,
        token: req.body.token
    })
        .then(user => {
            res.send({
                user,
                message: "O usuário foi cadastrado com sucesso!",
                sucesso: true
            });
        })
        .catch(err => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            });
        });
};

exports.addUsers = (req, res) => {
    let i = req.body.length;
    req.body.forEach(async (element, index) => {
        if (index === i - 1) {
            const bytes = await CryptoJS.AES.decrypt(element.password, 'GjNn|%tQ_3i-n2FKwA>q2NK@L3£!{K9m>£^>3c;9\]}@6EHyu%');
            const originalPassword = await bytes.toString(CryptoJS.enc.Utf8);
            await User.create({
                adesaoID: element.adesaoID,
                apolice: element.apolice,
                birth_date: element.birth_date,
                cnpj: element.cnpj ? element.cnpj.replace(/\D/g, '') : '',
                contratoID: element.contratoID,
                cpf: element.cpf ? element.cpf.replace(/\D/g, '') : '',
                email: element.email,
                name: element.name,
                password: bcrypt.hashSync(originalPassword, salt),
                telefone: element.telefone ? element.telefone.replace(/\D/g, '') : '',
                token: element.token
            })
                .then(user => {
                    res.send({
                        message: "Os usuários foram cadastrados com sucesso!",
                        sucesso: true
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
            const bytes = await CryptoJS.AES.decrypt(element.password, 'GjNn|%tQ_3i-n2FKwA>q2NK@L3£!{K9m>£^>3c;9\]}@6EHyu%');
            const originalPassword = await bytes.toString(CryptoJS.enc.Utf8);
            await User.create({
                adesaoID: element.adesaoID,
                apolice: element.apolice,
                birth_date: element.birth_date,
                cnpj: element.cnpj ? element.cnpj.replace(/\D/g, '') : '',
                contratoID: element.contratoID,
                cpf: element.cpf ? element.cpf.replace(/\D/g, '') : '',
                email: element.email,
                name: element.name,
                password: bcrypt.hashSync(originalPassword, salt),
                telefone: element.telefone ? element.telefone.replace(/\D/g, '') : '',
                token: element.token
            })
                .then(user => { })
                .catch(err => { });
        }
    });
}

exports.addUsersFirebase = async (req, res) => {
    try {
        // Limpeza de dados
        const cpf = req.body.cpf?.replace(/\D/g, '') || '';
        const cnpj = req.body.cnpj?.replace(/\D/g, '') || '';
        const isCPF = cpf.length === 11;

        const where = isCPF ? { cpf } : { cnpj };

        // Verifica se usuário já existe
        const usuarioExistente = await User.findOne({ where });

        if (usuarioExistente) {
            return res.send({
                message: 'Usuário já cadastrado no sistema!',
                newUser: false,
                sucesso: true
            });
        }

        // Descriptografa a senha
        let originalPassword = null;
        try {
            if (req.body.password) {
                const decrypted = await CryptoJS.AES.decrypt(req.body.password, 'GjNn|%tQ_3i-n2FKwA>q2NK@L3£!{K9m>£^>3c;9\]}@6EHyu%');
                originalPassword = await decrypted.toString(CryptoJS.enc.Utf8);
                if (!originalPassword) throw new Error('Senha inválida');
            } else {
                originalPassword = cpf || cnpj;
            }
        } catch (err) {
            return res.status(400).send({
                message: 'Erro ao descriptografar a senha.',
                sucesso: false
            });
        }

        // Criptografa com bcrypt
        const hashedPassword = bcrypt.hashSync(originalPassword, salt);

        // Criação do novo usuário
        const novoUsuario = await User.create({
            adesaoID: req.body.adesaoID ?? '',
            apolice: req.body.apolice ?? '',
            birth_date: req.body.birth_date ?? '',
            cnpj,
            contratoID: req.body.contratoID ?? '',
            cpf,
            email: req.body.email ?? '',
            name: req.body.name ?? '',
            password: hashedPassword,
            telefone: req.body.telefone?.replace(/\D/g, '') ?? '',
            token: req.body.token ?? ''
        });

        return res.send({
            message: 'Usuário cadastrado com sucesso!',
            newUser: true,
            sucesso: true
        });

    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        return res.status(500).send({
            message: error.message || 'Erro interno do servidor.',
            sucesso: false
        });
    }
};


exports.updateUser = async (req, res) => {
    const where = {};
    if (req.body.documento.length === 11) {
        where.cpf = req.body.documento;
    }
    else {
        where.cnpj = req.body.documento;
    }
    await User.update(
        {
            adesaoID: req.body.adesaoID,
            apolice: req.body.apolice,
            birth_date: req.body.birth_date,
            cnpj: req.body.cnpj,
            contratoID: req.body.contratoID,
            cpf: req.body.cpf,
            email: req.body.email,
            name: req.body.name,
            telefone: req.body.telefone,
            token: req.body.token
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
                            message: "Usuário atualizado com sucesso!",
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

exports.updatePasswordUser = async (req, res) => {
    const where = {};
    if (req.params.documento.length === 11) {
        where.cpf = req.params.documento;
    }
    else {
        where.cnpj = req.params.documento;
    }
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

exports.findUsers = (req, res) => {
    User.findAll()
        .then(us => {
            res.send({
                users: us,
                message: "Essa lista contém os usuáruios clientes cadastrados no sistema!",
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

exports.findUser = (req, res) => {
    const where = {};
    if (req.params.documento.length === 11) {
        where.cpf = req.params.documento;
    }
    else {
        where.cnpj = req.params.documento;
    }

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

exports.deleteUser = async (req, res) => {
    const where = {};
    if (req.body.documento.length === 11) {
        where.cpf = req.body.documento;
    }
    else {
        where.cnpj = req.body.documento;
    }

    await User.destroy(
        {
            where
        }
    ).then(us => {
        res.send({
            message: "Usuário excluido com sucesso!",
            sucesso: true
        });
    })
        .catch(err => {
            res.status(401).send({
                message: err.message,
                sucesso: false
            });
        })
};