const controller = require("../../../controllers/utils/regrasDeBonificacao/regrasDeBonificacao.controller");

module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/utils/regrasdebonificacao",
        controller.addRegraDeBonificacao
    );

    app.get(
        "/utils/regrasdebonificacao",
        controller.getRegrasDeBonificacao
    );
};