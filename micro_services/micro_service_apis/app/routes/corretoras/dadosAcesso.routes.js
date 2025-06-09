const { authJwt } = require("../../middleware");
const controller = require("../../controllers/corretoras/dadosAcesso.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/corretora/acesso",
        controller.addDadosAcesso
    );

    app.put(
        "/corretora/acesso/:id", [authJwt.verifyToken],
        controller.updateDadosAcesso
    );

    app.delete(
        "/corretora/acesso/:id", [authJwt.verifyToken, authJwt.isAgentOrAdmin],
        controller.deleteDadosAcesso
    );
};