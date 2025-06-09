const axios = require("../../config/axios/axios.config.js");

exports.getLancamantos = async (req, res) => {
    const dateFim = req.body.dataFinal ? `${req.body.dataFinal.slice(0, 10)}T23:59:59Z` : '';
    console.log(dateFim)
    axios.https.get(
        `/lancamento/?dataInicial=${req.body.dataInicial}&dataFinal=${dateFim}&pagina=${req.body.page}&tamanhoPagina=50&idTipoLancamento=${req.body.idTipoLancamento}`,
    )
        .then((response) => {
            res.send({
                lancamentos: response.data,
                message: "Lancamentos encontrados com sucesso!",
                sucesso: true
            });
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