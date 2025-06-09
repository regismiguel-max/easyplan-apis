const { verifyAuth } = require("../../middleware");
const controller = require("../../controllers/clientes/twoFactorAuthentication.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/cliente/twofactorauthentication/sendcode", [verifyAuth.verifyToken],
        controller.addTwoFactorAuthentication
    );

    app.post(
        "/cliente/twofactorauthentication/verifycode", [verifyAuth.verifyToken],
        controller.verifyTwoFactorAuthentication
    );
};