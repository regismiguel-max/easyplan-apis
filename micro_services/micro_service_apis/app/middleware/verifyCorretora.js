const db = require("../../../../models");
const Corretora = db.corretoras;

checkDuplicateCNPJ = (req, res, next) => {
    // CNPJ
    Corretora.findOne({
        where: {
            cnpj: req.params.cnpj
        }
    }).then(co => {
        if (co) {
            res.status(400).send({
                message: "Atenção! O CNPJ já está em uso!",
                sucesso: false,
            });
            return;
        }
        else {
            res.status(200).send({
                message: "CNPJ não encontrado no sistema",
                sucesso: true,
            });
            return;
        }


    });
};


const verifyCorretora = {
    checkDuplicateCNPJ: checkDuplicateCNPJ,
};

module.exports = verifyCorretora;