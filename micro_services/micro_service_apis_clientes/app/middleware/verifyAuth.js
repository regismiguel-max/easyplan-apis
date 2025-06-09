const jwt = require("jsonwebtoken");
const config = require("../config/auth/auth.config.js");

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
        // req.userId = decoded.id;
        next();
    });
};

const verifyAuth = {
    verifyToken: verifyToken,
};
module.exports = verifyAuth;