const db = require("../../../../../models");
const Operator = db.operator;

exports.addOperator = (req, res) => {
    Operator.create({
        name: req.body.name,
        descricao: req.body.descricao,
        idPai: req.body.idPai,
        pasta: req.body.pasta,
    })
        .then(op => {
            if (op) {
                op.setFiles(req.body.idPai).then(() => {
                    res.send({
                        operator: op,
                        message: "Operadora salva com sucesso!",
                        sucesso: true
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

exports.updateOperator = async (req, res) => {
    await Operator.update(
        {
            name: req.body.name,
            descricao: req.body.descricao,
        },
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(op => {
            if (op) {
                Operator.findByPk(req.params.id)
                    .then((result) => {
                        res.send({
                            operator: result,
                            message: "Operadora atualizado com sucesso!",
                            sucesso: true
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

exports.findAll = (req, res) => {
    Operator.findAll(
        {
            order: [
                ['name', 'ASC']
            ],
        }
    )
        .then(ops => {
            res.send({
                operators: ops,
                message: "Essa lista contém todas as operadoras cadastradas no sistema!",
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

exports.findOperator = (req, res) => {
    Operator.findByPk(req.params.id,
        {
            include: [
                db.document,
            ],
        }
    )
        .then(op => {
            res.send({
                operator: op,
                message: "Essa lista contém a operadora cadastrada no sistema!",
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

exports.deleteOperator = async (req, res) => {
    await Operator.destroy({
        where: {
            id: req.params.id
        }
    }).then(op => {
        res.send({
            message: "Operadora deletada com sucesso!",
            sucesso: true
        });

    })
        .catch(err => {
            res.status(401).send({
                message: err.message,
                sucesso: false
            });
        })
};