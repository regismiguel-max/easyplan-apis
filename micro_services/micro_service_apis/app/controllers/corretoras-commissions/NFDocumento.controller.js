const db = require("../../../../../models");
const SubLoteCommissions = db.corretoras_subLoteCommissions;
const Commissions = db.corretoras_commission;
const NFDocumento = db.corretoras_commission_nf;

const xlsx = require('node-xlsx');
const moment = require('moment');
const { where, Op } = require("sequelize");
const path = require('path');


exports.addNFDocumento = async (req, res) => {
    const baseUploadPath = path.resolve(__dirname, '../../../../../uploads');

    // Caminho absoluto real do arquivo salvo
    const fullFilePath = path.join(req.file.destination, req.file.filename);

    // Caminho relativo a /uploads
    const relativePath = path.relative(baseUploadPath, fullFilePath).replace(/\\/g, '/');

    // URL pública
    const host = `${process.env.PROTOCOL}://${process.env.DOMAIN}`;
    const publicUrl = `${host}/uploads/${relativePath}`;
    console.log(req.body.valorLiquido);

    await NFDocumento.create({
        documento_URL: publicUrl,
        situacao_ID: 3,
        motivo: 'Upload para análise',
        valor_liquido: req.body.valorLiquido ? req.body.valorLiquido : null,
        data_emissao: req.body.dataEmissao ? req.body.dataEmissao : null,
        numero_NF: req.body.numeroNF ? req.body.numeroNF : null,
        validated: req.body.validated ? req.body.validated : false,
    })
        .then(async nf => {
            if (nf) {
                await SubLoteCommissions.update(
                    {
                        nf_ID: nf.id,
                        situacao_ID: 3,
                        disabled: false,
                    },
                    {
                        where: {
                            id: req.params.id,
                        }
                    }
                )
                    .then(async sub => {
                        if (sub) {
                            await Commissions.findAll({
                                where: {
                                    sub_lote_commissions_ID: req.params.id
                                }
                            }).then(async co => {
                                let i = co.length;
                                co.forEach((element, index) => {
                                    if (index === i - 1) {
                                        Commissions.update(
                                            {
                                                nf_ID: nf.id,
                                                situacao_ID: 3,
                                            },
                                            {
                                                where: {
                                                    id: element.id
                                                },
                                            }
                                        ).then(async c => {
                                            let sql = 'INSERT INTO `corretora_commissions_sub_lote_nf` (`sub_lote_ID`, `nf_ID`) VALUES (';
                                            db.sequelize.query(`${sql}${req.params.id}, ${nf.id})`, { type: db.sequelize.QueryTypes.INSERT })
                                                .then(async (doc) => {
                                                    res.send({
                                                        nf: nf,
                                                        message: "Nota fiscal cadastrada com sucesso!",
                                                        sucesso: true
                                                    });
                                                }).catch(err => {
                                                    res.status(401).send({
                                                        message: err.message,
                                                        sucesso: false
                                                    });
                                                });
                                        }).catch(err => {
                                            res.status(401).send({
                                                message: err.message,
                                                sucesso: false
                                            });
                                        })

                                    }
                                    else {
                                        Commissions.update(
                                            {
                                                nf_ID: nf.id,
                                                situacao_ID: 3,
                                            },
                                            {
                                                where: {
                                                    id: element.id
                                                },
                                            }
                                        )
                                    }
                                });
                            }).catch(err => {
                                res.status(401).send({
                                    message: err.message,
                                    sucesso: false
                                });
                            });
                        } else {
                            res.status(401).send({ message: err.message });
                        }
                    })
                    .catch(err => {
                        res.status(500).send({ message: err.message });
                    });
            } else {
                res.status(401).send({ message: err.message });
            }
        })
        .catch(err => {
            res.status(500).send({ message: err.message });
        });
};

exports.findAll = (req, res) => {
    NFDocumento.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ],
        }
    )
        .then(nfs => {
            res.send({
                nfs: nfs,
                message: "Essa lista contém todas as notas fiscais cadastradas no sistema!",
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


exports.findNFDocumento = (req, res) => {
    NFDocumento.findByPk(req.params.id
    )
        .then(nf => {
            res.send({
                nf: nf,
                message: "Essa lista contém a nota fiscal cadastrada no sistema!",
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

exports.deleteNFDocumento = async (req, res) => {
    await NFDocumento.destroy({
        where: {
            id: req.params.id
        },
    }).then(nf => {
        res.send({
            message: "Nota fiscal deletada com sucesso!",
            sucesso: true
        });
    }).catch(err => {
        res.status(401).send({
            message: err.message,
            sucesso: false
        });
    })
};