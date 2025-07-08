const axios = require("../../config/axios/axios.config.js");

exports.procurarPorCpfTitular = async (req, res) => {
    axios.https.get(
        `contrato/procurarPorCpfTitular?cpf=${req.params.cpf}`,
    )
        .then((response) => {
            console.log(response)
            const contrato = [];
            if (response.data.length > 0) {
                response.data.forEach((element, index) => {
                    if (response.data.length - 1 === index) {

                        if (element.statusContrato.nome === "Ativo" || element.statusContrato.nome === "Suspenso" || element.statusContrato.nome === "Cancelado") {
                            contrato.push(element);
                            res.send({
                                contrato: contrato,
                                message: "Contrato encontrado com sucesso!",
                                sucesso: true
                            });
                        }
                        else {
                            res.send({
                                contrato: contrato,
                                message: "Contrato encontrado com sucesso!",
                                sucesso: true
                            });
                        }
                    }
                    else {
                        if (element.statusContrato.nome === "Ativo" || element.statusContrato.nome === "Suspenso" || element.statusContrato.nome === "Cancelado") {
                            contrato.push(element);
                        }
                    }
                });
            }
            else {
                res.send({
                    message: "Nenhum contrato encontrado!",
                    sucesso: true
                });
            }
        })
        .catch((err) => {
            console.log(err)
            res.status(500).send({
                message: err.message,
                sucesso: false
            });
        })
        .finally(() => { });
};

exports.kualizProcurarPorCpfTitular = async (req, res) => {
    axios.https.get(
        `contrato/procurarPorCpfTitular?cpf=${req.params.cpf}`,
    )
        .then((response) => {
            const todosContratos = response.data || [];

            // Filtra apenas os contratos com status aceitos
            const contratosValidos = todosContratos.filter(c =>
                c.statusContrato &&
                ['Ativo', 'Suspenso', 'Cancelado'].includes(c.statusContrato.nome)
            );

            // Aplica lógica de seleção do contrato final
            let contratoSelecionado = null;

            if (contratosValidos.length > 0) {
                const ativos = contratosValidos.filter(c => c.statusContrato.nome === 'Ativo');

                if (ativos.length > 0) {
                    contratoSelecionado = ativos[0]; // Primeiro contrato ativo
                } else {
                    const suspensos = contratosValidos.filter(c => c.statusContrato.nome === 'Suspenso');
                    if (suspensos.length > 0) {
                        contratoSelecionado = suspensos[0]; // Primeiro contrato suspenso
                    } else {
                        // Filtra os contratos que não têm dataExclusao
                        const semExclusao = contratosValidos.filter(c => !c.dataExclusao);

                        if (semExclusao.length > 0) {
                            contratoSelecionado = semExclusao[semExclusao.length - 1]; // Último contrato sem dataExclusao
                        } else {
                            contratoSelecionado = contratosValidos[contratosValidos.length - 1]; // Último contrato, mesmo com dataExclusao
                        }
                    }
                }

                res.send({
                    contrato: contratoSelecionado,
                    message: "Contrato encontrado com sucesso!",
                    sucesso: true
                });
            } else {
                res.send({
                    contrato: null,
                    message: "Nenhum contrato encontrado!",
                    sucesso: true
                });
            }
        })
        .catch((err) => {
            console.log(err);
            res.status(500).send({
                message: err.message,
                sucesso: false
            });
        });
};

exports.procurarPorCodigo = async (req, res) => {
    axios.https.get(
        `contrato/${req.params.codigo}`,

    )
        .then((response) => {
            if (response.data) {
                res.send({
                    contrato: response.data,
                    message: "Contrato encontrado com sucesso!",
                    sucesso: true
                });
            }
            else {
                res.send({
                    message: "Nenhum contrato encontrado!",
                    sucesso: true
                });
            }
        })
        .catch((err) => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            });
        })
        .finally(() => { });
};

exports.procurarPorClientePortal = async (req, res) => {
    axios.https.get(
        `contrato/procurarPorClientePortal?cpf=${req.body.cpf}&email=${req.body.email}`,
    )
        .then((response) => {
            if (response.data) {
                res.send({
                    contrato: response.data,
                    message: "Contrato encontrado com sucesso!",
                    sucesso: true
                });
            }
            else {
                res.send({
                    message: "Nenhum contrato encontrado!",
                    sucesso: true
                });
            }
        })
        .catch((err) => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            });
        })
        .finally(() => { });
};


// const options = require("../../config/fetch/fetch.config.js");
// const fetch = require("node-fetch");

// exports.procurarPorCpfTitular = async (req, res) => {
//     await fetch(
//         `${process.env.BASEURL}/contrato/procurarPorCpfTitular?cpf=${req.params.cpf}`,
//         {
//             method: 'GET',
//             headers: options.headers,
//             agent: (_parsedURL) => {
//                 if (_parsedURL.protocol == 'http:') {
//                     return options.httpAgent;
//                 } else {
//                     return options.httpsAgent;
//                 }
//             }
//         }
//     )
//         .then(async (response) => {
//             const data = await response.json();
//             console.log(response)
//             const contrato = [];
//             if (data.length > 0) {
//                 data.forEach((element, index) => {
//                     if (data.length - 1 === index) {

//                         if (element.statusContrato.nome === "Ativo" || element.statusContrato.nome === "Suspenso" || element.statusContrato.nome === "Cancelado") {
//                             contrato.push(element);
//                             res.send({
//                                 contrato: contrato,
//                                 message: "Contrato encontrado com sucesso!",
//                                 sucesso: true
//                             });
//                         }
//                         else {
//                             res.send({
//                                 contrato: contrato,
//                                 message: "Contrato encontrado com sucesso!",
//                                 sucesso: true
//                             });
//                         }
//                     }
//                     else {
//                         if (element.statusContrato.nome === "Ativo" || element.statusContrato.nome === "Suspenso" || element.statusContrato.nome === "Cancelado") {
//                             contrato.push(element);
//                         }
//                     }
//                 });
//             }
//             else {
//                 res.send({
//                     message: "Nenhum contrato encontrado!",
//                     sucesso: true
//                 });
//             }
//         })
//         .catch((err) => {
//             console.log(err)
//             res.status(500).send({
//                 message: err.message,
//                 sucesso: false
//             });
//         })
//         .finally(() => { });
// };

// exports.procurarPorCodigo = async (req, res) => {
//     await fetch(
//         `${process.env.BASEURL}/contrato/${req.params.codigo}`,
//         {
//             method: 'GET',
//             headers: options.headers,
//             agent: (_parsedURL) => {
//                 if (_parsedURL.protocol == 'http:') {
//                     return options.httpAgent;
//                 } else {
//                     return options.httpsAgent;
//                 }
//             }
//         }
//     )
//         .then(async (response) => {
//             const data = await response.json();
//             if (data) {
//                 res.send({
//                     contrato: data,
//                     message: "Contrato encontrado com sucesso!",
//                     sucesso: true
//                 });
//             }
//             else {
//                 res.send({
//                     message: "Nenhum contrato encontrado!",
//                     sucesso: true
//                 });
//             }
//         })
//         .catch((err) => {
//             res.status(500).send({
//                 message: err.message,
//                 sucesso: false
//             });
//         })
//         .finally(() => { });
// };

// exports.procurarPorClientePortal = async (req, res) => {
//     await fetch(
//         `${process.env.BASEURL}/contrato/procurarPorClientePortal?cpf=${req.body.cpf}&email=${req.body.email}`,
//         {
//             method: 'GET',
//             headers: options.headers,
//             agent: (_parsedURL) => {
//                 if (_parsedURL.protocol == 'http:') {
//                     return options.httpAgent;
//                 } else {
//                     return options.httpsAgent;
//                 }
//             }
//         }
//     )
//         .then(async (response) => {
//             const data = await response.json();
//             if (data) {
//                 res.send({
//                     contrato: data,
//                     message: "Contrato encontrado com sucesso!",
//                     sucesso: true
//                 });
//             }
//             else {
//                 res.send({
//                     message: "Nenhum contrato encontrado!",
//                     sucesso: true
//                 });
//             }
//         })
//         .catch((err) => {
//             res.status(500).send({
//                 message: err.message,
//                 sucesso: false
//             });
//         })
//         .finally(() => { });
// };