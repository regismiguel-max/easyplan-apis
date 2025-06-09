const { authJwt } = require("../../middleware");
const controller = require("../../controllers/utils/bancos.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/banco", [authJwt.verifyToken, authJwt.isAdmin],
        controller.addBanco
    );

    app.post(
        "/banco/lote", [authJwt.verifyToken, authJwt.isAdmin],
        controller.addBancoLote
    );

    app.get(
        "/banco",
        controller.findAll
    );

    app.get(
        "/banco/:id",
        controller.findBanco
    );

    app.put(
        "/banco/:id", [authJwt.verifyToken, authJwt.isAdmin],
        controller.updateBanco
    );

    app.delete(
        "/banco/:id", [authJwt.verifyToken, authJwt.isAdmin],
        controller.deleteBanco
    );
};