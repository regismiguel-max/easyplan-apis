// const venom = require('venom-bot');
// const wppconnect = require('@wppconnect-team/wppconnect');
// const path = require('path');
let client;

const axios = require('axios');

initSession = async () => {
    // wppconnect
    //     .create({
    //         session: "whatsbottwofactorauthentication",
    //         autoClose: false,
    //         puppeteerOptions: { args: ["--no-sandbox", "--enable-gpu"], headless: 'shell' },
    //     })
    //     .then(async (cl) => {
    //         client = await cl;
    //         return cl
    //     })
};

sendMessageLinkPreview = async (req, res) => {
    // client
    //     .checkNumberStatus(`55${req.body.whatsapp}@c.us`)
    //     .then((result) => {
    //         client
    //             .sendLinkPreview(
    //                 result.id._serialized,
    //                 req.body.url,
    //                 req.body.message
    //             )
    //             .then((result) => {
    //                 res.send({
    //                     message: "Mensagem enviada com sucesso!",
    //                     sucesso: true
    //                 });
    //             })
    //             .catch((erro) => {
    //                 res.status(401).send({
    //                     message: erro.message,
    //                     sucesso: false
    //                 });
    //             });
    //     })
    //     .catch((erro) => {
    //         res.status(401).send({
    //             message: erro.message,
    //             sucesso: false
    //         });
    //     });

    axios.post(
        'https://afinidade.atenderbem.com/int/enqueueMessageToSend',
        {
            "queueId": 31,
            "apiKey": "@qualizap@123",
            "number": req.body.whatsapp,
            "country": "+55",
            "urlButtonConfig": {
                "title": "",
                "buttons": [
                    {
                        "url": req.body.url,
                        "text": "Clique Aqui"
                    }
                ]
            },
            "text": `${req.body.message}`
        })
        .then(function (response) {
            res.send({
                message: "Mensagem enviada com sucesso!",
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

sendMessageLinkDocument = async (req, res) => {
    // const pt = path.resolve("whatsapp", "..", "").replace(/\\/g, '/');
    // client
    //     .checkNumberStatus(`55${req.body.whatsapp}@c.us`)
    //     .then((result) => {
    //         client
    //             .sendImage(
    //                 result.id._serialized,
    //                 `${pt}/uploads/EasyPlan/Logo_EasyPlan_Slogan.jpg`,
    //                 `EasyPlan`,
    //                 req.body.message
    //             )
    //             .then((result) => {
    //                 res.send({
    //                     message: "Mensagem enviada com sucesso!",
    //                     sucesso: true
    //                 });
    //             })
    //             .catch((erro) => {
    //                 res.status(401).send({
    //                     message: erro.message,
    //                     sucesso: false
    //                 });
    //             });
    //     })
    //     .catch((erro) => {
    //         res.status(401).send({
    //             message: erro.message,
    //             sucesso: false
    //         });
    //     });

    axios.post(
        'https://afinidade.atenderbem.com/int/enqueueMessageToSend',
        {
            "queueId": 31,
            "apiKey": "@qualizap@123",
            "number": req.body.whatsapp,
            "country": "+55",
            "fileId": 77825,
            "text": `${req.body.message}`
        })
        .then(function (response) {
            res.send({
                message: "Mensagem enviada com sucesso!",
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

sendMessageSituacao = async (req, res, co) => {
    // const pt = path.resolve("whatsapp", "..", "").replace(/\\/g, '/');
    // client
    //     .checkNumberStatus(req.whatsapp)
    //     .then((result) => {
    //         client
    //             .sendImage(
    //                 result.id._serialized,
    //                 `${pt}/uploads/EasyPlan/Logo_EasyPlan_Slogan.jpg`,
    //                 `EasyPlan`,
    //                 req.message
    //             )
    //             .then((result) => {
    //                 res.send({
    //                     corretora: co,
    //                     message: "Corretora atualizada com sucesso!",
    //                     sucesso: true
    //                 });
    //             })
    //             .catch((erro) => {
    //                 res.status(401).send({
    //                     message: erro.message,
    //                     sucesso: false
    //                 });
    //             });
    //     })
    //     .catch((erro) => {
    //         res.status(401).send({
    //             message: erro.message,
    //             sucesso: false
    //         });
    //     });

    axios.post(
        'https://afinidade.atenderbem.com/int/enqueueMessageToSend',
        {
            "queueId": 31,
            "apiKey": "@qualizap@123",
            "number": req.whatsapp,
            "country": "+55",
            "fileId": 77825,
            "text": `${req.message}`
        })
        .then(function (response) {
            res.send({
                corretora: co,
                message: "Corretora atualizada com sucesso!",
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

sendMessageSituacaoProdutor = async (req, res, pro) => {

    axios.post(
        'https://afinidade.atenderbem.com/int/enqueueMessageToSend',
        {
            "queueId": 31,
            "apiKey": "@qualizap@123",
            "number": req.whatsapp,
            "country": "+55",
            "fileId": 77825,
            "text": `${req.message}`
        })
        .then(function (response) {
            res.send({
                produtor: pro,
                message: "Produtor atualizado com sucesso!",
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

sendMessageLink = async (req, res) => {
    //     client
    //         .checkNumberStatus(req.whatsapp)
    //         .then((result) => {
    //             client
    //                 .sendText(
    //                     result.id._serialized,
    //                     `${req.message}

    // ${req.url}`,
    //                 )
    //                 .then((resu) => {
    //                     res.send({
    //                         message: "Autenticação de dos fatores enviada com sucesso!",
    //                         sucesso: true
    //                     });
    //                 })
    //                 .catch((erro) => {
    //                     console.log(erro)
    //                     res.status(401).send({
    //                         message: erro.message,
    //                         sucesso: false
    //                     });
    //                 });
    //         })
    //         .catch((erro) => {
    //             console.log(erro)
    //             res.status(401).send({
    //                 message: erro.message,
    //                 sucesso: false
    //             });
    //         });

    axios.post(
        'https://afinidade.atenderbem.com/int/enqueueMessageToSend',
        {
            "queueId": 31,
            "apiKey": "@qualizap@123",
            "number": req.whatsapp,
            "country": "+55",
            "text": `${req.message}

${req.url}`
        })
        .then(function (response) {
            res.send({
                message: "Autenticação de dos fatores enviada com sucesso!",
                sucesso: true
            });
        })
        .catch(function (error) {
            console.log(erro)
            res.status(401).send({
                message: erro.message,
                sucesso: false
            });
        });
};

sendMessageLinkImage = async (req, res, cnpj) => {
    //     const pt = path.resolve("whatsapp", "..", "").replace(/\\/g, '/');
    //     client
    //         .checkNumberStatus(req.whatsapp)
    //         .then((result) => {
    //             client
    //                 .sendImage(
    //                     result.id._serialized,
    //                     `${pt}/uploads/EasyPlan/Logo_EasyPlan_Slogan.jpg`,
    //                     `EasyPlan`,
    //                     `${req.message1}

    // ${req.message2}

    // ${req.message3}

    // ${req.url}

    // ${req.message4}

    // ${req.message5}

    // ${req.message6}
    // `,
    //                 )
    //                 .then((resu) => {
    //                     res.send({
    //                         cnpj: cnpj,
    //                         message: "Autenticação de dos fatores enviada com sucesso!",
    //                         sucesso: true
    //                     });
    //                 })
    //                 .catch((erro) => {
    //                     console.log(erro)
    //                     res.status(401).send({
    //                         message: erro.message,
    //                         sucesso: false
    //                     });
    //                 });
    //         })
    //         .catch((erro) => {
    //             console.log(erro)
    //             res.status(401).send({
    //                 message: erro.message,
    //                 sucesso: false
    //             });
    //         });

    axios.post(
        'https://afinidade.atenderbem.com/int/enqueueMessageToSend',
        {
            "queueId": 31,
            "apiKey": "@qualizap@123",
            "number": req.whatsapp,
            "country": "+55",
            "fileId": 77825,
            "text": `${req.message1}
            
${req.message2}
                
${req.message3}
                
${req.url}
                
${req.message4}
                
${req.message5}
                
${req.message6}
`
        })
        .then(function (response) {
            res.send({
                cnpj: cnpj,
                message: "Autenticação de dos fatores enviada com sucesso!",
                sucesso: true
            });
        })
        .catch(function (error) {
            axios.post(
                'https://events.sendpulse.com/events/id/97cf7cdcfda84e4bdf14c9aca0b94aa0/8659497',
                {
                    email: corr.corretoras_contatos[0].email,
                    phone: `55${req.whatsapp}`,
                    responsavel: corr.corretoras_responsavels[0].nome,
                    isnew: 'true',
                    isapproved: '',
                    isauthentication: 'true',
                    url: req.url
                })
                .then(function (resp) {
                    res.send({
                        cnpj: cnpj,
                        message: "Autenticação de dos fatores enviada com sucesso!",
                        sucesso: true
                    });
                })
                .catch(function (error) {
                    console.log(erro)
                    res.status(401).send({
                        message: erro.message,
                        sucesso: false
                    });
                });
        });
};

sendMessageLinkImageProdutor = async (req, res, cpf) => {
    axios.post(
        'https://afinidade.atenderbem.com/int/enqueueMessageToSend',
        {
            "queueId": 31,
            "apiKey": "@qualizap@123",
            "number": req.whatsapp,
            "country": "+55",
            "fileId": 77825,
            "text": `${req.message1}
            
${req.message2}
                
${req.message3}
                
${req.url}
                
${req.message4}
                
${req.message5}
                
${req.message6}
`
        })
        .then(function (response) {
            res.send({
                cpf: cpf,
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

sendMessageAlertLote = async (req) => {
    // const pt = path.resolve("whatsapp", "..", "").replace(/\\/g, '/');
    // client
    //     .checkNumberStatus(req.whatsapp)
    //     .then((result) => {
    //         client
    //             .sendImage(
    //                 result.id._serialized,
    //                 `${pt}/uploads/EasyPlan/Logo_EasyPlan_Slogan.jpg`,
    //                 `EasyPlan`,
    //                 req.message,
    //             )
    //             .then((res) => {
    //             })
    //             .catch((erro) => {
    //             });
    //     })
    //     .catch((erro) => { });

    axios.post(
        'https://afinidade.atenderbem.com/int/enqueueMessageToSend',
        {
            "queueId": 31,
            "apiKey": "@qualizap@123",
            "number": req.whatsapp,
            "country": "+55",
            "fileId": 77825,
            "text": `${req.message}`
        })
        .then(function (response) {
        })
        .catch(function (error) {
        });
};

sendMessageSarah = async (req, res) => {
    const clientes = req.body.clientes;
    const batchSize = 20;
    const delayMs = 300;

    if (!clientes || !Array.isArray(clientes) || clientes.length === 0) {
        return res.status(400).send({
            message: "Nenhum cliente recebido.",
            sucesso: false
        });
    }

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const falhas = [];
    const enviados = [];

    for (let i = 0; i < clientes.length; i += batchSize) {
        const batch = clientes.slice(i, i + batchSize);

        for (const element of batch) {
            try {
                console.log(`[${element.number}] Enviando mensagem para ${element.name}...`);

                await axios.post('https://afinidade.atenderbem.com/int/enqueueMessageToSend', {
                    queueId: 16,
                    apiKey: "4c5067c17b494efdaf00ed63177b3c2c",
                    number: element.number,
                    country: "+55",
                    text: `📢 Olá, ${element.name}, bom dia!

*Temos uma última oportunidade para resolver sua pendência financeira!*

Consta em nosso sistema uma *pendência financeira ativa*, já registrada no *Serasa*. ⛔

Estamos oferecendo *boas condições de negociação*, mas é fundamental agir com urgência.

💡 Regularizando agora, você evita *protesto em cartório* e o início de um *processo judicial*.

📲 *Responda esta mensagem* para conhecer as opções disponíveis e resolver de forma rápida e segura.

Estamos à disposição para ajudar!
`,
                    campaignName: "Envio - 18-07-2025",
                    extData: "Envio - 18-07-2025",
                    extFlag: 1,
                    hidden: false
                });

                console.log(`✅ Mensagem enviada para ${element.name} (${element.number})`);
                enviados.push(element.number);

            } catch (erro) {
                console.error(`❌ Erro ao enviar para ${element.name} (${element.number}):`, erro.message);
                falhas.push({ number: element.number, name: element.name, erro: erro.message });
            }

            await sleep(delayMs);
        }
    }

    return res.send({
        message: "Processo concluído.",
        sucesso: true,
        enviados: enviados.length,
        falhas: falhas.length,
        detalhesFalhas: falhas
    });
};


sendMessageAPIOficial = async (req, res) => {
    const clientes = req.body.clientes;
    const batchSize = 20;
    const delayMs = 300;

    if (!clientes || !Array.isArray(clientes) || clientes.length === 0) {
        return res.status(400).send({
            message: "Nenhum cliente recebido.",
            sucesso: false
        });
    }

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const falhas = [];
    const enviados = [];

    for (let i = 0; i < clientes.length; i += batchSize) {
        const batch = clientes.slice(i, i + batchSize);

        for (const element of batch) {
            try {
                console.log(`[${element.number}] Enviando mensagem para ${element.name}...`);

                await axios.post('https://afinidade.atenderbem.com/int/enqueueMessageToSend', {
                    queueId: 27,
                    apiKey: "092244c731cb42da9f3ebcf785f9189f",
                    headerFile: "https://afinidade.atenderbem.com:443/static/downloadMedia?id=161019&download=false&auth=_jCk80qqqL5r55K6jH4gfcdB6bm0G_dwp0vfQcDmJC8=",
                    templateId: 41,
                    number: element.number,
                    country: "+55",
                    campaignName: "Informativo dos Hospitais Nova Saúde - 26-06-2025",
                    extData: "Informativo dos Hospitais Nova Saúde - 26-06-2025",
                    extFlag: 1,
                    hidden: false
                });

                console.log(`✅ Mensagem enviada para ${element.name} (${element.number})`);
                enviados.push(element.number);

            } catch (erro) {
                console.error(`❌ Erro ao enviar para ${element.name} (${element.number}):`, erro.message);
                falhas.push({ number: element.number, name: element.name, erro: erro.message });
            }

            await sleep(delayMs);
        }
    }

    return res.send({
        message: "Processo concluído.",
        sucesso: true,
        enviados: enviados.length,
        falhas: falhas.length,
        detalhesFalhas: falhas
    });
};

sendMessageBatalha = async () => {
    const numeros = ['54992389702', '61993598991'];
    numeros.forEach(async element => {
        await axios.post('https://afinidade.atenderbem.com/int/enqueueMessageToSend', {
            queueId: 20,
            apiKey: "@qualizap@123",
            number: element,
            country: "+55",
            text: `📢 Olá, a Batalha Easy — Heróis que fazem a diferença foi atualizada com sucesso!`,
        });
    });
}

module.exports = {
    client,
    initSession,
    sendMessageLinkPreview,
    sendMessageLink,
    sendMessageLinkImage,
    sendMessageLinkDocument,
    sendMessageSituacao,
    sendMessageAlertLote,
    sendMessageSituacaoProdutor,
    sendMessageLinkImageProdutor,
    sendMessageSarah,
    sendMessageAPIOficial,
    sendMessageBatalha
};