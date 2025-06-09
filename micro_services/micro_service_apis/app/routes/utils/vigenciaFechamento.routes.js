const controller = require("../../controllers/utils/vigenciaFechamento.controller");

module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.get(
        "/vigenciafechamento",
        controller.getVigenciaFechamento
    );
};