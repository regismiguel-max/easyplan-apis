const db = require("../../../../../models/index.js");
const Beneficiario = db.beneficiariosDigital;
const { Op, fn, col, where: whereSequelize } = require("sequelize");
const axios = require("../../config/axios/axios.config.js");
const moment = require("moment");


// Função que busca faturas emitidas e vencidas com tratamento individual de erros
async function buscarFaturasPorContrato(codigoContrato) {
    // função que evita código repetido
    const fetchPorStatus = async (statusId, nomeStatus) => {
        try {
            const resp = await axios.digital.get(
                `/fatura/procurarPorContrato?codigoContrato=${codigoContrato}&idStatusFatura=${statusId}&pix=1`
            );
            return Array.isArray(resp.data) ? resp.data : [];
        } catch (err) {
            console.warn(`Erro ao buscar faturas ${nomeStatus} para contrato ${codigoContrato}: ${err.message}`);
            return null;
        }
    };

    // dispara requisições paralelas de faturas pendentes e faturas vencidas
    const [emitidas, vencidas] = await Promise.all([
        fetchPorStatus(2, 'emitidas'),
        fetchPorStatus(4, 'vencidas')
    ]);

    // caso as duas buscas retornam null, a API externa falhou
    if (emitidas == null && vencidas == null) {
        throw new Error("Sistema da Digital Saúde indisponível no momento.");
    }

    // agrupa apenas os arrays válidos
    return [...(emitidas || []), ...(vencidas || [])];
}

// Controller principal
exports.buscarPorCPFNome = async (req, res) => {
    const where = {};
    const andConditions = [];

    if (req.body.cpf) {where.cpf = req.body.cpf;}

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

    if (req.body.documento_corretora) {where.documento_corretora = req.body.documento_corretora;}

    if (req.body.status_do_beneficiario) {
        andConditions.push(
            whereSequelize(fn('LOWER', col('status_do_beneficiario')), {
                [Op.like]: `%${req.body.status_do_beneficiario.toLowerCase()}%`
            })
        );
    }

    if (req.body.titular === true) {where.tipo_de_beneficiario = 'Titular';}

    // aplicação do filtro de datas
    if (req.body.dataInicio && req.body.dataFim) {
        const inicio = moment(req.body.dataInicio).startOf('day').toDate();
        const fim = moment(req.body.dataFim).endOf('day').toDate();
        where.data_da_assinatura = { [Op.between]: [inicio, fim] };
    }

    // paginação
    const rawPage = parseInt(req.body.page, 10);
    const page = (rawPage > 0) ? rawPage : 1; // página nunca será 0 ou negativa

    const rawLimit = parseInt(req.body.limit, 10);
    const limit = (rawLimit > 0) ? Math.min(rawLimit, 100) : 10; // limite dinâmica, pode ser alterada pelo front

    const offset = (page - 1) * limit;


    try {
        // procura na tabela e conta quantidade de linhas
        const { count, rows: beneficiarios } = await Beneficiario.findAndCountAll({
            where: {
                ...where,
                ...(andConditions.length > 0 ? { [Op.and]: andConditions } : {})
            },
            order: [['vigencia', 'DESC']],
            limit: limit,   // Traz apenas 20
            offset: offset  // Pula os anteriores
        });

        return res.send({
            beneficiarios,
            total: count, // informa ao front quantas páginas existem
            totalPages: Math.ceil(count / limit),
            currentPage: page,
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


exports.buscarFaturasDoCliente = async (req, res) => {
    // captura código do contrato do cliente após clicar no botão
    const codigoContrato = req.body.codigoContrato || req.query.codigoContrato;

    if (!codigoContrato) {
        return res.status(400).send({
            sucesso: false,
            message: "Código de contrato não encontrado."
        });
    }

    try {
        const faturas = await buscarFaturasPorContrato(codigoContrato);

        return res.send({
            sucesso: true,
            faturas: faturas
        });
    } catch (error) {
        console.error("Erro ao buscar faturas individuais:", error);
        return res.status(502).send({
            sucesso: false,
            message: error.message || "Falha de comunicação com Digital Saúde"
        });
    }
}