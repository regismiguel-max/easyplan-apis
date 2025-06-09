const db = require("../../../../../models");
const File = db.file;

exports.addFile = (req, res) => {
    File.create({
        name: req.body.name,
        descricao: req.body.descricao,
        pasta: req.body.pasta,
    })
        .then(file => {
            if (file) {
                res.send({
                    file: file,
                    message: "Arquivo criado com sucesso!",
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

exports.updateFile = async (req, res) => {
    await File.update(
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
        .then(file => {
            if (file) {
                File.findByPk(req.params.id)
                    .then((result) => {
                        res.send({
                            file: result,
                            message: "Arquivo atualizado com sucesso!",
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
    File.findAll(
        {
            order: [
                ['name', 'ASC']
            ],
        }
    )
        .then(file => {
            res.send({
                files: file,
                message: "Essa lista contém todos arquivos cadastrados no sistema!",
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

exports.findFile = (req, res) => {
    File.findByPk(req.params.id,
        {
            include: [
                {
                    model: db.operator,
                    include: [
                        {
                            model: db.document,
                        }
                    ]
                },
            ],
            order: [
                [db.operator, db.document, 'name', 'ASC']
            ],
        })
        .then(file => {
            res.send({
                file: file,
                message: "Essa lista contém o arquivo cadastrado no sistema!",
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

exports.deleteFile = async (req, res) => {
    await File.destroy({
        where: {
            id: req.params.id
        },
        include: [
            {
                model: db.operator,
                as: db.file,
                include: [
                    {
                        model: db.document,
                        as: db.operator,
                    }
                ]
            },
        ],
    }).then(file => {
        res.send({
            message: "Arquivo deletado com sucesso!",
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