const db = require("../../../../../models");
const SwileTwoFactorAuthenticationRequest = db.swile_two_factor_authentications_request;
const Payment = db.swile_payment;
const LoteBonuses = db.loteBonuses;
const Bonuses = db.bonuse;

const Wallet = db.produtorWalletsBonuses;
const Transactions = db.produtorTransactionsBonuses;
const TransactionsPayments = db.produtorPaymentsBonuses;

const WhatsApp = require("../whatsapp/whatsapp.controller")
const axios = require('axios');
const http = require('http');
const https = require('https');

const moment = require('moment');
moment.locale('pt-br');
const { where, Op } = require("sequelize");

const bcrypt = require("bcryptjs");
const salt = bcrypt.genSaltSync(Number(process.env.SALT));

const httpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 0,
    timeout: 120000,
    scheduling: 'fifo',
});
const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 0,
    timeout: 120000,
    scheduling: 'fifo',
});

////////////////////////////////////////////////////////////////////////////////////////
exports.verifyPayment = async (req, res, next) => {
    try {
        const pay = await Payment.findOne({ where: { lote_ID: req.params.lote_ID } });

        if (pay) {
            return res.status(200).json({
                payment: pay,
                message: 'Solicitação de pagamento encontrada para o lote de bonificação',
                sucesso: true
            });
        }

        return res.status(404).json({
            message: "Não há solicitação de pagamento para este lote de bonificação",
            sucesso: false,
        });

    } catch (error) {
        console.error("Erro no verifyPayment:", error);
        return res.status(500).json({
            message: "Erro interno ao verificar pagamento",
            sucesso: false,
            error: error.message
        });
    }
}

////////////////////////////////////////////////////////////////////////////////////////
exports.getPayment = async (req, res) => {
    try {
        // Busca o pagamento pelo ID do lote
        const pay = await Payment.findOne({ where: { lote_ID: req.params.lote_ID } });
        if (!pay) {
            return res.status(404).json({
                message: "Pagamento não encontrado para este lote.",
                sucesso: false
            });
        }

        // Busca todas as transações relacionadas ao lote
        const transactions = await TransactionsPayments.findAll({ where: { idLoteBonuses: req.params.lote_ID } });
        if (transactions.length === 0) {
            return res.status(404).json({
                message: "Nenhuma transação encontrada para este lote.",
                sucesso: false
            });
        }

        // Obtém os IDs únicos das carteiras associadas às transações
        const walletIDs = [...new Set(transactions.map(tr => Number(tr.walletID)))];

        // Busca todas as carteiras correspondentes em uma única query
        const wallets = await Wallet.findAll({ where: { id: walletIDs } });

        // Cria um mapa para acesso rápido às carteiras
        const walletMap = new Map(wallets.map(w => [Number(w.id), w]));

        // Debugging para verificar se os dados das carteiras estão corretos
        console.log("WalletMap:", walletMap);

        // Monta a lista de pagamentos com todas as informações necessárias
        const payments = transactions.map(tr => {
            const wallet = walletMap.get(Number(tr.walletID));

            return {
                id: tr.id,
                walletID: tr.walletID,
                produtorCPF: tr.produtorCPF,
                produtorNome: wallet ? wallet.produtorNome : "Desconhecido",
                saldoAtual: wallet ? wallet.saldoAtual : 0,
                saldoDisponivel: wallet ? wallet.saldoDisponivel : 0,
                saldoProvisionado: wallet ? wallet.saldoProvisionado : 0,
                valor: tr.valor,
                previsao: pay.lote_previsao,
                idLoteBonuses: tr.idLoteBonuses,
                status: pay.payment_status
            };
        });

        // Envia a resposta com todos os pagamentos processados
        res.status(200).json({
            payments,
            message: "Essa lista contém os pagamentos referentes aos lotes no sistema!",
            sucesso: true
        });

    } catch (error) {
        console.error("Erro em getPayment:", error.message);
        res.status(500).json({
            message: "Erro ao buscar pagamentos.",
            sucesso: false,
            error: error.message
        });
    }
};

//////////////////////////////////////////////////////////
exports.authSwile = async () => {
    try {
        const response = await axios.get(`${process.env.URLSWILE}/api/v1/auth/login`, {
            httpAgent,
            httpsAgent,
            auth: {
                username: process.env.USERNAMESWILE,
                password: process.env.PASSWORDSWILE
            },
        });

        return response.data.token;
    } catch (error) {
        console.error("Erro na autenticação Swile:", error.response?.data || error.message);
        return null; // Retorna `null` ao invés de `false` para evitar confusão com valores booleanos
    }
}

//////////////////////////////////////////////////////////
exports.orderSummary = async (request_ID, resend) => {
    try {
        let token = await this.authSwile();
        if (!token) return errorAuthSwile(request_ID);

        const SwileRequest = await SwileTwoFactorAuthenticationRequest.findOne({ where: { id: request_ID } });
        if (!SwileRequest) return errorSummary(request_ID);

        // Atualiza o status do lote para "PROCESSANDO"
        const updatedLote = await LoteBonuses.update(
            { status: 'PROCESSANDO', disabled: true },
            { where: { id: SwileRequest.lote_ID } }
        );

        if (updatedLote[0] === 0) return errorSummary(request_ID);

        const bonuses = await Bonuses.findAll({ where: { idLoteBonuses: SwileRequest.lote_ID } });
        if (!bonuses.length) return errorSummary(request_ID);

        let totalBonificacoes = 0;
        const bonusMap = new Map();

        // Agrupando bonificações por CPF
        bonuses.forEach(element => {
            const cpf = element.documento.replace(/\D/g, '');
            if (!bonusMap.has(cpf)) {
                bonusMap.set(cpf, { documento: cpf });
            }
        });

        // Obtendo todas as carteiras de uma vez
        const cpfsUnicos = Array.from(bonusMap.keys());
        const wallets = await Wallet.findAll({ where: { produtorCPF: cpfsUnicos } });

        // Criando um Map para acesso rápido às carteiras
        const walletMap = new Map(wallets.map(wl => [wl.produtorCPF, wl]));

        // Criando os arrays de pagamento
        const lotePay = [];
        const lotePayment = [];

        bonusMap.forEach((bonus, cpf) => {
            const wallet = walletMap.get(cpf);
            if (!wallet || Number(wallet.saldoDisponivel) <= 0) return;

            totalBonificacoes += wallet.saldoDisponivel;

            const formattedCPF = cpf.replace(/\D/g, '')
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d)/, '$1-$2')
                .replace(/(-\d{2})\d+?$/, '$1');

            lotePay.push({
                document: formattedCPF,
                cardValues: [{ card: "v300", value: Number(wallet.saldoDisponivel) }],
            });

            lotePayment.push({
                walletID: wallet.id,
                document: formattedCPF,
                value: Number(wallet.saldoDisponivel),
                saldoProvisionado: wallet.saldoProvisionado,
                saldoDisponivel: wallet.saldoDisponivel,
            });
        });

        // Atualizando o status das bonificações
        await Bonuses.update({ status: 'PROCESSANDO' }, { where: { idLoteBonuses: SwileRequest.lote_ID } });

        if (resend) {
            return paymentsBonuses(token, lotePay, totalBonificacoes, request_ID, SwileRequest, resend);
        }

        for (const wl of lotePayment) {
            try {
                const pay = await TransactionsPayments.create({
                    walletID: wl.walletID,
                    produtorCPF: wl.document.replace(/\D/g, ''),
                    valor: Number(wl.value).toFixed(2),
                    idLoteBonuses: SwileRequest.lote_ID,
                    status: 'provisionado',
                });

                if (!pay) return errorProdutorPayments(request_ID);

                // Atualizando saldo da carteira
                const novosaldoProvisionado = Number(wl.saldoProvisionado) + Number(wl.value);
                const novoSaldoDisponivel = Number(wl.saldoDisponivel) - Number(wl.value);

                await Wallet.update(
                    { saldoProvisionado: novosaldoProvisionado.toFixed(2), saldoDisponivel: novoSaldoDisponivel.toFixed(2) },
                    { where: { id: wl.walletID } }
                );
            } catch (err) {
                return errorProdutorPayments(request_ID);
            }
        }

        return paymentsBonuses(token, lotePay, totalBonificacoes, request_ID, SwileRequest, resend);
    } catch (error) {
        console.error("Erro no orderSummary:", error);
        return errorSummary(request_ID);
    }
}

//////////////////////////////////////////////////////////
paymentsBonuses = async (token, lotePay, totalBonificacoes, request_ID, SwileRequest, resend) => {
    try {
        const lobo = await LoteBonuses.findByPk(SwileRequest.lote_ID);
        if (!lobo) throw new Error("Lote não encontrado.");

        const paymentData = {
            user_ID: SwileRequest.user_ID,
            user_IP: SwileRequest.user_IP,
            user_lat: SwileRequest.user_lat,
            user_lng: SwileRequest.user_lng,
            user_endereco: SwileRequest.user_endereco,
            user_whatsapp: SwileRequest.whatsapp,
            user_email: SwileRequest.email,
            code: SwileRequest.code,
            authenticated: SwileRequest.authenticated,
            request_ID: SwileRequest.id,
            lote_ID: SwileRequest.lote_ID,
            lote_type: SwileRequest.lote_type,
            lote_quantidade: lobo.quantidade,
            lote_totalBonificacoes: lobo.totalBonificacoes,
            lote_previsao: lobo.previsao,
            lote_solicitacaoPagamento: new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toJSON(),
            lote_dataPagamento: null,
            payment_status_ID: 0,
            payment_status: 'PROCESSANDO PAGAMENTO',
            payment_descricao: {
                descricao: `Solicitado o pagamento do lote de bonificação de id ${SwileRequest.lote_ID}, com a data de solicitação de pagamento no dia ${new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toJSON()} no valor de bonificações de ${lobo.totalBonificacoes} e pago o valor de wallets ${totalBonificacoes}`,
                lote_ID: SwileRequest.lote_ID,
                totalBonificacoes: lobo.totalBonificacoes,
                dataSolicitação: new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toJSON()
            },
            wallet_quantidade: lotePay.length,
            wallet_totalBonificacoes: String(Number(totalBonificacoes).toFixed(2))
        };

        let pay;
        if (resend) {
            pay = await Payment.update(paymentData, { where: { lote_ID: SwileRequest.lote_ID } });
        } else {
            pay = await Payment.create(paymentData);
        }

        if (!pay) {
            return resend ? errorSummary(request_ID) : errorProdutorPayments(request_ID);
        }

        return orderSummarySwile(token, lotePay, request_ID);
    } catch (error) {
        console.error("Erro em paymentsBonuses:", error);
        return errorSummary(request_ID);
    }
}

//////////////////////////////////////////////////////////
orderSummarySwile = async (token, lotePay, request_ID) => {
    try {
        const response = await axios.post(
            `${process.env.URLSWILE}/api/v1/order/summary`,
            { data: lotePay },
            // { data: [{ "document": "033.980.181-65", "cardValues": [{ "card": "v300", "value": "6" }] }] },
            {
                httpAgent,
                httpsAgent,
                headers: {
                    'Content-Type': "application/json",
                    Authorization: `Bearer ${token}`
                },
            }
        );

        orderCreateSwile(token, response.data, request_ID);
    } catch (error) {
        console.error("Erro no orderSummarySwile:", error.response?.data || error.message);
        errorOrderSummarySwile(request_ID, error.response?.data || "Erro desconhecido");
    }
}

//////////////////////////////////////////////////////////
orderCreateSwile = async (token, summary, request_ID) => {
    try {
        // Define a data de pagamento com base no valor do pagamento
        const hoursToAdd = Number(summary.valuePayment) > 49999 ? moment(new Date()).add(24, 'hours').format('YYYY-MM-DD HH:mm') : moment(new Date()).add(4, 'hours').format('YYYY-MM-DD HH:mm');
        const lote_dataPagamento = new Date(hoursToAdd).toJSON();

        const response = await axios.post(
            `${process.env.URLSWILE}/api/v1/order/create`,
            {
                summaryId: summary.summaryId,
                paymentMethod: "PIX",
                creditDate: lote_dataPagamento,
                campaignPayerDocument: process.env.EASYCNPJ,
                campaignPaymentInfo: [
                    {
                        document: process.env.EASYCNPJ,
                        swileCreditToUse: summary.valuePayment
                    }
                ]
            },
            {
                httpAgent,
                httpsAgent,
                headers: {
                    'Content-Type': "application/json",
                    'Authorization': `Bearer ${token}`
                },
            }
        );

        successOrderCreateSwile(request_ID, response.data, lote_dataPagamento);
    } catch (error) {
        console.error("Erro no orderCreateSwile:", error.response?.data || error.message);
        errorOrderCreateSwile(request_ID, error.response?.data || "Erro desconhecido");
    }
}

//////////////////////////////////////////////////////////
errorAuthSwile = async (request_ID) => {
    try {
        const swileRequest = await SwileTwoFactorAuthenticationRequest.findOne({ where: { id: request_ID } });
        if (!swileRequest) throw new Error("Solicitação não encontrada.");

        // Atualiza o lote para status de erro
        await LoteBonuses.update({ status: 'ERRO', disabled: true }, { where: { id: swileRequest.lote_ID } });

        // Obtém os bônus do lote
        const bonuses = await Bonuses.findAll({ where: { idLoteBonuses: swileRequest.lote_ID } });

        // Atualiza todos os bônus para 'ERRO'
        await Promise.all(
            bonuses.map(bonus => Bonuses.update({ status: 'ERRO' }, { where: { id: bonus.id } }))
        );
    } catch (error) {
        console.error("Erro ao processar errorAuthSwile:", error);
    }
}

//////////////////////////////////////////////////////////
errorSummary = async (request_ID) => {
    try {
        const swileRequest = await SwileTwoFactorAuthenticationRequest.findOne({ where: { id: request_ID } });
        if (!swileRequest) throw new Error("Solicitação não encontrada.");

        // Atualiza o lote para status de erro
        await LoteBonuses.update({ status: 'ERRO', disabled: true }, { where: { id: swileRequest.lote_ID } });

        // Obtém os bônus do lote
        const bonuses = await Bonuses.findAll({ where: { idLoteBonuses: swileRequest.lote_ID } });

        // Atualiza todos os bônus para 'ERRO'
        await Promise.all(
            bonuses.map(bonus => Bonuses.update({ status: 'ERRO' }, { where: { id: bonus.id } }))
        );
    } catch (error) {
        console.error("Erro ao processar errorSummary:", error);
    }
}

//////////////////////////////////////////////////////////
errorProdutorPayments = async (request_ID) => {
    try {
        const swileRequest = await SwileTwoFactorAuthenticationRequest.findOne({ where: { id: request_ID } });
        if (!swileRequest) throw new Error("Solicitação não encontrada.");

        // Atualiza o lote para status de erro
        await LoteBonuses.update({ status: 'ERRO', disabled: true }, { where: { id: swileRequest.lote_ID } });

        // Atualiza os bônus relacionados ao lote
        const bonuses = await Bonuses.findAll({ where: { idLoteBonuses: swileRequest.lote_ID } });
        await Promise.all(bonuses.map(bonus => bonus.update({ status: 'ERRO' })));

        // Obtém todas as transações relacionadas ao lote
        const transactions = await TransactionsPayments.findAll({ where: { idLoteBonuses: swileRequest.lote_ID } });

        for (const transaction of transactions) {
            await errorProcessTransaction(transaction);
        }
    } catch (error) {
        console.error("Erro no processamento de pagamentos com erro:", error);
    }
}

//////////////////////////////////////////////////////////
errorProcessTransaction = async (transaction) => {
    try {
        const wallet = await Wallet.findOne({ where: { id: transaction.walletID } });
        if (!wallet) throw new Error(`Carteira não encontrada para ID ${transaction.walletID}`);

        const valor = Number(transaction.valor).toFixed(2);
        const novosaldoProvisionado = (Number(wallet.saldoProvisionado) - Number(valor)).toFixed(2);
        const novoSaldoDisponivel = (Number(wallet.saldoDisponivel) + Number(valor)).toFixed(2);

        await Wallet.update(
            { saldoProvisionado: novosaldoProvisionado, saldoDisponivel: novoSaldoDisponivel },
            { where: { id: wallet.id } }
        );

        await TransactionsPayments.destroy({ where: { id: transaction.id } });
    } catch (error) {
        console.error(`Erro ao processar transação ID ${transaction.id}:`, error);
    }
};

//////////////////////////////////////////////////////////
errorOrderSummarySwile = async (request_ID, err) => {
    try {
        const swileRequest = await SwileTwoFactorAuthenticationRequest.findOne({ where: { id: request_ID } });
        if (!swileRequest) throw new Error("Solicitação não encontrada.");

        // Envia mensagem de erro via WhatsApp
        WhatsApp.sendMessagePayErro(swileRequest);

        // Atualiza o lote para status de erro
        await LoteBonuses.update({ status: 'ERRO', disabled: true }, { where: { id: swileRequest.lote_ID } });

        // Obtém os bônus do lote
        const bonuses = await Bonuses.findAll({ where: { idLoteBonuses: swileRequest.lote_ID } });

        // Atualiza todos os bônus para 'ERRO'
        await Promise.all(
            bonuses.map(bonus => Bonuses.update({ status: 'ERRO' }, { where: { id: bonus.id } }))
        );

        // Atualiza o pagamento com erro no processamento da Order Summary
        await Payment.update(
            {
                payment_status_ID: 2,
                payment_status: 'ERRO NO PROCESSAMENTO DA ORDER SUMMARY',
                payment_descricao: err
            },
            { where: { request_ID: request_ID } }
        );
    } catch (error) {
        console.error("Erro ao processar errorOrderSummarySwile:", error);
    }
}

//////////////////////////////////////////////////////////
errorOrderCreateSwile = async (request_ID, err) => {
    try {
        const swileRequest = await SwileTwoFactorAuthenticationRequest.findOne({ where: { id: request_ID } });
        if (!swileRequest) throw new Error("Solicitação não encontrada.");

        // Envia mensagem de erro via WhatsApp
        WhatsApp.sendMessagePayErro(swileRequest);

        // Atualiza o lote para status de erro
        await LoteBonuses.update({ status: 'ERRO', disabled: true }, { where: { id: swileRequest.lote_ID } });

        // Obtém os bônus do lote
        const bonuses = await Bonuses.findAll({ where: { idLoteBonuses: swileRequest.lote_ID } });

        // Atualiza todos os bônus para 'ERRO'
        await Promise.all(
            bonuses.map(bonus => Bonuses.update({ status: 'ERRO' }, { where: { id: bonus.id } }))
        );

        // Atualiza o pagamento com erro no processamento da Order Create
        await Payment.update(
            {
                payment_status_ID: 2,
                payment_status: 'ERRO NO PROCESSAMENTO DA ORDER CREATE',
                payment_descricao: err
            },
            { where: { request_ID: request_ID } }
        );
    } catch (error) {
        console.error("Erro ao processar errorOrderCreateSwile:", error);
    }
}

//////////////////////////////////////////////////////////
successOrderCreateSwile = async (request_ID, response, lote_dataPagamento) => {
    try {
        const swileRequest = await SwileTwoFactorAuthenticationRequest.findOne({ where: { id: request_ID } });
        if (!swileRequest) throw new Error("Solicitação não encontrada.");

        // Envia mensagem de pagamento processado via WhatsApp
        WhatsApp.sendMessagePayProcessado(swileRequest);

        // Atualiza o lote para status de processado
        await LoteBonuses.update(
            { status: 'PROCESSADO', dataPagamento: lote_dataPagamento, disabled: true },
            { where: { id: swileRequest.lote_ID } }
        );

        // Obtém os bônus do lote
        const bonuses = await Bonuses.findAll({ where: { idLoteBonuses: swileRequest.lote_ID } });

        // Atualiza todos os bônus para 'PROCESSADO'
        await Promise.all(
            bonuses.map(bonus =>
                Bonuses.update({ status: 'PROCESSADO', dataPagamento: lote_dataPagamento }, { where: { id: bonus.id } })
            )
        );

        // Atualiza os detalhes do pagamento
        await Payment.update(
            {
                lote_dataPagamento,
                payment_status_ID: 1,
                payment_status: 'PAGAMENTO PROCESSADO COM SUCESSO',
                payment_descricao: response,
                swile_summaryId: response.summaryId,
                swile_orderGroupId: response.orderGroupId,
                swile_orderGroupCode: response.orderGroupCode,
                swile_externalId: response.externalId,
                swile_status: response.status,
                swile_rejectReason: response.rejectReason,
            },
            { where: { request_ID: request_ID } }
        );

        // Verifica status do pagamento após a atualização
        orderCreateSwileVerifyStatusPayment(request_ID);
    } catch (error) {
        console.error("Erro ao processar successOrderCreateSwile:", error);
    }
}

////////////////////////////////////////////////////////////////////////////////////////
// 📌 Função para processar pagamento aprovado
processApprovedPayment = async (payment, responseData) => {
    WhatsApp.sendMessagePayPago(payment);

    await LoteBonuses.update(
        { status: 'PAGO', disabled: true },
        { where: { id: payment.lote_ID } }
    );

    await Bonuses.update(
        { status: 'PAGO' },
        { where: { idLoteBonuses: payment.lote_ID } }
    );

    await Payment.update(
        {
            payment_status_ID: 4,
            payment_status: 'PAGO',
            payment_descricao: responseData,
            swile_status: responseData.status
        },
        { where: { id: payment.id } }
    );

    const transactions = await TransactionsPayments.findAll({
        where: { idLoteBonuses: payment.lote_ID, status: 'provisionado' }
    });

    for (const tr of transactions) {
        await TransactionsPayments.update(
            { status: 'confirmado' },
            { where: { id: tr.id } }
        );

        const wallet = await Wallet.findOne({ where: { id: tr.walletID } });
        if (wallet) {
            const valor = Number(tr.valor);
            const novosaldoProvisionado = Number(wallet.saldoProvisionado) - valor;
            const novoSaldoAtual = Number(wallet.saldoAtual) - valor;

            await Wallet.update(
                { saldoProvisionado: novosaldoProvisionado.toFixed(2), saldoAtual: novoSaldoAtual.toFixed(2) },
                { where: { id: wallet.id } }
            );
        }
    }
};

////////////////////////////////////////////////////////////////////////////////////////
// 📌 Função para processar pagamento agendado (PAID)
processPaidPayment = async (payment, responseData) => {
    await LoteBonuses.update(
        { status: 'AGUARDANDO', disabled: true },
        { where: { id: payment.lote_ID } }
    );

    await Bonuses.update(
        { status: 'AGUARDANDO' },
        { where: { idLoteBonuses: payment.lote_ID } }
    );

    await Payment.update(
        {
            payment_status_ID: 3,
            payment_status: 'PAGO E AGENDADO',
            payment_descricao: responseData,
            swile_status: responseData.status
        },
        { where: { id: payment.id } }
    );
};

////////////////////////////////////////////////////////////////////////////////////////
// 📌 Função para processar pagamento com erro
processErrorPayment = async (payment, responseData) => {
    await LoteBonuses.update(
        { status: 'ERRO' },
        { where: { id: payment.lote_ID } }
    );

    await Bonuses.update(
        { status: 'ERRO' },
        { where: { idLoteBonuses: payment.lote_ID } }
    );

    await Payment.update(
        {
            payment_status_ID: 2,
            payment_status: 'ERRO NO PAGAMENTO',
            payment_descricao: responseData,
            swile_status: responseData.status,
            swile_rejectReason: responseData.rejectReason
        },
        { where: { id: payment.id } }
    );
};

////////////////////////////////////////////////////////////////////////////////////////
// 📌 Função para processar pagamento pendente
processPendingPayment = async (payment, responseData) => {
    await LoteBonuses.update(
        { status: 'AGUARDANDO' },
        { where: { id: payment.lote_ID } }
    );

    await Bonuses.update(
        { status: 'AGUARDANDO' },
        { where: { idLoteBonuses: payment.lote_ID } }
    );

    await Payment.update(
        {
            payment_status_ID: 1,
            payment_status: 'AGUARDANDO PAGAMENTO',
            payment_descricao: responseData,
            swile_status: responseData.status
        },
        { where: { id: payment.id } }
    );
};

////////////////////////////////////////////////////////////////////////////////////////
orderCreateSwileVerifyStatusPayment = async (request_ID) => {
    try {
        const payment = await Payment.findOne({ where: { request_ID } });
        if (!payment) throw new Error("Pagamento não encontrado.");

        const token = await this.authSwile();
        if (!token) throw new Error("Falha na autenticação Swile.");

        if (!payment.swile_orderGroupCode) throw new Error("Código de grupo de pedido ausente.");

        const response = await axios.get(
            `${process.env.URLSWILE}/api/v1/order/group/status/${payment.swile_orderGroupCode}`,
            {
                httpAgent,
                httpsAgent,
                headers: {
                    'Content-Type': "application/json",
                    'Authorization': `Bearer ${token}`
                },
            }
        );

        const status = response.data.status;
        const rejectReason = response.data.rejectReason || null;

        if (status === 'APPROVED') {
            await processApprovedPayment(payment, response.data);
        } else if (status === 'PAID') {
            await processPaidPayment(payment, response.data);
        } else if (rejectReason) {
            await processErrorPayment(payment, response.data);
        } else {
            await processPendingPayment(payment, response.data);
        }
    } catch (error) {
        console.error("Erro em orderCreateSwileVerifyStatusPayment:", error.message);
    }
}

/////////////////////////////////////////////////////////////////////////////////////////
exports.verifyStatusPayment = async () => {
    try {
        const payments = await Payment.findAll({
            where: { payment_status_ID: ['0', '1', '3'] },
        });

        if (payments.length === 0) return;

        const token = await this.authSwile();
        if (!token) throw new Error("Falha na autenticação Swile.");

        for (const payment of payments) {
            if (!payment.swile_orderGroupCode) continue;

            try {
                const response = await axios.get(
                    `${process.env.URLSWILE}/api/v1/order/group/status/${payment.swile_orderGroupCode}`,
                    {
                        httpAgent,
                        httpsAgent,
                        headers: {
                            'Content-Type': "application/json",
                            'Authorization': `Bearer ${token}`,
                        },
                    }
                );

                const status = response.data.status;
                const rejectReason = response.data.rejectReason || null;

                if (status === 'APPROVED') {
                    await processApprovedPayment(payment, response.data);
                } else if (status === 'PAID') {
                    await processPaidPayment(payment, response.data);
                } else if (rejectReason) {
                    await processErrorPayment(payment, response.data);
                } else {
                    await processPendingPayment(payment, response.data);
                }
            } catch (error) {
                console.error(`Erro ao verificar status do pagamento (request_ID: ${payment.request_ID}):`, error.response?.data || error.message);
            }
        }
    } catch (error) {
        console.error("Erro em verifyStatusPayment:", error.message);
    }
}

// processando pagamento id = 0
// aguardando pagamento id = 1
// pagamento com erro id = 2
// pagamento concluido pago = 3
// pagamento concluido pago = 4
