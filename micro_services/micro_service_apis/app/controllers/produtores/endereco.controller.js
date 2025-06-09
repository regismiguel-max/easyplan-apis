const db = require("../../../../../models");
const Endereco = db.produtores_enderecos;
const { where, Op } = require("sequelize");

exports.addEndereco = async (req, res) => {
    await Endereco.create({
        estado_ID: req.body.estado_ID,
        cidade_ID: req.body.cidade_ID,
        cep: req.body.cep,
        bairro: req.body.bairro,
        rua: req.body.rua,
        numero: req.body.numero,
        complemento: req.body.complemento,
    })
        .then(async end => {
            if (end) {
                res.send({
                    endereco: end,
                    message: "Endereço cadastrado com sucesso!",
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

exports.updateEndereco = async (req, res) => {
    await Endereco.update(
        {
            estado_ID: req.body.estado_ID,
            cidade_ID: req.body.cidade_ID,
            cep: req.body.cep,
            bairro: req.body.bairro,
            rua: req.body.rua,
            numero: req.body.numero,
            complemento: req.body.complemento,
        },
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(async end => {
            if (end) {
                res.send({
                    endereco: end,
                    message: "Endereço atualizado com sucesso!",
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
    Endereco.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ]
        }
    )
        .then(ends => {
            res.send({
                endenrecos: ends,
                message: "Essa lista contém todos os endereços cadastrados no sistema!",
                sucesso: true
            });
        })
        .catch(err => {
            res.status(500).send({
                message: 'err.message',
                sucesso: false
            })
        })
};

exports.findEndereco = (req, res) => {
    Endereco.findByPk(req.params.id)
        .then(end => {
            res.send({
                endereco: end,
                message: "Essa lista contém o endereço cadastrado no sistema!",
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

exports.deleteEndereco = async (req, res) => {
    await Endereco.destroy({
        where: {
            id: req.params.id
        },
    }).then(end => {
        res.send({
            message: "Endereço deletado com sucesso!",
            sucesso: true
        });
    }).catch(err => {
        res.status(401).send({
            message: err.message,
            sucesso: false
        });
    })
};