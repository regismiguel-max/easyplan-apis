const { authJwt, verifySignUp } = require("../../middleware");
const controller = require("../../controllers/users/user.controller");

module.exports = function(app) {
    app.use(function(req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/user", [
        verifySignUp.checkDuplicateEmail,
        verifySignUp.checkDuplicateCPF,
        verifySignUp.checkRolesExisted
    ],
        controller.createUser
    );

    app.put(
        "/user/:id", [authJwt.verifyToken],
        controller.updateUser
    );

    app.put(
        "/user/:id/permissions", [authJwt.verifyToken],
        controller.updateUserPermissions
    );

    app.get(
        "/user/:id/permissions", [authJwt.verifyToken],
        controller.findAllPermissions
    );

    app.get(
        "/user/all", [authJwt.verifyToken],
        controller.findAllUsers
    );
};