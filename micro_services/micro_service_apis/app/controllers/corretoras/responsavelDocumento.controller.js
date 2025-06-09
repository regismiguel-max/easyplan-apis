const db = require("../../../../../models");
const ResponsavelDocumento = db.corretoras_responsavels_documentos;
const { where, Op } = require("sequelize");
const path = require('path');

exports.addResponsavelDocumento = async (req, res) => {
    const baseUploadPath = path.resolve(__dirname, '../../../../../uploads');

    // Caminho absoluto real do arquivo salvo
    const fullFilePath = path.join(req.file.destination, req.file.filename);

    // Caminho relativo a /uploads
    const relativePath = path.relative(baseUploadPath, fullFilePath).replace(/\\/g, '/');

    // URL pública
    const host = `${process.env.PROTOCOL}://${process.env.DOMAIN}`;
    const publicUrl = `${host}/uploads/${relativePath}`;
    ResponsavelDocumento.create({
        documento_URL: publicUrl,
    })
        .then(doc => {
            if (doc) {
                res.send({
                    documento_responsavel: doc,
                    message: "Documento do responsável cadastrado com sucesso!",
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

exports.updateResponsavelDocumento = async (req, res) => {
    const baseUploadPath = path.resolve(__dirname, '../../../../../uploads');

    // Caminho absoluto real do arquivo salvo
    const fullFilePath = path.join(req.file.destination, req.file.filename);

    // Caminho relativo a /uploads
    const relativePath = path.relative(baseUploadPath, fullFilePath).replace(/\\/g, '/');

    // URL pública
    const host = `${process.env.PROTOCOL}://${process.env.DOMAIN}`;
    const publicUrl = `${host}/uploads/${relativePath}`;
    await ResponsavelDocumento.update(
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
                    documento_responsavel: doc,
                    message: "Documento do responsável atualizado com sucesso!",
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
    ResponsavelDocumento.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ]
        }
    )
        .then(docs => {
            res.send({
                documentos_responsavels: docs,
                message: "Essa lista contém todos os documentos dos responsáveis cadastrados no sistema!",
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

exports.findResponsavelDocumento = (req, res) => {
    ResponsavelDocumento.findByPk(req.params.id)
        .then(doc => {
            res.send({
                documento_responsavel: doc,
                message: "Essa lista contém o documento da responsável cadastrado no sistema!",
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

exports.deleteResponsavelDocumento = async (req, res) => {
    await ResponsavelDocumento.destroy({
        where: {
            id: req.params.id
        },
    }).then(doc => {
        res.send({
            message: "documento do responsável deletado com sucesso!",
            sucesso: true
        });
    }).catch(err => {
        res.status(401).send({
            message: err.message,
            sucesso: false
        });
    })
};