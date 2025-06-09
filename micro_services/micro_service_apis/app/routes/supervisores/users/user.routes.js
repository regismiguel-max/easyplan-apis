const { authJwt, verifySignUp } = require("../../../middleware");
const controller = require("../../../controllers/supervisores/users/user.controller");

module.exports = function(app) {
    app.use(function(req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.get(
        "/supervisor/user/:documento/:email", [authJwt.verifyToken],
        controller.findUser
    );

    app.get(
        "/supervisor/user/:id/permissions", [authJwt.verifyToken],
        controller.findAllPermissions
    );

    app.put(
        "/supervisor/user/password/:documento", [authJwt.verifyToken],
        controller.updatePasswordUser
    );
};