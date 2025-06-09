const { authJwt, verifyWhatsApp } = require("../../middleware");
const controller = require("../../controllers/produtores/twoFactorAuthentication.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/produtor/twofactorauthentication",
        controller.addTwoFactorAuthentication
    );

    app.post(
        "/produtor/twofactorauthentication/verifywhatsapp", [verifyWhatsApp.checkAuthProdutor],
    );

    app.get(
        "/produtor/twofactorauthentication/:cpf",
        controller.findTwoFactorAuthentication
    );

    app.put(
        "/produtor/twofactorauthentication/:id", [authJwt.verifyToken],
        controller.updateTwoFactorAuthentication
    );

    app.delete(
        "/produtor/twofactorauthentication/:id", [authJwt.verifyToken],
        controller.deleteTwoFactorAuthentication
    );
};