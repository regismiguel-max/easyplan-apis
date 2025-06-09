const { authVerify } = require("../../middleware");
const controller = require("../../controllers/digital_saude/demonstrativo.controller");

module.exports = (app) => {
    app.get(
        "/digitalsaude/demonstrativo/procurarPorContrato/:codigoContrato",
        controller.procurarPorContrato
    );
};
