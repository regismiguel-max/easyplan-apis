const db = require("../../../../models");
const User = db.user_client;

checkDuplicateDocument = (req, res, next) => {
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
    ).then(co => {
        if (co) {
            res.status(400).send({
                message: "Atenção! O documento já está em uso!",
                sucesso: false,
            });
            return;
        }
        else {
            res.status(200).send({
                message: "Documento não encontrado no sistema",
                sucesso: true,
            });
            return;
        }


    });
};

checkDuplicateEmail = (req, res, next) => {
    User.findOne({
        where: {
            email: req.body.email
        }
    }).then(user => {
        if (user) {
            res.status(400).send({
                message: "Atenção! O e-mail já está em uso!"
            });
            return;
        }

        next();
    });
};


const verifyCliente = {
    checkDuplicateDocument: checkDuplicateDocument,
    checkDuplicateEmail: checkDuplicateEmail,
};

module.exports = verifyCliente;