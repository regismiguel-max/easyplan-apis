const db = require("../../../../../models");
const CorretoraDocumento = db.corretoras_documentos;
const { where, Op } = require("sequelize");
const path = require('path');

exports.addCorretoraDocumento = async (req, res) => {
    const baseUploadPath = path.resolve(__dirname, '../../../../../uploads');

    // Caminho absoluto real do arquivo salvo
    const fullFilePath = path.join(req.file.destination, req.file.filename);

    // Caminho relativo a /uploads
    const relativePath = path.relative(baseUploadPath, fullFilePath).replace(/\\/g, '/');

    // URL pública
    const host = `${process.env.PROTOCOL}://${process.env.DOMAIN}`;
    const publicUrl = `${host}/uploads/${relativePath}`;
    CorretoraDocumento.create({
        documento_URL: publicUrl,
    })
        .then(doc => {
            if (doc) {
                res.send({
                    documento_corretora: doc,
                    message: "Documento da corretora cadastrado com sucesso!",
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

exports.updateCorretoraDocumento = async (req, res) => {
    const baseUploadPath = path.resolve(__dirname, '../../../../../uploads');

    // Caminho absoluto real do arquivo salvo
    const fullFilePath = path.join(req.file.destination, req.file.filename);

    // Caminho relativo a /uploads
    const relativePath = path.relative(baseUploadPath, fullFilePath).replace(/\\/g, '/');

    // URL pública
    const host = `${process.env.PROTOCOL}://${process.env.DOMAIN}`;
    const publicUrl = `${host}/uploads/${relativePath}`;
    await CorretoraDocumento.update(
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
                    documento_corretora: doc,
                    message: "Documento da corretora atualizado com sucesso!",
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
    CorretoraDocumento.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ]
        }
    )
        .then(docs => {
            res.send({
                documentos_corretoras: docs,
                message: "Essa lista contém todos os documentos de corretoras cadastrados no sistema!",
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

exports.findCorretoraDocumento = (req, res) => {
    CorretoraDocumento.findByPk(req.params.id)
        .then(doc => {
            res.send({
                documento_corretora: doc,
                message: "Essa lista contém o documento da corretora cadastrado no sistema!",
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

exports.deleteCorretoraDocumento = async (req, res) => {
    await CorretoraDocumento.destroy({
        where: {
            id: req.params.id
        },
    }).then(doc => {
        res.send({
            message: "documento da corretora deletado com sucesso!",
            sucesso: true
        });
    }).catch(err => {
        res.status(401).send({
            message: err.message,
            sucesso: false
        });
    })
};