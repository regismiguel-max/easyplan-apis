const { authJwt } = require("../../../middleware");
const controller = require("../../../controllers/supervisores/users/twoFactorAuthentication.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/supervisor/twofactorauthentication/sendcode", [authJwt.verifyToken],
        controller.addTwoFactorAuthentication
    );

    app.post(
        "/supervisor/twofactorauthentication/verifycode", [authJwt.verifyToken],
        controller.verifyTwoFactorAuthentication
    );
};