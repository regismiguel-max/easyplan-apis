const db = require("../../../../../models");
const Document = db.document;
const path = require('path');

exports.addDocument = (req, res) => {
    const baseUploadPath = path.resolve(__dirname, '../../../../../uploads');

    // Caminho absoluto real do arquivo salvo
    const fullFilePath = path.join(req.file.destination, req.file.filename);

    // Caminho relativo a /uploads
    const relativePath = path.relative(baseUploadPath, fullFilePath).replace(/\\/g, '/');

    // URL pública
    const host = `${process.env.PROTOCOL}://${process.env.DOMAIN}`;
    const publicUrl = `${host}/uploads/${relativePath}`;
    // Save Document to Database
    Document.create({
        name: req.body.name,
        descricao: req.body.descricao,
        imagemUrl: publicUrl,
        idPai: req.body.idPai,
        pasta: req.body.pasta
    })
        .then(doc => {
            if (doc) {
                doc.setOperators(req.body.idPai).then(() => {
                    res.send({
                        document: doc,
                        message: "Documento cadastrado com sucesso!",
                        sucesso: true
                    });
                });
            } else {
                res.status(401).send({ message: err.message });
            }
        })
        .catch(err => {
            res.status(500).send({ message: err.message });
        });
};

exports.updateDocument = async (req, res) => {
    await Document.update(
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
        .then(doc => {
            if (doc) {
                Document.findByPk(req.params.id)
                    .then((result) => {
                        res.send({
                            document: result,
                            message: "Documento atualizado com sucesso!",
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
    Document.findAll(
        {
            order: [
                ['name', 'ASC']
            ],
        }
    )
        .then(doc => {
            res.send({
                documents: doc,
                message: "Essa lista contém todos documentos cadastrados no sistema!"
            });
        })
        .catch(err => {
            res.status(500).send({ message: err.message })
        })
};

exports.findDocument = (req, res) => {
    Document.findByPk(req.params.id)
        .then(doc => {
            res.send({
                document: doc,
                message: "Essa lista contém o documento cadastrado no sistema!",
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

exports.deleteDocument = async (req, res) => {
    await Document.destroy({
        where: {
            id: req.params.id
        }
    }).then(doc => {
        res.send({
            message: "Documento deletado com sucesso!",
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