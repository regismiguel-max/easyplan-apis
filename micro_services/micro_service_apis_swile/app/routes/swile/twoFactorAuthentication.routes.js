const { authJwt } = require("../../middleware");
const controller = require("../../controllers/swile/twoFactorAuthentication.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/payment/twofactorauthentication/sendcode", [authJwt.verifyToken],
        controller.addTwoFactorAuthentication
    );

    app.post(
        "/payment/twofactorauthentication/verifycode", [authJwt.verifyToken],
        controller.verifyTwoFactorAuthentication
    );
};