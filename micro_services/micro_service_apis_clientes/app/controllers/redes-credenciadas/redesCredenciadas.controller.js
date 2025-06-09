const db = require("../../../../../models");
const Especialidade = db.redes_credenciadas_especialidade;
const Operadora = db.redes_credenciadas_operadora;
const PrestadorTipo = db.redes_credenciadas_prestador_tipo;
const Produto = db.redes_credenciadas_produto;
const RedeCredenciada = db.redes_credenciadas;
const path = require('path');

const xlsx = require('node-xlsx');
const googleMapsClient = require('@google/maps').createClient({
    key: process.env.GOOGLEMAPSKEY,
    Promise: Promise
});


exports.addLoteRedesCredenciadas = async (req, res) => {
    let sql1 = 'TRUNCATE TABLE app_clientes_redes_credenciadas;';
    let sql2 = 'TRUNCATE TABLE app_clientes_redes_credenciadas_especialidades;';
    let sql3 = 'TRUNCATE TABLE app_clientes_redes_credenciadas_operadoras;';
    let sql4 = 'TRUNCATE TABLE app_clientes_redes_credenciadas_prestador_tipos;';
    let sql5 = 'TRUNCATE TABLE app_clientes_redes_credenciadas_produtos;';

    db.sequelize.query(`${sql1}`, { type: db.sequelize.QueryTypes.TRUNCATE })
        .then(async (rc) => {
            db.sequelize.query(`${sql2}`, { type: db.sequelize.QueryTypes.TRUNCATE })
                .then(async (rce) => {
                    db.sequelize.query(`${sql3}`, { type: db.sequelize.QueryTypes.TRUNCATE })
                        .then(async (rco) => {
                            db.sequelize.query(`${sql4}`, { type: db.sequelize.QueryTypes.TRUNCATE })
                                .then(async (rcpt) => {
                                    db.sequelize.query(`${sql5}`, { type: db.sequelize.QueryTypes.TRUNCATE })
                                        .then(async (rcp) => {
                                            const baseUploadPath = path.resolve(__dirname, '../../../../../uploads');

                                            // Caminho absoluto real do arquivo salvo
                                            const fullFilePath = path.join(req.file.destination, req.file.filename);
                                        
                                            // Caminho relativo a /uploads
                                            const relativePath = path.relative(baseUploadPath, fullFilePath).replace(/\\/g, '/');
                                        
                                            // URL pública
                                            const host = `${process.env.PROTOCOL}://${process.env.DOMAIN}`;
                                            const publicUrl = `${host}/uploads/${relativePath}`;
                                            const filePath = publicUrl;
                                            const plan = await xlsx.parse(filePath);

                                            addCreate(plan, host, filePath, res, 1);
                                        })
                                        .catch(async err => {
                                            ReturnError(res, err);
                                        });
                                })
                                .catch(async err => {
                                    ReturnError(res, err);
                                });
                        })
                        .catch(async err => {
                            ReturnError(res, err);
                        });
                })
                .catch(async err => {
                    ReturnError(res, err);
                });
        })
        .catch(async err => {
            ReturnError(res, err);
        });
};

exports.addLoteRedesCredenciadasSemExclusao = async (req, res) => {
    const baseUploadPath = path.resolve(__dirname, '../../../../../uploads');

    // Caminho absoluto real do arquivo salvo
    const fullFilePath = path.join(req.file.destination, req.file.filename);

    // Caminho relativo a /uploads
    const relativePath = path.relative(baseUploadPath, fullFilePath).replace(/\\/g, '/');

    // URL pública
    const host = `${process.env.PROTOCOL}://${process.env.DOMAIN}`;
    const publicUrl = `${host}/uploads/${relativePath}`;
    const filePath = publicUrl;
    const plan = await xlsx.parse(filePath);

    addCreate(plan, host, filePath, res, 1);
};

addCreate = async (plan, host, filePath, res, index) => {
    if (plan[0].data.length - 1 === index) {
        addEspecialidade(plan, host, filePath, res, plan[0].data[index], true, index);
    }
    else {
        addEspecialidade(plan, host, filePath, res, plan[0].data[index], false, index);
    }
}


addEspecialidade = async (plan, host, filePath, res, element, isend, index) => {
    Especialidade.findOne(
        {
            where: {
                especialidade: element[11],
            }
        }
    )
        .then(async especialidade1 => {
            if (especialidade1) {
                addOperadora(plan, host, filePath, res, element, especialidade1, isend, index)
            }
            else {
                await Especialidade.create({
                    especialidade: element[11],
                })
                    .then(async especialidade2 => {
                        addOperadora(plan, host, filePath, res, element, especialidade2, isend, index)
                    })
                    .catch(err => {
                        ReturnError(res, err);
                    });
            }
        })
        .catch(err => {
            ReturnError(res, err);
        })
}

addOperadora = async (plan, host, filePath, res, element, especialidade, isend, index) => {
    Operadora.findOne(
        {
            where: {
                operadora: element[0],
            }
        }
    )
        .then(async operadora1 => {
            if (operadora1) {
                addPrestadorTipo(plan, host, filePath, res, element, operadora1, especialidade, isend, index);
            }
            else {
                await Operadora.create({
                    operadora: element[0],
                })
                    .then(async operadora2 => {
                        addPrestadorTipo(plan, host, filePath, res, element, operadora2, especialidade, isend, index);
                    })
                    .catch(err => {
                        ReturnError(res, err);
                    });
            }
        })
        .catch(err => {
            ReturnError(res, err);
        })
}

addPrestadorTipo = async (plan, host, filePath, res, element, operadora, especialidade, isend, index) => {
    PrestadorTipo.findOne(
        {
            where: {
                prestador_tipo: element[3],
            }
        }
    )
        .then(async prestadortipo1 => {
            if (prestadortipo1) {
                addProduto(plan, host, filePath, res, element, prestadortipo1, operadora, especialidade, isend, index);
            }
            else {
                await PrestadorTipo.create({
                    prestador_tipo: element[3],
                })
                    .then(async prestadortipo2 => {
                        addProduto(plan, host, filePath, res, element, prestadortipo2, operadora, especialidade, isend, index);
                    })
                    .catch(err => {
                        ReturnError(res, err);
                    });
            }
        })
        .catch(err => {
            ReturnError(res, err);
        })
}

addProduto = async (plan, host, filePath, res, element, prestadortipo, operadora, especialidade, isend, index) => {
    Produto.findOne(
        {
            where: {
                produto: element[1],
            }
        }
    )
        .then(async produto1 => {
            if (produto1) {
                getCoordenadas(plan, host, filePath, res, element, produto1, prestadortipo, operadora, especialidade, isend, index);
            }
            else {
                await Produto.create({
                    produto: element[1],
                })
                    .then(async produto2 => {
                        getCoordenadas(plan, host, filePath, res, element, produto2, prestadortipo, operadora, especialidade, isend, index);
                    })
                    .catch(err => {
                        ReturnError(res, err);
                    });
            }
        })
        .catch(err => {
            ReturnError(res, err);
        })
}

getCoordenadas = async (plan, host, filePath, res, element, produto, prestadortipo, operadora, especialidade, isend, index) => {
    googleMapsClient.geocode({
        address: `${element[8]}, ${element[10]}, ${element[9]}, ${element[7]}, ${element[5]}`
    })
        .asPromise()
        .then((response) => {
            addRedeCredenciada(plan, host, filePath, res, element, response.json.results[0].geometry.location.lat, response.json.results[0].geometry.location.lng, produto, prestadortipo, operadora, especialidade, isend, index);
        })
        .catch((err) => {
            addRedeCredenciada(plan, host, filePath, res, element, '', '', produto, prestadortipo, operadora, especialidade, isend, index);
        });
}

addRedeCredenciada = async (plan, host, filePath, res, element, lat, lng, produto, prestadortipo, operadora, especialidade, isend, index) => {
    if (isend) {
        await RedeCredenciada.create({
            operadora_ID: operadora.id,
            operadora: operadora.operadora,
            produto_ID: produto.id,
            produto: produto.produto,
            prestador_tipo_ID: prestadortipo.id,
            prestador_tipo: prestadortipo.prestador_tipo,
            prestador: element[2],
            uf_ID: element[4] ? element[4] : '',
            uf: element[5] ? element[5] : '',
            municipio_ID: element[6] ? element[6] : '',
            municipio: element[7] ? element[7] : '',
            logradouro: element[8] ? element[8] : '',
            bairro: element[9] ? element[9] : '',
            numero: element[10] ? element[10] : '',
            latitude: lat ? lat : '',
            longitude: lng ? lng : '',
            especialidade_ID: especialidade.id,
            especialidade: especialidade.especialidade,
            arquivo_url: `${host}${filePath}`,
            disabled: false,
        })
            .then(async rede1 => {
                ReturnSuccess(res);
            })
            .catch(err => {
                ReturnError(res, err);
            });
    }
    else {
        await RedeCredenciada.create({
            operadora_ID: operadora.id,
            operadora: operadora.operadora,
            produto_ID: produto.id,
            produto: produto.produto,
            prestador_tipo_ID: prestadortipo.id,
            prestador_tipo: prestadortipo.prestador_tipo,
            prestador: element[2],
            uf_ID: element[4] ? element[4] : '',
            uf: element[5] ? element[5] : '',
            municipio_ID: element[6] ? element[6] : '',
            municipio: element[7] ? element[7] : '',
            logradouro: element[8] ? element[8] : '',
            bairro: element[9] ? element[9] : '',
            numero: element[10] ? element[10] : '',
            latitude: lat ? lat : '',
            longitude: lng ? lng : '',
            especialidade_ID: especialidade.id,
            especialidade: especialidade.especialidade,
            arquivo_url: `${host}${filePath}`,
            disabled: false,
        })

            .then(async rede1 => {
                let i = Number(index) + 1;
                addCreate(plan, host, filePath, res, i);
            })
            .catch(err => {
                ReturnError(res, err);
            });
    }

}

ReturnSuccess = async (res) => {
    RedeCredenciada.findAll()
        .then(async redes => {
            res.send({
                redesCredenciadas: redes,
                message: "Redes credenciadas cadastradas com sucesso!",
                sucesso: true
            });
        })
        .catch(err => {
            ReturnError(res, err);
        })
}

ReturnError = async (res, err) => {
    res.status(500).send({
        message: err.message,
        sucesso: false
    });
}

exports.getLoteRedesCredenciadas = async (req, res) => {
    const where = {};
    if (req.query.disabled) {
        where.disabled = req.query.disabled;
    }
    else {
        where.disabled = false;
    }

    const limit = Number(req.query.size) ? Number(req.query.size) : 100;
    const offset = Number(req.query.page) ? Number(req.query.size) ? Number(req.query.page) * Number(req.query.size) : 0 : 0;

    RedeCredenciada.findAndCountAll(
        {
            where,
            limit: limit,
            offset: offset,
        }
    )
        .then(redes => {
            const totalItems = redes.count;
            const currentPage = Number(req.query.page) ? Number(req.query.size) ? Number(req.query.page) : 0 : 0;
            const totalPages = Math.ceil(Number(totalItems) / Number(limit));
            res.send({
                redesCredenciadas: redes.rows,
                totalItems: totalItems,
                currentPage: currentPage,
                totalPages: totalPages,
                message: "Essa lista contém as redes credenciadas cadastradas no sistema!",
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

exports.getEspecialidadesAll = async (req, res) => {
    Especialidade.findAll()
        .then(esp => {
            res.send({
                especialidades: esp,
                message: "Essa lista contém as especialidades cadastradas no sistema!",
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

exports.getProdutosAll = async (req, res) => {
    Produto.findAll()
        .then(pro => {
            res.send({
                produtos: pro,
                message: "Essa lista contém os produtos cadastrados no sistema!",
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

exports.searchRedesCredenciadas = async (req, res) => {
    const where = {};
    if (req.body.especialidadeID) {
        where.especialidade_ID = req.body.especialidadeID;
    };

    if (req.body.produtoID) {
        where.produto_ID = req.body.produtoID;
    };

    if (req.body.produto) {
        where.produto = req.body.produto;
    };

    if (req.body.estadoID) {
        where.uf_ID = req.body.estadoID;
    };

    if (req.body.cidadeID && req.body.cidadeID !== 0 && req.body.cidadeID !== '0') {
        where.municipio_ID = req.body.cidadeID;
    };

    if (req.body.disabled) {
        where.disabled = req.body.disabled;
    }
    else {
        where.disabled = false;
    }

    const limit = Number(req.body.size) ? Number(req.body.size) : 100;
    const offset = Number(req.body.page) ? Number(req.body.size) ? Number(req.body.page) * Number(req.body.size) : 0 : 0;

    RedeCredenciada.findAndCountAll(
        {
            where,
            limit: limit,
            offset: offset,
        }
    )
        .then(redes => {
            const totalItems = redes.count;
            const currentPage = Number(req.body.page) ? Number(req.body.size) ? Number(req.body.page) : 0 : 0;
            const totalPages = Math.ceil(Number(totalItems) / Number(limit));
            res.send({
                redesCredenciadas: redes.rows,
                totalItems: totalItems,
                currentPage: currentPage,
                totalPages: totalPages,
                message: "Essa lista contém as redes credenciadas cadastradas no sistema!",
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