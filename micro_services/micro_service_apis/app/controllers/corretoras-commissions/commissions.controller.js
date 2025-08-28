const db = require("../../../../../models");
const Commission = db.corretoras_commission;
const { where, Op, QueryTypes } = require("sequelize");
const { sequelize } = require('../../../../../models');

// Helpers
const norm = (v) => (v == null ? '' : String(v));
const makeKey = (codigo, numeroParcela, documento) =>
    `${norm(codigo)}::${norm(numeroParcela)}::${norm(documento)}`;

const chunkArray = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

exports.addCommission = (req, res) => {
    Commission.create({
        cliente: req.body.client,
        documento: req.body.document,
        comissao: req.body.comissao,
        previsao: req.body.previsao,
        dataPagamento: req.body.dataPagamento,
        vigencia: req.body.vigencia,
        status: req.body.status,
        prudutor: req.body.prudutor,
        idLoteCommissions: req.body.idLoteCommissions,
    })
        .then(co => {
            if (co) {
                res.send({
                    commission: co,
                    message: "Comissão cadastrada com sucesso!",
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

exports.updateCommission = async (req, res) => {
    await Commission.update(
        {
            dataPagamento: req.body.dataPagamento,
            status: req.body.status,
        },
        {
            where: {
                id: req.params.id,
            }
        }
    )
        .then(co => {
            if (co) {
                Commission.findByPk(req.params.id)
                    .then((result) => {
                        res.send({
                            commission: result,
                            message: "Comissão atualizada com sucesso!",
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
    Commission.findAll()
        .then(co => {
            res.send({
                commission: co,
                message: "Essa lista contém todas comissões cadastradas no sistema!",
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

exports.findCommissionDocument = (req, res) => {
    Commission.findAll(
        {
            where: {
                corretora_CNPJ: req.params.corretora_CNPJ,
                data_pagamento: {
                    [Op.not]: null,
                }
            }
        }
    )
        .then(co => {
            res.send({
                commission: co,
                message: "Essa lista contém a comissão cadastrada no sistema!",
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

exports.findCommissionDigitalSaude = (req, res) => {
    Commission.findOne(
        {
            where: {
                codigoCommissionsDigitalSaude: req.body.codigoCommissionsDigitalSaude,
            }
        }
    )
        .then(co => {
            if (co) {
                res.send({
                    commission: true,
                    sucesso: true
                });
            }
            else {
                Commission.findOne(
                    {
                        where: {
                            dataLancamento: req.body.dataLancamento,
                            corretora_CNPJ: req.body.documento,
                            parcela: req.body.numeroParcela,
                        }
                    }
                )
                    .then(com => {
                        if (com) {
                            res.send({
                                commission: true,
                                sucesso: true
                            });
                        }
                        else {
                            res.send({
                                commission: false,
                                sucesso: true
                            });
                        }

                    })
                    .catch(err => {
                        res.status(500).send({
                            message: err.message,
                            sucesso: false
                        })
                    })
            }

        })
        .catch(err => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            })
        })
};

exports.findCommissionDigitalSaudeBulk = async (req, res) => {
    try {
        const payload = req.body || {};
        const rawItems = Array.isArray(payload.items) ? payload.items : [];

        if (rawItems.length === 0) {
            return res.send({ found: {}, missing: [] });
        }
        if (rawItems.length > 10000) {
            return res.status(400).send({
                sucesso: false,
                message: 'Máximo de 10.000 itens por requisição.',
            });
        }

        // 1) Dedup por key (mantendo normalização)
        const dedupMap = new Map(); // key -> itemNorm
        for (const it of rawItems) {
            const codigo = norm(it.codigoCommissionsDigitalSaude);
            const numeroParcela = norm(it.numeroParcela);
            const documento = norm(it.documento);
            const dataLancamento = norm(it.dataLancamento);
            const key = it.key || makeKey(codigo, numeroParcela, documento);

            if (!dedupMap.has(key)) {
                dedupMap.set(key, { key, codigo, numeroParcela, documento, dataLancamento });
            }
        }

        const items = Array.from(dedupMap.values());
        if (items.length === 0) {
            return res.send({ found: {}, missing: [] });
        }

        const found = {};            // key -> { exists:true, id? }
        const foundKeys = new Set(); // para marcar o que já achou

        // 2) Fase 1 — procura por CÓDIGO em chunks
        const codesAll = Array.from(new Set(items.map((i) => i.codigo).filter(Boolean)));
        const CHUNK_CODES = 1000;

        for (const codes of chunkArray(codesAll, CHUNK_CODES)) {
            // pegue apenas id e codigo
            const rows = await Commission.findAll({
                where: { codigoCommissionsDigitalSaude: { [Op.in]: codes } },
                attributes: ['id', 'codigoCommissionsDigitalSaude'],
                raw: true,
            });

            if (rows?.length) {
                const codesFoundSet = new Set(rows.map((r) => norm(r.codigoCommissionsDigitalSaude)));
                // marca todos os itens que possuam esses códigos como found
                for (const it of items) {
                    if (!foundKeys.has(it.key) && it.codigo && codesFoundSet.has(it.codigo)) {
                        // se houver múltiplos com mesmo código, pegamos o primeiro id retornado apenas para referência
                        const row = rows.find((r) => norm(r.codigoCommissionsDigitalSaude) === it.codigo);
                        found[it.key] = { exists: true, id: row ? row.id : undefined };
                        foundKeys.add(it.key);
                    }
                }
            }
        }

        // 3) Fase 2 — procura por TUPLA (dataLancamento, corretora_CNPJ, parcela) em chunks
        const remaining = items.filter((it) => !foundKeys.has(it.key));
        if (remaining.length) {
            const CHUNK_TUPLES = 1500; // ajuste conforme limite do seu MySQL
            const tableNameRaw = Commission.getTableName ? Commission.getTableName() : Commission.tableName;
            const tableName = typeof tableNameRaw === 'object' ? tableNameRaw.tableName : tableNameRaw;

            for (const lote of chunkArray(remaining, CHUNK_TUPLES)) {
                // monta placeholders (?,?,?) por item
                const placeholders = lote.map(() => '(?,?,?)').join(',');
                const replacements = [];
                for (const it of lote) {
                    // ATENÇÃO: esses campos devem existir na sua tabela exatamente com esses nomes:
                    // dataLancamento, corretora_CNPJ, parcela
                    replacements.push(it.dataLancamento, it.documento, it.numeroParcela);
                }

                const sql = `
            SELECT dataLancamento, corretora_CNPJ, parcela, id
            FROM \`${tableName}\`
            WHERE (dataLancamento, corretora_CNPJ, parcela) IN (${placeholders})
          `;

                const rows = await sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

                if (rows?.length) {
                    // índice por tupla => keys correspondentes
                    const tupleToKeys = new Map(); // "dataLancamento::documento::parcela" -> [keys...]
                    for (const it of lote) {
                        const tKey = `${it.dataLancamento}::${it.documento}::${it.numeroParcela}`;
                        const arr = tupleToKeys.get(tKey) || [];
                        arr.push(it.key);
                        tupleToKeys.set(tKey, arr);
                    }

                    for (const r of rows) {
                        const tKey = `${norm(r.dataLancamento)}::${norm(r.corretora_CNPJ)}::${norm(r.parcela)}`;
                        const keys = tupleToKeys.get(tKey) || [];
                        for (const k of keys) {
                            if (!foundKeys.has(k)) {
                                found[k] = { exists: true, id: r.id };
                                foundKeys.add(k);
                            }
                        }
                    }
                }
            }
        }

        // 4) Missing = tudo que não foi marcado como found
        const missing = [];
        for (const it of items) {
            if (!foundKeys.has(it.key)) missing.push(it.key);
        }

        return res.send({ found, missing });
    } catch (err) {
        console.error('search-bulk error:', err);
        return res.status(500).send({ sucesso: false, message: err.message || 'Erro no bulk lookup' });
    }
};

exports.findCommissionDocumentSearch = (req, res) => {
    const where = {};
    if (req.body.documento) { where.corretora_CNPJ = req.body.documento; };
    where.data_pagamento = { [Op.not]: null, };
    if (req.body.dataInicio) {
        where.data_pagamento = {
            [Op.between]: [req.body.dataInicio, req.body.dataFim],
        };
    };
    Commission.findAll(
        {
            where
        }
    )
        .then(co => {
            res.send({
                commission: co,
                message: "Essa lista contém a comissão cadastrada no sistema!",
                sucesso: true
            });;
        })
        .catch(err => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            })
        })
};

exports.findCommissionDocumentSearchName = (req, res) => {
    const where = {};
    if (req.body.documento) { where.corretora_CNPJ = req.body.documento; };
    where.nome_contrato = { [Op.substring]: req.body.nome_contrato, };

    Commission.findAll(
        {
            where
        }
    )
        .then(co => {
            res.send({
                commission: co,
                message: "Essa lista contém a comissão cadastrada no sistema!",
                sucesso: true
            });;
        })
        .catch(err => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            })
        })
};

exports.findCommission = (req, res) => {
    Commission.findByPk(req.params.id,
        {
            include: [
                {
                    model: db.loteCommissions,
                },
            ],
        })
        .then(co => {
            res.send({
                commission: co,
                message: "Essa lista contém a comissão cadastrada no sistema!",
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

exports.deleteCommission = async (req, res) => {
    await Commission.destroy({
        where: {
            id: req.params.id
        },
    }).then(co => {
        res.send({
            message: "Comissão deletada com sucesso!",
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