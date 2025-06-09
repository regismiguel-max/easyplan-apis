const db = require("../../../../../models");
const config = require("../../config/auth/auth.config");
const Wallet = db.produtorWalletsBonuses;
const Transaction = db.produtorTransactionsBonuses;
const Payment = db.produtorPaymentsBonuses;
const Op = db.Sequelize.Op;
const LoteBonuses = require("./loteBonuses.controller")

const crypto = require('crypto');

// Configurações de criptografia
const algorithm = 'aes-256-cbc';
const secretKey = Buffer.from(config.secret_Key, 'hex');
const iv = Buffer.from(config.iv_Key, 'hex');

// Função para criptografar
encrypt = async (text) => {
    let cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

// Função para descriptografar
decrypt = async (text) => {
    let decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
    let decrypted = decipher.update(text, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// Teste
// const textoOriginal = "1000.50";
// const saldoCriptografado = encrypt(textoOriginal);
// const saldoDescriptografado = decrypt(saldoCriptografado);

// console.log("Saldo Criptografado:", saldoCriptografado);
// console.log("Saldo Descriptografado:", saldoDescriptografado);

ReturnSuccess = async (res) => {
    res.send({
        message: "Lote de bonificações e transações cadastrados com sucesso!",
        sucesso: true
    });
}

ReturnError = async (req, res, err) => {
    res.status(500).send({
        message: err.message,
        sucesso: false
    });
}

ReturnErrorTransaction = async (req, res, lobo_ID) => {
    await Transaction.findAll({
        where: {
            idLoteBonuses: lobo_ID
        }
    }).then(async tra => {
        if (tra.length > 0) {
            tra.forEach((element, index) => {
                Transaction.destroy({
                    where: {
                        id: element.id
                    },
                }).then(async () => {
                    if (index === tra.length - 1) {
                        LoteBonuses.deleteLoteBonusesErrorTransactions(req, res, lobo_ID)
                    }
                }).catch(err => {
                    LoteBonuses.deleteLoteBonusesErrorTransactions(req, res, lobo_ID)
                })
            });
        }
        else {
            LoteBonuses.deleteLoteBonusesErrorTransactions(req, res, lobo_ID)
        }
    }).catch(err => {
        LoteBonuses.deleteLoteBonusesErrorTransactions(req, res, lobo_ID)
    });
}

ReturnErrorTransactionWallet = async (req, res, lobo_ID) => {
    await Transaction.findAll({
        where: {
            idLoteBonuses: lobo_ID
        }
    }).then(async tra => {
        if (tra.length > 0) {
            tra.forEach(async (element, itra) => {
                if (element.calculated) {
                    Wallet.findOne({
                        where: {
                            produtorCPF: element.produtorCPF.replace(/\D/g, ''),
                        }
                    })
                        .then(async wl => {
                            let valor = await Number(element.valor).toFixed(2);
                            let saldoAtual = wl.saldoAtual;
                            let saldoDisponivel = wl.saldoDisponivel;
                            let novoSaldoAtual;
                            let novoSaldoDisponivel;

                            if (element.tipo === 'credito') {
                                novoSaldoAtual = Number(saldoAtual) - Number(valor);
                                novoSaldoDisponivel = Number(saldoDisponivel) - Number(valor);
                            } else if (element.tipo === 'debito') {
                                novoSaldoAtual = Number(saldoAtual) + Number(valor);
                                novoSaldoDisponivel = Number(saldoDisponivel) + Number(valor);
                            }

                            Wallet.update(
                                {
                                    saldoAtual: Number(saldoAtual).toFixed(2),
                                    saldoDisponivel: Number(saldoDisponivel).toFixed(2)
                                },
                                {
                                    where: {
                                        id: wl.id,
                                    }
                                }
                            )
                                .then(() => {
                                    Transaction.destroy({
                                        where: {
                                            id: element.id
                                        },
                                    }).then(async () => {
                                        if (itra === tra.length - 1) {
                                            LoteBonuses.deleteLoteBonusesErrorTransactions(req, res, lobo_ID);
                                        }
                                    }).catch(err => {
                                        LoteBonuses.deleteLoteBonusesErrorTransactions(req, res, lobo_ID);
                                    })
                                }).catch(err => {
                                    LoteBonuses.deleteLoteBonusesErrorTransactions(req, res, lobo_ID);
                                })
                        }).catch(err => {
                            LoteBonuses.deleteLoteBonusesErrorTransactions(req, res, lobo_ID);
                        })
                }
                else {
                    Transaction.destroy({
                        where: {
                            id: element.id
                        },
                    }).then(async () => {
                        if (itra === tra.length - 1) {
                            LoteBonuses.deleteLoteBonusesErrorTransactions(req, res, lobo_ID);
                        }
                    }).catch(err => {
                        LoteBonuses.deleteLoteBonusesErrorTransactions(req, res, lobo_ID);
                    })
                }
            });
        }
        else {
            LoteBonuses.deleteLoteBonusesErrorTransactions(req, res, lobo_ID);
        }
    }).catch(err => {
        LoteBonuses.deleteLoteBonusesErrorTransactions(req, res, lobo_ID);
    });
}

exports.CreateWallet = async (req, res, bonuses) => {
    try {
        for (let ic = 0; ic < bonuses.length; ic++) {
            const elem = bonuses[ic];

            const wl = await Wallet.findOne({
                where: { produtorCPF: elem.documento.replace(/\D/g, '') }
            });

            console.log('Abaixo ID:', wl);

            if (!wl) {
                await Wallet.create({
                    produtorCPF: elem.documento.replace(/\D/g, ''),
                    produtorNome: elem.produtor,
                    saldoAtual: Number(0).toFixed(2),
                    saldoProvisionado: Number(0).toFixed(2),
                    saldoDisponivel: Number(0).toFixed(2),
                    ativa: true,
                });
            }

            // Se for o último item, chamamos o sucesso
            if (ic === bonuses.length - 1) {
                AddTransaction(req, res, bonuses);
                // ReturnSuccess(res);
            }
        }
    } catch (err) {
        console.error('Erro ao criar carteira:', err);
        ReturnErrorTransactionWallet(req, res, bonuses[bonuses.length - 1]?.idLoteBonuses);
    }
}

AddTransaction = async (req, res, bonuses) => {
    try {
        for (let index = 0; index < bonuses.length; index++) {
            const element = bonuses[index];

            await Transaction.create({
                produtorCPF: element.documento.replace(/\D/g, ''),
                produtorNome: element.produtor,
                clienteNome: element.cliente,
                valor: element.tipo === 'credito' ? Number(element.bonificacao).toFixed(2) : Number(element.estorno).toFixed(2),
                tipo: element.tipo,
                descricao: element.descricao,
                idLoteBonuses: element.idLoteBonuses,
                idBonuses: element.id,
                dataLancamento: element.dataLancamento,
                vigencia: element.vigencia,
                numeroParcela: element.numeroParcela,
                codigoBonusesDigitalSaude: element.codigoBonusesDigitalSaude,
                codigoProduto: element.codigoProduto,
                nomeProduto: element.nomeProduto,
                calculated: false,
                status: 'pendente'
            });

            // Se for o último elemento, chamamos GetWallet
            if (index === bonuses.length - 1) {
                ProcessWalletTransactions(req, res, element.idLoteBonuses);
            }
        }
    } catch (error) {
        console.error("Erro ao adicionar transação:", error);
        ReturnErrorTransaction(req, res, bonuses[bonuses.length - 1]?.idLoteBonuses);
    }
}

ProcessWalletTransactions = async (req, res, lobo_ID) => {
    try {
        // Busca todas as transações do lote
        const transactions = await Transaction.findAll({
            where: { idLoteBonuses: lobo_ID }
        });

        if (transactions.length === 0) {
            return ReturnErrorTransaction(req, res, lobo_ID);
        }

        // Processa cada transação separadamente
        for (let index = 0; index < transactions.length; index++) {
            const transaction = transactions[index];

            // Busca a carteira correspondente à transação
            const wallet = await Wallet.findOne({
                where: { produtorCPF: transaction.produtorCPF }
            });

            if (!wallet) {
                console.error(`Carteira não encontrada para CPF: ${transaction.produtorCPF}`);
                continue; // Pula para a próxima transação, sem bloquear a execução
            }

            let valor = Number(transaction.valor);
            let saldoAtual = Number(wallet.saldoAtual);
            let saldoDisponivel = Number(wallet.saldoDisponivel);
            let novoSaldoAtual, novoSaldoDisponivel;

            if (transaction.tipo === 'credito') {
                novoSaldoAtual = saldoAtual + valor;
                novoSaldoDisponivel = saldoDisponivel + valor;
            } else if (transaction.tipo === 'debito') {
                novoSaldoAtual = saldoAtual - valor;
                novoSaldoDisponivel = saldoDisponivel - valor;
            }

            // Atualiza os valores na carteira
            await Wallet.update(
                {
                    saldoAtual: novoSaldoAtual.toFixed(2),
                    saldoDisponivel: novoSaldoDisponivel.toFixed(2)
                },
                { where: { id: wallet.id } }
            );

            // Marca a transação como calculada
            await Transaction.update(
                { calculated: true },
                { where: { id: transaction.id } }
            );
        }

        // Após processar todas as transações, retorna sucesso
        ReturnSuccess(res);

    } catch (err) {
        console.error("Erro ao processar carteiras:", err);
        ReturnErrorTransaction(req, res, lobo_ID);
    }
}

GetWallet = async (req, res, lobo_ID) => {
    try {
        const tra = await Transaction.findAll({
            where: { idLoteBonuses: lobo_ID }
        });

        if (tra.length > 0) {
            for (let index = 0; index < tra.length; index++) {
                const element = tra[index];
                const isLast = index === tra.length - 1;
                // await UpdateWallet(req, res, wl, element, isLast);
                ReturnSuccess(res);
            }
        } else {
            ReturnErrorTransaction(req, res, lobo_ID);
        }
    } catch (err) {
        ReturnErrorTransaction(req, res, lobo_ID);
    }
}

UpdateWallet = async (req, res, wallet, transaction, isend) => {
    try {
        let valor = await Number(transaction.valor).toFixed(2);
        let saldoAtual = wallet.saldoAtual;
        let saldoDisponivel = wallet.saldoDisponivel;
        let novoSaldoAtual, novoSaldoDisponivel;

        if (transaction.tipo === 'credito') {
            novoSaldoAtual = Number(saldoAtual) + Number(valor);
            novoSaldoDisponivel = Number(saldoDisponivel) + Number(valor);
        } else if (transaction.tipo === 'debito') {
            novoSaldoAtual = Number(saldoAtual) - Number(valor);
            novoSaldoDisponivel = Number(saldoDisponivel) - Number(valor);
        }

        await Wallet.update(
            {
                saldoAtual: Number(novoSaldoAtual).toFixed(2),
                saldoDisponivel: Number(novoSaldoDisponivel).toFixed(2)
            },
            {
                where: {
                    id: wallet.id,
                }
            }
        );

        await Transaction.update(
            {
                calculated: true,
            },
            {
                where: {
                    id: transaction.id,
                }
            }
        );

        if (isend) {
            ReturnSuccess(res);
        }

    } catch (err) {
        console.error("Erro ao atualizar carteira:", err);
        ReturnErrorTransactionWallet(req, res, transaction.idLoteBonuses);
    }
}

exports.provisionarPayment = async (req, res, wallet) => {
    let saldoProvisionado = await Number(wallet.saldoProvisionado).toFixed(2);

    if (Number(wallet.saldoDisponivel).toFixed(2) > 0) {
        Payment.create({
            walletID: wallet.id,
            produtorCPF: wallet.produtorCPF,
            valor: Number(walletsaldoDisponivel).toFixed(2),
            idLoteBonuses: transaction.idLoteBonuses,
            idBonuses: transaction.idBonuses,
            codigoBonusesDigitalSaude: transaction.codigoBonusesDigitalSaude,
            status: 'provisionado'
        })
            .then(() => {
                Wallet.update(
                    {
                        saldoDisponivel: Number(0).toFixed(2),
                        saldoProvisionado: Number(Number(saldoProvisionado) + Number(saldoDisponivel)).toFixed(2)
                    },
                    {
                        where: {
                            id: wallet.id,
                        }
                    }
                )
                    .then(() => {
                        Transaction.update(
                            {
                                calculated: true,
                                status: 'confirmada'
                            },
                            {
                                where: {
                                    id: transaction.id,
                                }
                            }
                        )
                            .then(() => {
                                if (isend) {
                                    // logica lote concluido
                                    ReturnSuccess(req, res, wl);
                                }
                            })
                            .catch(err => {
                                // logica error, limpa tudo atras
                                ReturnError(req, res, err);
                            });
                    })
                    .catch(err => {
                        // logica error, limpa tudo atra
                        ReturnError(req, res, err);
                    });
            })
            .catch(err => {
                // logica error, limpa tudo atras
                ReturnError(req, res, err);
            });
        // await gerarPagamento(carteiraId, novoSaldoDisponivel);
    }
}