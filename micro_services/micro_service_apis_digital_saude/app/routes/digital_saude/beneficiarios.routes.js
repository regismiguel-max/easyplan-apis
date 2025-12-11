const auth = require("../../middleware/authVerify");
const controller = require("../../controllers/digital_saude/beneficiarios.controller");

module.exports = (app) => {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, x-access-key, Origin, Content-Type, Accept"
        );
        next();
    });

    // 🔹 Buscar beneficiários com filtros
    app.get(
        "/digitalsaude/beneficiarios",
        auth.verifyAccessPair,
        controller.buscarBeneficiarios
    );
};
