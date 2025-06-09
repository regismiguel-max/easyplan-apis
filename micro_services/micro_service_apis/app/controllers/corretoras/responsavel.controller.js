const db = require("../../../../../models");
const Responsavel = db.corretoras_responsavels;
const { where, Op } = require("sequelize");

exports.addResponsavel = async (req, res) => {
    await Responsavel.create({
        nome: req.body.nome,
        documento_CPF: req.body.documento_CPF,
        documento_RG: req.body.documento_RG,
        documento_SSP: req.body.documento_SSP,
        documento_ID: req.body.documento_ID,
    })
        .then(async re => {
            if (re) {
                let sql = 'INSERT INTO `corretora_responsavel_documento` (`responsavel_ID`, `documento_ID`) VALUES (';
                db.sequelize.query(`${sql}${re.id}, ${req.body.documento_ID})`, { type: db.sequelize.QueryTypes.INSERT })
                    .then((resp) => {
                        res.send({
                            responsavel: re,
                            message: "Responsável cadastrado com sucesso!",
                            sucesso: true
                        });
                    })
                    .catch(err => {
                        res.status(500).send({
                            message: err.message,
                            sucesso: false
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

exports.updateResponsavel = async (req, res) => {
    await Responsavel.update(
        {
            nome: req.body.nome,
            documento_CPF: req.body.documento_CPF,
            documento_RG: req.body.documento_RG,
            documento_SSP: req.body.documento_SSP,
            documento_ID: req.body.documento_ID,
        },
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(async resp => {
            if (resp) {
                res.send({
                    responsavel: resp,
                    message: "Responsável atualizado com sucesso!",
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

exports.findAll = (req, res) => {
    Responsavel.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ]
        }
    )
        .then(re => {
            res.send({
                responsavels: re,
                message: "Essa lista contém todas os responsáveis cadastrados no sistema!",
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

exports.findResponsavel = (req, res) => {
    Contato.findByPk(req.params.id)
        .then(re => {
            res.send({
                responsavel: re,
                message: "Essa lista contém o responsável cadastrado no sistema!",
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

exports.deleteResponsavel = async (req, res) => {
    await Responsavel.destroy({
        where: {
            id: req.params.id
        },
    }).then(re => {
        res.send({
            message: "Responsável deletado com sucesso!",
            sucesso: true
        });
    }).catch(err => {
        res.status(401).send({
            message: err.message,
            sucesso: false
        });
    })
};