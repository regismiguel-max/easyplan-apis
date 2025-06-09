const db = require("../../../../../models");
const Categoria = db.corretoras_categorias;
const { where, Op } = require("sequelize");

exports.addCategoria = async (req, res) => {
    await Categoria.create({
        nome: req.body.nome,
        descricao: req.body.descricao,
    })
        .then(async ca => {
            if (ca) {
                res.send({
                    categoria: ca,
                    message: "Categoria cadastrada com sucesso!",
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

exports.updateCategoria = async (req, res) => {
    await Categoria.update(
        {
            nome: req.body.nome,
            descricao: req.body.descricao,
        },
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(async ca => {
            if (ca) {
                res.send({
                    categoria: ca,
                    message: "Categoria atualizada com sucesso!",
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
    Categoria.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ]
        }
    )
        .then(ca => {
            res.send({
                categorias: ca,
                message: "Essa lista contém todas as categoria cadastradas no sistema!",
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

exports.findCategoria = (req, res) => {
    Categoria.findByPk(req.params.id)
        .then(ca => {
            res.send({
                categoria: ca,
                message: "Essa lista contém a categoria cadastrada no sistema!",
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

exports.deleteCategoria = async (req, res) => {
    await Categoria.destroy({
        where: {
            id: req.params.id
        },
    }).then(ca => {
        res.send({
            message: "Categoria deletada com sucesso!",
            sucesso: true
        });
    }).catch(err => {
        res.status(401).send({
            message: err.message,
            sucesso: false
        });
    })
};