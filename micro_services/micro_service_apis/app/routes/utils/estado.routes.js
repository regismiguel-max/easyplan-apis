const { authJwt } = require("../../middleware");
const controller = require("../../controllers/utils/estado.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/estado", [authJwt.verifyToken, authJwt.isAdmin],
        controller.addEstado
    );

    app.post(
        "/estado/lote", [authJwt.verifyToken, authJwt.isAdmin],
        controller.addEstadoLote
    );

    app.get(
        "/estado",
        controller.findAll
    );

    app.get(
        "/estado/:id",
        controller.findEstado
    );

    app.put(
        "/estado/:id", [authJwt.verifyToken, authJwt.isAdmin],
        controller.updateEstado
    );

    app.delete(
        "/estado/:id", [authJwt.verifyToken, authJwt.isAdmin],
        controller.deleteEstado
    );
};