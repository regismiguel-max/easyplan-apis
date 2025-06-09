const db = require("../../../../../models");
const ProdutorDocumento = db.produtores_documentos;
const { where, Op } = require("sequelize");
const path = require('path');

exports.addProdutorDocumento = async (req, res) => {
    const baseUploadPath = path.resolve(__dirname, '../../../../../uploads');

    // Caminho absoluto real do arquivo salvo
    const fullFilePath = path.join(req.file.destination, req.file.filename);

    // Caminho relativo a /uploads
    const relativePath = path.relative(baseUploadPath, fullFilePath).replace(/\\/g, '/');

    // URL pública
    const host = `${process.env.PROTOCOL}://${process.env.DOMAIN}`;
    const publicUrl = `${host}/uploads/${relativePath}`;
    ProdutorDocumento.create({
        documento_URL: publicUrl,
    })
        .then(doc => {
            if (doc) {
                res.send({
                    documento_produtor: doc,
                    message: "Documento do produtor cadastrado com sucesso!",
                    sucesso: true
                });
            } else {
                res.status(401).send({ message: err.message });
            }
        })
        .catch(err => {
            res.status(500).send({ message: err.message });
        });
};

exports.updateProdutorDocumento = async (req, res) => {
    const baseUploadPath = path.resolve(__dirname, '../../../../../uploads');

    // Caminho absoluto real do arquivo salvo
    const fullFilePath = path.join(req.file.destination, req.file.filename);

    // Caminho relativo a /uploads
    const relativePath = path.relative(baseUploadPath, fullFilePath).replace(/\\/g, '/');

    // URL pública
    const host = `${process.env.PROTOCOL}://${process.env.DOMAIN}`;
    const publicUrl = `${host}/uploads/${relativePath}`;
    await ProdutorDocumento.update(
        {
            documento_URL: publicUrl,
        },
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(async doc => {
            if (doc) {
                res.send({
                    documento_produtor: doc,
                    message: "Documento do produtor atualizado com sucesso!",
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
    ProdutorDocumento.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ]
        }
    )
        .then(docs => {
            res.send({
                documentos_produtores: docs,
                message: "Essa lista contém todos os documentos de produtores cadastrados no sistema!",
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

exports.findProdutorDocumento = (req, res) => {
    ProdutorDocumento.findByPk(req.params.id)
        .then(doc => {
            res.send({
                documento_produtor: doc,
                message: "Essa lista contém o documento do produtor cadastrado no sistema!",
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

exports.deleteProdutorDocumento = async (req, res) => {
    await ProdutorDocumento.destroy({
        where: {
            id: req.params.id
        },
    }).then(doc => {
        res.send({
            message: "documento do produtor deletado com sucesso!",
            sucesso: true
        });
    }).catch(err => {
        res.status(401).send({
            message: err.message,
            sucesso: false
        });
    })
};