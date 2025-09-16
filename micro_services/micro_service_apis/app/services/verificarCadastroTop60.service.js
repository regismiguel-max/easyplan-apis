const axios = require("axios");
const https = require("https");
const { Op } = require("sequelize");
const db = require("../../../../models");

const relaxAgent = new https.Agent({ rejectUnauthorized: false });

const normDigits = (s) => String(s || "").replace(/\D+/g, "");
const pegarCpf = (row) => {
    const possiveis = [row?.corretor_cpf, row?.cpf, row?.documento, row?.cpfProdutor, row?.cpf_corretor];
    return normDigits(possiveis.find(Boolean));
};
const pegarNome = (row) => row?.nome_corretor || row?.nome || row?.corretor_nome || row?.nome_produtor || "Produtor";

async function verificarCadastroTop60PorVigencia(vigenciaMonth, opts = {}) {
    const escopo = opts.escopo || "nacional";
    const limit = Number(opts.limit || 60);

    const url = `https://apis.easyplan.com.br:3088/api/ranking/por-vigencia?janela=MES&vigencia=${vigenciaMonth}&escopo=${escopo}&limit=${limit}&incluirValor=false`;
    const { data } = await axios.get(url, null, { timeout: 60000, httpsAgent: relaxAgent });

    if (!data?.top || !Array.isArray(data.top) || data.top.length === 0) {
        return {
            vigencia: vigenciaMonth,
            total_top: 0,
            cadastrados_count: 0,
            nao_cadastrados_count: 0,
            cadastrados: [],
            nao_cadastrados: []
        };
    }

    const top60 = data.top.slice(0, 60)
        .map((row) => ({ cpf: pegarCpf(row), nome: pegarNome(row) }))
        .filter(x => x.cpf && x.cpf.length >= 11);

    // dedup CPF
    const seen = new Set();
    const unicos = [];
    for (const c of top60) {
        if (!seen.has(c.cpf)) { seen.add(c.cpf); unicos.push(c); }
    }
    const cpfs = unicos.map(u => u.cpf);

    // busca em lote
    const Produtores = db.produtores;
    const encontrados = await Produtores.findAll({
        where: { cpf: { [Op.in]: cpfs } },
        attributes: ["id", "nome", "cpf"],
        raw: true,
    });

    const setEncontrados = new Set(encontrados.map(p => normDigits(p.cpf)));

    const cadastrados = encontrados.map(p => ({
        id: p.id,
        nome: p.nome,
        cpf: normDigits(p.cpf),
    }));

    const nao_cadastrados = unicos
        .filter(u => !setEncontrados.has(u.cpf))
        .map(u => ({ nome: u.nome, cpf: u.cpf }));

    return {
        vigencia: vigenciaMonth,
        total_top: top60.length,
        cadastrados_count: cadastrados.length,
        nao_cadastrados_count: nao_cadastrados.length,
        cadastrados,
        nao_cadastrados,
    };
}

module.exports = { verificarCadastroTop60PorVigencia };
