const { verifyAuth } = require("../../middleware");
const controller = require("../../controllers/push/push_dispositivos.controller");
const controller2 = require('../../controllers/push/push_logs.controller');

module.exports = function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/cliente/push-dispositivos",
        controller.pushDispositivos
    );

    app.get(
        "/cliente/push-dispositivos",
        controller2.dispararPushBoletos
    );
};