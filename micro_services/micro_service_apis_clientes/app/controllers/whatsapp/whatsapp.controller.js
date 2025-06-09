const axios = require('axios');
const http = require('http');
const https = require('https');

sendMessageCodeImage = async (req, res, code) => {
    axios.post(
        'https://afinidade.atenderbem.com/int/enqueueMessageToSend',
        {
            "queueId": 20,
            "apiKey": "9c35e41ff6224efba0f52ba47ecb51b9",
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

module.exports = {
    sendMessageCodeImage,
};