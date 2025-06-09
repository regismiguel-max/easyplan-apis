const db = require("../../../../models");
const Produtor =db.produtores;

checkDuplicateCPF = (req, res, next) => {
    Produtor.findOne({
        where: {
            cpf: req.params.cpf
        }
    }).then(co => {
        if (co) {
            res.status(400).send({
                message: "Atenção! O CPF já está em uso!",
                sucesso: false,
            });
            return;
        }
        else {
            res.status(200).send({
                message: "CPF não encontrado no sistema",
                sucesso: true,
            });
            return;
        }


    });
};

const verifyProdutor = {
    checkDuplicateCPF: checkDuplicateCPF
};

module.exports = verifyProdutor;