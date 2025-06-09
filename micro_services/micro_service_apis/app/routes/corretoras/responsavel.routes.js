const { authJwt } = require("../../middleware");
const controller = require("../../controllers/corretoras/responsavel.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/corretora/responsavel",
        controller.addResponsavel
    );

    app.get(
        "/corretora/responsavel", [authJwt.verifyToken],
        controller.findAll
    );

    app.get(
        "/corretora/responsavel/:id", [authJwt.verifyToken],
        controller.findResponsavel
    );

    app.put(
        "/corretora/responsavel/:id", [authJwt.verifyToken],
        controller.updateResponsavel
    );

    app.delete(
        "/corretora/responsavel/:id", [authJwt.verifyToken, authJwt.isAgentOrAdmin],
        controller.deleteResponsavel
    );
};