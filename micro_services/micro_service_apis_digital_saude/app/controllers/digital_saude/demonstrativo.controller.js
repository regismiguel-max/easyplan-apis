const axios = require("../../config/axios/axios.config.js");

exports.procurarPorContrato = async (req, res) => {
    // axios.https.get(
    //     `/demonstrativoPagamento/procurarPorContrato?codigoContrato=${req.params.codigoContrato}`,

    // )
    //     .then((response) => {
    //         if (response.data) {
    //             res.send({
    //                 demonstrativo: response.data,
    //                 message: "Demonstrativo encontrado com sucesso!",
    //                 sucesso: true
    //             });
    //         }
    //         else {
    //             res.send({
    //                 message: "Nenhum demonstrativo encontrado!",
    //                 sucesso: true
    //             });
    //         }
    //     })
    //     .catch((err) => {
    //         res.status(500).send({
    //             message: err.message,
    //             sucesso: false
    //         });
    //     })
    //     .finally(() => { });

    try {
        const { codigoContrato } = req.params;

        if (!codigoContrato) {
            return res.status(400).json({
                message: "codigoContrato é obrigatório!",
                sucesso: false,
            });
        }

        // ✅ Não estoura erro em 404 (tratamos como "não encontrado")
        const contratoResp = await axios.https.get(
            `contrato/${encodeURIComponent(codigoContrato)}`,
            { validateStatus: (s) => s < 500 }
        );

        if (contratoResp.status === 404 || !contratoResp?.data) {
            return res.json({
                demonstrativo: [],
                message: "Nenhum contrato encontrado!",
                sucesso: true,
            });
        }

        const contrato = contratoResp.data;

        // 1) cpfResponsavel (se existir)
        let cpf = contrato?.cpfResponsavel;

        // 2) fallback: pegar CPF do titular em beneficiarioList (tipoBeneficiario.id === 1)
        if (!cpf) {
            const list = contrato?.beneficiarioList;
            if (Array.isArray(list)) {
                const titular = list.find((b) => b?.tipoBeneficiario?.id === 1 && b?.cpf);
                cpf = titular?.cpf;
            }
        }

        if (!cpf) {
            return res.json({
                demonstrativo: [],
                message:
                    "Contrato encontrado, mas não foi possível determinar o CPF do titular (cpfResponsavel ausente e Titular não encontrado em beneficiarioList).",
                sucesso: false,
            });
        }

        // ✅ Não estoura erro em 404
        const irResp = await axios.https_supabase.get("consultar-ir", {
            params: { cpf, ano: 2026 },
            validateStatus: (s) => s < 500,
        });

        // ✅ Se o endpoint respondeu 404, trate como "não encontrado"
        if (irResp.status === 404) {
            return res.json({
                demonstrativo: [],
                message: "Nenhum demonstrativo encontrado!",
                sucesso: true,
            });
        }

        const payload = irResp?.data;

        // ✅ Quando o endpoint responde JSON com sucesso:false
        if (payload?.sucesso === false) {
            if (payload?.codigo === "TITULAR_NOT_FOUND") {
                return res.json({
                    demonstrativo: [],
                    message: payload?.erro || "Titular não encontrado na base DMED",
                    codigo: payload?.codigo,
                    anosDisponiveis: payload?.anosDisponiveis || [],
                    sucesso: true, // request ok, apenas não existe demonstrativo
                });
            }

            // outros códigos do consultar-ir
            return res.status(400).json({
                demonstrativo: [],
                message: payload?.erro || "Erro ao consultar demonstrativo",
                codigo: payload?.codigo,
                anosDisponiveis: payload?.anosDisponiveis || [],
                sucesso: false,
            });
        }

        const dados = payload?.dados;

        if (!dados) {
            return res.json({
                demonstrativo: [],
                message: "Nenhum demonstrativo encontrado!",
                sucesso: true,
            });
        }

        return res.json({
            demonstrativo: [
                {
                    anoCalendario: dados.anoCalendario,
                    anoReferencia: dados.anoReferencia,
                    codigo: cpf,
                    cpf: cpf,
                    linkDemonstrativo: dados.linkPdf,
                    valor: dados.valorTotal,
                },
            ],
            message: "Demonstrativo encontrado com sucesso!",
            sucesso: true,
        });
    } catch (err) {
        const status = err?.response?.status;
        const data = err?.response?.data;

        return res.status(500).json({
            message: data?.erro || data?.message || err.message,
            codigo: data?.codigo,
            sucesso: false,
        });
    }
};