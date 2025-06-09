const { authJwt } = require("../../middleware");
const controller = require("../../controllers/utils/cidade.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/cidade", [authJwt.verifyToken, authJwt.isAdmin],
        controller.addCidade
    );

    app.post(
        "/cidade/lote", [authJwt.verifyToken, authJwt.isAdmin],
        controller.addCidadeLote
    );

    app.get(
        "/cidade",
        controller.findAll
    );

    app.get(
        "/cidade/:id",
        controller.findCidade
    );

    app.put(
        "/cidade/:id", [authJwt.verifyToken, authJwt.isAdmin],
        controller.updateCidade
    );

    app.delete(
        "/cidade/:id", [authJwt.verifyToken, authJwt.isAdmin],
        controller.deleteCidade
    );
};