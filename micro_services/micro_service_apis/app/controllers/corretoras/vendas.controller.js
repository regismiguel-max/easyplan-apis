const db = require("../../../../../models");
const Beneficiario = db.beneficiariosDigital;
const { Op, fn, col, where: whereSequelize } = require("sequelize");
const axios = require("../../config/axios/axios.config.js");
const moment = require("moment");

// Função de delay para controle de taxa de requisições
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Função que busca faturas emitidas e vencidas com tratamento individual de erros
async function buscarFaturasPorContrato(codigoContrato) {
    const faturas = [];

    try {
        const emitidasResp = await axios.digital.get(
            `/fatura/procurarPorContrato?codigoContrato=${codigoContrato}&idStatusFatura=2&pix=1`
        );
        if (Array.isArray(emitidasResp.data)) {
            faturas.push(...emitidasResp.data);
        }
    } catch (err) {
        console.warn(`⚠️ Erro ao buscar faturas emitidas para contrato ${codigoContrato}: ${err.message}`);
    }

    try {
        const vencidasResp = await axios.digital.get(
            `/fatura/procurarPorContrato?codigoContrato=${codigoContrato}&idStatusFatura=4&pix=1`
        );
        if (Array.isArray(vencidasResp.data)) {
            faturas.push(...vencidasResp.data);
        }
    } catch (err) {
        console.warn(`⚠️ Erro ao buscar faturas vencidas para contrato ${codigoContrato}: ${err.message}`);
    }

    return faturas;
}

// Controller principal
exports.buscarPorCPFNome = async (req, res) => {
    const where = {};
    const andConditions = [];

    if (req.body.documento_corretora) {
        where.documento_corretora = req.body.documento_corretora;
    }

    if (req.body.cpf) {
        where.cpf = req.body.cpf;
    }

    if (req.body.nome_do_beneficiario) {
        andConditions.push(
            whereSequelize(fn('LOWER', col('nome_do_beneficiario')), {
                [Op.like]: `%${req.body.nome_do_beneficiario.toLowerCase()}%`
            })
        );
    }

    if (req.body.operadora) {
        andConditions.push(
            whereSequelize(fn('LOWER', col('operadora')), {
                [Op.like]: `%${req.body.operadora.toLowerCase()}%`
            })
        );
    }

    if (req.body.status_do_beneficiario) {
        andConditions.push(
            whereSequelize(fn('LOWER', col('status_do_beneficiario')), {
                [Op.like]: `%${req.body.status_do_beneficiario.toLowerCase()}%`
            })
        );
    }

    if (req.body.titular === true) {
        where.tipo_de_beneficiario = 'Titular';
    }

    // Datas de entrada
    const inicio = req.body.dataInicio ? moment(req.body.dataInicio, "YYYY-MM-DD") : null;
    const fimOriginal = req.body.dataFim ? moment(req.body.dataFim, "YYYY-MM-DD") : null;
    const fim = inicio && fimOriginal && fimOriginal.diff(inicio, "days") > 30
        ? inicio.clone().add(30, "days")
        : fimOriginal;

    // Sempre garantir que data_de_assinatura não é nula
    where.data_de_assinatura = { [Op.not]: null };

    try {
        let beneficiarios = await Beneficiario.findAll({
            where: {
                ...where,
                ...(andConditions.length > 0 ? { [Op.and]: andConditions } : {})
            },
            order: [['nome_do_beneficiario', 'ASC']],
        });

        // Filtro manual por data_de_assinatura (salvo como string "DD/MM/YYYY")
        if (inicio && fim) {
            beneficiarios = beneficiarios.filter(b => {
                const dataAss = moment(b.data_de_assinatura, "DD/MM/YYYY");
                return dataAss.isSameOrAfter(inicio) && dataAss.isSameOrBefore(fim);
            });
        }

        const incluirFaturas = req.body.fatura === true;

        // Se não precisa incluir faturas, retorna diretamente
        if (!incluirFaturas) {
            return res.send({
                beneficiarios,
                message: "Lista de beneficiários!",
                sucesso: true
            });
        }

        // Buscar faturas individualmente
        const beneficiariosComFaturas = [];

        for (const b of beneficiarios) {
            try {
                const faturas = await buscarFaturasPorContrato(b.codigo_do_contrato);
                beneficiariosComFaturas.push({
                    ...b.toJSON(),
                    faturas
                });
            } catch (err) {
                console.error(`Erro ao processar beneficiário ${b.id}: ${err.message}`);
                beneficiariosComFaturas.push({
                    ...b.toJSON(),
                    faturas: []
                });
            }

            await sleep(300); // controla a taxa de requisição
        }

        return res.send({
            beneficiarios: beneficiariosComFaturas,
            message: "Lista de beneficiários com faturas!",
            sucesso: true
        });

    } catch (error) {
        console.error("Erro geral:", error);
        return res.status(500).send({
            message: error.message,
            sucesso: false
        });
    }
};


