const db = require("../../../../../models");
const Contato = db.contatos_operadoras;
const { where, Op } = require("sequelize");


exports.addContato = (req, res) => {
    Contato.create({
        name: req.body.name,
        canal: req.body.canal,
        location: req.body.location,
        telefone: req.body.telefone,
        email: req.body.email,
        codigo: req.body.codigo,
        descricao: req.body.descricao,
        obs: req.body.obs
    })
        .then(cont => {
            res.send({
                contato: cont,
                message: "O contato foi cadastrado com sucesso!",
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

exports.findContatos = (req, res) => {
    const where = {};
    if (req.params.codigo) {
        where.codigo = ['easy', req.params.codigo];
    }
    Contato.findAll(
        {
            where
        }
    )
        .then(cont => {
            res.send({
                contatos: cont,
                message: "Essa lista contém os contatos cadastrados no sistema!",
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
