const { authVerify } = require("../../middleware");
const controller = require("../../controllers/digital_saude/contrato.controller");

module.exports = (app) => {
    app.get(
        "/digitalsaude/contrato/procurarPorCpfTitular/:cpf",
        controller.procurarPorCpfTitular
    );

    app.get(
        "/digitalsaude/contrato/procurarPorCodigo/:codigo",
        controller.procurarPorCodigo
    );

    app.post(
        "/digitalsaude/contrato/procurarPorClientePortal",
        controller.procurarPorClientePortal
    );

    app.get(
        "/digitalsaude/contrato/kualiz/procurarPorCpfTitular/:cpf",
        controller.kualizProcurarPorCpfTitular
    );

};
