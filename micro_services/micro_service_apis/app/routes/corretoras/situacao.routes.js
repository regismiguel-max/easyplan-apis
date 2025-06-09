const { authJwt } = require("../../middleware");
const controller = require("../../controllers/corretoras/situacao.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/corretora/situacao", [authJwt.verifyToken, authJwt.isAgentOrAdmin],
        controller.addSituacao
    );

    app.get(
        "/corretora/situacao/all", [authJwt.verifyToken, authJwt.isAgentOrAdmin],
        controller.findAll
    );

    app.get(
        "/corretora/situacao/:id", [authJwt.verifyToken, authJwt.isAgentOrAdmin],
        controller.findSituacao
    );

    app.put(
        "/corretora/situacao/:id", [authJwt.verifyToken, authJwt.isAgentOrAdmin],
        controller.updateSituacao
    );

    app.delete(
        "/corretora/situacao/:id", [authJwt.verifyToken, authJwt.isAgentOrAdmin],
        controller.deleteSituacao
    );
};