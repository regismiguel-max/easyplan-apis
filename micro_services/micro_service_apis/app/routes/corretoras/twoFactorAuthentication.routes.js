const { authJwt, verifyWhatsApp } = require("../../middleware");
const controller = require("../../controllers/corretoras/twoFactorAuthentication.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/corretora/twofactorauthentication",
        controller.addTwoFactorAuthentication
    );

    app.post(
        "/corretora/twofactorauthentication/verifywhatsapp", [verifyWhatsApp.checkAuth],
    );

    app.get(
        "/corretora/twofactorauthentication/:cnpj",
        controller.findTwoFactorAuthentication
    );

    app.put(
        "/corretora/twofactorauthentication/:id", [authJwt.verifyToken],
        controller.updateTwoFactorAuthentication
    );

    app.delete(
        "/corretora/twofactorauthentication/:id", [authJwt.verifyToken, authJwt.isAgentOrAdmin],
        controller.deleteTwoFactorAuthentication
    );
};