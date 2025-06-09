const controller = require("../../controllers/utils/versionAPP.controller");

module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.get(
        "/version/app/cliente",
        controller.getVersionAPPCliente
    );

    app.get(
        "/version/app/corretor",
        controller.getVersionAPPCorretor
    );

};