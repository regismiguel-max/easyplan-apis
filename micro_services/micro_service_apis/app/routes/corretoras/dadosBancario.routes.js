const { authJwt } = require("../../middleware");
const controller = require("../../controllers/corretoras/dadosBancario.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/corretora/bancario",
        controller.addDadosBancario
    );

    app.get(
        "/corretora/bancario", [authJwt.verifyToken],
        controller.findAll
    );

    app.get(
        "/corretora/bancario/:id", [authJwt.verifyToken],
        controller.findDadosBancario
    );

    app.put(
        "/corretora/bancario/:id", [authJwt.verifyToken],
        controller.updateDadosBancario
    );

    app.delete(
        "/corretora/bancario/:id", [authJwt.verifyToken, authJwt.isAgentOrAdmin],
        controller.deleteDadosBancario
    );
};