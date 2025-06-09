const axios = require("../../config/axios/axios.config.js");

exports.procurarPorContrato = async (req, res) => {
    axios.https.get(
        `/demonstrativoPagamento/procurarPorContrato?codigoContrato=${req.params.codigoContrato}`,

    )
        .then((response) => {
            if (response.data) {
                res.send({
                    demonstrativo: response.data,
                    message: "Demonstrativo encontrado com sucesso!",
                    sucesso: true
                });
            }
            else {
                res.send({
                    message: "Nenhum demonstrativo encontrado!",
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
