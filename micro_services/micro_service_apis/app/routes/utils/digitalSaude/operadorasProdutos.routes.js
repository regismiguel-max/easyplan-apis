const { authJwt } = require("../../../middleware");
const controller = require("../../../controllers/utils/digitalSaude/operadorasProdutos.controller");
const up = require("../../../controllers/utils/digitalSaude/uploadOperadorasProdutos.controller");

module.exports = (app) => {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/utils/digitalSaude/operadorasProdutos",
        up.upload.single('file'),
        controller.addOperadorasProdutos
    );

    app.get(
        "/utils/digitalSaude/operadorasProdutos",
        controller.getOperadorasProdutos
    );
};