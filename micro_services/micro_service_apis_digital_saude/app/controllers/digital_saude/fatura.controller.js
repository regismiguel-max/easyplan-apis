const axios = require("../../config/axios/axios.config.js");

exports.procurarPorContrato = async (req, res) => {
    StatusEmitida(req, res);
};

StatusEmitida = async (req, res) => {
    const faturas = [];
    axios.https.get(
        `/fatura/procurarPorContrato?codigoContrato=${req.params.codigo}&idStatusFatura=2&pix=1`,
    )
        .then((response2) => {
            if (response2.data.length > 0) {
                response2.data.forEach((element2, index2) => {
                    if (response2.data.length - 1 === index2) {
                        // if (element2.registrado === 1 || element2.registrado === '1') {
                        faturas.push(element2);
                        StatusPaga(req, res, faturas);
                        // }
                        // else {
                        //     StatusPaga(req, res, faturas);
                        // }
                    }
                    else {
                        // if (element2.registrado === 1 || element2.registrado === '1') {
                        faturas.push(element2);
                        // }
                    }
                });
            }
            else {
                StatusPaga(req, res, faturas);
            }
        })
        .catch((err2) => {
            ReturnError(req, res, err2);
        })
        .finally(() => { });
};

StatusPaga = async (req, res, faturas) => {
    axios.https.get(
        `/fatura/procurarLiquidadasPorContrato?codigoContrato=${req.params.codigo}`,
    )
        .then((response3) => {
            if (response3.data.length > 0) {
                response3.data.forEach((element3, index3) => {
                    if (response3.data.length - 1 === index3) {
                        faturas.push(element3);
                        // StatusBaixada(req, res, faturas);
                        StatusVencida(req, res, faturas);
                    }
                    else {
                        faturas.push(element3);
                    }
                });
            }
            else {
                // StatusBaixada(req, res, faturas);
                StatusVencida(req, res, faturas);
            }
        })
        .catch((err3) => {
            // ReturnError(req, res, err3);
            StatusVencida(req, res, faturas);
        })
        .finally(() => { });
}

StatusBaixada = async (req, res, faturas) => {
    axios.https.get(
        `/fatura/procurarLiquidadasPorContrato?codigoContrato=${req.params.codigo}`,
    )
        .then((response6) => {
            if (response6.data.length > 0) {
                response6.data.forEach((element6, index6) => {
                    if (response6.data.length - 1 === index6) {
                        faturas.push(element6);
                        StatusVencida(req, res, faturas);
                    }
                    else {
                        faturas.push(element6);
                    }
                });
            }
            else {
                StatusVencida(req, res, faturas);
            }
        })
        .catch((err6) => {
            // ReturnError(req, res, err6);
            StatusVencida(req, res, faturas);
        })
        .finally(() => { });
}

StatusVencida = async (req, res, faturas) => {
    axios.https.get(
        `/fatura/procurarPorContrato?codigoContrato=${req.params.codigo}&idStatusFatura=4&pix=1`,
    )
        .then((response4) => {
            if (response4.data.length > 0) {
                response4.data.forEach((element4, index4) => {
                    if (response4.data.length - 1 === index4) {
                        faturas.push(element4);
                        ReturnSuccess(req, res, faturas);
                    }
                    else {
                        faturas.push(element4);
                    }
                });
            }
            else {
                ReturnSuccess(req, res, faturas);
            }
        })
        .catch((err4) => {
            ReturnError(req, res, err4);
        })
        .finally(() => { });
}

ReturnSuccess = async (req, res, faturas) => {
    let faturasordemmes = faturas.sort((a, b) => {
        return a.mes - b.mes;
    });

    let faturasordemano = faturasordemmes.sort((a, b) => {
        return a.ano - b.ano;
    });

    res.send({
        faturas: faturasordemano,
        message: "Faturas encontradas com sucesso!",
        sucesso: true
    });
}

ReturnError = async (req, res, err) => {
    res.status(500).send({
        message: err.message,
        sucesso: false
    });
}

exports.kualizProcurarPorContrato = async (req, res) => {
    KualizStatusEmitida(req, res);
};

KualizStatusEmitida = async (req, res) => {
    const faturas = [];
    axios.https.get(
        `/fatura/procurarPorContrato?codigoContrato=${req.params.codigo}&idStatusFatura=2&pix=1`,
    )
        .then((response2) => {
            if (response2.data.length > 0) {
                response2.data.forEach((element2, index2) => {
                    if (response2.data.length - 1 === index2) {
                        faturas.push(element2);
                        KualizStatusVencida(req, res, faturas);
                    }
                    else {
                        faturas.push(element2);
                    }
                });
            }
            else {
                KualizStatusVencida(req, res, faturas);
            }
        })
        .catch((err2) => {
            ReturnError(req, res, err2);
        })
        .finally(() => { });
};

KualizStatusVencida = async (req, res, faturas) => {
    axios.https.get(
        `/fatura/procurarPorContrato?codigoContrato=${req.params.codigo}&idStatusFatura=4&pix=1`,
    )
        .then((response4) => {
            if (response4.data.length > 0) {
                response4.data.forEach((element4, index4) => {
                    if (response4.data.length - 1 === index4) {
                        faturas.push(element4);
                        ReturnSuccessKualiz(req, res, faturas);
                    }
                    else {
                        faturas.push(element4);
                    }
                });
            }
            else {
                ReturnSuccessKualiz(req, res, faturas);
            }
        })
        .catch((err4) => {
            ReturnErrorKualiz(req, res, err4);
        })
        .finally(() => { });
}

ReturnSuccessKualiz = async (req, res, faturas) => {
    // Aplica a lógica de VerificarFaturasDigital
    const faturaDigital = await obterFaturaValida(faturas);

    if (faturaDigital) {
        res.send({
            fatura: faturaDigital,
            message: "Fatura encontrada com sucesso!",
            sucesso: true
        });
    } else {
        res.send({
            fatura: null,
            message: "Nenhuma fatura válida encontrada!",
            sucesso: true
        });
    }
};

parseDataBR = (dataStr) => {
    if (!dataStr) return null;
    const [dia, mes, ano] = dataStr.split('/').map(Number);
    return new Date(ano, mes - 1, dia); // mês começa do 0
}

obterFaturaValida = async (faturas) => {
    if (faturas && faturas.length > 0) {
        const candidatas = faturas.filter(f =>
            f.statusFatura &&
            (f.statusFatura.id === 2 || f.statusFatura.id === 4) &&
            f.dataVencimento
        );

        if (candidatas.length > 0) {
            // Ordena pela data mais antiga
            candidatas.sort((a, b) => {
                const dataA = parseDataBR(a.dataVencimento);
                const dataB = parseDataBR(b.dataVencimento);
                return dataA - dataB;
            });

            return candidatas[0]; // Retorna a mais antiga
        }
    }

    return null;
}

ReturnErrorKualiz = async (req, res, err) => {
    res.status(500).send({
        message: err.message,
        sucesso: false
    });
}

// id Status Fatura value = 1 -> Provisória
// id Status Fatura value = 2 -> Emitida
// id Status Fatura value = 3 -> Paga
// id Status Fatura value = 4 -> Vencida
// id Status Fatura value = 5 -> Cancelada
// id Status Fatura value = 6 -> Baixada
// id Status Fatura value = 7 -> Paga no Cartão
// id Status Fatura value = 8 -> Parcelada
// id Status Fatura value = 9 -> Reemitida


// const options = require("../../config/fetch/fetch.config.js");
// const fetch = require("node-fetch");

// exports.procurarPorContrato = async (req, res) => {
//     StatusEmitida(req, res);
// };

// StatusEmitida = async (req, res) => {
//     const faturas = [];
//     await fetch(
//         `${process.env.BASEURL}/fatura/procurarPorContrato?codigoContrato=${req.params.codigo}&idStatusFatura=2`,
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
//         .then(async (response2) => {
//             const data2 = await response2.json();
//             if (data2.length > 0) {
//                 data2.forEach((element2, index2) => {
//                     if (data2.length - 1 === index2) {
//                         if (element2.registrado === 1 || element2.registrado === '1') {
//                             faturas.push(element2);
//                             StatusPaga(req, res, faturas);
//                         }
//                         else {
//                             StatusPaga(req, res, faturas);
//                         }
//                     }
//                     else {
//                         if (element2.registrado === 1 || element2.registrado === '1') {
//                             faturas.push(element2);
//                         }
//                     }
//                 });
//             }
//             else {
//                 StatusPaga(req, res, faturas);
//             }
//         })
//         .catch((err2) => {
//             ReturnError(req, res, err2);
//         })
//         .finally(() => { });
// };

// StatusPaga = async (req, res, faturas) => {
//     await fetch(
//         `${process.env.BASEURL}/fatura/procurarLiquidadasPorContrato?codigoContrato=${req.params.codigo}`,
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
//         .then(async (response3) => {
//             const data3 = await response3.json();
//             if (data3.length > 0) {
//                 data3.forEach((element3, index3) => {
//                     if (data3.length - 1 === index3) {
//                         faturas.push(element3);
//                         // StatusBaixada(req, res, faturas);
//                         StatusVencida(req, res, faturas);
//                     }
//                     else {
//                         faturas.push(element3);
//                     }
//                 });
//             }
//             else {
//                 // StatusBaixada(req, res, faturas);
//                 StatusVencida(req, res, faturas);
//             }
//         })
//         .catch((err3) => {
//             // ReturnError(req, res, err3);
//             StatusVencida(req, res, faturas);
//         })
//         .finally(() => { });
// }

// StatusBaixada = async (req, res, faturas) => {
//     await fetch(
//         `${process.env.BASEURL}/fatura/procurarLiquidadasPorContrato?codigoContrato=${req.params.codigo}`,
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
//         .then(async (response6) => {
//             const data6 = await response6.json();
//             if (data6.length > 0) {
//                 data6.forEach((element6, index6) => {
//                     if (data6.length - 1 === index6) {
//                         faturas.push(element6);
//                         StatusVencida(req, res, faturas);
//                     }
//                     else {
//                         faturas.push(element6);
//                     }
//                 });
//             }
//             else {
//                 StatusVencida(req, res, faturas);
//             }
//         })
//         .catch((err6) => {
//             // ReturnError(req, res, err6);
//             StatusVencida(req, res, faturas);
//         })
//         .finally(() => { });
// }

// StatusVencida = async (req, res, faturas) => {
//     await fetch(
//         `${process.env.BASEURL}/fatura/procurarPorContrato?codigoContrato=${req.params.codigo}&idStatusFatura=4`,
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
//         .then(async (response4) => {
//             const data4 = await response4.json();
//             if (data4.length > 0) {
//                 data4.forEach((element4, index4) => {
//                     if (data4.length - 1 === index4) {
//                         faturas.push(element4);
//                         ReturnSuccess(req, res, faturas);
//                     }
//                     else {
//                         faturas.push(element4);
//                     }
//                 });
//             }
//             else {
//                 ReturnSuccess(req, res, faturas);
//             }
//         })
//         .catch((err4) => {
//             ReturnError(req, res, err4);
//         })
//         .finally(() => { });
// }

// ReturnSuccess = async (req, res, faturas) => {
//     let faturasordemmes = faturas.sort((a, b) => {
//         return a.mes - b.mes;
//     });

//     let faturasordemano = faturasordemmes.sort((a, b) => {
//         return a.ano - b.ano;
//     });

//     res.send({
//         faturas: faturasordemano,
//         message: "Faturas encontradas com sucesso!",
//         sucesso: true
//     });
// }

// ReturnError = async (req, res, err) => {
//     res.status(500).send({
//         message: err.message,
//         sucesso: false
//     });
// }
