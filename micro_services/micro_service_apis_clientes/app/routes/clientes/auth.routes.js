const { verifyAuth } = require("../../middleware");
const controller = require("../../controllers/clientes/auth.controller");

module.exports = function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/cliente/auth/signin", [verifyAuth.verifyToken],
        controller.signin);
};