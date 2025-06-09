const axios = require("../../../config/axios/axios.config.js");

exports.procurarProposta = async (req, res) => {
    const body = {};
    body.cnpj_operadora = "27252086000104";

    if (req.body.data_inicio && req.body.data_fim) {
        body.data_inicio = req.body.data_inicio;
        body.data_fim = req.body.data_fim;
    };

    if (req.body.numeroProposta) {
        body.propostas = [Number(req.body.numeroProposta)];
    };

    if (req.body.status) {
        body.status = req.body.status;
    };

    if (req.body.contratante_cpf) {
        body.contratantes_cpf = [String(req.body.contratante_cpf)];
    };

    if (req.body.uf) {
        body.uf = req.body.uf.split("-");
    };

    axios.https.post(
        `proposta/consulta/v1`,
        body
    )
        .then((response) => {
            if (response.data) {
                if (response.data.propostas.length > 0) {
                    res.send({
                        propostas: response.data.propostas,
                        message: "Proposta encontrada com sucesso!",
                        sucesso: true
                    });
                }
                else {
                    res.send({
                        message: "Nenhuma proposta encontrada!",
                        sucesso: true
                    });
                }
            }
            else {
                res.send({
                    message: "Nenhuma proposta encontrada!",
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

exports.editarProposta = async (req, res) => {
    const clientes = req.body.clientes;
    const batchSize = 20;
    const delayMs = 300;

    if (!clientes || !Array.isArray(clientes) || clientes.length === 0) {
        return res.status(400).send({
            message: "Nenhuma proposta recebida.",
            sucesso: false
        });
    }

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const respostas = [];
    const enviados = new Set();

    for (let i = 0; i < clientes.length; i += batchSize) {
        const batch = clientes.slice(i, i + batchSize);

        for (const element of batch) {
            // Evita reenvio da mesma proposta
            if (enviados.has(element.numero_proposta)) {
                console.warn(`⚠️ Proposta ${element.numero_proposta} já foi processada. Ignorando duplicata.`);
                continue;
            }

            enviados.add(element.numero_proposta);
            const requestId = `${element.numero_proposta}-${Date.now()}`;
            console.log(`[${requestId}] Enviando proposta ${element.numero_proposta} com status ${element.status}`);

            const payload = {
                cnpj_operadora: "27252086000104",
                propostas: [
                    {
                        numero_proposta: element.numero_proposta,
                        status: element.status
                    }
                ]
            };

            try {
                const response = await axios.https.put('proposta/status/v1', payload);
                respostas.push({
                    numero_proposta: element.numero_proposta,
                    status_enviado: element.status,
                    sucesso: true,
                    statusHttp: response.status,
                    data: response.data
                });

                console.log(`✅ Proposta ${element.numero_proposta} editada com sucesso`);
            } catch (err) {
                respostas.push({
                    numero_proposta: element.numero_proposta,
                    status_enviado: element.status,
                    sucesso: false,
                    erro: err.message,
                    statusHttp: err.response?.status || null,
                    responseData: err.response?.data || null
                });

                console.error(`❌ Erro ao editar proposta ${element.numero_proposta}: ${err.message}`);
            }

            await sleep(delayMs);
        }
    }

    return res.send({
        message: "Processo de edição concluído.",
        sucesso: true,
        total: respostas.length,
        respostas
    });
};