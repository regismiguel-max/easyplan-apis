const config = require("../../../config/auth/auth.config");
var jwt = require("jsonwebtoken");

exports.createToken = async (req, res) => {
    var token = await jwt.sign({}, config.privateKey, {
        expiresIn: 2592000000 // 30 dias
        // expiresIn: 86400 // 1 dia
    });

    if (token) {
        res.status(200).send({
            accessToken: token,
            message: 'Token criado com sucesso!',
            sucesso: true
        });
    }
    else {
        res.status(500).send({
            message: 'Não foi possível gerar o token, tente novamente',
            sucesso: false
        });
    }
}