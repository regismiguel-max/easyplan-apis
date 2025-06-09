const { authJwt } = require("../../middleware");
const controller = require("../../controllers/corretoras/categoria.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/corretora/categoria", [authJwt.verifyToken, authJwt.isAgentOrAdmin],
        controller.addCategoria
    );

    app.get(
        "/corretora/categoria/all", [authJwt.verifyToken],
        controller.findAll
    );

    app.get(
        "/corretora/categoria/:id", [authJwt.verifyToken, authJwt.isAgentOrAdmin],
        controller.findCategoria
    );

    app.put(
        "/corretora/categoria/:id", [authJwt.verifyToken, authJwt.isAgentOrAdmin],
        controller.updateCategoria
    );

    app.delete(
        "/corretora/categoria/:id", [authJwt.verifyToken, authJwt.isAgentOrAdmin],
        controller.deleteCategoria
    );
};