const { authJwt } = require("../../../middleware");
const controller = require("../../../controllers/supervisores/propostas/proposta.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/supervisor/proposta",
        controller.procurarProposta
    );

    
    app.put(
        "/supervisor/editarProposta",
        controller.editarProposta
    );
};