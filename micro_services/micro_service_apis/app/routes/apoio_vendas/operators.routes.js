const { authJwt } = require("../../middleware");
const controller = require("../../controllers/apoio_vendas/operators.controller");

module.exports = (app) => {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/operator/", [authJwt.verifyToken, authJwt.isAdmin],
        controller.addOperator
    );

    app.get(
        "/operator",
        controller.findAll
    );

    app.get(
        "/operator/:id",
        controller.findOperator
    );

    app.put(
        "/operator/:id", [authJwt.verifyToken, authJwt.isAdmin],
        controller.updateOperator
    );

    app.delete(
        "/operator/:id", [authJwt.verifyToken, authJwt.isAdmin],
        controller.deleteOperator
    );
};