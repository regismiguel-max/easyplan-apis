const axios = require('axios');
const http = require('http');
const https = require('https');
const db = require("../../../../../models");
const User = db.user;
const Payment = db.swile_payment;

sendMessageCodeImage = async (req, res, code) => {
    axios.post(
        'https://afinidade.atenderbem.com/int/enqueueMessageToSend',
        {
            "queueId": 16,
            "apiKey": "4c5067c17b494efdaf00ed63177b3c2c",
            "number": req.body.whatsapp,
            "country": "+55",
            "fileId": 77825,
            "text": `Olá ${req.body.name}!
            
Seja muito bem-vindo ao canal de *Suporte EasyPlan*.
                
Para validar o seu acesso no aplicativo *EasyPlan*, por favor, utilize o código abaixo:
                
*${code}*
                
Agradecemos por escolher a *EasyPlan*!
                
_Favor não responder, esta é uma mensagem automática._
`
        },
            // 'https://gkccyhpmtpsxduunuqrh.supabase.co/functions/v1/whatsapp-gateway',
            // {
            //     "apiKey": "0d159119-0f9d-4737-a1cc-0700c8825edb",
            //     "number": "6131421077",
            //     "country": "BR",
            //     "templateId": "186050eb-5e40-49a3-84ab-a8e1294fa7dc",
            //     "varsdata": [
            //         123123
            //     ]
            // },
        {
            httpAgent: new http.Agent({
                keepAlive: true,
                keepAliveMsecs: 0,
                timeout: 120000,
                scheduling: 'fifo',
            }),
            httpsAgent: new https.Agent({
                keepAlive: true,
                keepAliveMsecs: 0,
                timeout: 120000,
                scheduling: 'fifo',
            }),
        })
        .then(function (response) {
            res.send({
                message: "Autenticação de dos fatores enviada com sucesso!",
                sucesso: true
            });
        })
        .catch(function (error) {
            res.status(401).send({
                message: erro.message,
                sucesso: false
            });
        });
};

sendMessagePayAnalise = async (name, whatsapp) => {
    axios.post(
        'https://afinidade.atenderbem.com/int/enqueueMessageToSend',
        {
            "queueId": 16,
            "apiKey": "4c5067c17b494efdaf00ed63177b3c2c",
            "number": whatsapp,
            "country": "+55",
            "fileId": 77825,
            "text": `Olá ${name}!
                
Seu código foi validado e sua solicitação de pagamento foi encaminhada para análise.
                
Atenciosamente,

*Equipe EasyPlan*

_Esta é uma mensagem automática. Favor não responder_.
`
        },
        {
            httpAgent: new http.Agent({
                keepAlive: true,
                keepAliveMsecs: 0,
                timeout: 120000,
                scheduling: 'fifo',
            }),
            httpsAgent: new https.Agent({
                keepAlive: true,
                keepAliveMsecs: 0,
                timeout: 120000,
                scheduling: 'fifo',
            }),
        })
        .then(function (response) { })
        .catch(function (error) { });
};

sendMessagePayErro = async (SwileRequest) => {
    await User.findOne({
        where: {
            id: SwileRequest.user_ID,
        }
    })
        .then(async user => {
            if (user) {
                Payment.findOne({
                    where: {
                        lote_ID: SwileRequest.lote_ID,
                    }
                }).then(async pay => {
                    if (pay) {
                        axios.post(
                            'https://afinidade.atenderbem.com/int/enqueueMessageToSend',
                            {
                                "queueId": 16,
                                "apiKey": "4c5067c17b494efdaf00ed63177b3c2c",
                                "number": user.celular,
                                "country": "+55",
                                "fileId": 77825,
                                "text": `Olá ${user.name}!

Identificamos um erro em sua solicitação de pagamento de bonificação no valor de R$${pay.lote_totalBonificacoes}. Por favor, acesse o painel administrativo para verificar os detalhes.

Atenciosamente,

*Equipe EasyPlan*

_Esta é uma mensagem automática. Favor não responder_.
`
                            },
                            {
                                httpAgent: new http.Agent({
                                    keepAlive: true,
                                    keepAliveMsecs: 0,
                                    timeout: 120000,
                                    scheduling: 'fifo',
                                }),
                                httpsAgent: new https.Agent({
                                    keepAlive: true,
                                    keepAliveMsecs: 0,
                                    timeout: 120000,
                                    scheduling: 'fifo',
                                }),
                            })
                            .then(function (response) { })
                            .catch(function (error) { });
                    }
                }).catch(err => { })
            }
        })
        .catch(err => { });
};

sendMessagePayProcessado = async (SwileRequest) => {
    await User.findOne({
        where: {
            id: SwileRequest.user_ID,
        }
    })
        .then(async user => {
            if (user) {
                Payment.findOne({
                    where: {
                        lote_ID: SwileRequest.lote_ID,
                    }
                }).then(async pay => {
                    if (pay) {
                        axios.post(
                            'https://afinidade.atenderbem.com/int/enqueueMessageToSend',
                            {
                                "queueId": 16,
                                "apiKey": "4c5067c17b494efdaf00ed63177b3c2c",
                                "number": user.celular,
                                "country": "+55",
                                "fileId": 77825,
                                "text": `Olá ${user.name}!

Sua solicitação de pagamento de bonificação no valor de R$${pay.lote_totalBonificacoes} foi processada e está aguardando liberação. Para mais informações, acesse o painel administrativo.

Atenciosamente,

*Equipe EasyPlan*

_Esta é uma mensagem automática. Favor não responder_.
`
                            },
                            {
                                httpAgent: new http.Agent({
                                    keepAlive: true,
                                    keepAliveMsecs: 0,
                                    timeout: 120000,
                                    scheduling: 'fifo',
                                }),
                                httpsAgent: new https.Agent({
                                    keepAlive: true,
                                    keepAliveMsecs: 0,
                                    timeout: 120000,
                                    scheduling: 'fifo',
                                }),
                            })
                            .then(function (response) { })
                            .catch(function (error) { });
                    }
                }).catch(err => { })
            }
        })
        .catch(err => { });
};

sendMessagePayPago = async (payment) => {
    await User.findOne({
        where: {
            id: payment.user_ID,
        }
    })
        .then(async user => {
            if (user) {
                axios.post(
                    'https://afinidade.atenderbem.com/int/enqueueMessageToSend',
                    {
                        "queueId": 16,
                        "apiKey": "4c5067c17b494efdaf00ed63177b3c2c",
                        "number": user.celular,
                        "country": "+55",
                        "fileId": 77825,
                        "text": `Olá ${user.name}!

Sua solicitação de pagamento de bonificação no valor de R$${payment.lote_totalBonificacoes} foi concluída com sucesso. Para mais informações, acesse o painel administrativo.

Atenciosamente,

*Equipe EasyPlan*

_Esta é uma mensagem automática. Favor não responder_.
`
                    },
                    {
                        httpAgent: new http.Agent({
                            keepAlive: true,
                            keepAliveMsecs: 0,
                            timeout: 120000,
                            scheduling: 'fifo',
                        }),
                        httpsAgent: new https.Agent({
                            keepAlive: true,
                            keepAliveMsecs: 0,
                            timeout: 120000,
                            scheduling: 'fifo',
                        }),
                    })
                    .then(function (response) { })
                    .catch(function (error) { });
            }
        })
        .catch(err => { });
};

module.exports = {
    sendMessageCodeImage,
    sendMessagePayAnalise,
    sendMessagePayErro,
    sendMessagePayProcessado,
    sendMessagePayPago
};