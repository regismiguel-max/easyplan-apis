const { authVerify } = require("../../middleware");
const controller = require("../../controllers/digital_saude/lancamento.controller");

module.exports = (app) => {
    app.post(
        "/digitalsaude/lancamentos",
        controller.getLancamantos
    );

};

