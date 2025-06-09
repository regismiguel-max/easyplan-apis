const { authJwt } = require("../../../middleware");
const controller = require("../../../controllers/supervisores/apoio_vendas/operators.controller");

module.exports = (app) => {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.get(
        "/supervisor/salessupport/operator", [authJwt.verifyToken],
        controller.findAll
    );

    app.get(
        "/supervisor/salessupport/operator/:id", [authJwt.verifyToken],
        controller.findOperator
    );

};