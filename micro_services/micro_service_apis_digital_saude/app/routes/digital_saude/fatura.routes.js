const { authVerify } = require("../../middleware");
const controller = require("../../controllers/digital_saude/fatura.controller");

module.exports = (app) => {
    app.get(
        "/digitalsaude/fatura/procurarPorContrato/:codigo",
        controller.procurarPorContrato
    );

    app.get(
        "/digitalsaude/fatura/kualiz/procurarPorContrato/:codigo",
        controller.kualizProcurarPorContrato
    );

};
