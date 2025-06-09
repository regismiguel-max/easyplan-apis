const { authJwt } = require("../../middleware");
const controller = require("../../controllers/produtores/situacao.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/produtor/situacao", [authJwt.verifyToken],
        controller.addSituacao
    );

    app.get(
        "/produtor/situacao/all", [authJwt.verifyToken],
        controller.findAll
    );

    app.get(
        "/produtor/situacao/:id", [authJwt.verifyToken],
        controller.findSituacao
    );

    app.put(
        "/produtor/situacao/:id", [authJwt.verifyToken],
        controller.updateSituacao
    );

    app.delete(
        "/produtor/situacao/:id", [authJwt.verifyToken],
        controller.deleteSituacao
    );
};