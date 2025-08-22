const auth = require("../../middleware/authVerify");
const controller = require("../../controllers/digital_saude/zendesk.controller");

module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, x-access-key, Origin, Content-Type, Accept"
        );
        next();
    });

    app.get(
        "/digitalsaude/zendesk/contrato/procurarPorCpfTitular/:cpf", auth.verifyAccessPair,
        controller.buscarContratosFaturas
    );
};
