const { authJwt } = require("../../middleware");
const controller = require("../../controllers/utils/tipoContaBancaria.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/tipocontabancaria", [authJwt.verifyToken, authJwt.isAdmin],
        controller.addTipoContaBancaria
    );

    app.post(
        "/tipocontabancaria/lote", [authJwt.verifyToken, authJwt.isAdmin],
        controller.addTipoContaBancariaLote
    );

    app.get(
        "/tipocontabancaria",
        controller.findAll
    );

    app.get(
        "/tipocontabancaria/:id",
        controller.findTipoContaBancaria
    );

    app.put(
        "/tipocontabancaria/:id", [authJwt.verifyToken, authJwt.isAdmin],
        controller.updateTipoContaBancaria
    );

    app.delete(
        "/tipocontabancaria/:id", [authJwt.verifyToken, authJwt.isAdmin],
        controller.deleteTipoContaBancaria
    );
};