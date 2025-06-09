const db = require("../../../../models");
const ROLES = db.ROLES;
const User = db.user;

checkDuplicateEmail = (req, res, next) => {
    // Email
    User.findOne({
        where: {
            email: req.body.email
        }
    }).then(user => {
        if (user) {
            res.status(400).send({
                message: "Falhou! o e-mail já está sendo usado!"
            });
            return;
        }

        next();
    });
};

checkDuplicateCPF = (req, res, next) => {
    // CPF
    User.findOne({
        where: {
            cpf: req.body.cpf
        }
    }).then(user => {
        if (user) {
            res.status(400).send({
                message: "Falhou! o cpf já está sendo usado!"
            });
            return;
        }

        next();
    });
};

checkRolesExisted = (req, res, next) => {
    if (req.body.roles) {
        for (let i = 0; i < req.body.roles.length; i++) {
            if (!ROLES.includes(req.body.roles[i])) {
                res.status(400).send({
                    message: "Falhou! A função não existe = " + req.body.roles[i]
                });
                return;
            }
        }
    }

    next();
};

const verifySignUp = {
    checkDuplicateEmail: checkDuplicateEmail,
    checkDuplicateCPF: checkDuplicateCPF,
    checkRolesExisted: checkRolesExisted
};

module.exports = verifySignUp;