const { authJwt } = require("../../../middleware");
const controller = require("../../../controllers/supervisores/users/auth.controller");

module.exports = function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post("/supervisor/auth/signin", controller.signin);

    app.get("/supervisor/auth/verifyToken", controller.verifyToken);

    app.get("/supervisor/auth/validarSessao", [authJwt.validaSessaoToken]);
};