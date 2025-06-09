const jwt = require("jsonwebtoken");
const config = require("../config/auth/auth.config.js");
const db = require("../../../../models");
const User = db.user;

verifyToken = (req, res, next) => {
    let token = req.headers["x-access-token"];

    if (!token) {
        return res.status(403).send({
            message: "Acesso negado. Nenhum token fornecido!"
        });
    }

    jwt.verify(token, config.privateKey, (err, decoded) => {
        if (err) {
            return res.status(401).send({
                message: "Não autorizado!"
            });
        }
        req.userId = decoded.id;
        next();
    });
};

verifyCredentials = (req, res, next) => {
    let key = req.headers["x-access-key"];

    if (!key) {
        return res.status(403).send({
            message: "Acesso negado. Nenhum chave fornecida!"
        });
    }
    else {
        if(String(key) === String(process.env.KEYAUTH)){
            next();
        }
        else {
            return res.status(403).send({
                message: "Acesso negado. Chave inválida!"
            });
        }
    }
};

isAdmin = (req, res, next) => {
    User.findByPk(req.userId).then(user => {
        user.getRoles().then(roles => {
            roles.forEach(role => {
                if (role.name === "admin") {
                    next();
                    return;
                }
                else {
                    res.status(403).send({
                        message: "Requer função de administrador!"
                    });
                    return;
                }
            });
        });
    });
};

isAgent = (req, res, next) => {
    User.findByPk(req.userId).then(user => {
        user.getRoles().then(roles => {
            roles.forEach(role => {
                if (role.name === "agent") {
                    next();
                    return;
                }
                else {
                    res.status(403).send({
                        message: "Exigir função de agente!"
                    });
                }
            });
        });
    });
};

isAgentOrAdmin = (req, res, next) => {
    User.findByPk(req.userId).then(user => {
        user.getRoles().then(roles => {
            roles.forEach(role => {
                if (role.name === "agent") {
                    next();
                    return;
                }

                else if (role.name === "admin") {
                    next();
                    return;
                }
                else {
                    res.status(403).send({
                        message: "Requer agente ou função de administrador!"
                    });
                }
            });
        });
    });
};

const authJwt = {
    verifyToken: verifyToken,
    verifyCredentials: verifyCredentials,
    isAdmin: isAdmin,
    isAgent: isAgent,
    isAgentOrAdmin: isAgentOrAdmin
};
module.exports = authJwt;