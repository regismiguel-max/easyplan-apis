const db = require("../../../../../../models");
const File = db.file;

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
